import type { IconName } from "./icons";

/* ---------------------------------- diffs ---------------------------------- */

export type DiffLineType = "add" | "del" | "ctx";
export interface DiffLine { t: DiffLineType; text: string }
export interface DiffFile {
  id: string;
  path: string;
  add: number;
  del: number;
  startOld: number;
  startNew: number;
  status: "modified" | "added";
  lines: DiffLine[];
  comment?: { author: string; body: string; line: number };
}

let diffSeed = 0;
export function makeDiff(path: string, status: DiffFile["status"] = "modified"): DiffFile {
  diffSeed += 1;
  return {
    id: `d${diffSeed}`,
    path,
    add: 9,
    del: 3,
    startOld: 6,
    startNew: 6,
    status,
    lines: [
      { t: "ctx", text: "export function configure(opts: Options) {" },
      { t: "del", text: "  const delay = opts.debounce ?? 120;" },
      { t: "add", text: "  const delay = opts.debounce ?? 80;" },
      { t: "add", text: "  const maxLines = opts.maxPreviewLines ?? 12;" },
      { t: "ctx", text: "  const controller = new AbortController();" },
      { t: "del", text: "  return { delay, controller };" },
      { t: "add", text: "  return { delay, maxLines, controller };" },
      { t: "ctx", text: "}" },
      { t: "ctx", text: "" },
      { t: "add", text: "export function cancelPending(handle: Handle) {" },
      { t: "add", text: "  handle.controller.abort();" },
      { t: "add", text: "  handle.controller = new AbortController();" },
      { t: "add", text: "}" },
      { t: "del", text: "// TODO: revisit once streaming lands" },
      { t: "add", text: "// Streaming landed — cancellation is explicit now." },
    ],
  };
}

const heroDiff: DiffFile = {
  id: "d-hero",
  path: "src/sections/Hero.tsx",
  add: 12,
  del: 5,
  startOld: 14,
  startNew: 14,
  status: "modified",
  comment: { author: "Nadia", line: 6, body: "Love the tighter copy — can the CTA keep the 44px tap target on mobile?" },
  lines: [
    { t: "ctx", text: "export function Hero() {" },
    { t: "ctx", text: "  return (" },
    { t: "ctx", text: '    <section className="hero">' },
    { t: "del", text: '      <h1 className="text-4xl">Build faster with Kiren</h1>' },
    { t: "add", text: '      <h1 className="text-5xl tracking-tight">Ship products at agent speed</h1>' },
    { t: "del", text: "      <p>The AI workspace for teams.</p>" },
    { t: "add", text: "      <p className=\"lede\">Plan, build and review — one workspace, every agent.</p>" },
    { t: "add", text: '      <div className="cta-row">' },
    { t: "add", text: '        <Button size="lg">Start building</Button>' },
    { t: "add", text: '        <Button variant="ghost">Watch the tour</Button>' },
    { t: "add", text: "      </div>" },
    { t: "del", text: "      <Button>Get started</Button>" },
    { t: "ctx", text: "    </section>" },
    { t: "ctx", text: "  );" },
    { t: "ctx", text: "}" },
  ],
};

const tokensDiff: DiffFile = {
  id: "d-tokens",
  path: "src/styles/tokens.css",
  add: 8,
  del: 2,
  startOld: 1,
  startNew: 1,
  status: "modified",
  lines: [
    { t: "ctx", text: ":root {" },
    { t: "del", text: "  --surface: #f7f7f7;" },
    { t: "add", text: "  --surface: #ffffff;" },
    { t: "add", text: "  --surface-2: #fafafb;" },
    { t: "add", text: "  --surface-3: #f0f0f3;" },
    { t: "del", text: "  --radius: 6px;" },
    { t: "add", text: "  --radius: 12px;" },
    { t: "add", text: "  --shadow-card: 0 4px 16px -4px rgb(20 20 30 / 8%);" },
    { t: "ctx", text: "}" },
  ],
};

/* -------------------------------- transcript ------------------------------- */

export type Block =
  | { k: "user"; text: string; attach?: string[] }
  | { k: "thinking"; text: string; ms: number }
  | { k: "text"; text: string }
  | { k: "todo"; items: { label: string; state: "done" | "active" | "todo" }[] }
  | {
      k: "tool";
      tool: string;
      icon: IconName;
      target: string;
      meta?: string;
      output?: string[];
      status: "done" | "running" | "failed";
    }
  | { k: "terminal"; cmd: string; lines: string[]; exit: number }
  | { k: "diff"; fileIds: string[] }
  | { k: "permission"; tool: string; detail: string; resolved?: "allow" | "deny" }
  | { k: "preview"; label: string }
  | { k: "summary"; title: string; bullets: string[] };

export interface Thread {
  id: string;
  title: string;
  projectId: string;
  status: "review" | "running" | "done" | "draft";
  updated: string;
  model: string;
  branch: string;
  tokens: number;
  blocks: Block[];
  fileIds: string[];
}

/* --------------------------------- projects -------------------------------- */

