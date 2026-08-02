// server/src/routes/deployments.ts — Deployment/preview routes
import { Router } from "express";
import { DeployService } from "../services/deploy.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// GET /api/deployments — list user's deployments
router.get("/", authMiddleware, async (req: any, res) => {
  try {
    const deployments = await DeployService.list(req.user.id);
    res.json({ deployments });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/deployments — create a deployment
router.post("/", authMiddleware, async (req: any, res) => {
  try {
    const { project_id, thread_id, port } = req.body;
    const deployment = await DeployService.deploy(req.user.id, project_id, thread_id, port);
    res.json(deployment);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/deployments/:id — delete a deployment
router.delete("/:id", authMiddleware, async (req: any, res) => {
  try {
    await DeployService.delete(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
