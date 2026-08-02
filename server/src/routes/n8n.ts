// server/src/routes/n8n.ts — n8n instance management routes
import { Router } from "express";
import { N8nInstanceService } from "../services/n8n-instance.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// POST /api/n8n/start — Start n8n on user's sandbox
router.post("/start", authMiddleware, async (req: any, res) => {
  try {
    const instance = await N8nInstanceService.start(req.user.id);
    res.json(instance);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/n8n/stop — Stop n8n
router.post("/stop", authMiddleware, async (req: any, res) => {
  try {
    await N8nInstanceService.stop(req.user.id);
    res.json({ ok: true, status: "stopped" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/n8n — Get n8n status
router.get("/", authMiddleware, async (req: any, res) => {
  try {
    const instance = await N8nInstanceService.get(req.user.id);
    res.json({ instance });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/n8n/workflows — List workflows
router.get("/workflows", authMiddleware, async (req: any, res) => {
  try {
    const workflows = await N8nInstanceService.listWorkflows(req.user.id);
    res.json({ workflows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/n8n/workflows/:id/execute — Execute a workflow
router.post("/workflows/:id/execute", authMiddleware, async (req: any, res) => {
  try {
    const result = await N8nInstanceService.executeWorkflow(req.user.id, req.params.id, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/n8n/templates/:id/inject — Inject a template
router.post("/templates/:id/inject", authMiddleware, async (req: any, res) => {
  try {
    const result = await N8nInstanceService.injectWorkflow(req.user.id, req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