export interface CodeFile { path: string; lang: string; content: string }
export type NodeKind = "eyebrow" | "heading" | "lede" | "cta" | "ghost" | "card" | "stat";
export interface PreviewNode {
  id: string;
  kind: NodeKind;
  text: string;
  sub?: string;
  accent?: boolean;
}

export interface Project {
  id: string;
  name: string;
  category: string;
  source: "github" | "local";
  repo: string;
  branch: string;
  stack: string[];
  glyph: string;
  color: string;
  updated: string;
  threads: Thread[];
  files: DiffFile[];
  code: CodeFile[];
  preview: PreviewNode[];
  domain: string;
}

export const categories = ["Product", "Marketing", "Infra", "Data", "Internal"] as const;

const landingCode: CodeFile[] = [
  {
    path: "src/sections/Hero.tsx",
    lang: "typescript",
    content: `import { Button } from "@/ui/Button";

export function Hero() {
  return (
    <section className="hero">
      <span className="eyebrow">Kiren Code 2.6</span>
      <h1 className="text-5xl tracking-tight">Ship products at agent speed</h1>
      <p className="lede">
        Plan, build and review — one workspace, every agent.
      </p>
      <div className="cta-row">
        <Button size="lg">Start building</Button>
        <Button variant="ghost">Watch the tour</Button>
      </div>
    </section>
  );
}
`,
  },
  {
    path: "src/styles/tokens.css",
    lang: "css",
    content: `:root {
  --surface: #ffffff;
  --surface-2: #fafafb;
  --surface-3: #f0f0f3;
  --ink: #16161a;
  --accent: #6f45f5;
  --radius: 12px;
  --shadow-card: 0 4px 16px -4px rgb(20 20 30 / 8%);
}

.hero {
  display: grid;
  gap: 18px;
  padding: 96px 0;
}
`,
  },
  {
    path: "src/ui/Button.tsx",
    lang: "typescript",
    content: `import { clsx } from "clsx";

type Props = {
  size?: "md" | "lg";
  variant?: "solid" | "ghost";
  children: React.ReactNode;
};

export function Button({ size = "md", variant = "solid", children }: Props) {
  return (
    <button
      className={clsx(
        "btn",
        size === "lg" && "btn-lg",
        variant === "ghost" && "btn-ghost",
      )}
    >
      {children}
    </button>
  );
}
`,
  },
  {
    path: "package.json",
    lang: "json",
    content: `{
  "name": "kiren-landing",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run"
  }
}
`,
  },
];

const landingPreview: PreviewNode[] = [
  { id: "p1", kind: "eyebrow", text: "Kiren Code 2.6" },
  { id: "p2", kind: "heading", text: "Ship products at agent speed" },
  { id: "p3", kind: "lede", text: "Plan, build and review — one workspace, every agent." },
  { id: "p4", kind: "cta", text: "Start building" },
  { id: "p5", kind: "ghost", text: "Watch the tour" },
  { id: "p6", kind: "card", text: "Threads", sub: "Every task gets its own agent thread with full context." },
  { id: "p7", kind: "card", text: "Workflows", sub: "Spin up managed instances without touching a canvas." },
  { id: "p8", kind: "card", text: "Design mode", sub: "Point at any element and describe the change." },
  { id: "p9", kind: "stat", text: "40%", sub: "faster review cycles", accent: true },
];

function thread(
  id: string,
  projectId: string,
  title: string,
  status: Thread["status"],
  updated: string,
  branch: string,
  blocks: Block[],
  fileIds: string[] = [],
): Thread {
  return { id, projectId, title, status, updated, branch, model: "Kiren 2.5", tokens: 24000 + title.length * 620, blocks, fileIds };
}

