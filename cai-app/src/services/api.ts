/**
 * API Service — all requests stream, quality over speed
 */

const MODEL_BASE = "http://crate.ftp.sh/v1";
const SERVICE_KEY = "mr-e7eacfbc9e634bb2847e87b0";

// ─── Model API ───
export interface ApiModel { id: string; object: string; created: number; owned_by: string; }
export interface ChatMessage { role: "system" | "user" | "assistant" | "tool"; content: string; tool_call_id?: string; }
export interface ChatUsage { prompt_tokens: number; completion_tokens: number; total_tokens: number; }
export interface ChatResponse { id: string; model: string; choices: Array<{ message: ChatMessage; finish_reason: string }>; usage: ChatUsage; }

// ─── Quality-focused temperatures (Claude Code style: low temp for code, higher for creative) ───
const QUALITY_TEMPS: Record<string, number> = {
  code: 0.2,
  reasoning: 0.3,
  analysis: 0.3,
  writing: 0.5,
  creative: 0.6,
  quick: 0.7,
};

function classifyTask(task: string): string {
  const lower = task.toLowerCase();
  if (/\b(fix|debug|error|bug|refactor|implement|write|create|build|code|function|class|test|commit|type|import|export)\b/.test(lower)) return "code";
  if (/\b(analyze|compare|evaluate|review|plan|design|architecture|reason|think|prove)\b/.test(lower)) return "reasoning";
  if (/\b(data|csv|json|sql|database|query|statistics|chart|graph|metrics)\b/.test(lower)) return "analysis";
  if (/\b(write|draft|compose|essay|article|blog|story|narrative|summary)\b/.test(lower)) return "writing";
  if (/\b(explain|describe|tell|show|list|name|what|how|why|when|where)\b/.test(lower)) return "quick";
  return "code";
}

// ─── Auto-route model based on task (quality routing) ───
export function autoRouteModel(task: string): string {
  const lower = task.toLowerCase();
  const has = (kws: string[]) => kws.some((k) => lower.includes(k));

  // Code tasks get the best code model
  if (has(["fix", "debug", "error", "bug", "refactor", "implement", "write", "create", "build", "code", "function", "class", "test", "commit", "push", "merge", "deploy", "pr", "pull request"])) return "claude-fable-5";
  // Reasoning gets deep thinker
  if (has(["analyze", "compare", "evaluate", "review", "plan", "design", "architecture", "trade", "pros and cons"])) return "kimi-k3";
  // Data tasks
  if (has(["data", "csv", "json", "sql", "database", "query", "table", "column", "row", "statistics", "chart", "graph"])) return "gpt-5.6-terra";
  // Quick questions use fast model
  if (has(["what", "how", "why", "when", "where", "who", "explain", "describe", "tell me", "show me", "list", "name"])) return "gemini-3.6-flash";
  // Default to best general model
  return "claude-fable-5";
}

// ─── Effort → API params (two-tier: Thinking x1.5, UltraCode x4) ───
export interface EffortParams {
  temperature: number;
  thinking: boolean;
  thinking_budget?: number;
}

export function effortToParams(effort: string): EffortParams {
  switch (effort.toLowerCase()) {
    case "thinking": return { temperature: 0.3, thinking: true, thinking_budget: 32000 };
    case "ultracode": return { temperature: 0.1, thinking: true, thinking_budget: 256000 };
    default: return { temperature: 0.3, thinking: true, thinking_budget: 32000 };
  }
}

// ─── Build messages with effort-based system prefix ───
function buildMessages(messages: ChatMessage[], effort: string): ChatMessage[] {
  const level = effort.toLowerCase();
  let prefix = "";

  if (level === "ultracode") {
    prefix = `You are operating at ULTRACODE maximum quality. This means:
- Think deeply and thoroughly before responding
- Consider all edge cases, failure modes, and alternatives
- Read relevant code/files before making claims
- Use searching, planning, and reasoning chains
- Provide the most accurate, complete answer possible
- If writing code, ensure it compiles, handles errors, and follows best practices
- Take as much time and tokens as needed for the best possible output
- Self-correct any errors automatically`;
  } else if (level === "thinking") {
    prefix = `You are operating at THINKING mode with self-correction:
- Think step by step before responding
- Consider multiple approaches before choosing one
- Read code to verify assumptions
- Provide thorough, well-reasoned responses
- Self-correct any errors automatically`;
  }

  if (prefix) {
    return [{ role: "system", content: prefix }, ...messages];
  }
  return messages;
}

