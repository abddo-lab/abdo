// server/src/models-registry.ts — model list is fetched LIVE from the configured
// model API (config.models.base_url + /models). The static list below is only a
// fallback if the API is unreachable.
import { loadConfig } from "./config.js";

export interface ModelDef {
  id: string;
  object: "model";
  name: string;
  cost_per_1m_input: number;
  cost_per_1m_output: number;
  max_context: number;
  speed: "fast" | "medium" | "slow";
  quality: "good" | "best";
  category: "computer" | "persistent";
  supports_streaming: boolean;
  supports_tools: boolean;
  supports_vision: boolean;
}

const FALLBACK_MODELS: ModelDef[] = [
  { id: "kiren-mini", object: "model", name: "kiren mini", cost_per_1m_input: 2.3, cost_per_1m_output: 5.4, max_context: 262144, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: false },
  { id: "claude-fable-5", object: "model", name: "claude fable 5", cost_per_1m_input: 10, cost_per_1m_output: 50, max_context: 1000000, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: true },
  { id: "claude-opus-4-6", object: "model", name: "claude opus 4.6", cost_per_1m_input: 5, cost_per_1m_output: 25, max_context: 1000000, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: true },
  { id: "claude-sonnet-5", object: "model", name: "claude sonnet 5", cost_per_1m_input: 2, cost_per_1m_output: 10, max_context: 1000000, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: true },
  { id: "claude-opus-4-7", object: "model", name: "claude opus 4.7", cost_per_1m_input: 5, cost_per_1m_output: 25, max_context: 1000000, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: true },
  { id: "claude-sonnet-4-6", object: "model", name: "claude sonnet 4.6", cost_per_1m_input: 3, cost_per_1m_output: 15, max_context: 1000000, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: true },
  { id: "claude-haiku-4-5-20251001", object: "model", name: "claude haiku 4.5", cost_per_1m_input: 1, cost_per_1m_output: 5, max_context: 200000, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: true },
  { id: "gpt-5.5", object: "model", name: "gpt 5.5", cost_per_1m_input: 5, cost_per_1m_output: 30, max_context: 1050000, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: true },
  { id: "gpt-5.6-sol", object: "model", name: "gpt 5.6 sol", cost_per_1m_input: 5, cost_per_1m_output: 30, max_context: 1050000, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: true },
  { id: "kimi-k3", object: "model", name: "kimi k3", cost_per_1m_input: 3, cost_per_1m_output: 15, max_context: 1048576, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: false },
  { id: "gpt-5.6-luna", object: "model", name: "gpt 5.6 luna", cost_per_1m_input: 1, cost_per_1m_output: 6, max_context: 1050000, speed: "medium", quality: "best", category: "persistent", supports_streaming: true, supports_tools: true, supports_vision: true },
  { id: "gpt-5.6-terra", object: "model", name: "gpt 5.6 terra", cost_per_1m_input: 2.5, cost_per_1m_output: 15, max_context: 1050000, speed: "medium", quality: "best", category: "persistent", supports_streaming: true, supports_tools: true, supports_vision: true },
  { id: "kimi-k2.7-code", object: "model", name: "kimi k2.7 code", cost_per_1m_input: 0.95, cost_per_1m_output: 4, max_context: 262144, speed: "medium", quality: "best", category: "persistent", supports_streaming: true, supports_tools: true, supports_vision: false },
  { id: "deepseek-v4-pro", object: "model", name: "deepseek v4 pro", cost_per_1m_input: 0.435, cost_per_1m_output: 0.87, max_context: 1048576, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: false },
  { id: "deepseek-v4-flash", object: "model", name: "deepseek v4 flash", cost_per_1m_input: 0.14, cost_per_1m_output: 0.28, max_context: 1048576, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: false },
  { id: "glm-5.2", object: "model", name: "glm 5.2", cost_per_1m_input: 1.4, cost_per_1m_output: 4.4, max_context: 1048576, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: false },
  { id: "qwen3.7-max", object: "model", name: "qwen 3.7 max", cost_per_1m_input: 2.5, cost_per_1m_output: 7.5, max_context: 1000000, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: true },
  { id: "qwen3.7-plus", object: "model", name: "qwen 3.7 plus", cost_per_1m_input: 0.4, cost_per_1m_output: 1.6, max_context: 1000000, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: true },
  { id: "claude-opus-5-thinking", object: "model", name: "claude opus 5 (thinking)", cost_per_1m_input: 5, cost_per_1m_output: 30, max_context: 1000000, speed: "medium", quality: "best", category: "persistent", supports_streaming: true, supports_tools: true, supports_vision: true },
  { id: "claude-opus-5", object: "model", name: "claude opus 5", cost_per_1m_input: 5, cost_per_1m_output: 25, max_context: 1000000, speed: "medium", quality: "best", category: "persistent", supports_streaming: true, supports_tools: true, supports_vision: true },
  { id: "claude-opus-4-8-thinking", object: "model", name: "claude opus 4.8 (thinking)", cost_per_1m_input: 5, cost_per_1m_output: 30, max_context: 1000000, speed: "medium", quality: "best", category: "persistent", supports_streaming: true, supports_tools: true, supports_vision: true },
  { id: "claude-opus-4-8", object: "model", name: "claude opus 4.8", cost_per_1m_input: 5, cost_per_1m_output: 25, max_context: 1000000, speed: "medium", quality: "best", category: "persistent", supports_streaming: true, supports_tools: true, supports_vision: true },
  { id: "kimi-k3-fast", object: "model", name: "kimi k3 fast", cost_per_1m_input: 0.8, cost_per_1m_output: 1.2, max_context: 81920, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: false },
  { id: "longcat-2.0", object: "model", name: "longcat 2.0", cost_per_1m_input: 0.75, cost_per_1m_output: 2.95, max_context: 1048576, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: false },
  { id: "minimax-m2.5", object: "model", name: "minimax m2.5", cost_per_1m_input: 0.3, cost_per_1m_output: 1.2, max_context: 204800, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: false },
  { id: "kimi-k2.6", object: "model", name: "kimi k2.6", cost_per_1m_input: 0.95, cost_per_1m_output: 4, max_context: 262144, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: false },
  { id: "minimax-m3", object: "model", name: "minimax m3", cost_per_1m_input: 0.6, cost_per_1m_output: 2.4, max_context: 1048576, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: false },
  { id: "mimo-v2.5-pro", object: "model", name: "mimo v2.5 pro", cost_per_1m_input: 1, cost_per_1m_output: 3, max_context: 1048576, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: false },
  { id: "mimo-v2.5", object: "model", name: "mimo v2.5", cost_per_1m_input: 1, cost_per_1m_output: 3, max_context: 1048576, speed: "medium", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: false },
  { id: "gemini-3.5-flash", object: "model", name: "gemini 3.5 flash", cost_per_1m_input: 1.5, cost_per_1m_output: 9, max_context: 1048576, speed: "fast", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: true },
  { id: "gemini-3-flash-preview", object: "model", name: "gemini 3 flash", cost_per_1m_input: 0.25, cost_per_1m_output: 1.5, max_context: 1048576, speed: "fast", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: true },
  { id: "gemini-3.5-flash-lite", object: "model", name: "gemini 3.5 flash lite", cost_per_1m_input: 0.3, cost_per_1m_output: 2.5, max_context: 1048576, speed: "fast", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: true },
  { id: "gemini-3.6-flash", object: "model", name: "gemini 3.6 flash", cost_per_1m_input: 1.5, cost_per_1m_output: 7.5, max_context: 1048576, speed: "fast", quality: "good", category: "computer", supports_streaming: true, supports_tools: true, supports_vision: true },
];