const heroThread = thread(
  "th-hero",
  "pr-landing",
  "Rewrite the hero + design tokens",
  "review",
  "2m ago",
  "web/hero-refresh",
  [
    { k: "user", text: "Rewrite the hero so the value prop lands in one line, add a secondary CTA, and move the raw hex values in tokens.css to semantic tokens.", attach: ["Hero.tsx", "tokens.css"] },
    { k: "thinking", ms: 3600, text: "The current headline buries the value prop and the CTA row is a single button, so there's no low-commitment path. Tokens are also raw hex, which makes theming impossible. I'll rewrite the copy, add a ghost CTA, and promote the surface colours into semantic tokens with a shared radius and card shadow." },
    {
      k: "todo",
      items: [
        { label: "Audit hero copy + hierarchy", state: "done" },
        { label: "Add secondary CTA", state: "done" },
        { label: "Promote raw hex to tokens", state: "done" },
        { label: "Check contrast + tap targets", state: "active" },
        { label: "Snapshot preview", state: "todo" },
      ],
    },
    { k: "tool", tool: "Read", icon: "file", target: "src/sections/Hero.tsx", meta: "48 lines", status: "done" },
    { k: "tool", tool: "Grep", icon: "search", target: "#f7f7f7|#fff|--radius", meta: "17 matches · 5 files", status: "done", output: ["src/styles/tokens.css:2   --surface: #f7f7f7;", "src/ui/Card.tsx:12        background: #fff;", "src/ui/Button.tsx:22      border-radius: 6px;"] },
    { k: "text", text: "Copy rewritten and tokens promoted. I kept the CTA at a **44px** tap target and raised the card radius to 12px so it matches the rest of the system." },
    { k: "permission", tool: "Write", detail: "Modify 2 files in src/ (Hero.tsx, tokens.css)", resolved: "allow" },
    { k: "diff", fileIds: ["d-hero", "d-tokens"] },
    { k: "tool", tool: "Browser", icon: "monitor", target: "localhost:4001 — hero viewport", meta: "screenshot captured", status: "done" },
    { k: "terminal", cmd: "pnpm exec vitest run src/sections", exit: 0, lines: ["RUN  v2.1.4", "", " ✓ src/sections/__tests__/hero.spec.tsx (6)", "", " Test Files  1 passed (1)", "      Tests  6 passed (6)", "   Duration  1.71s"] },
    { k: "preview", label: "Preview rebuilt · localhost:4001" },
    {
      k: "summary",
      title: "Hero refresh ready for review",
      bullets: [
        "Headline rewritten — value prop now lands in **one line**.",
        "Secondary ghost CTA added; both keep a 44px tap target.",
        "`tokens.css` now exposes `--surface`, `--surface-2`, `--surface-3` and a shared radius.",
        "Preview rebuilt and 6 section tests pass.",
      ],
    },
  ],
  ["d-hero", "d-tokens"],
);

const perfThread = thread(
  "th-perf",
  "pr-landing",
  "Audit render-blocking resources",
  "running",
  "just now",
  "web/perf-audit",
  [
    { k: "user", text: "Run a performance audit on the landing pages. Identify render-blocking resources and unnecessary re-renders." },
    { k: "thinking", ms: 2100, text: "Start with the network waterfall, then look for components re-rendering on every scroll event." },
    { k: "tool", tool: "Bash", icon: "terminal", target: "pnpm exec lighthouse --preset=desktop", meta: "running", status: "running" },
    { k: "tool", tool: "Grep", icon: "search", target: "useEffect\\(.*scroll", meta: "4 matches", status: "done" },
  ],
);

const apiThread = thread(
  "th-api",
  "pr-api",
  "Rate limit the public search endpoint",
  "review",
  "22m ago",
  "api/rate-limit",
  [
    { k: "user", text: "Add a sliding-window rate limiter to /v1/search with per-key quotas and a 429 payload that tells clients when to retry." },
    { k: "thinking", ms: 2800, text: "A sliding window in Redis keeps memory bounded and avoids the burst problem a fixed window has at the boundary." },
    { k: "tool", tool: "Read", icon: "file", target: "src/routes/search.ts", meta: "212 lines", status: "done" },
    { k: "tool", tool: "MCP", icon: "boxes", target: "redis · INFO keyspace", meta: "connected", status: "done", output: ["db0:keys=18422,expires=17980,avg_ttl=58211"] },
    { k: "diff", fileIds: [] },
    { k: "terminal", cmd: "pnpm exec vitest run src/routes", exit: 0, lines: ["RUN  v2.1.4", "", " ✓ src/routes/__tests__/search.spec.ts (11)", "", " Tests  11 passed (11)", "   Duration  2.44s"] },
    { k: "summary", title: "Sliding-window limiter in place", bullets: ["Per-key quota of **600 req/min** with a 60s sliding window.", "429 responses now include `Retry-After` and `X-RateLimit-Reset`.", "11 route tests pass."] },
  ],
);

const dataThread = thread(
  "th-data",
  "pr-data",
  "Backfill session tagging job",
  "done",
  "1d ago",
  "data/session-tags",
  [
    { k: "user", text: "Write a backfill that tags historical sessions with the new cohort labels." },
    { k: "tool", tool: "Migrate", icon: "layers", target: "0042_session_cohorts.sql", meta: "reversible", status: "done" },
    { k: "terminal", cmd: "python -m jobs.backfill --dry-run", exit: 0, lines: ["scanning 1.2M sessions…", "would tag 984,221 rows", "estimated runtime 6m 40s", "dry run OK"] },
    { k: "summary", title: "Backfill shipped", bullets: ["984k sessions tagged across 6 cohorts.", "Migration is reversible; rollback tested on staging."] },
  ],
);

