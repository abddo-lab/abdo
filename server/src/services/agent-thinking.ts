// server/src/services/agent-thinking.ts — Structured thinking before every action
import { ModelProxy } from "./model-proxy.js";
import type { AgentMemory, AgentState } from "./agent-memory.js";

export interface ThinkingResult {
  reasoning: string;
  plan: string[];
  chosen_action: string;
  expected_outcome: string;
  risk_assessment: string;
  alternative_if_fails: string;
  confidence: number; // 0-100
}

export interface DeepThinkResult {
  situation: string;
  goal_restated: string;
  constraints: string[];
  memory_review: string;
  hypotheses: string[];
  best_plan: string[];
  risks: string[];
  quality_checks: string[];
  decision: string;
  alternative: string;
}

export interface CorrectionResult {
  what_went_wrong: string;
  root_cause: string;
  new_approach: string;
  should_retry: boolean;
  should_switch_strategy: boolean;
  lesson_learned: string;
}

export class AgentThinking {
  private modelId: string;
  private userId: string;
  private threadId: string;

  constructor(modelId: string, userId: string, threadId: string) {
    this.modelId = modelId;
    this.userId = userId;
    this.threadId = threadId;
  }

  /**
   * DEEP THINK — forced before every MSF step, subagent invocation and MCP call.
   * Produces a structured, quality-first analysis: memory review → hypotheses →
   * plan → risks → quality checks → decision → alternative. Never shortcuts.
   */
  async deepThink(
    goal: string,
    currentContext: string,
    memory: AgentMemory,
    availableTools: string[],
    phase: "msf" | "subagent" | "mcp" | "verify" | "final",
  ): Promise<DeepThinkResult> {
    const memoryContext = memory.getContextString();
    const phaseLabel = {
      msf: "MSF step (memory-first sequence)",
      subagent: "delegating to a subagent",
      mcp: "invoking an MCP tool",
      verify: "verifying the result",
      final: "final quality review",
    }[phase];

    const prompt = `You are an autonomous coding agent that values QUALITY OVER SPEED. Before the ${phaseLabel} you must think deeply and completely.

## Goal
${goal}

## Current Context
${currentContext}

## Memory (always read this first)
${memoryContext}

## Available Tools
${availableTools.join(", ")}

## Deep-Thinking Instructions
Think thoroughly before acting. Consider EVERY aspect:
1. What is the situation, precisely?
2. Restate the goal in your own words.
3. What constraints exist (memory, tool limits, context budget)?
4. Review your memory: what worked, what failed, what lessons learned?
5. Generate 3+ hypotheses about the best approach.
6. Pick the best plan as concrete steps.
7. What risks does each step carry, and how to mitigate?
8. What quality checks prove the work is correct (build, tests, typecheck, preview)?
9. Decide the single best next action.
10. What is the fallback if this fails?

## Quality Bar
- Prefer the CORRECT solution over the fast one.
- Never hallucinate tool output — always wait for real results.
- Verify with real checks (compile, tests, preview) before claiming success.
- If a step fails, understand WHY before retrying differently.

Respond in this exact JSON format:
{
  "situation": "Precise description of the current situation",
  "goal_restated": "The goal in your own words",
  "constraints": ["constraint 1", "constraint 2"],
  "memory_review": "What memory says about what worked/failed so far",
  "hypotheses": ["hypothesis 1", "hypothesis 2", "hypothesis 3"],
  "best_plan": ["concrete step 1", "concrete step 2"],
  "risks": ["risk with mitigation"],
  "quality_checks": ["check that proves correctness"],
  "decision": "The single best next action (a tool call)",
  "alternative": "Fallback if this fails"
}

IMPORTANT: If the decision uses an MCP tool (name starts with "mcp:"), it MUST be a JSON string exactly like {"tool":"mcp:server:tool","args":{"arg":"value"}}.
IMPORTANT: Respond ONLY with the JSON object, no other text.`;

    try {
      const result = await ModelProxy.chatCompletion({
        model: this.modelId,
        messages: [
          { role: "system", content: "You are a deep reasoning engine. Always respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }, this.userId, this.threadId);

      const content = result.choices?.[0]?.message?.content || "";
      const parsed = JSON.parse(content);
      return {
        situation: parsed.situation || "",
        goal_restated: parsed.goal_restated || goal,
        constraints: parsed.constraints || [],
        memory_review: parsed.memory_review || "",
        hypotheses: parsed.hypotheses || [],
        best_plan: parsed.best_plan || [],
        risks: parsed.risks || [],
        quality_checks: parsed.quality_checks || [],
        decision: parsed.decision || "",
        alternative: parsed.alternative || "",
      };
    } catch {
      return {
        situation: "Deep thinking failed; using lightweight thinking",
        goal_restated: goal,
        constraints: [],
        memory_review: memoryContext.slice(0, 500),
        hypotheses: [],
        best_plan: ["Proceed carefully with available tools"],
        risks: ["Unknown"],
        quality_checks: ["Verify the actual tool output"],
        decision: "Read the current state and take the next careful step",
        alternative: "Try a different approach",
      };
    }
  }

  /** Think before acting — structured reasoning */
  async think(
    goal: string,
    currentContext: string,
    memory: AgentMemory,
    availableTools: string[],
  ): Promise<ThinkingResult> {
    const state = memory.getState();
    const memoryContext = memory.getContextString();

    const prompt = `You are an autonomous coding agent. Before taking any action, you must think step by step.

## Your Goal
${goal}

## Current Context
${currentContext}

## Your Memory
${memoryContext}

## Available Tools
${availableTools.join(", ")}

## Instructions
Think through this step by step. Consider:
1. What is the current situation?
2. What have you already tried? (check memory)
3. What is the most promising next action?
4. What could go wrong?
5. What's your fallback if this fails?

Respond in this exact JSON format:
{
  "reasoning": "Your step-by-step reasoning about the situation...",
  "plan": ["step 1", "step 2", "step 3"],
  "chosen_action": "The specific tool call you will make",
  "expected_outcome": "What you expect to happen",
  "risk_assessment": "What could go wrong",
  "alternative_if_fails": "What to try if this fails",
  "confidence": 75
}

IMPORTANT: If the chosen action uses an MCP tool (its name starts with "mcp:"), the "chosen_action" field MUST be a JSON string exactly like {"tool":"mcp:server:tool","args":{"arg":"value"}} with the argument names and types from the tool's Args list — never natural language for MCP calls.

IMPORTANT: Respond ONLY with the JSON object, no other text.`;

    try {
      const result = await ModelProxy.chatCompletion({
        model: this.modelId,
        messages: [
          { role: "system", content: "You are a structured reasoning engine. Always respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }, this.userId, this.threadId);

      const content = result.choices?.[0]?.message?.content || "";
      const parsed = JSON.parse(content);
      return {
        reasoning: parsed.reasoning || "",
        plan: parsed.plan || [],
        chosen_action: parsed.chosen_action || "",
        expected_outcome: parsed.expected_outcome || "",
        risk_assessment: parsed.risk_assessment || "",
        alternative_if_fails: parsed.alternative_if_fails || "",
        confidence: parsed.confidence || 50,
      };
    } catch {
      return {
        reasoning: "Thinking failed, proceeding with default action",
        plan: ["Continue with available tools"],
        chosen_action: "Read relevant files to understand the situation",
        expected_outcome: "Better understanding of the codebase",
        risk_assessment: "Low risk",
        alternative_if_fails: "Try a different file or approach",
        confidence: 30,
      };
    }
  }

  /** Self-correct after a failure */
  async correct(
    goal: string,
    failedAction: string,
    error: string,
    memory: AgentMemory,
  ): Promise<CorrectionResult> {
    const state = memory.getState();
    const memoryContext = memory.getContextString();

    const prompt = `You are an autonomous coding agent that just encountered a failure. Analyze what went wrong and determine the best corrective action.

## Goal
${goal}

## What Failed
Action: ${failedAction}
Error: ${error}

## Memory Context
${memoryContext}

## Previous Failures (avoid repeating)
${state.failures.slice(-5).map((f) => `- ${f.action}: ${f.result} (learned: ${f.learned})`).join("\n")}

## Instructions
Analyze the failure and determine:
1. What exactly went wrong?
2. What is the root cause?
3. Should we retry the same action, or switch to a different approach?
4. What specific lesson should we remember?

Respond in this exact JSON format:
{
  "what_went_wrong": "Clear description of the failure",
  "root_cause": "The underlying cause",
  "new_approach": "Specific new approach to try",
  "should_retry": false,
  "should_switch_strategy": true,
  "lesson_learned": "What to remember for future steps"
}

IMPORTANT: Respond ONLY with the JSON object.`;

    try {
      const result = await ModelProxy.chatCompletion({
        model: this.modelId,
        messages: [
          { role: "system", content: "You are a failure analysis engine. Always respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 1000,
      }, this.userId, this.threadId);

      const content = result.choices?.[0]?.message?.content || "";
      const parsed = JSON.parse(content);
      return {
        what_went_wrong: parsed.what_went_wrong || error,
        root_cause: parsed.root_cause || "unknown",
        new_approach: parsed.new_approach || "try something different",
        should_retry: parsed.should_retry ?? false,
        should_switch_strategy: parsed.should_switch_strategy ?? true,
        lesson_learned: parsed.lesson_learned || "",
      };
    } catch {
      return {
        what_went_wrong: error,
        root_cause: "Analysis failed",
        new_approach: "Try a completely different approach",
        should_retry: false,
        should_switch_strategy: true,
        lesson_learned: `Failed: ${failedAction}`,
      };
    }
  }

  /** Verify if the goal has been achieved */
  async verify(
    goal: string,
    currentContext: string,
    memory: AgentMemory,
  ): Promise<{ achieved: boolean; confidence: number; evidence: string; next_steps: string[] }> {
    const memoryContext = memory.getContextString();

    const prompt = `You are a verification engine. Determine if the coding goal has been achieved.

## Goal
${goal}

## Current State
${currentContext}

## Memory
${memoryContext}

## Instructions
Carefully evaluate:
1. Has the goal been fully achieved?
2. What evidence supports this?
3. Are there any remaining issues?
4. What would need to happen next if not complete?

Respond in JSON:
{
  "achieved": true/false,
  "confidence": 85,
  "evidence": "What proves the goal is achieved (or not)",
  "next_steps": ["step 1", "step 2"] // empty if achieved
}

ONLY respond with JSON.`;

    try {
      const result = await ModelProxy.chatCompletion({
        model: this.modelId,
        messages: [
          { role: "system", content: "You are a verification engine. Respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 800,
      }, this.userId, this.threadId);

      const content = result.choices?.[0]?.message?.content || "";
      const parsed = JSON.parse(content);
      return {
        achieved: parsed.achieved ?? false,
        confidence: parsed.confidence ?? 0,
        evidence: parsed.evidence || "",
        next_steps: parsed.next_steps || [],
      };
    } catch {
      return { achieved: false, confidence: 0, evidence: "Verification failed", next_steps: ["Continue working"] };
    }
  }

  /** Generate a plan before starting work */
  async generatePlan(goal: string, codebaseContext: string): Promise<string[]> {
    const prompt = `You are a planning engine. Create a detailed step-by-step plan for this coding task.

## Goal
${goal}

## Codebase Context
${codebaseContext}

## Instructions
Create a concrete, actionable plan. Each step should be specific and verifiable.
Consider:
1. What files need to be read first?
2. What changes need to be made?
3. What tests need to be run?
4. What could go wrong at each step?

Respond in JSON:
{
  "plan": [
    "Step 1: Read and understand the relevant files",
    "Step 2: Make the specific change X in file Y",
    "Step 3: Run tests to verify",
    "Step 4: Fix any issues found"
  ],
  "risks": ["risk 1", "risk 2"],
  "files_to_read": ["file1.ts", "file2.ts"]
}

ONLY respond with JSON.`;

    try {
      const result = await ModelProxy.chatCompletion({
        model: this.modelId,
        messages: [
          { role: "system", content: "You are a planning engine. Respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }, this.userId, this.threadId);

      const content = result.choices?.[0]?.message?.content || "";
      const parsed = JSON.parse(content);
      return parsed.plan || ["Understand the task", "Make changes", "Verify"];
    } catch {
      return ["Understand the task", "Read relevant files", "Make changes", "Run tests", "Verify"];
    }
  }
}
