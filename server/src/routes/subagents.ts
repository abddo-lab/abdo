// server/src/routes/subagents.ts — Subagent management routes
import { Router } from "express";
import { v4 as uuid } from "uuid";
import pool from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { seedSubagents } from "../services/seeds.js";

const router = Router();

// GET /api/subagents — list user's subagents (seeds the 6 ready ones on first call)
router.get("/", authMiddleware, async (req: any, res) => {
  try {
    await seedSubagents(req.user.id);
    const result = await pool.query(
      `SELECT * FROM subagents WHERE user_id = $1 ORDER BY created_at ASC`,
      [req.user.id]
    );
    res.json({ subagents: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/subagents — create a subagent
router.post("/", authMiddleware, async (req: any, res) => {
  try {
    const { name, description, icon, color, scope, tools, system_prompt } = req.body;
    const id = uuid();
    const result = await pool.query(
      `INSERT INTO subagents (id, user_id, name, description, icon, color, scope, tools, system_prompt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [id, req.user.id, name, description, icon || "agentBadge", color || "#1A1D28",
       scope || "workspace", JSON.stringify(tools || []), system_prompt]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/subagents/:id — update a subagent
router.put("/:id", authMiddleware, async (req: any, res) => {
  try {
    const { name, description, icon, color, scope, tools, system_prompt, enabled } = req.body;
    const result = await pool.query(
      `UPDATE subagents SET
         name = COALESCE($1, name), description = COALESCE($2, description),
         icon = COALESCE($3, icon), color = COALESCE($4, color),
         scope = COALESCE($5, scope), tools = COALESCE($6, tools),
         system_prompt = COALESCE($7, system_prompt), enabled = COALESCE($8, enabled),
         updated_at = NOW()
       WHERE id = $9 AND user_id = $10 RETURNING *`,
      [name, description, icon, color, scope, tools ? JSON.stringify(tools) : null,
       system_prompt, enabled, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/subagents/:id — delete a subagent
router.delete("/:id", authMiddleware, async (req: any, res) => {
  try {
    await pool.query(`DELETE FROM subagents WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