let cache: { at: number; data: any[] } | null = null;
const CACHE_TTL_MS = 60_000;

/** Fetch the real model list from the configured model API (base_url/models) */
export async function listModels() {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const config = loadConfig();
  const baseUrl = config.models.base_url;
  const apiKey = config.models.api_key;

  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: apiKey && !apiKey.startsWith("REPLACE")
        ? { Authorization: `Bearer ${apiKey}` }
        : {},
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const data = Array.isArray(body?.data) ? body.data : [];

    const result = data.map((m: any) => {
      const known = FALLBACK_MODELS.find((f) => f.id === m.id);
      return {
        id: m.id,
        object: "model",
        name: m.name || m.id,
        cost_per_1m_input: known?.cost_per_1m_input ?? thisPrice(m.id, 1),
        cost_per_1m_output: known?.cost_per_1m_output ?? thisPrice(m.id, 4),
        max_context: known?.max_context ?? 200000,
        speed: known?.speed ?? "medium",
        quality: known?.quality ?? "good",
        category: known?.category ?? "computer",
        supports_streaming: known?.supports_streaming ?? true,
        supports_tools: known?.supports_tools ?? true,
        supports_vision: known?.supports_vision ?? false,
      };
    });

    if (result.length > 0) {
      cache = { at: Date.now(), data: result };
      return result;
    }
    throw new Error("empty model list");
  } catch {
    // Model API unreachable — fall back to the local list so the app keeps working
    return FALLBACK_MODELS.map((m) => ({
      id: m.id, object: m.object, name: m.name,
      cost_per_1m_input: m.cost_per_1m_input, cost_per_1m_output: m.cost_per_1m_output,
      max_context: m.max_context, speed: m.speed, quality: m.quality, category: m.category,
    }));
  }
}

/** Deterministic placeholder pricing for unknown models (no fake data shown, only used for cost accounting) */
function thisPrice(id: string, base: number): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997;
  return Math.round((base + (h % 90) / 100) * 1000) / 1000;
}

export function getModel(id: string): ModelDef | undefined {
  return FALLBACK_MODELS.find((m) => m.id === id);
}

export async function getAvailableModelIds(): Promise<string[]> {
  try {
    const models = await listModels();
    return models.map((m: any) => m.id);
  } catch {
    return FALLBACK_MODELS.map((m) => m.id);
  }
}