export const projects: Project[] = [
  {
    id: "pr-landing",
    name: "kiren-landing",
    category: "Marketing",
    source: "github",
    repo: "kiren/landing",
    branch: "main",
    stack: ["React", "Vite", "Tailwind"],
    glyph: "KL",
    color: "#16161a",
    updated: "2m ago",
    threads: [heroThread, perfThread],
    files: [heroDiff, tokensDiff],
    code: landingCode,
    preview: landingPreview,
    domain: "kiren-landing",
  },
  {
    id: "pr-api",
    name: "search-api",
    category: "Infra",
    source: "github",
    repo: "kiren/search-api",
    branch: "main",
    stack: ["Node", "Fastify", "Redis"],
    glyph: "SA",
    color: "#3d3d52",
    updated: "22m ago",
    threads: [apiThread],
    files: [makeDiff("src/routes/search.ts"), makeDiff("src/lib/rateLimit.ts", "added")],
    code: [
      {
        path: "src/lib/rateLimit.ts",
        lang: "typescript",
        content: `import { redis } from "./redis";

const WINDOW_MS = 60_000;
const QUOTA = 600;

export async function consume(key: string) {
  const now = Date.now();
  const member = \`\${now}-\${Math.random()}\`;
  const bucket = \`rl:\${key}\`;

  await redis.zremrangebyscore(bucket, 0, now - WINDOW_MS);
  const used = await redis.zcard(bucket);

  if (used >= QUOTA) {
    const oldest = await redis.zrange(bucket, 0, 0, "WITHSCORES");
    return { ok: false, retryAfter: Math.ceil((Number(oldest[1]) + WINDOW_MS - now) / 1000) };
  }

  await redis.zadd(bucket, now, member);
  await redis.pexpire(bucket, WINDOW_MS);
  return { ok: true, remaining: QUOTA - used - 1 };
}
`,
      },
      {
        path: "src/routes/search.ts",
        lang: "typescript",
        content: `import { consume } from "../lib/rateLimit";

export async function searchRoute(req, reply) {
  const gate = await consume(req.apiKey);

  if (!gate.ok) {
    return reply
      .code(429)
      .header("Retry-After", gate.retryAfter)
      .send({ error: "rate_limited", retryAfter: gate.retryAfter });
  }

  const results = await index.query(req.query.q, { limit: 25 });
  return reply.send({ results });
}
`,
      },
    ],
    preview: [
      { id: "a1", kind: "eyebrow", text: "search-api · v1" },
      { id: "a2", kind: "heading", text: "GET /v1/search" },
      { id: "a3", kind: "lede", text: "Sliding-window limiter · 600 req/min per key." },
      { id: "a4", kind: "cta", text: "Send request" },
      { id: "a5", kind: "card", text: "200 OK", sub: "25 results · 34ms p50" },
      { id: "a6", kind: "card", text: "429", sub: "Retry-After: 12s" },
      { id: "a7", kind: "stat", text: "600", sub: "requests / minute", accent: true },
    ],
    domain: "search-api",
  },
  {
    id: "pr-data",
    name: "insights-pipeline",
    category: "Data",
    source: "local",
    repo: "~/work/insights-pipeline",
    branch: "main",
    stack: ["Python", "dbt", "Postgres"],
    glyph: "IP",
    color: "#4a4a5c",
    updated: "1d ago",
    threads: [dataThread],
    files: [makeDiff("jobs/backfill.py")],
    code: [
      {
        path: "jobs/backfill.py",
        lang: "python",
        content: `import argparse
from datetime import datetime

from db import session_scope
from cohorts import label_for


def backfill(dry_run: bool = True) -> int:
    tagged = 0
    with session_scope() as db:
        for chunk in db.stream("SELECT id, started_at, plan FROM sessions", size=5_000):
            for row in chunk:
                label = label_for(row.plan, row.started_at)
                if label is None:
                    continue
                tagged += 1
                if not dry_run:
                    db.execute(
                        "UPDATE sessions SET cohort = :c WHERE id = :i",
                        {"c": label, "i": row.id},
                    )
    return tagged


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    print(f"tagged {backfill(args.dry_run):,} sessions at {datetime.now():%H:%M}")
`,
      },
    ],
    preview: [
      { id: "d1", kind: "eyebrow", text: "insights-pipeline" },
      { id: "d2", kind: "heading", text: "Session cohort backfill" },
      { id: "d3", kind: "lede", text: "984,221 rows tagged across 6 cohorts." },
      { id: "d4", kind: "cta", text: "Run job" },
      { id: "d5", kind: "stat", text: "6m 40s", sub: "estimated runtime", accent: true },
    ],
    domain: "insights-pipeline",
  },
];

/* --------------------------------- my work --------------------------------- */

export interface WorkItem {
  id: string;
  title: string;
  projectId: string;
  branch: string;
  add: number;
  del: number;
  agent: string;
  time: string;
  lane: "review" | "running" | "queued" | "merged";
  progress?: number;
  checks?: { pass: number; fail: number };
  threadId?: string;
  reviewers?: string[];
  surface: "code" | "cowork";
}

