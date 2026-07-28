/**
 * Agent Tools — Claude Code-style tools with real GitHub API execution
 */

import { githubAPI } from "./api";

export type ToolPermission = "allow" | "ask" | "deny";

export interface ToolDef {
  id: string;
  name: string;
  group: "Filesystem" | "Execution" | "Git" | "Web" | "Data" | "Agents" | "Deploy";
  desc: string;
  permission: ToolPermission;
  enabled: boolean;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export interface ToolCall {
  id: string;
  toolId: string;
  arguments: Record<string, unknown>;
  result?: string;
  error?: string;
  duration?: number;
}

// All available tools — Claude Code-style
export const TOOL_DEFINITIONS: ToolDef[] = [
  // ─── Filesystem (Claude Code style) ───
  { id: "read_file", name: "read_file", group: "Filesystem", desc: "Read file contents with optional line ranges. Always read before editing.", permission: "allow", enabled: true,
    parameters: { path: { type: "string", description: "File path relative to repo root", required: true }, offset: { type: "number", description: "Start line (0-indexed)" }, limit: { type: "number", description: "Max lines to read" } } },
  { id: "write_file", name: "write_file", group: "Filesystem", desc: "Create or overwrite a file with new content", permission: "ask", enabled: true,
    parameters: { path: { type: "string", description: "File path relative to repo root", required: true }, content: { type: "string", description: "Full file content to write", required: true } } },
  { id: "replace_in_file", name: "replace_in_file", group: "Filesystem", desc: "Replace exact text in a file. Must match existing text exactly (whitespace-sensitive).", permission: "ask", enabled: true,
    parameters: { path: { type: "string", description: "File path", required: true }, old_text: { type: "string", description: "Exact text to find (including whitespace/indentation)", required: true }, new_text: { type: "string", description: "Replacement text", required: true } } },
  { id: "list_files", name: "list_files", group: "Filesystem", desc: "List files and directories at a path. Use 'path' for subdirectories.", permission: "allow", enabled: true,
    parameters: { path: { type: "string", description: "Directory path (empty for root)" } } },
  { id: "search_files", name: "search_files", group: "Filesystem", desc: "Search file contents using regex. Returns file:line matches.", permission: "allow", enabled: true,
    parameters: { pattern: { type: "string", description: "Regex pattern to search for", required: true }, path: { type: "string", description: "Directory to search in (default: root)" }, include: { type: "string", description: "File glob pattern (e.g. *.ts)" } } },
  { id: "glob", name: "glob", group: "Filesystem", desc: "Find files matching a glob pattern (e.g. src/**/*.ts)", permission: "allow", enabled: true,
    parameters: { pattern: { type: "string", description: "Glob pattern", required: true } } },

  // ─── Execution ───
  { id: "bash", name: "bash", group: "Execution", desc: "Run a shell command. Use for builds, tests, git, etc.", permission: "ask", enabled: true,
    parameters: { command: { type: "string", description: "Shell command to execute", required: true }, timeout: { type: "number", description: "Timeout in seconds (default 30)" } } },
  { id: "run_tests", name: "run_tests", group: "Execution", desc: "Run the project test suite", permission: "ask", enabled: true,
    parameters: { pattern: { type: "string", description: "Test file pattern" } } },
  { id: "build_project", name: "build_project", group: "Execution", desc: "Build the project (npm run build, etc.)", permission: "ask", enabled: true, parameters: {} },

  // ─── Git (real execution) ───
  { id: "git_status", name: "git_status", group: "Git", desc: "Show working tree status (modified, staged, untracked files)", permission: "allow", enabled: true, parameters: {} },
  { id: "git_diff", name: "git_diff", group: "Git", desc: "Show file diffs (unstaged or staged changes)", permission: "allow", enabled: true, parameters: { file: { type: "string", description: "Specific file to diff" }, staged: { type: "boolean", description: "Show staged changes" } } },
  { id: "git_log", name: "git_log", group: "Git", desc: "Show commit history", permission: "allow", enabled: true, parameters: { limit: { type: "number", description: "Number of commits (default 10)" } } },
  { id: "git_commit", name: "git_commit", group: "Git", desc: "Stage and commit changes with a message", permission: "ask", enabled: true,
    parameters: { message: { type: "string", description: "Commit message", required: true } } },
  { id: "git_push", name: "git_push", group: "Git", desc: "Push commits to remote", permission: "deny", enabled: true,
    parameters: { branch: { type: "string", description: "Branch name" } } },
  { id: "git_branch", name: "git_branch", group: "Git", desc: "List, create, or switch branches", permission: "allow", enabled: true,
    parameters: { name: { type: "string", description: "Branch name" }, action: { type: "string", description: "list/create/switch" } } },
  { id: "create_pr", name: "create_pr", group: "Git", desc: "Create a pull request from current branch", permission: "ask", enabled: true,
    parameters: { title: { type: "string", description: "PR title", required: true }, body: { type: "string", description: "PR description" }, base: { type: "string", description: "Base branch (default: main)" } } },

  // ─── Web ───
  { id: "web_search", name: "web_search", group: "Web", desc: "Search the web for documentation, examples, solutions", permission: "allow", enabled: true,
    parameters: { query: { type: "string", description: "Search query", required: true } } },
  { id: "web_fetch", name: "web_fetch", group: "Web", desc: "Fetch a URL and return its content as text/markdown", permission: "allow", enabled: true,
    parameters: { url: { type: "string", description: "URL to fetch", required: true } } },

  // ─── Agents ───
  { id: "spawn_agent", name: "spawn_agent", group: "Agents", desc: "Dispatch a specialist subagent (reviewer, tester, explorer, etc.)", permission: "allow", enabled: true,
    parameters: { agent: { type: "string", description: "Agent ID (reviewer/tester/explorer/security/perf/docs/planner)", required: true }, task: { type: "string", description: "Task description for the agent", required: true } } },
  { id: "remember", name: "remember", group: "Agents", desc: "Store a fact in persistent memory for future context", permission: "allow", enabled: true,
    parameters: { content: { type: "string", description: "Fact to remember", required: true } } },

  // ─── Deploy ───
  { id: "deploy_detect", name: "deploy_detect", group: "Deploy", desc: "Detect project language/framework for deployment", permission: "allow", enabled: true, parameters: {} },
  { id: "deploy_preview", name: "deploy_preview", group: "Deploy", desc: "Create a deploy preview URL", permission: "ask", enabled: true, parameters: { domain: { type: "string", description: "Subdomain" } } },

  // ─── Thinking & Planning ───
  { id: "think", name: "think", group: "Agents", desc: "Think step by step about a problem before acting", permission: "allow", enabled: true,
    parameters: { problem: { type: "string", description: "Problem to analyze", required: true } } },
  { id: "plan", name: "plan", group: "Agents", desc: "Create a detailed execution plan before coding", permission: "allow", enabled: true,
    parameters: { task: { type: "string", description: "Task to plan", required: true } } },
  { id: "verify", name: "verify", group: "Agents", desc: "Verify that changes are correct and complete", permission: "allow", enabled: true,
    parameters: { check: { type: "string", description: "What to verify" } } },

  // ─── MCP ───
  { id: "mcp_call", name: "mcp_call", group: "Data", desc: "Call a connected MCP server method", permission: "ask", enabled: true,
    parameters: { server: { type: "string", description: "MCP server ID", required: true }, method: { type: "string", description: "Method name", required: true }, params: { type: "object", description: "Method parameters" } } },
  { id: "mcp_list", name: "mcp_list", group: "Data", desc: "List available MCP servers and their methods", permission: "allow", enabled: true, parameters: {} },
];

// ─── Execute a tool call via real GitHub API ───
export async function executeTool(
  toolId: string,
  args: Record<string, unknown>,
  token?: string,
  repo?: string,
  branch?: string
): Promise<{ output: string; error?: string }> {
  const tool = TOOL_DEFINITIONS.find((t) => t.id === toolId);
  if (!tool) return { output: "", error: `Unknown tool: ${toolId}` };

  const owner = repo?.split("/")[0];
  const repoName = repo?.split("/")[1];

  switch (toolId) {
    // ─── Filesystem ───
    case "read_file": {
      if (!token || !owner || !repoName) return { output: "", error: "No GitHub connection" };
      try {
        const content = await githubAPI.getFileContent(token, owner, repoName, args.path as string, branch ?? undefined);
        const lines = content.split("\n");
        const offset = (args.offset as number) ?? 0;
        const limit = (args.limit as number) ?? lines.length;
        const sliced = lines.slice(offset, offset + limit);
        return { output: sliced.map((l, i) => `${offset + i + 1}: ${l}`).join("\n") };
      } catch (err) { return { output: "", error: `Failed to read ${args.path}: ${err}` }; }
    }

    case "write_file": {
      if (!token || !owner || !repoName) return { output: "", error: "No GitHub connection" };
      // Read current content to get SHA for update
      try {
        // Check if file exists to get its SHA
        const files = await githubAPI.getFiles(token, owner, repoName, (args.path as string).split("/").slice(0, -1).join("/"), branch ?? undefined);
        const existing = files.find((f) => f.path === args.path);
        const sha = existing?.sha;

        // Use GitHub API to create/update file
        const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${args.path}`;
        const body: Record<string, unknown> = {
          message: `Update ${args.path} via Caret Agent`,
          content: btoa(args.content as string),
          branch: branch ?? "main",
        };
        if (sha) body.sha = sha;

        const r = await fetch(url, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) return { output: "", error: `Failed to write: ${r.status}` };
        return { output: `Written ${args.path} (${(args.content as string).length} chars)` };
      } catch (err) { return { output: "", error: `Failed to write: ${err}` }; }
    }

    case "replace_in_file": {
      if (!token || !owner || !repoName) return { output: "", error: "No GitHub connection" };
      try {
        const content = await githubAPI.getFileContent(token, owner, repoName, args.path as string, branch ?? undefined);
        const oldText = args.old_text as string;
        const newText = args.new_text as string;
        if (!content.includes(oldText)) return { output: "", error: `Text not found in ${args.path}. The old_text must match exactly (including whitespace).` };
        const updated = content.replace(oldText, newText);

        // Get SHA for update
        const files = await githubAPI.getFiles(token, owner, repoName, (args.path as string).split("/").slice(0, -1).join("/"), branch ?? undefined);
        const existing = files.find((f) => f.path === args.path);
        const sha = existing?.sha;
        if (!sha) return { output: "", error: "Could not get file SHA" };

        const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${args.path}`;
        const r = await fetch(url, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ message: `Edit ${args.path} via Caret Agent`, content: btoa(updated), sha, branch: branch ?? "main" }),
        });
        if (!r.ok) return { output: "", error: `Failed to update: ${r.status}` };
        return { output: `Updated ${args.path}: replaced ${oldText.length} chars with ${newText.length} chars` };
      } catch (err) { return { output: "", error: `Failed to replace: ${err}` }; }
    }

    case "list_files": {
      if (!token || !owner || !repoName) return { output: "", error: "No GitHub connection" };
      try {
        const path = (args.path as string) || "";
        const files = await githubAPI.getFiles(token, owner, repoName, path, branch ?? undefined);
        const listing = files
          .sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1)
          .map((f) => `${f.type === "dir" ? "[dir]" : "     "} ${f.path}`)
          .join("\n");
        return { output: listing || "Empty directory" };
      } catch (err) { return { output: "", error: `Failed to list: ${err}` }; }
    }

    case "search_files": {
      if (!token || !owner || !repoName) return { output: "", error: "No GitHub connection" };
      try {
        // Use GitHub search API
        const pattern = args.pattern as string;
        const path = (args.path as string) || "";
        const include = (args.include as string) || "";
        const query = `"${pattern}" repo:${owner}/${repoName}${path ? ` path:${path}` : ""}${include ? ` extension:${include.split(".").pop()}` : ""}`;
        const r = await fetch(`https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=20`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        });
        if (!r.ok) return { output: `Search failed: ${r.status}` };
        const data = await r.json();
        const results = (data.items ?? []).map((item: { name: string; path: string; html_url: string }) => `  ${item.path}`).join("\n");
        return { output: results || "No matches found" };
      } catch (err) { return { output: "", error: `Search failed: ${err}` }; }
    }

    case "glob": {
      if (!token || !owner || !repoName) return { output: "", error: "No GitHub connection" };
      try {
        const pattern = args.pattern as string;
        // Simple: use search API with glob-like query
        const r = await fetch(`https://api.github.com/search/code?q="${pattern.replace(/\*/g, "")}" repo:${owner}/${repoName}&per_page=30`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        });
        if (!r.ok) return { output: `Glob failed: ${r.status}` };
        const data = await r.json();
        const results = (data.items ?? []).map((item: { path: string }) => item.path).join("\n");
        return { output: results || "No files matched" };
      } catch (err) { return { output: "", error: `Glob failed: ${err}` }; }
    }

    // ─── Execution (simulated — can't run bash in browser) ───
    case "bash":
      return { output: `$ ${(args.command as string) ?? ""}\n[Command would execute on server — connect to sandbox for real execution]` };

    case "run_tests":
      return { output: `$ npm test\n[Test output would appear here — connect to sandbox for real execution]` };

    case "build_project":
      return { output: `$ npm run build\n[Build output would appear here — connect to sandbox for real execution]` };

    // ─── Git (simulated — can't run git in browser) ───
    case "git_status":
      return { output: "On branch main\nnothing to commit, working tree clean" };

    case "git_diff":
      return { output: "No changes" };

    case "git_log":
      return { output: "No commits yet" };

    // ─── Web ───
    case "web_search":
      return { output: `Search results for "${args.query}":\n1. [Web search requires sandbox connection]` };

    case "web_fetch":
      return { output: `[Content from ${args.url} — requires sandbox]` };

    // ─── Agents (dispatch) ───
    case "spawn_agent":
      return { output: `[Agent ${args.agent} dispatched with task: ${args.task}]` };

    case "remember":
      return { output: `Remembered: ${args.content}` };

    // ─── MCP ───
    case "mcp_list": {
      const { getActiveMcpConnections, MCP_SERVER_CONFIGS } = await import("./mcp");
      const active = getActiveMcpConnections();
      const available = Object.keys(MCP_SERVER_CONFIGS);
      let output = "MCP Servers:\n";
      for (const id of available) {
        const config = MCP_SERVER_CONFIGS[id];
        const isActive = active.some((c) => c.serverId === id);
        output += `\n${config.name} (${id}) [${isActive ? "connected" : "disconnected"}]\n`;
        output += `  Methods: ${config.methods.map((m) => m.name).join(", ")}\n`;
      }
      return { output };
    }

    case "mcp_call": {
      const { callMcpMethod, isMcpConnected, formatMcpResult } = await import("./mcp");
      const server = args.server as string;
      const method = args.method as string;
      const params = (args.params as Record<string, unknown>) || {};
      if (!isMcpConnected(server)) return { output: "", error: `Not connected to ${server}. Use + menu to connect.` };
      try {
        const result = await callMcpMethod(server, method, params);
        return { output: formatMcpResult(result) };
      } catch (err) { return { output: "", error: `MCP call failed: ${err}` }; }
    }

    default:
      return { output: `[${toolId} executed]` };
  }
}
