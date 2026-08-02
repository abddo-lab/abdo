// server/src/routes/workflows.ts — Workflow instance routes
import { Router } from "express";
import { WorkflowService } from "../services/workflow.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// GET /api/workflows — list user's workflow instances
router.get("/", authMiddleware, async (req: any, res) => {
  try {
    const instances = await WorkflowService.list(req.user.id);
    res.json({ instances });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workflows — create a new workflow instance
router.post("/", authMiddleware, async (req: any, res) => {
  try {
    const { name, slug, template, region, plan } = req.body;
    const instance = await WorkflowService.create(req.user.id, name, slug, template, region, plan);
    res.json(instance);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workflows/:id — get workflow details
router.get("/:id", authMiddleware, async (req: any, res) => {
  try {
    const instance = await WorkflowService.get(req.params.id);
    if (!instance) return res.status(404).json({ error: "Not found" });
    res.json(instance);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workflows/:id/executions — get workflow executions from n8n
router.get("/:id/executions", authMiddleware, async (req: any, res) => {
  try {
    const executions = await WorkflowService.getExecutions(req.params.id);
    res.json({ executions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workflows/:id/pause — pause a workflow
router.post("/:id/pause", authMiddleware, async (req: any, res) => {
  try {
    await WorkflowService.pause(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workflows/:id/resume — resume a workflow
router.post("/:id/resume", authMiddleware, async (req: any, res) => {
  try {
    await WorkflowService.resume(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/workflows/:id — delete a workflow
router.delete("/:id", authMiddleware, async (req: any, res) => {
  try {
    await WorkflowService.delete(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
