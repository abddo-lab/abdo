/**
 * Daytona Sandbox Service — per-hour pricing, lifecycle management
 */

import { getConfig } from "./config";
import { settingsDB } from "./db";

export interface Sandbox {
  id: string;
  name: string;
  state: "creating" | "running" | "stopped" | "error" | "deleted";
  publicDomain?: string;
  repo?: string;
  branch?: string;
  createdAt: number;
  startedAt?: number;
  stoppedAt?: number;
  hoursUsed: number;
  costUsd: number;
  autoStopAt?: number;
  metadata: Record<string, unknown>;
}

export interface SandboxRun {
  id: string;
  sandboxId: string;
  command: string;
  output: string;
  exitCode: number;
  duration: number;
  startedAt: number;
}

// ─── Pricing ───
export function calculateSandboxCost(hours: number, pricingPerHour?: number): number {
  const config = getConfig();
  const rate = pricingPerHour ?? config.daytona.pricingPerHour;
  return Math.round(hours * rate * 100) / 100;
}

export function formatSandboxCost(hours: number): string {
  const cost = calculateSandboxCost(hours);
  return `$${cost.toFixed(2)} (${hours.toFixed(1)}h × $${getConfig().daytona.pricingPerHour}/h)`;
}

// ─── Sandbox CRUD ───
export async function getSandboxes(): Promise<Sandbox[]> {
  return settingsDB.get<Sandbox[]>("daytona_sandboxes", []);
}

export async function createSandbox(name: string, repo?: string, branch?: string): Promise<Sandbox> {
  const config = getConfig();
  if (!config.daytona.apiKey) throw new Error("Daytona API key not configured");

  const sandbox: Sandbox = {
    id: `sbx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    state: "creating",
    repo,
    branch,
    createdAt: Date.now(),
    hoursUsed: 0,
    costUsd: 0,
    autoStopAt: Date.now() + config.daytona.autoStopMinutes * 60 * 1000,
    metadata: {},
  };

  const sandboxes = await getSandboxes();
  sandboxes.push(sandbox);
  await settingsDB.set("daytona_sandboxes", sandboxes);

  // Simulate creation (in production, call Daytona API)
  setTimeout(async () => {
    const all = await getSandboxes();
    const sbx = all.find((s) => s.id === sandbox.id);
    if (sbx) {
      sbx.state = "running";
      sbx.startedAt = Date.now();
      sbx.publicDomain = `${name}.z0.bot.nu`;
      await settingsDB.set("daytona_sandboxes", all);
    }
  }, 2000);

  return sandbox;
}

export async function stopSandbox(id: string): Promise<void> {
  const sandboxes = await getSandboxes();
  const sbx = sandboxes.find((s) => s.id === id);
  if (!sbx) throw new Error("Sandbox not found");

  sbx.state = "stopped";
  sbx.stoppedAt = Date.now();
  if (sbx.startedAt) {
    const hours = (sbx.stoppedAt - sbx.startedAt) / (1000 * 60 * 60);
    sbx.hoursUsed = Math.round(hours * 100) / 100;
    sbx.costUsd = calculateSandboxCost(sbx.hoursUsed);
  }
  await settingsDB.set("daytona_sandboxes", sandboxes);
}

export async function deleteSandbox(id: string): Promise<void> {
  const sandboxes = await getSandboxes();
  await settingsDB.set("daytona_sandboxes", sandboxes.filter((s) => s.id !== id));
}

export async function runInSandbox(sandboxId: string, command: string): Promise<SandboxRun> {
  const sandboxes = await getSandboxes();
  const sbx = sandboxes.find((s) => s.id === sandboxId);
  if (!sbx) throw new Error("Sandbox not found");
  if (sbx.state !== "running") throw new Error("Sandbox is not running");

  const run: SandboxRun = {
    id: `run-${Date.now()}`,
    sandboxId,
    command,
    output: `$ ${command}\n[executing in sandbox ${sbx.name}]\n[done]`,
    exitCode: 0,
    duration: 1000,
    startedAt: Date.now(),
  };

  return run;
}

// ─── Cost Tracking ───
export async function getTotalSandboxCost(): Promise<number> {
  const sandboxes = await getSandboxes();
  return sandboxes.reduce((sum, s) => sum + s.costUsd, 0);
}

export async function getSandboxReport(): Promise<{
  totalSandboxes: number;
  running: number;
  stopped: number;
  totalHours: number;
  totalCost: number;
  costBreakdown: Array<{ name: string; hours: number; cost: number }>;
}> {
  const sandboxes = await getSandboxes();
  const running = sandboxes.filter((s) => s.state === "running").length;
  const stopped = sandboxes.filter((s) => s.state === "stopped").length;
  const totalHours = sandboxes.reduce((sum, s) => sum + s.hoursUsed, 0);
  const totalCost = sandboxes.reduce((sum, s) => sum + s.costUsd, 0);

  return {
    totalSandboxes: sandboxes.length,
    running,
    stopped,
    totalHours: Math.round(totalHours * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    costBreakdown: sandboxes.map((s) => ({
      name: s.name,
      hours: s.hoursUsed,
      cost: s.costUsd,
    })),
  };
}