export const seedWork: WorkItem[] = [
  { id: "w1", title: "Rewrite the hero + design tokens", projectId: "pr-landing", branch: "web/hero-refresh", add: 20, del: 7, agent: "Kiren 2.5", time: "2m ago", lane: "review", checks: { pass: 8, fail: 0 }, threadId: "th-hero", reviewers: ["NA", "KM"], surface: "code" },
  { id: "w2", title: "Rate limit the public search endpoint", projectId: "pr-api", branch: "api/rate-limit", add: 41, del: 9, agent: "Kiren 2.5", time: "22m ago", lane: "review", checks: { pass: 6, fail: 1 }, threadId: "th-api", reviewers: ["JS"], surface: "code" },
  { id: "w6", title: "Bump migration lockfile", projectId: "pr-data", branch: "data/lockfile", add: 12, del: 4, agent: "Kiren 2.5 Fast", time: "1h ago", lane: "review", checks: { pass: 4, fail: 0 }, reviewers: ["TR"], surface: "code" },
  { id: "w3", title: "Audit render-blocking resources", projectId: "pr-landing", branch: "web/perf-audit", add: 0, del: 0, agent: "Kiren 2.5 Fast", time: "running 40s", lane: "running", progress: 62, threadId: "th-perf", surface: "code" },
  { id: "w7", title: "Extract components into design-system", projectId: "pr-landing", branch: "web/ds-extract", add: 0, del: 0, agent: "background", time: "running 4m", lane: "running", progress: 28, surface: "code" },
  { id: "w4", title: "Warm the docs search index", projectId: "pr-api", branch: "api/index-warm", add: 0, del: 0, agent: "Automation", time: "queued", lane: "queued", surface: "code" },
  { id: "w8", title: "Regenerate typed API client", projectId: "pr-api", branch: "api/client-regen", add: 0, del: 0, agent: "Automation", time: "queued", lane: "queued", surface: "code" },
  { id: "w5", title: "Backfill session tagging job", projectId: "pr-data", branch: "data/session-tags", add: 47, del: 15, agent: "Kiren 2.5", time: "1d ago", lane: "merged", threadId: "th-data", surface: "code" },
  { id: "w9", title: "Tighten focus rings across UI", projectId: "pr-landing", branch: "web/focus-ring", add: 22, del: 6, agent: "Kiren 2.5 Fast", time: "3d ago", lane: "merged", surface: "code" },
];

export const lanes = [
  { id: "review", label: "Ready for review", icon: "eye" as IconName },
  { id: "running", label: "In progress", icon: "spinner" as IconName },
  { id: "queued", label: "Queued", icon: "clock" as IconName },
  { id: "merged", label: "Shipped", icon: "checkCircle" as IconName },
] as const;

export const activity = [
  { id: "a1", icon: "pr" as IconName, text: "**Kiren** opened PR #5466 · hero refresh", time: "2m" },
  { id: "a2", icon: "checkCircle" as IconName, text: "CI passed on **web/hero-refresh** — 8 checks green", time: "6m" },
  { id: "a3", icon: "alert" as IconName, text: "1 check failing on **api/rate-limit** — `search.spec.ts`", time: "22m" },
  { id: "a4", icon: "workflow" as IconName, text: "Workflow **onboarding-sync** provisioned", time: "3h" },
  { id: "a5", icon: "gitCommit" as IconName, text: "Merged **data/session-tags** into main", time: "1d" },
];

export const metrics = [
  { id: "m1", label: "Agent hours", value: "38.4", delta: "+12%", spark: [4, 6, 5, 8, 7, 11, 13] },
  { id: "m2", label: "Threads shipped", value: "126", delta: "+9%", spark: [8, 10, 9, 14, 12, 17, 19] },
  { id: "m3", label: "Review time", value: "4m 12s", delta: "−31%", spark: [14, 12, 13, 9, 8, 6, 5] },
  { id: "m4", label: "Accept rate", value: "82%", delta: "+4%", spark: [60, 64, 68, 70, 74, 79, 82] },
];

/* -------------------------------- workflows -------------------------------- */

export interface WorkflowInstance {
  id: string;
  name: string;
  slug: string;
  template: string;
  region: string;
  plan: string;
  status: "live" | "provisioning" | "paused";
  nodes: number;
  execs: number[];
  created: string;
  offered: boolean;
}

export const workflowTemplates = [
  { id: "wt1", name: "Onboarding sync", desc: "New signup → CRM → welcome sequence → Slack ping.", nodes: 7, icon: "users" as IconName },
  { id: "wt2", name: "Support triage", desc: "Inbound ticket → classify → route → draft reply.", nodes: 9, icon: "inbox" as IconName },
  { id: "wt3", name: "Release notes", desc: "Merged PRs → summarise → publish changelog.", nodes: 5, icon: "doc" as IconName },
  { id: "wt4", name: "Data refresh", desc: "Nightly extract → transform → warehouse load.", nodes: 11, icon: "layers" as IconName },
  { id: "wt5", name: "Lead scoring", desc: "Form fill → enrich → score → assign owner.", nodes: 8, icon: "gauge" as IconName },
  { id: "wt6", name: "Blank instance", desc: "Start empty and connect your own steps later.", nodes: 1, icon: "boxes" as IconName },
];

export const regions = ["eu-west-1", "us-east-1", "ap-south-1"];
export const plans = ["Starter", "Team", "Scale"];

