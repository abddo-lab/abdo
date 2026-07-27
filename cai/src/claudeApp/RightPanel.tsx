import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Database,
  FileDiff,
  Lock,
  Monitor,
  MoreHorizontal,
  Play,
  RefreshCw,
  Smartphone,
  SquareCode,
  X,
  Zap,
} from "lucide-react";
import { c, font, mono } from "./theme";
import { diffFiles, type DiffFile, type DiffLine } from "./data";
import CodeEditor from "./CodeEditor";
import DatabasePage from "./DatabasePage";
import { useGitHub } from "./github";

/* ================= Preview ================= */
function PreviewSite() {
  const games = [
    { title: "Binary Frontier", tags: ["Adventure", "DevMasters"], blurb: "An uncharted cyber-world where every clever commit unlocks a secret." },
    { title: "Bug Buster", tags: ["Puzzle", "GitHub Games"], blurb: "Clever puzzles that simulate real-world debugging under pressure." },
    { title: "Cloud Conqueror", tags: ["Action", "CodeForge"], blurb: "High-stakes aerial battles against rogue cloud services." },
    { title: "Code Chronicles", tags: ["Puzzle", "CodeForge"], blurb: "Brain-teasing challenges that unravel cryptic algorithms." },
  ];
  return (
    <div style={{ backgroundColor: "#0a0a0a", color: "#f2f2f2", minHeight: 400, fontFamily: font }}>
      <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid #1f1f1f" }}>
        <div className="flex flex-col gap-[3px]">
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 16, height: 1.5, backgroundColor: "#e6e6e6", display: "block" }} />
          ))}
        </div>
        <span className="font-semibold text-[13px] tracking-tight">Tailspin Toys</span>
        <span className="ml-auto text-[11px]" style={{ color: "#7a7a7a" }}>Catalog · Back a game</span>
      </div>
      <div className="px-5 py-7">
        <h1 className="text-xl font-semibold tracking-tight">Find your next game</h1>
        <p className="text-[12px] mt-1" style={{ color: "#8a8a8a" }}>
          Hand-picked indie titles built by developers, for developers.
        </p>
        <div className="mt-5 rounded-xl p-3" style={{ backgroundColor: "#111", border: "1px solid #1f1f1f" }}>
          <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#6a6a6a" }}>Recently visited</div>
          <div className="text-[12px]" style={{ color: "#c9c9c9" }}>Binary Frontier › Infrastructure Innovator › Container Chaos</div>
        </div>
        <h2 className="text-[10px] font-semibold mt-6 mb-2.5 uppercase tracking-wider" style={{ color: "#6a6a6a" }}>
          Featured games
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {games.map((g) => (
            <div key={g.title} className="rounded-xl p-3" style={{ backgroundColor: "#101010", border: "1px solid #1c1c1c" }}>
              <div className="font-medium text-[12.5px]">{g.title}</div>
              <div className="flex gap-1 mt-1 flex-wrap">
                {g.tags.map((t) => (
                  <span key={t} className="text-[9.5px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#1c1c1c", color: "#9a9a9a" }}>
                    {t}
                  </span>
                ))}
              </div>
              <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "#7d7d7d" }}>{g.blurb}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PreviewTab({ env }: { env: string }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  return (
    <div className="p-3">
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs mb-2"
        style={{ backgroundColor: c.input, border: `1px solid ${c.border}`, color: c.muted }}
      >
        <ArrowLeft size={12} />
        <ArrowRight size={12} />
        <RefreshCw size={11} />
        <span
          className="flex-1 flex items-center gap-1.5 truncate px-2 py-1 rounded-md"
          style={{ backgroundColor: c.chip, fontFamily: mono, fontSize: 11 }}
        >
          <Lock size={10} color={c.faint} />
          {env === "local" ? "localhost:8421" : "sbx-4f21.claude.dev"}
        </span>
        <button onClick={() => setDevice("desktop")} style={{ color: device === "desktop" ? c.text : c.faint }}>
          <Monitor size={12} />
        </button>
        <button onClick={() => setDevice("mobile")} style={{ color: device === "mobile" ? c.text : c.faint }}>
          <Smartphone size={12} />
        </button>
        <MoreHorizontal size={13} />
      </div>
      <div className="flex justify-center">
        <div
          className="rounded-xl overflow-hidden transition-all"
          style={{ border: `1px solid ${c.border}`, width: device === "mobile" ? 300 : "100%" }}
        >
          <PreviewSite />
        </div>
      </div>
      <p className="text-[10.5px] mt-2 px-1" style={{ color: c.dim }}>
        {env === "local"
          ? "Live preview from this Mac — hot reloads whenever Caret edits a file."
          : "Sandbox preview — served from the cloud container."}
      </p>
    </div>
  );
}

