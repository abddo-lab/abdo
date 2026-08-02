// server/src/services/mcp.ts — MCP connector service.
// Built-in servers (filesystem / shell / github) are seeded automatically and
// work without any real connection or credentials setup by the user.
import { SandboxService } from "./sandbox.js";
import { GitHubService } from "./github.js";
import pool from "../db.js";
import { v4 as uuid } from "uuid";
import { seedMcpServers, BUILTIN_MCP_SERVERS } from "./seeds.js";

interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

interface MCPServerConfig {
  name: string;
  transport: "stdio" | "http";
  command?: string;        // for stdio
  args?: string[];
  package?: string;        // npm package to install in the sandbox (user-installed MCP)
  url?: string;            // for http
  env?: Record<string, string>;
}

const BUILTIN_TOOLS: Record<string, MCPTool[]> = {
  filesystem: [
    { name: "read_file", description: "Read a file from the sandbox workspace", inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
    { name: "write_file", description: "Write content to a file in the sandbox", inputSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
    { name: "list_dir", description: "List files and directories in the sandbox", inputSchema: { type: "object", properties: { path: { type: "string" } } } },
    { name: "read_text", description: "Read text content from a file", inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
    { name: "search_files", description: "Search for text patterns in files", inputSchema: { type: "object", properties: { path: { type: "string" }, pattern: { type: "string" } }, required: ["pattern"] } },
    { name: "file_info", description: "Get metadata about a file", inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  ],
  shell: [
    { name: "run_command", description: "Run a shell command in the sandbox", inputSchema: { type: "object", properties: { command: { type: "string" }, cwd: { type: "string" } }, required: ["command"] } },
    { name: "get_environment", description: "Inspect environment info of the sandbox", inputSchema: { type: "object", properties: {} } },
    { name: "get_workspace_stats", description: "Disk usage and workspace size", inputSchema: { type: "object", properties: {} } },
    { name: "list_processes", description: "List running processes in the sandbox", inputSchema: { type: "object", properties: {} } },
  ],
  github: [
    { name: "list_repos", description: "List your GitHub repositories", inputSchema: { type: "object", properties: { page: { type: "number" } } } },
    { name: "get_repo", description: "Get repository details", inputSchema: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" } }, required: ["owner", "repo"] } },
    { name: "list_branches", description: "List branches of a repository", inputSchema: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" } }, required: ["owner", "repo"] } },
    { name: "get_file", description: "Get file content from a repository", inputSchema: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, path: { type: "string" } }, required: ["owner", "repo", "path"] } },
    { name: "get_tree", description: "Get the git tree of a repository", inputSchema: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, sha: { type: "string" } }, required: ["owner", "repo"] } },
    { name: "list_workflows", description: "List GitHub Actions workflows", inputSchema: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" } }, required: ["owner", "repo"] } },
    { name: "get_workflow_runs", description: "List recent workflow runs", inputSchema: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" } }, required: ["owner", "repo"] } },
    { name: "create_pr", description: "Create a pull request", inputSchema: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, title: { type: "string" }, head: { type: "string" }, base: { type: "string" }, body: { type: "string" } }, required: ["owner", "repo", "title", "head", "base"] } },
    { name: "create_branch", description: "Create a branch", inputSchema: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, new_branch: { type: "string" }, from_sha: { type: "string" } }, required: ["owner", "repo", "new_branch", "from_sha"] } },
    { name: "create_or_update_file", description: "Create or update a file via a commit", inputSchema: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, path: { type: "string" }, content: { type: "string" }, message: { type: "string" }, branch: { type: "string" } }, required: ["owner", "repo", "path", "content", "message"] } },
    { name: "get_user", description: "Get the authenticated GitHub user", inputSchema: { type: "object", properties: {} } },
    { name: "search_code", description: "Search GitHub code", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  ],
};