// ─── Streaming chat completion (ALL requests stream) ───
export async function chatCompletion(
  model: string,
  messages: ChatMessage[],
  temperature?: number,
  effort?: string
): Promise<ChatResponse> {
  const resolvedModel = model === "Auto" ? autoRouteModel(messages.map((m) => m.content).join(" ")) : model;
  const taskType = classifyTask(messages.map((m) => m.content).join(" "));
  const params = effort ? effortToParams(effort) : { temperature: QUALITY_TEMPS[taskType] ?? 0.3 };
  const finalTemp = temperature ?? params.temperature;
  const finalMessages = effort ? buildMessages(messages, effort) : messages;

  // Stream internally but return full response
  let fullText = "";
  let usage: ChatUsage | undefined;

  const r = await fetch(`${MODEL_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ model: resolvedModel, messages: finalMessages, temperature: finalTemp, stream: true }),
  });
  if (!r.ok) throw new Error(`Chat error ${r.status}`);

  const reader = r.body?.getReader();
  if (!reader) throw new Error("No body");
  const dec = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t || t === "data: [DONE]" || !t.startsWith("data: ")) continue;
      try {
        const j = JSON.parse(t.slice(6));
        if (j.choices?.[0]?.delta?.content) fullText += j.choices[0].delta.content;
        if (j.usage) usage = j.usage;
      } catch {}
    }
  }

  return {
    id: `chatcmpl-${Date.now()}`,
    model: resolvedModel,
    choices: [{ message: { role: "assistant", content: fullText }, finish_reason: "stop" }],
    usage: usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

// ─── Streaming chat (for real-time display) ───
export async function chatStream(
  model: string,
  messages: ChatMessage[],
  onToken: (t: string) => void,
  onDone: (u?: ChatUsage) => void,
  onError: (e: Error) => void,
  temperature?: number,
  effort?: string
) {
  try {
    const resolvedModel = model === "Auto" ? autoRouteModel(messages.map((m) => m.content).join(" ")) : model;
    const taskType = classifyTask(messages.map((m) => m.content).join(" "));
    const params = effort ? effortToParams(effort) : { temperature: QUALITY_TEMPS[taskType] ?? 0.3 };
    const finalTemp = temperature ?? params.temperature;
    const finalMessages = effort ? buildMessages(messages, effort) : messages;

    const r = await fetch(`${MODEL_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ model: resolvedModel, messages: finalMessages, temperature: finalTemp, stream: true }),
    });
    if (!r.ok) throw new Error(`Stream error ${r.status}`);
    const reader = r.body?.getReader();
    if (!reader) throw new Error("No body");
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t || t === "data: [DONE]" || !t.startsWith("data: ")) continue;
        try {
          const j = JSON.parse(t.slice(6));
          if (j.choices?.[0]?.delta?.content) onToken(j.choices[0].delta.content);
          if (j.choices?.[0]?.finish_reason === "stop") onDone(j.usage);
        } catch {}
      }
    }
    onDone();
  } catch (err) { onError(err instanceof Error ? err : new Error(String(err))); }
}

// Model pricing
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "minimax-m3": { input: 0, output: 0 },
  "gpt 5.4 mini": { input: 0.55, output: 3.25 },
  "gpt-5.6-luna": { input: 0.55, output: 3.25 },
  "gpt-5.6-sol": { input: 0.55, output: 3.25 },
  "gpt-5.6-terra": { input: 0.55, output: 3.25 },
  "claude-opus-5": { input: 0.43, output: 0.87 },
  "claude-opus-4-8": { input: 0.43, output: 0.87 },
  "claude-fable-5": { input: 0.43, output: 0.87 },
  "claude-sonnet-5": { input: 0.43, output: 0.87 },
  "kimi k2.7 code": { input: 0.55, output: 3.25 },
  "deepseek-v4-pro": { input: 0.43, output: 0.87 },
  "glm-5.2": { input: 0.82, output: 2.59 },
  "creator-mini": { input: 1.0, output: 5.0 },
  "kimi-k3": { input: 3.0, output: 15.0 },
  "longcat-2.0": { input: 0.3, output: 1.2 },
  "mimo-v2.5-pro": { input: 0.43, output: 0.87 },
  "gemini-3.5-flash": { input: 1.5, output: 7.5 },
  "gemini-3.6-flash": { input: 1.5, output: 7.5 },
};
export function estimateCost(model: string, inTok: number, outTok: number): number {
  const p = MODEL_PRICING[model] ?? MODEL_PRICING["claude-fable-5"];
  return (inTok / 1e6) * p.input + (outTok / 1e6) * p.output;
}

// ─── GitHub API ───
const GITHUB_API = "https://api.github.com";