/* ================= Changes ================= */
function DiffRow({ line, oldN, newN }: { line: DiffLine; oldN: number | null; newN: number | null }) {
  const styles: Record<string, { bg: string; fg: string; sign: string }> = {
    ctx: { bg: "transparent", fg: c.muted, sign: " " },
    add: { bg: c.diffAdd, fg: c.diffAddText, sign: "+" },
    del: { bg: c.diffDel, fg: c.diffDelText, sign: "−" },
    hunk: { bg: c.codeBg, fg: c.faint, sign: " " },
  };
  const s = styles[line.t];
  return (
    <div className="flex text-[11px] leading-5" style={{ backgroundColor: s.bg, fontFamily: mono }}>
      <span className="w-8 text-right pr-2 select-none flex-shrink-0" style={{ color: c.dim }}>
        {line.t === "hunk" || line.t === "add" ? "" : oldN}
      </span>
      <span className="w-8 text-right pr-2 select-none flex-shrink-0" style={{ color: c.dim }}>
        {line.t === "hunk" || line.t === "del" ? "" : newN}
      </span>
      <span className="pr-1 select-none flex-shrink-0" style={{ color: s.fg }}>
        {line.t === "hunk" ? "" : s.sign}
      </span>
      <span
        className="whitespace-pre"
        style={{ color: line.t === "hunk" ? s.fg : line.t === "del" ? c.diffDelText : line.t === "add" ? c.text : c.muted }}
      >
        {line.code}
      </span>
    </div>
  );
}

function DiffFileCard({ file, defaultOpen }: { file: DiffFile; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  let oldN = 0;
  let newN = 0;
  return (
    <div className="rounded-lg overflow-hidden mb-2.5" style={{ border: `1px solid ${c.border}`, backgroundColor: c.input }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-xs transition-colors"
        style={{ backgroundColor: c.panel, color: c.text }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chipHover)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = c.panel)}
      >
        {open ? <ChevronDown size={12} color={c.faint} /> : <ChevronRight size={12} color={c.faint} />}
        <span className="truncate font-medium" style={{ fontFamily: mono }}>{file.path}</span>
        <span className="ml-auto flex-shrink-0" style={{ color: c.text, fontFamily: mono }}>+{file.add}</span>
        <span className="flex-shrink-0" style={{ color: c.faint, fontFamily: mono }}>−{file.del}</span>
      </button>
      {open && (
        <div className="py-1 overflow-x-auto" style={{ borderTop: `1px solid ${c.borderSoft}` }}>
          {file.lines.map((ln, i) => {
            if (ln.t === "hunk") {
              const m = ln.code.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
              if (m) {
                oldN = parseInt(m[1], 10);
                newN = parseInt(m[2], 10);
              }
              return <DiffRow key={i} line={ln} oldN={null} newN={null} />;
            }
            const row = <DiffRow key={i} line={ln} oldN={ln.t === "add" ? null : oldN} newN={ln.t === "del" ? null : newN} />;
            if (ln.t !== "add") oldN++;
            if (ln.t !== "del") newN++;
            return row;
          })}
        </div>
      )}
    </div>
  );
}

function ChangesTab() {
  const totalAdd = diffFiles.reduce((n, f) => n + f.add, 0);
  const totalDel = diffFiles.reduce((n, f) => n + f.del, 0);
  return (
    <div className="p-3">
      <div className="flex items-center gap-2 px-1 pb-3 text-xs" style={{ color: c.muted }}>
        <FileDiff size={13} color={c.faint} />
        <span className="font-medium" style={{ color: c.text }}>{diffFiles.length} files changed</span>
        <span style={{ color: c.text, fontFamily: mono }}>+{totalAdd}</span>
        <span style={{ color: c.faint, fontFamily: mono }}>−{totalDel}</span>
        <button
          className="ml-auto px-2 py-1 rounded-md font-medium transition-colors"
          style={{ backgroundColor: c.chip, color: c.text, border: `1px solid ${c.border}` }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chipHover)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = c.chip)}
        >
          Copy diff
        </button>
      </div>
      {diffFiles.map((f, i) => (
        <DiffFileCard key={f.path} file={f} defaultOpen={i === 0} />
      ))}
    </div>
  );
}

/* ================= Tasks ================= */
const agentRows = [
  { name: "review:correctness", tokens: "44.9k", tools: 10, time: "18s" },
  { name: "review:threejs", tokens: "52.9k", tools: 12, time: "18s" },
  { name: "review:gameplay", tokens: "52.0k", tools: 12, time: "18s" },
  { name: "review:lifecycle", tokens: "56.3k", tools: 11, time: "18s" },
];

