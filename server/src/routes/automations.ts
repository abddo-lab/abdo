// server/src/routes/automations.ts — Automation routes
import { Router } from "express";
import { v4 as uuid } from "uuid";
import pool from "../db.js";
import { AgentService } from "../services/agent.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// GET /api/automations — list user's automations
router.get("/", authMiddleware, async (req: any, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, p.name as project_name
       FROM automations a
       LEFT JOIN projects p ON a.project_id = p.id
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC`,
      [req.user.id]
    );
    res.json({ automations: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/automations — create a new automation
router.post("/", authMiddleware, async (req: any, res) => {
  try {
    const { name, goal, trigger_config, project_id, prompt, model_id } = req.body;
    const id = uuid();

    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [req.user.id]);

    // "none" is sent by the UI when no project was picked — store NULL (optional FK)
    const projectRef = project_id && project_id !== "none" ? project_id : null;

    const result = await pool.query(
      `INSERT INTO automations (id, user_id, project_id, name, goal, trigger_config, prompt, model_id, sandbox_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [id, req.user.id, projectRef, name, goal, trigger_config, prompt, model_id, user.rows[0]?.sandbox_id]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/automations/:id/run — run an automation
router.post("/:id/run", authMiddleware, async (req: any, res) => {
  try {
    const automation = await pool.query(
      `SELECT * FROM automations WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (automation.rows.length === 0) return res.status(404).json({ error: "Automation not found" });

    const a = automation.rows[0];

    // Update status to running
    await pool.query(
      `UPDATE automations SET status = 'running', runs = runs + 1, last_run_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [a.id]
    );

    // Resolve a real project — automations may have been created with project_id = NULL
    let pid = a.project_id;
    if (pid) {
      const owned = await pool.query(`SELECT id FROM projects WHERE id = $1 AND user_id = $2`, [pid, req.user.id]);
      if (owned.rows.length === 0) pid = null;
    }
    if (!pid) {
      const first = await pool.query(`SELECT id FROM projects WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`, [req.user.id]);
      pid = first.rows[0]?.id ?? null;
    }
    if (!pid) {
      const pid2 = `prj-${uuid().slice(0, 8)}`;
      await pool.query(
        `INSERT INTO projects (id, user_id, name, source, category, stack, glyph, color)
         VALUES ($1, $2, 'My Project', 'local', 'Product', '[]', 'MY', '#3d3d52')`,
        [pid2, req.user.id]
      );
      pid = pid2;
    }

    // Create a thread for the automation run
    const threadId = uuid();
    await pool.query(
      `INSERT INTO threads (id, project_id, user_id, title, status, mode, model_id, branch)
       VALUES ($1, $2, $3, $4, 'running', 'agent', $5, $6)`,
      [threadId, pid, req.user.id, `Automation: ${a.name}`, a.model_id || "qwen3.7-max", `automation/${a.id.slice(0, 8)}`]
    );

    // Run in background (memory-first step loop, same engine as threads)
    const context = {
      userId: req.user.id,
      threadId,
      projectId: pid,
      sandboxId: a.sandbox_id,
      mode: "agent" as const,
      modelId: a.model_id || "qwen3.7-max",
      userName: req.user?.username || req.user?.display_name || req.user?.name,
    };

    (async () => {
      try {
        let run: any = await AgentService.runStep({
          ...context,
          goal: a.prompt,
          maxSteps: 40,
        });
        let guard = 0;
        while (!run.done && guard < 40) {
          run = await AgentService.runStep(context, run.loop.snapshot());
          guard++;
        }
      } catch (err) {
        console.error("Automation run failed:", err);
      } finally {
        await pool.query(`UPDATE automations SET status = 'idle', updated_at = NOW() WHERE id = $1`, [a.id]);
      }
    })();

    res.json({ ok: true, thread_id: threadId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/automations/:id — delete an automation
router.delete("/:id", authMiddleware, async (req: any, res) => {
  try {
    await pool.query(`DELETE FROM automations WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
