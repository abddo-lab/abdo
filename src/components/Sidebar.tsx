import { useState } from "react";
import { cn } from "../utils/cn";
import { Icon, type IconName } from "../icons";
import { type Project, type Thread } from "../data";
import { Avatar, Badge, Tile } from "./ui";

export type View = "picker" | "work" | "agent" | "workflows" | "automations" | "settings";

const NAV: { id: View; label: string; icon: IconName; kbd: string }[] = [
  { id: "work",        label: "My Work",     icon: "inbox",    kbd: "⌘1" },
  { id: "agent",       label: "Threads",     icon: "chat",     kbd: "⌘2" },
  { id: "workflows",   label: "Workflows",   icon: "workflow", kbd: "⌘3" },
  { id: "automations", label: "Automations", icon: "zap",      kbd: "⌘4" },
];

const DOT: Record<Thread["status"], string> = {
  review:  "bg-[var(--accent)]",
  running: "bg-[var(--blue)]",
  done:    "bg-[var(--green)]",
  draft:   "bg-[var(--faint)]",
};

interface Props {
  project?: Project;
  projects: Project[];
  threads: Thread[];
  activeId: string;
  view: View;
  compact: boolean;
  user?: any;
  plan?: any;
  billing?: any;
  onSelect: (id: string) => void;
  onNavigate: (v: View) => void;
  onNewThread: () => void;
  onSwitchProject: (id: string) => void;
  onCreateProject: () => void;
  onOpenSettings: () => void;
}

