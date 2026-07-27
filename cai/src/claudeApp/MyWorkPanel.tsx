import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock,
  GitMerge,
  GitPullRequest,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  RotateCw,
  Zap,
} from "lucide-react";
import { c, mono } from "./theme";
import {
  automationsList,
  workItems,
  type Automation,
  type CheckState,
  type WorkItem,
} from "./workData";
import { envIcons } from "./Dropdowns";

const TABS = ["Open", "Reviews", "Automations", "Merged"] as const;
type Tab = (typeof TABS)[number];

function checkColor(s: CheckState) {
  return s === "passed" ? c.text : s === "failed" ? "#e0e0e0" : s === "running" ? c.muted : c.dim;
}

function CheckPill({ chk }: { chk: { name: string; state: CheckState; ms: number } }) {
  const Icon =
    chk.state === "passed"
      ? CheckCircle2
      : chk.state === "failed"
      ? AlertCircle
      : chk.state === "running"
      ? Loader2
      : Clock;
  return (
    <span
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10.5px]"
      style={{
        backgroundColor: c.chip,
        border: `1px solid ${chk.state === "failed" ? "#4a2020" : c.borderSoft}`,
        color: checkColor(chk.state),
        fontFamily: mono,
      }}
    >
      <Icon size={10} className={chk.state === "running" ? "animate-spin" : ""} />
      {chk.name}
      {chk.ms > 0 && <span style={{ color: c.dim }}>{(chk.ms / 1000).toFixed(0)}s</span>}
    </span>
  );
}

