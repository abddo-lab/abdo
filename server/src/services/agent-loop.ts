// server/src/services/agent-loop.ts — opencode-style agent loop.
// Native OpenAI/Qwen tool calls (messages.tools + assistant.tool_calls), real
// reasoning surfaced as "thinking" blocks, allow/deny permission gating for
// write/ask modes, and memory-based context compaction near the model limit.
import { AgentMemory } from "./agent-memory.js";
import { SandboxService } from "./sandbox.js";
import { getModel, type ModelDef } from "../models-registry.js";
import { ModelProxy } from "./model-proxy.js";
import pool from "../db.js";
import { v4 as uuid } from "uuid";

export type LoopStatus = "running" | "completed" | "failed" | "max_steps" | "stopped";
// After a model turn the loop may be parked waiting on a user decision.
export type TurnOutcome = "continue" | "completed" | "wait_permission";

export interface LoopResult {
  status: LoopStatus;
  steps_taken: number;
  total_thinking_ms: number;
  final_output: string;
  memory: AgentMemory;
  files_read: string[];
  files_modified: string[];
  tests_passed: boolean | null;
}

export interface ToolDef {
  name: string;
  description: string;
  /** JSON Schema for arguments. Defaults to { type:"object", properties:{} }. */
  schema?: Record<string, any>;
  /** Require explicit user approval before executing (write tools / ask mode). */
  permission?: boolean;
  execute: (args: any) => Promise<string>;
}

// A tool call the model requested but that waits on a user allow/deny.
export interface PendingCall {
  callId: string;
  name: string;
  args: any;
  resolution?: "allow" | "deny";
}

export interface LoopSnapshot {
  goal: string;
  modelId: string;
  userId: string;
  threadId: string;
  sandboxId?: string;
  workdir?: string | null;
  status: LoopStatus;
  step: number;
  tools: string[];
  pendingCall?: PendingCall | null;
}

// Seam for the model call so tests can inject a scripted model.
// The real runtime defaults to the configured upstream.
export type ModelCall = (req: any, userId?: string, threadId?: string) => Promise<any>;

let modelCaller: ModelCall = (req, userId, threadId) =>
  ModelProxy.chatCompletion(req, userId, threadId);

export function setModelCaller(fn: ModelCall): void { modelCaller = fn; }

type ChatMsg =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content?: string; reasoning?: string; tool_calls?: any[] }
  | { role: "tool"; tool_call_id: string; content: string };

export class AgentLoop {
  private memory: AgentMemory;
  private tools: Map<string, ToolDef>;
  private modelId: string;
  private userId: string;
  private threadId: string;
  private sandboxId?: string;
  private workdir?: string;
  private goal: string;
  private status: LoopStatus = "running";
  private onStep?: (step: number, thinking: string, action: string, result: string) => void;
  private abortController: AbortController;
  private maxSteps: number;
  private userName?: string;
  private pendingCall: PendingCall | null = null;

  constructor(opts: {
    userId: string;
    threadId: string;
    sandboxId?: string;
    workdir?: string | null;
    modelId: string;
    goal: string;
    tools: ToolDef[];
    maxSteps?: number;
    userName?: string;
    onStep?: (step: number, thinking: string, action: string, result: string) => void;
  }) {
    this.userId = opts.userId;
    this.threadId = opts.threadId;
    this.sandboxId = opts.sandboxId;
    this.workdir = opts.workdir || undefined;
    this.modelId = opts.modelId;
    this.goal = opts.goal;
    this.userName = opts.userName || "";
    this.tools = new Map(opts.tools.map((t) => [t.name.toLowerCase(), t]));
    this.memory = new AgentMemory(opts.threadId, opts.goal, opts.maxSteps || 50);
    this.maxSteps = opts.maxSteps || 50;
    this.onStep = opts.onStep;
    this.abortController = new AbortController();
  }

  stop(): void {
    this.status = "stopped";
    this.abortController.abort();
  }

  snapshot(): LoopSnapshot {
    return {
      goal: this.goal,
      modelId: this.modelId,
      userId: this.userId,
      threadId: this.threadId,
      sandboxId: this.sandboxId,
      workdir: this.workdir || null,
      status: this.status,
      step: this.memory.getState().step,
      tools: Array.from(this.tools.keys()),
      pendingCall: this.pendingCall,
    };
  }

  restore(snap: LoopSnapshot, tools: ToolDef[]): void {
    this.goal = snap.goal;
    this.modelId = snap.modelId;
    this.userId = snap.userId;
    this.threadId = snap.threadId;
    this.sandboxId = snap.sandboxId;
    this.workdir = snap.workdir || undefined;
    this.status = snap.status;
    this.tools = new Map(tools.map((t) => [t.name.toLowerCase(), t]));
    this.memory = new AgentMemory(snap.threadId, snap.goal, this.maxSteps);
    this.pendingCall = snap.pendingCall || null;
  }

