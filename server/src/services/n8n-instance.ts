// server/src/services/n8n-instance.ts — n8n on user sandbox with hourly billing
import pool from "../db.js";
import { v4 as uuid } from "uuid";
import { SandboxService } from "./sandbox.js";
import { loadConfig } from "../config.js";

export class N8nInstanceService {
  /** Install and start n8n on the user's main sandbox */
  static async start(userId: string): Promise<any> {
    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [userId]);
    const sandboxId = user.rows[0]?.sandbox_id;
    if (!sandboxId) throw new Error("No sandbox available");

    const existing = await pool.query(`SELECT * FROM n8n_instances WHERE user_id = $1`, [userId]);
    let instance = existing.rows[0];

    // Install n8n fast using npx (no global install needed)
    await SandboxService.execCommand(sandboxId, `
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -qq >/dev/null 2>&1 || true
      apt-get install -y -qq --no-install-recommends nodejs npm curl >/dev/null 2>&1 || true
      mkdir -p /workspace/.n8n
      cd /workspace/.n8n
      # Use npx to run n8n without global install
      npm install n8n@latest --prefix /workspace/.n8n 2>/dev/null || true
    `);

    const config = loadConfig();
    const n8nPort = config.n8n.default_port;

    // Start n8n with no auth (public access) — matches user's requirement
    await SandboxService.execCommand(sandboxId, `
      export N8N_BASIC_AUTH_ACTIVE=false
      export N8N_BASIC_AUTH_USER=""
      export N8N_BASIC_AUTH_PASSWORD=""
      export N8N_PORT=${n8nPort}
      export N8N_HOST=0.0.0.0
      export N8N_PROTOCOL=http
      export WEBHOOK_URL=http://localhost:${n8nPort}
      export DB_TYPE=sqlite
      export DB_SQLITE_DATABASE=/workspace/.n8n/database.sqlite
      cd /workspace/.n8n
      pkill -f 'n8n start' 2>/dev/null || true
      sleep 1
      nohup npx n8n start --port=${n8nPort} > /workspace/.n8n/n8n.log 2>&1 &
      sleep 2
    `);

    // Wait for n8n to be ready (up to 5 seconds max)
    let ready = false;
    for (let i = 0; i < 5; i++) {
      const res = await SandboxService.execCommand(sandboxId, `curl -s -o /dev/null -w '%{http_code}' http://localhost:${n8nPort}/healthz || curl -s -o /dev/null -w '%{http_code}' http://localhost:${n8nPort}/rest/health`);
      if (res.stdout.trim() === "200") { ready = true; break; }
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Create Cloudflare quick tunnel for external access (fallback to localhost:n8nPort)
    let tunnelUrl = await this.ensureTunnel(sandboxId, `http://localhost:${n8nPort}`);
    if (!tunnelUrl) {
      tunnelUrl = `http://localhost:${n8nPort}`;
    }

    if (instance) {
      await pool.query(
        `UPDATE n8n_instances SET status = 'running', tunnel_url = $1, port = $2, last_started_at = NOW(), updated_at = NOW() WHERE id = $3`,
        [tunnelUrl, n8nPort, instance.id]
      );
    } else {
      const id = uuid();
      await pool.query(
        `INSERT INTO n8n_instances (id, user_id, sandbox_id, tunnel_url, port, status, last_started_at)
         VALUES ($1, $2, $3, $4, $5, 'running', NOW())`,
        [id, userId, sandboxId, tunnelUrl, n8nPort]
      );
      instance = { id, user_id: userId, sandbox_id: sandboxId, tunnel_url: tunnelUrl, port: n8nPort, status: 'running' };
    }

    await pool.query(
      `UPDATE users SET sandbox_n8n_url = $1, sandbox_n8n_enabled = true, updated_at = NOW() WHERE id = $2`,
      [tunnelUrl, userId]
    );

    return { ...instance, tunnel_url: tunnelUrl, status: "running", access_url: tunnelUrl, hourly_rate: 0 };
  }

  /** Stop n8n on user's sandbox */
  static async stop(userId: string): Promise<void> {
    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [userId]);
    const sandboxId = user.rows[0]?.sandbox_id;
    if (!sandboxId) return;

