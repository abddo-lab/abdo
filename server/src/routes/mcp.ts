// server/src/routes/mcp.ts — MCP server management routes
import { Router } from "express";
import { MCPService } from "../services/mcp.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// GET /api/mcp — list user's MCP servers
router.get("/", authMiddleware, async (req: any, res) => {
  try {
    const servers = await MCPService.list(req.user.id);
    res.json({ servers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mcp — install an MCP server
router.post("/", authMiddleware, async (req: any, res) => {
  try {
    const user = await (await import("../db.js")).default.query(
      `SELECT sandbox_id FROM users WHERE id = $1`, [req.user.id]
    );
    const sandboxId = user.rows[0]?.sandbox_id;
    if (!sandboxId) return res.status(400).json({ error: "No sandbox available" });

    const server = await MCPService.install(req.user.id, sandboxId, req.body);
    res.json(server);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/mcp/:id/tools — list tools of an MCP server
router.get("/:id/tools", authMiddleware, async (req: any, res) => {
  try {
    const tools = await MCPService.getTools(req.user.id, req.params.id);
    res.json({ tools });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mcp/:id/call — call an MCP tool
router.post("/:id/call", authMiddleware, async (req: any, res) => {
  try {
    const { tool_name, args } = req.body;
    const result = await MCPService.callTool(req.user.id, req.params.id, tool_name, args);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mcp/:id/toggle — toggle MCP server
router.post("/:id/toggle", authMiddleware, async (req: any, res) => {
  try {
    const { enabled } = req.body;
    await MCPService.toggle(req.user.id, req.params.id, enabled);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/mcp/:id — remove an MCP server
router.delete("/:id", authMiddleware, async (req: any, res) => {
  try {
    await MCPService.remove(req.user.id, req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