export const seedInstances: WorkflowInstance[] = [
  { id: "wf1", name: "Onboarding sync", slug: "onboarding-sync", template: "Onboarding sync", region: "eu-west-1", plan: "Team", status: "live", nodes: 7, execs: [12, 18, 14, 22, 19, 26, 24], created: "3h ago", offered: true },
  { id: "wf2", name: "Support triage", slug: "support-triage", template: "Support triage", region: "us-east-1", plan: "Scale", status: "live", nodes: 9, execs: [40, 52, 47, 61, 58, 66, 72], created: "2d ago", offered: true },
  { id: "wf3", name: "Release notes", slug: "release-notes", template: "Release notes", region: "eu-west-1", plan: "Starter", status: "paused", nodes: 5, execs: [4, 3, 5, 2, 4, 3, 1], created: "1w ago", offered: false },
];

/** Slugs already claimed on the shared domain. */
export const takenSlugs = ["app", "api", "admin", "docs", "search-api", "billing", "status", "kiren"];

/* ------------------------------- automations ------------------------------- */

export interface Simulation {
  id: string;
  name: string;
  goal: string;
  trigger: string;
  projectId: string;
  prompt: string;
  modelId: string;
  runs: number;
  status: "idle" | "running" | "done";
  created: string;
}

export const seedSimulations: Simulation[] = [
  {
    id: "sim1",
    name: "Nightly flake sweep",
    goal: "Find and fix flaky tests",
    trigger: "Daily · 02:00",
    projectId: "pr-landing",
    prompt: "Re-run quarantined tests 20x. For any test failing more than twice, open a thread with a proposed fix and a stability report.",
    modelId: "kiren-2.5-fast",
    runs: 148,
    status: "idle",
    created: "2w ago",
  },
  {
    id: "sim2",
    name: "Dependency audit",
    goal: "Group and propose safe upgrades",
    trigger: "Mondays · 09:00",
    projectId: "pr-api",
    prompt: "Scan lockfiles for advisories. Group patch upgrades into one PR, majors into separate threads with migration notes.",
    modelId: "kiren-2.5",
    runs: 26,
    status: "idle",
    created: "1mo ago",
  },
];

export const modelIds = ["kiren-2.5", "kiren-2.5-fast", "kiren-2.5-thinking", "kiren-mini"];
export const triggers = ["Manual", "Daily · 02:00", "Weekdays · 09:00", "On merge to main", "On failing CI"];

/** Streamed steps for a running simulation (no side panel). */
export const simSteps: { icon: IconName; tool: string; target: string; meta?: string; out?: string[] }[] = [
  { icon: "brain", tool: "Plan", target: "decompose goal into 4 checks", meta: "1.2s" },
  { icon: "folder", tool: "Workspace", target: "clone + warm cache", meta: "8.4s", out: ["cloned 1 repo · 214MB", "pnpm store hit rate 92%"] },
  { icon: "terminal", tool: "Bash", target: "pnpm exec vitest run --retry=20 --quarantined", meta: "exit 0", out: ["running 14 quarantined specs ×20", "3 specs failed at least twice"] },
  { icon: "search", tool: "Analyse", target: "cluster failures by root cause", meta: "3 clusters", out: ["timer leak · 2 specs", "unawaited promise · 1 spec"] },
  { icon: "wrench", tool: "Patch", target: "apply 3 candidate fixes", meta: "+34 −11" },
  { icon: "terminal", tool: "Bash", target: "pnpm exec vitest run --retry=20", meta: "exit 0", out: ["all 14 specs stable across 20 runs"] },
  { icon: "pr", tool: "Publish", target: "open thread · flake-sweep/2026-03-12", meta: "ready" },
];

/* -------------------------------- commands --------------------------------- */

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon: IconName;
  section: "Navigate" | "Thread" | "Workspace";
  run: string;
}

export const commands: CommandItem[] = [
  { id: "c1", label: "Go to My Work", hint: "⌘1", icon: "inbox", section: "Navigate", run: "work" },
  { id: "c2", label: "Go to Threads", hint: "⌘2", icon: "chat", section: "Navigate", run: "agent" },
  { id: "c3", label: "Go to Workflows", hint: "⌘3", icon: "workflow", section: "Navigate", run: "workflows" },
  { id: "c4", label: "Go to Automations", hint: "⌘4", icon: "zap", section: "Navigate", run: "automations" },
  { id: "c5", label: "Switch project", hint: "⌘P", icon: "boxes", section: "Navigate", run: "picker" },
  { id: "c6", label: "New Thread", hint: "⌘N", icon: "plus", section: "Thread", run: "newthread" },
  { id: "c7", label: "Commit & Push", icon: "gitCommit", section: "Thread", run: "commit" },
  { id: "c8", label: "Open Pull Request", icon: "pr", section: "Thread", run: "pr" },
  { id: "c9", label: "Toggle Kiren Design", icon: "wand", section: "Thread", run: "design" },
  { id: "c10", label: "Show Preview", icon: "monitor", section: "Workspace", run: "tab:preview" },
  { id: "c11", label: "Show Changes", icon: "fileDiff", section: "Workspace", run: "tab:changes" },
  { id: "c12", label: "Show Editor", icon: "code", section: "Workspace", run: "tab:editor" },
  { id: "c13", label: "Switch to Kiren Cowork", icon: "swap", section: "Workspace", run: "surface" },
  { id: "c14", label: "Toggle Appearance", hint: "⌘L", icon: "moon", section: "Workspace", run: "theme" },
];

