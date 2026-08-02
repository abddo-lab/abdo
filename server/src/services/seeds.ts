// server/src/services/seeds.ts — Ready-made subagents + built-in MCP servers.
// Seeded automatically per user, no real MCP connection or setup required.
import pool from "../db.js";
import { v4 as uuid } from "uuid";

export const DEFAULT_SUBAGENTS = [
  {
    name: "reviewer",
    description: "Reviews diffs line-by-line before you commit. Catches bugs, style issues and missing tests.",
    icon: "eye",
    color: "#101014",
    scope: "workspace",
    tools: ["Read", "Grep", "Ls"],
    system_prompt: "You are @reviewer, a code review specialist. Read the diff, review every changed line, flag bugs, style issues, missing tests and security problems. Always report concrete findings with file:line references. Never make changes yourself.",
  },
  {
    name: "test-writer",
    description: "Writes failing tests first, then hands off to the main agent for implementation.",
    icon: "checkCircle",
    color: "#2c2c31",
    scope: "workspace",
    tools: ["Read", "Write", "Bash"],
    system_prompt: "You are @test-writer. You write failing tests first (red), run them to confirm they fail, then hand off. Use the project's test runner (vitest/jest/pytest). Write one test per behavior and keep tests fast and deterministic.",
  },
  {
    name: "docs-writer",
    description: "Keeps README, guides and inline docs in sync with every diff.",
    icon: "doc",
    color: "#3a3a41",
    scope: "workspace",
    tools: ["Read", "Write", "Edit"],
    system_prompt: "You are @docs-writer. Update README, API docs and code comments to match the actual code. Never document things that don't exist, never add comments to code, and keep docs concise. Flag stale docs you find.",
  },
  {
    name: "perf-hunter",
    description: "Profiles pages and scripts, flags regressions and proposes optimizations.",
    icon: "gauge",
    color: "#4a4a51",
    scope: "project",
    tools: ["Read", "Bash", "Grep"],
    system_prompt: "You are @perf-hunter. Profile the codebase for performance issues: render-blocking resources, N+1 queries, redundant re-renders, large bundles. Measure before and after, and only recommend changes with measured evidence.",
  },
  {
    name: "security-auditor",
    description: "Scans for vulnerabilities, secrets and unsafe patterns in the codebase.",
    icon: "shield",
    color: "#5a5a61",
    scope: "workspace",
    tools: ["Read", "Grep", "Bash"],
    system_prompt: "You are @security-auditor. Search for hardcoded secrets, SQL injection, XSS, unsafe deserialization, missing auth checks and known vulnerable dependencies. Report severity and file:line for every finding. Never print or copy secrets.",
  },
  {
    name: "refactor-specialist",
    description: "Extracts components, removes duplication and cleans up dead code.",
    icon: "layers",
    color: "#6a6a71",
    scope: "project",
    tools: ["Read", "Edit", "Write", "Grep"],
    system_prompt: "You are @refactor-specialist. Refactor for clarity and maintainability: extract duplicated logic, remove dead code, simplify control flow. Never change behavior — verify with the existing test suite afterwards.",
  },
  {
    name: "sudebug",
    description: "Debugs the live web view: opens the preview with agent-browser, captures a screenshot, and analyzes it with a vision model. Call this after building any complex web app to catch rendering errors, console errors and layout issues.",
    icon: "bug",
    color: "#2c1f2c",
    scope: "thread",
    tools: ["Read", "Bash"],
    system_prompt: "You are @sudebug, a web-view debugger. After the main agent builds an app, you open its live preview URL with agent-browser, capture what actually renders on screen, and analyze the screenshot with a vision model. You report console errors, blank screens, layout breaks and text visibility. You never guess — you always look at the real rendered page first. Report concrete findings and fixes back to the main agent.",
  },
];

export const BUILTIN_MCP_SERVERS = [
  {
    name: "filesystem",
    transport: "stdio",
    glyph: "FS",
    color: "#1A1918",
    tools_count: 6,
    config: { builtin: true, description: "Read, write and list files in your sandbox workspace." },
  },
  {
    name: "shell",
    transport: "stdio",
    glyph: "SH",
    color: "#2A2520",
    tools_count: 4,
    config: { builtin: true, description: "Run shell commands inside your sandbox." },
  },
  {
    name: "github",
    transport: "http",
    glyph: "GH",
    color: "#16161a",
    tools_count: 12,
    config: { builtin: true, description: "Repos, branches, files and PRs from your GitHub account." },
  },
];

/** Ensure the user has the 6 default subagents (idempotent) */
export async function seedSubagents(userId: string): Promise<void> {
  const existing = await pool.query(`SELECT name FROM subagents WHERE user_id = $1`, [userId]);
  const have = new Set(existing.rows.map((r) => r.name));
  for (const sa of DEFAULT_SUBAGENTS) {
    if (have.has(sa.name)) continue;
    await pool.query(
      `INSERT INTO subagents (id, user_id, name, description, icon, color, scope, tools, system_prompt, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
      [uuid(), userId, sa.name, sa.description, sa.icon, sa.color, sa.scope, JSON.stringify(sa.tools), sa.system_prompt]
    );
  }
}

/** Ensure the user has the built-in MCP servers (idempotent) */
export async function seedMcpServers(userId: string): Promise<void> {
  const existing = await pool.query(`SELECT name FROM mcp_servers WHERE user_id = $1`, [userId]);
  const have = new Set(existing.rows.map((r) => r.name));
  for (const mcp of BUILTIN_MCP_SERVERS) {
    if (have.has(mcp.name)) continue;
    await pool.query(
      `INSERT INTO mcp_servers (id, user_id, name, transport, config, status, tools_count, installed_on_sandbox)
       VALUES ($1, $2, $3, $4, $5, 'connected', $6, true)`,
      [uuid(), userId, mcp.name, mcp.transport, JSON.stringify(mcp.config), mcp.tools_count]
    );
  }
}

/** Seed both — call on user creation and lazily from routes */
export async function seedUserExtras(userId: string): Promise<void> {
  await seedSubagents(userId);
  await seedMcpServers(userId);
}
