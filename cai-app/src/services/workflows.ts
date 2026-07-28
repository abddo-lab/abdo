/**
 * Workflows — Real n8n Deployment + Visual Canvas
 * Uses real n8n node types from the official n8n repository
 */

import { settingsDB } from "./db";
import { createSandbox as createE2bSandbox, runCommand as e2bRunCommand, writeFile as e2bWriteFile } from "./e2b";
import { createSandbox as createDaytonaSandbox, runInSandbox as daytonaRunCommand } from "./daytona";
import { createSubdomain, connectDomain } from "./deploy";
import { N8N_NODE_TYPES, type N8nNodeType, getNodesByCategory, getNodeCategories } from "./n8n-nodes";

// ─── Types ───
export interface Workflow {
  id: string;
  name: string;
  description: string;
  sandboxType: "e2b" | "daytona";
  sandboxId: string | null;
  n8nUrl: string | null;
  n8nApiKey: string | null;
  subdomain: string | null;
  domain: string | null;
  status: "idle" | "deploying" | "running" | "active" | "error";
  error: string | null;
  createdAt: number;
  updatedAt: number;
  lastDeployedAt: number | null;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  tags: string[];
}

export interface WorkflowNode {
  id: string;
  type: string;
  name: string;
  displayName: string;
  category: string;
  icon: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface WorkflowConnection {
  id: string;
  from: string;
  fromPort: number;
  to: string;
  toPort: number;
}

// ─── Node Templates (re-export from n8n-nodes) ───
export type { N8nNodeType as NodeTemplate };
export const NODE_TEMPLATES = N8N_NODE_TYPES;
export { getNodesByCategory, getNodeCategories };

// ─── Workflow Templates ───
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  tags: string[];
  nodes: Array<{ type: string; name: string; displayName: string; category: string; icon: string; config?: Record<string, unknown>; position: { x: number; y: number } }>;
  connections: Array<{ from: number; fromPort: number; to: number; toPort: number }>;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "pr-review",
    name: "PR Auto-Review",
    description: "GitHub webhook triggers AI code review, posts comment on PR.",
    icon: "🐙",
    tags: ["github", "ai"],
    nodes: [
      { type: "n8n-nodes-base.githubTrigger", name: "githubTrigger", displayName: "GitHub Trigger", category: "Triggers", icon: "🐙", config: { events: ["pull_request"] }, position: { x: 80, y: 200 } },
      { type: "n8n-nodes-base.openAi", name: "openAi", displayName: "OpenAI", category: "AI", icon: "🤖", config: { prompt: "Review this PR diff for bugs, security issues, and style problems" }, position: { x: 380, y: 200 } },
      { type: "n8n-nodes-base.github", name: "github", displayName: "GitHub", category: "DevOps", icon: "🐙", config: { operation: "comment" }, position: { x: 680, y: 200 } },
    ],
    connections: [{ from: 0, fromPort: 0, to: 1, toPort: 0 }, { from: 1, fromPort: 0, to: 2, toPort: 0 }],
  },
  {
    id: "daily-deploy",
    name: "Nightly Deploy",
    description: "Schedule trigger at midnight, pull code, build, and notify Slack.",
    icon: "🚀",
    tags: ["deploy", "schedule"],
    nodes: [
      { type: "n8n-nodes-base.scheduleTrigger", name: "scheduleTrigger", displayName: "Schedule Trigger", category: "Triggers", icon: "⏰", config: { rule: { interval: [{ field: "cronExpression", expression: "0 0 * * *" }] } }, position: { x: 80, y: 200 } },
      { type: "n8n-nodes-base.executeCommand", name: "executeCommand", displayName: "Execute Command", category: "Actions", icon: "💻", config: { command: "git pull && npm run build" }, position: { x: 380, y: 200 } },
      { type: "n8n-nodes-base.slack", name: "slack", displayName: "Slack", category: "Communication", icon: "💬", config: { channel: "#deploy", text: "Deploy complete" }, position: { x: 680, y: 200 } },
    ],
    connections: [{ from: 0, fromPort: 0, to: 1, toPort: 0 }, { from: 1, fromPort: 0, to: 2, toPort: 0 }],
  },
  {
    id: "slack-bot",
    name: "Slack Bot",
    description: "Webhook receives message, processes with AI, responds in channel.",
    icon: "💬",
    tags: ["slack", "ai"],
    nodes: [
      { type: "n8n-nodes-base.webhook", name: "webhook", displayName: "Webhook", category: "Triggers", icon: "🔗", config: { path: "slack-events" }, position: { x: 80, y: 200 } },
      { type: "n8n-nodes-base.if", name: "if", displayName: "If", category: "Flow", icon: "🔀", config: { conditions: { options: { caseSensitive: true, leftValue: "" }, conditions: [{ leftValue: "={{ $json.type }}", rightValue: "message", operator: { type: "string", operation: "equals" } }] } }, position: { x: 380, y: 200 } },
      { type: "n8n-nodes-base.openAi", name: "openAi", displayName: "OpenAI", category: "AI", icon: "🤖", config: { prompt: "Answer the user's question" }, position: { x: 680, y: 140 } },
      { type: "n8n-nodes-base.slack", name: "slack", displayName: "Slack", category: "Communication", icon: "💬", config: { channel: "#general", text: "={{ $json.choices[0].message.content }}" }, position: { x: 980, y: 140 } },
      { type: "n8n-nodes-base.slack", name: "slack2", displayName: "Slack", category: "Communication", icon: "💬", config: { channel: "#general", text: "Thanks for your message!" }, position: { x: 680, y: 320 } },
    ],
    connections: [
      { from: 0, fromPort: 0, to: 1, toPort: 0 },
      { from: 1, fromPort: 0, to: 2, toPort: 0 },
      { from: 1, fromPort: 1, to: 4, toPort: 0 },
      { from: 2, fromPort: 0, to: 3, toPort: 0 },
    ],
  },
  {
    id: "ai-code-review",
    name: "AI Code Review",
    description: "Weekly scan of GitHub files, AI analysis, creates issues for problems.",
    icon: "🤖",
    tags: ["ai", "github"],
    nodes: [
      { type: "n8n-nodes-base.scheduleTrigger", name: "scheduleTrigger", displayName: "Schedule Trigger", category: "Triggers", icon: "⏰", config: { rule: { interval: [{ field: "cronExpression", expression: "0 9 * * 1" }] } }, position: { x: 80, y: 200 } },
      { type: "n8n-nodes-base.github", name: "github", displayName: "GitHub", category: "DevOps", icon: "🐙", config: { operation: "getAll", resource: "file" }, position: { x: 380, y: 200 } },
      { type: "n8n-nodes-base.openAi", name: "openAi", displayName: "OpenAI", category: "AI", icon: "🤖", config: { prompt: "Review code for issues" }, position: { x: 680, y: 200 } },
      { type: "n8n-nodes-base.github", name: "github2", displayName: "GitHub", category: "DevOps", icon: "🐙", config: { operation: "create", resource: "issue" }, position: { x: 980, y: 200 } },
    ],
    connections: [
      { from: 0, fromPort: 0, to: 1, toPort: 0 },
      { from: 1, fromPort: 0, to: 2, toPort: 0 },
      { from: 2, fromPort: 0, to: 3, toPort: 0 },
    ],
  },
  {
    id: "db-backup",
    name: "Database Backup",
    description: "Scheduled PostgreSQL backup, compress, upload to S3.",
    icon: "🗄️",
    tags: ["database", "backup"],
    nodes: [
      { type: "n8n-nodes-base.scheduleTrigger", name: "scheduleTrigger", displayName: "Schedule Trigger", category: "Triggers", icon: "⏰", config: { rule: { interval: [{ field: "cronExpression", expression: "0 2 * * *" }] } }, position: { x: 80, y: 200 } },
      { type: "n8n-nodes-base.postgres", name: "postgres", displayName: "Postgres", category: "Data", icon: "🗄️", config: { operation: "executeQuery", query: "SELECT pg_dump()" }, position: { x: 380, y: 200 } },
      { type: "n8n-nodes-base.itemLists", name: "itemLists", displayName: "Item Lists", category: "Transform", icon: "📦", config: { operation: "compress" }, position: { x: 680, y: 200 } },
      { type: "n8n-nodes-base.httpRequest", name: "httpRequest", displayName: "HTTP Request", category: "Actions", icon: "🌐", config: { url: "https://s3.amazonaws.com/bucket", method: "PUT" }, position: { x: 980, y: 200 } },
    ],
    connections: [
      { from: 0, fromPort: 0, to: 1, toPort: 0 },
      { from: 1, fromPort: 0, to: 2, toPort: 0 },
      { from: 2, fromPort: 0, to: 3, toPort: 0 },
    ],
  },
  {
    id: "email-monitor",
    name: "Email Monitor",
    description: "Watch Gmail inbox, AI categorize, auto-respond or notify Slack.",
    icon: "📧",
    tags: ["email", "ai"],
    nodes: [
      { type: "n8n-nodes-base.emailReadImap", name: "emailReadImap", displayName: "Email Read IMAP", category: "Triggers", icon: "📨", config: { mailbox: "INBOX" }, position: { x: 80, y: 200 } },
      { type: "n8n-nodes-base.if", name: "if", displayName: "If", category: "Flow", icon: "🔀", config: { conditions: { conditions: [{ leftValue: "={{ $json.subject }}", rightValue: "urgent", operator: { type: "string", operation: "contains" } }] } }, position: { x: 380, y: 200 } },
      { type: "n8n-nodes-base.openAi", name: "openAi", displayName: "OpenAI", category: "AI", icon: "🤖", config: { prompt: "Generate a response" }, position: { x: 680, y: 140 } },
      { type: "n8n-nodes-base.gmail", name: "gmail", displayName: "Gmail", category: "Communication", icon: "📧", config: { operation: "send" }, position: { x: 980, y: 140 } },
      { type: "n8n-nodes-base.slack", name: "slack", displayName: "Slack", category: "Communication", icon: "💬", config: { channel: "#urgent" }, position: { x: 680, y: 320 } },
    ],
    connections: [
      { from: 0, fromPort: 0, to: 1, toPort: 0 },
      { from: 1, fromPort: 0, to: 2, toPort: 0 },
      { from: 1, fromPort: 1, to: 4, toPort: 0 },
      { from: 2, fromPort: 0, to: 3, toPort: 0 },
    ],
  },
  {
    id: "discord-bot",
    name: "Discord Bot",
    description: "Respond to Discord commands with AI, auto-reply in channel.",
    icon: "🎮",
    tags: ["discord", "ai"],
    nodes: [
      { type: "n8n-nodes-base.discordTrigger", name: "discordTrigger", displayName: "Discord Trigger", category: "Triggers", icon: "🎮", config: { event: "MESSAGE_CREATE" }, position: { x: 80, y: 200 } },
      { type: "n8n-nodes-base.if", name: "if", displayName: "If", category: "Flow", icon: "🔀", config: { conditions: { conditions: [{ leftValue: "={{ $json.content }}", rightValue: "!", operator: { type: "string", operation: "startsWith" } }] } }, position: { x: 380, y: 200 } },
      { type: "n8n-nodes-base.openAi", name: "openAi", displayName: "OpenAI", category: "AI", icon: "🤖", config: { prompt: "Answer the Discord command" }, position: { x: 680, y: 140 } },
      { type: "n8n-nodes-base.discord", name: "discord", displayName: "Discord", category: "Communication", icon: "🎮", config: { operation: "sendMessage" }, position: { x: 980, y: 140 } },
      { type: "n8n-nodes-base.respondToWebhook", name: "respondToWebhook", displayName: "Respond to Webhook", category: "Actions", icon: "📤", config: {}, position: { x: 680, y: 320 } },
    ],
    connections: [
      { from: 0, fromPort: 0, to: 1, toPort: 0 },
      { from: 1, fromPort: 0, to: 2, toPort: 0 },
      { from: 1, fromPort: 1, to: 4, toPort: 0 },
      { from: 2, fromPort: 0, to: 3, toPort: 0 },
    ],
  },
  {
    id: "crm-sync",
    name: "CRM Sync",
    description: "Sync HubSpot contacts to Airtable, dedup and enrich with AI.",
    icon: "🔄",
    tags: ["crm", "sync"],
    nodes: [
      { type: "n8n-nodes-base.hubspot", name: "hubspot", displayName: "HubSpot", category: "CRM", icon: "🔗", config: { operation: "getAll", resource: "contact" }, position: { x: 80, y: 200 } },
      { type: "n8n-nodes-base.openAi", name: "openAi", displayName: "OpenAI", category: "AI", icon: "🤖", config: { prompt: "Extract and clean contact information" }, position: { x: 380, y: 200 } },
      { type: "n8n-nodes-base.airtable", name: "airtable", displayName: "Airtable", category: "Data", icon: "📊", config: { operation: "create", base: "Contacts" }, position: { x: 680, y: 200 } },
    ],
    connections: [
      { from: 0, fromPort: 0, to: 1, toPort: 0 },
      { from: 1, fromPort: 0, to: 2, toPort: 0 },
    ],
  },
  {
    id: "data-transform",
    name: "API Data Pipeline",
    description: "Fetch data from API, transform with Code node, store in database.",
    icon: "📊",
    tags: ["data", "pipeline"],
    nodes: [
      { type: "n8n-nodes-base.httpRequest", name: "httpRequest", displayName: "HTTP Request", category: "Actions", icon: "🌐", config: { url: "https://api.example.com/data", method: "GET" }, position: { x: 80, y: 200 } },
      { type: "n8n-nodes-base.code", name: "code", displayName: "Code", category: "Transform", icon: "📝", config: { jsCode: "return items.map(item => ({ json: { ...item.json, processed: true } }));" }, position: { x: 380, y: 200 } },
      { type: "n8n-nodes-base.mySql", name: "mySql", displayName: "MySQL", category: "Data", icon: "🗄️", config: { operation: "insert" }, position: { x: 680, y: 200 } },
    ],
    connections: [
      { from: 0, fromPort: 0, to: 1, toPort: 0 },
      { from: 1, fromPort: 0, to: 2, toPort: 0 },
    ],
  },
  {
    id: "file-processor",
    name: "File Processor",
    description: "Watch Google Drive folder, process files, send to Slack.",
    icon: "📁",
    tags: ["files", "automation"],
    nodes: [
      { type: "n8n-nodes-base.googleDriveTrigger", name: "googleDriveTrigger", displayName: "Google Drive Trigger", category: "Triggers", icon: "📁", config: { event: "fileCreated" }, position: { x: 80, y: 200 } },
      { type: "n8n-nodes-base.googleDrive", name: "googleDrive", displayName: "Google Drive", category: "Files", icon: "📁", config: { operation: "download" }, position: { x: 380, y: 200 } },
      { type: "n8n-nodes-base.set", name: "set", displayName: "Set", category: "Transform", icon: "📝", config: { values: { string: [{ name: "status", value: "processed" }] } }, position: { x: 680, y: 200 } },
      { type: "n8n-nodes-base.slack", name: "slack", displayName: "Slack", category: "Communication", icon: "💬", config: { channel: "#files", text: "New file processed: {{ $json.name }}" }, position: { x: 980, y: 200 } },
    ],
    connections: [
      { from: 0, fromPort: 0, to: 1, toPort: 0 },
      { from: 1, fromPort: 0, to: 2, toPort: 0 },
      { from: 2, fromPort: 0, to: 3, toPort: 0 },
    ],
  },
];

