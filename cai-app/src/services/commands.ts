/**
 * Custom Slash Commands — user-defined commands from .cai/commands/
 * Inspired by Claude Code's custom slash commands
 */

import { settingsDB } from "./db";
import { chatCompletion, type ChatMessage } from "./api";

export interface CustomCommand {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: string;
  usageCount: number;
  createdAt: number;
}

export async function getCustomCommands(): Promise<CustomCommand[]> {
  return settingsDB.get<CustomCommand[]>("custom_commands", []);
}

export async function saveCustomCommand(cmd: CustomCommand): Promise<void> {
  const cmds = await getCustomCommands();
  const idx = cmds.findIndex((c) => c.id === cmd.id);
  if (idx >= 0) cmds[idx] = cmd;
  else cmds.push(cmd);
  await settingsDB.set("custom_commands", cmds);
}

export async function deleteCustomCommand(id: string): Promise<void> {
  const cmds = await getCustomCommands();
  await settingsDB.set("custom_commands", cmds.filter((c) => c.id !== id));
}

export async function executeCustomCommand(commandId: string, args?: string): Promise<string> {
  const cmds = await getCustomCommands();
  const cmd = cmds.find((c) => c.id === commandId);
  if (!cmd) return `Command not found: ${commandId}`;

  const prompt = args ? cmd.prompt.replace("{{args}}", args) : cmd.prompt;
  const messages: ChatMessage[] = [
    { role: "system", content: "You are a helpful coding assistant. Follow the user's instructions precisely." },
    { role: "user", content: prompt },
  ];

  try {
    const resp = await chatCompletion("claude-fable-5", messages, 0.4);
    cmd.usageCount++;
    await saveCustomCommand(cmd);
    return resp.choices[0]?.message?.content ?? "No response";
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// Default custom commands
export const DEFAULT_COMMANDS: CustomCommand[] = [
  {
    id: "cmd-explain",
    name: "explain",
    description: "Explain the selected code or file",
    prompt: "Explain the following code in detail. What does it do, how does it work, and are there any potential issues?\n\n{{args}}",
    category: "code",
    usageCount: 0,
    createdAt: Date.now(),
  },
  {
    id: "cmd-refactor",
    name: "refactor",
    description: "Suggest refactoring improvements",
    prompt: "Suggest refactoring improvements for the following code. Focus on readability, performance, and maintainability.\n\n{{args}}",
    category: "code",
    usageCount: 0,
    createdAt: Date.now(),
  },
  {
    id: "cmd-test",
    name: "test",
    description: "Generate tests for the selected code",
    prompt: "Generate comprehensive tests for the following code. Cover happy path, edge cases, and error cases.\n\n{{args}}",
    category: "test",
    usageCount: 0,
    createdAt: Date.now(),
  },
  {
    id: "cmd-docs",
    name: "docs",
    description: "Generate documentation for the selected code",
    prompt: "Generate clear documentation for the following code. Include function descriptions, parameters, return values, and usage examples.\n\n{{args}}",
    category: "docs",
    usageCount: 0,
    createdAt: Date.now(),
  },
  {
    id: "cmd-security",
    name: "security",
    description: "Security audit of selected code",
    prompt: "Perform a security audit on the following code. Look for vulnerabilities, injection risks, auth issues, and data exposure.\n\n{{args}}",
    category: "review",
    usageCount: 0,
    createdAt: Date.now(),
  },
  {
    id: "cmd-optimize",
    name: "optimize",
    description: "Suggest performance optimizations",
    prompt: "Analyze the following code for performance issues and suggest optimizations.\n\n{{args}}",
    category: "code",
    usageCount: 0,
    createdAt: Date.now(),
  },
];
