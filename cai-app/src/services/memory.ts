/**
 * Memory System — user memory + thread memory + learned rules
 * Injected into every chat as system context
 */

import { memoriesDB, type MemoryRecord, settingsDB } from "./db";

// ─── Memory Management ───
export async function addUserMemory(content: string, source?: string): Promise<MemoryRecord> {
  const mem: MemoryRecord = {
    id: `mem-user-${Date.now()}`,
    scope: "user",
    content,
    source,
    createdAt: Date.now(),
  };
  await memoriesDB.put(mem);
  return mem;
}

export async function addThreadMemory(threadId: string, content: string): Promise<MemoryRecord> {
  const mem: MemoryRecord = {
    id: `mem-thread-${Date.now()}`,
    scope: "thread",
    threadId,
    content,
    createdAt: Date.now(),
  };
  await memoriesDB.put(mem);
  return mem;
}

export async function getUserMemories(): Promise<MemoryRecord[]> {
  const all = await memoriesDB.getAll();
  return all.filter((m) => m.scope === "user");
}

export async function getThreadMemories(threadId: string): Promise<MemoryRecord[]> {
  const all = await memoriesDB.getAll();
  return all.filter((m) => m.scope === "thread" && m.threadId === threadId);
}

export async function getAllMemoriesForThread(threadId: string): Promise<MemoryRecord[]> {
  const all = await memoriesDB.getAll();
  return all.filter((m) => m.scope === "user" || m.threadId === threadId);
}

export async function deleteMemory(id: string): Promise<void> {
  await memoriesDB.delete(id);
}

export async function promoteToUserMemory(threadMemoryId: string): Promise<void> {
  const all = await memoriesDB.getAll();
  const mem = all.find((m) => m.id === threadMemoryId);
  if (mem) {
    mem.scope = "user";
    mem.threadId = undefined;
    await memoriesDB.put(mem);
  }
}

// ─── Memory Injection ───
// Builds a memory block to inject into the system prompt
export async function buildMemoryBlock(threadId: string, maxTokens = 2000): Promise<string> {
  const memories = await getAllMemoriesForThread(threadId);
  if (memories.length === 0) return "";

  const userMemories = memories.filter((m) => m.scope === "user");
  const threadMemories = memories.filter((m) => m.scope === "thread");

  let block = "<memories>\n";

  if (userMemories.length > 0) {
    block += "## User Memories (global)\n";
    for (const m of userMemories.slice(-20)) {
      block += `- ${m.content}${m.source ? ` [source: ${m.source}]` : ""}\n`;
    }
  }

  if (threadMemories.length > 0) {
    block += "## Thread Memories\n";
    for (const m of threadMemories.slice(-10)) {
      block += `- ${m.content}\n`;
    }
  }

  block += "</memories>\n";

  // Rough token limit (4 chars ≈ 1 token)
  if (block.length > maxTokens * 4) {
    block = block.slice(0, maxTokens * 4) + "\n...</memories>\n";
  }

  return block;
}

// ─── Learned Rules (self-improvement) ───
export interface LearnedRule {
  id: string;
  rule: string;
  confidence: number; // 0..1
  source: string;
  createdAt: number;
  lastUsedAt?: number;
  successCount: number;
  failCount: number;
}

export async function getLearnedRules(): Promise<LearnedRule[]> {
  return settingsDB.get<LearnedRule[]>("learned_rules", []);
}

export async function addLearnedRule(rule: string, source: string): Promise<LearnedRule> {
  const rules = await getLearnedRules();
  const newRule: LearnedRule = {
    id: `rule-${Date.now()}`,
    rule,
    confidence: 0.5,
    source,
    createdAt: Date.now(),
    successCount: 0,
    failCount: 0,
  };
  rules.push(newRule);
  await settingsDB.set("learned_rules", rules);
  return newRule;
}

export async function recordRuleSuccess(id: string): Promise<void> {
  const rules = await getLearnedRules();
  const r = rules.find((x) => x.id === id);
  if (r) {
    r.successCount++;
    r.lastUsedAt = Date.now();
    r.confidence = Math.min(1, r.confidence + 0.1);
    await settingsDB.set("learned_rules", rules);
  }
}

export async function recordRuleFailure(id: string): Promise<void> {
  const rules = await getLearnedRules();
  const r = rules.find((x) => x.id === id);
  if (r) {
    r.failCount++;
    r.confidence = Math.max(0, r.confidence - 0.15);
    await settingsDB.set("learned_rules", rules);
  }
}

export async function buildRulesBlock(): Promise<string> {
  const rules = await getLearnedRules();
  const active = rules.filter((r) => r.confidence >= 0.7);
  if (active.length === 0) return "";

  let block = "<learned_rules>\n";
  for (const r of active) {
    block += `- ${r.rule} (confidence: ${r.confidence.toFixed(1)})\n`;
  }
  block += "</learned_rules>\n";
  return block;
}

// ─── Memory file upload (.md / .txt) ───
export async function uploadMemoryFile(file: File): Promise<MemoryRecord> {
  const text = await file.text();
  return addUserMemory(text, file.name);
}
