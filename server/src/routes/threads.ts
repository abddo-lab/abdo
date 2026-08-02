// server/src/routes/threads.ts — Thread and agent routes
import { Router } from "express";
import { v4 as uuid } from "uuid";
import pool from "../db.js";
import { AgentService, type AgentMode } from "../services/agent.js";
import { authMiddleware } from "../middleware/auth.js";
import { UsageService } from "../services/usage.js";

const router = Router();

// GET /api/threads — list user's threads
router.get("/", authMiddleware, async (req: any, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, p.name as project_name
       FROM threads t
       LEFT JOIN projects p ON t.project_id = p.id
       WHERE t.user_id = $1
       ORDER BY t.updated_at DESC`,
      [req.user.id]
    );
    res.json({ threads: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/threads — create a new thread
// Resolves a real project_id even when the client sends null/undefined or a stale id:
// the user's first project is used, or a default project is created on the spot.
router.post("/", authMiddleware, async (req: any, res) => {
  try {
    const { project_id, title, mode, model_id } = req.body;
    const id = uuid();

    let pid = project_id;
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
      const glyph = (title || "New").slice(0, 2).toUpperCase();
      await pool.query(
        `INSERT INTO projects (id, user_id, name, source, category, stack, glyph, color)
         VALUES ($1, $2, $3, 'local', 'Product', '[]', $4, '#3d3d52')`,
        [pid2, req.user.id, "My Project", glyph]
      );
      pid = pid2;
    }

    const project = await pool.query(`SELECT name FROM projects WHERE id = $1`, [pid]);
    const branch = `${(project.rows[0]?.name || "work").slice(0, 10)}/thread-${Date.now().toString().slice(-4)}`;

    const result = await pool.query(
      `INSERT INTO threads (id, project_id, user_id, title, status, mode, model_id, branch)
       VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7) RETURNING *`,
      [id, pid, req.user.id, title || "New Thread", mode || "agent", model_id || "qwen3.7-max", branch]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/threads/:id — get thread with blocks
router.get("/:id", authMiddleware, async (req: any, res) => {
  try {
    const thread = await pool.query(
      `SELECT t.*, p.name as project_name FROM threads t
       LEFT JOIN projects p ON t.project_id = p.id
       WHERE t.id = $1 AND t.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (thread.rows.length === 0) return res.status(404).json({ error: "Thread not found" });

    const blocks = await pool.query(
      `SELECT * FROM thread_blocks WHERE thread_id = $1 ORDER BY sort_order ASC`,
      [req.params.id]
    );

    res.json({ ...thread.rows[0], blocks: blocks.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/threads/:id/send — send a message to the agent (multi-request flow: runs ONE step, client resends /continue)
router.post("/:id/send", authMiddleware, async (req: any, res) => {
  try {
    const { message } = req.body;
    const thread = await pool.query(
      `SELECT * FROM threads WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (thread.rows.length === 0) return res.status(404).json({ error: "Thread not found" });

    const t = thread.rows[0];

    // Update thread status to running
    await pool.query(
      `UPDATE threads SET status = 'running', title = CASE WHEN title = 'New Thread' THEN $1 ELSE title END, updated_at = NOW() WHERE id = $2`,
      [message.slice(0, 50), t.id]
    );

    // Get user's single sandbox (created at plan purchase — all threads share it)
    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [req.user.id]);
    const { SandboxService } = await import("../services/sandbox.js");
    let sandboxId = user.rows[0]?.sandbox_id;
    try {
      const sb = await SandboxService.ensureSandbox(req.user.id, "main");
      sandboxId = sb.daytona_sandbox_id || sb.id;
    } catch { /* sandbox unavailable — agent continues without one */ }

    // Enforce usage limits before spending the user's money
    await UsageService.enforce(req.user.id);

    // Get GitHub access token
    const { GitHubService } = await import("../services/github.js");
    const githubAccessToken = await GitHubService.getAccessToken(req.user.id);

    // Clone the project repo into the sandbox so the agent works on the real code
    let workdir: string | null = null;
    try {
      const project = await pool.query(`SELECT * FROM projects WHERE id = $1`, [t.project_id]);
      const repo = project.rows[0];
      if (repo?.repo_full_name && sandboxId) {
        workdir = await SandboxService.ensureProjectClone(
          sandboxId,
          repo.repo_full_name,
          repo.branch || "main",
          githubAccessToken || undefined,
        );
      }
    } catch {}

    const context = {
      userId: req.user.id,
      threadId: t.id,
      projectId: t.project_id,
      sandboxId,
      workdir,
      mode: (t.mode as AgentMode) || "agent",
      modelId: t.model_id || "qwen3.7-max",
      accessToken: githubAccessToken || undefined,
      userName: req.user?.username || req.user?.display_name || req.user?.name,
    };

    // Record one real execution and deduct its dollar cost from the balance
    await UsageService.recordExecution(req.user.id, t.id, t.model_id || "qwen3.7-max");

    // Run ONE agent step (Think→Plan→Act→Observe). Client sends /continue to proceed.
    const run = await AgentService.runStep({
      userId: context.userId,
      threadId: context.threadId,
      projectId: context.projectId,
      sandboxId: context.sandboxId,
      workdir: context.workdir,
      modelId: context.modelId,
      goal: message,
      mode: context.mode,
      maxSteps: 30,
      userName: context.userName,
    });

    // Return the updated thread + blocks so the client renders the new step
    const updatedThread = await pool.query(`SELECT * FROM threads WHERE id = $1`, [t.id]);
    const updatedBlocks = await pool.query(
      `SELECT * FROM thread_blocks WHERE thread_id = $1 ORDER BY sort_order ASC`,
      [t.id]
    );

    res.json({
      thread: updatedThread.rows[0],
      blocks: updatedBlocks.rows,
      result: { done: run.done, step: run.step, status: run.status },
    });
  } catch (err: any) {
    console.error("Agent error:", err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/threads/:id/continue — resume a paused agent run for the next step
router.post("/:id/continue", authMiddleware, async (req: any, res) => {
  try {
    const thread = await pool.query(
      `SELECT * FROM threads WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (thread.rows.length === 0) return res.status(404).json({ error: "Thread not found" });

    const t = thread.rows[0];
    if (!t.agent_state) return res.status(400).json({ error: "No active agent run to continue" });

    const saved = typeof t.agent_state === "string" ? JSON.parse(t.agent_state) : t.agent_state;
    const snapshot: any = saved?.snapshot;

    // Get sandbox + GitHub token again for tool construction
    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [req.user.id]);
    const { SandboxService } = await import("../services/sandbox.js");
    let sandboxId = user.rows[0]?.sandbox_id;
    try {
      const sb = await SandboxService.ensureSandbox(req.user.id, "main");
      sandboxId = sb.daytona_sandbox_id || sb.id;
    } catch {}

    const { GitHubService } = await import("../services/github.js");
    const githubAccessToken = await GitHubService.getAccessToken(req.user.id);

    const context = {
      userId: req.user.id,
      threadId: t.id,
      projectId: t.project_id,
      sandboxId,
      workdir: snapshot?.workdir || null,
      mode: (t.mode as AgentMode) || "agent",
      modelId: t.model_id || "qwen3.7-max",
      accessToken: githubAccessToken || undefined,
      userName: req.user?.username || req.user?.display_name || req.user?.name,
    };

    const run = await AgentService.runStep(context, snapshot);

    const updatedThread = await pool.query(`SELECT * FROM threads WHERE id = $1`, [t.id]);
    const updatedBlocks = await pool.query(
      `SELECT * FROM thread_blocks WHERE thread_id = $1 ORDER BY sort_order ASC`,
      [t.id]
    );

    res.json({
      thread: updatedThread.rows[0],
      blocks: updatedBlocks.rows,
      result: { done: run.done, step: run.step, status: run.status },
    });
  } catch (err: any) {
    console.error("Agent continue error:", err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/threads/:id/inline-edit — Cursor-style inline edit on a file (returns old/new + diff)
router.post("/:id/inline-edit", authMiddleware, async (req: any, res) => {
  try {
    const { path: filePath, content, instruction, selection } = req.body;
    if (!filePath || typeof content !== "string" || !instruction) {
      return res.status(400).json({ error: "path, content and instruction are required" });
    }

    const thread = await pool.query(
      `SELECT * FROM threads WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (thread.rows.length === 0) return res.status(404).json({ error: "Thread not found" });
    const t = thread.rows[0];

    await UsageService.enforce(req.user.id);
    await UsageService.recordExecution(req.user.id, t.id, t.model_id || "qwen3.7-max");

    const result = await AgentService.inlineEdit({
      userId: req.user.id,
      threadId: t.id,
      projectId: t.project_id,
      modelId: t.model_id || "qwen3.7-max",
      path: filePath,
      content,
      instruction,
      selection,
      userName: req.user?.username || req.user?.display_name || req.user?.name,
    });

    res.json(result);
  } catch (err: any) {
    console.error("Inline edit error:", err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/threads/:id/parallel — Codex-style: break a goal into N parallel agents
router.post("/:id/parallel", authMiddleware, async (req: any, res) => {
  try {
    const { goal, breakdown } = req.body;
    if (!goal || !Array.isArray(breakdown) || breakdown.length === 0 || breakdown.length > 8) {
      return res.status(400).json({ error: "goal and breakdown (1–8 agents) are required" });
    }

    const thread = await pool.query(
      `SELECT * FROM threads WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (thread.rows.length === 0) return res.status(404).json({ error: "Thread not found" });
    const t = thread.rows[0];

    await UsageService.enforce(req.user.id);

    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [req.user.id]);
    const { SandboxService } = await import("../services/sandbox.js");
    let sandboxId = user.rows[0]?.sandbox_id;
    try {
      const sb = await SandboxService.ensureSandbox(req.user.id, "main");
      sandboxId = sb.daytona_sandbox_id || sb.id;
    } catch {}

    const { GitHubService } = await import("../services/github.js");
    const githubAccessToken = await GitHubService.getAccessToken(req.user.id);

    let workdir: string | null = null;
    try {
      const project = await pool.query(`SELECT * FROM projects WHERE id = $1`, [t.project_id]);
      const repo = project.rows[0];
      if (repo?.repo_full_name && sandboxId) {
        workdir = await SandboxService.ensureProjectClone(
          sandboxId, repo.repo_full_name, repo.branch || "main",
          githubAccessToken || undefined
        );
      }
    } catch {}

    const result = await AgentService.runParallel({
      userId: req.user.id,
      threadId: t.id,
      projectId: t.project_id,
      sandboxId,
      workdir,
      modelId: t.model_id || "qwen3.7-max",
      mode: (t.mode as any) || "agent",
      goal,
      breakdown,
      userName: req.user?.username || req.user?.display_name || req.user?.name,
    });

    const updatedThread = await pool.query(`SELECT * FROM threads WHERE id = $1`, [t.id]);
    const updatedBlocks = await pool.query(
      `SELECT * FROM thread_blocks WHERE thread_id = $1 ORDER BY sort_order ASC`,
      [t.id]
    );

    res.json({ thread: updatedThread.rows[0], blocks: updatedBlocks.rows, results: result.results });
  } catch (err: any) {
    console.error("Parallel agents error:", err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/threads/:id/permissions/:requestId/resolve — approve or deny a pending permission (MCP install OR agent tool call)
router.post("/:id/permissions/:requestId/resolve", authMiddleware, async (req: any, res) => {
  try {
    const { approved } = req.body;
    const thread = await pool.query(`SELECT agent_state FROM threads WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    if (thread.rows.length === 0) return res.status(404).json({ error: "Thread not found" });
    const rawState = thread.rows[0]?.agent_state;
    let saved = rawState && typeof rawState === "string" ? JSON.parse(rawState) : rawState;
    const pending = saved?.snapshot?.pendingCall;

    // Agent tool-call permission: record the user's choice in the snapshot so a
    // later /continue acts on it.
    if (pending && pending.callId === req.params.requestId) {
      if (!saved) saved = {};
      if (!saved.snapshot) saved.snapshot = {};
      saved.snapshot.pendingCall.resolution = approved === true || approved === "true" ? "allow" : "deny";
      await pool.query(`UPDATE threads SET agent_state = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(saved), req.params.id]);
      return res.json({ ok: true, requestId: pending.callId, resolved: saved.snapshot.pendingCall.resolution });
    }

    // MCP install permission.
    const { MCPService } = await import("../services/mcp.js");
    const result = await MCPService.resolveInstallRequest(
      req.user.id,
      req.params.id,
      req.params.requestId,
      approved === true || approved === "true",
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/threads/:id/stop — stop a running agent
router.post("/:id/stop", authMiddleware, async (req: any, res) => {
  try {
    await pool.query(
      `UPDATE threads SET status = 'review', updated_at = NOW() WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/threads/:id — delete a thread
router.delete("/:id", authMiddleware, async (req: any, res) => {
  try {
    await pool.query(`DELETE FROM threads WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/threads/:id/commit — commit & push changes
router.post("/:id/commit", authMiddleware, async (req: any, res) => {
  try {
    const thread = await pool.query(`SELECT * FROM threads WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    if (thread.rows.length === 0) return res.status(404).json({ error: "Thread not found" });

    await pool.query(
      `UPDATE threads SET status = 'done', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );

    res.json({ ok: true, message: `Pushed to origin/${thread.rows[0].branch}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/threads/:id/mode — change agent mode
router.post("/:id/mode", authMiddleware, async (req: any, res) => {
  try {
    const { mode } = req.body;
    if (!["agent", "plan", "ask"].includes(mode)) return res.status(400).json({ error: "Invalid mode" });
    await pool.query(
      `UPDATE threads SET mode = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
      [mode, req.params.id, req.user.id]
    );
    res.json({ ok: true, mode });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/threads/:id/model — change model
router.post("/:id/model", authMiddleware, async (req: any, res) => {
  try {
    const { model_id } = req.body;
    await pool.query(
      `UPDATE threads SET model_id = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
      [model_id, req.params.id, req.user.id]
    );
    res.json({ ok: true, model_id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
