// server/src/routes/hooks.ts — Hooks management routes
import { Router } from "express";
import { HooksService } from "../services/hooks.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.get("/", authMiddleware, async (req: any, res) => {
  try { res.json({ hooks: await HooksService.list(req.user.id) }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/", authMiddleware, async (req: any, res) => {
  try { res.json(await HooksService.create(req.user.id, req.body)); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put("/:id", authMiddleware, async (req: any, res) => {
  try { await HooksService.update(req.params.id, req.user.id, req.body); res.json({ ok: true }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", authMiddleware, async (req: any, res) => {
  try { await HooksService.delete(req.params.id, req.user.id); res.json({ ok: true }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post("/seed", authMiddleware, async (req: any, res) => {
  try { await HooksService.seedDefaults(req.user.id); res.json({ ok: true }); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
