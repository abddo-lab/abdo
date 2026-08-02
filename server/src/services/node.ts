// server/src/services/node.ts — Remote compute node registry + WS RPC dispatch.
// Nodes are servers with NO public IPv4/IPv6. Their agent opens an outbound
// WebSocket to this hub and we route commands over that connection (SSH/VNC/n8n
// are exposed via the node's own tunnels, never by inbound connections).
import { randomBytes } from "crypto";
import { v4 as uuid } from "uuid";
import pool from "../db.js";

interface NodeSocket {
  nodeId: string;
  ws: any;
  pending: Map<string, { resolve: (v: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>;
}

export class NodeService {
  /** Admin node hub — WS connections keyed by nodeId */
  private static sockets = new Map<string, NodeSocket>();
  private static callSeq = 0;

  // ── registry ──────────────────────────────────────────────────
  static async list(): Promise<any[]> {
    const r = await pool.query(
      `SELECT * FROM nodes ORDER BY last_seen_at DESC NULLS LAST, created_at DESC`
    );
    return r.rows.map((n) => ({ ...n, online: this.isOnline(n) }));
  }

  static async get(nodeId: string): Promise<any | null> {
    const r = await pool.query(`SELECT * FROM nodes WHERE id = $1`, [nodeId]);
    return r.rows[0] || null;
  }

  static async getByToken(token: string): Promise<any | null> {
    const r = await pool.query(`SELECT * FROM nodes WHERE token = $1`, [token]);
    return r.rows[0] || null;
  }

  static async create(input: { name: string; region?: string; role?: string; storage_gb?: number }): Promise<any> {
    const id = uuid();
    const token = this.genSecret();
    const secret = this.genSecret();
    await pool.query(
      `INSERT INTO nodes (id, name, token, secret, region, role, storage_gb)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, input.name, token, secret, input.region || "remote", input.role || "worker", input.storage_gb || 100]
    );
    return { id, name: input.name, token, secret };
  }

  static async delete(nodeId: string): Promise<void> {
    const sock = this.sockets.get(nodeId);
    sock?.ws.close(1000, "deleted");
    await pool.query(`DELETE FROM node_sandboxes WHERE node_id = $1`, [nodeId]);
    await pool.query(`DELETE FROM nodes WHERE id = $1`, [nodeId]);
  }

  static async updateConfig(nodeId: string, patch: Record<string, any>): Promise<void> {
    const node = await this.get(nodeId);
    const config = { ...(node?.config || {}), ...patch };
    await pool.query(`UPDATE nodes SET config = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(config), nodeId]);
  }

  static isOnline(node: any): boolean {
    if (!node?.last_seen_at) return false;
    return Date.now() - new Date(node.last_seen_at).getTime() < 45000;
  }

  private static genSecret(): string {
    return randomBytes(24).toString("base64url");
  }

  // ── heartbeat ─────────────────────────────────────────────────
  static async recordHeartbeat(nodeId: string, stats: any): Promise<void> {
    const node = await this.get(nodeId);
    const history = (node?.history || []).slice(-119);
    const point = {
      t: Date.now(),
      cpu: stats.cpu ?? null,
      mem: stats.mem ?? null,
      disk: stats.disk ?? null,
      load: stats.load ?? null,
    };
    history.push(point);
    await pool.query(
      `UPDATE nodes SET status = 'online', last_seen_at = NOW(),
         connected_at = COALESCE(connected_at, NOW()),
         cpu_cores = COALESCE($2, cpu_cores),
         memory_gb = COALESCE($3, memory_gb),
         disk_gb = COALESCE($4, disk_gb),
         version = COALESCE($5, version),
         capabilities = COALESCE($6, capabilities),
         stats = $7, history = $8, updated_at = NOW()
       WHERE id = $1`,
      [nodeId, stats.cpu_cores, stats.memory_gb, stats.disk_gb, stats.version, stats.capabilities, JSON.stringify(point), JSON.stringify(history)]
    );
  }

  // ── connection hub (called from index.ts) ─────────────────────
  static handleSocket(ws: any, token: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const node = await this.getByToken(token);
      if (!node) {
        ws.close(1008, "Invalid node token");
        return reject(new Error("Invalid node token"));
      }
      const sock: NodeSocket = { nodeId: node.id, ws, pending: new Map() };
      // Close any previous connection for this node
      const old = this.sockets.get(node.id);
      old?.ws.close(1000, "replaced");

      ws.on("message", async (raw: Buffer) => {
        let msg: any;
        try { msg = JSON.parse(raw.toString()); } catch { return; }
        try {
          // Node heartbeat
          if (msg.type === "rpc" && msg.method === "agent:heartbeat") {
            await this.recordHeartbeat(node.id, msg.params?.stats || {});
            return;
          }
          // Response to a pending RPC call
          if (msg.type === "rpc:reply") {
            const p = sock.pending.get(msg.id);
            if (p) {
              clearTimeout(p.timer);
              sock.pending.delete(msg.id);
              msg.error ? p.reject(new Error(msg.error)) : p.resolve(msg.result);
            }
            return;
          }
          // Node → server notifications (tunnel ready, container events)
          if (msg.type === "node:event") {
            this.onNodeEvent(node.id, msg.event).catch(() => {});
          }
        } catch (e) {
          console.error(`[node:${node.id}] message handler error:`, (e as Error).message);
        }
      });

      ws.on("close", async (code, reason) => {
        console.log(`[node:${node.id}] ws closed (${code}${reason ? " " + reason : ""})`);
        this.sockets.delete(node.id);
        try {
          await pool.query(`UPDATE nodes SET status = 'offline', updated_at = NOW() WHERE id = $1`, [node.id]);
        } catch (e) { console.error(`[node:${node.id}] close db error:`, e.message); }
      });
      ws.on("error", (e) => {
        console.error(`[node:${node.id}] socket error:`, e.message);
        ws.close();
      });

      this.sockets.set(node.id, sock);
      ws.send(JSON.stringify({ type: "node:hello", nodeId: node.id }));
      resolve(node.id);
    });
  }

  static isConnected(nodeId: string): boolean {
    return this.sockets.has(nodeId);
  }

  // ── RPC: dispatch a command to a node and await the result ────
  static async call<T = any>(nodeId: string, method: string, params: any = {}, timeoutMs = 600000): Promise<T> {
    const sock = this.sockets.get(nodeId);
    if (!sock) throw new Error(`Node ${nodeId} is offline`);
    const id = `${Date.now()}-${this.callSeq++}`;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        sock.pending.delete(id);
        reject(new Error(`Node RPC timeout (${method})`));
      }, timeoutMs);
      sock.pending.set(id, { resolve, reject, timer });
      try {
        sock.ws.send(JSON.stringify({ type: "rpc", id, method, params }));
      } catch (e: any) {
        clearTimeout(timer);
        sock.pending.delete(id);
        reject(e);
      }
    });
  }

  // ── convenience RPC wrappers ──────────────────────────────────
  static exec(nodeId: string, command: string, cwd?: string): Promise<any> {
    return this.call(nodeId, "exec", { command, cwd }, 600000);
  }

  static execDetached(nodeId: string, command: string): Promise<any> {
    return this.call(nodeId, "exec_detached", { command }, 30000);
  }

  static runN8n(nodeId: string, params: { name: string; port: number }): Promise<any> {
    return this.call(nodeId, "n8n:deploy", params, 900000);
  }

  static runSandbox(nodeId: string, params: any): Promise<any> {
    return this.call(nodeId, "sandbox:create", params, 300000);
  }

  static sandboxExec(nodeId: string, sandboxId: string, command: string, cwd?: string): Promise<any> {
    return this.call(nodeId, "sandbox:exec", { sandbox_id: sandboxId, command, cwd }, 600000);
  }

  static sandboxExecDetached(nodeId: string, sandboxId: string, command: string): Promise<any> {
    return this.call(nodeId, "sandbox:exec_detached", { sandbox_id: sandboxId, command }, 30000);
  }

  static sandboxStart(nodeId: string, sandboxId: string): Promise<any> {
    return this.call(nodeId, "sandbox:start", { sandbox_id: sandboxId }, 120000);
  }

  static sandboxStop(nodeId: string, sandboxId: string): Promise<any> {
    return this.call(nodeId, "sandbox:stop", { sandbox_id: sandboxId }, 120000);
  }

  static sandboxDelete(nodeId: string, sandboxId: string): Promise<any> {
    return this.call(nodeId, "sandbox:delete", { sandbox_id: sandboxId }, 120000);
  }

  static sandboxStats(nodeId: string, sandboxId: string): Promise<any> {
    return this.call(nodeId, "sandbox:stats", { sandbox_id: sandboxId }, 30000);
  }

  static openTunnel(nodeId: string, params: { target: string; name: string }): Promise<any> {
    return this.call(nodeId, "tunnel:open", params, 300000);
  }

  // ── node→server event handling ────────────────────────────────
  private static async onNodeEvent(nodeId: string, event: any): Promise<void> {
    if (event?.type === "sandbox:ready") {
      await pool.query(
        `UPDATE node_sandboxes SET status = 'running', updated_at = NOW()
         WHERE node_id = $1 AND container_id = $2`,
        [nodeId, event.container_id]
      );
    }
  }

  // ── node sandbox bookkeeping ──────────────────────────────────
  static async ensureNodeSandbox(userId: string, nodeId: string, label: string): Promise<any> {
    const existing = await pool.query(
      `SELECT * FROM node_sandboxes WHERE user_id = $1 AND label = $2 AND node_id = $3 LIMIT 1`,
      [userId, label, nodeId]
    );
    if (existing.rows[0]) {
      if (existing.rows[0].status === "running") return existing.rows[0];
      await this.deleteNodeSandbox(existing.rows[0].id);
    }
    const id = uuid();
    await pool.query(
      `INSERT INTO node_sandboxes (id, user_id, node_id, label, status)
       VALUES ($1, $2, $3, $4, 'provisioning')`,
      [id, userId, nodeId, label]
    );
    return { id, user_id: userId, node_id: nodeId, label, status: "provisioning" };
  }

  static async getNodeSandbox(sandboxId: string): Promise<any | null> {
    const r = await pool.query(`SELECT * FROM node_sandboxes WHERE id = $1`, [sandboxId]);
    return r.rows[0] || null;
  }

  static async deleteNodeSandbox(sandboxId: string): Promise<void> {
    const sb = await this.getNodeSandbox(sandboxId);
    if (sb?.node_id && sb?.container_id) {
      this.sandboxDelete(sb.node_id, sb.container_id).catch(() => {});
    }
    await pool.query(`DELETE FROM node_sandboxes WHERE id = $1`, [sandboxId]);
  }

  /** Pick the best online node, or null if none */
  static async pickNode(region?: string): Promise<any | null> {
    const nodes = await this.list();
    const online = nodes.filter((n) => n.online && n.status === "online");
    if (online.length === 0) return null;
    if (region) {
      const match = online.find((n) => (n.region || "").toLowerCase() === region.toLowerCase());
      if (match) return match;
    }
    // Prefer lowest recent CPU load
    return online.sort((a, b) => {
      const la = a.stats?.load ?? 99;
      const lb = b.stats?.load ?? 99;
      return la - lb;
    })[0];
  }
}
