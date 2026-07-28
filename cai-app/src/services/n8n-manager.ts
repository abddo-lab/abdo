/**
 * N8N Instance Manager — one N8N instance per user
 * Custom branded N8N with AI connected to our API
 */

import { n8nInstancesDB, workflowsDB, usageDB, type N8nInstanceRecord, type WorkflowRecord } from "./db";
import { chatCompletion, type ChatMessage } from "./api";

// ─── Types ───
export interface N8nInstance {
  id: string;
  userId: string;
  workflowName: string;
  slug: string;
  status: "creating" | "running" | "stopped" | "error";
  port: number;
  apiUrl: string;
  apiKey: string | null;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number | null;
  error: string | null;
}

export interface Workflow {
  id: string;
  instanceId: string;
  name: string;
  slug: string;
  description: string;
  n8nWorkflowId: string | null;
  status: "draft" | "active" | "paused" | "error";
  createdAt: number;
  updatedAt: number;
  lastRunAt: number | null;
  runCount: number;
  error: string | null;
}

// ─── Instance Management ───
const INSTANCE_BASE_PORT = 5678;
const MAX_INSTANCES = 100;

export const n8nManager = {
  // Create a new N8N instance for a user
  async createInstance(userId: string, workflowName: string): Promise<N8nInstance> {
    const existing = await this.getUserInstance(userId);
    if (existing) {
      throw new Error("User already has an N8N instance. Each user gets one instance.");
    }

    const slug = this.createSlug(workflowName);
    const port = await this.getNextPort();
    const instanceId = `n8n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const instanceRecord: N8nInstanceRecord = {
      id: instanceId,
      userId,
      workflowName,
      slug,
      status: "creating",
      port,
      apiUrl: `http://localhost:${port}`,
      apiKey: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: null,
      error: null,
    };

    // Store instance
    await n8nInstancesDB.put(instanceRecord);

    // Start N8N instance in background
    this.startInstance(this.recordToInstance(instanceRecord)).catch((err) => {
      console.error("Failed to start N8N instance:", err);
      this.updateInstance(instanceId, { status: "error", error: String(err) });
    });

    return this.recordToInstance(instanceRecord);
  },

  // Get user's N8N instance
  async getUserInstance(userId: string): Promise<N8nInstance | null> {
    const record = await n8nInstancesDB.getByUser(userId);
    return record ? this.recordToInstance(record) : null;
  },

  // Get instance by ID
  async getInstance(instanceId: string): Promise<N8nInstance | null> {
    const record = await n8nInstancesDB.get(instanceId);
    return record ? this.recordToInstance(record) : null;
  },

  // Get all instances
  async getAllInstances(): Promise<N8nInstance[]> {
    const records = await n8nInstancesDB.getAll();
    return records.map(this.recordToInstance);
  },

  // Update instance
  async updateInstance(instanceId: string, updates: Partial<N8nInstance>): Promise<void> {
    const record = await n8nInstancesDB.get(instanceId);
    if (!record) return;

    const updated: N8nInstanceRecord = {
      ...record,
      ...updates,
      updatedAt: Date.now(),
    };

    await n8nInstancesDB.put(updated);
  },

  // Convert record to instance
  recordToInstance(record: N8nInstanceRecord): N8nInstance {
    return {
      id: record.id,
      userId: record.userId,
      workflowName: record.workflowName,
      slug: record.slug,
      status: record.status,
      port: record.port,
      apiUrl: record.apiUrl,
      apiKey: record.apiKey,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastAccessedAt: record.lastAccessedAt,
      error: record.error,
    };
  },

  // Start N8N instance
  async startInstance(instance: N8nInstance): Promise<void> {
    try {
      // In production, this would start a Docker container or process
      // For now, we'll simulate the startup
      await this.updateInstance(instance.id, { status: "running" });

      // Generate API key for the instance
      const apiKey = this.generateApiKey();
      await this.updateInstance(instance.id, { apiKey });

      console.log(`N8N instance ${instance.id} started on port ${instance.port}`);
    } catch (err) {
      await this.updateInstance(instance.id, { status: "error", error: String(err) });
      throw err;
    }
  },

  // Stop N8N instance
  async stopInstance(instanceId: string): Promise<void> {
    await this.updateInstance(instanceId, { status: "stopped" });
  },

  // Delete N8N instance
  async deleteInstance(userId: string): Promise<void> {
    const instance = await this.getUserInstance(userId);
    if (!instance) return;

    // Stop instance if running
    if (instance.status === "running") {
      await this.stopInstance(instance.id);
    }

    // Delete all workflows for this instance
    const workflows = await workflowsDB.getByInstance(instance.id);
    for (const wf of workflows) {
      await workflowsDB.delete(wf.id);
    }

    // Delete instance
    await n8nInstancesDB.delete(instance.id);
  },

  // Get next available port
  async getNextPort(): Promise<number> {
    const instances = await this.getAllInstances();
    const usedPorts = new Set(instances.map((i) => i.port));
    let port = INSTANCE_BASE_PORT;
    while (usedPorts.has(port) && port < INSTANCE_BASE_PORT + MAX_INSTANCES) {
      port++;
    }
    return port;
  },

  // Create URL-friendly slug
  createSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
  },

  // Generate API key
  generateApiKey(): string {
    return `n8n_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  },
};

// ─── Workflow Management ───
export const workflowManager = {
  // Create a new workflow
  async createWorkflow(instanceId: string, name: string, description: string = ""): Promise<Workflow> {
    const slug = n8nManager.createSlug(name);
    const workflowRecord: WorkflowRecord = {
      id: `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      instanceId,
      name,
      slug,
      description,
      n8nWorkflowId: null,
      status: "draft",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastRunAt: null,
      runCount: 0,
      error: null,
    };

    // Store workflow
    await workflowsDB.put(workflowRecord);

    return this.recordToWorkflow(workflowRecord);
  },

  // Get workflows for an instance
  async getWorkflows(instanceId: string): Promise<Workflow[]> {
    const records = await workflowsDB.getByInstance(instanceId);
    return records.map(this.recordToWorkflow);
  },

  // Get workflow by slug (for public URL)
  async getWorkflowBySlug(instanceId: string, slug: string): Promise<Workflow | null> {
    const workflows = await this.getWorkflows(instanceId);
    return workflows.find((w) => w.slug === slug) ?? null;
  },

  // Get workflow by ID
  async getWorkflow(workflowId: string): Promise<Workflow | null> {
    const record = await workflowsDB.get(workflowId);
    return record ? this.recordToWorkflow(record) : null;
  },

  // Update workflow
  async updateWorkflow(workflowId: string, updates: Partial<Workflow>): Promise<void> {
    const record = await workflowsDB.get(workflowId);
    if (!record) return;

    const updated: WorkflowRecord = {
      ...record,
      ...updates,
      updatedAt: Date.now(),
    };

    await workflowsDB.put(updated);
  },

  // Delete workflow
  async deleteWorkflow(workflowId: string): Promise<void> {
    await workflowsDB.delete(workflowId);
  },

  // Convert record to workflow
  recordToWorkflow(record: WorkflowRecord): Workflow {
    return {
      id: record.id,
      instanceId: record.instanceId,
      name: record.name,
      slug: record.slug,
      description: record.description,
      n8nWorkflowId: record.n8nWorkflowId,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastRunAt: record.lastRunAt,
      runCount: record.runCount,
      error: record.error,
    };
  },

  // Generate public URL for workflow
  getWorkflowUrl(instance: N8nInstance, workflow: Workflow): string {
    return `${instance.apiUrl}/workflow/${workflow.slug}`;
  },
};

