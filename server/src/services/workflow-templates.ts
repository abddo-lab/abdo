// server/src/services/workflow-templates.ts — Pre-built n8n workflow templates
import pool from "../db.js";
import { v4 as uuid } from "uuid";

export const DEFAULT_TEMPLATES = [
  {
    id: "tpl-webhook-echo",
    name: "Webhook Echo",
    description: "A simple webhook that echoes back whatever you send it.",
    category: "starter",
    icon: "webhook",
    nodes_count: 2,
    n8n_workflow: {
      name: "Webhook Echo",
      nodes: [
        {
          parameters: { path: "echo", responseMode: "lastNode", options: {} },
          name: "Webhook",
          type: "n8n-nodes-base.webhook",
          typeVersion: 1,
          position: [250, 300],
          webhookId: "echo",
        },
        {
          parameters: { options: {} },
          name: "No Operation, do nothing",
          type: "n8n-nodes-base.noOp",
          typeVersion: 1,
          position: [450, 300],
        },
      ],
      connections: {
        Webhook: { main: [[{ node: "No Operation, do nothing", type: "main", index: 0 }]] },
      },
      settings: {},
      staticData: null,
      tags: [],
    },
  },
  {
    id: "tpl-cron-alert",
    name: "Daily Health Check",
    description: "Runs every hour and pings a URL to check if it's up.",
    category: "monitoring",
    icon: "clock",
    nodes_count: 3,
    n8n_workflow: {
      name: "Daily Health Check",
      nodes: [
        {
          parameters: { rule: { interval: [{ field: "hours", hoursInterval: 1 }] } },
          name: "Cron",
          type: "n8n-nodes-base.cron",
          typeVersion: 1,
          position: [250, 300],
        },
        {
          parameters: { url: "https://httpbin.org/get", options: {} },
          name: "HTTP Request",
          type: "n8n-nodes-base.httpRequest",
          typeVersion: 1,
          position: [450, 300],
        },
        {
          parameters: { options: {} },
          name: "No Operation, do nothing",
          type: "n8n-nodes-base.noOp",
          typeVersion: 1,
          position: [650, 300],
        },
      ],
      connections: {
        Cron: { main: [[{ node: "HTTP Request", type: "main", index: 0 }]] },
        "HTTP Request": { main: [[{ node: "No Operation, do nothing", type: "main", index: 0 }]] },
      },
      settings: {},
      staticData: null,
      tags: [],
    },
  },
  {
    id: "tpl-ai-agent",
    name: "AI Agent Loop",
    description: "An AI agent that receives a prompt and calls an LLM.",
    category: "ai",
    icon: "robot",
    nodes_count: 3,
    n8n_workflow: {
      name: "AI Agent Loop",
      nodes: [
        {
          parameters: { path: "agent", responseMode: "lastNode", options: {} },
          name: "Webhook",
          type: "n8n-nodes-base.webhook",
          typeVersion: 1,
          position: [250, 300],
          webhookId: "agent",
        },
        {
          parameters: {
            model: "gpt-4o-mini",
            options: {},
            messages: { message: [{ role: "user", content: "={{ $json.body.prompt }}" }] },
          },
          name: "OpenAI Chat Model",
          type: "@n8n/n8n-nodes-langchain.lmChatOpenAi",
          typeVersion: 1,
          position: [450, 300],
        },
        {
          parameters: {},
          name: "Agent",
          type: "@n8n/n8n-nodes-langchain.agent",
          typeVersion: 1,
          position: [650, 300],
        },
      ],
      connections: {
        Webhook: { main: [[{ node: "Agent", type: "main", index: 0 }]] },
      },
      settings: {},
      staticData: null,
      tags: [],
    },
  },
  {
    id: "tpl-email-on-event",
    name: "Email on Event",
    description: "Sends an email when a webhook is triggered.",
    category: "notifications",
    icon: "mail",
    nodes_count: 3,
    n8n_workflow: {
      name: "Email on Event",
      nodes: [
        {
          parameters: { path: "notify", responseMode: "lastNode", options: {} },
          name: "Webhook",
          type: "n8n-nodes-base.webhook",
          typeVersion: 1,
          position: [250, 300],
          webhookId: "notify",
        },
        {
          parameters: {
            sendTo: "={{ $json.body.email }}",
            subject: "={{ $json.body.subject }}",
            message: "={{ $json.body.message }}",
            options: {},
          },
          name: "Send Email",
          type: "n8n-nodes-base.emailSend",
          typeVersion: 2,
          position: [450, 300],
        },
        {
          parameters: { options: {} },
          name: "No Operation, do nothing",
          type: "n8n-nodes-base.noOp",
          typeVersion: 1,
          position: [650, 300],
        },
      ],
      connections: {
        Webhook: { main: [[{ node: "Send Email", type: "main", index: 0 }]] },
        "Send Email": { main: [[{ node: "No Operation, do nothing", type: "main", index: 0 }]] },
      },
      settings: {},
      staticData: null,
      tags: [],
    },
  },
  {
    id: "tpl-db-backup",
    name: "Database Backup",
    description: "Backs up a database to S3 on a schedule.",
    category: "devops",
    icon: "database",
    nodes_count: 4,
    n8n_workflow: {
      name: "Database Backup",
      nodes: [
        {
          parameters: { rule: { interval: [{ field: "hours", hoursInterval: 24 }] } },
          name: "Cron",
          type: "n8n-nodes-base.cron",
          typeVersion: 1,
          position: [250, 300],
        },
        {
          parameters: { command: "pg_dump -Fc mydb > /tmp/backup.sql", options: {} },
          name: "Postgres",
          type: "n8n-nodes-base.postgres",
          typeVersion: 1,
          position: [450, 300],
        },
        {
          parameters: { bucketName: "backups", key: "={{ $date.now }}.sql", data: "/tmp/backup.sql" },
          name: "S3",
          type: "n8n-nodes-base.awsS3",
          typeVersion: 1,
          position: [650, 300],
        },
        {
          parameters: { options: {} },
          name: "No Operation, do nothing",
          type: "n8n-nodes-base.noOp",
          typeVersion: 1,
          position: [850, 300],
        },
      ],
      connections: {
        Cron: { main: [[{ node: "Postgres", type: "main", index: 0 }]] },
        Postgres: { main: [[{ node: "S3", type: "main", index: 0 }]] },
        S3: { main: [[{ node: "No Operation, do nothing", type: "main", index: 0 }]] },
      },
      settings: {},
      staticData: null,
      tags: [],
    },
  },
];

