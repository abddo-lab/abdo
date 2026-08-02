// server/src/services/agent-memory.ts — Agent memory: track what was tried, what worked, what failed
import pool from "../db.js";
import { v4 as uuid } from "uuid";

export interface MemoryEntry {
  id: string;
  thread_id: string;
  kind: "attempt" | "success" | "failure" | "insight" | "constraint" | "context";
  step: number;
  action: string;
  result: string;
  learned: string;
  timestamp: number;
}

export interface AgentState {
  thread_id: string;
  goal: string;
  step: number;
  max_steps: number;
  attempts: MemoryEntry[];
  successes: MemoryEntry[];
  failures: MemoryEntry[];
  insights: string[];
  constraints: string[];
  current_approach: string;
  alternative_approaches: string[];
  files_read: string[];
  files_modified: string[];
  commands_run: string[];
  tests_passed: boolean | null;
  convergence_score: number; // 0-100, higher = closer to solution
}

export class AgentMemory {
  private state: AgentState;

  constructor(threadId: string, goal: string, maxSteps = 50) {
    this.state = {
      thread_id: threadId,
      goal,
      step: 0,
      max_steps: maxSteps,
      attempts: [],
      successes: [],
      failures: [],
      insights: [],
      constraints: [],
      current_approach: "",
      alternative_approaches: [],
      files_read: [],
      files_modified: [],
      commands_run: [],
      tests_passed: null,
      convergence_score: 0,
    };
  }

  /** Get current state */
  getState(): AgentState {
    return { ...this.state };
  }

  /** Restore a previously snapshotted state (multi-request resumption) */
  restore(state: AgentState): void {
    this.state = {
      ...state,
      attempts: [...(state.attempts || [])],
      successes: [...(state.successes || [])],
      failures: [...(state.failures || [])],
      insights: [...(state.insights || [])],
      constraints: [...(state.constraints || [])],
      files_read: [...(state.files_read || [])],
      files_modified: [...(state.files_modified || [])],
      commands_run: [...(state.commands_run || [])],
      alternative_approaches: [...(state.alternative_approaches || [])],
    };
  }

  /** Advance to next step */
  nextStep(): number {
    this.state.step++;
    return this.state.step;
  }

  /** Check if we should keep going */
  shouldContinue(): boolean {
    if (this.state.step >= this.state.max_steps) return false;
    if (this.state.convergence_score >= 100) return false;
    // If we've been stuck at same convergence for 10 steps, try alternative
    if (this.state.failures.length >= 10 && this.state.convergence_score < 20) {
      return this.state.alternative_approaches.length > 0;
    }
    return true;
  }

  /** Record an attempt */
  recordAttempt(action: string, result: string, learned: string): MemoryEntry {
    const entry: MemoryEntry = {
      id: uuid(),
      thread_id: this.state.thread_id,
      kind: "attempt",
      step: this.state.step,
      action,
      result,
      learned,
      timestamp: Date.now(),
    };
    this.state.attempts.push(entry);
    this.saveToDb(entry);
    return entry;
  }

  /** Record a success */
  recordSuccess(action: string, result: string, learned: string): MemoryEntry {
    const entry: MemoryEntry = {
      id: uuid(),
      thread_id: this.state.thread_id,
      kind: "success",
      step: this.state.step,
      action,
      result,
      learned,
      timestamp: Date.now(),
    };
    this.state.successes.push(entry);
    this.state.convergence_score = Math.min(100, this.state.convergence_score + 15);
    this.saveToDb(entry);
    return entry;
  }

  /** Record a failure */
  recordFailure(action: string, result: string, learned: string): MemoryEntry {
    const entry: MemoryEntry = {
      id: uuid(),
      thread_id: this.state.thread_id,
      kind: "failure",
      step: this.state.step,
      action,
      result,
      learned,
      timestamp: Date.now(),
    };
    this.state.failures.push(entry);
    // Decrease convergence on failure
    this.state.convergence_score = Math.max(0, this.state.convergence_score - 5);
    this.saveToDb(entry);
    return entry;
  }

  /** Record an insight */
  recordInsight(insight: string): void {
    this.state.insights.push(insight);
    this.state.convergence_score = Math.min(100, this.state.convergence_score + 5);
    const entry: MemoryEntry = {
      id: uuid(),
      thread_id: this.state.thread_id,
      kind: "insight",
      step: this.state.step,
      action: "insight",
      result: "",
      learned: insight,
      timestamp: Date.now(),
    };
    this.saveToDb(entry);
  }

  /** Record a constraint (something we must not do) */
  recordConstraint(constraint: string): void {
    this.state.constraints.push(constraint);
  }