// ─── AI Integration ───
export const n8nAi = {
  // Chat with N8N AI assistant (uses our API, deducts from user credits)
  async chat(
    userId: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    workflowContext?: { nodes: string[]; connections: string[] }
  ): Promise<string> {
    // Check user credits
    const dailyCost = await usageDB.getTodayCost(userId);
    if (dailyCost >= 5) {
      throw new Error("Daily credit limit exceeded. AI assistant unavailable.");
    }

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(workflowContext);

    // Convert messages to API format
    const apiMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    // Call our API
    const response = await chatCompletion("claude-fable-5", apiMessages, 0.4);

    // Track usage
    if (response.usage) {
      const cost = (response.usage.prompt_tokens / 1e6) * 0.43 + (response.usage.completion_tokens / 1e6) * 0.87;
      await usageDB.addUsage("claude-fable-5", response.usage.prompt_tokens, response.usage.completion_tokens, cost, userId);
    }

    return response.choices[0]?.message?.content ?? "No response.";
  },

  // Build system prompt for N8N AI
  buildSystemPrompt(workflowContext?: { nodes: string[]; connections: string[] }): string {
    const context = workflowContext
      ? `\n\nCurrent workflow:\nNodes: ${workflowContext.nodes.join(", ")}\nConnections: ${workflowContext.connections.join(", ")}`
      : "";

    return `You are an N8N workflow assistant. Help users build, debug, and optimize their workflows.

Capabilities:
- Create workflows from natural language descriptions
- Explain how N8N nodes work
- Suggest optimizations for existing workflows
- Debug workflow issues
- Convert between different node types
- Help with expressions and data transformation${context}

Rules:
- Be concise and helpful
- Focus on practical solutions
- Explain complex concepts simply
- Suggest best practices
- When creating workflows, provide the complete configuration`;
  },
};

