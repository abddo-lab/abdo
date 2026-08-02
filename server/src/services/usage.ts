// server/src/services/usage.ts — Money-based usage limits (Cursor/Anthropic style)
// Every plan has a 5h-window limit and a weekly limit in USD. The 5h window
// usage resets every 5 hours and does NOT count toward the weekly limit.
// Usage is paid from the user's dollar balance — no request counting.
import pool from "../db.js";
import { v4 as uuid } from "uuid";

export const SESSION_WINDOW_HOURS = 5;
export const EXECUTION_COST_USD = 0.001; // per agent execution

export interface UsageLimits {
  plan_id: string;
  session_limit_usd: number;
  weekly_limit_usd: number;
  monthly_limit_usd: number;
  session_spent_usd: number;
  weekly_spent_usd: number;
  monthly_spent_usd: number;
  balance: number;
}

export class UsageService {
  static async getLimits(userId: string): Promise<UsageLimits | null> {
    const user = await pool.query(`SELECT balance, plan_id FROM users WHERE id = $1`, [userId]);
    if (user.rows.length === 0) return null;
    const plan = await pool.query(`SELECT * FROM plans WHERE id = $1`, [user.rows[0].plan_id]);
    const limits = plan.rows[0]?.limits || {};

    const session = await pool.query(
      `SELECT COALESCE(SUM(cost_usd), 0) as total FROM usage
       WHERE user_id = $1 AND recorded_at >= NOW() - INTERVAL '5 hours'`,
      [userId]
    );
    const week = await pool.query(
      `SELECT COALESCE(SUM(cost_usd), 0) as total FROM usage
       WHERE user_id = $1 AND recorded_at >= date_trunc('week', NOW())`,
      [userId]
    );
    const month = await pool.query(
      `SELECT COALESCE(SUM(cost_usd), 0) as total FROM usage
       WHERE user_id = $1 AND recorded_at >= date_trunc('month', NOW())`,
      [userId]
    );

    const sessionSpent = parseFloat(session.rows[0].total);
    const weekTotal = parseFloat(week.rows[0].total);
    const monthTotal = parseFloat(month.rows[0].total);

    return {
      plan_id: user.rows[0].plan_id,
      session_limit_usd: parseFloat(limits.session_limit_usd ?? 0),
      weekly_limit_usd: parseFloat(limits.weekly_limit_usd ?? 0),
      monthly_limit_usd: parseFloat(limits.monthly_limit_usd ?? 0),
      session_spent_usd: sessionSpent,
      // 5h-window usage is excluded from the weekly max
      weekly_spent_usd: Math.max(0, weekTotal - sessionSpent),
      monthly_spent_usd: monthTotal,
      balance: parseFloat(user.rows[0].balance || "0"),
    };
  }

  /** Throws if the user is over any usage limit or (paid plans) out of balance */
  static async enforce(userId: string): Promise<void> {
    const l = await this.getLimits(userId);
    if (!l) return;

    if (l.session_limit_usd > 0 && l.session_spent_usd >= l.session_limit_usd) {
      const err: any = new Error(
        `You've used your ${SESSION_WINDOW_HOURS}h usage limit ($${l.session_limit_usd.toFixed(2)}). It resets automatically — come back later or upgrade your plan.`
      );
      err.status = 429;
      throw err;
    }
    if (l.weekly_limit_usd > 0 && l.weekly_spent_usd >= l.weekly_limit_usd) {
      const err: any = new Error(
        `You've used your weekly usage limit ($${l.weekly_limit_usd.toFixed(2)}). It resets next week — upgrade your plan to keep going.`
      );
      err.status = 429;
      throw err;
    }
    if (l.monthly_limit_usd > 0 && l.monthly_spent_usd >= l.monthly_limit_usd) {
      const err: any = new Error(
        `You've used your monthly usage limit ($${l.monthly_limit_usd.toFixed(2)}). It resets on the 1st — upgrade your plan to keep going.`
      );
      err.status = 429;
      throw err;
    }
    // Free plan has no balance requirement — its caps above are the limit.
    if (l.plan_id !== "free" && l.balance <= 0) {
      const err: any = new Error("Your balance is $0. Top up to keep using Kiren.");
      err.status = 402;
      throw err;
    }
  }

  /** Record one agent execution at a fixed dollar cost and deduct from balance */
  static async recordExecution(userId: string, threadId: string, modelId: string): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO usage (id, user_id, thread_id, model_id, feature, amount, cost_usd)
         VALUES ($1, $2, $3, $4, 'execution', 1, $5)`,
        [uuid(), userId, threadId, modelId, EXECUTION_COST_USD]
      );
      await pool.query(
        `UPDATE users SET balance = GREATEST(0, balance - $1), updated_at = NOW() WHERE id = $2`,
        [EXECUTION_COST_USD, userId]
      );
    } catch {}
  }
}