export interface GitHubUser { login: string; avatar_url: string; name: string; email: string; }
export interface GitHubRepo { id: number; full_name: string; default_branch: string; private: boolean; description: string; }
export interface GitHubBranch { name: string; commit: { sha: string; message: string; }; }
export interface GitHubFile { path: string; name: string; type: "file" | "dir"; sha: string; size?: number; content?: string; download_url?: string; }
export interface GitHubPR { id: number; number: number; title: string; state: string; html_url: string; head: { ref: string }; base: { ref: string }; updated_at: string; additions: number; deletions: number; changed_files: number; }

async function ghFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${GITHUB_API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", ...init?.headers } });
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${await r.text()}`);
  return r.json();
}

export const githubAPI = {
  getUser: (token: string) => ghFetch<GitHubUser>(token, "/user"),
  getRepos: (token: string, page = 1) => ghFetch<GitHubRepo[]>(token, `/user/repos?per_page=100&page=${page}&sort=updated`),
  getBranches: (token: string, owner: string, repo: string) => ghFetch<GitHubBranch[]>(token, `/repos/${owner}/${repo}/branches`),
  getFiles: (token: string, owner: string, repo: string, path = "", ref?: string) =>
    ghFetch<GitHubFile[]>(token, `/repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${ref}` : ""}`),
  getFileContent: async (token: string, owner: string, repo: string, path: string, ref?: string): Promise<string> => {
    const f = await ghFetch<GitHubFile & { content: string; encoding: string }>(token, `/repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${ref}` : ""}`);
    if (f.encoding === "base64") return atob(f.content.replace(/\n/g, ""));
    return f.content;
  },
  getPRs: (token: string, owner: string, repo: string, state: "open" | "closed" | "all" = "open") =>
    ghFetch<GitHubPR[]>(token, `/repos/${owner}/${repo}/pulls?state=${state}&per_page=50`),
  createBranch: (token: string, owner: string, repo: string, branch: string, sha: string) =>
    ghFetch(token, `/repos/${owner}/${repo}/git/refs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }) }),
  createPR: (token: string, owner: string, repo: string, title: string, head: string, base: string, body?: string) =>
    ghFetch<GitHubPR>(token, `/repos/${owner}/${repo}/pulls`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, head, base, body }) }),
  getWorkflows: (token: string, owner: string, repo: string) =>
    ghFetch<{ workflows: Array<{ id: number; name: string; state: string; path: string }> }>(token, `/repos/${owner}/${repo}/actions/workflows`),
  dispatchWorkflow: (token: string, owner: string, repo: string, workflowId: number, ref: string, inputs?: Record<string, string>) =>
    ghFetch(token, `/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref, inputs }) }),
  getFileTree: async (token: string, owner: string, repo: string, path = "", ref?: string): Promise<GitHubFile[]> => {
    return ghFetch<GitHubFile[]>(token, `/repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${ref}` : ""}`);
  },
};

// ─── Daytona Sandbox API ───
const DAYTONA_API = "https://app.daytona.io/api";

export interface DaytonaSandbox { id: string; name: string; state: string; publicDomain?: string; }

export const daytonaAPI = {
  createSandbox: async (apiKey: string, name: string, repoUrl: string): Promise<DaytonaSandbox> => {
    const r = await fetch(`${DAYTONA_API}/sandboxes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ name, repository: { url: repoUrl }, autoStopInterval: 60 }),
    });
    if (!r.ok) throw new Error(`Daytona error ${r.status}`);
    return r.json();
  },
  getSandbox: async (apiKey: string, id: string): Promise<DaytonaSandbox> => {
    const r = await fetch(`${DAYTONA_API}/sandboxes/${id}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!r.ok) throw new Error(`Daytona error ${r.status}`);
    return r.json();
  },
  listSandboxes: async (apiKey: string): Promise<DaytonaSandbox[]> => {
    const r = await fetch(`${DAYTONA_API}/sandboxes`, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!r.ok) throw new Error(`Daytona error ${r.status}`);
    return r.json();
  },
  stopSandbox: async (apiKey: string, id: string): Promise<void> => {
    await fetch(`${DAYTONA_API}/sandboxes/${id}/stop`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` } });
  },
  deleteSandbox: async (apiKey: string, id: string): Promise<void> => {
    await fetch(`${DAYTONA_API}/sandboxes/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${apiKey}` } });
  },
};

// ─── FreeDNS (afraid.org) for deploy preview ───
export async function getDeployUrl(subdomain: string): Promise<string> {
  return `https://${subdomain}.z0.bot.nu`;
}