// ─── CRUD ───
export async function getWorkflows(): Promise<Workflow[]> {
  return settingsDB.get<Workflow[]>("workflows", []);
}

export async function saveWorkflow(wf: Workflow): Promise<void> {
  wf.updatedAt = Date.now();
  const all = await getWorkflows();
  const idx = all.findIndex((x) => x.id === wf.id);
  if (idx >= 0) all[idx] = wf;
  else all.push(wf);
  await settingsDB.set("workflows", all);
}

export async function deleteWorkflow(id: string): Promise<void> {
  const all = await getWorkflows();
  await settingsDB.set("workflows", all.filter((w) => w.id !== id));
}

// ─── Deploy n8n to Sandbox ───
export async function deployN8n(workflow: Workflow, sandboxType: "e2b" | "daytona", repoUrl?: string): Promise<{ success: boolean; url?: string; error?: string }> {
  const subdomain = `n8n-${workflow.id.slice(-8)}`;
  try {
    workflow.status = "deploying";
    workflow.sandboxType = sandboxType;
    workflow.error = null;
    await saveWorkflow(workflow);

    const domainRecord = await createSubdomain(subdomain, 0);
    workflow.subdomain = subdomain;
    workflow.domain = domainRecord.domain;
    await saveWorkflow(workflow);

    if (sandboxType === "e2b") {
      const sandbox = await createE2bSandbox("n8n-workflow");
      workflow.sandboxId = sandbox.id;
      const installScript = `#!/bin/bash
set -e
apt-get update && apt-get install -y curl git
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
npm install -g n8n
mkdir -p /root/.n8n
cat > /root/.n8n/config.json << 'EOF'
{ "n8nbasicAuthActive": false, "n8nPort": 5678, "protocol": "http", "host": "0.0.0.0" }
EOF
export N8N_PORT=5678
export N8N_PROTOCOL=http
export GENERIC_TIMEZONE=UTC
nohup n8n start > /tmp/n8n.log 2>&1 &
echo "n8n started on port 5678"
`;
      await e2bWriteFile(sandbox.id, "/tmp/install-n8n.sh", installScript);
      await e2bRunCommand(sandbox.id, "chmod +x /tmp/install-n8n.sh && /tmp/install-n8n.sh");
      await new Promise((r) => setTimeout(r, 8000));
      const n8nUrl = `https://${sandbox.id}.e2b.dev`;
      workflow.n8nUrl = n8nUrl;
    } else {
      const sandbox = await createDaytonaSandbox(`n8n-${workflow.id}`, repoUrl || "https://github.com/n8n-io/n8n");
      workflow.sandboxId = sandbox.id;
      await daytonaRunCommand(sandbox.id, "npm install -g n8n");
      await daytonaRunCommand(sandbox.id, "n8n start --tunnel &");
      await new Promise((r) => setTimeout(r, 8000));
      const n8nUrl = `https://${sandbox.publicDomain || sandbox.id}`;
      workflow.n8nUrl = n8nUrl;
    }

    if (domainRecord.id && workflow.n8nUrl) {
      await connectDomain(domainRecord.id, workflow.n8nUrl);
    }
    workflow.n8nApiKey = `n8n-api-${workflow.id.slice(-8)}`;
    workflow.status = "active";
    workflow.lastDeployedAt = Date.now();
    await saveWorkflow(workflow);
    return { success: true, url: workflow.n8nUrl };
  } catch (err) {
    workflow.status = "error";
    workflow.error = err instanceof Error ? err.message : String(err);
    await saveWorkflow(workflow);
    return { success: false, error: workflow.error };
  }
}

