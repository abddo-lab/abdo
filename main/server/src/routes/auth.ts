import { Router } from "express";
import { v4 as uuid } from "uuid";
import pool from "../db.js";

const router = Router();

const GITHUB_CLIENT_ID = "Ov23li16VwFc2MqU2doZ";
const GITHUB_CLIENT_SECRET = "4c97e0abbed758c35f9f93d5c344e29b53a3eb12";

// Start device flow - get user code
router.post("/device/code", async (req, res) => {
  try {
    if (!GITHUB_CLIENT_ID) {
      const userCode = generateUserCode();
      const deviceCode = uuid();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await pool.query(
        `INSERT INTO device_codes (id, user_code, device_code, status, expires_at)
         VALUES ($1, $2, $3, 'pending', $4)`,
        [uuid(), userCode, deviceCode, expiresAt]
      );

      return res.json({
        user_code: userCode,
        device_code: deviceCode,
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 5,
      });
    }

    const response = await fetch("https://github.com/login/device/code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        scope: "read:user user:email",
      }),
    });

    if (!response.ok) {
      // If GitHub API fails (no real client_id), generate a mock code for demo
      console.log("GitHub API unavailable, generating demo code");
      const userCode = generateUserCode();
      const deviceCode = uuid();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await pool.query(
        `INSERT INTO device_codes (id, user_code, device_code, status, expires_at)
         VALUES ($1, $2, $3, 'pending', $4)`,
        [uuid(), userCode, deviceCode, expiresAt]
      );

      return res.json({
        user_code: userCode,
        device_code: deviceCode,
        verification_uri: "https://github.com/login/device",
        expires_in: 900,
        interval: 5,
      });
    }

    const data = await response.json();

    // Store device code in our database
    const expiresAt = new Date(Date.now() + data.expires_in * 1000);
    await pool.query(
      `INSERT INTO device_codes (id, user_code, device_code, status, expires_at)
       VALUES ($1, $2, $3, 'pending', $4)`,
      [uuid(), data.user_code, data.device_code, expiresAt]
    );

    res.json({
      user_code: data.user_code,
      device_code: data.device_code,
      verification_uri: data.verification_uri,
      expires_in: data.expires_in,
      interval: data.interval,
    });
  } catch (error) {
    console.error("Device code error:", error);
    res.status(500).json({ error: "Failed to initiate device flow" });
  }
});

