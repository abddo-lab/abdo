// src/modelGroups.ts — Group the (32+) model list into families for the selector
export interface ModelItem {
  id: string;
  desc?: string;
  label?: string;
}

/** Display name for a model item (label fallback = id) */
export function modelLabel(m: ModelItem): string {
  return m.label || m.id;
}

const FAMILIES: { match: string; label: string }[] = [
  { match: "kiren", label: "kiren" },
  { match: "deepseek", label: "deepseek" },
  { match: "claude", label: "claude" },
  { match: "gpt", label: "gpt" },
  { match: "gemini", label: "gemini" },
  { match: "kimi", label: "kimi" },
  { match: "qwen", label: "qwen" },
  { match: "glm", label: "glm" },
  { match: "minimax", label: "minimax" },
  { match: "mimo", label: "mimo" },
  { match: "longcat", label: "longcat" },
  { match: "llama", label: "llama" },
  { match: "mistral", label: "mistral" },
];

/** The family a model belongs to (by id prefix), e.g. "claude-sonnet-5" → "Claude" */
export function familyOf(id: string): string {
  const m = (id || "").toLowerCase();
  for (const { match, label } of FAMILIES) {
    if (m === match || m.startsWith(`${match}-`) || m.startsWith(`${match} `) || m.includes(match)) return label;
  }
  return "Other";
}

export interface ModelGroup {
  label: string;
  models: ModelItem[];
}

/** Group models by family, favorite families first */
export function groupModels(models: ModelItem[]): ModelGroup[] {
  const groups: Record<string, ModelItem[]> = {};
  const order: string[] = [];
  for (const m of models) {
    const f = familyOf(m.id);
    if (!groups[f]) { groups[f] = []; order.push(f); }
    groups[f].push(m);
  }
  const favorite = ["Kiren", "DeepSeek", "Claude", "GPT"];
  order.sort((a, b) => {
    const ia = favorite.indexOf(a), ib = favorite.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return order.map((label) => ({ label, models: groups[label] }));
}
