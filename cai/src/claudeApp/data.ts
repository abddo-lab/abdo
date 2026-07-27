import type { LucideIcon } from "lucide-react";

/* ---------------- Environments — chosen from the composer only ---------------- */
export interface Environment {
  id: "local" | "cloud";
  name: string;
  tagline: string;
  desc: string;
  status: string;
  hint: string;
}

export const environments: Environment[] = [
  {
    id: "local",
    name: "Local",
    tagline: "This Mac",
    desc: "Runs in your repo on this machine. You get a live preview of whatever Caret builds.",
    status: "Connected",
    hint: "Node 22 · Python 3.12 · full terminal access",
  },
  {
    id: "cloud",
    name: "Cloud",
    tagline: "Isolated sandbox",
    desc: "A fresh container with the repo checked out — full editor, file control, preview and database console.",
    status: "3 containers free",
    hint: "us-west · 4 vCPU · 8 GB RAM · Postgres 16 attached",
  },
];

/* ---------------- Sidebar threads ---------------- */
export type ThreadStatus = "merge" | "working" | "done";

export interface Thread {
  label: string;
  status: ThreadStatus;
  env: "local" | "cloud";
  time: string;
  changes: number;
}

export const threads: Thread[] = [
  { label: "fix: retry on short code collision", status: "merge", env: "cloud", time: "2m", changes: 3 },
  { label: "Add pagination to GET /api/links", status: "merge", env: "cloud", time: "1h", changes: 5 },
  { label: "Reject invalid / non-http(s) URLs", status: "merge", env: "local", time: "3h", changes: 2 },
  { label: "Tailspin Toys — night lighting", status: "working", env: "local", time: "now", changes: 2 },
  { label: "Metrics dashboard", status: "done", env: "cloud", time: "1d", changes: 9 },
  { label: "Scaffolding git-commit-weather", status: "done", env: "local", time: "2d", changes: 12 },
  { label: "Investigating CLI model rename", status: "done", env: "cloud", time: "4d", changes: 1 },
  { label: "Linkblog frontends", status: "done", env: "local", time: "1w", changes: 7 },
];

/* ---------------- Mode / model / effort ---------------- */
export const modeOptions = [
  { label: "Interactive", sub: "Ask before every edit", kbd: "⇧⇥" },
  { label: "Plan", sub: "Research and plan, execute on approval", kbd: "⇧⇥" },
  { label: "Autopilot", sub: "Accept edits, run end-to-end", kbd: "⇧⇥" },
];

export interface ModelSpec {
  name: string;
  full: string;
  tag?: "new" | "preview" | "recommended";
  note: string;
  ctx: string;        // context window
  out: string;        // max output
  speed: number;      // 0..1 relative response speed
  smarts: number;     // 0..1 relative reasoning
  cost: number;       // 0..1 relative $/token
  pricing: string;    // human string
  strengths: string[];
}

export interface ModelGroup {
  id: string;
  heading: string;
  blurb: string;
  items: ModelSpec[];
}

export interface ModelOption {
  name: string;
  desc: string;
  hint?: string;        // right-aligned spec, e.g. context window
  mark?: string;        // badge like "RECOMMENDED" / "PREVIEW"
  locked?: boolean;     // requires plan upgrade
  lockNote?: string;
  more?: boolean;       // hidden behind "More models …"
}

export const modelOptions: ModelOption[] = [
  /* primary Caret models */
  { name: "cai-code-flash", desc: "Fastest · tuned for quick code edits", hint: "200k ctx", mark: "FAST" },
  { name: "cai-luna-1", desc: "Balanced reasoning for everyday engineering", hint: "500k ctx", mark: "RECOMMENDED" },
  { name: "cai-luna-pro", desc: "Deepest reasoning · long agent loops", hint: "1M ctx", mark: "PRO" },

  /* revealed by “More models …” */
  { name: "cai-luna-max", desc: "Frontier preview · widest exploration", hint: "1M ctx", mark: "PREVIEW", locked: true, lockNote: "Enterprise preview", more: true },
  { name: "Auto", desc: "Let Caret route each task to the best model", hint: "adaptive", more: true },
  { name: "Opus 4.8", desc: "Anthropic · strongest agent loops", hint: "1M ctx", more: true },
  { name: "Sonnet 4.6", desc: "Anthropic · fast and capable", hint: "500k ctx", more: true },
  { name: "GPT-5.3-Codex", desc: "OpenAI · strong at refactors", hint: "400k ctx", more: true },
  { name: "Gemini 3.1 Pro", desc: "Google · long-context analysis", hint: "1M ctx", more: true },
];

