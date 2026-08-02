// server/src/routes/smtp.ts — SMTP addon routes
import { Router } from "express";
import { SMTPAddonService } from "../services/smtp-addon.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// POST /api/smtp/generate — Generate SMTP for user
router.post("/generate", authMiddleware, async (req: any, res) => {
  try {
    const result = await SMTPAddonService.generateSMTP(req.user.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/smtp — Get user's SMTP config
router.get("/", authMiddleware, async (req: any, res) => {
  try {
    const smtp = await SMTPAddonService.getSMTP(req.user.id);
    res.json({ smtp });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/smtp/send — Send email
router.post("/send", authMiddleware, async (req: any, res) => {
  try {
    const { to, subject, body, html } = req.body;
    if (!to || !subject || !body) {
      return res.status(400).json({ error: "to, subject, body required" });
    }
    const result = await SMTPAddonService.sendEmail(req.user.id, to, subject, body, html);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/smtp — Revoke SMTP
router.delete("/", authMiddleware, async (req: any, res) => {
  try {
    await SMTPAddonService.revokeSMTP(req.user.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