function StateBadge({ state }: { state: WorkItem["state"] }) {
  const map: Record<WorkItem["state"], { label: string; bg: string; fg: string }> = {
    open: { label: "Open", bg: "rgba(255,255,255,0.08)", fg: "#ededed" },
    merged: { label: "Merged", bg: "rgba(255,255,255,0.14)", fg: "#ffffff" },
    draft: { label: "Draft", bg: "rgba(255,255,255,0.04)", fg: "#8a8a8a" },
    changes: { label: "Changes requested", bg: "rgba(255,255,255,0.05)", fg: "#b0b0b0" },
  };
  const s = map[state];
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[9.5px] font-medium flex-shrink-0"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

/* ---------------- work item row ---------------- */
function ItemRow({
  item,
  onUpdate,
  onOpen,
}: {
  item: WorkItem;
  onUpdate: (fn: (w: WorkItem) => WorkItem) => void;
  onOpen: (label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const EnvIcon = envIcons[item.env];
  const allPassed = item.checks.length > 0 && item.checks.every((k) => k.state === "passed");
  const anyRunning = item.checks.some((k) => k.state === "running");

  const rerun = () => {
    setBusy("checks");
    onUpdate((w) => ({ ...w, checks: w.checks.map((k) => ({ ...k, state: "queued" as CheckState, ms: 0 })) }));
    item.checks.forEach((_chk, i) => {
      timers.current.push(
        window.setTimeout(() => {
          onUpdate((w) => ({
            ...w,
            checks: w.checks.map((k, j) => (j === i ? { ...k, state: "running" as CheckState } : k)),
          }));
        }, 300 + i * 400)
      );
      timers.current.push(
        window.setTimeout(() => {
          onUpdate((w) => ({
            ...w,
            checks: w.checks.map((k, j) =>
              j === i ? { ...k, state: "passed" as CheckState, ms: 3000 + i * 7000 } : k
            ),
          }));
          if (i === item.checks.length - 1) setBusy(null);
        }, 1400 + i * 900)
      );
    });
  };

  const merge = () => {
    setBusy("merge");
    timers.current.push(
      window.setTimeout(() => {
        onUpdate((w) => ({ ...w, state: "merged", updated: "just now" }));
        setBusy(null);
      }, 1200)
    );
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors"
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.sidebarHover)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <span className="mt-0.5">
          {open ? <ChevronDown size={13} color={c.faint} /> : <ChevronRight size={13} color={c.faint} />}
        </span>
        {item.state === "merged" ? (
          <GitMerge size={14} color={c.text} className="mt-0.5 flex-shrink-0" />
        ) : item.kind === "review" ? (
          <CircleDot size={14} color={c.muted} className="mt-0.5 flex-shrink-0 animate-pulse" />
        ) : (
          <GitPullRequest size={14} color={c.muted} className="mt-0.5 flex-shrink-0" />
        )}

        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-[13px] font-medium truncate" style={{ color: c.text }}>
              {item.title}
            </span>
            <StateBadge state={item.state} />
          </span>
          <span className="flex items-center gap-2 mt-1 text-[10.5px]" style={{ color: c.dim, fontFamily: mono }}>
            <EnvIcon size={10} />
            <span>{item.repo}</span>
            <span>·</span>
            <span className="truncate">{item.branch}</span>
            <span>·</span>
            <span style={{ color: c.muted }}>+{item.add}</span>
            <span>−{item.del}</span>
            {item.comments > 0 && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <MessageSquare size={9} /> {item.comments}
                </span>
              </>
            )}
          </span>
        </span>

        <span className="text-[10px] flex-shrink-0 mt-0.5" style={{ color: c.dim }}>
          {item.updated}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1" style={{ borderTop: `1px solid ${c.borderSoft}` }}>
          {item.checks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3 mt-2">
              {item.checks.map((chk) => (
                <CheckPill key={chk.name} chk={chk} />
              ))}
            </div>
          )}

          {item.reviewers.length > 0 && (
            <div className="flex items-center gap-2 mb-3 text-[11px]" style={{ color: c.muted }}>
              <span style={{ color: c.faint }}>Reviewers</span>
              {item.reviewers.map((r) => (
                <span
                  key={r}
                  className="px-1.5 py-0.5 rounded text-[10px]"
                  style={{ backgroundColor: c.chip, color: c.muted, fontFamily: mono }}
                >
                  {r}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onOpen(item.title)}
              className="px-2.5 py-1 rounded-lg text-[11.5px] font-medium transition-colors"
              style={{ backgroundColor: c.chip, border: `1px solid ${c.border}`, color: c.text }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chipHover)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = c.chip)}
            >
              Open thread
            </button>

            {item.checks.length > 0 && (
              <button
                onClick={rerun}
                disabled={busy === "checks" || anyRunning}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] transition-colors"
                style={{
                  backgroundColor: "transparent",
                  border: `1px solid ${c.border}`,
                  color: busy === "checks" ? c.dim : c.muted,
                }}
              >
                <RotateCw size={11} className={busy === "checks" ? "animate-spin" : ""} /> Re-run checks
              </button>
            )}

            {item.state !== "merged" && item.kind === "pr" && (
              <button
                onClick={merge}
                disabled={!allPassed || busy === "merge"}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-medium ml-auto transition-all"
                style={{
                  backgroundColor: allPassed ? c.accent : c.chip,
                  border: `1px solid ${allPassed ? c.accent : c.border}`,
                  color: allPassed ? "#000" : c.dim,
                  cursor: allPassed ? "pointer" : "not-allowed",
                }}
                title={allPassed ? "Squash and merge" : "Checks must pass first"}
              >
                {busy === "merge" ? <Loader2 size={11} className="animate-spin" /> : <GitMerge size={11} />}
                {busy === "merge" ? "Merging…" : "Squash & merge"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- automations ---------------- */
function AutomationRow({
  a,
  onUpdate,
}: {
  a: Automation;
  onUpdate: (fn: (x: Automation) => Automation) => void;
}) {
  const [running, setRunning] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const runNow = () => {
    setRunning(true);
    timer.current = window.setTimeout(() => {
      setRunning(false);
      onUpdate((x) => ({
        ...x,
        last: "just now",
        history: [
          {
            id: `manual-${Date.now()}`,
            at: "just now",
            ok: true,
            ms: 74_000,
            summary: "Manual run · completed",
            logs: ["> triggered by user", "> completed successfully"],
          },
          ...x.history,
        ].slice(0, 5),
      }));
    }, 2200);
  };

  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
      <div className="flex items-center gap-2.5">
        <Zap size={13} color={a.enabled ? c.text : c.dim} className="flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium truncate" style={{ color: a.enabled ? c.text : c.faint }}>
            {a.label}
          </div>
          <div className="text-[10.5px] mt-0.5" style={{ color: c.dim, fontFamily: mono }}>
            {a.cron} · last {a.last} · next {a.enabled ? a.next : "paused"}
          </div>
        </div>

        <button
          onClick={runNow}
          disabled={running || !a.enabled}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors flex-shrink-0"
          style={{ backgroundColor: c.chip, border: `1px solid ${c.border}`, color: a.enabled ? c.text : c.dim }}
        >
          {running ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
          {running ? "Running" : "Run now"}
        </button>

        <button
          onClick={() => onUpdate((x) => ({ ...x, enabled: !x.enabled }))}
          className="relative rounded-full flex-shrink-0 transition-colors"
          style={{
            width: 30,
            height: 17,
            backgroundColor: a.enabled ? c.accent : c.chipHover,
            border: `1px solid ${a.enabled ? c.accent : c.border}`,
          }}
          title={a.enabled ? "Disable" : "Enable"}
        >
          <span
            className="absolute rounded-full transition-all"
            style={{
              width: 13,
              height: 13,
              top: 1,
              left: a.enabled ? 14 : 1,
              backgroundColor: a.enabled ? "#000" : c.muted,
            }}
          />
        </button>
      </div>

      <div className="mt-2.5 pl-6 flex flex-col gap-1">
        {a.history.slice(0, 3).map((h, i) => (
          <div key={i} className="flex items-center gap-2 text-[10px]" style={{ color: c.dim, fontFamily: mono }}>
            {h.ok ? <CheckCircle2 size={9} color={c.muted} /> : <AlertCircle size={9} color="#b0b0b0" />}
            <span>{h.at}</span>
            <span className="ml-auto">{(h.ms / 1000).toFixed(0)}s</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- panel ---------------- */
export default function MyWorkPanel({ onOpenThread }: { onOpenThread: (label: string) => void }) {
  const [tab, setTab] = useState<Tab>("Open");
  const [items, setItems] = useState<WorkItem[]>(workItems);
  const [autos, setAutos] = useState<Automation[]>(automationsList);

  /* live simulation: running checks tick toward completion */
  useEffect(() => {
    const id = window.setInterval(() => {
      setItems((prev) =>
        prev.map((it) => {
          if (!it.checks.some((k) => k.state === "running")) return it;
          return {
            ...it,
            checks: it.checks.map((k) =>
              k.state === "running" ? { ...k, ms: k.ms + 1000 } : k
            ),
          };
        })
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const update = (id: string, fn: (w: WorkItem) => WorkItem) =>
    setItems((prev) => prev.map((w) => (w.id === id ? fn(w) : w)));

  const updateAuto = (id: string, fn: (a: Automation) => Automation) =>
    setAutos((prev) => prev.map((a) => (a.id === id ? fn(a) : a)));

  const filtered = items.filter((i) => {
    if (tab === "Open") return i.state !== "merged" && i.kind !== "review";
    if (tab === "Reviews") return i.kind === "review" || i.state === "changes";
    if (tab === "Merged") return i.state === "merged";
    return false;
  });

  const counts = {
    Open: items.filter((i) => i.state !== "merged" && i.kind !== "review").length,
    Reviews: items.filter((i) => i.kind === "review" || i.state === "changes").length,
    Automations: autos.filter((a) => a.enabled).length,
    Merged: items.filter((i) => i.state === "merged").length,
  };

  const running = items.filter((i) => i.checks.some((k) => k.state === "running")).length;

  return (
    <div className="flex-1 h-full overflow-y-auto" style={{ backgroundColor: c.bg }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-end gap-3 mb-4">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight" style={{ color: c.text }}>
              My work
            </h1>
            <p className="text-[12px]" style={{ color: c.muted }}>
              Everything Caret has in flight across your repos.
            </p>
          </div>
          {running > 0 && (
            <span
              className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px]"
              style={{ backgroundColor: c.chip, border: `1px solid ${c.border}`, color: c.muted }}
            >
              <Loader2 size={11} className="animate-spin" />
              {running} running
            </span>
          )}
        </div>

        <div
          className="flex gap-0.5 p-0.5 rounded-lg mb-4"
          style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}
        >
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11.5px] font-medium transition-colors"
              style={{ backgroundColor: tab === t ? c.chipHover : "transparent", color: tab === t ? c.text : c.muted }}
            >
              {t}
              <span
                className="px-1 rounded text-[9.5px]"
                style={{ backgroundColor: tab === t ? c.input : "transparent", color: c.faint }}
              >
                {counts[t]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {tab === "Automations"
            ? autos.map((a) => <AutomationRow key={a.id} a={a} onUpdate={(fn) => updateAuto(a.id, fn)} />)
            : filtered.map((it) => (
                <ItemRow key={it.id} item={it} onUpdate={(fn) => update(it.id, fn)} onOpen={onOpenThread} />
              ))}

          {tab !== "Automations" && filtered.length === 0 && (
            <div
              className="rounded-xl py-10 text-center text-[12.5px]"
              style={{ backgroundColor: c.panel, border: `1px dashed ${c.border}`, color: c.dim }}
            >
              <Pause size={18} className="mx-auto mb-2" />
              Nothing here yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
