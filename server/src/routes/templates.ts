// server/src/routes/templates.ts — Agent templates routes
import { Router } from "express";
import { AgentTemplatesService } from "../services/agent-templates.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.get("/", authMiddleware, async (req: any, res) => {
  try { res.json({ templates: await AgentTemplatesService.list(req.user.id) }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/", authMiddleware, async (req: any, res) => {
  try { res.json(await AgentTemplatesService.create(req.user.id, req.body)); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put("/:id", authMiddleware, async (req: any, res) => {
  try { await AgentTemplatesService.update(req.params.id, req.user.id, req.body); res.json({ ok: true }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", authMiddleware, async (req: any, res) => {
  try { await AgentTemplatesService.delete(req.params.id, req.user.id); res.json({ ok: true }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/seed", authMiddleware, async (req: any, res) => {
  try { await AgentTemplatesService.seedDefaults(req.user.id); res.json({ ok: true }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
