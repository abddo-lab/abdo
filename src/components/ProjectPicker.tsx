import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { Icon } from "../icons";
import { categories, type Project } from "../data";
import { Badge, Btn, Tile } from "./ui";
import * as api from "../api";
import { groupModels, familyOf, modelLabel } from "../modelGroups";

interface Props {
  projects: Project[];
  projectId: string;
  user?: any;
  onSelectProject: (id: string) => void;
  onOpen: (id: string, prompt?: string) => void;
  onOpenThread?: (threadId: string, projectId: string) => void;
  onImport: (p?: any) => void;
  onToast: (m: string) => void;
}

const MODES: { id: "agent" | "plan" | "ask"; label: string }[] = [
  { id: "agent", label: "Autopilot" },
  { id: "plan", label: "Plan" },
  { id: "ask", label: "Ask" },
];

const SUGGESTIONS = [
  { icon: "code" as const, text: "Build a landing page that converts" },
  { icon: "fileDiff" as const, text: "Fix the failing tests in main" },
  { icon: "search" as const, text: "Explain this codebase architecture" },
  { icon: "boxes" as const, text: "Refactor the design tokens" },
];

// Ready-to-go starter templates — scaffolded straight into the sandbox
const TEMPLATES: { id: string; name: string; desc: string; stack: string; files: { path: string; content: string }[] }[] = [
  {
    id: "react-vite", name: "React + Vite", desc: "Modern SPA starter with Vite & React", stack: "React · TS",
    files: [
      { path: "package.json", content: JSON.stringify({ name: "react-vite-app", private: true, version: "0.1.0", type: "module", scripts: { dev: "vite", build: "vite build", preview: "vite preview" }, dependencies: { react: "^18.3.1", "react-dom": "^18.3.1" }, devDependencies: { "@vitejs/plugin-react": "^4.3.1", typescript: "^5.5.0", vite: "^5.4.0" } }, null, 2) },
      { path: "index.html", content: `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>React App</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>` },
      { path: "src/main.tsx", content: `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);
` },
      { path: "src/App.tsx", content: `export default function App() {
  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 640, margin: "80px auto", padding: "0 24px" }}>
      <h1>Hello, Kiren 👋</h1>
      <p>Your React + Vite starter is ready. Ask the agent to build your feature.</p>
    </main>
  );
}
` },
      { path: "src/index.css", content: `:root { color-scheme: light dark; }
body { margin: 0; font-family: system-ui, sans-serif; color: #222; background: #fafafa; }
` },
      { path: "README.md", content: "# React + Vite Starter\n\nScaffolded from Kiren's template library.\n\n```bash\nnpm install\nnpm run dev\n```\n" },
    ],
  },
  {
    id: "node-api", name: "Node API", desc: "Express REST API with routes & JSON", stack: "Node · Express",
    files: [
      { path: "package.json", content: JSON.stringify({ name: "node-api", version: "0.1.0", main: "index.js", scripts: { start: "node index.js", dev: "node --watch index.js" }, dependencies: { express: "^4.19.0" } }, null, 2) },
      { path: "index.js", content: `const express = require("express");

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const items = [];
app.get("/api/items", (_req, res) => res.json({ items }));
app.post("/api/items", (req, res) => {
  const item = req.body;
  items.push(item);
  res.status(201).json({ item });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("API listening on", port));
` },
      { path: "README.md", content: "# Node API\n\nSimple Express REST API template.\n\n```bash\nnpm install\nnpm start\n```\n" },
    ],
  },
  {
    id: "landing-page", name: "Landing Page", desc: "Clean single-page site with modern CSS", stack: "HTML · CSS",
    files: [
      { path: "index.html", content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Landing Page</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header class="nav"><a class="logo" href="#">Acme</a><a href="#cta" class="btn">Get started</a></header>
  <section class="hero">
    <h1>Build something people want</h1>
    <p>Simple, fast, and beautiful — your product deserves a landing page like this.</p>
    <a href="#cta" class="btn primary" id="cta">Try it free</a>
  </section>
  <footer class="footer">© 2026 Acme</footer>
</body>
</html>
` },
      { path: "style.css", content: `:root { --ink: #18181b; --muted: #71717a; --accent: #6366f1; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; color: var(--ink); background: #fff; }
.nav { display: flex; justify-content: space-between; align-items: center; padding: 20px 40px; }
.logo { font-weight: 800; text-decoration: none; color: var(--ink); }
.btn { border: 1px solid var(--ink); padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 600; color: var(--ink); }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.hero { padding: 120px 40px; text-align: center; }
.hero h1 { font-size: 48px; margin: 0 0 16px; letter-spacing: -0.03em; }
.hero p { color: var(--muted); font-size: 18px; max-width: 480px; margin: 0 auto 28px; }
.footer { padding: 24px 40px; color: var(--muted); font-size: 13px; }
` },
      { path: "README.md", content: "# Landing Page\n\nOpen `index.html` in a browser to preview.\n" },
    ],
  },
  {
    id: "python-cli", name: "Python CLI", desc: "Command-line tool with argparse", stack: "Python",
    files: [
      { path: "main.py", content: `import argparse


def main() -> None:
    parser = argparse.ArgumentParser(description="Kiren Python CLI template")
    parser.add_argument("--name", default="world", help="who to greet")
    args = parser.parse_args()
    print(f"Hello, {args.name}!")


if __name__ == "__main__":
    main()
` },
      { path: "README.md", content: "# Python CLI\n\n```bash\npython3 main.py --name Kiren\n```\n" },
    ],
  },
];

const hour = new Date().getHours();
const GREETING = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

export default function ProjectPicker({ projects, projectId, user, onSelectProject, onOpen, onOpenThread, onImport, onToast }: Props) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"agent" | "plan" | "ask">("agent");
  const [model, setModel] = useState<string>("");
  const [models, setModels] = useState<any[]>([]);
  const [modelOpen, setModelOpen] = useState(false);
  const [projOpen, setProjOpen] = useState(false);
  const [source, setSource] = useState<"ready" | "github" | "local" | "template" | null>(null);
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [importing, setImporting] = useState<string | null>(null);
  const [ghRepos, setGhRepos] = useState<any[]>([]);
  const [reposLoading, setReposLoading] = useState(false);

  // Real model list from the model API (no hardcoded models)
  useEffect(() => {
    api.models.list()
      .then((d) => setModels((d.data || []).filter((m: any) => m.id)))
      .catch(() => setModels([]));
  }, []);

  const MODEL_LIST = models.length > 0
    ? models.map((m) => ({ id: m.id, label: m.id, desc: m.owned_by || "Available" }))
    : [];
  const MODEL_GROUPS = useMemo(() => groupModels(MODEL_LIST), [MODEL_LIST]);

  useEffect(() => {
    if (model) return;
    const preferred = MODEL_LIST.find((m) => m.id === "qwen3.7-max");
    if (preferred) setModel(preferred.id);
    else if (MODEL_LIST.length > 0) setModel(MODEL_LIST[0].id);
  }, [MODEL_LIST, model]);

  // Fetch the user's REAL GitHub repos
  useEffect(() => {
    if (source === "github") {
      setReposLoading(true);
      api.github.repos(1)
        .then((d) => setGhRepos(d.repos || []))
        .catch(() => { setGhRepos([]); onToast("Couldn't load GitHub repos"); })
        .finally(() => setReposLoading(false));
    }
  }, [source]);

  const active = projects.find((p) => p.id === projectId) ?? projects[0];
  const recent = active?.threads?.slice(0, 3) ?? [];

  const list = useMemo(
    () => projects.filter((p) => (cat === "All" || p.category === cat) && (p.name + p.repo).toLowerCase().includes(q.toLowerCase())),
    [projects, cat, q],
  );

  const upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const list = Array.from(files);
    setAttachments((prev) => [...prev, `${list.length} files`]);
    onToast(`Reading ${list.length} files…`);
    createFromFiles(list);
    e.target.value = "";
  };

  const readFile = async (f: File): Promise<{ path: string; content: string }> => {
    const rel = (f as any).webkitRelativePath || f.name;
    const texty = /\.(txt|md|json|js|jsx|ts|tsx|css|html|htm|py|yml|yaml|sh|env|svg|xml|sql|toml|ini|conf|gitignore|lock)$/i;
    if (f.size < 1_500_000 && texty.test(rel)) {
      return { path: rel, content: await f.text() };
    }
    const buf = new Uint8Array(await f.arrayBuffer());
    let bin = "";
    buf.forEach((b) => (bin += String.fromCharCode(b)));
    return { path: rel, content: "base64:" + btoa(bin) };
  };

  const createFromFiles = async (files: File[]) => {
    setImporting("upload");
    try {
      const folder = (files[0] as any).webkitRelativePath?.split("/")[0] || "uploaded-project";
      const tree = await Promise.all(files.map(readFile));
      const data = await api.projects.create({ name: folder, source: "upload", files: tree });
      onImport({ ...data.project, threads: [], files: [], code: [], preview: [], domain: folder });
      onSelectProject(data.project.id);
      setSource(null);
      setAttachments([]);
      onToast(`Uploaded ${tree.length} files to ${folder}`);
    } catch (err: any) {
      onToast(`Upload failed: ${err.message}`);
    } finally { setImporting(null); }
  };

  const startTemplate = async (t: { id: string; name: string; files: { path: string; content: string }[] }) => {
    setImporting(t.id);
    try {
      const data = await api.projects.create({ name: t.name, source: "template", files: t.files });
      onImport({ ...data.project, threads: [], files: [], code: [], preview: [], domain: t.name });
      onSelectProject(data.project.id);
      setSource(null);
      onToast(`Created ${t.name} from template`);
    } catch (err: any) {
      onToast(`Template failed: ${err.message}`);
    } finally { setImporting(null); }
  };

  const start = () => {
    if (!active) { onToast("No project yet — create or import one below"); return; }
    onOpen(active.id, prompt.trim() || undefined);
  };

  const importRepo = async (repo: any) => {
    const full = repo.full_name;
    setImporting(full);
    try {
      const data = await api.projects.create({
        name: full.split("/")[1],
        source: "github",
        repo_full_name: full,
        branch: repo.default_branch || "main",
      });
      onImport({ ...data.project, threads: [], files: [], code: [], preview: [], domain: full.split("/")[1] });
      onSelectProject(data.project.id);
      setSource(null);
      onToast(`Imported ${full} — cloning into your sandbox`);
    } catch (err: any) {
      onToast(`Import failed: ${err.message}`);
    } finally { setImporting(null); }
  };

  return (
    <section className="relative flex h-full min-w-0 flex-1 flex-col overflow-y-auto bg-[var(--app)]">
      {/* Claude paper bg with dots */}
      <div className="pointer-events-none absolute inset-0 claude-dots-soft opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--app)]" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#EADDCB]/60 to-transparent blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-[700px] flex-1 flex-col justify-center px-6 py-10">
        {/* Greeting */}
        <div className="a-up flex flex-col items-center pb-8">
          <h1 className="text-center font-serif text-[38px] font-[450] leading-[1.1] tracking-[-0.02em] text-[var(--text)]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
            {GREETING}, {user?.display_name?.split(" ")[0] || user?.username || "there"}
          </h1>
          <p className="pt-2 text-center text-[13px] text-[var(--muted)]">
            Where should we start today?
          </p>
        </div>

        {/* Central composer — Claude rounded card */}
        <div className="a-pop rounded-[22px] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-paper),var(--shadow-md)]">
          <div className="relative">
            <textarea
              autoFocus
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  start();
                }
              }}
              rows={2}
              placeholder="How can Kiren help you today?"
              className="min-h-[72px] w-full resize-none bg-transparent px-5 pt-4 text-[15px] leading-[1.5] text-[var(--text)] outline-none placeholder:text-[var(--faint)]"
            />
          </div>

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2.5">
              {attachments.map((n, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-2)]">
                  <Icon name="file" size={11} className="text-[var(--faint)]" />
                  <span className="max-w-[140px] truncate">{n}</span>
                  <button onClick={() => setAttachments((p) => p.filter((_, x) => x !== i))} className="ml-0.5 rounded-full bg-[var(--panel-3)] p-0.5 text-[var(--faint)] hover:bg-[var(--border)] hover:text-[var(--text)]">
                    <Icon name="close" size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Composer footer — Work in project + model selector inside chatbox */}
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)]/70 px-3 py-2.5">
            {/* + */}
            <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] shadow-[var(--shadow-sm)] transition hover:border-[var(--border-2)] hover:text-[var(--text)] hover:shadow-sm" title="Attach files or images">
              <input type="file" multiple className="hidden" onChange={upload} />
              <Icon name="plus" size={16} strokeWidth={1.8} />
            </label>

            {/* Project selector */}
            <div className="relative">
              <button
                onClick={() => { setProjOpen((v) => !v); setModelOpen(false); }}
                className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--panel-2)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-2)] shadow-[var(--shadow-sm)] transition hover:border-[var(--border-2)]"
              >
                <Icon name="folder" size={12} className="text-[var(--faint)]" />
                Work in <span className="font-semibold text-[var(--text)]">{active?.name ?? "Select a project"}</span>
                <Icon name="chevDown" size={11} className="text-[var(--faint)]" />
              </button>
              {projOpen && (
                <div className="a-pop absolute bottom-full left-0 z-30 mb-2 max-h-[260px] w-[270px] overflow-hidden rounded-2xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
                  <div className="border-b border-[var(--border)] bg-[var(--panel-2)]/70 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]">Choose a project</p>
                  </div>
                  <div className="max-h-[220px] overflow-y-auto py-1">
                    {projects.map((p) => (
                      <button key={p.id} onClick={() => { onSelectProject(p.id); setProjOpen(false); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-[var(--panel-2)]">
                        <Tile color={p.color} glyph={p.glyph} size={22} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold text-[var(--text)]">{p.name}</span>
                          <span className="block truncate text-[10px] text-[var(--faint)]">{p.repo}</span>
                        </span>
                        <Badge tone="muted" className="!px-1.5 !text-[9px]">{p.category}</Badge>
                        {p.id === projectId && <Icon name="check" size={12} strokeWidth={2.2} className="text-[var(--text)]" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Mode pills */}
            <div className="hidden items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--panel-3)] p-0.5 sm:flex">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold transition", mode === m.id ? "bg-[var(--panel)] text-[var(--text)] shadow-[var(--shadow-sm)]" : "text-[var(--muted)] hover:text-[var(--text-2)]")}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Model selector — inline segmented cards */}
            <div className="relative ml-auto flex items-center gap-1.5">
              <div className="relative">
                <button
                  onClick={() => { setModelOpen((v) => !v); setProjOpen(false); }}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--text)] shadow-[var(--shadow-sm)] transition hover:border-[var(--border-2)] hover:bg-[var(--panel)]"
                >
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--panel-3)] font-mono text-[7.5px] font-bold text-[var(--text-2)]">
                    {familyOf(model).slice(0, 2).toUpperCase()}
                  </span>
                  {MODEL_LIST.find((m) => m.id === model) ? modelLabel(MODEL_LIST.find((m) => m.id === model)!) : "Model"}
                  <Icon name="chevDown" size={10} className={cn("text-[var(--faint)] transition-transform", modelOpen && "rotate-180")} />
                </button>

                {modelOpen && (
                  <div className="a-pop absolute bottom-full right-0 z-30 mb-2 w-[280px] overflow-hidden rounded-2xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
                    <div className="border-b border-[var(--border)] px-4 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--faint)]">Choose model</p>
                      <p className="text-[10.5px] text-[var(--faint)]">{MODEL_LIST.length} available · grouped by family</p>
                    </div>
                    <div className="max-h-[320px] overflow-y-auto p-1.5 flex flex-col gap-0.5">
                      {MODEL_LIST.length === 0 && (
                        <p className="px-3 py-2.5 text-[12px] text-[var(--faint)]">Models unavailable</p>
                      )}
                      {MODEL_GROUPS.map((g) => (
                        <div key={g.label}>
                          <p className="px-3 pt-1.5 pb-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]">{g.label}</p>
                          {g.models.map((m) => {
                            const active = model === m.id;
                            return (
                              <button
                                key={m.id}
                                onClick={() => { setModel(m.id); setModelOpen(false); onToast(`Model → ${m.label}`); }}
                                className={cn(
                                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition",
                                  active
                                    ? "bg-[var(--text)] text-[var(--panel)]"
                                    : "hover:bg-[var(--panel-2)]",
                                )}
                              >
                                <span className={cn(
                                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-[8px] font-bold",
                                  active ? "bg-white/15 text-[var(--panel)]" : "bg-[var(--panel-3)] text-[var(--text-2)]",
                                )}>
                                  {familyOf(m.id).slice(0, 2).toUpperCase()}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className={cn("truncate text-[12.5px] font-semibold", active ? "text-[var(--panel)]" : "text-[var(--text)]")}>{modelLabel(m)}</p>
                                  <p className={cn("truncate text-[10.5px]", active ? "text-white/60" : "text-[var(--faint)]")}>{m.desc}</p>
                                </div>
                                {active && <Icon name="check" size={13} strokeWidth={2.4} className="shrink-0 text-[var(--panel)]" />}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={start}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full shadow-[var(--shadow-sm)] transition active:scale-95",
                  prompt.trim() ? "bg-[var(--text)] text-[var(--panel)] hover:bg-black" : "bg-[var(--panel-3)] text-[var(--faint)]",
                )}
                title="Send"
              >
                <Icon name="arrowUp" size={14} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>

        {/* Sources — pill row */}
        <div className="a-up flex flex-wrap items-center justify-center gap-2 pt-5 text-[12px]">
          {([
            ["ready", "Ready projects", "boxes"],
            ["github", "Import GitHub", "github"],
            ["local", "Upload folder", "upload"],
            ["template", "Templates", "layers"],
          ] as const).map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => setSource(source === id ? null : id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3.5 py-2 font-medium shadow-[var(--shadow-sm)] transition",
                source === id ? "border-[var(--text)] bg-[var(--text)] text-[var(--panel)]" : "border-[var(--border)] bg-[var(--panel)]/90 text-[var(--muted)] hover:border-[var(--border-2)] hover:text-[var(--text)]",
              )}
            >
              <Icon name={icon} size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Expandable source panels */}
        {source === "ready" && (
          <div className="a-pop mx-auto mt-4 w-full rounded-2xl border border-[var(--border-2)] bg-[var(--panel-3)]/70 p-4 shadow-[var(--shadow-sm)] backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-1.5 pb-3">
              {["All", ...categories].map((c) => (
                <button key={c} onClick={() => setCat(c)} className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium transition", cat === c ? "border-transparent bg-[var(--text)] text-[var(--panel)] shadow-sm" : "border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--border-2)] hover:text-[var(--text)]")}>
                  {c}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1">
                <Icon name="search" size={11} className="text-[var(--faint)]" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className="w-[90px] bg-transparent text-[11px] outline-none placeholder:text-[var(--faint)]" />
              </div>
            </div>
            {list.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--border-3)] bg-[var(--panel-2)]/60 px-6 py-8 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--panel)] text-[var(--text)] shadow-[var(--shadow-sm)]">
                  <Icon name="boxes" size={18} />
                </span>
                <p className="text-[13px] font-semibold text-[var(--text)]">No projects yet</p>
                <p className="max-w-[280px] text-[11.5px] leading-relaxed text-[var(--muted)]">
                  Start from a template, import a GitHub repo, or drop a folder — or just type a goal above and Kiren will create a project for you.
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <Btn variant="accent" className="!px-3 !py-1.5 !text-[11px]" onClick={() => setSource("template")}>Browse templates</Btn>
                  <Btn variant="ghost" className="!px-3 !py-1.5 !text-[11px]" onClick={() => setSource("github")}>Import GitHub</Btn>
                </div>
              </div>
            ) : (
              <div className="grid max-h-[220px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {list.map((p) => (
                  <button key={p.id} onClick={() => { onSelectProject(p.id); setSource(null); }} className={cn("group flex items-center gap-3 rounded-xl border p-3 text-left transition hover:shadow-[var(--shadow-sm)]", p.id === projectId ? "border-[var(--text)] bg-[var(--panel)] shadow-sm" : "border-[var(--border)] bg-[var(--panel)]/70 hover:bg-[var(--panel)]")}>
                    <Tile color={p.color} glyph={p.glyph} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold text-[var(--text)] group-hover:text-[var(--text)]">{p.name}</span>
                      <span className="block truncate font-mono text-[10px] text-[var(--faint)]">{p.repo}</span>
                    </span>
                    {p.id === projectId ? <Icon name="checkCircle" size={16} className="text-[var(--text)]" /> : <Icon name="chevRight" size={12} className="text-[var(--faint)] opacity-0 transition group-hover:opacity-100" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {source === "github" && (
          <div className="a-pop mx-auto mt-4 w-full overflow-hidden rounded-2xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-md)]">
            <div className="border-b border-[var(--border)] bg-[var(--panel-2)] px-4 py-2.5">
              <p className="text-[11px] font-semibold text-[var(--text)]">Import from GitHub · {user?.username || "your repos"}</p>
            </div>
            {reposLoading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-[12px] text-[var(--muted)]">
                <Icon name="spinner" size={13} className="a-spin" /> Loading your repositories…
              </div>
            ) : ghRepos.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12px] text-[var(--faint)]">No repositories found. Sync GitHub in settings to refresh.</div>
            ) : (
              ghRepos.slice(0, 20).map((r, i) => (
                <div key={r.id} className={cn("flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--panel-2)]", i > 0 && "border-t border-[var(--border)]")}>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--panel-3)]">
                    <Icon name="github" size={16} className="text-[var(--text)]" />
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-[var(--text)]">{r.full_name}</span>
                    <span className="block truncate text-[11px] text-[var(--faint)]">
                      {r.language || "—"} · {r.private ? "Private" : "Public"} · {r.default_branch || "main"}
                    </span>
                  </span>
                  <Btn variant="ghost" icon={importing === r.full_name ? "spinner" : "download"} className={cn("!py-1.5 !px-3 !text-[11px]", importing === r.full_name && "[&_svg]:a-spin")} onClick={() => importRepo(r)}>
                    {importing === r.full_name ? "Importing…" : "Import"}
                  </Btn>
                </div>
              ))
            )}
          </div>
        )}

        {source === "local" && (
          <div className="a-pop mx-auto mt-4 flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border-3)] bg-[var(--panel-2)]/70 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--panel)] text-[var(--text)] shadow-[var(--shadow-sm)]">
              <Icon name="upload" size={20} />
            </span>
            <p className="text-[13.5px] font-semibold text-[var(--text)]">Drop a project folder</p>
            <p className="max-w-[300px] text-[12px] leading-relaxed text-[var(--muted)]">We copy the folder into your sandboxed workspace and detect the stack automatically.</p>
            <label className="cursor-pointer">
              <input type="file" multiple className="hidden" onChange={upload} {...({ webkitdirectory: "", directory: "" } as any)} />
              <Btn variant="accent" icon={importing === "upload" ? "spinner" : "folder"} className={cn(importing === "upload" && "[&_svg]:a-spin")}>
                {importing === "upload" ? "Uploading…" : "Choose folder"}
              </Btn>
            </label>
            {attachments.length > 0 && (
              <p className="text-[11px] text-[var(--faint)]">{attachments[attachments.length - 1]}</p>
            )}
          </div>
        )}

        {source === "template" && (
          <div className="a-pop mx-auto mt-4 w-full rounded-2xl border border-[var(--border-2)] bg-[var(--panel)] p-4 shadow-[var(--shadow-md)]">
            <p className="pb-3 text-[11px] font-semibold text-[var(--text)]">Start from a ready template — scaffolded straight into your sandbox</p>
            <div className="grid max-h-[280px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => startTemplate(t)}
                  className="group flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel-2)]/60 p-3 text-left transition hover:border-[var(--border-2)] hover:bg-[var(--panel-2)]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--panel-3)] text-[var(--text)]">
                    <Icon name="layers" size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-[var(--text)]">{t.name}</span>
                    <span className="block truncate text-[11px] text-[var(--muted)]">{t.desc}</span>
                    <span className="block pt-0.5 font-mono text-[10px] text-[var(--faint)]">{t.stack} · {t.files.length} files</span>
                  </span>
                  <Icon name={importing === t.id ? "spinner" : "chevRight"} size={12} className={cn("shrink-0 text-[var(--faint)]", importing === t.id && "a-spin text-[var(--accent)]")} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Suggestion chips — Claude style */}
        <div className="a-up mx-auto flex w-full max-w-[560px] flex-wrap items-center justify-center gap-2 pt-7">
          {SUGGESTIONS.map((s) => (
            <button key={s.text} onClick={() => setPrompt(s.text)} className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--panel)] px-3.5 py-2 text-[12px] font-medium text-[var(--muted)] shadow-[var(--shadow-sm)] transition hover:border-[var(--border-2)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]">
              <Icon name={s.icon} size={13} className="text-[var(--faint)]" />
              {s.text}
            </button>
          ))}
        </div>

        {/* Recent — Claude “Recents” style */}
        {recent.length > 0 && (
          <div className="a-up mx-auto w-full max-w-[640px] pt-8">
            <div className="flex items-center justify-between pb-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]">
                Recent in {active.name}
              </p>
              <button onClick={() => onToast("Opening all recents")} className="text-[11px] font-medium text-[var(--muted)] hover:text-[var(--text)] hover:underline">
                View all
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {recent.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onOpenThread ? onOpenThread(t.id, active.id) : onOpen(active.id)}
                  className="group rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 text-left shadow-[var(--shadow-sm)] transition hover:-translate-y-0.5 hover:border-[var(--border-2)] hover:shadow-[var(--shadow-md)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-snug text-[var(--text)]">{t.title}</p>
                    <span className={cn("h-2 w-2 shrink-0 rounded-full mt-1", t.status === "running" ? "bg-blue-500 a-pulse-soft" : t.status === "review" ? "bg-amber-500" : "bg-emerald-500")} />
                  </div>
                  <p className="truncate pt-1.5 font-mono text-[10.5px] text-[var(--faint)]">{t.branch} · {t.updated}</p>
                  <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-[var(--faint)]">
                    <Icon name="chat" size={10} />
                    <span>{t.blocks.length} turns</span>
                    <span>·</span>
                    <span>{t.tokens.toLocaleString()} tokens</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="a-up pt-10 text-center text-[10.5px] leading-relaxed text-[var(--faint)]">
          Agents ask before writing files · <span className="underline decoration-[var(--border-2)] underline-offset-2 hover:text-[var(--muted)] cursor-pointer">⌘K for commands</span> · <span className="underline decoration-[var(--border-2)] underline-offset-2 hover:text-[var(--muted)] cursor-pointer">⌘P to switch project</span>
        </p>
      </div>
    </section>
  );
}
