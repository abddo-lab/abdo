// server/src/routes/notifications.ts — Notification routes
import { Router } from "express";
import { NotificationService } from "../services/notification.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// GET /api/notifications — list user's notifications
router.get("/", authMiddleware, async (req: any, res) => {
  try {
    const notifications = await NotificationService.list(req.user.id);
    const unread = await NotificationService.unreadCount(req.user.id);
    res.json({ notifications, unread });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/:id/read — mark as read
router.post("/:id/read", authMiddleware, async (req: any, res) => {
  try {
    await NotificationService.markRead(req.params.id, req.user.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/read-all — mark all as read
router.post("/read-all", authMiddleware, async (req: any, res) => {
  try {
    await NotificationService.markAllRead(req.user.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
