// server/src/routes/reset.ts — Full data reset route
import { Router } from "express";
import { DataResetService } from "../services/data-reset.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// POST /api/reset — Reset all user data
router.post("/", authMiddleware, async (req: any, res) => {
  try {
    const result = await DataResetService.resetAll(req.user.id);
    res.json({
      ok: true,
      message: "All data has been reset. Your account has been kept but everything else is gone.",
      deleted: result.deleted,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
