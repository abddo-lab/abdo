// server/src/services/data-reset.ts — Full account reset (DB + containers)
import pool from "../db.js";
import { SandboxService } from "./sandbox.js";

export class DataResetService {
  /** Reset all data for a user: DB records, sandboxes, containers */
  static async resetAll(userId: string): Promise<{ deleted: string[] }> {
    const deleted: string[] = [];

    // 1. Get all sandboxes/containers to delete
    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [userId]);
    const sandboxId = user.rows[0]?.sandbox_id;

    // 2. Get workflow sandboxes
    const wfs = await pool.query(`SELECT sandbox_id FROM workflow_instances WHERE user_id = $1`, [userId]);
    const wfSandboxIds = wfs.rows.map((r) => r.sandbox_id).filter(Boolean);

    // 3. Delete all containers
    if (sandboxId) {
      try {
        await SandboxService.deleteSandbox(sandboxId);
        deleted.push(`main-sandbox:${sandboxId}`);
      } catch (e: any) {
        deleted.push(`main-sandbox:${sandboxId} (error: ${e.message})`);
      }
    }

    for (const wfId of wfSandboxIds) {
      try {
        await SandboxService.deleteSandbox(wfId);
        deleted.push(`workflow-sandbox:${wfId}`);
      } catch (e: any) {
        deleted.push(`workflow-sandbox:${wfId} (error: ${e.message})`);
      }
    }

    // 4. Delete all user data from DB (cascading deletes handle most)
    const tables = [
      "sessions", "projects", "threads", "thread_blocks", "subagents",
      "workflow_instances", "automations", "mcp_servers", "mcp_workflows",
      "usage", "deployments", "notifications", "agent_skills", "agent_hooks",
      "agent_templates", "user_addons", "smtp_configs", "n8n_instances", "addon_usage",
    ];

    for (const table of tables) {
      try {
        await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
        deleted.push(`db:${table}`);
      } catch (e: any) {
        deleted.push(`db:${table} (error: ${e.message})`);
      }
    }

    // 5. Reset user record but keep account
    await pool.query(
      `UPDATE users SET
        plan_id = 'free',
        plan_selected = false,
        plan_expires_at = NULL,
        balance = 0,
        sandbox_id = NULL,
        sandbox_status = 'none',
        sandbox_n8n_url = NULL,
        sandbox_n8n_enabled = false,
        sandbox_ssh_password = NULL,
        sandbox_vnc_password = NULL,
        sandbox_ssh_port = NULL,
        sandbox_vnc_port = NULL,
        updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );
    deleted.push("user:reset");

    return { deleted };
  }
}