  /** Set current approach */
  setApproach(approach: string): void {
    this.state.current_approach = approach;
  }

  /** Add alternative approach when current one fails */
  addAlternative(approach: string): void {
    if (!this.state.alternative_approaches.includes(approach)) {
      this.state.alternative_approaches.push(approach);
    }
  }

  /** Switch to next alternative approach */
  switchApproach(): string | null {
    if (this.state.alternative_approaches.length === 0) return null;
    const next = this.state.alternative_approaches.shift()!;
    this.state.current_approach = next;
    return next;
  }

  /** Track file read */
  trackFileRead(path: string): void {
    if (!this.state.files_read.includes(path)) {
      this.state.files_read.push(path);
    }
  }

  /** Track file modification */
  trackFileModified(path: string): void {
    if (!this.state.files_modified.includes(path)) {
      this.state.files_modified.push(path);
    }
  }

  /** Track command run */
  trackCommand(cmd: string): void {
    this.state.commands_run.push(cmd);
  }

  /** Set test results */
  setTestResults(passed: boolean): void {
    this.state.tests_passed = passed;
    if (passed) {
      this.state.convergence_score = Math.min(100, this.state.convergence_score + 20);
    }
  }

  /** Get context string for the LLM */
  getContextString(): string {
    const s = this.state;
    let ctx = `## Agent Memory (Step ${s.step}/${s.max_steps})\n`;
    ctx += `Goal: ${s.goal}\n`;
    ctx += `Convergence: ${s.convergence_score}%\n`;
    ctx += `Current approach: ${s.current_approach || "none"}\n\n`;

    if (s.insights.length > 0) {
      ctx += `### Key Insights\n`;
      s.insights.slice(-5).forEach((i) => { ctx += `- ${i}\n`; });
      ctx += "\n";
    }

    if (s.constraints.length > 0) {
      ctx += `### Constraints (DO NOT)\n`;
      s.constraints.forEach((c) => { ctx += `- ${c}\n`; });
      ctx += "\n";
    }

    if (s.failures.length > 0) {
      ctx += `### Recent Failures (avoid these)\n`;
      s.failures.slice(-5).forEach((f) => {
        ctx += `- Step ${f.step}: ${f.action} → ${f.result}\n`;
        ctx += `  Learned: ${f.learned}\n`;
      });
      ctx += "\n";
    }

    if (s.successes.length > 0) {
      ctx += `### Recent Successes\n`;
      s.successes.slice(-3).forEach((su) => {
        ctx += `- Step ${su.step}: ${su.action} → ${su.learned}\n`;
      });
      ctx += "\n";
    }

    if (s.alternative_approaches.length > 0) {
      ctx += `### Alternative Approaches Available\n`;
      s.alternative_approaches.forEach((a) => { ctx += `- ${a}\n`; });
      ctx += "\n";
    }

    ctx += `Files read: ${s.files_read.length} | Files modified: ${s.files_modified.length} | Commands: ${s.commands_run.length}\n`;
    if (s.tests_passed !== null) ctx += `Tests: ${s.tests_passed ? "PASSING ✓" : "FAILING ✗"}\n`;

    return ctx;
  }

  /** Load memory from DB for resumption */
  static async load(threadId: string): Promise<AgentMemory> {
    const result = await pool.query(
      `SELECT * FROM thread_blocks WHERE thread_id = $1 AND kind IN ('memory_attempt', 'memory_success', 'memory_failure', 'memory_insight')
       ORDER BY sort_order ASC`,
      [threadId]
    );

    const mem = new AgentMemory(threadId, "resumed");
    for (const row of result.rows) {
      const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      if (data.memory_kind === "insight") mem.state.insights.push(data.learned);
      if (data.memory_kind === "failure") mem.state.failures.push(data);
      if (data.memory_kind === "success") mem.state.successes.push(data);
    }
    return mem;
  }

  private async saveToDb(entry: MemoryEntry): Promise<void> {
    try {
      const maxOrder = await pool.query(
        `SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM thread_blocks WHERE thread_id = $1`,
        [this.state.thread_id]
      );
      await pool.query(
        `INSERT INTO thread_blocks (id, thread_id, kind, data, sort_order) VALUES ($1, $2, $3, $4, $5)`,
        [uuid(), this.state.thread_id, `memory_${entry.kind}`, JSON.stringify({
          memory_kind: entry.kind,
          step: entry.step,
          action: entry.action,
          result: entry.result,
          learned: entry.learned,
        }), maxOrder.rows[0].next]
      );
    } catch (err) { /* non-critical */ }
  }
}
