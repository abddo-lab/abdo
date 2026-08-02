// server/src/routes/devices.ts — Device pairing + mobile connection
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { loadConfig } from "../config.js";
import pool from "../db.js";
import { v4 as uuid } from "uuid";

const router = Router();

// POST /api/devices/pair — generate a pairing token for mobile
router.post("/pair", authMiddleware, async (req: any, res) => {
  try {
    const pairingToken = uuid();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    // Store pairing token
    await pool.query(
      `INSERT INTO device_codes (id, user_code, device_code, status, user_id, expires_at)
       VALUES ($1, $2, $3, 'pending', $4, $5)`,
      [uuid(), pairingToken.slice(0, 8).toUpperCase(), pairingToken, req.user.id, expiresAt]
    );

    const config = loadConfig();
    const mobileUrl = `http://${config.app.mobile_domain}?pair=${pairingToken}`;

    res.json({
      pairing_token: pairingToken,
      mobile_url: mobileUrl,
      qr_data: mobileUrl,
      expires_in: 900,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/devices/verify — verify a pairing token from mobile
router.post("/verify", async (req, res) => {
  try {
    const { pairing_token } = req.body;
    if (!pairing_token) return res.status(400).json({ error: "pairing_token required" });

    const result = await pool.query(
      `SELECT * FROM device_codes WHERE device_code = $1 AND status = 'pending'`,
      [pairing_token]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: "Invalid or expired pairing token" });

    const dc = result.rows[0];
    if (new Date(dc.expires_at) < new Date()) return res.status(410).json({ error: "Pairing token expired" });

    // Create a session for the mobile device
    const sessionToken = uuid();
    const sessionExpires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

    await pool.query(
      `INSERT INTO sessions (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)`,
      [uuid(), dc.user_id, sessionToken, sessionExpires]
    );

    // Mark pairing as used
    await pool.query(`UPDATE device_codes SET status = 'authorized' WHERE device_code = $1`, [pairing_token]);

    // Get user info
    const user = await pool.query(`SELECT * FROM users WHERE id = $1`, [dc.user_id]);

    res.json({
      token: sessionToken,
      user: {
        id: user.rows[0].id,
        username: user.rows[0].username,
        display_name: user.rows[0].display_name,
        avatar_url: user.rows[0].avatar_url,
        plan_id: user.rows[0].plan_id,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/devices — list connected devices
router.get("/", authMiddleware, async (req: any, res) => {
  try {
    const sessions = await pool.query(
      `SELECT id, created_at, expires_at FROM sessions WHERE user_id = $1 AND expires_at > NOW() ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ devices: sessions.rows.map((s) => ({ id: s.id, connected_at: s.created_at, expires_at: s.expires_at })) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/devices/pair/:token/status — real pairing status (pending/authorized/expired)
router.get("/pair/:token/status", authMiddleware, async (req: any, res) => {
  try {
    const result = await pool.query(
      `SELECT status, expires_at FROM device_codes WHERE device_code = $1 AND user_id = $2`,
      [req.params.token, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Pairing token not found" });
    const row = result.rows[0];
    if (row.status === "pending" && new Date(row.expires_at) < new Date()) {
      res.json({ status: "expired" });
    } else {
      res.json({ status: row.status });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/devices/:id — disconnect a device
router.delete("/:id", authMiddleware, async (req: any, res) => {
  try {
    await pool.query(`DELETE FROM sessions WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
