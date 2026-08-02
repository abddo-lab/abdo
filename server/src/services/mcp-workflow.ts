// server/src/services/mcp-workflow.ts — MCP server for workflow/n8n integration
import pool from "../db.js";
import { v4 as uuid } from "uuid";
import { N8nInstanceService } from "./n8n-instance.js";

export class MCPWorkflowService {
  /** Register a user's n8n instance as an MCP server */
  static async registerAsMcp(userId: string): Promise<any> {
    const instance = await N8nInstanceService.get(userId);
    if (!instance) throw new Error("No n8n instance found");

    // Check if already registered
    const existing = await pool.query(
      `SELECT * FROM mcp_workflows WHERE user_id = $1 AND active = true`,
      [userId]
    );
    if (existing.rows.length > 0) {
      return { ...existing.rows[0], message: "Already registered as MCP" };
    }

    // Also create an MCP server entry for it
    const mcpId = uuid();
    await pool.query(
      `INSERT INTO mcp_servers (id, user_id, name, transport, config, status, tools_count, installed_on_sandbox)
       VALUES ($1, $2, $3, $4, $5, 'connected', $6, true)
       ON CONFLICT (id) DO NOTHING`,
      [mcpId, userId, "kiren-workflow", "http", JSON.stringify({
        builtin: false,
        workflow_mcp: true,
        n8n_url: instance.tunnel_url,
        description: "Manage and execute n8n workflows via MCP"
      }), 5]
    );

    const id = uuid();
    const result = await pool.query(
      `INSERT INTO mcp_workflows (id, user_id, n8n_instance_id, mcp_server_id, name, webhook_url, api_key, config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, userId, instance.id, mcpId, "kiren-workflow", instance.tunnel_url, `n8n_${userId.slice(0, 8)}`, JSON.stringify({ auto_sync: true })]
    );

    return result.rows[0];
  }

  /** Get workflow MCP tools */
  static async getTools(): Promise<any[]> {
    return [
      {
        name: "list_workflows",
        description: "List all workflows in the user's n8n instance",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_workflow",
        description: "Get a specific workflow by ID",
        inputSchema: { type: "object", properties: { workflow_id: { type: "string" } }, required: ["workflow_id"] },
      },
      {
        name: "execute_workflow",
        description: "Execute a workflow with optional data",
        inputSchema: { type: "object", properties: { workflow_id: { type: "string" }, data: { type: "object" } }, required: ["workflow_id"] },
      },
      {
        name: "create_workflow",
        description: "Create a new workflow from JSON",
        inputSchema: { type: "object", properties: { name: { type: "string" }, nodes: { type: "array" }, connections: { type: "object" } }, required: ["name", "nodes", "connections"] },
      },
      {
        name: "update_workflow",
        description: "Update an existing workflow",
        inputSchema: { type: "object", properties: { workflow_id: { type: "string" }, workflow_json: { type: "object" } }, required: ["workflow_id", "workflow_json"] },
      },
    ];
  }

  /** Call a workflow MCP tool */
  static async callTool(userId: string, toolName: string, args: any): Promise<any> {
    const instance = await N8nInstanceService.get(userId);
    if (!instance?.tunnel_url) throw new Error("n8n instance not available");

    const baseUrl = instance.tunnel_url;

    switch (toolName) {
      case "list_workflows": {
        const res = await fetch(`${baseUrl}/rest/workflows`);
        const data = await res.json();
        return { workflows: data.data || [], count: (data.data || []).length };
      }
      case "get_workflow": {
        const res = await fetch(`${baseUrl}/rest/workflows/${args.workflow_id}`);
        return res.json();
      }
      case "execute_workflow": {
        const res = await fetch(`${baseUrl}/rest/workflows/${args.workflow_id}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args.data || {}),
        });
        return res.json();
      }
      case "create_workflow": {
        const workflow = {
          name: args.name,
          nodes: args.nodes,
          connections: args.connections,
          settings: {},
          staticData: null,
          tags: [],
        };
        const res = await fetch(`${baseUrl}/rest/workflows`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(workflow),
        });
        return res.json();
      }
      case "update_workflow": {
        const res = await fetch(`${baseUrl}/rest/workflows/${args.workflow_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args.workflow_json),
        });
        return res.json();
      }
      default:
        throw new Error(`Unknown workflow tool: ${toolName}`);
    }
  }

  /** Parse #mentions in text and return MCP references */
  static parseMentions(text: string): Array<{ type: string; id: string; name: string; raw: string }> {
    const mentions: Array<{ type: string; id: string; name: string; raw: string }> = [];

    // Match #kiren-workflow:<id> and #mcp:<id>
    const workflowRegex = /#kiren-workflow:([a-zA-Z0-9_-]+)/g;
    const mcpRegex = /#mcp:([a-zA-Z0-9_-]+)/g;

    let match;
    while ((match = workflowRegex.exec(text)) !== null) {
      mentions.push({ type: "kiren-workflow", id: match[1], name: `Workflow ${match[1]}`, raw: match[0] });
    }
    while ((match = mcpRegex.exec(text)) !== null) {
      mentions.push({ type: "mcp", id: match[1], name: `MCP ${match[1]}`, raw: match[0] });
    }

    return mentions;
  }

  /** Expand mentions in a message for the AI context */
  static async expandMentions(userId: string, text: string): Promise<{ text: string; context: any[] }> {
    const mentions = this.parseMentions(text);
    const context: any[] = [];

    for (const mention of mentions) {
      if (mention.type === "kiren-workflow") {
        try {
          const wf = await N8nInstanceService.listWorkflows(userId);
          const found = wf.find((w: any) => w.id === mention.id || w.name === mention.id);
          if (found) {
            context.push({
              type: "workflow",
              id: mention.id,
              name: found.name,
              nodes: found.nodes?.length || 0,
              active: found.active,
            });
          }
        } catch { /* ignore */ }
      }
    }

    return { text, context };
  }
}