export default function Sidebar({
  project, projects, threads, activeId, view, compact,
  user, plan, billing,
  onSelect, onNavigate, onNewThread, onSwitchProject, onCreateProject, onOpenSettings,
}: Props) {
  const [projOpen, setProjOpen] = useState(false);

  // Only show the running-agent strip when a thread is ACTUALLY running
  const runningThreads = threads.filter((t) => t.status === "running");
  const bgRunning = runningThreads.length;

  const groups: { label: string; items: Thread[] }[] = [
    { label: "Active",    items: threads.filter((t) => t.status === "running" || t.status === "draft") },
    { label: "In review", items: threads.filter((t) => t.status === "review") },
    { label: "Shipped",   items: threads.filter((t) => t.status === "done") },
  ];

  // Real usage — 5h session window from the billing API
  const session = billing?.session;
  const spentUsd = session?.spent_usd ?? 0;
  const limitUsd = session?.limit_usd ?? 0;
  const pct = limitUsd > 0 ? session?.pct ?? Math.min(100, Math.round((spentUsd / limitUsd) * 100)) : 0;

  const name = user?.display_name || user?.username || "Kiren";
  const initials = (user?.display_name || user?.username || "K")
    .split(/\s+/).map((w: string) => w[0]?.toUpperCase()).filter(Boolean).slice(0, 2).join("") || "K";
  const planName = plan?.name || "Free";

  return (
    <aside className="flex h-full w-[236px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--chrome)]">

      {/* ── Project switcher ─────────────────────────────────────────────── */}
      <div className="relative px-2.5 pt-2.5">
        <button
          onClick={() => setProjOpen((v) => !v)}
          className="group flex w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 shadow-[var(--shadow-sm)] transition hover:border-[var(--border-2)] hover:shadow-[var(--shadow-md)]"
        >
          {project ? (
            <>
              <Tile color={project.color} glyph={project.glyph} size={22} />
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[12px] font-semibold leading-tight text-[var(--text)]">{project.name}</span>
                <span className="block truncate text-[10px] leading-tight text-[var(--faint)]">{project.category} · {project.branch}</span>
              </span>
            </>
          ) : (
            <span className="flex-1 text-left text-[12px] text-[var(--faint)]">Select project</span>
          )}
          <Icon name="chevUpDown" size={12} className="shrink-0 text-[var(--faint)]" />
        </button>

        {projOpen && (
          <div className="a-pop absolute left-2.5 right-2.5 top-full z-40 mt-1.5 overflow-hidden rounded-2xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-lg)]"
            style={{ boxShadow: "var(--shadow-lg), var(--glow-sm)" }}>
            <div className="border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--faint)]">Projects</p>
            </div>
            <div className="max-h-[240px] overflow-y-auto py-1">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onSwitchProject(p.id); setProjOpen(false); }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-[var(--panel-2)]",
                    p.id === project?.id && "bg-[var(--accent-soft)]",
                  )}
                >
                  <Tile color={p.color} glyph={p.glyph} size={26} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-[var(--text)]">{p.name}</span>
                    <span className="block truncate font-mono text-[10px] text-[var(--faint)]">{p.repo}</span>
                  </span>
                  {p.id === project?.id && <Icon name="check" size={12} strokeWidth={2.4} className="shrink-0 text-[var(--text)]" />}
                </button>
              ))}
            </div>
            <div className="border-t border-[var(--border)] p-1.5">
              <button
                onClick={() => { onCreateProject(); setProjOpen(false); }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-semibold text-[var(--muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
              >
                <Icon name="plus" size={13} strokeWidth={2.2} />
                New / import project
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── New thread ───────────────────────────────────────────────────── */}
      <div className="px-2.5 pt-2">
        <button
          onClick={onNewThread}
          className="flex w-full items-center gap-2 rounded-xl bg-[var(--text)] px-2.5 py-2 text-[13px] font-semibold text-[var(--panel)] shadow-[var(--shadow-sm)] transition hover:opacity-90 active:scale-[0.99]"
          style={{ boxShadow: "var(--shadow-sm), var(--glow-sm)" }}
        >
          <Icon name="plus" size={14} strokeWidth={2.2} />
          New Thread
          <kbd className="ml-auto rounded border border-white/20 bg-white/10 px-1.5 py-px text-[10px]">⌘N</kbd>
        </button>
      </div>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="px-2.5 pt-2">
        {NAV.map((n) => {
          const on = view === n.id;
          return (
            <button
              key={n.id}
              onClick={() => onNavigate(n.id)}
              className={cn(
                "group relative flex w-full items-center gap-2.5 rounded-xl px-2.5 text-[13px] font-medium transition",
                compact ? "py-[5px]" : "py-[7px]",
                on
                  ? "bg-[var(--panel)] text-[var(--text)] shadow-[var(--shadow-sm)]"
                  : "text-[var(--text-2)] hover:bg-[var(--panel-3)]",
              )}
            >
              {on && <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--accent)]" />}
              <Icon name={n.icon} size={15} className={on ? "text-[var(--accent)]" : "text-[var(--faint)]"} />
              {n.label}
              <kbd className="ml-auto text-[10px] text-[var(--faint)] opacity-0 group-hover:opacity-100">{n.kbd}</kbd>
            </button>
          );
        })}
      </nav>

      {/* ── Running agent strip — only when a real agent is running ──────── */}
      {bgRunning > 0 && (
        <div className="mx-2.5 mt-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-2">
            <Icon name="agentBadge" size={13} className="text-[var(--accent)]" />
            <span className="text-[11px] font-semibold text-[var(--text)]">{bgRunning} running</span>
            <Icon name="spinner" size={11} className="ml-auto a-spin text-[var(--faint)]" />
          </div>
          <p className="mt-0.5 truncate text-[10.5px] text-[var(--faint)]">
            {runningThreads[0]?.title}
          </p>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--panel-3)]">
            <div className="a-bar h-full bg-[var(--accent)]" />
          </div>
        </div>
      )}

      {/* ── Thread list ──────────────────────────────────────────────────── */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2.5 pb-2 pt-2">
        {groups.map((g) =>
          g.items.length === 0 ? null : (
            <div key={g.label} className="pt-2.5">
              <p className="px-1.5 pb-1 text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--faint)]">
                {g.label} · {g.items.length}
              </p>
              {g.items.map((t) => {
                const on = t.id === activeId && (view === "agent" || view === "picker");
                return (
                  <button
                    key={t.id}
                    onClick={() => onSelect(t.id)}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-lg px-2 text-left transition",
                      compact ? "py-[4px]" : "py-[5.5px]",
                      on
                        ? "bg-[var(--accent-soft)] text-[var(--text)]"
                        : "text-[var(--muted)] hover:bg-[var(--panel-3)] hover:text-[var(--text)]",
                    )}
                  >
                    <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
                      <span className={cn("h-1.5 w-1.5 rounded-full", DOT[t.status])} />
                      {t.status === "running" && (
                        <span className={cn("absolute h-2.5 w-2.5 animate-ping rounded-full opacity-50", DOT[t.status])} />
                      )}
                    </span>
                    <span className={cn("min-w-0 flex-1 truncate text-[12.5px]", on && "font-semibold")}>{t.title}</span>
                    <span className="shrink-0 text-[10px] text-[var(--faint)] opacity-0 group-hover:opacity-100">{t.updated}</span>
                  </button>
                );
              })}
            </div>
          ),
        )}
        {threads.length === 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-[var(--border-2)] px-3 py-6 text-center">
            <p className="text-[11.5px] font-medium text-[var(--muted)]">No threads yet</p>
            <p className="pt-1 text-[10.5px] leading-relaxed text-[var(--faint)]">Start one above.</p>
          </div>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="border-t border-[var(--border)] p-2.5">
        {/* Real usage — spent vs 5h session limit */}
        {limitUsd > 0 && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 shadow-[var(--shadow-sm)]">
            <Icon name="gauge" size={13} className="text-[var(--accent)]" />
            <span className="text-[10.5px] text-[var(--muted)]">${spentUsd.toFixed(2)} / ${limitUsd}</span>
            <span className="ml-auto h-1.5 w-12 overflow-hidden rounded-full bg-[var(--panel-3)]">
              <span className="a-bar block h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
            </span>
          </div>
        )}
        {/* Real user + settings */}
        <button
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition hover:bg-[var(--panel-3)]"
        >
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="h-7 w-7 shrink-0 rounded-full" />
          ) : (
            <Avatar initials={initials} size={28} />
          )}
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[12.5px] font-semibold leading-tight text-[var(--text)]">{name}</span>
            <span className="block truncate text-[10.5px] leading-tight text-[var(--faint)]">Kiren · {planName}</span>
          </span>
          <Badge tone="muted">Settings</Badge>
        </button>
      </div>
    </aside>
  );
}
