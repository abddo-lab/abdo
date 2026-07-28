/**
 * E2B Sandbox Service — ephemeral sandboxes for free tier
 * https://e2b.dev
 */

import { getConfig } from "./config";

const E2B_API = "https://api.e2b.dev";

export interface E2BSandbox {
  id: string;
  status: "creating" | "running" | "paused" | "stopped";
  clientID: string;
  createdAt: string;
}

export interface E2BExecution {
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}

// ─── API Client ───
async function e2bFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getConfig();
  const apiKey = (config as any).e2b?.apiKey;
  if (!apiKey) throw new Error("E2B API key not configured");

  const r = await fetch(`${E2B_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...init?.headers,
    },
  });

  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`E2B error ${r.status}: ${body}`);
  }

  return r.json();
}

// ─── Sandbox Lifecycle ───
export async function createSandbox(template?: string): Promise<E2BSandbox> {
  return e2bFetch<E2BSandbox>("/sandboxes", {
    method: "POST",
    body: JSON.stringify({ templateID: template ?? "base" }),
  });
}

export async function getSandbox(id: string): Promise<E2BSandbox> {
  return e2bFetch<E2BSandbox>(`/sandboxes/${id}`);
}

export async function deleteSandbox(id: string): Promise<void> {
  await e2bFetch(`/sandboxes/${id}`, { method: "DELETE" });
}

// ─── Code Execution ───
export async function executeCode(sandboxId: string, code: string, language?: string): Promise<E2BExecution> {
  return e2bFetch<E2BExecution>(`/sandboxes/${sandboxId}/exec`, {
    method: "POST",
    body: JSON.stringify({ code, language: language ?? "python" }),
  });
}

// ─── File Operations ───
export async function writeFile(sandboxId: string, path: string, content: string): Promise<void> {
  await e2bFetch(`/sandboxes/${sandboxId}/files`, {
    method: "POST",
    body: JSON.stringify({ path, content }),
  });
}

export async function readFile(sandboxId: string, path: string): Promise<{ content: string }> {
  return e2bFetch<{ content: string }>(`/sandboxes/${sandboxId}/files?path=${encodeURIComponent(path)}`);
}

// ─── Shell Commands ───
export async function runCommand(sandboxId: string, command: string): Promise<E2BExecution> {
  return e2bFetch<E2BExecution>(`/sandboxes/${sandboxId}/terminal`, {
    method: "POST",
    body: JSON.stringify({ command }),
  });
}
