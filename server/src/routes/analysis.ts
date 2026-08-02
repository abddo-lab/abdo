// server/src/routes/analysis.ts — Code analysis routes
import { Router } from "express";
import { CodeAnalysisService } from "../services/code-analysis.js";
import { TestRunnerService } from "../services/test-runner.js";
import { GitService } from "../services/git.js";
import { authMiddleware } from "../middleware/auth.js";
import pool from "../db.js";

const router = Router();

// GET /api/analysis/project — analyze project health
router.get("/project", authMiddleware, async (req: any, res) => {
  try {
    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [req.user.id]);
    const sandboxId = user.rows[0]?.sandbox_id;
    if (!sandboxId) return res.status(400).json({ error: "No sandbox" });
    const health = await CodeAnalysisService.analyzeProject(sandboxId);
    res.json(health);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/analysis/file — analyze single file
router.get("/file", authMiddleware, async (req: any, res) => {
  try {
    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [req.user.id]);
    const sandboxId = user.rows[0]?.sandbox_id;
    if (!sandboxId) return res.status(400).json({ error: "No sandbox" });
    const analysis = await CodeAnalysisService.analyzeFile(sandboxId, req.query.path as string);
    res.json(analysis);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/analysis/dependencies — build dependency graph
router.get("/dependencies", authMiddleware, async (req: any, res) => {
  try {
    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [req.user.id]);
    const sandboxId = user.rows[0]?.sandbox_id;
    if (!sandboxId) return res.status(400).json({ error: "No sandbox" });
    const graph = await CodeAnalysisService.buildDependencyGraph(sandboxId);
    res.json(graph);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/analysis/test — run tests
router.post("/test", authMiddleware, async (req: any, res) => {
  try {
    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [req.user.id]);
    const sandboxId = user.rows[0]?.sandbox_id;
    if (!sandboxId) return res.status(400).json({ error: "No sandbox" });
    const result = await TestRunnerService.run(sandboxId, req.body.pattern);
    if (req.body.thread_id) await TestRunnerService.saveToThread(req.body.thread_id, result);
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/analysis/git/status — git status
router.get("/git/status", authMiddleware, async (req: any, res) => {
  try {
    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [req.user.id]);
    const sandboxId = user.rows[0]?.sandbox_id;
    if (!sandboxId) return res.status(400).json({ error: "No sandbox" });
    res.json(await GitService.status(sandboxId));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/analysis/git/log — git log
router.get("/git/log", authMiddleware, async (req: any, res) => {
  try {
    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [req.user.id]);
    const sandboxId = user.rows[0]?.sandbox_id;
    if (!sandboxId) return res.status(400).json({ error: "No sandbox" });
    res.json({ log: await GitService.log(sandboxId, parseInt(req.query.limit as string) || 20) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// GET /api/analysis/git/branches — list branches
router.get("/git/branches", authMiddleware, async (req: any, res) => {
  try {
    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [req.user.id]);
    const sandboxId = user.rows[0]?.sandbox_id;
    if (!sandboxId) return res.status(400).json({ error: "No sandbox" });
    res.json({ branches: await GitService.branches(sandboxId) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/analysis/git/commit — create commit
router.post("/git/commit", authMiddleware, async (req: any, res) => {
  try {
    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [req.user.id]);
    const sandboxId = user.rows[0]?.sandbox_id;
    if (!sandboxId) return res.status(400).json({ error: "No sandbox" });
    const result = await GitService.commit(sandboxId, req.body.message, req.body.files);
    res.json({ output: result });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