/* Claude Code style reasoning-effort levels */
/* thinking levels, mirroring Gemini 3.1 Pro: Standard / Extended / Deep Think */
export interface EffortLevel {
  label: string;
  mode: "standard" | "extended" | "deep";
  desc: string;
  iconPath: string;      // path in the 3-icon thinking glyph
  gated?: boolean;       // locked behind plan
  gateNote?: string;
}

export const effortLevels: EffortLevel[] = [
  {
    label: "Standard",
    mode: "standard",
    desc: "Fast, helpful answers for everyday questions",
    iconPath: "bolt",
  },
  {
    label: "Extended",
    mode: "extended",
    desc: "Stops to think through complex problems step by step",
    iconPath: "think",
  },
  {
    label: "Deep Think",
    mode: "deep",
    desc: "Maximum parallel reasoning on Opus-class models",
    iconPath: "deep",
    gated: true,
    gateNote: "Max plan",
  },
];

export const agentReplies = [
  "On it — reading the current state before touching anything.",
  "Checking which modules depend on this before I edit.",
  "Done. Test suite is green and the preview reloaded.",
  "Good call — patching that now and re-running the type-check.",
];

/* ---------------- Chat transcript ---------------- */
export type ToolItem = {
  type: "tool";
  icon: LucideIcon;
  label: string;
  detail?: string;
  failed?: boolean;
};

export type TranscriptItem =
  | { type: "user"; text: string }
  | { type: "text"; text: string }
  | { type: "thought"; text: string }
  | { type: "system"; text: string }
  | ToolItem
  | { type: "files-edited"; files: { path: string; add: number; del: number }[] }
  | { type: "tools-used"; tools: { label: string; detail?: string }[] }
  | { type: "plan"; steps: { text: string; done: boolean }[] }
  | { type: "terminal"; cmd: string; out: string[] };

export const initialTranscript: TranscriptItem[] = [
  {
    type: "user",
    text: "The night scene feels too dark near the path — lift the lighting and pull the lamps closer to the walkway.",
  },
  {
    type: "text",
    text: "Gameplay renders well — HUD, agent and lit villa interior are all there. The night mood is right, but the foreground reads too dark and the path lamps sit too far from the walkway. Nudging lighting and lamp placement for readability.",
  },
  {
    type: "plan",
    steps: [
      { text: "Raise moon intensity + add villa window spill", done: true },
      { text: "Snap path lamps to the walkway spline", done: true },
      { text: "Restart dev server to clear stale ES modules", done: true },
      { text: "Verify instinct vision through the dark", done: false },
    ],
  },
  {
    type: "files-edited",
    files: [
      { path: "src/world/Level.js", add: 18, del: 6 },
      { path: "src/systems/Lighting.js", add: 24, del: 3 },
    ],
  },
  {
    type: "terminal",
    cmd: "npm run dev -- --force",
    out: ["VITE v7.3.2  ready in 284 ms", "➜  Local:   http://localhost:8421/", "➜  hmr: full reload (Lighting.js)"],
  },
  {
    type: "tools-used",
    tools: [
      { label: "read_terminal_output", detail: "canvasId: terminal" },
      { label: "wait_for_preview", detail: "curl -s localhost:8421" },
      { label: "take_screenshot", detail: "canvasId: browser" },
    ],
  },
  {
    type: "thought",
    text: "Guard glows amber, civilian dims — instinct vision reads correctly against the brighter path.",
  },
  {
    type: "text",
    text: "Much better: the path is lit, the moon reads, the villa interior and target are clearly visible, and the detection indicator is live. Every core system is verified through the live preview.",
  },
  { type: "system", text: "Adversarial review started in the background — 4 agents over 2 phases." },
];

/* ---------------- Diff view ---------------- */
export interface DiffLine {
  t: "hunk" | "ctx" | "add" | "del";
  code: string;
}
export interface DiffFile {
  path: string;
  add: number;
  del: number;
  lines: DiffLine[];
}

