/**
 * Background Agents — long-running tasks that continue in the background
 * Inspired by Codex background tasks + Cursor background agents
 */

import { chatCompletion, type ChatMessage } from "./api";
import { BUILTIN_AGENTS } from "./agents";

export interface BackgroundTask {
  id: string;
  name: string;
  agentId: string;
  task: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number; // 0..100
  logs: string[];
  result?: string;
  startedAt: number;
  finishedAt?: number;
  repo: string;
  branch: string;
}

// Store tasks in memory (not DB — they're transient)
let activeTasks: BackgroundTask[] = [];

export function getBackgroundTasks(): BackgroundTask[] {
  return [...activeTasks];
}

export function getTask(id: string): BackgroundTask | undefined {
  return activeTasks.find((t) => t.id === id);
}

export async function startBackgroundTask(
  name: string,
  agentId: string,
  task: string,
  repo: string,
  branch: string
): Promise<BackgroundTask> {
  const bt: BackgroundTask = {
    id: `bg-${Date.now()}`,
    name,
    agentId,
    task,
    status: "running",
    progress: 0,
    logs: [`[${new Date().toISOString()}] Starting: ${name}`],
    startedAt: Date.now(),
    repo,
    branch,
  };

  activeTasks = [...activeTasks, bt];

  // Run in background (don't await)
  executeBackground(bt).catch(() => {});

  return bt;
}

async function executeBackground(bt: BackgroundTask): Promise<void> {
  const agent = BUILTIN_AGENTS.find((a) => a.id === bt.agentId);
  if (!agent) {
    updateTask(bt.id, { status: "failed", logs: [...bt.logs, "Agent not found"], finishedAt: Date.now() });
    return;
  }

  try {
    updateTask(bt.id, { progress: 10, logs: [...getTask(bt.id)?.logs ?? [], `Using agent: ${agent.name}`] });

    const messages: ChatMessage[] = [
      { role: "system", content: agent.systemPrompt },
      { role: "user", content: bt.task },
    ];

    updateTask(bt.id, { progress: 30 });
    const resp = await chatCompletion(agent.model, messages, agent.temperature);
    const output = resp.choices[0]?.message?.content ?? "";

    updateTask(bt.id, {
      status: "completed",
      progress: 100,
      result: output,
      logs: [...getTask(bt.id)?.logs ?? [], `[${new Date().toISOString()}] Completed`],
      finishedAt: Date.now(),
    });
  } catch (err) {
    updateTask(bt.id, {
      status: "failed",
      logs: [...getTask(bt.id)?.logs ?? [], `Error: ${err}`],
      finishedAt: Date.now(),
    });
  }
}

function updateTask(id: string, updates: Partial<BackgroundTask>): void {
  activeTasks = activeTasks.map((t) => (t.id === id ? { ...t, ...updates } : t));
}

export function cancelTask(id: string): void {
  updateTask(id, { status: "cancelled", finishedAt: Date.now() });
}

export function clearCompleted(): void {
  activeTasks = activeTasks.filter((t) => t.status === "running" || t.status === "queued");
}