// Poll for authorization
router.post("/device/poll", async (req, res) => {
  const { device_code } = req.body;

  if (!device_code) {
    return res.status(400).json({ error: "device_code required" });
  }

  try {
    // Check our database first
    const result = await pool.query(
      `SELECT * FROM device_codes WHERE device_code = $1`,
      [device_code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Invalid device code" });
    }

    const dc = result.rows[0];

    // Check if expired
    if (new Date(dc.expires_at) < new Date()) {
      return res.json({ status: "expired" });
    }

    // If already authorized, return the token
    if (dc.status === "authorized" && dc.github_access_token) {
      // Get or create user
      const user = await getOrCreateUser(dc.github_access_token);

      // Create session
      const sessionToken = uuid();
      const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await pool.query(
        `INSERT INTO sessions (id, user_id, token, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [uuid(), user.id, sessionToken, sessionExpires]
      );

      // Clean up device code
      await pool.query(`DELETE FROM device_codes WHERE device_code = $1`, [device_code]);

      return res.json({
        status: "authorized",
        token: sessionToken,
        user: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          email: user.email,
          avatar_url: user.avatar_url,
          plan_id: user.plan_id,
        },
      });
    }

    // Try to poll GitHub
    if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
      const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          device_code: device_code,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      });

      const data = await response.json();

      if (data.access_token) {
        // Authorized! Store token and mark as authorized
        await pool.query(
          `UPDATE device_codes SET status = 'authorized', github_access_token = $1 WHERE device_code = $2`,
          [data.access_token, device_code]
        );

        // Get or create user
        const user = await getOrCreateUser(data.access_token);

        // Create session
        const sessionToken = uuid();
        const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        await pool.query(
          `INSERT INTO sessions (id, user_id, token, expires_at)
           VALUES ($1, $2, $3, $4)`,
          [uuid(), user.id, sessionToken, sessionExpires]
        );

        // Clean up
        await pool.query(`DELETE FROM device_codes WHERE device_code = $1`, [device_code]);

        return res.json({
          status: "authorized",
          token: sessionToken,
          user: {
            id: user.id,
            username: user.username,
            display_name: user.display_name,
            email: user.email,
            avatar_url: user.avatar_url,
            plan_id: user.plan_id,
          },
        });
      } else if (data.error === "authorization_pending") {
        return res.json({ status: "pending" });
      } else if (data.error === "slow_down") {
        return res.json({ status: "pending", slow_down: true });
      } else if (data.error === "expired_token") {
        await pool.query(`UPDATE device_codes SET status = 'expired' WHERE device_code = $1`, [device_code]);
        return res.json({ status: "expired" });
      } else if (data.error === "access_denied") {
        await pool.query(`UPDATE device_codes SET status = 'denied' WHERE device_code = $1`, [device_code]);
        return res.json({ status: "denied" });
      }
    }

    return res.json({ status: "pending" });
  } catch (error) {
    console.error("Poll error:", error);
    res.status(500).json({ error: "Failed to poll device code" });
  }
});

// Demo login (for testing without GitHub)
router.post("/demo-login", async (req, res) => {
  try {
    const demoUser = {
      id: uuid(),
      github_id: Math.floor(Math.random() * 1000000),
      username: "demo-user",
      display_name: "Demo User",
      email: "demo@kiren.dev",
      avatar_url: null,
    };

    // Check if demo user exists
    const existing = await pool.query(`SELECT * FROM users WHERE username = $1`, [demoUser.username]);

    let user;
    if (existing.rows.length > 0) {
      user = existing.rows[0];
    } else {
      const result = await pool.query(
        `INSERT INTO users (id, github_id, username, display_name, email, plan_id)
         VALUES ($1, $2, $3, $4, $5, 'free')
         RETURNING *`,
        [demoUser.id, demoUser.github_id, demoUser.username, demoUser.display_name, demoUser.email]
      );
      user = result.rows[0];
    }

    // Create session
    const sessionToken = uuid();
    const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO sessions (id, user_id, token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [uuid(), user.id, sessionToken, sessionExpires]
    );

    res.json({
      token: sessionToken,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        email: user.email,
        avatar_url: user.avatar_url,
        plan_id: user.plan_id,
      },
    });
  } catch (error) {
    console.error("Demo login error:", error);
    res.status(500).json({ error: "Failed to create demo session" });
  }
});

// Verify session
router.get("/session", async (req, res) => {
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

    res.json({
      user: {
        id: row.id,
        username: row.username,
        display_name: row.display_name,
        email: row.email,
        avatar_url: row.avatar_url,
        plan_id: row.plan_id,
      },
    });
  } catch (error) {
    console.error("Session verify error:", error);
    res.status(500).json({ error: "Failed to verify session" });
  }
});

// Logout
router.post("/logout", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (token) {
    await pool.query(`DELETE FROM sessions WHERE token = $1`, [token]);
  }

  res.json({ ok: true });
});

// Helper: Get or create user from GitHub access token
async function getOrCreateUser(accessToken: string) {
  // Fetch user info from GitHub
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch GitHub user");
  }

  const ghUser = await response.json();

  // Fetch user email
  const emailResponse = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  let email = ghUser.email;
  if (!email && emailResponse.ok) {
    const emails = await emailResponse.json();
    const primary = emails.find((e: any) => e.primary && e.verified);
    if (primary) email = primary.email;
  }

  // Check if user exists
  const existing = await pool.query(`SELECT * FROM users WHERE github_id = $1`, [ghUser.id]);

  if (existing.rows.length > 0) {
    // Update user info
    const result = await pool.query(
      `UPDATE users SET username = $1, display_name = $2, email = $3, avatar_url = $4, updated_at = NOW()
       WHERE github_id = $5 RETURNING *`,
      [ghUser.login, ghUser.name || ghUser.login, email, ghUser.avatar_url, ghUser.id]
    );
    return result.rows[0];
  }

  // Create new user
  const result = await pool.query(
    `INSERT INTO users (id, github_id, username, display_name, email, avatar_url, plan_id)
     VALUES ($1, $2, $3, $4, $5, $6, 'free')
     RETURNING *`,
    [uuid(), ghUser.id, ghUser.login, ghUser.name || ghUser.login, email, ghUser.avatar_url]
  );

  return result.rows[0];
}

function generateUserCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${pick(4)}-${pick(4)}`;
}

export default router;