export const diffFiles: DiffFile[] = [
  {
    path: "src/systems/Lighting.js",
    add: 24,
    del: 3,
    lines: [
      { t: "hunk", code: "@@ -42,7 +42,11 @@ export function buildLighting(scene) {" },
      { t: "ctx", code: "  const moon = new THREE.DirectionalLight(0x9db8ff, 0.35);" },
      { t: "del", code: "  moon.intensity = 0.28;" },
      { t: "add", code: "  moon.intensity = 0.52;  // brighter night read" },
      { t: "add", code: "  moon.shadow.mapSize.set(2048, 2048);" },
      { t: "ctx", code: "  scene.add(moon);" },
      { t: "hunk", code: "@@ -58,6 +62,18 @@ export function buildLighting(scene) {" },
      { t: "ctx", code: "  const hemi = new THREE.HemisphereLight(0x223355, 0x0b0d12, 0.4);" },
      { t: "add", code: "  // warm spill from the villa windows" },
      { t: "add", code: "  const villaGlow = new THREE.PointLight(0xffb27a, 1.4, 26);" },
      { t: "add", code: "  villaGlow.position.set(14, 3.2, -6);" },
      { t: "add", code: "  scene.add(villaGlow);" },
      { t: "ctx", code: "  scene.add(hemi);" },
      { t: "ctx", code: "  return { moon, hemi };" },
    ],
  },
  {
    path: "src/world/Level.js",
    add: 18,
    del: 6,
    lines: [
      { t: "hunk", code: "@@ -120,9 +120,15 @@ function placePathLamps() {" },
      { t: "del", code: "  const spacing = 22;" },
      { t: "add", code: "  const spacing = 14;  // lamps hug the walkway" },
      { t: "ctx", code: "  for (let i = 0; i < PATH_POINTS.length; i += spacing) {" },
      { t: "del", code: "    lamps.push(new Lamp(PATH_POINTS[i], { reach: 30 }));" },
      { t: "add", code: "    lamps.push(new Lamp(PATH_POINTS[i], { reach: 18, warm: true }));" },
      { t: "ctx", code: "  }" },
      { t: "hunk", code: "@@ -141,3 +141,9 @@ function placePathLamps() {" },
      { t: "add", code: "  // keep lamps off the grass verge" },
      { t: "add", code: "  lamps.forEach((l) => l.snapToPath(PATH_POINTS));" },
      { t: "ctx", code: "  return lamps;" },
    ],
  },
];

/* ---------------- Cloud editor: virtual file system ---------------- */
export interface FileNode {
  name: string;
  path: string;
  kind: "file" | "dir";
  children?: FileNode[];
  status?: "M" | "A" | "U";
  content?: string;
}

