// server/src/middleware/admin.ts — Admin-only auth middleware
import { authMiddleware } from "./auth.js";

// Only this account can manage the node system / infra
export const ADMIN_EMAILS = ["blacksquadebank@gmail.com"];

/** Require a valid session AND an admin account */
export async function adminMiddleware(req: any, res: any, next: any) {
  await authMiddleware(req, res, async () => {
    const email = (req.user?.email || "").toLowerCase().trim();
    const isAdmin = req.user?.is_admin === true || ADMIN_EMAILS.includes(email);
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  });
}
