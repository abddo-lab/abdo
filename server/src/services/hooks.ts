// server/src/services/hooks.ts — Pre/post tool execution hooks
import { SandboxService } from "./sandbox.js";
import pool from "../db.js";
import { v4 as uuid } from "uuid";

export interface Hook {
  id: string;
  user_id: string;
  event: "pre_tool" | "post_tool" | "pre_commit" | "post_commit" | "on_error" | "on_test_fail";
  matcher: string;        // tool name pattern or "*" for all
  command: string;        // shell command to run
  description: string;
  enabled: boolean;
  timeout_ms: number;
  created_at: string;
}

export interface HookResult {
  hook: Hook;
  success: boolean;
  output: string;
  duration_ms: number;
  blocked: boolean;       // if true, the original action is blocked
}

export class HooksService {
  /** Create a hook */
  static async create(userId: string, data: Partial<Hook>): Promise<Hook> {
    const id = uuid();
    const result = await pool.query(
      `INSERT INTO agent_hooks (id, user_id, event, matcher, command, description, enabled, timeout_ms)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7) RETURNING *`,
      [id, userId, data.event, data.matcher || "*", data.command, data.description || "", data.timeout_ms || 5000]
    );
    return result.rows[0];
  }

  /** List user's hooks */
  static async list(userId: string): Promise<Hook[]> {
    const result = await pool.query(
      `SELECT * FROM agent_hooks WHERE user_id = $1 ORDER BY event, created_at`,
      [userId]
    );
    return result.rows;
  }

  /** Update a hook */
  static async update(hookId: string, userId: string, data: Partial<Hook>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.event !== undefined) { fields.push(`event = $${idx++}`); values.push(data.event); }
    if (data.matcher !== undefined) { fields.push(`matcher = $${idx++}`); values.push(data.matcher); }
    if (data.command !== undefined) { fields.push(`command = $${idx++}`); values.push(data.command); }
    if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description); }
    if (data.enabled !== undefined) { fields.push(`enabled = $${idx++}`); values.push(data.enabled); }
    if (data.timeout_ms !== undefined) { fields.push(`timeout_ms = $${idx++}`); values.push(data.timeout_ms); }

    if (fields.length === 0) return;
    fields.push(`updated_at = NOW()`);
    values.push(hookId, userId);

    await pool.query(`UPDATE agent_hooks SET ${fields.join(", ")} WHERE id = $${idx++} AND user_id = $${idx}`, values);
  }

  /** Delete a hook */
  static async delete(hookId: string, userId: string): Promise<void> {
    await pool.query(`DELETE FROM agent_hooks WHERE id = $1 AND user_id = $2`, [hookId, userId]);
  }

  /** Execute hooks for an event */
  static async execute(userId: string, event: Hook["event"], context: { tool?: string; sandboxId?: string; args?: any }): Promise<HookResult[]> {
    const hooks = await this.list(userId);
    const matching = hooks.filter((h) => h.enabled && h.event === event && (h.matcher === "*" || h.matcher === context.tool));

    const results: HookResult[] = [];

    for (const hook of matching) {
      if (!context.sandboxId) {
        results.push({ hook, success: false, output: "No sandbox", duration_ms: 0, blocked: false });
        continue;
      }

      const startTime = Date.now();
      try {
        // Set environment variables for the hook
        const envVars = [
          `KIREN_TOOL=${context.tool || ""}`,
          `KIREN_EVENT=${event}`,
          `KIREN_ARGS='${JSON.stringify(context.args || {})}'`,
        ].join(" ");

        const result = await SandboxService.execCommand(
          context.sandboxId,
          `${envVars} ${hook.command}`
        );

        const duration = Date.now() - startTime;
        const success = result.exit === 0;
        const blocked = result.stdout.includes("KIREN_BLOCK") || result.exit === 2;

        results.push({ hook, success, output: result.stdout, duration_ms: duration, blocked });

        // If hook returned exit code 2, block the action
        if (blocked && event === "pre_tool") {
          break; // Stop executing further hooks
        }
      } catch (err: any) {
        results.push({ hook, success: false, output: err.message, duration_ms: Date.now() - startTime, blocked: false });
      }
    }

    return results;
  }

  /** Seed default hooks */
  static async seedDefaults(userId: string): Promise<void> {
    const defaults: Partial<Hook>[] = [
      {
        event: "pre_tool",
        matcher: "bash",
        command: 'echo "$KIREN_ARGS" | grep -q "rm -rf /" && echo "KIREN_BLOCK: Dangerous command blocked" && exit 2 || exit 0',
        description: "Block dangerous rm -rf commands",
        timeout_ms: 1000,
      },
      {
        event: "post_tool",
        matcher: "edit",
        command: "npx prettier --write $KIREN_FILE 2>/dev/null || true",
        description: "Auto-format files after editing",
        timeout_ms: 10000,
      },
      {
        event: "post_commit",
        matcher: "*",
        command: "git status --short",
        description: "Show status after commit",
        timeout_ms: 5000,
      },
      {
        event: "on_test_fail",
        matcher: "*",
        command: "echo 'Tests failed — review the output above'",
        description: "Notify on test failure",
        timeout_ms: 1000,
      },
    ];

    for (const hook of defaults) {
      await this.create(userId, hook);
    }
  }
}