export const fileTree: FileNode[] = [
  {
    name: "src",
    path: "src",
    kind: "dir",
    children: [
      {
        name: "systems",
        path: "src/systems",
        kind: "dir",
        children: [
          {
            name: "Lighting.js",
            path: "src/systems/Lighting.js",
            kind: "file",
            status: "M",
            content: `import * as THREE from "three";

// Night lighting rig for the villa level.
export function buildLighting(scene) {
  const moon = new THREE.DirectionalLight(0x9db8ff, 0.35);
  moon.intensity = 0.52;  // brighter night read
  moon.shadow.mapSize.set(2048, 2048);
  moon.position.set(-30, 48, -18);
  scene.add(moon);

  const hemi = new THREE.HemisphereLight(0x223355, 0x0b0d12, 0.4);

  // warm spill from the villa windows
  const villaGlow = new THREE.PointLight(0xffb27a, 1.4, 26);
  villaGlow.position.set(14, 3.2, -6);
  scene.add(villaGlow);
  scene.add(hemi);

  return { moon, hemi, villaGlow };
}`,
          },
          {
            name: "Instinct.js",
            path: "src/systems/Instinct.js",
            kind: "file",
            content: `export function toggleInstinct(world, on) {
  world.characters.forEach((ch) => {
    ch.outline.visible = on;
    ch.outline.color = ch.hostile ? 0xffb347 : 0x7fb2ff;
  });
  world.postFx.desaturate = on ? 0.8 : 0;
}`,
          },
        ],
      },
      {
        name: "world",
        path: "src/world",
        kind: "dir",
        children: [
          {
            name: "Level.js",
            path: "src/world/Level.js",
            kind: "file",
            status: "M",
            content: `import { Lamp } from "./Lamp.js";
import { PATH_POINTS } from "./paths.js";

function placePathLamps() {
  const lamps = [];
  const spacing = 14;  // lamps hug the walkway
  for (let i = 0; i < PATH_POINTS.length; i += spacing) {
    lamps.push(new Lamp(PATH_POINTS[i], { reach: 18, warm: true }));
  }
  // keep lamps off the grass verge
  lamps.forEach((l) => l.snapToPath(PATH_POINTS));
  return lamps;
}

export { placePathLamps };`,
          },
          { name: "Lamp.js", path: "src/world/Lamp.js", kind: "file", content: `export class Lamp {\n  constructor(pos, opts = {}) {\n    this.pos = pos;\n    this.reach = opts.reach ?? 24;\n    this.warm = !!opts.warm;\n  }\n\n  snapToPath(points) {\n    this.pos = nearest(points, this.pos);\n  }\n}` },
        ],
      },
      {
        name: "api",
        path: "src/api",
        kind: "dir",
        children: [
          {
            name: "links.ts",
            path: "src/api/links.ts",
            kind: "file",
            status: "A",
            content: `import { db } from "../db/client";

export async function listLinks(page = 1, size = 25) {
  const offset = (page - 1) * size;
  const rows = await db.query(
    "select * from links order by created_at desc limit $1 offset $2",
    [size, offset]
  );
  return { rows, page, size };
}`,
          },
        ],
      },
      { name: "main.js", path: "src/main.js", kind: "file", content: `import { boot } from "./game/boot.js";\n\nboot(document.querySelector("#app"));` },
    ],
  },
  {
    name: "db",
    path: "db",
    kind: "dir",
    children: [
      {
        name: "schema.sql",
        path: "db/schema.sql",
        kind: "file",
        content: `create table links (
  id          bigserial primary key,
  short_code  text unique not null,
  target_url  text not null,
  clicks      integer default 0,
  created_at  timestamptz default now()
);

create index links_created_idx on links (created_at desc);`,
      },
    ],
  },
  { name: "package.json", path: "package.json", kind: "file", content: `{\n  "name": "tailspin-toys",\n  "type": "module",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build",\n    "test": "vitest run"\n  }\n}` },
  { name: "README.md", path: "README.md", kind: "file", content: `# Tailspin Toys\n\nGame catalog + link shortener demo used by Claude Code cloud sandboxes.\n\n## Dev\n\n    npm run dev -- --force\n` },
];

/* ---------------- Database console ---------------- */
export interface DbTable {
  name: string;
  rows: number;
  size: string;
  columns: { name: string; type: string; pk?: boolean }[];
  data: (string | number)[][];
}

export const dbTables: DbTable[] = [
  {
    name: "links",
    rows: 1284,
    size: "412 kB",
    columns: [
      { name: "id", type: "bigserial", pk: true },
      { name: "short_code", type: "text" },
      { name: "target_url", type: "text" },
      { name: "clicks", type: "int4" },
      { name: "created_at", type: "timestamptz" },
    ],
    data: [
      [1, "a3f9k", "https://tailspin.dev/games/binary-frontier", 3921, "2026-02-14 09:12"],
      [2, "zq8lm", "https://tailspin.dev/games/cloud-conqueror", 1544, "2026-02-14 11:40"],
      [3, "p1x7d", "https://tailspin.dev/blog/night-lighting", 872, "2026-02-15 08:03"],
      [4, "kk20v", "https://github.com/tailspin/toys", 511, "2026-02-16 17:55"],
      [5, "m9wqe", "https://tailspin.dev/games/bug-buster", 233, "2026-02-17 21:20"],
    ],
  },
  {
    name: "users",
    rows: 96,
    size: "48 kB",
    columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "email", type: "text" },
      { name: "plan", type: "text" },
      { name: "created_at", type: "timestamptz" },
    ],
    data: [
      ["7c1e…", "christina@tailspin.dev", "max", "2025-11-02 10:11"],
      ["9ba2…", "dev@tailspin.dev", "pro", "2025-12-19 14:26"],
      ["4fd0…", "qa@tailspin.dev", "free", "2026-01-07 07:45"],
    ],
  },
  {
    name: "click_events",
    rows: 41029,
    size: "9.8 MB",
    columns: [
      { name: "id", type: "bigserial", pk: true },
      { name: "link_id", type: "int8" },
      { name: "country", type: "text" },
      { name: "ts", type: "timestamptz" },
    ],
    data: [
      [88213, 1, "US", "2026-02-18 03:01"],
      [88214, 3, "DE", "2026-02-18 03:04"],
      [88215, 1, "MA", "2026-02-18 03:09"],
      [88216, 2, "JP", "2026-02-18 03:12"],
    ],
  },
];
