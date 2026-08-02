// server/src/routes/nodes.ts — Admin node registry + agent-facing endpoints
import { Router } from "express";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { adminMiddleware } from "../middleware/admin.js";
import { NodeService } from "../services/node.js";

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AGENT_JS = readFileSync(path.join(__dirname, "..", "..", "agent", "agent.js"), "utf8");
const INSTALL_SHELL = readFileSync(path.join(__dirname, "..", "..", "agent", "install.sh"), "utf8");

// ── Agent-facing (token auth, not session) ─────────────────────
const agentAuth = (req: any, res: any, next: any) => {
  const token = req.headers["x-node-token"] || req.query.token;
  if (!token) return res.status(401).json({ error: "Missing node token" });
  NodeService.getByToken(String(token))
    .then((node) => {
      if (!node) return res.status(401).json({ error: "Invalid node token" });
      req.node = node;
      next();
    })
    .catch((e) => res.status(500).json({ error: e.message }));
};

// GET /api/nodes/health — agent heartbeat + capability report
router.get("/health", agentAuth, async (req: any, res) => {
  try {
    const stats = req.query.stats ? JSON.parse(String(req.query.stats)) : {};
    await NodeService.recordHeartbeat(req.node.id, stats);
    res.json({ ok: true, node: req.node.id, server_time: Date.now() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin routes ────────────────────────────────────────────────

// GET /api/nodes — list all nodes with live status
router.get("/", adminMiddleware, async (_req: any, res) => {
  try {
    const nodes = await NodeService.list();
    res.json({ nodes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/nodes — register a new node; returns install one-liner
router.post("/", adminMiddleware, async (req: any, res) => {
  try {
    const { name, region, role, storage_gb } = req.body;
    const node = await NodeService.create({ name, region, role, storage_gb });
    const host = req.get("host");
    res.json({
      ...node,
      install: `curl -fsSL ${req.protocol}://${host}/api/nodes/install.sh | bash -s -- ws://${host}/ws/node ${node.token}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/nodes/:id — remove a node
router.delete("/:id", adminMiddleware, async (req: any, res) => {
  try {
    await NodeService.delete(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/nodes/:id/config — update node config (labels, limits)
router.patch("/:id/config", adminMiddleware, async (req: any, res) => {
  try {
    await NodeService.updateConfig(req.params.id, req.body);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/nodes/:id/exec — run a command on a node (admin)
router.post("/:id/exec", adminMiddleware, async (req: any, res) => {
  try {
    const result = await NodeService.exec(req.params.id, req.body.command, req.body.cwd);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/nodes/:id/sandboxes — node sandboxes (admin)
router.get("/:id/sandboxes", adminMiddleware, async (req: any, res) => {
  try {
    const result = await NodeService.call(req.params.id, "sandbox:list", {}, 30000);
    res.json({ sandboxes: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/nodes/:id/stats — recent heartbeat history (admin)
router.get("/:id/stats", adminMiddleware, async (req: any, res) => {
  try {
    const node = await NodeService.get(req.params.id);
    if (!node) return res.status(404).json({ error: "Node not found" });
    res.json({ stats: node.stats, history: node.history || [], online: NodeService.isOnline(node) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Installer script (public; token passed by admin on the CLI) ─
router.get("/install.sh", async (_req: any, res) => {
  res.setHeader("Content-Type", "text/x-shellscript");
  res.setHeader("Cache-Control", "no-store");
  const script = INSTALL_SHELL.replaceAll("__AGENT_JS__", AGENT_JS);
  res.send(script);
});

export default router;