export class WorkflowTemplateService {
  /** Seed default templates idempotently */
  static async seedDefaults(): Promise<void> {
    for (const tpl of DEFAULT_TEMPLATES) {
      await pool.query(
        `INSERT INTO workflow_templates (id, name, description, category, icon, n8n_workflow, nodes_count, is_public)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           category = EXCLUDED.category,
           icon = EXCLUDED.icon,
           n8n_workflow = EXCLUDED.n8n_workflow,
           nodes_count = EXCLUDED.nodes_count`,
        [tpl.id, tpl.name, tpl.description, tpl.category, tpl.icon, JSON.stringify(tpl.n8n_workflow), tpl.nodes_count]
      );
    }
  }

  static async list(category?: string): Promise<any[]> {
    if (category) {
      const result = await pool.query(
        `SELECT * FROM workflow_templates WHERE category = $1 AND is_public = true ORDER BY created_at DESC`,
        [category]
      );
      return result.rows;
    }
    const result = await pool.query(`SELECT * FROM workflow_templates WHERE is_public = true ORDER BY created_at DESC`);
    return result.rows;
  }

  static async get(id: string): Promise<any | null> {
    const result = await pool.query(`SELECT * FROM workflow_templates WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  static async create(data: any): Promise<any> {
    const id = uuid();
    const result = await pool.query(
      `INSERT INTO workflow_templates (id, name, description, category, icon, n8n_workflow, nodes_count, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, data.name, data.description, data.category || 'general', data.icon || 'workflow', JSON.stringify(data.n8n_workflow), data.nodes_count || 0, data.is_public !== false]
    );
    return result.rows[0];
  }

  static async delete(id: string): Promise<void> {
    await pool.query(`DELETE FROM workflow_templates WHERE id = $1`, [id]);
  }
}
