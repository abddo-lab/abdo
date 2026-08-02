// server/src/services/workflow.ts — n8n: node-first (docker-compose on remote node), local Docker fallback
import { SandboxService } from "./sandbox.js";
import { NodeService } from "./node.js";
import { loadConfig } from "../config.js";
import pool from "../db.js";
import { v4 as uuid } from "uuid";

export class WorkflowService {
  /** Create a workflow instance */
  static async create(userId: string, name: string, slug: string, template: string, region: string, plan: string): Promise<any> {
    const existing = await pool.query(`SELECT id FROM workflow_instances WHERE slug = $1`, [slug]);
    if (existing.rows.length > 0) throw new Error(`Slug '${slug}' is already taken`);

    const id = uuid();
    await pool.query(
      `INSERT INTO workflow_instances (id, user_id, name, slug, template, region, plan, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'provisioning')`,
      [id, userId, name, slug, template, region, plan]
    );

    this.provisionInstance(id, userId, slug).catch(console.error);
    return { id, name, slug, status: "provisioning" };
  }

  private static async provisionInstance(instanceId: string, userId: string, slug: string): Promise<void> {
    try {
      const config = loadConfig();

      // ── Path A: remote node (fast — pre-pulled image, no npm install) ──
      const node = await NodeService.pickNode();
      if (node) {
        await this.provisionOnNode(instanceId, slug, node);
        return;
      }

      // ── Path B: local Docker sandbox fallback ──
      await this.provisionLocal(instanceId, userId, slug);
    } catch (err) {
      console.error(`Workflow provisioning failed for ${instanceId}:`, err);
      await pool.query(`UPDATE workflow_instances SET status = 'error', updated_at = NOW() WHERE id = $1`, [instanceId]);
    }
  }

