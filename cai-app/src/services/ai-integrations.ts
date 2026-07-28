/**
 * AI Integrations — Provider management, model selection, API keys
 * Fetches real models from /v1/models endpoint
 */

import { settingsDB } from "./db";

const MODEL_BASE = "http://crate.ftp.sh/v1";
const SERVICE_KEY = "mr-e7eacfbc9e634bb2847e87b0";

// ─── Types ───
export interface AiModel {
  id: string;
  name: string;
  displayName: string;
  provider: AiProvider;
  maxContext: number;
  costPer1mInput: number;
  costPer1mOutput: number;
  speed: "fast" | "medium" | "slow";
  quality: "best" | "good" | "standard";
  category: "computer" | "persistent";
  icon: string;
  description: string;
}

export type AiProvider =
  | "anthropic"
  | "openai"
  | "google"
  | "kimi"
  | "minimax"
  | "deepseek"
  | "zhipu"
  | "moonshot"
  | "caretx"
  | "other";

export interface AiProviderInfo {
  id: AiProvider;
  name: string;
  icon: string;
  description: string;
  website: string;
  apiKeyRequired: boolean;
  models: AiModel[];
}

export interface AiIntegrationSettings {
  defaultProvider: AiProvider;
  defaultModel: string;
  apiKeys: Record<string, string>;
  customEndpoints: Array<{ name: string; url: string; key: string }>;
}

// ─── Provider metadata ───
const PROVIDER_META: Record<AiProvider, Omit<AiProviderInfo, "models">> = {
  anthropic: { id: "anthropic", name: "Anthropic", icon: "anthropic", description: "Claude -- advanced reasoning, coding, and analysis", website: "https://anthropic.com", apiKeyRequired: false },
  openai: { id: "openai", name: "OpenAI", icon: "openai", description: "GPT -- versatile language models", website: "https://openai.com", apiKeyRequired: false },
  google: { id: "google", name: "Google", icon: "google", description: "Gemini -- fast, multimodal AI", website: "https://ai.google.dev", apiKeyRequired: false },
  kimi: { id: "kimi", name: "Kimi (Moonshot)", icon: "kimi", description: "Kimi -- long-context specialist", website: "https://kimi.moonshot.cn", apiKeyRequired: false },
  minimax: { id: "minimax", name: "MiniMax", icon: "minimax", description: "MiniMax -- free tier, good quality", website: "https://minimax.io", apiKeyRequired: false },
  deepseek: { id: "deepseek", name: "DeepSeek", icon: "deepseek", description: "DeepSeek -- excellent code reasoning", website: "https://deepseek.com", apiKeyRequired: false },
  zhipu: { id: "zhipu", name: "Zhipu AI", icon: "zhipu", description: "GLM -- strong general capabilities", website: "https://zhipuai.cn", apiKeyRequired: false },
  moonshot: { id: "moonshot", name: "Moonshot AI", icon: "moonshot", description: "Moonshot -- large context models", website: "https://moonshot.cn", apiKeyRequired: false },
  caretx: { id: "caretx", name: "Caret X", icon: "caretx", description: "Caret X -- optimized for coding", website: "https://caret.ai", apiKeyRequired: false },
  other: { id: "other", name: "Other", icon: "custom", description: "Custom or self-hosted models", website: "", apiKeyRequired: false },
};

// ─── Model metadata (enrichment) ───
const MODEL_META: Record<string, { provider: AiProvider; icon: string; description: string }> = {
  "claude-opus-5": { provider: "anthropic", icon: "claude", description: "Most capable Claude -- 1M context, deep reasoning" },
  "claude-opus-4-8": { provider: "anthropic", icon: "claude", description: "Claude Opus 4.8 -- excellent for complex tasks" },
  "claude-fable-5": { provider: "anthropic", icon: "claude", description: "Claude Fable 5 -- balanced performance and creativity" },
  "claude-sonnet-5": { provider: "anthropic", icon: "claude", description: "Claude Sonnet 5 -- fast and capable" },
  "gpt 5.4 mini": { provider: "openai", icon: "gpt", description: "GPT 5.4 Mini -- fast and cost-efficient" },
  "gpt-5.6-luna": { provider: "openai", icon: "gpt", description: "GPT 5.6 Luna -- OpenAI's latest, 262K context" },
  "gpt-5.6-sol": { provider: "openai", icon: "gpt", description: "GPT 5.6 Sol -- optimized for code generation" },
  "gpt-5.6-terra": { provider: "openai", icon: "gpt", description: "GPT 5.6 Terra -- best for data analysis" },
  "gemini-3.5-flash": { provider: "google", icon: "gemini", description: "Gemini 3.5 Flash -- Google's fastest model" },
  "gemini-3.6-flash": { provider: "google", icon: "gemini", description: "Gemini 3.6 Flash -- latest Google model" },
  "kimi k2.7 code": { provider: "kimi", icon: "kimi", description: "Kimi K2.7 Code -- specialized for coding" },
  "kimi-k3": { provider: "kimi", icon: "kimi", description: "Kimi K3 -- large context, strong reasoning" },
  "minimax-m3": { provider: "minimax", icon: "minimax", description: "MiniMax M3 -- free tier option" },
  "deepseek-v4-pro": { provider: "deepseek", icon: "deepseek", description: "DeepSeek V4 Pro -- excellent code reasoning" },
  "glm-5.2": { provider: "zhipu", icon: "zhipu", description: "GLM 5.2 -- strong general capabilities" },
  "creator-mini": { provider: "caretx", icon: "caretx", description: "Creator Mini -- optimized for creative coding" },
  "mimo-v2.5-pro": { provider: "moonshot", icon: "moonshot", description: "Mimo V2.5 Pro -- balanced coding assistant" },
  "longcat-2.0": { provider: "other", icon: "longcat", description: "Longcat 2.0 -- ultra-long context specialist" },
};

