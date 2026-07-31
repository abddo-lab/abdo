import { Router } from "express";
import pool from "../db.js";
const router = Router();
// Middleware to verify session
async function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
        return res.status(401).json({ error: "No token provided" });
    }
    try {
        const result = await pool.query(`SELECT u.*, s.expires_at as session_expires
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = $1`, [token]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Invalid token" });
        }
        const row = result.rows[0];
        if (new Date(row.session_expires) < new Date()) {
            return res.status(401).json({ error: "Token expired" });
        }
        req.user = row;
        next();
    }
    catch (error) {
        res.status(500).json({ error: "Auth failed" });
    }
}
// Get current user
router.get("/me", authMiddleware, async (req, res) => {
    const user = req.user;
    // Get plan details
    let plan = null;
    if (user.plan_id) {
        const planResult = await pool.query(`SELECT * FROM plans WHERE id = $1`, [user.plan_id]);
        plan = planResult.rows[0] || null;
    }
    // Get usage for current month
    const usageResult = await pool.query(`SELECT feature, SUM(amount) as total
     FROM usage
     WHERE user_id = $1 AND recorded_at >= date_trunc('month', NOW())
     GROUP BY feature`, [user.id]);
    const usage = {};
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
            created_at: user.created_at,
        },
        plan,
        usage,
    });
});
// Update user plan (for demo/testing - in production this would be through payment)
router.put("/plan", authMiddleware, async (req, res) => {
    const { plan_id } = req.body;
    const user = req.user;
    const validPlans = ["free", "starter", "pro", "max"];
    if (!validPlans.includes(plan_id)) {
        return res.status(400).json({ error: "Invalid plan" });
    }
    const expiresAt = plan_id === "free" ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await pool.query(`UPDATE users SET plan_id = $1, plan_expires_at = $2, updated_at = NOW() WHERE id = $3`, [plan_id, expiresAt, user.id]);
    // Get updated plan
    const planResult = await pool.query(`SELECT * FROM plans WHERE id = $1`, [plan_id]);
    res.json({
        plan: planResult.rows[0],
    });
});
// Record usage
router.post("/usage", authMiddleware, async (req, res) => {
    const { feature, amount = 1 } = req.body;
    const user = req.user;
    await pool.query(`INSERT INTO usage (id, user_id, feature, amount) VALUES ($1, $2, $3, $4)`, [require("uuid").v4(), user.id, feature, amount]);
    res.json({ ok: true });
});
// Get all plans (public)
router.get("/plans", async (req, res) => {
    const result = await pool.query(`SELECT * FROM plans ORDER BY sort_order ASC`);
    res.json({ plans: result.rows });
});
export default router;