  /** n8n on a remote node via docker-compose — no npm install, no OOM risk */
  private static async provisionOnNode(instanceId: string, slug: string, node: any): Promise<void> {
    const config = loadConfig();
    // Unique port per instance — n8n images can't share a host port
    const n8nPort = await this.nextFreeNodePort(node.id, config.n8n.default_port);

    const result = await NodeService.runN8n(node.id, { name: slug, port: n8nPort });
    await pool.query(
      `UPDATE workflow_instances SET sandbox_id = $1, node_id = $2, n8n_port = $3 WHERE id = $4`,
      [result.name, node.id, n8nPort, instanceId]
    );

    // Poll n8n healthz over the node (via exec into the container)
    const ready = await this.waitForNodePort(node.id, result.name, n8nPort, 180000);
    if (!ready) throw new Error("n8n did not become ready on node in time");

    // Outbound Cloudflare tunnel from the node (no public IP needed)
    const tunnel = await NodeService.openTunnel(node.id, { target: `http://localhost:${n8nPort}`, name: slug });
    const tunnelUrl = (tunnel.url && tunnel.url.match(/https:\/\/[^\s"]+/))?.[0] || `https://${slug}.${config.app.base_domain}`;

    try { await fetch(config.afraid_dns.sync_url); } catch {}

    await pool.query(
      `UPDATE workflow_instances SET status = 'live', tunnel_url = $1, offered = true, updated_at = NOW() WHERE id = $2`,
      [tunnelUrl, instanceId]
    );
  }

  /** Find a host port not already bound on the node */
  private static async nextFreeNodePort(nodeId: string, startPort: number): Promise<number> {
    const res = await NodeService.exec(nodeId, `ss -ltn 2>/dev/null | awk '{print $4}' | grep -oP ':\\K[0-9]+$' | sort -u | tr '\\n' ' '; echo`);
    const used = new Set((res.stdout || "").split(/\s+/).map((p) => parseInt(p)).filter((n) => !isNaN(n)));
    let port = startPort;
    while (used.has(port)) port++;
    return port;
  }

  private static async waitForNodePort(nodeId: string, container: string, port: number, timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        // n8n container maps 127.0.0.1:port on the node host — check from the host
        const res = await NodeService.exec(nodeId, `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${port}/healthz`);
        if (res.success && res.stdout.trim() === "200") return true;
      } catch { /* not up yet */ }
      await new Promise((r) => setTimeout(r, 5000));
    }
    return false;
  }

  /** Local sandbox fallback (existing behavior, with OOM fixes) */
  private static async provisionLocal(instanceId: string, userId: string, slug: string): Promise<void> {
    try {
      const config = loadConfig();

      // Create dedicated sandbox — 25GB storage, 2GB RAM + 2GB swap so the n8n
      // npm install does not OOM under the default 1GB cap.
      const sandbox = await SandboxService.createSandbox(userId, `wf-${slug}`, { storageGb: 25, memoryGb: 2, swapGb: 2 });
      await pool.query(`UPDATE workflow_instances SET sandbox_id = $1 WHERE id = $2`, [sandbox.daytona_sandbox_id, instanceId]);

      // Wait for sandbox
      await this.waitForSandbox(sandbox.daytona_sandbox_id, 180000);
      // Wait for the workspace image to be mounted (bootstrap runs in the background)
      const mountWait = await SandboxService.execCommand(sandbox.daytona_sandbox_id,
        `for i in $(seq 1 240); do mountpoint -q /workspace && exit 0; sleep 1; done; exit 1`);
      if (mountWait.exit !== 0) throw new Error("Workspace image did not mount in time");

      // Install n8n in the background (takes minutes) — NO username/password, public access.
      // Logs go to /tmp/n8n-install.log so failures are diagnosable. Detached exec keeps
      // the install alive after this request's exec session ends.
      const n8nPort = config.n8n.default_port;
      const install = await SandboxService.execDetached(sandbox.daytona_sandbox_id,
        `mkdir -p /workspace/.n8n && cd /workspace/.n8n && npm install -g n8n@latest --no-audit --no-fund > /tmp/n8n-install.log 2>&1 && N8N_BASIC_AUTH_ACTIVE=false N8N_BASIC_AUTH_USER="" N8N_BASIC_AUTH_PASSWORD="" n8n start --port=${n8nPort} --host=0.0.0.0 > /tmp/n8n-setup.log 2>&1`);
      if (install.exit !== 0) throw new Error(`Failed to start n8n install: ${install.stderr}`);

      // Wait for n8n to be up (install + boot can take minutes)
      const ready = await this.waitForPort(sandbox.daytona_sandbox_id, n8nPort, 720000);
      if (!ready) {
        // Surface the install log so failures aren't silent
        const log = await SandboxService.execCommand(sandbox.daytona_sandbox_id,
          `tail -n 30 /tmp/n8n-install.log /tmp/n8n-setup.log 2>/dev/null`);
        throw new Error(`n8n did not become ready in time.\n${log.stdout || log.stderr}`);
      }

      // Cloudflare quick tunnel — no sign-in needed
      await SandboxService.execCommand(sandbox.daytona_sandbox_id,
        `curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared`);

      // Start quick tunnel and capture URL
      await SandboxService.execDetached(sandbox.daytona_sandbox_id,
        `nohup cloudflared tunnel --url http://localhost:${n8nPort} > /tmp/tunnel.log 2>&1 &`);

      await new Promise((r) => setTimeout(r, 8000));

      const logResult = await SandboxService.execCommand(sandbox.daytona_sandbox_id, `cat /tmp/tunnel.log`);
      const urlMatch = logResult.stdout.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      const tunnelUrl = urlMatch ? urlMatch[0] : `https://${slug}.${config.app.base_domain}`;

      // Sync DNS
      try { await fetch(config.afraid_dns.sync_url); } catch {}

      await pool.query(
        `UPDATE workflow_instances SET status = 'live', tunnel_url = $1, n8n_port = $2, offered = true, updated_at = NOW() WHERE id = $3`,
        [tunnelUrl, n8nPort, instanceId]
      );
    } catch (err) {
      console.error(`Workflow provisioning failed for ${instanceId}:`, err);
      await pool.query(`UPDATE workflow_instances SET status = 'error', updated_at = NOW() WHERE id = $1`, [instanceId]);
    }
  }

  static async list(userId: string): Promise<any[]> {
    const result = await pool.query(`SELECT * FROM workflow_instances WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
    return result.rows;
  }

  static async get(instanceId: string): Promise<any> {
    const result = await pool.query(`SELECT * FROM workflow_instances WHERE id = $1`, [instanceId]);
    return result.rows[0] || null;
  }

  static async getExecutions(instanceId: string): Promise<any[]> {
    const instance = await this.get(instanceId);
    if (!instance?.tunnel_url) return [];
    try {
      const resp = await fetch(`${instance.tunnel_url}/api/v1/executions?limit=50`);
      if (!resp.ok) return [];
      const data = await resp.json();
      return data.data || [];
    } catch { return []; }
  }

  static async delete(instanceId: string, userId: string): Promise<void> {
    const instance = await this.get(instanceId);
    if (instance?.sandbox_id) await SandboxService.deleteSandbox(instance.sandbox_id).catch(console.error);
    await pool.query(`DELETE FROM workflow_instances WHERE id = $1 AND user_id = $2`, [instanceId, userId]);
  }

  static async pause(instanceId: string): Promise<void> {
    await pool.query(`UPDATE workflow_instances SET status = 'paused', offered = false, updated_at = NOW() WHERE id = $1`, [instanceId]);
  }

  static async resume(instanceId: string): Promise<void> {
    await pool.query(`UPDATE workflow_instances SET status = 'live', offered = true, updated_at = NOW() WHERE id = $1`, [instanceId]);
  }

  static async deductBilling(userId: string, executions: number): Promise<void> {
    const config = loadConfig();
    const cost = (executions / 1000) * config.billing.execution_cost_per_1k;
    if (cost > 0) await pool.query(`UPDATE users SET balance = GREATEST(0, balance - $1), updated_at = NOW() WHERE id = $2`, [cost, userId]);
  }

  private static async waitForSandbox(sandboxId: string, timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const sb = await SandboxService.getSandbox(sandboxId);
      if (sb?.status === "running") return;
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error("Sandbox provisioning timeout");
  }

  /** Poll a port inside the sandbox until it answers (curl healthz) */
  private static async waitForPort(sandboxId: string, port: number, timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await SandboxService.execCommand(sandboxId, `curl -s -o /dev/null -w '%{http_code}' http://localhost:${port}/healthz`);
        if (res.stdout.trim() === "200") return true;
      } catch { /* not up yet */ }
      await new Promise((r) => setTimeout(r, 5000));
    }
    return false;
  }
}