// ─── Custom N8N Branding ───
export const n8nBranding = {
  // Get customization config for N8N instance
  getCustomConfig(instance: N8nInstance): Record<string, unknown> {
    return {
      // Branding
      branding: {
        name: "Caret Workflows",
        logo: "/logo.svg",
        company: "Caret",
        footer: "Powered by Caret Agent",
      },

      // Colors (monochrome theme)
      colors: {
        primary: "#ededed",
        primaryShade: "#ffffff",
        background: "#000000",
        backgroundLight: "#0d0d0d",
        backgroundDark: "#060606",
        surface: "#141414",
        border: "#232323",
        text: "#ededed",
        textLight: "#9a9a9a",
        textDark: "#5e5e5e",
        accent: "#e8e8e8",
        success: "#8f8f8f",
        warning: "#c4c4c4",
        error: "#6f6f6f",
      },

      // AI Configuration (connects to our API)
      ai: {
        enabled: true,
        provider: "custom",
        apiUrl: "http://crate.ftp.sh/v1",
        apiKey: "mr-e7eacfbc9e634bb2847e87b0",
        model: "claude-fable-5",
        userId: instance.userId,
      },

      // Features
      features: {
        workflows: true,
        executions: true,
        credentials: true,
        templates: true,
        variables: true,
        audit: true,
      },

      // Security
      security: {
        allowPublicOnly: true,
        maxWorkflows: 50,
        maxExecutionsPerDay: 1000,
      },
    };
  },

  // Get CSS overrides for N8N UI
  getCssOverrides(): string {
    return `
      /* Caret Agent Monochrome Theme */
      :root {
        --color-primary: #ededed;
        --color-primary-shade: #ffffff;
        --color-background: #000000;
        --color-background-light: #0d0d0d;
        --color-background-dark: #060606;
        --color-surface: #141414;
        --color-border: #232323;
        --color-text: #ededed;
        --color-text-light: #9a9a9a;
        --color-text-dark: #5e5e5e;
        --color-accent: #e8e8e8;
        --color-success: #8f8f8f;
        --color-warning: #c4c4c4;
        --color-error: #6f6f6f;
      }

      /* Override N8N styles */
      body {
        background-color: #000000 !important;
        color: #ededed !important;
      }

      .n8n-sidebar {
        background-color: #060606 !important;
        border-color: #232323 !important;
      }

      .n8n-node {
        background-color: #141414 !important;
        border-color: #232323 !important;
      }

      .n8n-button-primary {
        background-color: #ededed !important;
        color: #000000 !important;
      }

      .n8n-button-secondary {
        background-color: transparent !important;
        border-color: #333333 !important;
        color: #ededed !important;
      }

      /* Footer branding */
      .n8n-footer {
        background-color: #060606 !important;
        border-color: #232323 !important;
      }

      .n8n-footer-text {
        color: #5e5e5e !important;
      }
    `;
  },

  // Get copyright text
  getCopyright(): string {
    return `© ${new Date().getFullYear()} Caret Agent. All rights reserved.`;
  },

  // Get footer text
  getFooterText(): string {
    return "Powered by Caret Agent • Built with N8N";
  },
};
