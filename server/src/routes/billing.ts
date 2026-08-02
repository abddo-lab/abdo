// server/src/routes/billing.ts — Usage & billing routes
import { Router } from "express";
import pool from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { UsageService } from "../services/usage.js";

const router = Router();

// GET /api/billing/usage — real usage: month, today, 5h session window, executions, tool calls
router.get("/usage", authMiddleware, async (req: any, res) => {
  try {
    // Total cost this month
    const totalCost = await pool.query(
      `SELECT COALESCE(SUM(cost_usd), 0) as total FROM usage
       WHERE user_id = $1 AND recorded_at >= date_trunc('month', NOW())`,
      [req.user.id]
    );

    // Total tokens this month
    const totalTokens = await pool.query(
      `SELECT COALESCE(SUM(input_tokens), 0) as input, COALESCE(SUM(output_tokens), 0) as output
       FROM usage WHERE user_id = $1 AND recorded_at >= date_trunc('month', NOW())`,
      [req.user.id]
    );

    // Cost by model
    const byModel = await pool.query(
      `SELECT model_id, SUM(cost_usd) as cost, SUM(input_tokens) as input_tokens, SUM(output_tokens) as output_tokens, COUNT(*) as requests
       FROM usage WHERE user_id = $1 AND recorded_at >= date_trunc('month', NOW())
       GROUP BY model_id ORDER BY cost DESC`,
      [req.user.id]
    );

    // Daily cost (last 7 days)
    const dailyCost = await pool.query(
      `SELECT DATE(recorded_at) as date, SUM(cost_usd) as cost
       FROM usage WHERE user_id = $1 AND recorded_at >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(recorded_at) ORDER BY date`,
      [req.user.id]
    );

    // Today's cost
    const todayCost = await pool.query(
      `SELECT COALESCE(SUM(cost_usd), 0) as total FROM usage
       WHERE user_id = $1 AND DATE(recorded_at) = CURRENT_DATE`,
      [req.user.id]
    );

    // 5-hour session window spend (rolling)
    const sessionCost = await pool.query(
      `SELECT COALESCE(SUM(cost_usd), 0) as total, COUNT(*) as executions
       FROM usage WHERE user_id = $1 AND recorded_at >= NOW() - INTERVAL '5 hours'`,
      [req.user.id]
    );

    // Tool call breakdown — real tool executions from thread blocks
    const toolCalls = await pool.query(
      `SELECT data->>'tool' as tool, COUNT(*) as calls
       FROM thread_blocks tb
       JOIN threads t ON tb.thread_id = t.id
       WHERE t.user_id = $1 AND tb.kind = 'tool' AND data->>'tool' IS NOT NULL
       GROUP BY data->>'tool' ORDER BY calls DESC`,
      [req.user.id]
    );

    // User balance + plan + live limits
    const user = await pool.query(`SELECT balance, plan_id FROM users WHERE id = $1`, [req.user.id]);
    const planRes = await pool.query(`SELECT * FROM plans WHERE id = $1`, [user.rows[0]?.plan_id]);
    const plan = planRes.rows[0] || null;
    const limits = await UsageService.getLimits(req.user.id);
    const sessionSpent = parseFloat(sessionCost.rows[0].total);
    const totalExecutions = parseInt(sessionCost.rows[0].executions);
    const sessionLimit = limits?.session_limit_usd ?? 0;
    const weeklyLimit = limits?.weekly_limit_usd ?? 0;

    res.json({
      balance: parseFloat(user.rows[0]?.balance || "0"),
      plan_id: user.rows[0]?.plan_id,
      plan,
      session: {
        limit_usd: sessionLimit,
        unlimited: false,
        spent_usd: sessionSpent,
        pct: sessionLimit > 0 ? Math.min(100, Math.round((sessionSpent / sessionLimit) * 100)) : 0,
        window_hours: 5,
        executions: totalExecutions,
      },
      weekly: {
        limit_usd: weeklyLimit,
        spent_usd: limits?.weekly_spent_usd ?? 0,
        pct: weeklyLimit > 0 ? Math.min(100, Math.round(((limits?.weekly_spent_usd ?? 0) / weeklyLimit) * 100)) : 0,
      },
      monthly: {
        limit_usd: limits?.monthly_limit_usd ?? 0,
        spent_usd: limits?.monthly_spent_usd ?? 0,
        pct: (limits?.monthly_limit_usd ?? 0) > 0 ? Math.min(100, Math.round(((limits?.monthly_spent_usd ?? 0) / (limits?.monthly_limit_usd ?? 1)) * 100)) : 0,
      },
      executions: totalExecutions,
      tool_calls: toolCalls.rows.map((r) => ({
        tool: r.tool,
        calls: parseInt(r.calls),
      })),
      this_month: {
        total_cost: parseFloat(totalCost.rows[0].total),
        input_tokens: parseInt(totalTokens.rows[0].input),
        output_tokens: parseInt(totalTokens.rows[0].output),
        total_tokens: parseInt(totalTokens.rows[0].input) + parseInt(totalTokens.rows[0].output),
      },
      today_cost: parseFloat(todayCost.rows[0].total),
      by_model: byModel.rows.map((r) => ({
        model_id: r.model_id,
        cost: parseFloat(r.cost),
        input_tokens: parseInt(r.input_tokens),
        output_tokens: parseInt(r.output_tokens),
        requests: parseInt(r.requests),
      })),
      daily_cost: dailyCost.rows.map((r) => ({
        date: r.date,
        cost: parseFloat(r.cost),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/plan — get current plan
router.get("/plan", authMiddleware, async (req: any, res) => {
  try {
    const user = await pool.query(`SELECT plan_id, plan_expires_at, balance FROM users WHERE id = $1`, [req.user.id]);
    const plan = await pool.query(`SELECT * FROM plans WHERE id = $1`, [user.rows[0]?.plan_id]);
    res.json({
      plan: plan.rows[0] || null,
      expires_at: user.rows[0]?.plan_expires_at,
      balance: parseFloat(user.rows[0]?.balance || "0"),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/billing/plan — update plan
router.put("/plan", authMiddleware, async (req: any, res) => {
  try {
    const { plan_id } = req.body;
    const validPlans = ["free", "starter", "pro", "max"];
    if (!validPlans.includes(plan_id)) return res.status(400).json({ error: "Invalid plan" });

    const expiresAt = plan_id === "free" ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await pool.query(
      `UPDATE users SET plan_id = $1, plan_expires_at = $2, plan_selected = true, updated_at = NOW() WHERE id = $3`,
      [plan_id, expiresAt, req.user.id]
    );

    // Starting balance on first paid plan purchase (money-based usage)
    if (plan_id !== "free") {
      const balanceRes = await pool.query(`SELECT balance, plan_id FROM users WHERE id = $1`, [req.user.id]);
      const planRow = await pool.query(`SELECT price_monthly FROM plans WHERE id = $1`, [plan_id]);
      const starting = Math.round(parseFloat(planRow.rows[0]?.price_monthly || "0") * 0.25 * 100) / 100;
      if (parseFloat(balanceRes.rows[0]?.balance || "0") <= 0 && starting > 0) {
        await pool.query(`UPDATE users SET balance = balance + $1, updated_at = NOW() WHERE id = $2`, [starting, req.user.id]);
      }
    }

    const plan = await pool.query(`SELECT * FROM plans WHERE id = $1`, [plan_id]);
    res.json({ plan: plan.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/billing/plans — list all plans
router.get("/plans", async (req, res) => {
  try {
    const plans = await pool.query(`SELECT * FROM plans ORDER BY sort_order ASC`);
    res.json({ plans: plans.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/billing/topup — add balance (demo)
router.post("/topup", authMiddleware, async (req: any, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: "Invalid amount" });
    await pool.query(`UPDATE users SET balance = balance + $1, updated_at = NOW() WHERE id = $2`, [amount, req.user.id]);
    const user = await pool.query(`SELECT balance FROM users WHERE id = $1`, [req.user.id]);
    res.json({ balance: parseFloat(user.rows[0].balance) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
