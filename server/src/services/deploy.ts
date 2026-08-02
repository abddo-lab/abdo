// server/src/services/deploy.ts — Deploy previews via Cloudflare quick tunnel
import { SandboxService } from "./sandbox.js";
import { loadConfig } from "../config.js";
import pool from "../db.js";
import { v4 as uuid } from "uuid";

export class DeployService {
  /** Deploy a preview from a thread's sandbox */
  static async deploy(userId: string, projectId: string, threadId: string, port = 3000): Promise<any> {
    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [userId]);
    const sandboxId = user.rows[0]?.sandbox_id;
    if (!sandboxId) throw new Error("No sandbox available");

    const deployId = uuid();
    await pool.query(
      `INSERT INTO deployments (id, user_id, project_id, thread_id, sandbox_id, port, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'provisioning')`,
      [deployId, userId, projectId, threadId, sandboxId, port]
    );

    this.provision(deployId, sandboxId, port, userId).catch(console.error);
    return { id: deployId, status: "provisioning" };
  }

  private static async provision(deployId: string, sandboxId: string, port: number, userId: string): Promise<void> {
    try {
      // Install cloudflared if missing
      await SandboxService.execCommand(sandboxId,
        `which cloudflared || (curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared)`);

      // Start quick tunnel
      await SandboxService.execCommand(sandboxId,
        `nohup cloudflared tunnel --url http://localhost:${port} > /tmp/deploy-tunnel.log 2>&1 &`);

      await new Promise((r) => setTimeout(r, 6000));

      const logResult = await SandboxService.execCommand(sandboxId, `cat /tmp/deploy-tunnel.log`);
      const urlMatch = logResult.stdout.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      const tunnelUrl = urlMatch ? urlMatch[0] : "";

      await pool.query(
        `UPDATE deployments SET status = 'live', url = $1, updated_at = NOW() WHERE id = $2`,
        [tunnelUrl, deployId]
      );

      // Notify
      await pool.query(
        `INSERT INTO notifications (id, user_id, type, title, body, action_url) VALUES ($1, $2, 'deploy', 'Preview ready', $3, $4)`,
        [uuid(), userId, `Preview live at ${tunnelUrl}`, tunnelUrl]
      );
    } catch (err) {
      console.error("Deploy failed:", err);
      await pool.query(`UPDATE deployments SET status = 'error', updated_at = NOW() WHERE id = $1`, [deployId]);
    }
  }

  static async list(userId: string): Promise<any[]> {
    const result = await pool.query(
      `SELECT d.*, p.name as project_name FROM deployments d LEFT JOIN projects p ON d.project_id = p.id WHERE d.user_id = $1 ORDER BY d.created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  static async delete(deployId: string, userId: string): Promise<void> {
    const deploy = await pool.query(`SELECT * FROM deployments WHERE id = $1 AND user_id = $2`, [deployId, userId]);
    if (deploy.rows[0]?.sandbox_id) await SandboxService.execCommand(deploy.rows[0].sandbox_id, `pkill -f cloudflared`).catch(() => {});
    await pool.query(`DELETE FROM deployments WHERE id = $1`, [deployId]);
  }

  static async getPreviewUrl(threadId: string): Promise<string | null> {
    const result = await pool.query(`SELECT url FROM deployments WHERE thread_id = $1 AND status = 'live' ORDER BY created_at DESC LIMIT 1`, [threadId]);
    return result.rows[0]?.url || null;
  }
}
