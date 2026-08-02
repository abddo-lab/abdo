// server/src/services/agent.ts — Agent system with autonomous loop, thinking, self-correction
import { ModelProxy } from "./model-proxy.js";
import { SandboxService } from "./sandbox.js";
import { AgentLoop, type ToolDef, type LoopResult, type LoopStatus, type LoopSnapshot, type TurnOutcome } from "./agent-loop.js";
import { AgentMemory } from "./agent-memory.js";
import { MCPService } from "./mcp.js";
import { seedMcpServers } from "./seeds.js";
import { NotificationService } from "./notification.js";
import pool from "../db.js";
import { v4 as uuid } from "uuid";

export type AgentMode = "agent" | "plan" | "ask";

/** Pull the first JSON object out of a model reply (robust to code fences / prose) */
function extractJsonObject(raw: string): any {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

/** Strip a ```...``` fence if the model wrapped its answer */
function stripCodeFence(raw: string): string {
  const m = raw.match(/```[a-z]*\n?([\s\S]*?)```/);
  return m ? m[1].trim() : raw.trim();
}

/** Naive line diff: emit a DiffFile.lines-style array (ctx/add/del) */
function diffContent(oldContent: string, newContent: string): { t: "add" | "del" | "ctx"; text: string }[] {
  const oldLines = oldContent.replace(/\n$/, "").split("\n");
  const newLines = newContent.replace(/\n$/, "").split("\n");
  const lines: { t: "add" | "del" | "ctx"; text: string }[] = [];
  const lcs = new Map<string, number>();
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) { lines.push({ t: "ctx", text: oldLines[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { lines.push({ t: "del", text: oldLines[i] }); i++; }
    else { lines.push({ t: "add", text: newLines[j] }); j++; }
  }
  while (i < m) lines.push({ t: "del", text: oldLines[i++] });
  while (j < n) lines.push({ t: "add", text: newLines[j++] });
  return lines;
}

function buildSystemPrompt(mode: AgentMode, userName?: string): string {
  const who = userName && userName !== "demo-user" ? ` The user you are helping is named ${userName} — address them warmly by name in replies.` : "";

  const agent = `You are Kiren, an autonomous AI coding agent working on the user's live sandbox.
You value QUALITY OVER SPEED. You NEVER rush, never guess, and never hallucinate tool output.
You always read memory first, then deep-think, then act one careful step at a time.

## Working style (Memory-First Sequence — MSF)
1. Read your memory before anything else.
2. Deep-think about the situation, the goal, constraints, and the best next step.
3. Explore the real codebase with Read / Ls / Grep before touching files.
4. Act with one tool call, then STOP and wait for the REAL tool output.
5. Observe the output. If it failed, understand WHY and fix differently.
6. Keep going until the task is verified complete.

## Full autonomy
You can: search the codebase, read files, plan when the task is complex, edit files,
build the project, check with typecheck/tests, debug failures, and deploy a live preview.
For web apps, after building, run the sudebug tool to verify the real rendered page.

## Rules
- Read before you write. Verify before you claim success.
- Run the project's typecheck / tests / build to prove the work is correct.
- If something fails, analyze the root cause and try a different approach — never repeat the same mistake.
- When you finish a web app, always run sudebug on the live preview.
- Address the user by name in your final summary.
- Never give up early; exhaust reasonable approaches.${who}`;

  const plan = `You are Kiren in Plan mode. Before making any changes, create a detailed plan.
List each step, explain what files will be affected, and what the expected outcome is.
Wait for user approval before executing any changes.
Do NOT execute code or make file changes until the user approves the plan.${who}`;

  const ask = `You are Kiren in Ask mode. You can read and search the codebase but you CANNOT make changes.
Answer questions about the code, explain how things work, suggest approaches.
Use Read and Grep tools to explore the codebase. Do NOT write or edit any files.${who}`;

  return { agent, plan, ask }[mode];
}

const SYSTEM_PROMPTS: Record<AgentMode, string> = {
  agent: buildSystemPrompt("agent"),
  plan: buildSystemPrompt("plan"),
  ask: buildSystemPrompt("ask"),
};

/** Build tools available to the agent in the sandbox */
function buildTools(ctx: {
  userId: string;
  threadId: string;
  projectId?: string;
  sandboxId?: string;
  mode: AgentMode;
  workdir?: string | null;
}): ToolDef[] {
  const { userId, threadId, sandboxId, mode, workdir } = ctx;
  // Read-only review always allowed; write tools kept but gated to user approval
  // in plan/ask mode (allow/deny block) and auto-approved in agent (autopilot) mode.
  const askWrites = mode !== "agent";
  const wd = workdir || undefined;

  return [
    {
      name: "Read",
      description: "Read a file from the sandbox",
      schema: { type: "object", properties: { path: { type: "string", description: "Absolute or relative file path" } }, required: ["path"] },
      execute: async (args) => {
        const result = await SandboxService.execCommand(sandboxId, `cat "${args.path}"`, wd);
        return result.stdout || result.stderr;
      },
    },
    {
      name: "Grep",
      description: "Search for text patterns in files",
      schema: { type: "object", properties: { pattern: { type: "string" }, path: { type: "string" } }, required: ["pattern"] },
      execute: async (args) => {
        const path = args.path || ".";
        const result = await SandboxService.execCommand(sandboxId, `grep -rn "${args.pattern}" ${path} --include="*" 2>/dev/null | head -50`, wd);
        return result.stdout || "No matches found";
      },
    },
    {
      name: "Ls",
      description: "List files and directories",
      schema: { type: "object", properties: { path: { type: "string" } } },
      execute: async (args) => {
        const result = await SandboxService.execCommand(sandboxId, `ls -la ${args.path || "."}`, wd);
        return result.stdout;
      },
    },
    {
      name: "Write",
      description: "Write content to a file (replaces existing content). Requires your approval.",
      schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
      permission: askWrites,
      async execute(args) {
        const escaped = args.content.replace(/'/g, "'\\''");
        await SandboxService.execCommand(sandboxId, `cat > '${args.path}' << 'KIREN_EOF'\n${args.content}\nKIREN_EOF`, wd);
        return `Written ${args.content.length} bytes to ${args.path}`;
      },
    },
    {
      name: "Edit",
      description: "Edit a file by replacing an exact text occurrence. Requires your approval.",
      schema: { type: "object", properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } }, required: ["path", "old_text", "new_text"] },
      permission: askWrites,
      async execute(args) {
        const cmd = `sed -i 's|${args.old_text.replace(/[\/&]/g, "\\$&")}|${args.new_text.replace(/[\/&]/g, "\\$&")}|' "${args.path}"`;
        await SandboxService.execCommand(sandboxId, cmd, wd);
        return `Edited ${args.path}`;
      },
    },
    {
      name: "Bash",
      description: "Execute a shell command in the sandbox. Requires your approval in ask mode.",
      schema: { type: "object", properties: { command: { type: "string", description: "The shell command to run" } }, required: ["command"] },
      permission: askWrites,
      async execute(args) {
        const result = await SandboxService.execCommand(sandboxId, args.command, wd);
        return `exit ${result.exit}\n${result.stdout}${result.stderr ? "\nstderr: " + result.stderr : ""}`;
      },
    },
    {
      name: "Git",
      description: "Run git commands. Requires your approval in ask mode.",
      schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
      permission: askWrites,
      async execute(args) {
        const result = await SandboxService.execCommand(sandboxId, `git ${args.command}`, wd);
        return result.stdout || result.stderr;
      },
    },
    {
      name: "sudebug",
      description: "Debug the live web view: open the preview URL with agent-browser, capture a screenshot, and analyze it with a vision model. Returns rendering status, console errors, layout issues and fixes. Use after building any web app.",
      execute: async () => {
        try {
          const { SudebugService } = await import("./sudebug.js");
          const result = await SudebugService.runForThread(userId, threadId, sandboxId);
          return JSON.stringify(result, null, 2);
        } catch (err: any) {
          return `ERROR: ${err.message}`;
        }
      },
    },
    {
      name: "Computer",
      description: "Manus-style desktop computer use. Controls the sandbox desktop: take a screenshot, click at x,y, type text, press keys, or run a browser. Modes: screenshot, click {x,y}, type {text}, key {key}, open {url}. Returns the resulting screenshot description.",
      execute: async (args) => {
        try {
          const { ComputerService } = await import("./computer.js");
          return await ComputerService.perform(sandboxId, args);
        } catch (err: any) {
          return `ERROR: ${err.message}`;
        }
      },
    },
    {
      name: "CreateSubagent",
      description: "Create a new subagent with a name, description and task prompt. Use for complex tasks you want to delegate. Returns the created subagent.",
      execute: async (args) => {
        try {
          const name = (args.name || "helper").toLowerCase().replace(/[^a-z0-9-]/g, "-");
          const desc = args.description || "A helper subagent";
          const prompt = args.task || args.system_prompt || `You are a subagent. Task: ${args.task || desc}`;
          const id = uuid();
          await pool.query(
            `INSERT INTO subagents (id, user_id, name, description, icon, color, scope, tools, system_prompt)
             VALUES ($1, $2, $3, $4, 'wrench', '#1A1D28', 'workspace', $5, $6)`,
            [id, userId, name, desc, JSON.stringify(["Read", "Grep", "Ls", "Bash"]), prompt]
          );
          return `Created subagent @${name} (${id}). You can delegate work to it in future steps.`;
        } catch (err: any) {
          return `ERROR: ${err.message}`;
        }
      },
    },
    {
      name: "RequestMcpInstall",
      description: "Propose installing an MCP server to the user. Use when the task needs an MCP tool that isn't installed. Creates a permission request the user must approve. If approved, the MCP server is installed and configured; if declined, find an alternative approach.",
      execute: async (args) => {
        try {
          const { MCPService } = await import("./mcp.js");
          const name = args.name || args.server || "new-mcp";
          const config = args.config || {};
          const request = await MCPService.requestInstall(userId, threadId, name, config);
          return `Requested MCP install for "${name}" (id ${request.id}). Waiting for user approval in the chat. If approved it will be installed; if declined, propose an alternative approach.`;
        } catch (err: any) {
          return `ERROR: ${err.message}`;
        }
      },
    },
  ];
}

/** Build MCP tools for servers the user mentioned with @name or #hashtag in their goal */
async function buildMcpTools(userId: string, goal: string): Promise<ToolDef[]> {
  const atMentions = [...goal.matchAll(/@([a-zA-Z0-9_-]+)/g)].map((m) => m[1].toLowerCase());
  const hashMentions = [...goal.matchAll(/#([a-zA-Z0-9_:-]+)/g)].map((m) => m[1].toLowerCase());
  const mentioned = new Set([...atMentions, ...hashMentions]);

  const tools: ToolDef[] = [];

  // Check for workflow MCP mentions
  const hasWorkflowMention = hashMentions.some((m) => m.includes("workflow") || m.includes("n8n"));
  if (hasWorkflowMention || mentioned.has("kiren-workflow")) {
    try {
      const { MCPWorkflowService } = await import("./mcp-workflow.js");
      const wfTools = await MCPWorkflowService.getTools();
      for (const t of wfTools) {
        tools.push({
          name: `MCP:kiren-workflow:${t.name}`,
          description: `[MCP Workflow] ${t.description}`,
          execute: async (args) => {
            const out = await MCPWorkflowService.callTool(userId, t.name, args);
            return typeof out === "string" ? out : JSON.stringify(out, null, 2);
          },
        });
      }
    } catch {}
  }

  if (mentioned.size === 0 && tools.length === 0) return [];

  await seedMcpServers(userId);
  const result = await pool.query(
    `SELECT * FROM mcp_servers WHERE user_id = $1 AND status = 'connected'`,
    [userId]
  );

  for (const row of result.rows) {
    if (!mentioned.has(row.name.toLowerCase()) && !mentioned.has(`mcp:${row.name.toLowerCase()}`)) continue;
    const toolList = await MCPService.getTools(userId, row.name);
    for (const t of toolList) {
      const props = t.inputSchema?.properties || {};
      const required = new Set(t.inputSchema?.required || []);
      const schemaHint = Object.keys(props).length > 0
        ? ` Args: ${Object.entries(props).map(([k, v]) => `${k} (${(v as any).type || "any"}${required.has(k) ? ", required" : ""})`).join(", ")}.`
        : "";
      tools.push({
        name: `MCP:${row.name}:${t.name}`,
        description: `[MCP ${row.name}] ${t.description}${schemaHint}`,
        execute: async (args) => {
          const out = await MCPService.callTool(userId, row.name, t.name, args);
          return typeof out === "string" ? out : JSON.stringify(out, null, 2);
        },
      });
    }
  }
  return tools;
}

export class AgentService {
  /** Run a single agent turn (non-autonomous, for backward compat) */
  static async runTurn(context: any, userMessage: string): Promise<any[]> {
    const steps: any[] = [];

    // Save user message
    await this.saveBlock(context.threadId, "user", { text: userMessage });

    // Get history
    const history = await this.getThreadHistory(context.threadId);

    const messages = [
      { role: "system" as const, content: buildSystemPrompt(context.mode || "agent", context.userName) },
      ...history.map((b: any) => ({
        role: b.kind === "user" ? "user" as const : "assistant" as const,
        content: typeof b.data?.text === "string" ? b.data.text : JSON.stringify(b.data),
      })),
      { role: "user" as const, content: userMessage },
    ];

    const response = await ModelProxy.chatCompletion({
      model: context.modelId,
      messages,
      stream: false,
    }, context.userId, context.threadId);

    const content = response.choices?.[0]?.message?.content;
    if (content) {
      await this.saveBlock(context.threadId, "text", { text: content });
      steps.push({ kind: "text", data: { text: content } });
    }

    // Update thread
    await pool.query(`UPDATE threads SET status = 'review', updated_at = NOW() WHERE id = $1`, [context.threadId]);

    return steps;
  }

  /**
   * Run a single agent step (multi-request flow like Claude Code).
   * - Fresh start (no snapshot): sets up thread, saves user message, builds
   *   tools, executes the first Think→Act→Observe step.
   * - Resumption (snapshot provided): rebuilds the loop from the persisted
   *   snapshot + memory and executes the next step.
   * After every step the loop snapshot + memory are persisted to
   * `threads.agent_state` so the client can POST /continue to resume.
   */
  static async runStep(context: {
    userId: string;
    threadId: string;
    projectId: string;
    sandboxId?: string;
    workdir?: string | null;
    modelId: string;
    goal?: string;
    mode: AgentMode;
    maxSteps?: number;
    userName?: string;
  }, snapshot?: LoopSnapshot): Promise<{
    done: boolean;
    step: number;
    status: LoopStatus | "review";
    loop: AgentLoop;
    stepsPerRequest: number;
  }> {
    let loop: AgentLoop;

    if (snapshot) {
      // ── Resumption path ───────────────────────────────────
      const saved = await this.loadThreadState(context.threadId);
      const baseTools = context.sandboxId ? buildTools({
        userId: context.userId,
        threadId: context.threadId,
        projectId: context.projectId,
        sandboxId: context.sandboxId,
        mode: context.mode,
        workdir: context.workdir,
      }) : [];
      const mcpTools = await buildMcpTools(context.userId, snapshot.goal || context.goal);
      const tools = [...baseTools, ...mcpTools];
      loop = new AgentLoop({
        userId: context.userId,
        threadId: context.threadId,
        sandboxId: context.sandboxId || snapshot.sandboxId,
        workdir: context.workdir || snapshot.workdir,
        modelId: context.modelId,
        goal: snapshot.goal || context.goal,
        userName: context.userName,
        tools,
        maxSteps: context.maxSteps || 50,
      });
      loop.restore(snapshot, tools);
      if (saved?.memory) loop.restoreMemory(saved.memory);
    } else {
      // ── Fresh start ───────────────────────────────────────
      const goal = context.goal || "";
      await pool.query(
        `UPDATE threads SET status = 'running', title = $1, updated_at = NOW() WHERE id = $2`,
        [goal.slice(0, 50), context.threadId]
      );
      await this.saveBlock(context.threadId, "user", { text: goal });

      const baseTools = context.sandboxId ? buildTools({
        userId: context.userId,
        threadId: context.threadId,
        projectId: context.projectId,
        sandboxId: context.sandboxId,
        mode: context.mode,
        workdir: context.workdir,
      }) : [];
      const mcpTools = await buildMcpTools(context.userId, goal);
      const tools = [...baseTools, ...mcpTools];

      loop = new AgentLoop({
        userId: context.userId,
        threadId: context.threadId,
        sandboxId: context.sandboxId,
        workdir: context.workdir,
        modelId: context.modelId,
        goal,
        userName: context.userName,
        tools,
        maxSteps: context.maxSteps || 50,
      });
    }

    // Execute steps (1 per request, matching the Claude Code "stop + resend" flow)
    const availableTools = loop.getAvailableTools();
    const stepsPerRequest = 1;
    let outcome: "continue" | "completed" | "wait_permission" = "continue";
    for (let i = 0; i < stepsPerRequest; i++) {
      if (loop.getStatus() === "stopped" || !loop.shouldContinue()) break;
      const step = loop.nextStep();
      outcome = await loop.step(step, availableTools);
      if (outcome === "completed" || outcome === "wait_permission") break;
    }

    const state = loop.getMemoryState();

    // Persist snapshot + memory so /continue can resume
    await this.saveThreadState(context.threadId, {
      snapshot: loop.snapshot(),
      memory: state,
    });

    if (outcome === "completed") {
      await this.finalizeThread(context, loop, state.step);
    } else if (outcome === "wait_permission") {
      // Await a user allow/deny — keep the thread parked in review.
      await pool.query(
        `UPDATE threads SET status = 'review', updated_at = NOW() WHERE id = $1`,
        [context.threadId]
      );
    } else {
      await pool.query(
        `UPDATE threads SET status = 'running', updated_at = NOW() WHERE id = $1`,
        [context.threadId]
      );
    }

    return {
      done: outcome === "completed",
      step: state.step,
      status: outcome === "completed" ? "completed" : outcome === "wait_permission" ? "review" : "running",
      loop,
      stepsPerRequest,
    };
  }

  /** Save loop snapshot + memory into threads.agent_state */
  private static async saveThreadState(threadId: string, data: { snapshot: LoopSnapshot; memory: any }): Promise<void> {
    try {
      await pool.query(
        `UPDATE threads SET agent_state = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(data), threadId]
      );
    } catch (err) {
      console.error("Failed to persist agent state:", err);
    }
  }

  /** Load loop snapshot + memory from threads.agent_state */
  private static async loadThreadState(threadId: string): Promise<{ snapshot: LoopSnapshot; memory: any } | null> {
    try {
      const result = await pool.query(`SELECT agent_state FROM threads WHERE id = $1`, [threadId]);
      const raw = result.rows[0]?.agent_state;
      if (!raw) return null;
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return null;
    }
  }

  /** Save summary + notify once the agent finishes */
  private static async finalizeThread(context: any, loop: AgentLoop, steps: number): Promise<void> {
    const result = {
      status: "completed",
      steps_taken: steps,
      files_read: loop.getMemoryState().files_read,
      files_modified: loop.getMemoryState().files_modified,
      tests_passed: loop.getMemoryState().tests_passed,
    } as LoopResult;

    await this.saveBlock(context.threadId, "summary", {
      title: `Agent completed`,
      bullets: [
        `Steps: ${result.steps_taken}`,
        `Status: ${result.status}`,
        `Files read: ${result.files_read.length}`,
        `Files modified: ${result.files_modified.length}`,
        `Tests: ${result.tests_passed === null ? "not run" : result.tests_passed ? "PASSING" : "FAILING"}`,
      ],
    });

    await pool.query(
      `UPDATE threads SET status = 'review', updated_at = NOW() WHERE id = $1`,
      [context.threadId]
    );

    NotificationService.create({
      userId: context.userId,
      type: "thread",
      title: `Agent finished · completed`,
      body: `Thread ${context.threadId.slice(0, 8)} completed after ${result.steps_taken} steps (${result.files_modified.length} files modified).`,
    }).catch(() => {});
  }

  /** Run autonomous loop — the REAL agent */
  static async runAutonomous(context: {
    userId: string;
    threadId: string;
    projectId: string;
    sandboxId?: string;
    workdir?: string | null;
    modelId: string;
    goal: string;
    mode: AgentMode;
    maxSteps?: number;
    userName?: string;
  }): Promise<LoopResult> {
    // Update thread status to running
    await pool.query(
      `UPDATE threads SET status = 'running', title = $1, updated_at = NOW() WHERE id = $2`,
      [context.goal.slice(0, 50), context.threadId]
    );

    // Save user message
    await this.saveBlock(context.threadId, "user", { text: context.goal });

    // Build tools
    const baseTools = context.sandboxId ? buildTools({
      userId: context.userId,
      threadId: context.threadId,
      projectId: context.projectId,
      sandboxId: context.sandboxId,
      mode: context.mode,
      workdir: context.workdir,
    }) : [];
    const mcpTools = await buildMcpTools(context.userId, context.goal);
    const tools = [...baseTools, ...mcpTools];

    // Create and run the autonomous loop
    const loop = new AgentLoop({
      userId: context.userId,
      threadId: context.threadId,
      sandboxId: context.sandboxId,
      workdir: context.workdir,
      modelId: context.modelId,
      goal: context.goal,
      userName: context.userName,
      tools,
      maxSteps: context.maxSteps || 50,
      onStep: (step, thinking, action, result) => {
        // Could emit WebSocket events here for real-time UI updates
      },
    });

    const result = await loop.run();

    // Save final output
    await this.saveBlock(context.threadId, "summary", {
      title: `Agent ${result.status}`,
      bullets: [
        `Steps: ${result.steps_taken}`,
        `Status: ${result.status}`,
        `Files read: ${result.files_read.length}`,
        `Files modified: ${result.files_modified.length}`,
        `Tests: ${result.tests_passed === null ? "not run" : result.tests_passed ? "PASSING" : "FAILING"}`,
      ],
    });

    // Notify + email the user that the agent finished
    NotificationService.create({
      userId: context.userId,
      type: "thread",
      title: `Agent finished · ${result.status}`,
      body: `Thread ${context.threadId.slice(0, 8)} completed after ${result.steps_taken} steps (${result.files_modified.length} files modified).`,
    }).catch(() => {});

    return result;
  }

  /** Create a subagent task */
  static async runSubagent(parentThreadId: string, subagentName: string, task: string, context: any): Promise<string> {
    const childThreadId = uuid();
    await pool.query(
      `INSERT INTO threads (id, project_id, user_id, title, status, mode, model_id, branch, agents_md)
       VALUES ($1, $2, $3, $4, 'running', 'agent', $5, $6, $7)`,
      [childThreadId, context.projectId, context.userId,
       `Subagent: ${subagentName} — ${task.slice(0, 40)}`,
       context.modelId, `subagent/${subagentName}`,
       `You are a subagent named @${subagentName}. Your task: ${task}`]
    );

    // Run autonomously
    const result = await this.runAutonomous({
      ...context,
      threadId: childThreadId,
      goal: task,
      maxSteps: 20,
    });

    // Report back to parent
    await this.saveBlock(parentThreadId, "text", {
      text: `Subagent @${subagentName} completed (${result.status}). Steps: ${result.steps_taken}. Thread: ${childThreadId}`,
    });

    return childThreadId;
  }

  /**
   * Cursor-style inline edit: rewrite a single file (or selection within it)
   * from a natural-language instruction. Calls the model directly (no agent
   * loop), returns the new content plus a line-level diff for the UI to
   * accept or reject.
   */
  static async inlineEdit(context: {
    userId: string;
    threadId: string;
    projectId: string;
    modelId: string;
    path: string;
    content: string;
    instruction: string;
    selection?: { startLine?: number; endLine?: number; text?: string };
    userName?: string;
  }): Promise<{
    path: string;
    oldContent: string;
    newContent: string;
    diff: { t: "add" | "del" | "ctx"; text: string }[];
    lines: { add: number; del: number; startOld: number; startNew: number };
  }> {
    const { userId, threadId, modelId, path, content, instruction, selection } = context;

    await this.saveBlock(threadId, "user", {
      text: instruction,
      attach: [path],
    });

    const sel = selection?.text?.trim() || null;
    const selLoc = selection?.startLine != null
      ? ` (lines ${selection.startLine}${selection.endLine ? "–" + selection.endLine : ""})`
      : "";

    const messages = [
      {
        role: "system" as const,
        content:
          "You are Kiren, an expert code editor. The user points at a file" +
          (sel ? " and a selected region" : "") +
          " and asks for an inline edit. Rewrite the file content so the request is fully satisfied. " +
          "Preserve everything else exactly — same indentation, quotes, comments, and structure. " +
          "Reply with ONLY a JSON object of the form {\"new_content\": \"...\"} where new_content is the COMPLETE new file contents. " +
          "Escape newlines and quotes properly so the JSON parses.",
      },
      {
        role: "user" as const,
        content:
          `File: ${path}\n` +
          (sel ? `Selected region${selLoc}:\n\`\`\`\n${sel}\n\`\`\`\n` : `Entire file:\n`) +
          `\`\`\`\n${content}\n\`\`\`\n` +
          `\nInstruction: ${instruction}\n` +
          `\nReturn the complete new file as JSON {"new_content": "..."}.`,
      },
    ];

    const response = await ModelProxy.chatCompletion(
      { model: modelId, messages, stream: false, temperature: 0.2 },
      userId,
      threadId
    );
    const raw = response.choices?.[0]?.message?.content || "";
    const parsed = extractJsonObject(raw);
    let newContent = parsed?.new_content;
    if (!newContent) newContent = stripCodeFence(raw);
    if (!newContent || newContent === content) {
      throw new Error("The model did not return a changed file. Try a more specific instruction.");
    }

    // Persist the new content back into the sandbox workspace (best-effort)
    await this.applyInlineEditToWorkspace(userId, context.projectId, path, newContent).catch(() => {});

    const diff = diffContent(content, newContent);
    const add = diff.filter((l) => l.t === "add").length;
    const del = diff.filter((l) => l.t === "del").length;

    await this.saveBlock(threadId, "text", {
      text: `Applied inline edit to \`${path}\``,
    });

    return { path, oldContent: content, newContent, diff, lines: { add, del, startOld: 1, startNew: 1 } };
  }

  /** Best-effort write of an inline edit into the sandbox clone */
  private static async applyInlineEditToWorkspace(userId: string, projectId: string, path: string, content: string): Promise<void> {
    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [userId]);
    let sandboxId = user.rows[0]?.sandbox_id;
    try {
      const { SandboxService } = await import("./sandbox.js");
      const sb = await SandboxService.ensureSandbox(userId, "main");
      sandboxId = sb.daytona_sandbox_id || sb.id;
      const project = await pool.query(`SELECT repo_full_name FROM projects WHERE id = $1`, [projectId]);
      if (project.rows[0]?.repo_full_name && sandboxId) {
        const { GitHubService } = await import("./github.js");
        const token = await GitHubService.getAccessToken(userId);
        const workdir = await SandboxService.ensureProjectClone(
          sandboxId, project.rows[0].repo_full_name, "main", token || undefined
        );
        const escaped = content.replace(/'/g, "'\\''");
        await SandboxService.execCommand(
          sandboxId,
          `cat > '${path}' << 'KIREN_EOF'\n${content}\nKIREN_EOF`,
          workdir
        );
      }
    } catch {}
  }

  /**
   * Codex-style parallel agents: break a goal into N sub-tasks, run each in
   * its own child thread autonomously and concurrently, and report per-agent
   * progress + a merged summary back into the parent thread.
   */
  static async runParallel(context: {
    userId: string;
    threadId: string;
    projectId: string;
    sandboxId?: string;
    workdir?: string | null;
    modelId: string;
    mode: AgentMode;
    goal: string;
    breakdown: { name: string; task: string }[];
    userName?: string;
  }): Promise<{
    results: { name: string; status: string; steps: number; threadId: string; output: string }[];
  }> {
    const { userId, threadId, projectId, modelId, mode, goal, breakdown, sandboxId, workdir, userName } = context;

    await this.saveBlock(threadId, "user", {
      text: goal,
      attach: breakdown.map((b) => `@${b.name}`),
    });
    await this.saveBlock(threadId, "thinking", {
      text: `Delegating ${breakdown.length} parallel agents: ${breakdown.map((b) => b.name).join(", ")}. Each works in its own thread and the results merge back here.`,
      ms: 800,
    });

    const children = await Promise.all(
      breakdown.map(async (b) => {
        const childThreadId = uuid();
        await pool.query(
          `INSERT INTO threads (id, project_id, user_id, title, status, mode, model_id, branch, agents_md)
           VALUES ($1, $2, $3, $4, 'running', 'agent', $5, $6, $7)`,
          [childThreadId, projectId, userId,
           `${b.name} — ${b.task.slice(0, 40)}`,
           modelId, `parallel/${b.name}`,
           `You are a parallel subagent named @${b.name}. Your task: ${b.task}`]
        );
        await this.saveBlock(childThreadId, "user", { text: b.task });
        return { ...b, childThreadId };
      })
    );

    // Run all agents concurrently, each as a bounded autonomous loop
    const results = await Promise.allSettled(
      children.map(async (child) => {
        try {
          const loop = new AgentLoop({
            userId,
            threadId: child.childThreadId,
            sandboxId,
            workdir,
            modelId,
            goal: child.task,
            userName: child.name,
            tools: sandboxId ? buildTools({ userId, threadId: child.childThreadId, projectId, sandboxId, mode, workdir }) : [],
            maxSteps: 12,
          });
          const result = await loop.run();
          return { name: child.name, status: "completed", steps: result.steps_taken, threadId: child.childThreadId, output: "" };
        } catch (err: any) {
          return { name: child.name, status: "failed", steps: 0, threadId: child.childThreadId, output: err.message };
        }
      })
    );

    const outcomes = results.map((r) => r.status === "fulfilled" ? (r as any).value : { name: "?", status: "failed", steps: 0, threadId: "", output: (r as any).reason?.message });

    // Report each agent into the parent thread
    for (const o of outcomes) {
      await this.saveBlock(threadId, "tool", {
        tool: "Agent",
        icon: "agentBadge",
        target: `@${o.name}`,
        meta: o.status === "completed" ? `${o.steps} steps` : "failed",
        status: o.status === "completed" ? "done" : "failed",
        output: o.output ? [o.output] : [],
      });
    }

    const done = outcomes.filter((o) => o.status === "completed").length;
    await this.saveBlock(threadId, "summary", {
      title: `${done}/${outcomes.length} parallel agents finished`,
      bullets: [
        `Goal: ${goal.slice(0, 80)}`,
        ...outcomes.map((o) => `@${o.name} — ${o.status}${o.steps ? ` · ${o.steps} steps` : ""}`),
      ],
    });

    await pool.query(
      `UPDATE threads SET status = 'review', updated_at = NOW() WHERE id = $1`,
      [threadId]
    );

    return { results: outcomes };
  }

  static async getThreadHistory(threadId: string): Promise<any[]> {
    const result = await pool.query(
      `SELECT kind, data FROM thread_blocks WHERE thread_id = $1 ORDER BY sort_order ASC`,
      [threadId]
    );
    return result.rows;
  }

  static async saveBlock(threadId: string, kind: string, data: any): Promise<void> {
    try {
      const maxOrder = await pool.query(
        `SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM thread_blocks WHERE thread_id = $1`,
        [threadId]
      );
      await pool.query(
        `INSERT INTO thread_blocks (id, thread_id, kind, data, sort_order) VALUES ($1, $2, $3, $4, $5)`,
        [uuid(), threadId, kind, JSON.stringify(data), maxOrder.rows[0].next]
      );
    } catch {}
  }
}