export class MCPService {
  /** Install a custom MCP server on user's sandbox */
  static async install(userId: string, sandboxId: string, config: MCPServerConfig): Promise<any> {
    if (config.transport === "stdio" && (config.command || config.package)) {
      // User-installed package: npm install -g <package>, resolve its real bin name
      let installCmd = "";
      if (config.package) {
        installCmd = `npm install -g ${config.package}`;
      } else {
        installCmd = this.getInstallCommand(config.name) || "";
      }
      if (installCmd) {
        const res = await SandboxService.execCommand(sandboxId, installCmd, "/workspace");
        if (res.exit !== 0) {
          throw new Error(`MCP install failed: ${res.stderr || res.stdout || "unknown error"}`);
        }
      }
      if (config.package) {
        const bin = await this.resolvePackageBin(sandboxId, config.package);
        if (bin) config.command = bin;
      }
    }

    const result = await pool.query(
      `INSERT INTO mcp_servers (id, user_id, name, transport, config, status, installed_on_sandbox)
       VALUES ($1, $2, $3, $4, $5, 'connected', true) RETURNING *`,
      [uuid(), userId, config.name, config.transport, JSON.stringify(config)]
    );

    return this.decorate(result.rows[0]);
  }

  /**
   * Request to install a new MCP server — requires explicit user approval.
   * Creates a permission block in the thread (kind "permission", detail "mcp_install")
   * that the frontend renders with Allow / Deny buttons. On approval the install
   * proceeds; on decline the agent finds an alternative.
   */
  static async requestInstall(userId: string, threadId: string, name: string, config: any): Promise<any> {
    const id = uuid();
    try {
      const maxOrder = await pool.query(
        `SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM thread_blocks WHERE thread_id = $1`,
        [threadId]
      );
      await pool.query(
        `INSERT INTO thread_blocks (id, thread_id, kind, data, sort_order) VALUES ($1, $2, $3, $4, $5)`,
        [id, threadId, "permission", JSON.stringify({
          tool: "mcp_install",
          detail: `Install MCP server "${name}"`,
          mcp_install: { name, config },
          resolved: "pending",
          request_id: id,
        }), maxOrder.rows[0].next]
      );
    } catch { /* non-critical */ }
    return { id, name, status: "pending" };
  }

  /** Resolve a pending MCP install request (approve or decline) */
  static async resolveInstallRequest(userId: string, threadId: string, requestId: string, approved: boolean): Promise<any> {
    const blocks = await pool.query(
      `SELECT * FROM thread_blocks WHERE thread_id = $1 AND kind = 'permission' ORDER BY sort_order ASC`,
      [threadId]
    );
    let found = null;
    for (const b of blocks.rows) {
      const data = typeof b.data === "string" ? JSON.parse(b.data) : b.data;
      if (data.request_id === requestId) found = { block: b, data };
    }
    if (!found) throw new Error("Permission request not found");

    const payload = {
      ...found.data,
      resolved: approved ? "allow" : "deny",
    };
    await pool.query(`UPDATE thread_blocks SET data = $1 WHERE id = $2`, [JSON.stringify(payload), found.block.id]);

    if (approved && found.data.mcp_install) {
      const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [userId]);
      const sandboxId = user.rows[0]?.sandbox_id;
      if (!sandboxId) throw new Error("No sandbox available");
      const server = await this.install(userId, sandboxId, {
        name: found.data.mcp_install.name,
        transport: "stdio",
        ...found.data.mcp_install.config,
      });
      return { ok: true, approved, server };
    }