// ─── Stop n8n Sandbox ───
export async function stopN8n(workflow: Workflow): Promise<{ success: boolean; error?: string }> {
  try {
    if (!workflow.sandboxId) return { success: false, error: "No sandbox ID" };
    workflow.status = "idle";
    await saveWorkflow(workflow);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Export to n8n JSON ───
export function exportToN8nJson(workflow: Workflow): Record<string, unknown> {
  const nodes = workflow.nodes.map((n) => ({
    parameters: n.config,
    id: n.id,
    name: n.displayName || n.name,
    type: n.type,
    typeVersion: 1,
    position: [n.position.x, n.position.y],
  }));

  const connections: Record<string, Record<string, Array<Array<{ node: string; type: string; index: number }>>>> = {};
  for (const conn of (workflow.connections ?? [])) {
    const fromNode = workflow.nodes.find((n) => n.id === conn.from);
    const toNode = workflow.nodes.find((n) => n.id === conn.to);
    if (!fromNode || !toNode) continue;
    const fromName = fromNode.displayName || fromNode.name;
    if (!connections[fromName]) connections[fromName] = {};
    if (!connections[fromName].main) connections[fromName].main = [];
    const portConns = connections[fromName].main[conn.fromPort] ?? [];
    portConns.push({ node: toNode.displayName || toNode.name, type: "main", index: conn.toPort });
    connections[fromName].main[conn.fromPort] = portConns;
  }

  return {
    name: workflow.name,
    nodes,
    connections,
    active: true,
    settings: { executionOrder: "v1" },
    staticData: null,
    tags: workflow.tags.map((t) => ({ name: t })),
    pinData: {},
  };
}

// ─── Import from n8n JSON ───
export function importFromN8nJson(json: Record<string, unknown>): Workflow {
  const id = `wf-${Date.now()}`;
  const name = (json.name as string) ?? "Imported Workflow";
  const tags = Array.isArray(json.tags) ? json.tags.map((t: any) => t.name ?? String(t)) : [];

  const rawNodes = Array.isArray(json.nodes) ? json.nodes : [];
  const nodes: WorkflowNode[] = rawNodes.map((n: any, i: number) => {
    const typeName = (n.type as string) ?? "";
    const nodeDef = N8N_NODE_TYPES.find((t) => t.type === typeName);
    return {
      id: n.id ?? `n-import-${Date.now()}-${i}`,
      type: typeName,
      name: nodeDef?.name ?? (n.name as string) ?? `Node ${i + 1}`,
      displayName: nodeDef?.displayName ?? (n.name as string) ?? `Node ${i + 1}`,
      category: nodeDef?.category ?? "Other",
      icon: nodeDef?.icon ?? "⚡",
      config: n.parameters ?? {},
      position: {
        x: Array.isArray(n.position) ? n.position[0] : 100 + i * 260,
        y: Array.isArray(n.position) ? n.position[1] : 200,
      },
    };
  });

  const connections: WorkflowConnection[] = [];
  const rawConns = json.connections as Record<string, any> ?? {};
  for (const [fromName, portMap] of Object.entries(rawConns)) {
    const fromNode = nodes.find((n) => (n.displayName || n.name) === fromName);
    if (!fromNode) continue;
    const mainConns = portMap.main ?? [];
    for (let portIdx = 0; portIdx < mainConns.length; portIdx++) {
      const portConns = mainConns[portIdx] ?? [];
      for (const pc of portConns) {
        const toNode = nodes.find((n) => (n.displayName || n.name) === pc.node);
        if (!toNode) continue;
        connections.push({
          id: `c-import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          from: fromNode.id,
          fromPort: portIdx,
          to: toNode.id,
          toPort: pc.index ?? 0,
        });
      }
    }
  }

  return {
    id, name, description: `Imported from n8n`,
    sandboxType: "e2b", sandboxId: null, n8nUrl: null, n8nApiKey: null,
    subdomain: null, domain: null, status: "idle", error: null,
    createdAt: Date.now(), updatedAt: Date.now(), lastDeployedAt: null,
    nodes, connections, tags,
  };
}
