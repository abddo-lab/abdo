/**
 * Self-Improvement Agent
 * Learns from user feedback and corrections
 */

import { chatCompletion, type ChatMessage } from "./api";
import { addLearnedRule, getLearnedRules, recordRuleFailure, recordRuleSuccess } from "./memory";
import { settingsDB } from "./db";

export interface FeedbackEntry {
  id: string;
  threadId: string;
  messageId: string;
  type: "thumbs_up" | "thumbs_down" | "correction" | "rule";
  content?: string;
  createdAt: number;
}

// Store feedback
export async function recordFeedback(entry: Omit<FeedbackEntry, "id" | "createdAt">): Promise<void> {
  const feedback = await settingsDB.get<FeedbackEntry[]>("feedback", []);
  feedback.push({ ...entry, id: `fb-${Date.now()}`, createdAt: Date.now() });
  // Keep last 100
  await settingsDB.set("feedback", feedback.slice(-100));
}

// Get recent feedback
export async function getRecentFeedback(limit = 20): Promise<FeedbackEntry[]> {
  const feedback = await settingsDB.get<FeedbackEntry[]>("feedback", []);
  return feedback.slice(-limit);
}

// Analyze feedback and generate rules
export async function analyzeFeedback(): Promise<string[]> {
  const feedback = await getRecentFeedback(50);
  const negatives = feedback.filter((f) => f.type === "thumbs_down" || f.type === "correction");

  if (negatives.length < 3) return []; // Need at least 3 examples

  const examples = negatives
    .map((f, i) => `${i + 1}. [${f.type}] ${f.content ?? "no details"}`)
    .join("\n");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `You are a self-improvement analyzer. Given examples where the user corrected or rejected the AI's output, generate 1-3 concise rules that would prevent each mistake.

Rules should be:
- Specific and actionable
- Written as instructions to the AI
- One sentence each

Output format: one rule per line, no numbering.`,
    },
    {
      role: "user",
      content: `Here are ${negatives.length} recent corrections:\n${examples}\n\nGenerate rules to prevent these mistakes.`,
    },
  ];

  try {
    const resp = await chatCompletion("claude-fable-5", messages, 0.3);
    const text = resp.choices[0]?.message?.content ?? "";
    const rules = text.split("\n").filter((l) => l.trim().length > 10).map((l) => l.replace(/^[-*]\s*/, "").trim());

    // Store new rules
    for (const rule of rules) {
      await addLearnedRule(rule, "self-improvement analysis");
    }

    return rules;
  } catch {
    return [];
  }
}

// Track rule usage
export async function onRuleUsed(ruleId: string, success: boolean): Promise<void> {
  if (success) await recordRuleSuccess(ruleId);
  else await recordRuleFailure(ruleId);
}

// Self-improvement status
export async function getImprovementStats(): Promise<{
  totalFeedback: number;
  negatives: number;
  rulesGenerated: number;
  activeRules: number;
}> {
  const feedback = await settingsDB.get<FeedbackEntry[]>("feedback", []);
  const rules = await getLearnedRules();
  return {
    totalFeedback: feedback.length,
    negatives: feedback.filter((f) => f.type === "thumbs_down" || f.type === "correction").length,
    rulesGenerated: rules.length,
    activeRules: rules.filter((r) => r.confidence >= 0.7).length,
  };
}
