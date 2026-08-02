// server/src/routes/skills.ts — Skills management routes
import { Router } from "express";
import { SkillsService } from "../services/skills.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// GET /api/skills — list user's skills
router.get("/", authMiddleware, async (req: any, res) => {
  try {
    const skills = await SkillsService.list(req.user.id);
    res.json({ skills });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/skills — create a skill
router.post("/", authMiddleware, async (req: any, res) => {
  try {
    const skill = await SkillsService.create(req.user.id, req.body);
    res.json(skill);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// PUT /api/skills/:id — update a skill
router.put("/:id", authMiddleware, async (req: any, res) => {
  try {
    const skill = await SkillsService.update(req.params.id, req.user.id, req.body);
    if (!skill) return res.status(404).json({ error: "Not found" });
    res.json(skill);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/skills/:id — delete a skill
router.delete("/:id", authMiddleware, async (req: any, res) => {
  try {
    await SkillsService.delete(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/skills/seed — seed default skills
router.post("/seed", authMiddleware, async (req: any, res) => {
  try {
    await SkillsService.seedDefaults(req.user.id);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
