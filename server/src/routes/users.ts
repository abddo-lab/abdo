import { Router } from "express";
import { v4 as uuid } from "uuid";
import pool from "../db.js";

const router = Router();

// Middleware to verify session
async function authMiddleware(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const result = await pool.query(
      `SELECT u.*, s.expires_at as session_expires
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const row = result.rows[0];

    if (new Date(row.session_expires) < new Date()) {
      return res.status(401).json({ error: "Token expired" });
    }

    req.user = row;
    next();
  } catch (error) {
    res.status(500).json({ error: "Auth failed" });
  }
}

// Get current user
router.get("/me", authMiddleware, async (req: any, res) => {
  const user = req.user;

  // Get plan details
  let plan = null;
  if (user.plan_id) {
    const planResult = await pool.query(`SELECT * FROM plans WHERE id = $1`, [user.plan_id]);
    plan = planResult.rows[0] || null;
  }

  // Get usage for current month
  const usageResult = await pool.query(
    `SELECT feature, SUM(amount) as total
     FROM usage
     WHERE user_id = $1 AND recorded_at >= date_trunc('month', NOW())
     GROUP BY feature`,
    [user.id]
  );

  const usage: Record<string, number> = {};
  for (const row of usageResult.rows) {
    usage[row.feature] = parseInt(row.total);
  }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        email: user.email,
        avatar_url: user.avatar_url,
        plan_id: user.plan_id,
        plan_selected: user.plan_selected,
        created_at: user.created_at,
        notification_settings: user.notification_settings || { email_agent: false, email_review: false, web_status: true },
      },
      plan,
      usage,
    });
});

// Update user settings (notification preferences, etc.)
router.put("/settings", authMiddleware, async (req: any, res) => {
  try {
    const { notification_settings } = req.body;
    const user = req.user;

    if (!notification_settings || typeof notification_settings !== "object") {
      return res.status(400).json({ error: "notification_settings required" });
    }

    const result = await pool.query(
      `UPDATE users SET notification_settings = $1, updated_at = NOW() WHERE id = $2 RETURNING notification_settings`,
      [JSON.stringify(notification_settings), user.id]
    );

    res.json({ notification_settings: result.rows[0].notification_settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update user plan (for demo/testing - in production this would be through payment)
router.put("/plan", authMiddleware, async (req: any, res) => {
  const { plan_id } = req.body;
  const user = req.user;

  const validPlans = ["free", "starter", "pro", "max"];
  if (!validPlans.includes(plan_id)) {
    return res.status(400).json({ error: "Invalid plan" });
  }

  const expiresAt = plan_id === "free" ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await pool.query(
    `UPDATE users SET plan_id = $1, plan_expires_at = $2, plan_selected = true, updated_at = NOW() WHERE id = $3`,
    [plan_id, expiresAt, user.id]
  );

  // Starting balance on first paid plan purchase (money-based usage)
  if (plan_id !== "free") {
    const balanceRes = await pool.query(`SELECT balance FROM users WHERE id = $1`, [user.id]);
    const planRow = await pool.query(`SELECT price_monthly FROM plans WHERE id = $1`, [plan_id]);
    const starting = Math.round(parseFloat(planRow.rows[0]?.price_monthly || "0") * 0.25 * 100) / 100;
    if (parseFloat(balanceRes.rows[0]?.balance || "0") <= 0 && starting > 0) {
      await pool.query(`UPDATE users SET balance = balance + $1, updated_at = NOW() WHERE id = $2`, [starting, user.id]);
    }
  }

  // Get updated plan
  const planResult = await pool.query(`SELECT * FROM plans WHERE id = $1`, [plan_id]);

  res.json({
    plan: planResult.rows[0],
    plan_selected: true,
  });
});

// Record usage
router.post("/usage", authMiddleware, async (req: any, res) => {
  const { feature, amount = 1 } = req.body;
  const user = req.user;

  await pool.query(
    `INSERT INTO usage (id, user_id, feature, amount) VALUES ($1, $2, $3, $4)`,
    [uuid(), user.id, feature, amount]
  );

  res.json({ ok: true });
});

// Get all plans (public)
router.get("/plans", async (req, res) => {
  const result = await pool.query(`SELECT * FROM plans ORDER BY sort_order ASC`);
  res.json({ plans: result.rows });
});

export default router;
