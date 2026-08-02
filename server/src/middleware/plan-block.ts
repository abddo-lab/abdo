// server/src/middleware/plan-block.ts — Block users who haven't selected a plan
import pool from "../db.js";

const EXEMPT_PATHS = [
  "/api/auth",
  "/api/billing/plans",
  "/api/billing/plan",
  "/api/user/plan",
  "/api/health",
  "/mobile",
  "/device",
  "/ws",
];

export async function planBlockMiddleware(req: any, res: any, next: any) {
  // Skip exempt paths
  if (EXEMPT_PATHS.some((p) => req.path.startsWith(p))) {
    return next();
  }

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return next(); // Let auth middleware handle missing tokens

  try {
    const result = await pool.query(
      `SELECT u.plan_selected FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = $1`,
      [token]
    );

    if (result.rows.length === 0) return next();

    const user = result.rows[0];
    if (user.plan_selected === false) {
      return res.status(403).json({
        error: "Plan selection required",
        code: "PLAN_REQUIRED",
        message: "Please select a plan to continue using Kiren.",
      });
    }
  } catch {
    // Let auth middleware handle DB errors
  }

  next();
}