export const slashCommands = [
  { cmd: "/plan", desc: "Draft a plan before editing any files" },
  { cmd: "/test", desc: "Write failing tests first, then implement" },
  { cmd: "/review", desc: "Review the current diff line by line" },
  { cmd: "/design", desc: "Open Kiren Design on the live preview" },
  { cmd: "/deploy", desc: "Ship the current branch to a preview URL" },
  { cmd: "/context", desc: "Show session context, cost and usage" },
  { cmd: "/compact", desc: "Compact the conversation and free tokens" },
  { cmd: "/model", desc: "Switch the active model for this thread" },
  { cmd: "/mcp", desc: "Manage connected MCP servers" },
  { cmd: "/hooks", desc: "Manage lifecycle hooks" },
  { cmd: "/agents", desc: "Manage subagents" },
  { cmd: "/clear", desc: "Clear the thread and start fresh" },
  { cmd: "/resume", desc: "Restore a previous checkpoint" },
  { cmd: "/init", desc: "Generate AGENTS.md for this project" },
  { cmd: "/ide", desc: "Attach to an open IDE window" },
];

/** Tool catalogue shown in the thread composer. */
export const toolCatalog: { name: string; icon: IconName; desc: string; on: boolean }[] = [
  { name: "Read", icon: "file", desc: "Open files and symbols", on: true },
  { name: "Grep", icon: "search", desc: "Search the workspace", on: true },
  { name: "Edit", icon: "pencil", desc: "Apply patches to files", on: true },
  { name: "Bash", icon: "terminal", desc: "Run sandboxed commands", on: true },
  { name: "Browser", icon: "monitor", desc: "Load and screenshot the preview", on: true },
  { name: "Web", icon: "globe", desc: "Fetch docs and references", on: true },
  { name: "MCP", icon: "server", desc: "Connected servers · 4", on: true },
  { name: "Migrate", icon: "layers", desc: "Write reversible migrations", on: false },
  { name: "Deploy", icon: "rocket", desc: "Push to a preview domain", on: false },
];

/* ------------------------------- subagents -------------------------------- */

export interface Subagent {
  id: string;
  name: string;
  desc: string;
  icon: IconName;
  color: string;
  scope: "project" | "workspace";
  tools: string[];
}

export const subagents: Subagent[] = [
  { id: "sa1", name: "reviewer", desc: "Reviews diffs line-by-line before you commit.", icon: "eye", color: "#101014", scope: "workspace", tools: ["Read", "Grep"] },
  { id: "sa2", name: "test-writer", desc: "Writes failing tests first, then hands off.", icon: "checkCircle", color: "#2c2c31", scope: "workspace", tools: ["Read", "Edit", "Bash"] },
  { id: "sa3", name: "perf-hunter", desc: "Profiles pages and flags regressions.", icon: "gauge", color: "#3a3a41", scope: "project", tools: ["Bash", "Browser"] },
  { id: "sa4", name: "docs-writer", desc: "Keeps README + guides in sync with diffs.", icon: "doc", color: "#4a4a51", scope: "workspace", tools: ["Read", "Edit"] },
  { id: "sa5", name: "migration-safe", desc: "Only proposes reversible SQL migrations.", icon: "layers", color: "#5a5a61", scope: "project", tools: ["Read", "Edit", "Migrate"] },
];

/* --------------------------------- MCP ----------------------------------- */

export interface MCPServer {
  id: string;
  name: string;
  transport: "stdio" | "http";
  status: "connected" | "error" | "off";
  tools: number;
  glyph: string;
  latency: string;
}

export const mcpServers: MCPServer[] = [
  { id: "mcp1", name: "github", transport: "http", status: "connected", tools: 22, glyph: "GH", latency: "84ms" },
  { id: "mcp2", name: "linear", transport: "http", status: "connected", tools: 14, glyph: "LI", latency: "62ms" },
  { id: "mcp3", name: "postgres", transport: "stdio", status: "connected", tools: 9, glyph: "PG", latency: "12ms" },
  { id: "mcp4", name: "sentry", transport: "http", status: "error", tools: 11, glyph: "SE", latency: "—" },
  { id: "mcp5", name: "figma", transport: "http", status: "off", tools: 6, glyph: "FI", latency: "—" },
];

/* --------------------------------- hooks --------------------------------- */

export interface Hook {
  id: string;
  event: "PreToolUse" | "PostToolUse" | "UserPromptSubmit" | "Stop" | "SessionStart";
  matcher: string;
  cmd: string;
  on: boolean;
}

export const hooks: Hook[] = [
  { id: "h1", event: "PreToolUse", matcher: "Bash", cmd: "guard-scripts --block rm-rf", on: true },
  { id: "h2", event: "PostToolUse", matcher: "Edit", cmd: "pnpm exec prettier --write $KIREN_FILE", on: true },
  { id: "h3", event: "Stop", matcher: "*", cmd: "pnpm exec tsc --noEmit", on: true },
  { id: "h4", event: "UserPromptSubmit", matcher: "*", cmd: "kiren-context --load AGENTS.md", on: false },
  { id: "h5", event: "SessionStart", matcher: "*", cmd: "git status --short", on: true },
];