  getMemoryState() { return this.memory.getState(); }
  nextStep(): number { return this.memory.nextStep(); }
  getAvailableTools(): string[] { return Array.from(this.tools.keys()); }
  getStatus(): LoopStatus { return this.status; }
  shouldContinue(): boolean { return this.memory.shouldContinue() && this.status === "running"; }
  restoreMemory(state: any): void { if (state) this.memory.restore(state); }
  get pending(): PendingCall | null { return this.pendingCall; }

  /**
   * Autonomous run: keep stepping until the goal is answered or the step cap is
   * hit. Used by subagent / parallel flows where there is no interactive user to
   * approve permissions, so pending permission tools are auto-allowed here.
   */
  async run(): Promise<LoopResult> {
    const start = Date.now();
    let totalThinkingMs = 0;
    const availableTools = this.getAvailableTools();
    while (this.shouldContinue()) {
      const step = this.nextStep();
      const t0 = Date.now();
      const outcome = await this.step(step, availableTools, start);
      totalThinkingMs += Date.now() - t0;
      if (outcome === "completed") break;
      if (outcome === "wait_permission") {
        // No interactive user for autonomous runs — auto-allow and proceed.
        if (this.pendingCall) {
          this.pendingCall.resolution = "allow";
        }
      }
    }
    const state = this.memory.getState();
    if (this.status === "running") {
      this.status = state.convergence_score >= 80 ? "completed" : "max_steps";
    }
    try {
      await pool.query(
        `UPDATE threads SET status = $1, updated_at = NOW() WHERE id = $2`,
        [this.status === "completed" ? "review" : "running", this.threadId]
      );
    } catch { /* non-critical */ }
    return {
      status: this.status,
      steps_taken: state.step,
      total_thinking_ms: totalThinkingMs,
      final_output: this.finalOutput(),
      memory: this.memory,
      files_read: state.files_read,
      files_modified: state.files_modified,
      tests_passed: state.tests_passed,
    };
  }

  private finalOutput(): string {
    const s = this.memory.getState();
    return `## Agent ${this.status}\nSteps: ${s.step} · Convergence: ${s.convergence_score}%\n` +
      `Files read: ${s.files_read.length} · Modified: ${s.files_modified.length} · Tests: ${s.tests_passed === null ? "n/a" : s.tests_passed ? "PASS" : "FAIL"}\n` +
      (s.insights.length ? `\nInsights:\n${s.insights.slice(-6).map((i) => `- ${i}`).join("\n")}` : "");
  }

  /** Persist a block into the thread transcript. */
  private async saveBlock(kind: string, data: any): Promise<void> {
    try {
      const maxOrder = await pool.query(
        `SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM thread_blocks WHERE thread_id = $1`,
        [this.threadId]
      );
      await pool.query(
        `INSERT INTO thread_blocks (id, thread_id, kind, data, sort_order) VALUES ($1, $2, $3, $4, $5)`,
        [uuid(), this.threadId, kind, JSON.stringify(data), maxOrder.rows[0].next]
      );
    } catch { /* non-critical */ }
  }

  private async loadBlocks(): Promise<any[]> {
    try {
      const r = await pool.query(
        `SELECT kind, data FROM thread_blocks WHERE thread_id = $1 ORDER BY sort_order ASC`, [this.threadId]
      );
      return r.rows;
    } catch { return []; }
  }

  private model(): ModelDef | undefined { return getModel(this.modelId); }

