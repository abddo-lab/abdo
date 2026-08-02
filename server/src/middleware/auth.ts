// server/src/middleware/auth.ts — Session-based auth middleware
import pool from "../db.js";

export async function authMiddleware(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const result = await pool.query(
      `SELECT u.*, s.expires_at as session_expires
       FROM sessions s JOIN users u ON s.user_id = u.id
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
    req.token = token;
    next();
  } catch (err) {
    res.status(500).json({ error: "Auth failed" });
  }
}
