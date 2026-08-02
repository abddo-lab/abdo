// server/src/services/smtp-addon.ts — Per-user SMTP via the shared AgentMail account
import { EmailService } from "./email.js";
import pool from "../db.js";
import { v4 as uuid } from "uuid";
import { loadConfig } from "../config.js";

export class SMTPAddonService {
  /** Generate or reuse a per-user SMTP config backed by the shared AgentMail account */
  static async generateSMTP(userId: string): Promise<any> {
    const existing = await pool.query(
      `SELECT * FROM smtp_configs WHERE user_id = $1 AND active = true`,
      [userId]
    );

    if (existing.rows.length > 0) {
      return { smtp: this.mask(existing.rows[0]), message: "SMTP already configured" };
    }

    const config = loadConfig();
    const smtpId = uuid();
    const baseEmail = (config.agentmail?.from_inbox || "kiren-labs@agentmail.to").split("@")[0];
    const smtpUser = `${baseEmail}+${userId.slice(0, 8)}`;
    const fromEmail = `${smtpUser}@agentmail.to`;
    const smtpHost = "smtp.agentmail.to";
    const smtpPort = 587;
    const apiKey = config.agentmail?.api_key || "agentmail-placeholder";

    const result = await pool.query(
      `INSERT INTO smtp_configs (id, user_id, smtp_host, smtp_port, smtp_user, smtp_pass, from_email, api_key, requests_used, requests_limit, cost_per_1k)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 1000, 0.10)
       RETURNING *`,
      [smtpId, userId, smtpHost, smtpPort, smtpUser, "agentmail-managed", fromEmail, apiKey]
    );

    await pool.query(
      `INSERT INTO user_addons (id, user_id, addon_type, config)
       VALUES ($1, $2, 'smtp', $3)
       ON CONFLICT DO NOTHING`,
      [uuid(), userId, JSON.stringify({ smtp_id: smtpId, provider: "agentmail", user_alias: smtpUser })]
    );

    return { smtp: this.mask(result.rows[0]), message: "SMTP generated successfully" };
  }

  /** Get the user's SMTP config (masked) */
  static async getSMTP(userId: string): Promise<any | null> {
    const result = await pool.query(
      `SELECT * FROM smtp_configs WHERE user_id = $1 AND active = true`,
      [userId]
    );
    return result.rows.length > 0 ? this.mask(result.rows[0]) : null;
  }

  /** Track an SMTP request and bill per-1k */
  static async trackRequest(userId: string, feature: string = "smtp_send"): Promise<{ allowed: boolean; remaining: number; cost: number }> {
    const smtp = await pool.query(`SELECT * FROM smtp_configs WHERE user_id = $1 AND active = true`, [userId]);
    if (smtp.rows.length === 0) return { allowed: false, remaining: 0, cost: 0 };

    const cfg = smtp.rows[0];
    const newUsed = (cfg.requests_used || 0) + 1;
    const limit = cfg.requests_limit || 1000;
    const costPer1k = Number(cfg.cost_per_1k || 0.10);

    await pool.query(
      `UPDATE smtp_configs SET requests_used = $1, updated_at = NOW() WHERE id = $2`,
      [newUsed, cfg.id]
    );

    if (newUsed % 1000 === 0) {
      const cost = costPer1k;
      await pool.query(
        `INSERT INTO addon_usage (id, user_id, addon_type, feature, requests, cost)
         VALUES ($1, $2, 'smtp', $3, 1000, $4)`,
        [uuid(), userId, feature, cost]
      );
      await pool.query(
        `UPDATE users SET balance = GREATEST(0, balance - $1), updated_at = NOW() WHERE id = $2`,
        [cost, userId]
      );
    }

    return { allowed: newUsed <= limit, remaining: Math.max(0, limit - newUsed), cost: Math.floor(newUsed / 1000) * costPer1k };
  }

  /** Send email via the shared AgentMail account */
  static async sendEmail(userId: string, to: string, subject: string, body: string, html?: string): Promise<{ sent: boolean; message: string; usage: any }> {
    const track = await this.trackRequest(userId, "smtp_send");
    if (!track.allowed) {
      return { sent: false, message: `SMTP limit reached. Remaining: ${track.remaining}`, usage: track };
    }

    const cfg = await pool.query(`SELECT * FROM smtp_configs WHERE user_id = $1 AND active = true`, [userId]);
    if (cfg.rows.length === 0) return { sent: false, message: "No SMTP configured", usage: track };

    const sent = await EmailService.send({
      to,
      subject,
      text: body,
      html,
      fromInbox: cfg.rows[0].from_email,
    });

    return {
      sent,
      message: sent ? `Email sent via your AgentMail SMTP. Remaining: ${track.remaining}` : "Email delivery failed",
      usage: {
        used: (cfg.rows[0].requests_used || 0) + 1,
        limit: cfg.rows[0].requests_limit || 1000,
        remaining: Math.max(0, (cfg.rows[0].requests_limit || 1000) - ((cfg.rows[0].requests_used || 0) + 1)),
        cost: track.cost,
      },
    };
  }

  /** Revoke SMTP */
  static async revokeSMTP(userId: string): Promise<void> {
    await pool.query(`UPDATE smtp_configs SET active = false WHERE user_id = $1`, [userId]);
    await pool.query(`UPDATE user_addons SET active = false WHERE user_id = $1 AND addon_type = 'smtp'`, [userId]);
  }

  private static mask(row: any): any {
    return {
      id: row.id,
      smtp_host: row.smtp_host,
      smtp_port: row.smtp_port,
      smtp_user: row.smtp_user,
      smtp_pass: "••••••••••••",
      from_email: row.from_email,
      requests_used: row.requests_used,
      requests_limit: row.requests_limit,
      cost_per_1k: row.cost_per_1k,
      active: row.active,
      provider: "agentmail",
    };
  }
}