// ─── Fetch models from API ───
let cachedModels: AiModel[] | null = null;

export async function fetchModels(): Promise<AiModel[]> {
  if (cachedModels) return cachedModels;
  try {
    const r = await fetch(`${MODEL_BASE}/models`, {
      headers: { Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!r.ok) throw new Error(`Models fetch failed: ${r.status}`);
    const data = await r.json();
    const models: AiModel[] = (data.data ?? []).map((m: any) => {
      const meta = MODEL_META[m.id] ?? { provider: "other" as AiProvider, icon: "model", description: m.name };
      return {
        id: m.id,
        name: m.name,
        displayName: m.name,
        provider: meta.provider,
        maxContext: m.max_context ?? 128000,
        costPer1mInput: m.cost_per_1m_input ?? 0,
        costPer1mOutput: m.cost_per_1m_output ?? 0,
        speed: (m.speed as any) ?? "medium",
        quality: (m.quality as any) ?? "good",
        category: (m.category as any) ?? "computer",
        icon: meta.icon,
        description: meta.description,
      };
    });
    cachedModels = models;
    return models;
  } catch (err) {
    console.error("Failed to fetch models:", err);
    return [];
  }
}

// ─── Get providers with models ───
export async function getProviders(): Promise<AiProviderInfo[]> {
  const models = await fetchModels();
  return Object.values(PROVIDER_META).map((meta) => ({
    ...meta,
    models: models.filter((m) => m.provider === meta.id),
  }));
}

// ─── Settings ───
export async function getIntegrationSettings(): Promise<AiIntegrationSettings> {
  return settingsDB.get<AiIntegrationSettings>("ai_integrations", {
    defaultProvider: "caretx",
    defaultModel: "claude-fable-5",
    apiKeys: {},
    customEndpoints: [],
  });
}

export async function saveIntegrationSettings(settings: AiIntegrationSettings): Promise<void> {
  await settingsDB.set("ai_integrations", settings);
}

export async function setDefaultModel(modelId: string): Promise<void> {
  const settings = await getIntegrationSettings();
  settings.defaultModel = modelId;
  const models = await fetchModels();
  const model = models.find((m) => m.id === modelId);
  if (model) settings.defaultProvider = model.provider;
  await saveIntegrationSettings(settings);
}

export async function setApiKey(provider: string, key: string): Promise<void> {
  const settings = await getIntegrationSettings();
  settings.apiKeys[provider] = key;
  await saveIntegrationSettings(settings);
}

export async function addCustomEndpoint(name: string, url: string, key: string): Promise<void> {
  const settings = await getIntegrationSettings();
  settings.customEndpoints.push({ name, url, key });
  await saveIntegrationSettings(settings);
}

// ─── Context format ───
export function formatContext(ctx: number): string {
  if (ctx >= 1048576) return "1M";
  if (ctx >= 262144) return "262K";
  if (ctx >= 128000) return "128K";
  return `${Math.round(ctx / 1000)}K`;
}

export function formatCost(cost: number): string {
  if (cost === 0) return "Free";
  return `$${cost.toFixed(2)}`;
}

// ─── Speed/quality labels ───
export function speedLabel(speed: string): { label: string; color: string } {
  switch (speed) {
    case "fast": return { label: "Fast", color: "#4ade80" };
    case "medium": return { label: "Medium", color: "#fbbf24" };
    case "slow": return { label: "Slow", color: "#f87171" };
    default: return { label: speed, color: "#888" };
  }
}

export function qualityLabel(quality: string): { label: string; color: string } {
  switch (quality) {
    case "best": return { label: "Best", color: "#4ade80" };
    case "good": return { label: "Good", color: "#60a5fa" };
    case "standard": return { label: "Standard", color: "#888" };
    default: return { label: quality, color: "#888" };
  }
}
