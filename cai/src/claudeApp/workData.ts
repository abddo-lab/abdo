import { fileTree, type FileNode } from "./data";

/* ============================================================
   Deterministic PRNG so every render/session looks identical
   ============================================================ */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ============================================================
   USAGE — 45 days of synthetic-but-plausible telemetry
   ============================================================ */
export const MODELS = ["Opus 4.8", "Sonnet 4.6", "Haiku 4.5"] as const;
export type ModelName = (typeof MODELS)[number];

export interface UsageDay {
  iso: string;
  label: string;
  dow: number;
  sessions: number;
  msgs: number;
  inTok: number;
  outTok: number;
  cacheTok: number;
  cost: number;
  byModel: Record<ModelName, number>;
}

const BASE_MS = Date.UTC(2026, 1, 18);
const DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function buildDays(n: number): UsageDay[] {
  const rnd = mulberry32(20260218);
  const out: UsageDay[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(BASE_MS - i * DAY);
    const dow = d.getUTCDay();
    const weekend = dow === 0 || dow === 6;
    const spike = rnd() > 0.88 ? 1.85 : 1;
    const activity = (weekend ? 0.22 : 1) * spike * (0.55 + rnd() * 0.9);

    const inTok = Math.round(activity * 380_000 + rnd() * 60_000);
    const outTok = Math.round(activity * 52_000 + rnd() * 12_000);
    const cacheTok = Math.round(activity * 1_250_000 + rnd() * 220_000);
    const total = inTok + outTok;

    const wOpus = 0.55 + rnd() * 0.25;
    const wSonnet = (1 - wOpus) * (0.6 + rnd() * 0.3);
    const wHaiku = 1 - wOpus - wSonnet;

    out.push({
      iso: d.toISOString().slice(0, 10),
      label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`,
      dow,
      sessions: Math.max(0, Math.round(activity * 4)),
      msgs: Math.round(activity * 120 + rnd() * 40),
      inTok,
      outTok,
      cacheTok,
      cost: +(inTok / 1e6 * 15 + outTok / 1e6 * 75 + cacheTok / 1e6 * 1.5).toFixed(2),
      byModel: {
        "Opus 4.8": Math.round(total * wOpus),
        "Sonnet 4.6": Math.round(total * wSonnet),
        "Haiku 4.5": Math.round(total * wHaiku),
      },
    });
  }
  return out;
}

export const usageDays = buildDays(45);

/* hour-of-day distribution (0-23) — night-owl shaped */
export const hourly: number[] = (() => {
  const rnd = mulberry32(77123);
  const shape = [
    2, 1, 1, 0, 0, 0, 1, 3, 8, 16, 22, 20, 14, 17, 21, 24, 22, 18, 15, 19, 26, 30, 21, 9,
  ];
  return shape.map((v) => Math.round(v * (0.8 + rnd() * 0.5)));
})();

export const planLimits = [
  { label: "5-hour session", used: 8, reset: "29m", detail: "resets rolling" },
  { label: "Weekly · all models", used: 19, reset: "1d 4h", detail: "Mon 00:00 UTC" },
  { label: "Weekly · Opus only", used: 41, reset: "1d 4h", detail: "Mon 00:00 UTC" },
];

export const threadCosts = [
  { name: "Tailspin Toys — night lighting", tokens: 2_140_000, cost: 34.8, model: "Opus 4.8", runs: 41 },
  { name: "Metrics dashboard", tokens: 1_820_000, cost: 27.1, model: "Opus 4.8", runs: 33 },
  { name: "Add pagination to GET /api/links", tokens: 940_000, cost: 12.4, model: "Sonnet 4.6", runs: 18 },
  { name: "Scaffolding git-commit-weather", tokens: 760_000, cost: 9.8, model: "Opus 4.8", runs: 22 },
  { name: "fix: retry on short code collision", tokens: 410_000, cost: 5.2, model: "Sonnet 4.6", runs: 11 },
  { name: "Investigating CLI model rename", tokens: 180_000, cost: 1.9, model: "Haiku 4.5", runs: 6 },
];

/* ============================================================
   MY WORK — live simulation of PRs / reviews / automations
   ============================================================ */
export type CheckState = "passed" | "running" | "failed" | "queued";

export interface WorkCheck {
  name: string;
  state: CheckState;
  ms: number;
}

export interface WorkItem {
  id: string;
  title: string;
  kind: "pr" | "review" | "task";
  repo: string;
  branch: string;
  updated: string;
  add: number;
  del: number;
  files: number;
  comments: number;
  reviewers: string[];
  checks: WorkCheck[];
  state: "open" | "merged" | "draft" | "changes";
  env: "local" | "cloud";
}

export const workItems: WorkItem[] = [
  {
    id: "pr-412",
    title: "fix: retry on short code collision",
    kind: "pr",
    repo: "tailspin/links",
    branch: "claude/retry-collision",
    updated: "2m ago",
    add: 64,
    del: 12,
    files: 3,
    comments: 2,
    reviewers: ["dev@tailspin.dev"],
    checks: [
      { name: "lint", state: "passed", ms: 4200 },
      { name: "unit", state: "passed", ms: 18400 },
      { name: "e2e", state: "running", ms: 0 },
    ],
    state: "open",
    env: "cloud",
  },
  {
    id: "pr-408",
    title: "Add pagination to GET /api/links",
    kind: "pr",
    repo: "tailspin/links",
    branch: "claude/paginate-links",
    updated: "1h ago",
    add: 138,
    del: 22,
    files: 5,
    comments: 6,
    reviewers: ["dev@tailspin.dev", "qa@tailspin.dev"],
    checks: [
      { name: "lint", state: "passed", ms: 3900 },
      { name: "unit", state: "passed", ms: 20100 },
      { name: "e2e", state: "passed", ms: 61000 },
    ],
    state: "open",
    env: "cloud",
  },
  {
    id: "pr-401",
    title: "Reject invalid / non-http(s) URLs",
    kind: "pr",
    repo: "tailspin/links",
    branch: "claude/url-validation",
    updated: "3h ago",
    add: 41,
    del: 8,
    files: 2,
    comments: 1,
    reviewers: ["christina@tailspin.dev"],
    checks: [
      { name: "lint", state: "passed", ms: 3600 },
      { name: "unit", state: "failed", ms: 15200 },
    ],
    state: "changes",
    env: "local",
  },
  {
    id: "rv-77",
    title: "Review: adversarial pass on night lighting",
    kind: "review",
    repo: "tailspin/toys",
    branch: "claude/night-lighting",
    updated: "now",
    add: 42,
    del: 9,
    files: 2,
    comments: 4,
    reviewers: ["claude:review-agent"],
    checks: [{ name: "review", state: "running", ms: 0 }],
    state: "draft",
    env: "local",
  },
  {
    id: "tk-19",
    title: "Migrate click_events to partitioned table",
    kind: "task",
    repo: "tailspin/links",
    branch: "claude/partition-clicks",
    updated: "1d ago",
    add: 0,
    del: 0,
    files: 0,
    comments: 0,
    reviewers: [],
    checks: [],
    state: "draft",
    env: "cloud",
  },
];

export interface AutomationRun {
  id: string;
  at: string;
  ok: boolean;
  ms: number;
  summary: string;
  logs: string[];
}

export type TriggerKind = "schedule" | "webhook" | "event" | "manual";

export interface Automation {
  id: string;
  label: string;
  desc: string;
  trigger: TriggerKind;
  schedule: string;
  cron: string;
  last: string;
  next: string;
  enabled: boolean;
  model: "Opus 4.8" | "Sonnet 4.6" | "Haiku 4.5";
  effort: "Low" | "Medium" | "High" | "Max";
  repo: string;
  branch: string;
  steps: string[];
  successRate: number; // 0..1 over last 20
  avgMs: number;
  runs30d: number;
  cost30d: number;
  history: AutomationRun[];
}

export const automationsList: Automation[] = [
  {
    id: "auto-dep",
    label: "Nightly dependency bump",
    desc: "Bumps minor & patch versions, runs the test suite, and opens a PR if everything's green.",
    trigger: "schedule",
    schedule: "daily 06:00 UTC",
    cron: "0 6 * * *",
    last: "8h ago",
    next: "in 16h",
    enabled: true,
    model: "Sonnet 4.6",
    effort: "Medium",
    repo: "tailspin/links",
    branch: "claude/bump-deps",
    steps: [
      "Read package.json + lockfile",
      "npm outdated --json",
      "Bump minor & patch ranges",
      "npm install",
      "npm test",
      "Open PR with changelog",
    ],
    successRate: 0.85,
    avgMs: 174_000,
    runs30d: 30,
    cost30d: 12.4,
    history: [
      { id: "r1", at: "Feb 18 06:00", ok: true,  ms: 184_000, summary: "Bumped 12 packages · 34 tests passed", logs: ["> npm outdated", "found 12 packages to update", "> npm install", "added 4 · updated 12", "> npm test", "✓ 34 passed in 21.4s", "opened PR #418"] },
      { id: "r2", at: "Feb 17 06:00", ok: true,  ms: 171_000, summary: "Bumped 4 packages · 34 tests passed", logs: ["> npm outdated", "found 4 packages", "> npm install", "> npm test", "✓ 34 passed", "opened PR #416"] },
      { id: "r3", at: "Feb 16 06:00", ok: false, ms:  42_000, summary: "vitest failed after react-dom bump", logs: ["> npm outdated", "> npm install", "> npm test", "✗ Preview.test.tsx", "rolled back changes", "no PR opened"] },
      { id: "r4", at: "Feb 15 06:00", ok: true,  ms: 168_000, summary: "Bumped 7 packages · 34 tests passed", logs: ["> npm outdated", "> npm install", "> npm test", "✓ 34 passed", "opened PR #412"] },
      { id: "r5", at: "Feb 14 06:00", ok: true,  ms: 179_000, summary: "Bumped 3 packages · 34 tests passed", logs: ["> npm outdated", "> npm install", "> npm test", "✓ 34 passed", "opened PR #409"] },
    ],
  },
  {
    id: "auto-triage",
    label: "PR triage + review",
    desc: "Labels new pull requests, requests reviewers, and posts an adversarial code review.",
    trigger: "webhook",
    schedule: "every 30m",
    cron: "*/30 * * * *",
    last: "12m ago",
    next: "in 18m",
    enabled: true,
    model: "Opus 4.8",
    effort: "High",
    repo: "tailspin/*",
    branch: "any",
    steps: [
      "List open PRs updated in the last 30m",
      "Classify with heuristics + LLM",
      "Apply labels + request reviewers",
      "Post review comment",
    ],
    successRate: 0.98,
    avgMs: 61_000,
    runs30d: 1_440,
    cost30d: 48.2,
    history: [
      { id: "t1", at: "Feb 18 09:30", ok: true, ms: 62_000, summary: "Triaged 3 PRs · 1 review posted", logs: ["listing PRs updated since 09:00", "found 3 PRs", "labelled #418, #417, #416", "requested review on #418", "posted review on #417"] },
      { id: "t2", at: "Feb 18 09:00", ok: true, ms: 58_000, summary: "Triaged 2 PRs", logs: ["listing PRs", "found 2 PRs", "labelled + requested reviewers"] },
      { id: "t3", at: "Feb 18 08:30", ok: true, ms: 54_000, summary: "No new PRs", logs: ["listing PRs", "0 to process", "exiting"] },
    ],
  },
  {
    id: "auto-flake",
    label: "Flaky test sweep",
    desc: "Reruns the test suite 10 times to surface tests that fail non-deterministically.",
    trigger: "schedule",
    schedule: "weekly Sun 03:00",
    cron: "0 3 * * 0",
    last: "4d ago",
    next: "in 3d",
    enabled: false,
    model: "Haiku 4.5",
    effort: "Low",
    repo: "tailspin/toys",
    branch: "main",
    steps: [
      "Checkout main",
      "npm ci",
      "Run test suite × 10",
      "Diff failure sets",
      "Open issue if any test is flaky",
    ],
    successRate: 1,
    avgMs: 940_000,
    runs30d: 4,
    cost30d: 2.1,
    history: [
      { id: "f1", at: "Feb 14 03:00", ok: true, ms: 940_000, summary: "No flaky tests found across 10 runs", logs: ["> npm ci", "> npm test (run 1)", "> npm test (run 2)", "…", "> npm test (run 10)", "no failures detected"] },
    ],
  },
  {
    id: "auto-oncall",
    label: "On-call bug reproduction",
    desc: "When a new Sentry error is filed, spin up a sandbox, reproduce it, and file a minimal repro.",
    trigger: "event",
    schedule: "on Sentry alert",
    cron: "-",
    last: "2d ago",
    next: "on next alert",
    enabled: true,
    model: "Opus 4.8",
    effort: "Max",
    repo: "tailspin/links",
    branch: "claude/repro-*",
    steps: [
      "Pull stack trace + breadcrumbs",
      "Boot cloud sandbox",
      "Write failing test",
      "Save transcript + repro branch",
    ],
    successRate: 0.72,
    avgMs: 420_000,
    runs30d: 11,
    cost30d: 62.9,
    history: [
      { id: "o1", at: "Feb 16 14:22", ok: true,  ms: 468_000, summary: "Reproduced short_code collision under load", logs: ["pulled event evt_9f21c", "booted sandbox sbx-4f21", "wrote failing test", "pushed branch claude/repro-collision", "linked to PR #412"] },
      { id: "o2", at: "Feb 15 22:10", ok: false, ms:  91_000, summary: "Couldn't reproduce — insufficient breadcrumbs", logs: ["pulled event evt_9ee14", "booted sandbox", "unable to reproduce", "flagged for human triage"] },
    ],
  },
  {
    id: "auto-doc",
    label: "Docs sync",
    desc: "Watches src/**/*.ts and regenerates the API reference when public exports change.",
    trigger: "event",
    schedule: "on file save",
    cron: "-",
    last: "3h ago",
    next: "on next change",
    enabled: true,
    model: "Sonnet 4.6",
    effort: "Low",
    repo: "tailspin/links",
    branch: "docs/auto-*",
    steps: [
      "Diff exported symbols",
      "Regenerate docs/api.md",
      "Commit if anything changed",
    ],
    successRate: 1,
    avgMs: 24_000,
    runs30d: 87,
    cost30d: 3.4,
    history: [
      { id: "d1", at: "Feb 18 06:44", ok: true, ms: 21_000, summary: "Regenerated docs · 1 new export", logs: ["diff exports", "+ listLinks()", "wrote docs/api.md", "committed d3f21a"] },
    ],
  },
];

/* ============================================================
   TOOLS — everything Claude can call
   ============================================================ */
export interface Tool {
  id: string;
  name: string;
  group: "Filesystem" | "Execution" | "Version control" | "Web" | "Data" | "Agents";
  desc: string;
  perm: "allow" | "ask" | "deny";
  calls: number;
  avgMs: number;
  source: "built-in" | "mcp";
  server?: string;
  enabled: boolean;
}

export const tools: Tool[] = [
  { id: "read_file", name: "read_file", group: "Filesystem", desc: "Read any file in the workspace, with line ranges.", perm: "allow", calls: 8421, avgMs: 42, source: "built-in", enabled: true },
  { id: "write_file", name: "write_file", group: "Filesystem", desc: "Create a file or replace its full contents.", perm: "ask", calls: 1204, avgMs: 88, source: "built-in", enabled: true },
  { id: "edit_file", name: "edit_file", group: "Filesystem", desc: "Apply a targeted patch to part of a file.", perm: "ask", calls: 3390, avgMs: 96, source: "built-in", enabled: true },
  { id: "glob", name: "glob", group: "Filesystem", desc: "Find files by name pattern across the repo.", perm: "allow", calls: 2210, avgMs: 61, source: "built-in", enabled: true },
  { id: "grep", name: "grep", group: "Filesystem", desc: "Regex search file contents with context lines.", perm: "allow", calls: 4102, avgMs: 74, source: "built-in", enabled: true },

  { id: "bash", name: "bash", group: "Execution", desc: "Run shell commands in the active environment.", perm: "ask", calls: 2988, avgMs: 1840, source: "built-in", enabled: true },
  { id: "run_tests", name: "run_tests", group: "Execution", desc: "Execute the test suite and parse failures.", perm: "ask", calls: 641, avgMs: 21400, source: "built-in", enabled: true },
  { id: "build_project", name: "build_project", group: "Execution", desc: "Compile the project and surface build errors.", perm: "ask", calls: 512, avgMs: 4900, source: "built-in", enabled: true },
  { id: "read_terminal", name: "read_terminal_output", group: "Execution", desc: "Stream stdout/stderr from a running process.", perm: "allow", calls: 1877, avgMs: 30, source: "built-in", enabled: true },

  { id: "git_status", name: "git_status", group: "Version control", desc: "Inspect the working tree and staged changes.", perm: "allow", calls: 1450, avgMs: 55, source: "built-in", enabled: true },
  { id: "git_commit", name: "git_commit", group: "Version control", desc: "Stage and commit with a written message.", perm: "ask", calls: 388, avgMs: 210, source: "built-in", enabled: true },
  { id: "git_push", name: "git_push", group: "Version control", desc: "Push the branch to the remote.", perm: "deny", calls: 96, avgMs: 1600, source: "built-in", enabled: false },
  { id: "open_pr", name: "open_pull_request", group: "Version control", desc: "Open a PR with a generated description.", perm: "deny", calls: 74, avgMs: 2400, source: "mcp", server: "github", enabled: false },

  { id: "web_search", name: "web_search", group: "Web", desc: "Search the web for current documentation.", perm: "allow", calls: 903, avgMs: 2600, source: "built-in", enabled: true },
  { id: "web_fetch", name: "web_fetch", group: "Web", desc: "Fetch and read a page as markdown.", perm: "allow", calls: 1188, avgMs: 1900, source: "built-in", enabled: true },
  { id: "screenshot", name: "take_screenshot", group: "Web", desc: "Capture the live preview or a browser canvas.", perm: "allow", calls: 452, avgMs: 720, source: "built-in", enabled: true },

  { id: "sql_query", name: "sql_query", group: "Data", desc: "Run read-only SQL against the attached database.", perm: "ask", calls: 610, avgMs: 180, source: "mcp", server: "postgres", enabled: true },
  { id: "sql_write", name: "sql_migrate", group: "Data", desc: "Apply schema migrations to the database.", perm: "deny", calls: 41, avgMs: 940, source: "mcp", server: "postgres", enabled: false },
  { id: "sentry", name: "sentry_events", group: "Data", desc: "Pull error events, stack traces and breadcrumbs.", perm: "allow", calls: 233, avgMs: 810, source: "mcp", server: "sentry", enabled: false },

  { id: "spawn_agent", name: "spawn_subagent", group: "Agents", desc: "Dispatch a specialised subagent in parallel.", perm: "allow", calls: 486, avgMs: 42000, source: "built-in", enabled: true },
  { id: "memory", name: "memory_write", group: "Agents", desc: "Persist facts to CLAUDE.md for future threads.", perm: "ask", calls: 152, avgMs: 120, source: "built-in", enabled: true },
];

/* ============================================================
   SUBAGENTS — parallel specialists
   ============================================================ */
export interface Subagent {
  id: string;
  name: string;
  role: string;
  desc: string;
  model: "Opus 4.8" | "Sonnet 4.6" | "Haiku 4.5";
  thinking: "Standard" | "Extended";
  tools: string[];
  runs: number;
  successRate: number;
  avgMs: number;
  enabled: boolean;
  builtin: boolean;
}

export const subagents: Subagent[] = [
  {
    id: "reviewer",
    name: "reviewer",
    role: "Adversarial code review",
    desc: "Hunts for correctness bugs, race conditions and missed edge cases, then verifies each finding against the source before reporting.",
    model: "Opus 4.8",
    thinking: "Extended",
    tools: ["read_file", "grep", "glob", "run_tests"],
    runs: 214,
    successRate: 0.94,
    avgMs: 48_000,
    enabled: true,
    builtin: true,
  },
  {
    id: "tester",
    name: "tester",
    role: "Test authoring & repair",
    desc: "Writes failing tests that reproduce a bug, then keeps iterating until the suite is green without weakening assertions.",
    model: "Sonnet 4.6",
    thinking: "Standard",
    tools: ["read_file", "write_file", "edit_file", "run_tests", "bash"],
    runs: 168,
    successRate: 0.89,
    avgMs: 62_000,
    enabled: true,
    builtin: true,
  },
  {
    id: "explorer",
    name: "explorer",
    role: "Codebase cartography",
    desc: "Maps unfamiliar repos fast — entry points, data flow and module boundaries — and returns a compact briefing instead of raw files.",
    model: "Haiku 4.5",
    thinking: "Standard",
    tools: ["glob", "grep", "read_file"],
    runs: 391,
    successRate: 0.97,
    avgMs: 14_000,
    enabled: true,
    builtin: true,
  },
  {
    id: "security",
    name: "security-auditor",
    role: "Vulnerability sweep",
    desc: "Scans for injection, auth gaps, unsafe deserialization and leaked secrets, ranking findings by exploitability.",
    model: "Opus 4.8",
    thinking: "Extended",
    tools: ["read_file", "grep", "web_search", "sentry"],
    runs: 87,
    successRate: 0.91,
    avgMs: 71_000,
    enabled: true,
    builtin: false,
  },
  {
    id: "perf",
    name: "perf-profiler",
    role: "Performance analysis",
    desc: "Profiles builds and hot paths, isolates the dominant cost, and proposes changes with measured before/after numbers.",
    model: "Opus 4.8",
    thinking: "Extended",
    tools: ["bash", "read_file", "build_project", "read_terminal"],
    runs: 63,
    successRate: 0.85,
    avgMs: 96_000,
    enabled: false,
    builtin: false,
  },
  {
    id: "docs",
    name: "docs-writer",
    role: "Documentation sync",
    desc: "Keeps README, API reference and inline comments aligned with the code whenever public exports change.",
    model: "Sonnet 4.6",
    thinking: "Standard",
    tools: ["read_file", "write_file", "glob"],
    runs: 142,
    successRate: 0.99,
    avgMs: 22_000,
    enabled: true,
    builtin: false,
  },
];

export const automationTemplates = [
  { id: "t-security", label: "Weekly security scan", trigger: "schedule" as TriggerKind, blurb: "npm audit + Snyk, open issues for criticals" },
  { id: "t-changelog", label: "Auto-changelog on release", trigger: "event" as TriggerKind, blurb: "When a tag is pushed, generate a changelog and update the release" },
  { id: "t-standup", label: "Daily standup summary", trigger: "schedule" as TriggerKind, blurb: "Post yesterday's merges + open work to Slack every morning" },
  { id: "t-issue", label: "Triage new issues", trigger: "webhook" as TriggerKind, blurb: "Label, prioritise, and assign new GitHub issues" },
];

/* ============================================================
   SETTINGS — declarative schema, real state in the panel
   ============================================================ */
export type SettingControl =
  | { kind: "toggle"; id: string; label: string; desc?: string; def: boolean }
  | { kind: "select"; id: string; label: string; desc?: string; options: string[]; def: string }
  | { kind: "slider"; id: string; label: string; desc?: string; min: number; max: number; step: number; def: number; unit?: string }
  | { kind: "perm"; id: string; label: string; desc?: string; def: "allow" | "ask" | "deny" };

export interface SettingsSection {
  id: string;
  title: string;
  icon: string;
  blurb: string;
  items: SettingControl[];
}

export const settingsSections: SettingsSection[] = [
  {
    id: "general",
    title: "General",
    icon: "sliders",
    blurb: "Core behaviour of the desktop app.",
    items: [
      { kind: "select", id: "startup", label: "On launch", desc: "What to show when the app opens", options: ["New thread", "Last thread", "My work"], def: "Last thread" },
      { kind: "toggle", id: "autoupdate", label: "Auto-update", desc: "Install new versions in the background", def: true },
      { kind: "toggle", id: "telemetry", label: "Share anonymous usage", desc: "Helps improve model routing", def: false },
      { kind: "toggle", id: "sounds", label: "Completion sound", desc: "Chime when a long task finishes", def: true },
    ],
  },
  {
    id: "editor",
    title: "Editor",
    icon: "code",
    blurb: "How the built-in Monaco editor behaves.",
    items: [
      { kind: "slider", id: "fontSize", label: "Font size", min: 10, max: 18, step: 0.5, def: 12.5, unit: "px" },
      { kind: "slider", id: "tabSize", label: "Tab size", min: 2, max: 8, step: 2, def: 2, unit: "sp" },
      { kind: "toggle", id: "minimap", label: "Minimap", desc: "Show the code overview strip", def: false },
      { kind: "toggle", id: "wordWrap", label: "Word wrap", def: false },
      { kind: "toggle", id: "formatSave", label: "Format on save", def: true },
      { kind: "toggle", id: "ligatures", label: "Font ligatures", def: true },
    ],
  },
  {
    id: "agent",
    title: "Agent",
    icon: "sparkles",
    blurb: "Defaults applied to every new thread.",
    items: [
      { kind: "select", id: "defModel", label: "Default model", options: ["cai-code-flash", "cai-luna-1", "cai-luna-pro"], def: "cai-luna-1" },
      { kind: "select", id: "defMode", label: "Default mode", options: ["Interactive", "Plan", "Autopilot"], def: "Interactive" },
      { kind: "select", id: "defEffort", label: "Default thinking", options: ["Standard", "Extended"], def: "Standard" },
      { kind: "slider", id: "parallel", label: "Parallel subagents", min: 1, max: 12, step: 1, def: 4 },
      { kind: "toggle", id: "autoCompact", label: "Auto-compact context", desc: "Summarise when the window fills", def: true },
      { kind: "toggle", id: "memory", label: "Project memory", desc: "Read and write CLAUDE.md", def: true },
    ],
  },
  {
    id: "perms",
    title: "Permissions",
    icon: "shield",
    blurb: "What Claude may do without asking you first.",
    items: [
      { kind: "perm", id: "pRead", label: "Read files", def: "allow" },
      { kind: "perm", id: "pWrite", label: "Edit files", def: "ask" },
      { kind: "perm", id: "pBash", label: "Run shell commands", def: "ask" },
      { kind: "perm", id: "pNet", label: "Network requests", def: "ask" },
      { kind: "perm", id: "pGit", label: "Git push / open PRs", def: "deny" },
      { kind: "perm", id: "pDb", label: "Write to database", def: "deny" },
    ],
  },
];

export const mcpServers = [
  { id: "gh", name: "github", transport: "stdio", tools: 24, connected: true },
  { id: "pg", name: "postgres", transport: "stdio", tools: 9, connected: true },
  { id: "sentry", name: "sentry", transport: "http", tools: 12, connected: false },
  { id: "figma", name: "figma", transport: "sse", tools: 7, connected: false },
];

export const keybindings = [
  { action: "New thread", keys: "⌘ N" },
  { action: "Search everything", keys: "⌘ K" },
  { action: "My work", keys: "⌘ 1" },
  { action: "Usage", keys: "⌘ 2" },
  { action: "Automations", keys: "⌘ 3" },
  { action: "Tools & agents", keys: "⌘ 4" },
  { action: "Settings", keys: "⌘ 5" },
  { action: "Open profile menu", keys: "⌘ P" },
  { action: "Toggle sidebar", keys: "⌘ B" },
  { action: "Toggle workspace", keys: "⌘ J" },
  { action: "Cycle mode", keys: "⇧ ⇥" },
  { action: "Cycle effort", keys: "⌥ E" },
  { action: "Interrupt agent", keys: "esc" },
];

/* ============================================================
   COMPOSER — slash commands, @ mentions, + menu
   ============================================================ */
export interface SlashCommand {
  cmd: string;
  desc: string;
  group: string;
  action?: "clear" | "compact" | "cost" | "work" | "settings" | "help" | "diff" | "review" | "test" | "commit" | "init";
  args?: string;
}

export const slashCommands: SlashCommand[] = [
  { cmd: "/clear", desc: "Clear the conversation and free context", group: "Session", action: "clear" },
  { cmd: "/compact", desc: "Summarise history to reclaim context", group: "Session", action: "compact" },
  { cmd: "/resume", desc: "Resume a previous thread", group: "Session" },
  { cmd: "/export", desc: "Export this thread to markdown", group: "Session" },
  { cmd: "/cost", desc: "Show token usage and spend", group: "Session", action: "cost" },

  { cmd: "/model", desc: "Switch the active model", group: "Config", args: "<name>" },
  { cmd: "/effort", desc: "Set reasoning effort", group: "Config", args: "<low|medium|high|max>" },
  { cmd: "/permissions", desc: "Edit tool permissions", group: "Config", action: "settings" },
  { cmd: "/config", desc: "Open settings", group: "Config", action: "settings" },
  { cmd: "/mcp", desc: "Manage MCP servers", group: "Config", action: "settings" },

  { cmd: "/diff", desc: "Show uncommitted changes", group: "Code", action: "diff" },
  { cmd: "/review", desc: "Adversarial review of the working tree", group: "Code", action: "review" },
  { cmd: "/test", desc: "Run the test suite", group: "Code", action: "test" },
  { cmd: "/commit", desc: "Stage and commit with a written message", group: "Code", action: "commit" },
  { cmd: "/pr", desc: "Open a pull request", group: "Code", action: "work" },
  { cmd: "/init", desc: "Scan the repo and write CLAUDE.md", group: "Code", action: "init" },

  { cmd: "/memory", desc: "Edit project memory", group: "Context" },
  { cmd: "/agents", desc: "Configure subagents", group: "Context" },
  { cmd: "/hooks", desc: "Manage lifecycle hooks", group: "Context" },
  { cmd: "/help", desc: "List everything Claude can do", group: "Context", action: "help" },
];

export interface MentionTarget {
  id: string;
  label: string;
  sub: string;
  kind: "file" | "dir" | "agent" | "symbol";
}

function flatten(nodes: FileNode[], acc: MentionTarget[] = []): MentionTarget[] {
  for (const n of nodes) {
    acc.push({
      id: n.path,
      label: n.path,
      sub: n.kind === "dir" ? "directory" : n.status === "M" ? "modified" : n.status === "A" ? "added" : "file",
      kind: n.kind === "dir" ? "dir" : "file",
    });
    if (n.children) flatten(n.children, acc);
  }
  return acc;
}

export const mentionTargets: MentionTarget[] = [
  ...flatten(fileTree),
  { id: "agent:reviewer", label: "reviewer", sub: "adversarial code review subagent", kind: "agent" },
  { id: "agent:tester", label: "tester", sub: "writes and runs tests", kind: "agent" },
  { id: "agent:docs", label: "docs-writer", sub: "keeps README and docs in sync", kind: "agent" },
  { id: "sym:buildLighting", label: "buildLighting()", sub: "src/systems/Lighting.js", kind: "symbol" },
  { id: "sym:placePathLamps", label: "placePathLamps()", sub: "src/world/Level.js", kind: "symbol" },
  { id: "sym:listLinks", label: "listLinks()", sub: "src/api/links.ts", kind: "symbol" },
];

export interface PlusAction {
  id: string;
  label: string;
  desc: string;
  icon: string;
}

export const plusActions: PlusAction[] = [
  { id: "file", label: "Attach files", desc: "Send images, logs or docs", icon: "paperclip" },
  { id: "screenshot", label: "Capture screenshot", desc: "Grab a window or region", icon: "camera" },
  { id: "dir", label: "Add directory", desc: "Widen the workspace scope", icon: "folder" },
  { id: "mcp", label: "Connect MCP server", desc: "Bring in external tools", icon: "plug" },
  { id: "memory", label: "Add to memory", desc: "Remember this across threads", icon: "brain" },
  { id: "task", label: "Background task", desc: "Run a workflow while you keep going", icon: "zap" },
];