  /** Convert our tool map into OpenAI/Qwen tool schemas. */
  private openaiTools(): any[] {
    const out: any[] = [];
    for (const t of this.tools.values()) {
      out.push({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.schema || { type: "object", properties: {} },
        },
      });
    }
    return out;
  }

  /** Build messages: system + progress context + compacted prior transcript + task. */
  private async buildMessages(): Promise<ChatMsg[]> {
    const msgs: ChatMsg[] = [];

    const who = this.userName && this.userName !== "demo-user"
      ? ` The user is ${this.userName}; address them by name.`
      : "";
    msgs.push({
      role: "system",
      content:
        `You are Kiren, an autonomous coding agent working on the user's live sandbox.${who}\n` +
        `Goal: ${this.goal}\n\n` +
        `Working style:\n` +
        `1. Read relevant files before editing. Never guess file contents.\n` +
        `2. Reason step by step in plain text first, then call ONE tool at a time.\n` +
        `3. Watch the real tool result before the next call; if it failed, fix differently.\n` +
        `4. Verify with typecheck/tests/build before claiming success.\n` +
        `5. When the task is done, reply with a concise final text summary.`,
    });

    const mem = this.memory.getState();
    let ctx = `## Progress (step ${mem.step}/${mem.max_steps}, convergence ${mem.convergence_score}%)\n`;
    if (mem.files_read.length) ctx += `Files read: ${mem.files_read.join(", ")}\n`;
    if (mem.files_modified.length) ctx += `Files modified: ${mem.files_modified.join(", ")}\n`;
    if (mem.tests_passed !== null) ctx += `Tests: ${mem.tests_passed ? "PASSING" : "FAILING"}\n`;
    if (mem.constraints.length) ctx += `\n## Constraints (DO NOT):\n${mem.constraints.map((c) => `- ${c}`).join("\n")}\n`;
    if (mem.insights.length) ctx += `\n## Insights so far:\n${mem.insights.slice(-6).map((i) => `- ${i}`).join("\n")}\n`;

    if (this.sandboxId) {
      try {
        const ls = await SandboxService.execCommand(this.sandboxId, `ls -la ${this.workdir || "."} 2>/dev/null | head -40`, this.workdir);
        ctx += `\n## Workspace\n${ls.stdout || "(empty)"}\n`;
      } catch { ctx += `\n## Workspace\n(unavailable)\n`; }
    }
    msgs.push({ role: "user", content: ctx });

    // Prior transcript. Compact the leading edge when it grows large.
    const blocks = await this.loadBlocks();
    let prior = "";
    for (const b of blocks) {
      if (b.kind === "user") { prior += `\nUser: ${str(b.data?.text || b.data)}\n`; }
      if (b.kind === "text") { prior += `\nAssistant: ${str(b.data?.text)}\n`; }
      if (b.kind === "summary") { prior += `\n(Summary) ${str(b.data?.title)}\n`; }
    }
    const LIMIT = 6000; // ~24k tokens of recent dialogue kept verbatim
    if (prior.trim()) {
      const older = prior.slice(0, Math.max(0, prior.length - LIMIT));
      const recent = prior.slice(Math.max(0, prior.length - LIMIT));
      let text = "";
      if (older.length > 200) {
        const summary = await this.compact(older);
        if (summary) this.memory.recordInsight(`[compact] ${summary.slice(0, 500)}`);
        text = summary ? `[Earlier conversation compressed]\n${summary}\n${recent}` : `[Earlier conversation truncated]\n${recent}`;
      } else {
        text = recent;
      }
      msgs.push({ role: "user", content: text.trim() });
    }

    msgs.push({ role: "user", content: `Task: ${this.goal}` });
    return msgs;
  }

  /** Summarize an expiring older slice of the transcript. */
  private async compact(dialog: string): Promise<string> {
    try {
      const resp = await ModelProxy.chatCompletion(
        {
          model: this.modelId,
          messages: [{
            role: "user",
            content: `Compress this agent conversation into 4-6 bullet memory notes. Keep decisions, constraints, file paths, commands, and errors. Do not invent anything.\n\n${dialog}`,
          }],
          temperature: 0.2,
          max_tokens: 900,
        },
        this.userId,
        this.threadId,
      );
      return resp.choices?.[0]?.message?.content || "";
    } catch { return ""; }
  }

  /**
   * Execute one model turn: decide → optionally call a tool → observe.
   * Returns "completed" when the model answers in plain text, "wait_permission"
   * when a write tool needs a user decision, else "continue".
   */
  async step(step: number, availableTools: string[], startTime = Date.now()): Promise<TurnOutcome> {
    const t0 = Date.now();
    try {
      // A pending permission from a previous turn the user hasn't answered.
      if (this.pendingCall && !this.pendingCall.resolution) return "wait_permission";

      // The user answered a pending permission; act on it, then continue.
      if (this.pendingCall) {
        const p = this.pendingCall;
        this.pendingCall = null;
        if (p.resolution === "allow") await this.runToolCall(p.name, p.args);
        else await this.saveBlock("text", { text: `⚠️ You declined: ${p.name}. The agent will adjust.` });
        return "continue";
      }

      const cap = this.model()?.max_context ?? 200000;
      let used = 0;
      try {
        const r = await pool.query(`SELECT tokens_used FROM threads WHERE id = $1`, [this.threadId]);
        used = parseInt(r.rows[0]?.tokens_used || "0", 10);
      } catch {}
      if (used > cap * 0.7) {
        this.memory.recordInsight(`Context checkpoint: ${used.toLocaleString()}/${cap.toLocaleString()} tokens. Re-grounding on: ${this.goal.slice(0, 120)}`);
      }

      const reply = await modelCaller({
        model: this.modelId,
        messages: await this.buildMessages(),
        tools: this.openaiTools(),
        tool_choice: "auto",
        temperature: 0.2,
      }, this.userId, this.threadId);

      const msg = reply?.choices?.[0]?.message;
      const content: string = typeof msg?.content === "string" ? msg.content : "";
      const reasoning: string = msg?.reasoning_content || content || "";
      const toolCalls: any[] = msg?.tool_calls || [];

      // Surface the model's actual reasoning as a thinking block.
      if (reasoning.trim()) {
        await this.saveBlock("thinking", {
          text: reasoning.trim().slice(0, 1200),
          ms: Date.now() - t0,
          plan: toolCalls.length ? toolCalls.map((c) => `call ${c.function?.name}`) : [],
        });
      }

      // No tool call → that's the agent's answer.
      if (toolCalls.length === 0) {
        if (content.trim()) await this.saveBlock("text", { text: content });
        this.status = "completed";
        return "completed";
      }

      // Run each tool call in order, gating permission-required tools.
      for (const tc of toolCalls) {
        const name = (tc.function?.name || "").toLowerCase();
        const args = safeParse(tc.function?.arguments);
        const tool = this.tools.get(name);
        if (!tool) {
          await this.saveBlock("tool", { tool: name, icon: "wrench", target: "", meta: "unknown", status: "failed", output: [`Tool "${name}" not found.`] });
          continue;
        }
        if (tool.permission) {
          this.pendingCall = { callId: tc.id || uuid(), name, args };
          await this.saveBlock("permission", {
            tool: name,
            detail: humanArgs(name, args),
            request_id: this.pendingCall.callId,
            resolved: "pending",
          });
          return "wait_permission";
        }
        await this.runToolCall(name, args, tc);
      }
      return "continue";
    } catch (err: any) {
      if (this.status === "stopped") return "continue";
      console.error(`Agent loop step ${this.memory.getState().step} error:`, err);
      this.memory.recordFailure("system error", err.message, "Unexpected error");
      return "continue";
    }
  }

  /** Run one named tool, emit its block, update memory/usage. */
  private async runToolCall(name: string, args: any, call?: any): Promise<void> {
    const tool = this.tools.get(name);
    if (!tool) return;
    let output = "";
    let ok = true;
    try { output = await tool.execute(args); } catch (err: any) { output = `ERROR: ${err.message}`; ok = false; }

    try {
      await pool.query(
        `INSERT INTO usage (id, user_id, thread_id, model_id, feature, amount) VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuid(), this.userId, this.threadId, this.modelId, `tool:${name}`, 1]
      );
    } catch { /* non-critical */ }

    this.memory.trackFileRead(name === "read" || name === "grep" ? (args.path || args.pattern || "") : "");
    this.memory.trackFileModified(name === "write" || name === "edit" ? (args.path || "") : "");
    this.memory.trackCommand(name === "bash" ? (args.command || "") : "");

    if (ok) this.memory.recordSuccess(`${name}(${JSON.stringify(args).slice(0, 120)})`, output.slice(0, 200), "tool ok");
    else {
      this.memory.recordFailure(name, output.slice(0, 200), "tool failed");
      this.memory.recordInsight(`Do not blindly retry: ${name} failed → ${output.slice(0, 140)}`);
    }
    if (name === "bash" && /(^|\s)(test|vitest|jest)\b/.test(args.command || "")) {
      this.memory.setTestResults(!/FAIL|failed|Error/.test(output));
    }

    await this.saveBlock("tool", {
      tool: tool.name,
      icon: this.icon(name),
      target: args.path || args.command || args.pattern || name,
      meta: output.length > 200 ? `${output.length} chars` : output.slice(0, 100),
      status: ok ? "done" : "failed",
      output: output.split("\n").slice(0, 30),
    });
  }

  private icon(name: string): string {
    const map: Record<string, string> = {
      read: "file", write: "pencil", edit: "pencil", bash: "terminal", grep: "search", ls: "folder", git: "gitCommit",
    };
    if (name.startsWith("mcp:")) return "boxes";
    return map[name] || "wrench";
  }
}

export function safeParse(str: string | undefined): any {
  if (!str) return {};
  try { return JSON.parse(str); } catch { return {}; }
}

function humanArgs(name: string, args: any): string {
  const parts: string[] = [];
  if (args.path) parts.push(`file: ${args.path}`);
  if (args.command) parts.push(`command: ${args.command}`);
  if (args.pattern) parts.push(`pattern: ${args.pattern}`);
  if (parts.length) return parts.join(" · ");
  const s = JSON.stringify(args);
  return s && s !== "{}" ? s.slice(0, 200) : "(no args)";
}

function str(v: any): string {
  if (v == null) return "";
  return typeof v === "string" ? v : JSON.stringify(v);
}