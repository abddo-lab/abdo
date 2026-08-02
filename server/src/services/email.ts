// server/src/services/email.ts — Real email delivery via AgentMail
// (agentmail-node SDK → AgentMail's SMTP-sending API). Used for email
// notifications: deploy-ready, agent finished, automation runs, billing.
import { AgentMailClient } from "agentmail";
import { loadConfig } from "../config.js";
import pool from "../db.js";

let client: AgentMailClient | null = null;
let cfg: { apiKey: string; fromInbox: string; fromName: string } | null = null;

function getClient(): AgentMailClient | null {
  const c = loadConfig();
  const apiKey = c.agentmail?.api_key;
  if (!apiKey || apiKey.startsWith("REPLACE")) return null;
  if (!client) client = new AgentMailClient({ apiKey });
  cfg = {
    apiKey,
    fromInbox: c.agentmail?.from_inbox || "kiren-labs@agentmail.to",
    fromName: c.agentmail?.from_name || "Kiren",
  };
  return client;
}

export interface EmailPayload {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  fromInbox?: string;
}

export class EmailService {
  static get enabled(): boolean {
    return getClient() !== null;
  }

  /** Send a raw email. Never throws — failures are logged only. */
  static async send(payload: EmailPayload): Promise<boolean> {
    const client = getClient();
    if (!client || !payload?.to || !payload.subject) return false;
    try {
      const fromInbox = payload.fromInbox || cfg!.fromInbox;
      await client.inboxes.messages.send(fromInbox, {
        to: [payload.to],
        subject: payload.subject,
        text: payload.text || payload.subject,
        ...(payload.html ? { html: payload.html } : {}),
      });
      return true;
    } catch (err) {
      console.error("Email send failed:", err instanceof Error ? err.message : err);
      return false;
    }
  }

  /** Look up the user's email + notification prefs and send if allowed. */
  static async sendNotification(userId: string, notif: { type: string; title: string; body?: string; actionUrl?: string }): Promise<boolean> {
    if (!getClient()) return false;
    try {
      const user = await pool.query(`SELECT email, notification_settings FROM users WHERE id = $1`, [userId]);
      const row = user.rows[0];
      if (!row?.email) return false;

      const ns = row.notification_settings || {};
      // Respect toggles for agent/automation/review email; important events always email.
      if (notif.type === "thread" && !ns.email_agent) return false;
      if (notif.type === "automation" && !ns.email_agent) return false;
      if (notif.type === "review" && !ns.email_review) return false;

      const body = [notif.body, notif.actionUrl ? `Open in Kiren: ${notif.actionUrl}` : null]
        .filter(Boolean)
        .join("\n\n");
      return await EmailService.send({
        to: row.email,
        subject: `Kiren — ${notif.title}`,
        text: body || notif.title,
        html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px;border:1px solid #e4e4e7;border-radius:12px">
  <h2 style="margin:0 0 8px;font-size:18px">${notif.title}</h2>
  ${notif.body ? `<p style="color:#52525b;line-height:1.6">${notif.body.replace(/</g, "&lt;").replace(/\n/g, "<br/>")}</p>` : ""}
  ${notif.actionUrl ? `<p><a href="${notif.actionUrl}" style="display:inline-block;margin-top:8px;padding:9px 16px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-size:13px">Open in Kiren</a></p>` : ""}
  <p style="margin-top:24px;color:#a1a1aa;font-size:12px">Sent by Kiren · kiren.knr.cl</p>
</div>`,
      });
    } catch (err) {
      console.error("Email notification failed:", err instanceof Error ? err.message : err);
      return false;
    }
  }
}