    return { ok: true, approved, declined: !approved };
  }

  /** List user's MCP servers — seeds built-ins automatically */
  static async list(userId: string): Promise<any[]> {
    await seedMcpServers(userId);
    const result = await pool.query(
      `SELECT * FROM mcp_servers WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId]
    );
    return result.rows.map((r) => this.decorate(r));
  }

  /** Call an MCP tool — built-ins execute for real in sandbox / GitHub API */
  static async callTool(userId: string, serverRef: string, toolName: string, args: any): Promise<any> {
    const server = await pool.query(
      `SELECT * FROM mcp_servers WHERE user_id = $1 AND (id = $2 OR name = $2)`,
      [userId, serverRef]
    );
    if (server.rows.length === 0) throw new Error(`MCP server '${serverRef}' not found`);

    const row = server.rows[0];
    const config = row.config;

    if (config?.builtin) {
      return this.callBuiltin(userId, row.name, toolName, args || {});
    }

    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [userId]);
    const sandboxId = user.rows[0]?.sandbox_id;
    if (!sandboxId) throw new Error("No sandbox available");

    // Custom server: execute via the sandbox
    if (config.transport === "stdio") {
      const command = this.resolveCommand(config);
      if (!command) throw new Error("No command configured for stdio server");
      const cmd = `echo '${JSON.stringify({ jsonrpc: "2.0", method: "tools/call", params: { name: toolName, arguments: args }, id: 1 })}' | ${command} ${config.args?.join(" ") || ""}`;
      const result = await SandboxService.execCommand(sandboxId, cmd);
      try {
        const parsed = JSON.parse(result.stdout);
        return parsed.result;
      } catch {
        return result.stdout;
      }
    }

    if (config.transport === "http" && config.url) {
      const resp = await fetch(`${config.url}/tools/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: toolName, arguments: args }),
      });
      return resp.json();
    }

    throw new Error("Invalid MCP server config");
  }

  /** Get available tools — real tool lists for built-ins, live discovery for custom servers */
  static async getTools(userId: string, serverRef: string): Promise<MCPTool[]> {
    const server = await pool.query(
      `SELECT * FROM mcp_servers WHERE user_id = $1 AND (id = $2 OR name = $2)`,
      [userId, serverRef]
    );
    if (server.rows.length === 0) return [];
    const row = server.rows[0];
    if (row.config?.builtin) return BUILTIN_TOOLS[row.name] || [];

    // Custom server: discover tools, cached in config.tool_list
    const cached = row.config?.tool_list;
    if (Array.isArray(cached) && cached.length > 0) return cached;

    let tools: MCPTool[] = [];
    if (row.config?.transport === "stdio" && this.resolveCommand(row.config)) {
      tools = await this.discoverStdioTools(userId, row);
    } else if (row.config?.transport === "http" && row.config?.url) {
      try {
        const resp = await fetch(`${row.config.url}/tools/list`);
        const data = await resp.json();
        tools = Array.isArray(data.tools) ? data.tools : [];
      } catch {
        tools = [];
      }
    }

    if (tools.length > 0) {
      await pool.query(
        `UPDATE mcp_servers SET config = jsonb_set(config, '{tool_list}', $1::jsonb), tools_count = $2, updated_at = NOW() WHERE id = $3`,
        [JSON.stringify(tools), tools.length, row.id]
      );
    }
    return tools;
  }

  /** Resolve the shell command for a stdio server (command, or globally-installed package bin) */
  private static resolveCommand(config: any): string {
    if (config.command) return config.command;
    if (config.package) return config.package.replace(/^@[^/]+\//, "");
    return "";
  }

  /** Resolve the real bin name of an npm package (bin field from npm metadata) */
  private static async resolvePackageBin(sandboxId: string, pkg: string): Promise<string> {
    const res = await SandboxService.execCommand(sandboxId, `npm view ${pkg} bin --json 2>/dev/null`);
    try {
      const parsed = JSON.parse(res.stdout);
      if (typeof parsed === "string" && parsed) return parsed;
      if (parsed && typeof parsed === "object") {
        const keys = Object.keys(parsed);
        if (keys.length > 0) return keys[0];
      }
    } catch {}
    return pkg.replace(/^@[^/]+\//, "");
  }

  /** Discover tools from a custom stdio server by piping a tools/list request */
  private static async discoverStdioTools(userId: string, row: any): Promise<MCPTool[]> {
    const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [userId]);
    const sandboxId = user.rows[0]?.sandbox_id;
    if (!sandboxId) return [];
    const command = this.resolveCommand(row.config);
    const args = (row.config?.args || []).join(" ");
    const request = JSON.stringify({ jsonrpc: "2.0", method: "tools/list", params: {}, id: 1 });
    const result = await SandboxService.execCommand(sandboxId, `echo '${request}' | ${command} ${args}`);
    try {
      const parsed = JSON.parse(result.stdout);
      if (Array.isArray(parsed.result?.tools)) {
        return parsed.result.tools.map((t: any) => ({
          name: t.name,
          description: t.description || "",
          inputSchema: t.inputSchema || { type: "object", properties: {} },
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  /** Toggle MCP server status */
  static async toggle(userId: string, serverId: string, enabled: boolean): Promise<void> {
    await pool.query(
      `UPDATE mcp_servers SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
      [enabled ? "connected" : "off", serverId, userId]
    );
  }

  /** Remove an MCP server (built-ins are re-seeded on next list) */
  static async remove(userId: string, serverId: string): Promise<void> {
    await pool.query(`DELETE FROM mcp_servers WHERE id = $1 AND user_id = $2 AND config->>'builtin' IS NOT TRUE`, [serverId, userId]);
  }

  // ── built-in tool execution ───────────────────────────────────────────────

  private static async callBuiltin(userId: string, serverName: string, toolName: string, args: any): Promise<any> {
    const started = Date.now();

    if (serverName === "filesystem") {
      const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [userId]);
      const sandboxId = user.rows[0]?.sandbox_id;
      if (!sandboxId) throw new Error("No sandbox available");
      const p = args.path || "/workspace";
      const out = await this.filesystemTool(sandboxId, toolName, args, p);
      return { content: out, latency_ms: Date.now() - started, tool: toolName };
    }

    if (serverName === "shell") {
      const user = await pool.query(`SELECT sandbox_id FROM users WHERE id = $1`, [userId]);
      const sandboxId = user.rows[0]?.sandbox_id;
      if (!sandboxId) throw new Error("No sandbox available");
      const out = await this.shellTool(sandboxId, toolName, args);
      return { content: out, latency_ms: Date.now() - started, tool: toolName };
    }

    if (serverName === "github") {
      const token = await this.getGitHubToken(userId);
      const out = await this.githubTool(token, toolName, args);
      return { content: out, latency_ms: Date.now() - started, tool: toolName };
    }

    throw new Error(`Unknown MCP server '${serverName}'`);
  }

  private static async filesystemTool(sandboxId: string, toolName: string, args: any, p: string): Promise<string> {
    switch (toolName) {
      case "read_file":
      case "read_text": {
        const r = await SandboxService.execCommand(sandboxId, `cat "${p}"`);
        return r.stdout || r.stderr || "File is empty";
      }
      case "write_file": {
        const esc = String(args.content ?? "").replace(/'/g, "'\\''");
        const r = await SandboxService.execCommand(sandboxId, `cat > '${p}' << 'KIREN_EOF'\n${args.content}\nKIREN_EOF`);
        return r.exit === 0 ? `Wrote ${String(args.content ?? "").length} bytes to ${p}` : r.stderr;
      }
      case "list_dir": {
        const r = await SandboxService.execCommand(sandboxId, `ls -la "${p}"`);
        return r.stdout || r.stderr;
      }
      case "search_files": {
        const r = await SandboxService.execCommand(sandboxId, `grep -rn "${args.pattern}" "${p || "."}" --include="*" 2>/dev/null | head -50`);
        return r.stdout || "No matches found";
      }
      case "file_info": {
        const r = await SandboxService.execCommand(sandboxId, `stat "${p}" 2>/dev/null || ls -la "${p}"`);
        return r.stdout || r.stderr;
      }
      default:
        throw new Error(`Unknown filesystem tool '${toolName}'`);
    }
  }

  private static async shellTool(sandboxId: string, toolName: string, args: any): Promise<string> {
    switch (toolName) {
      case "run_command": {
        const r = await SandboxService.execCommand(sandboxId, args.command, args.cwd);
        return `exit ${r.exit}\n${r.stdout}${r.stderr ? "\nstderr: " + r.stderr : ""}`;
      }
      case "get_environment": {
        const r = await SandboxService.execCommand(sandboxId, `uname -a && node -v 2>/dev/null; python3 --version 2>/dev/null; free -h | head -2`);
        return r.stdout || r.stderr;
      }
      case "get_workspace_stats": {
        const r = await SandboxService.execCommand(sandboxId, `du -sh /workspace 2>/dev/null; df -h /workspace 2>/dev/null | tail -1`);
        return r.stdout || r.stderr;
      }
      case "list_processes": {
        const r = await SandboxService.execCommand(sandboxId, `ps aux | head -20`);
        return r.stdout || r.stderr;
      }
      default:
        throw new Error(`Unknown shell tool '${toolName}'`);
    }
  }

  private static async githubTool(accessToken: string, toolName: string, args: any): Promise<string> {
    const g = GitHubService;
    try {
      switch (toolName) {
        case "list_repos":
          return JSON.stringify((await g.getRepos(accessToken, args.page || 1, 30)).map((r: any) => ({
            full_name: r.full_name, private: r.private, language: r.language, default_branch: r.default_branch, description: r.description,
          })), null, 2);
        case "get_repo":
          return JSON.stringify(await g.getRepo(accessToken, args.owner, args.repo), null, 2);
        case "list_branches":
          return JSON.stringify(await g.getBranches(accessToken, args.owner, args.repo), null, 2);
        case "get_file":
          return await g.getFileContent(accessToken, args.owner, args.repo, args.path);
        case "get_tree":
          return JSON.stringify(await g.getTree(accessToken, args.owner, args.repo, args.sha || "main"), null, 2);
        case "list_workflows":
          return JSON.stringify(await g.getWorkflows(accessToken, args.owner, args.repo), null, 2);
        case "get_workflow_runs":
          return JSON.stringify(await g.getWorkflowRuns(accessToken, args.owner, args.repo), null, 2);
        case "create_pr":
          return JSON.stringify(await g.createPR(accessToken, args.owner, args.repo, args.title, args.head, args.base, args.body), null, 2);
        case "create_branch":
          return JSON.stringify(await g.createBranch(accessToken, args.owner, args.repo, args.new_branch, args.from_sha), null, 2);
        case "create_or_update_file":
          return JSON.stringify(await g.createOrUpdateFile(accessToken, args.owner, args.repo, args.path, args.content, args.message, args.sha, args.branch || "main"), null, 2);
        case "get_user":
          return JSON.stringify(await g.getUser(accessToken), null, 2);
        case "search_code":
          throw new Error("search_code requires a search token; use the other tools instead");
        default:
          throw new Error(`Unknown github tool '${toolName}'`);
      }
    } catch (err: any) {
      return `GitHub error: ${err.message}`;
    }
  }

  private static async getGitHubToken(userId: string): Promise<string> {
    const { GitHubService } = await import("./github.js");
    const token = await GitHubService.getAccessToken(userId);
    if (!token) throw new Error("No GitHub token. Re-authenticate.");
    return token;
  }

  /** Add display metadata (glyph/color/latency) to DB rows */
  private static decorate(row: any): any {
    const builtin = BUILTIN_MCP_SERVERS.find((b) => b.name === row.name);
    return {
      ...row,
      config: row.config ?? {},
      builtin: !!row.config?.builtin,
      glyph: builtin?.glyph || row.name.slice(0, 2).toUpperCase(),
      color: builtin?.color || "#1A1918",
      latency: row.status === "connected" ? "<50ms" : "—",
      tools: row.tools_count,
    };
  }

  private static getInstallCommand(name: string): string | null {
    const commands: Record<string, string> = {
      github: "npm install -g @modelcontextprotocol/server-github",
      slack: "npm install -g @modelcontextprotocol/server-slack",
      postgres: "npm install -g @modelcontextprotocol/server-postgres",
      filesystem: "npm install -g @modelcontextprotocol/server-filesystem",
      puppeteer: "npm install -g @modelcontextprotocol/server-puppeteer",
      brave: "npm install -g @modelcontextprotocol/server-brave-search",
    };
    return commands[name.toLowerCase()] || null;
  }
}