/* ------------------------------ session usage ---------------------------- */

export interface SessionUsage {
  contextUsed: number;      // tokens
  contextTotal: number;
  costUsd: number;
  cachedReads: number;
  msgs: { in: number; out: number };
  tools: number;
  checkpoints: number;
  toolBreakdown: { name: string; pct: number }[];
}

export const sessionUsage: SessionUsage = {
  contextUsed: 48210,
  contextTotal: 200000,
  costUsd: 0.62,
  cachedReads: 118420,
  msgs: { in: 12, out: 14 },
  tools: 37,
  checkpoints: 5,
  toolBreakdown: [
    { name: "Read", pct: 34 },
    { name: "Grep", pct: 22 },
    { name: "Edit", pct: 18 },
    { name: "Bash", pct: 14 },
    { name: "Browser", pct: 8 },
    { name: "Web", pct: 4 },
  ],
};

/* ------------------------------- checkpoints ------------------------------ */

export interface Checkpoint {
  id: string;
  label: string;
  at: string;
  files: number;
  add: number;
  del: number;
}

export const checkpoints: Checkpoint[] = [
  { id: "cp1", label: "Before hero rewrite", at: "8m ago", files: 0, add: 0, del: 0 },
  { id: "cp2", label: "After first draft", at: "6m ago", files: 2, add: 12, del: 4 },
  { id: "cp3", label: "After tokens promoted", at: "4m ago", files: 4, add: 24, del: 8 },
  { id: "cp4", label: "Tests passing", at: "2m ago", files: 4, add: 32, del: 12 },
];

/* ---------------------------- background agents --------------------------- */

export interface BackgroundAgent {
  id: string;
  title: string;
  projectId: string;
  branch: string;
  status: "queued" | "running" | "review" | "failed";
  progress: number;
  startedAt: string;
  step: string;
}

export const backgroundAgents: BackgroundAgent[] = [
  { id: "bg1", title: "Extract components into design-system", projectId: "pr-landing", branch: "web/ds-extract", status: "running", progress: 42, startedAt: "4m ago", step: "Applying edits to 6 files" },
  { id: "bg2", title: "Bump migration lockfile", projectId: "pr-data", branch: "data/lockfile", status: "review", progress: 100, startedAt: "1h ago", step: "Waiting on review" },
  { id: "bg3", title: "Regenerate typed API client", projectId: "pr-api", branch: "api/client-regen", status: "queued", progress: 0, startedAt: "now", step: "Sandbox provisioning" },
];

/* ------------------------------- editor tabs ------------------------------ */

export interface EditorTab {
  id: string;
  path: string;
  dirty: boolean;
}

/* -------------------------------- AGENTS.md ------------------------------- */

export const agentsMd = `# AGENTS.md

Working rules Kiren must follow inside this repo.

## Style
- Prefer **named exports**; no default exports outside pages.
- Every bug fix ships with a regression test.
- Never bump a dependency without a changelog entry.
- Run \`pnpm exec tsc --noEmit\` before proposing a diff.

## Commands
- \`pnpm dev\`      — local dev server on :5173
- \`pnpm test\`     — unit + integration
- \`pnpm build\`    — production build

## Never
- Do not touch \`packages/legacy/*\` — it's being retired.
- Do not commit secrets. \`.env.local\` is gitignored on purpose.
`;

/* -------------------------------- IDE conns ------------------------------- */

export const ideConnections = [
  { id: "vsc", name: "VS Code", status: "connected" as const, path: "/Users/suaib/Code/kiren-landing" },
  { id: "cur", name: "Cursor", status: "connected" as const, path: "/Users/suaib/Code/search-api" },
  { id: "jb", name: "JetBrains", status: "off" as const, path: "—" },
];

/* --------------------------------- shortcuts ------------------------------ */

export const shortcuts = [
  { group: "Global", items: [
    { keys: "⌘K", label: "Open command palette" },
    { keys: "⌘N", label: "New thread" },
    { keys: "⌘P", label: "Switch project" },
    { keys: "⌘B", label: "Toggle sidebar" },
    { keys: "⌘\\", label: "Toggle workspace panel" },
    { keys: "⌘L", label: "Toggle appearance" },
    { keys: "⌘1 – ⌘4", label: "Jump to a view" },
  ]},
  { group: "Thread", items: [
    { keys: "⌘⏎", label: "Send message · stop on running" },
    { keys: "⌘/", label: "Slash commands" },
    { keys: "@", label: "Attach a file" },
    { keys: "⌘K then M", label: "Change model" },
    { keys: "⌘K then C", label: "Compact context" },
  ]},
  { group: "Editor", items: [
    { keys: "⌘S", label: "Save current file" },
    { keys: "⌘W", label: "Close tab" },
    { keys: "⌘⇧E", label: "Focus file tree" },
  ]},
];
