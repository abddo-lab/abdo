// server/src/services/notification.ts — Desktop notifications + sound effects + email
import pool from "../db.js";
import { v4 as uuid } from "uuid";
import { EmailService } from "./email.js";

export interface NotificationPayload {
  userId: string;
  type: "deploy" | "thread" | "automation" | "billing" | "mcp" | "workflow" | "error";
  title: string;
  body?: string;
  actionUrl?: string;
}

export class NotificationService {
  /** Create a notification */
  static async create(payload: NotificationPayload): Promise<any> {
    const result = await pool.query(
      `INSERT INTO notifications (id, user_id, type, title, body, action_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [uuid(), payload.userId, payload.type, payload.title, payload.body, payload.actionUrl]
    );

    // Send via WebSocket if user is connected
    this.broadcast(payload.userId, {
      type: "notification",
      data: result.rows[0],
    });

    // Real email notification (AgentMail) — respects the user's prefs
    EmailService.sendNotification(payload.userId, {
      type: payload.type,
      title: payload.title,
      body: payload.body,
      actionUrl: payload.actionUrl,
    }).catch(() => {});

    return result.rows[0];
  }

  /** List user notifications */
  static async list(userId: string, limit = 50): Promise<any[]> {
    const result = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  /** Mark notification as read */
  static async markRead(notificationId: string, userId: string): Promise<void> {
    await pool.query(
      `UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    );
  }

  /** Mark all as read */
  static async markAllRead(userId: string): Promise<void> {
    await pool.query(
      `UPDATE notifications SET read = true WHERE user_id = $1 AND read = false`,
      [userId]
    );
  }

  /** Get unread count */
  static async unreadCount(userId: string): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = false`,
      [userId]
    );
    return parseInt(result.rows[0].count);
  }

  /** Delete old notifications (keep last 100) */
  static async cleanup(userId: string): Promise<void> {
    await pool.query(
      `DELETE FROM notifications WHERE user_id = $1 AND id NOT IN (
         SELECT id FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100
       )`,
      [userId]
    );
  }

  // WebSocket connections (set by the main server)
  private static connections: Map<string, Set<any>> = new Map();

  static addConnection(userId: string, ws: any) {
    if (!this.connections.has(userId)) this.connections.set(userId, new Set());
    this.connections.get(userId)!.add(ws);
    ws.on("close", () => this.connections.get(userId)?.delete(ws));
  }

  static broadcast(userId: string, message: any) {
    const conns = this.connections.get(userId);
    if (!conns) return;
    const data = JSON.stringify(message);
    for (const ws of conns) {
      try { ws.send(data); } catch {}
    }
  }
}
