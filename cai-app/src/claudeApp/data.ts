// ─── Modes ───
export const modeOptions = [
  { label: "Interactive", sub: "Ask before every tool call — approve or deny each action", kbd: "⇧⇥" },
  { label: "Plan", sub: "Deep research + step-by-step plan — you approve before execution", kbd: "⇧⇥" },
  { label: "Autopilot", sub: "Full autonomy — plans and executes without asking", kbd: "⇧⇥" },
];

// ─── Models ───
export interface ModelOption { name: string; desc: string; hint?: string; mark?: string; }
export const modelOptions: ModelOption[] = [
  { name: "Auto", desc: "Detects your task and routes to the best model", hint: "adaptive", mark: "DEFAULT" },
  { name: "claude-opus-5", desc: "Most capable Claude — 1M context, deep reasoning", hint: "1M ctx" },
  { name: "claude-opus-4-8", desc: "Claude Opus 4.8 — excellent for complex tasks", hint: "1M ctx" },
  { name: "claude-fable-5", desc: "Claude Fable 5 — balanced performance and creativity", hint: "1M ctx" },
  { name: "claude-sonnet-5", desc: "Claude Sonnet 5 — fast and capable", hint: "1M ctx" },
  { name: "gpt-5.6-luna", desc: "GPT 5.6 Luna — OpenAI's latest, 262K context", hint: "262K ctx" },
  { name: "gpt-5.6-sol", desc: "GPT 5.6 Sol — optimized for code generation", hint: "262K ctx" },
  { name: "gpt-5.6-terra", desc: "GPT 5.6 Terra — best for data analysis", hint: "262K ctx" },
  { name: "gpt 5.4 mini", desc: "GPT 5.4 Mini — fast and cost-efficient", hint: "262K ctx" },
  { name: "deepseek-v4-pro", desc: "DeepSeek V4 Pro — excellent code reasoning", hint: "1M ctx" },
  { name: "kimi k2.7 code", desc: "Kimi K2.7 Code — specialized for coding", hint: "262K ctx" },
  { name: "kimi-k3", desc: "Kimi K3 — large context, strong reasoning", hint: "1M ctx" },
  { name: "glm-5.2", desc: "GLM 5.2 — strong general capabilities", hint: "1M ctx" },
  { name: "mimo-v2.5-pro", desc: "Mimo V2.5 Pro — balanced coding assistant", hint: "1M ctx" },
  { name: "longcat-2.0", desc: "Longcat 2.0 — ultra-long context specialist", hint: "1M ctx" },
  { name: "gemini-3.6-flash", desc: "Gemini 3.6 Flash — Google's fastest model", hint: "1M ctx", mark: "FAST" },
  { name: "gemini-3.5-flash", desc: "Gemini 3.5 Flash — great for quick tasks", hint: "1M ctx" },
  { name: "minimax-m3", desc: "MiniMax M3 — free tier option", hint: "128K ctx", mark: "FREE" },
  { name: "creator-mini", desc: "Creator Mini — optimized for creative coding", hint: "1M ctx" },
];

// ─── Effort Levels — Two tiers: Thinking (x1.5) and UltraCode (x4) ───
export interface EffortLevel {
  label: string;
  value: "thinking" | "ultracode";
  desc: string;
  detail: string;
  apiParams: {
    temperature: number;
    thinking_budget?: number;
  };
  barLevel: number;
  costMultiplier: number;
  subagents: number;
  features: string[];
}

export const effortLevels: EffortLevel[] = [
  {
    label: "Zinc",
    value: "thinking",
    desc: "Medium thinking with self-correction chain",
    detail: "8 subagents, medium thinking budget, auto-correct errors",
    apiParams: { temperature: 0.3, thinking_budget: 32000 },
    barLevel: 3,
    costMultiplier: 1.5,
    subagents: 8,
    features: ["thinking", "self-correction", "planning"],
  },
  {
    label: "Manguzuime",
    value: "ultracode",
    desc: "Maximum quality — searching, thinking, planning, reasoning chain",
    detail: "12 subagents, max thinking, deep search + planning + reasoning",
    apiParams: { temperature: 0.1, thinking_budget: 256000 },
    barLevel: 5,
    costMultiplier: 4.0,
    subagents: 12,
    features: ["thinking", "searching", "planning", "reasoning", "self-correction", "verification"],
  },
];

// ─── Transcript types ───
export type ToolItem = { type: "tool"; label: string; detail?: string; failed?: boolean; };
export type TranscriptItem =
  | { type: "user"; text: string }
  | { type: "text"; text: string }
  | { type: "thought"; text: string }
  | { type: "system"; text: string }
  | ToolItem
  | { type: "files-edited"; files: { path: string; add: number; del: number }[] }
  | { type: "tools-used"; tools: { label: string; detail?: string }[] }
  | { type: "plan"; steps: { text: string; done: boolean }[] }
  | { type: "terminal"; cmd: string; out: string[] };

export const initialTranscript: TranscriptItem[] = [];
export const agentReplies = [
  "Done. Changes applied.",
  "Found the issue. Fixing now.",
  "Tests pass. Ready to commit.",
  "Code reviewed. Two suggestions below.",
  "Build complete. No errors.",
  "Analysis done. Summary above.",
  "File updated. Check the diff.",
  "All checks pass. Merging.",
  "Refactored. Complexity reduced.",
  "Deployed successfully.",
];