function Dots({ count, active }: { count: number; active: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="rounded-full" style={{ width: 5, height: 5, backgroundColor: i < active ? c.accent : c.dim }} />
      ))}
    </div>
  );
}

function TasksTab() {
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [reviewOpen, setReviewOpen] = useState(true);

  const run = () => {
    setStatus("running");
    setTimeout(() => setStatus("done"), 3500);
  };

  if (status === "idle") {
    return (
      <div className="p-4">
        <div className="text-[13px] font-medium mb-1" style={{ color: c.text }}>Background tasks</div>
        <p className="text-[11.5px] leading-relaxed mb-3" style={{ color: c.muted }}>
          Workflows run in the background while you keep working — reviews, test sweeps, dependency bumps.
        </p>
        <button
          onClick={run}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[12.5px] font-medium transition-colors"
          style={{ backgroundColor: c.chip, color: c.text, border: `1px solid ${c.border}` }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chipHover)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = c.chip)}
        >
          <Play size={12} color={c.accent} /> Run adversarial review
        </button>
      </div>
    );
  }

  const running = status === "running";
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-medium" style={{ color: c.text }}>Background tasks</span>
        {!running && (
          <button onClick={() => setStatus("idle")} className="text-[11px]" style={{ color: c.muted }}>Clear</button>
        )}
      </div>
      <div className="text-[10.5px] font-medium uppercase tracking-wider mb-1.5" style={{ color: c.faint }}>
        {running ? "Running" : "Finished"}
      </div>
      <div className="rounded-xl p-3" style={{ backgroundColor: c.input, border: `1px solid ${c.border}` }}>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full flex-shrink-0"
            style={{
              width: 7,
              height: 7,
              backgroundColor: running ? c.accent : c.muted,
              boxShadow: running ? `0 0 0 3px ${c.accentSoft}` : "none",
            }}
          />
          <span className="text-[12.5px] font-medium" style={{ color: c.text, fontFamily: mono }}>hitman-base-review</span>
          <Zap size={11} color={c.faint} className="ml-auto" />
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[11px]" style={{ color: c.muted, fontFamily: mono }}>
          <span>{running ? "18s" : "8m 26s"}</span>
          <span>{running ? "4 agents" : "23 agents"}</span>
          <span>{running ? "206.2k tok" : "1.1M tok"}</span>
        </div>
        <div className="mt-3">
          <button
            onClick={() => setReviewOpen((o) => !o)}
            className="w-full flex items-center justify-between py-1.5 px-2 rounded-md"
            style={{ backgroundColor: c.chip }}
          >
            <span className="flex items-center gap-1.5 text-[11.5px]" style={{ color: c.text }}>
              {reviewOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />} Review
            </span>
            <Dots count={4} active={running ? 2 : 4} />
          </button>
          {reviewOpen && !running && (
            <div className="mt-2">
              <div className="grid grid-cols-4 gap-2 text-[10px] pb-1" style={{ color: c.faint }}>
                <span>Agent</span><span>Tokens</span><span>Tools</span><span>Time</span>
              </div>
              {agentRows.map((a) => (
                <div key={a.name} className="grid grid-cols-4 gap-2 text-[10.5px] py-1" style={{ color: c.muted, fontFamily: mono }}>
                  <span className="truncate">{a.name}</span><span>{a.tokens}</span><span>{a.tools}</span><span>{a.time}</span>
                </div>
              ))}
            </div>
          )}
          {!running && (
            <div className="flex items-center justify-between py-1.5 px-2 rounded-md mt-1.5" style={{ backgroundColor: c.chip }}>
              <span className="flex items-center gap-1.5 text-[11.5px]" style={{ color: c.text }}>
                <ChevronRight size={11} /> Verify
              </span>
              <Dots count={4} active={4} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= Context popup ================= */
const contextRows = [
  { label: "Messages", value: "254.1k", pct: "25.4%", shade: "#e8e8e8" },
  { label: "System tools", value: "17.2k", pct: "1.7%", shade: "#b0b0b0" },
  { label: "System prompt", value: "5.1k", pct: "0.5%", shade: "#8a8a8a" },
  { label: "MCP tools", value: "5.0k", pct: "0.5%", shade: "#6e6e6e" },
  { label: "Skills", value: "2.9k", pct: "0.3%", shade: "#565656" },
  { label: "Memory files", value: "436", pct: "0.0%", shade: "#3f3f3f" },
  { label: "Free space", value: "715.3k", pct: "71.5%", shade: "#242424" },
];

const planUsage = [
  { label: "5-hour limit", pct: 8, reset: "29m" },
  { label: "Weekly · all models", pct: 19, reset: "1d" },
  { label: "Opus only", pct: 4, reset: "1d" },
];

export function ContextWindowPopup({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute bottom-10 left-0 rounded-xl z-40 p-3 popIn"
      style={{
        width: 310,
        backgroundColor: "rgba(14,14,14,0.94)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: `1px solid ${c.borderStrong}`,
        boxShadow: c.shadowPop,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11.5px] font-medium" style={{ color: c.text }}>
          Context window <span style={{ color: c.muted, fontFamily: mono }}>284.0k / 1.0M</span>
        </span>
        <button onClick={onClose}><X size={12} color={c.faint} /></button>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden mb-2.5">
        {contextRows.map((r) => (
          <span key={r.label} style={{ width: r.pct, backgroundColor: r.shade }} />
        ))}
      </div>
      <div className="flex flex-col gap-1.5 mb-3">
        {contextRows.map((r) => (
          <div key={r.label} className="flex items-center gap-2 text-[11px]">
            <span className="rounded-sm flex-shrink-0" style={{ width: 8, height: 8, backgroundColor: r.shade }} />
            <span className="flex-1 truncate" style={{ color: c.muted }}>{r.label}</span>
            <span style={{ color: c.faint, fontFamily: mono }}>{r.value}</span>
            <span style={{ color: c.dim, width: 42, textAlign: "right", fontFamily: mono }}>{r.pct}</span>
          </div>
        ))}
      </div>
      <div className="text-[11.5px] font-medium mb-1.5" style={{ color: c.text }}>Plan usage</div>
      <div className="flex flex-col gap-2">
        {planUsage.map((p) => (
          <div key={p.label}>
            <div className="flex items-center justify-between text-[10.5px] mb-1" style={{ color: c.muted }}>
              <span>{p.label}</span>
              <span style={{ fontFamily: mono }}>{p.pct}% · resets {p.reset}</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: c.chip }}>
              <div className="h-full rounded-full" style={{ width: `${p.pct}%`, backgroundColor: c.accent }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= Panel shell ================= */
export default function RightPanel({ env, onClose }: { env: string; onClose: () => void }) {
  const gh = useGitHub();
  // Local starts as preview-only; connecting GitHub unlocks Changes + Database
  const tabs: readonly string[] =
    env === "local"
      ? gh.connected
        ? (["Preview", "Changes", "Database"] as const)
        : (["Preview"] as const)
      : (["Editor", "Preview", "Database", "Changes", "Tasks"] as const);
  const [tab, setTab] = useState<string>(tabs[0]);

  const activeTab = tabs.includes(tab as never) ? tab : tabs[0];

  const icons: Record<string, typeof Monitor> = {
    Editor: SquareCode,
    Preview: Monitor,
    Database: Database,
    Changes: FileDiff,
    Tasks: Zap,
  };

  return (
    <div
      className="workspacePanel flex flex-col h-full flex-shrink-0 min-w-0"
      style={{
        width: env === "local" ? (gh.connected ? 520 : 460) : 620,
        borderLeft: `1px solid ${c.border}`,
        backgroundColor: c.bgSubtle,
      }}
    >
      <div className="flex items-center gap-1 px-2.5 h-11 flex-shrink-0" style={{ borderBottom: `1px solid ${c.border}` }}>
        {tabs.map((t) => {
          const Icon = icons[t];
          const on = activeTab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11.5px] font-medium transition-colors"
              style={{
                backgroundColor: on ? c.chipHover : "transparent",
                color: on ? c.text : c.muted,
                border: `1px solid ${on ? c.border : "transparent"}`,
              }}
            >
              <Icon size={12} />
              {t}
              {t === "Changes" && (
                <span className="px-1 rounded text-[9.5px]" style={{ backgroundColor: c.chip, color: c.muted }}>
                  {diffFiles.length}
                </span>
              )}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-1">
          <button className="p-1.5 rounded-md" style={{ color: c.muted }}><RefreshCw size={12} /></button>
          <button onClick={onClose} className="p-1.5 rounded-md" style={{ color: c.muted }}><X size={13} /></button>
        </div>
      </div>

      <div
        className={`flex-1 min-h-0 ${
          activeTab === "Editor" || activeTab === "Database" ? "overflow-hidden" : "overflow-y-auto"
        }`}
      >
        {activeTab === "Preview" && <PreviewTab env={env} />}
        {activeTab === "Editor" && <CodeEditor />}
        {activeTab === "Database" && <DatabasePage />}
        {activeTab === "Changes" && <ChangesTab />}
        {activeTab === "Tasks" && <TasksTab />}
      </div>
    </div>
  );
}
