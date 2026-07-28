/**
 * Hooks System — pre/post tool execution hooks
 * Inspired by Claude Code's lifecycle hooks
 */

import { settingsDB } from "./db";

export type HookEvent = "pre_tool" | "post_tool" | "pre_commit" | "post_commit" | "on_error" | "on_start" | "on_end";

export interface Hook {
  id: string;
  name: string;
  event: HookEvent;
  command: string;
  enabled: boolean;
  matcher?: string; // regex to match tool name
}

export async function getHooks(): Promise<Hook[]> {
  return settingsDB.get<Hook[]>("hooks", []);
}

export async function saveHook(hook: Hook): Promise<void> {
  const hooks = await getHooks();
  const idx = hooks.findIndex((h) => h.id === hook.id);
  if (idx >= 0) hooks[idx] = hook;
  else hooks.push(hook);
  await settingsDB.set("hooks", hooks);
}

export async function deleteHook(id: string): Promise<void> {
  const hooks = await getHooks();
  await settingsDB.set("hooks", hooks.filter((h) => h.id !== id));
}

export async function runHooks(event: HookEvent, context: { toolName?: string; args?: unknown; result?: unknown }): Promise<string[]> {
  const hooks = await getHooks();
  const matching = hooks.filter((h) => {
    if (!h.enabled || h.event !== event) return false;
    if (h.matcher && context.toolName) {
      try { return new RegExp(h.matcher).test(context.toolName); } catch { return true; }
    }
    return true;
  });

  const outputs: string[] = [];
  for (const hook of matching) {
    outputs.push(`[hook:${hook.name}] ${hook.command}`);
  }
  return outputs;
}

// Default hooks
export const DEFAULT_HOOKS: Hook[] = [
  { id: "hook-pre-commit-lint", name: "Lint before commit", event: "pre_commit", command: "npm run lint", enabled: true },
  { id: "hook-post-commit-test", name: "Test after commit", event: "post_commit", command: "npm test", enabled: false },
  { id: "hook-on-error-notify", name: "Notify on error", event: "on_error", command: "echo 'Error occurred'", enabled: true },
];
