// server/src/routes/sandboxes.ts — Sandbox management routes
import { Router } from "express";
import { SandboxService } from "../services/sandbox.js";
import { authMiddleware } from "../middleware/auth.js";
import pool from "../db.js";

const router = Router();

// POST /api/sandboxes — create a sandbox
router.post("/", authMiddleware, async (req: any, res) => {
  try {
    const { label } = req.body;
    const sandbox = await SandboxService.ensureSandbox(req.user.id, label || "main");
    res.json(sandbox);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sandboxes — list user's sandboxes (auto-starts a stopped one so the UI never shows "Provisioning" forever)
router.get("/", authMiddleware, async (req: any, res) => {
  try {
    const user = await pool.query(`SELECT sandbox_id, sandbox_status, sandbox_region FROM users WHERE id = $1`, [req.user.id]);
    const sandboxId = user.rows[0]?.sandbox_id;
    if (!sandboxId) return res.json({ sandboxes: [] });

    let sb = await SandboxService.getSandbox(sandboxId);
    if (sb && sb.status !== "running") {
      try { await SandboxService.startSandbox(sandboxId); } catch {}
      sb = await SandboxService.getSandbox(sandboxId);
    }
    res.json({ sandboxes: sb ? [sb] : [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sandboxes/:id/connect — real SSH credentials or noVNC desktop URL
router.post("/:id/connect", authMiddleware, async (req: any, res) => {
  try {
    const { kind } = req.body;
    if (kind !== "ssh" && kind !== "desktop") {
      return res.status(400).json({ error: "kind must be 'ssh' or 'desktop'" });
    }
    const info = await SandboxService.connect(req.user.id, req.params.id, kind);
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sandboxes/:id/exec — execute a command
router.post("/:id/exec", authMiddleware, async (req: any, res) => {
  try {
    const { command, cwd } = req.body;
    const result = await SandboxService.execCommand(req.params.id, command, cwd);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sandboxes/:id/start — start a sandbox
router.post("/:id/start", authMiddleware, async (req: any, res) => {
  try {
    await SandboxService.startSandbox(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sandboxes/:id/stop — stop a sandbox
router.post("/:id/stop", authMiddleware, async (req: any, res) => {
  try {
    await SandboxService.stopSandbox(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sandboxes/:id — delete a sandbox
router.delete("/:id", authMiddleware, async (req: any, res) => {
  try {
    await SandboxService.deleteSandbox(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
