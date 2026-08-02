// server/src/routes/updates.ts — real check-for-updates (queries the npm registry)
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { loadConfig } from "../config.js";

const router = Router();

// GET/POST /api/updates/check — compare installed version against the latest published one
router.all("/check", authMiddleware, async (req, res) => {
  try {
    const config = loadConfig();
    const current = config.app.version;

    let latest: string | null = null;
    let error: string | null = null;

    try {
      const npmRes = await fetch("https://registry.npmjs.org/kiren-server/latest", {
        signal: AbortSignal.timeout(8000),
      });
      if (npmRes.ok) {
        const data = await npmRes.json();
        latest = data?.version || null;
      } else {
        throw new Error(`npm registry: HTTP ${npmRes.status}`);
      }
    } catch (err: any) {
      error = err.message;
    }

    const updateAvailable = latest !== null && latest !== current;

    res.json({
      current,
      latest: latest ?? current,
      update_available: updateAvailable,
      checked_at: new Date().toISOString(),
      url: "https://www.npmjs.com/package/kiren-server",
      error,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
