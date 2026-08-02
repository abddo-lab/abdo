// server/src/routes/workflow-templates.ts — Workflow template routes
import { Router } from "express";
import { WorkflowTemplateService } from "../services/workflow-templates.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// GET /api/workflow-templates — List templates
router.get("/", async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const templates = await WorkflowTemplateService.list(category);
    res.json({ templates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workflow-templates/:id — Get template
router.get("/:id", async (req, res) => {
  try {
    const tpl = await WorkflowTemplateService.get(req.params.id);
    if (!tpl) return res.status(404).json({ error: "Not found" });
    res.json(tpl);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workflow-templates — Create template (admin)
router.post("/", authMiddleware, async (req: any, res) => {
  try {
    const tpl = await WorkflowTemplateService.create(req.body);
    res.json(tpl);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/workflow-templates/:id — Delete template (admin)
router.delete("/:id", authMiddleware, async (req: any, res) => {
  try {
    await WorkflowTemplateService.delete(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