    await SandboxService.execCommand(sandboxId, `pkill -f 'n8n start' 2>/dev/null || true; pkill -f 'npx n8n' 2>/dev/null || true`);

    await pool.query(
      `UPDATE n8n_instances SET status = 'stopped', last_stopped_at = NOW(), updated_at = NOW() WHERE user_id = $1`,
      [userId]
    );

    await pool.query(
      `UPDATE users SET sandbox_n8n_enabled = false, updated_at = NOW() WHERE id = $1`,
      [userId]
    );
  }

  /** Get n8n instance status */
  static async get(userId: string): Promise<any | null> {
    const result = await pool.query(`SELECT * FROM n8n_instances WHERE user_id = $1`, [userId]);
    return result.rows[0] || null;
  }

  /** Bill hourly usage — DISABLED: n8n runs free, no hourly fee is charged. */
  static async billHourly(userId: string): Promise<{ billed: boolean; cost: number }> {
    void userId;
    return { billed: false, cost: 0 };
  }

  /** Inject a workflow template into user's n8n instance */
  static async injectWorkflow(userId: string, templateId: string): Promise<any> {
    const tpl = await pool.query(`SELECT * FROM workflow_templates WHERE id = $1`, [templateId]);
    if (tpl.rows.length === 0) throw new Error("Template not found");

    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [userId]);
    const sandboxId = user.rows[0]?.sandbox_id;
    if (!sandboxId) throw new Error("No sandbox available");

    const instance = await this.get(userId);
    if (!instance || instance.status !== 'running') {
      throw new Error("n8n is not running. Start it first.");
    }

    const workflow = tpl.rows[0].n8n_workflow;
    const workflowJson = JSON.stringify(workflow);

    // Save workflow to sandbox and import via n8n CLI or API
    await SandboxService.execCommand(sandboxId, `cat > /workspace/.n8n/import.json << 'EOF'
${workflowJson}
EOF`);

    // Try to import via n8n API
    try {
      const res = await SandboxService.execCommand(sandboxId, `
        curl -s -X POST http://localhost:${instance.port}/rest/workflows \
          -H "Content-Type: application/json" \
          -d @/workspace/.n8n/import.json
      `);
      return { imported: true, template: tpl.rows[0].name, response: res.stdout };
    } catch (e: any) {
      return { imported: false, error: e.message };
    }
  }

  /** Execute a workflow via n8n API */
  static async executeWorkflow(userId: string, workflowId: string, data?: any): Promise<any> {
    const instance = await this.get(userId);
    if (!instance?.tunnel_url) throw new Error("n8n not running");

    const url = `${instance.tunnel_url}/rest/workflows/${workflowId}/execute`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data || {}),
    });

    if (!res.ok) throw new Error(`n8n execution failed: ${res.status}`);
    return res.json();
  }

  /** List workflows from n8n */
  static async listWorkflows(userId: string): Promise<any[]> {
    const instance = await this.get(userId);
    if (!instance?.tunnel_url) return [];

    try {
      const res = await fetch(`${instance.tunnel_url}/rest/workflows`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.data || [];
    } catch { return []; }
  }

  private static async ensureTunnel(sandboxId: string, target: string): Promise<string | null> {
    try {
      const res = await SandboxService.execCommand(sandboxId, `
set -e
if ! command -v cloudflared >/dev/null 2>&1; then
  curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
  chmod +x /usr/local/bin/cloudflared
fi
pkill -f '^cloudflared' 2>/dev/null || true
sleep 1
rm -f /tmp/tunnel.log
nohup cloudflared tunnel --url ${target} > /tmp/tunnel.log 2>&1 &
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  grep -qE "https://[a-z0-9-]+\\.trycloudflare\\.com" /tmp/tunnel.log 2>/dev/null && break
  sleep 2
done
grep -oE "https://[a-z0-9-]+\\.trycloudflare\\.com" /tmp/tunnel.log | tail -n 1`, "/workspace");
      const url = (res.stdout || "").trim();
      if (!url || !url.includes("trycloudflare.com")) return null;
      return url;
    } catch (err) {
      console.error("Tunnel setup failed:", err);
      return null;
    }
  }
}
