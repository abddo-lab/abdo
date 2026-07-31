import { useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { Icon } from "../icons";
import { categories, type Project } from "../data";
import { Badge, Btn, Tile } from "./ui";

interface Props {
  projects: Project[];
  projectId: string;
  onSelectProject: (id: string) => void;
  onOpen: (id: string, prompt?: string) => void;
  onOpenThread?: (threadId: string, projectId: string) => void;
  onImport: (p: Project) => void;
  onToast: (m: string) => void;
}

const GH_REPOS = [
  { full: "kiren/design-system", desc: "Shared UI primitives and tokens", cat: "Product" },
  { full: "kiren/billing-service", desc: "Usage metering and invoicing", cat: "Infra" },
  { full: "kiren/docs-site", desc: "Public documentation and guides", cat: "Marketing" },
  { full: "kiren/mobile-app", desc: "React Native client", cat: "Product" },
];

const MODELS = [
  { id: "kiren-2.5", label: "Kiren 2.5", desc: "Balanced · default" },
  { id: "kiren-2.5-fast", label: "Kiren 2.5 Fast", desc: "Low latency" },
  { id: "kiren-thinking", label: "Kiren Thinking", desc: "Deep reasoning" },
  { id: "gpt-4o", label: "GPT-4o", desc: "Multimodal" },
];

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

const hour = new Date().getHours();
const GREETING = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

export default function ProjectPicker({ projects, projectId, onSelectProject, onOpen, onOpenThread, onImport, onToast }: Props) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"agent" | "plan" | "ask">("agent");
  const [model, setModel] = useState("kiren-2.5");
  const [modelOpen, setModelOpen] = useState(false);
  const [projOpen, setProjOpen] = useState(false);
  const [source, setSource] = useState<"ready" | "github" | "local" | null>(null);
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [importing, setImporting] = useState<string | null>(null);

  const active = projects.find((p) => p.id === projectId) ?? projects[0];
  const recent = active.threads.slice(0, 3);

  const list = useMemo(
    () => projects.filter((p) => (cat === "All" || p.category === cat) && (p.name + p.repo).toLowerCase().includes(q.toLowerCase())),
    [projects, cat, q],
  );

  const upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setAttachments((prev) => [...prev, ...Array.from(files).map((f) => f.name)]);
    onToast(`${files.length} file${files.length > 1 ? "s" : ""} attached`);
  };

  const start = () => onOpen(active.id, prompt.trim() || undefined);

  const importRepo = (full: string, category: string) => {
    setImporting(full);
    setTimeout(() => {
      const name = full.split("/")[1];
      const p: Project = {
        id: `pr-${name}`,
        name,
        category,
        source: "github",
        repo: full,
        branch: "main",
        stack: ["TypeScript"],
        glyph: name.slice(0, 2).toUpperCase(),
        color: "#2A2520",
        updated: "just now",
        threads: [],
        files: [],
        code: [{ path: "README.md", lang: "markdown", content: `# ${name}\n\nImported from github.com/${full}.\n` }],
        preview: [
          { id: "n1", kind: "eyebrow", text: full },
          { id: "n2", kind: "heading", text: name },
          { id: "n3", kind: "lede", text: "Freshly imported project." },
          { id: "n4", kind: "cta", text: "Start thread" },
        ],
        domain: name,
      };
      onImport(p);
      onSelectProject(p.id);
      setImporting(null);
      setSource(null);
      onToast(`Imported ${full}`);
    }, 900);
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
            {GREETING}, Lance
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
                Work in <span className="font-semibold text-[var(--text)]">{active.name}</span>
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
                  <Icon name="cpu" size={12} className="text-[var(--faint)]" />
                  {MODELS.find((m) => m.id === model)?.label}
                  <Icon name="chevDown" size={10} className={cn("text-[var(--faint)] transition-transform", modelOpen && "rotate-180")} />
                </button>

                {modelOpen && (
                  <div className="a-pop absolute bottom-full right-0 z-30 mb-2 w-[260px] overflow-hidden rounded-2xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
                    <div className="border-b border-[var(--border)] px-4 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--faint)]">Choose model</p>
                    </div>
                    <div className="p-1.5 flex flex-col gap-0.5">
                      {MODELS.map((m) => {
                        const active = model === m.id;
                        return (
                          <button
                            key={m.id}
                            onClick={() => { setModel(m.id); setModelOpen(false); onToast(`Model → ${m.label}`); }}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                              active
                                ? "bg-[var(--text)] text-[var(--panel)]"
                                : "hover:bg-[var(--panel-2)]",
                            )}
                          >
                            <div className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                              active ? "bg-white/15" : "bg-[var(--panel-3)]",
                            )}>
                              <Icon name="cpu" size={13} className={active ? "text-[var(--panel)]" : "text-[var(--text-2)]"} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={cn("text-[12.5px] font-semibold", active ? "text-[var(--panel)]" : "text-[var(--text)]")}>{m.label}</p>
                              <p className={cn("text-[10.5px]", active ? "text-white/60" : "text-[var(--faint)]")}>{m.desc}</p>
                            </div>
                            {active && <Icon name="check" size={13} strokeWidth={2.4} className="shrink-0 text-[var(--panel)]" />}
                          </button>
                        );
                      })}
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
          </div>
        )}

        {source === "github" && (
          <div className="a-pop mx-auto mt-4 w-full overflow-hidden rounded-2xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-md)]">
            <div className="border-b border-[var(--border)] bg-[var(--panel-2)] px-4 py-2.5">
              <p className="text-[11px] font-semibold text-[var(--text)]">Import from GitHub · suaib-asif</p>
            </div>
            {GH_REPOS.map((r, i) => (
              <div key={r.full} className={cn("flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--panel-2)]", i > 0 && "border-t border-[var(--border)]")}>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--panel-3)]">
                  <Icon name="github" size={16} className="text-[var(--text)]" />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-[var(--text)]">{r.full}</span>
                  <span className="block truncate text-[11px] text-[var(--faint)]">{r.desc}</span>
                </span>
                <Btn variant="ghost" icon={importing === r.full ? "spinner" : "download"} className={cn("!py-1.5 !px-3 !text-[11px]", importing === r.full && "[&_svg]:a-spin")} onClick={() => importRepo(r.full, r.cat)}>
                  {importing === r.full ? "Importing…" : "Import"}
                </Btn>
              </div>
            ))}
          </div>
        )}

        {source === "local" && (
          <div className="a-pop mx-auto mt-4 flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border-3)] bg-[var(--panel-2)]/70 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--panel)] text-[var(--text)] shadow-[var(--shadow-sm)]">
              <Icon name="upload" size={20} />
            </span>
            <p className="text-[13.5px] font-semibold text-[var(--text)]">Drop a project folder</p>
            <p className="max-w-[300px] text-[12px] leading-relaxed text-[var(--muted)]">Everything stays in your sandboxed workspace. We detect the stack and suggest a category automatically.</p>
            <Btn variant="accent" icon="folder" onClick={() => importRepo("local/uploaded-folder", "Internal")}>
              Choose folder
            </Btn>
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
