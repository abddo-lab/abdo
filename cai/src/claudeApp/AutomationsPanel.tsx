import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Copy,
  FileCode2,
  GitBranch,
  Loader2,
  Play,
  Plus,
  Search,
  Terminal,
  Trash2,
  Webhook,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { c, mono } from "./theme";
import {
  automationTemplates,
  automationsList,
  type Automation,
  type AutomationRun,
  type TriggerKind,
} from "./workData";

const triggerIcons: Record<TriggerKind, LucideIcon> = {
  schedule: Calendar,
  webhook: Webhook,
  event: Bell,
  manual: Play,
};

const triggerLabel: Record<TriggerKind, string> = {
  schedule: "Scheduled",
  webhook: "Webhook",
  event: "Event",
  manual: "Manual",
};

function fmtDur(ms: number) {
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function humanCron(cron: string): string {
  if (cron === "0 6 * * *") return "Every day at 06:00";
  if (cron === "*/30 * * * *") return "Every 30 minutes";
  if (cron === "0 3 * * 0") return "Sundays at 03:00";
  if (cron === "-") return "Triggered by an external event";
  return cron;
}

/* ------- history sparkline ------- */
function Sparkline({ history }: { history: AutomationRun[] }) {
  const items = history.slice(0, 20).reverse();
  const max = Math.max(...items.map((h) => h.ms), 1);
  return (
    <div className="flex items-end gap-[2px]" style={{ height: 22 }}>
      {items.map((h) => (
        <div
          key={h.id}
          title={`${h.at} · ${fmtDur(h.ms)}${h.ok ? "" : " · failed"}`}
          className="rounded-[1px] transition-colors"
          style={{
            width: 4,
            height: `${(h.ms / max) * 100}%`,
            minHeight: 3,
            backgroundColor: h.ok ? "#c8c8c8" : "#5e5e5e",
            opacity: h.ok ? 1 : 0.7,
          }}
        />
      ))}
      {items.length < 20 &&
        Array.from({ length: 20 - items.length }).map((_, i) => (
          <div key={`ph-${i}`} style={{ width: 4, height: 3, backgroundColor: "#1a1a1a", borderRadius: 1 }} />
        ))}
    </div>
  );
}

/* ------- toggle ------- */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
      className="relative rounded-full flex-shrink-0 transition-colors"
      style={{
        width: 30,
        height: 17,
        backgroundColor: on ? c.accent : c.chipHover,
        border: `1px solid ${on ? c.accent : c.border}`,
      }}
    >
      <span
        className="absolute rounded-full transition-all"
        style={{
          width: 13,
          height: 13,
          top: 1,
          left: on ? 14 : 1,
          backgroundColor: on ? "#000" : c.muted,
        }}
      />
    </button>
  );
}

/* ------- create automation modal ------- */
function CreateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (a: Automation) => void;
}) {
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<TriggerKind>("schedule");
  const [cron, setCron] = useState("0 6 * * *");
  const [prompt, setPrompt] = useState("Update dependencies and open a PR if the tests pass.");
  const [pick, setPick] = useState<string | null>(null);

  const pickTemplate = (id: string) => {
    const t = automationTemplates.find((x) => x.id === id);
    if (!t) return;
    setPick(id);
    setName(t.label);
    setTrigger(t.trigger);
    setPrompt(t.blurb);
  };

  const submit = () => {
    if (!name.trim()) return;
    const a: Automation = {
      id: `auto-${Date.now()}`,
      label: name.trim(),
      desc: prompt,
      trigger,
      schedule: trigger === "schedule" ? cron : trigger === "webhook" ? "on webhook" : trigger === "event" ? "on event" : "manual",
      cron: trigger === "schedule" ? cron : "-",
      last: "never",
      next: trigger === "schedule" ? "in 12h" : "waiting",
      enabled: true,
      model: "Sonnet 4.6",
      effort: "Medium",
      repo: "tailspin/links",
      branch: "claude/auto",
      steps: ["Read prompt", "Do the work", "Report back"],
      successRate: 1,
      avgMs: 60_000,
      runs30d: 0,
      cost30d: 0,
      history: [],
    };
    onCreate(a);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="popIn rounded-2xl overflow-hidden"
        style={{
          width: 560,
          maxWidth: "100%",
          backgroundColor: "rgba(12,12,12,0.98)",
          border: `1px solid ${c.borderStrong}`,
          boxShadow: c.shadowPop,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${c.border}` }}>
          <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: c.faint }}>
            New automation
          </div>
          <h2 className="text-[16px] font-semibold mt-0.5 tracking-tight" style={{ color: c.text }}>
            Give Claude a job to run on its own
          </h2>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* templates */}
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: c.faint }}>
              Start from a template
            </div>
            <div className="grid grid-cols-2 gap-2">
              {automationTemplates.map((t) => {
                const Icon = triggerIcons[t.trigger];
                const on = pick === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => pickTemplate(t.id)}
                    className="text-left rounded-xl p-2.5 transition-colors"
                    style={{
                      backgroundColor: on ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${on ? c.borderStrong : c.borderSoft}`,
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon size={11} color={c.muted} />
                      <span className="text-[12px] font-medium" style={{ color: c.text }}>
                        {t.label}
                      </span>
                    </div>
                    <div className="text-[10.5px] mt-1 leading-snug" style={{ color: c.muted }}>
                      {t.blurb}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider block mb-1.5" style={{ color: c.faint }}>
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekly security scan"
              className="w-full text-[13px] px-3 py-2 rounded-lg outline-none"
              style={{ backgroundColor: c.input, border: `1px solid ${c.border}`, color: c.text }}
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider block mb-1.5" style={{ color: c.faint }}>
              Trigger
            </label>
            <div
              className="flex gap-0.5 p-0.5 rounded-lg"
              style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}
            >
              {(["schedule", "webhook", "event", "manual"] as TriggerKind[]).map((t) => {
                const Icon = triggerIcons[t];
                return (
                  <button
                    key={t}
                    onClick={() => setTrigger(t)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11.5px] font-medium transition-colors"
                    style={{
                      backgroundColor: trigger === t ? c.chipHover : "transparent",
                      color: trigger === t ? c.text : c.muted,
                    }}
                  >
                    <Icon size={11} /> {triggerLabel[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {trigger === "schedule" && (
            <div>
              <label className="text-[10px] uppercase tracking-wider block mb-1.5" style={{ color: c.faint }}>
                Cron expression
              </label>
              <input
                value={cron}
                onChange={(e) => setCron(e.target.value)}
                className="w-full text-[13px] px-3 py-2 rounded-lg outline-none"
                style={{ backgroundColor: c.input, border: `1px solid ${c.border}`, color: c.text, fontFamily: mono }}
              />
              <div className="text-[10.5px] mt-1" style={{ color: c.dim }}>
                {humanCron(cron)}
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] uppercase tracking-wider block mb-1.5" style={{ color: c.faint }}>
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="w-full text-[13px] px-3 py-2 rounded-lg outline-none resize-none leading-relaxed"
              style={{ backgroundColor: c.input, border: `1px solid ${c.border}`, color: c.text }}
            />
          </div>
        </div>

        <div
          className="px-5 py-3 flex items-center justify-end gap-2"
          style={{ borderTop: `1px solid ${c.border}`, backgroundColor: "rgba(0,0,0,0.35)" }}
        >
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-[12px] transition-colors"
            style={{ color: c.muted }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chipHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
            style={{
              backgroundColor: name.trim() ? c.accent : c.chip,
              color: name.trim() ? "#000" : c.dim,
              border: `1px solid ${name.trim() ? c.accent : c.border}`,
              cursor: name.trim() ? "pointer" : "not-allowed",
            }}
          >
            Create automation
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------- automation detail drawer with interactive steps editor + live debugger ------- */
function DetailDrawer({
  a,
  onClose,
  onRun,
  onToggle,
  onDelete,
  onUpdateSteps,
  running,
}: {
  a: Automation;
  onClose: () => void;
  onRun: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onUpdateSteps: (steps: string[]) => void;
  running: boolean;
}) {
  const [runId, setRunId] = useState<string | null>(null);
  const run = a.history.find((r) => r.id === runId) ?? a.history[0];
  const TIcon = triggerIcons[a.trigger];

  // Steps Editor State
  const [newStep, setNewStep] = useState("");
  // Environment Options State
  const [nodeEnv, setNodeEnv] = useState("Node 22");
  const [vpcEnv, setVpcEnv] = useState("VPC Public");

  // Simulated live log streaming state
  const [liveLogs, setLiveLogs] = useState<string[]>([]);

  // Sync runId selection
  useEffect(() => {
    if (a.history.length > 0 && !runId) {
      setRunId(a.history[0].id);
    }
  }, [a.history, runId]);

  // If a new run starts, stream logs into the preview panel dynamically!
  useEffect(() => {
    if (running) {
      setLiveLogs(["> Booting secure sandbox environment..."]);
      const simulatedSteps = [
        "> Pulling repository tailspin/links...",
        "> Context size: 148 files scanned cleanly.",
        `> Running automation prompt with model: ${a.model}`,
        `> Reasoning budget: ${a.effort} effort active.`,
        "> Running test suite...",
        "✓ 34 unit tests passed successfully.",
        "> Sync complete. Reporting final status...",
      ];

      simulatedSteps.forEach((logLine, index) => {
        setTimeout(() => {
          setLiveLogs((prev) => [...prev, logLine]);
          if (index === simulatedSteps.length - 1) {
            setLiveLogs((prev) => [...prev, "✓ Done. Logs recorded cleanly."]);
          }
        }, 500 + index * 400);
      });
    }
  }, [running, a.model, a.effort]);

  const addStep = () => {
    if (!newStep.trim()) return;
    onUpdateSteps([...a.steps, newStep.trim()]);
    setNewStep("");
  };

  const removeStep = (index: number) => {
    onUpdateSteps(a.steps.filter((_, i) => i !== index));
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="h-full overflow-y-auto"
        style={{
          width: 580,
          maxWidth: "100%",
          backgroundColor: c.bg,
          borderLeft: `1px solid ${c.borderStrong}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${c.border}` }}>
          <div className="flex items-start gap-3">
            <span
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: c.chip, border: `1px solid ${c.border}` }}
            >
              <TIcon size={14} color={c.text} />
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="text-[17px] font-semibold tracking-tight" style={{ color: c.text }}>
                {a.label}
              </h2>
              <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: c.muted }}>
                {a.desc}
              </p>
            </div>
            <Toggle on={a.enabled} onChange={onToggle} />
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={onRun}
              disabled={running || !a.enabled}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
              style={{
                backgroundColor: a.enabled ? c.accent : c.chip,
                color: a.enabled ? "#000" : c.dim,
                border: `1px solid ${a.enabled ? c.accent : c.border}`,
                cursor: a.enabled && !running ? "pointer" : "not-allowed",
                opacity: running ? 0.7 : 1,
              }}
            >
              {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {running ? "Running…" : "Run now"}
            </button>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] transition-colors"
              style={{ backgroundColor: "transparent", border: `1px solid ${c.border}`, color: c.muted }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chipHover)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <Copy size={11} /> Duplicate
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] ml-auto transition-colors"
              style={{ backgroundColor: "transparent", border: `1px solid ${c.border}`, color: c.muted }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#e4e4e4")}
              onMouseLeave={(e) => (e.currentTarget.style.color = c.muted)}
            >
              <Trash2 size={11} /> Delete
            </button>
          </div>
        </div>

        {/* config grid */}
        <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[11.5px]" style={{ borderBottom: `1px solid ${c.borderSoft}` }}>
          <div>
            <div className="text-[9.5px] uppercase tracking-wider mb-1" style={{ color: c.faint }}>Trigger</div>
            <div className="flex items-center gap-1.5" style={{ color: c.text }}>
              <TIcon size={11} color={c.muted} /> {triggerLabel[a.trigger]}
            </div>
            <div className="text-[10.5px] mt-0.5" style={{ color: c.dim, fontFamily: mono }}>{humanCron(a.cron)}</div>
          </div>
          <div>
            <div className="text-[9.5px] uppercase tracking-wider mb-1" style={{ color: c.faint }}>Model</div>
            <div style={{ color: c.text }}>{a.model}</div>
            <div className="text-[10.5px] mt-0.5" style={{ color: c.dim, fontFamily: mono }}>{a.effort.toLowerCase()} effort</div>
          </div>
          <div>
            <div className="text-[9.5px] uppercase tracking-wider mb-1" style={{ color: c.faint }}>Repository</div>
            <div className="flex items-center gap-1.5" style={{ color: c.text, fontFamily: mono }}>
              <GitBranch size={11} color={c.muted} /> {a.repo}
            </div>
            <div className="text-[10.5px] mt-0.5" style={{ color: c.dim, fontFamily: mono }}>{a.branch}</div>
          </div>
          <div>
            <div className="text-[9.5px] uppercase tracking-wider mb-1" style={{ color: c.faint }}>Health</div>
            <div style={{ color: c.text }}>{Math.round(a.successRate * 100)}% success · last 20 runs</div>
            <div className="text-[10.5px] mt-0.5" style={{ color: c.dim, fontFamily: mono }}>avg {fmtDur(a.avgMs)}</div>
          </div>
        </div>

        {/* VPC / Environment configuration parameters */}
        <div className="px-5 py-3 text-[11.5px]" style={{ borderBottom: `1px solid ${c.borderSoft}` }}>
          <div className="text-[9.5px] uppercase tracking-wider mb-2" style={{ color: c.faint }}>Sandbox Environment Config</div>
          <div className="flex gap-4">
            <div className="flex-1">
              <span className="block text-[10px] mb-1" style={{ color: c.dim }}>Node runtime</span>
              <div className="flex gap-1 p-0.5 rounded-lg" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}>
                {["Node 22", "Node 20"].map((n) => (
                  <button
                    key={n}
                    onClick={() => setNodeEnv(n)}
                    className="flex-1 py-1 rounded text-[10.5px] transition-all"
                    style={{
                      backgroundColor: nodeEnv === n ? c.chipHover : "transparent",
                      color: nodeEnv === n ? c.text : c.dim,
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <span className="block text-[10px] mb-1" style={{ color: c.dim }}>Network Access</span>
              <div className="flex gap-1 p-0.5 rounded-lg" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}>
                {["VPC Public", "VPC Private"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setVpcEnv(v)}
                    className="flex-1 py-1 rounded text-[10.5px] transition-all"
                    style={{
                      backgroundColor: vpcEnv === v ? c.chipHover : "transparent",
                      color: vpcEnv === v ? c.text : c.dim,
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* steps with dynamic editor */}
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${c.borderSoft}` }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: c.faint }}>
              Steps Editor
            </div>
            <span className="text-[10.5px]" style={{ color: c.dim }}>
              {a.steps.length} steps configured
            </span>
          </div>

          <div className="space-y-1.5 mb-3">
            {a.steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <span
                  className="rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 18,
                    height: 18,
                    backgroundColor: c.chip,
                    border: `1px solid ${c.borderSoft}`,
                    color: c.text,
                    fontFamily: mono,
                    fontSize: 9.5,
                  }}
                >
                  {i + 1}
                </span>
                <span className="flex-1 text-[12px]" style={{ color: c.muted }}>{s}</span>
                <button
                  onClick={() => removeStep(i)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-[11px] rounded transition-all hover:bg-white/[0.04]"
                  style={{ color: c.dim }}
                  title="Remove step"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>

          {/* Add custom step */}
          <div className="flex gap-2">
            <input
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              placeholder="Add a new custom task step..."
              className="flex-1 text-[12px] px-2.5 py-1.5 rounded-lg outline-none"
              style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}`, color: c.text }}
            />
            <button
              onClick={addStep}
              disabled={!newStep.trim()}
              className="px-3 rounded-lg text-[11px] font-medium transition-all"
              style={{
                backgroundColor: newStep.trim() ? c.chipHover : c.chip,
                border: `1px solid ${c.border}`,
                color: newStep.trim() ? c.text : c.dim,
              }}
            >
              Add step
            </button>
          </div>
        </div>

        {/* runs */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: c.faint }}>
              Recent runs
            </div>
            <span className="text-[10.5px]" style={{ color: c.dim, fontFamily: mono }}>
              {a.runs30d} runs · ${a.cost30d.toFixed(2)} in 30d
            </span>
          </div>

          {/* live stream debugging preview if currently running! */}
          {running ? (
            <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: c.panel, border: `1.5px solid ${c.accent}` }}>
              <div className="flex items-center gap-2 mb-2">
                <Loader2 size={12} className="animate-spin" color={c.accent} />
                <span className="text-[12px] font-medium" style={{ color: c.text }}>
                  Stream debugging - Rule: {a.label}
                </span>
              </div>
              <div
                className="rounded-lg p-2.5 text-[11px] leading-5 max-h-48 overflow-y-auto"
                style={{ backgroundColor: "#020202", border: `1px solid ${c.borderSoft}`, fontFamily: mono, color: c.muted }}
              >
                {liveLogs.map((l, i) => (
                  <div key={i} style={{ color: l.startsWith(">") ? c.text : l.startsWith("✓") ? c.accent : c.muted }}>
                    {l}
                  </div>
                ))}
                <div className="blink mt-1 text-[10.5px]" style={{ color: c.accent }}>▌</div>
              </div>
            </div>
          ) : null}

          {a.history.length === 0 && !running ? (
            <div className="text-[12px] py-6 text-center" style={{ color: c.dim }}>
              No runs yet.
            </div>
          ) : (
            <div className="grid grid-cols-[168px_1fr] gap-3">
              <div className="flex flex-col gap-1">
                {a.history.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRunId(r.id)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[11.5px] transition-colors"
                    style={{
                      backgroundColor: runId === r.id ? c.chipHover : "transparent",
                      color: runId === r.id ? r.ok ? c.text : "#c0c0c0" : c.muted,
                    }}
                    onMouseEnter={(e) => runId !== r.id && (e.currentTarget.style.backgroundColor = c.sidebarHover)}
                    onMouseLeave={(e) => runId !== r.id && (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    {r.ok ? (
                      <CheckCircle2 size={11} color={c.muted} />
                    ) : (
                      <AlertCircle size={11} color="#c0c0c0" />
                    )}
                    <span className="flex-1 truncate" style={{ fontFamily: mono }}>{r.at}</span>
                    <span style={{ color: c.dim, fontFamily: mono, fontSize: 10 }}>{fmtDur(r.ms)}</span>
                  </button>
                ))}
              </div>
              {run && !running && (
                <div
                  className="rounded-xl p-3"
                  style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {run.ok ? (
                      <CheckCircle2 size={12} color={c.text} />
                    ) : (
                      <AlertCircle size={12} color="#e0e0e0" />
                    )}
                    <span className="text-[12px] font-medium" style={{ color: c.text }}>
                      {run.summary}
                    </span>
                  </div>
                  <div
                    className="rounded-lg p-2.5 text-[11px] leading-5 max-h-40 overflow-y-auto"
                    style={{ backgroundColor: c.codeBg, border: `1px solid ${c.borderSoft}`, fontFamily: mono, color: c.muted }}
                  >
                    {run.logs.map((l, i) => (
                      <div key={i} style={{ color: l.startsWith(">") ? c.text : l.startsWith("✓") ? c.text : c.muted }}>
                        {l}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------- row card ------- */
function AutomationCard({
  a,
  running,
  onOpen,
  onToggle,
  onRun,
}: {
  a: Automation;
  running: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onRun: () => void;
}) {
  const TIcon = triggerIcons[a.trigger];
  const successPct = Math.round(a.successRate * 100);

  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-xl p-3.5 transition-all group"
      style={{
        backgroundColor: c.panel,
        border: `1px solid ${a.enabled ? c.borderSoft : c.borderSoft}`,
        opacity: a.enabled ? 1 : 0.68,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = c.borderStrong)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = c.borderSoft)}
    >
      <div className="flex items-start gap-3">
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: a.enabled ? c.chipHover : c.chip,
            border: `1px solid ${c.border}`,
          }}
        >
          <TIcon size={14} color={a.enabled ? c.text : c.faint} />
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] font-semibold tracking-tight" style={{ color: c.text }}>
              {a.label}
            </span>
            {running && (
              <span
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px]"
                style={{ backgroundColor: "rgba(255,255,255,0.09)", color: c.text }}
              >
                <Loader2 size={9} className="animate-spin" /> running
              </span>
            )}
          </div>
          <div className="text-[11.5px] mt-0.5 leading-snug" style={{ color: c.muted }}>
            {a.desc}
          </div>

          <div className="flex items-center gap-3 mt-2 text-[10.5px]" style={{ color: c.dim, fontFamily: mono }}>
            <span className="flex items-center gap-1"><Calendar size={9} /> {a.schedule}</span>
            <span>·</span>
            <span className="flex items-center gap-1"><FileCode2 size={9} /> {a.repo}</span>
            <span>·</span>
            <span>{a.model.toLowerCase()}</span>
            <span>·</span>
            <span>{a.effort.toLowerCase()} effort</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <Toggle on={a.enabled} onChange={onToggle} />
          <ChevronRight size={13} color={c.faint} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* stats strip */}
      <div
        className="mt-3 pt-3 grid grid-cols-4 gap-3"
        style={{ borderTop: `1px solid ${c.borderSoft}` }}
      >
        <div>
          <div className="text-[9.5px] uppercase tracking-wider mb-1" style={{ color: c.faint }}>Success</div>
          <div className="text-[13px] font-semibold" style={{ color: c.text }}>{successPct}%</div>
        </div>
        <div>
          <div className="text-[9.5px] uppercase tracking-wider mb-1" style={{ color: c.faint }}>Avg time</div>
          <div className="text-[13px] font-semibold" style={{ color: c.text, fontFamily: mono }}>{fmtDur(a.avgMs)}</div>
        </div>
        <div>
          <div className="text-[9.5px] uppercase tracking-wider mb-1" style={{ color: c.faint }}>30d cost</div>
          <div className="text-[13px] font-semibold" style={{ color: c.text, fontFamily: mono }}>${a.cost30d.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[9.5px] uppercase tracking-wider mb-1" style={{ color: c.faint }}>Runs</div>
          <div className="flex items-center gap-2">
            <Sparkline history={a.history} />
          </div>
        </div>
      </div>

      {/* action bar */}
      <div className="mt-3 flex items-center gap-2">
        <span
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: a.enabled ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
            color: a.enabled ? c.text : c.faint,
            fontFamily: mono,
          }}
        >
          last {a.last}
        </span>
        {a.enabled && (
          <span className="text-[10px]" style={{ color: c.dim, fontFamily: mono }}>
            next {a.next}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRun();
          }}
          disabled={running || !a.enabled}
          className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-colors"
          style={{
            backgroundColor: "transparent",
            border: `1px solid ${c.border}`,
            color: a.enabled && !running ? c.text : c.dim,
          }}
          onMouseEnter={(e) => a.enabled && !running && (e.currentTarget.style.backgroundColor = c.chipHover)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          {running ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
          Run now
        </button>
      </div>
    </button>
  );
}

/* ------- main panel ------- */
type Filter = "all" | "active" | "paused" | "failing";

export default function AutomationsPanel() {
  const [list, setList] = useState<Automation[]>(automationsList);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const filtered = useMemo(() => {
    return list.filter((a) => {
      const failing = a.successRate < 0.9;
      if (filter === "active" && !a.enabled) return false;
      if (filter === "paused" && a.enabled) return false;
      if (filter === "failing" && !failing) return false;
      const q = query.trim().toLowerCase();
      if (q && !`${a.label} ${a.desc} ${a.repo}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [list, filter, query]);

  const counts = useMemo(
    () => ({
      all: list.length,
      active: list.filter((a) => a.enabled).length,
      paused: list.filter((a) => !a.enabled).length,
      failing: list.filter((a) => a.successRate < 0.9).length,
    }),
    [list]
  );

  const totals = useMemo(
    () => ({
      runs30: list.reduce((s, a) => s + a.runs30d, 0),
      cost30: list.reduce((s, a) => s + a.cost30d, 0),
      avgSuccess: list.length ? list.reduce((s, a) => s + a.successRate, 0) / list.length : 0,
      nextEnabled: list.filter((a) => a.enabled).length,
    }),
    [list]
  );

  const update = (id: string, fn: (a: Automation) => Automation) =>
    setList((prev) => prev.map((x) => (x.id === id ? fn(x) : x)));

  const runNow = (id: string) => {
    setRunningIds((prev) => new Set(prev).add(id));
    const dur = 2200 + Math.random() * 1400;
    timers.current.push(
      window.setTimeout(() => {
        setRunningIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        const now = new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        update(id, (a) => ({
          ...a,
          last: "just now",
          runs30d: a.runs30d + 1,
          history: [
            {
              id: `manual-${Date.now()}`,
              at: now,
              ok: true,
              ms: Math.round(dur * 20),
              summary: "Manual trigger · completed successfully",
              logs: [
                "> manual trigger by christina@tailspin.dev",
                `> loaded automation "${a.label}"`,
                "> executed all steps",
                "✓ finished cleanly",
              ],
            },
            ...a.history,
          ].slice(0, 20),
        }));
      }, dur)
    );
  };

  const remove = (id: string) => {
    setList((prev) => prev.filter((a) => a.id !== id));
    setOpenId(null);
  };

  const open = openId ? list.find((a) => a.id === openId) : null;

  return (
    <div className="flex-1 h-full overflow-y-auto" style={{ backgroundColor: c.bg }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* header */}
        <div className="flex items-start gap-3 mb-5 flex-wrap">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight" style={{ color: c.text }}>
              Automations
            </h1>
            <p className="text-[12px]" style={{ color: c.muted }}>
              Give Claude standing orders. Cron, webhooks, and events all wake it up.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
            style={{ backgroundColor: c.accent, color: "#000", border: `1px solid ${c.accent}` }}
          >
            <Plus size={13} /> New automation
          </button>
        </div>

        {/* summary strip */}
        <div className="grid kpiGrid gap-2.5 mb-5">
          {[
            { icon: Zap, label: "Enabled", value: `${totals.nextEnabled}`, sub: `of ${list.length} total` },
            { icon: Play, label: "Runs · 30d", value: `${totals.runs30}`, sub: "across all rules" },
            { icon: Terminal, label: "Cost · 30d", value: `$${totals.cost30.toFixed(2)}`, sub: `avg $${(totals.cost30 / Math.max(1, totals.runs30)).toFixed(2)}/run` },
            { icon: CheckCircle2, label: "Success", value: `${Math.round(totals.avgSuccess * 100)}%`, sub: "over last 20 runs" },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-xl p-3"
              style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}
            >
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider" style={{ color: c.faint }}>
                <k.icon size={11} /> {k.label}
              </div>
              <div className="text-[19px] font-semibold mt-1 tracking-tight" style={{ color: c.text }}>
                {k.value}
              </div>
              <div className="text-[10.5px] mt-0.5" style={{ color: c.dim, fontFamily: mono }}>
                {k.sub}
              </div>
            </div>
          ))}
        </div>

        {/* filter + search */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="flex gap-0.5 p-0.5 rounded-lg"
            style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}
          >
            {(["all", "active", "paused", "failing"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium capitalize transition-colors"
                style={{
                  backgroundColor: filter === f ? c.chipHover : "transparent",
                  color: filter === f ? c.text : c.muted,
                }}
              >
                {f}
                <span
                  className="px-1 rounded text-[9.5px]"
                  style={{ backgroundColor: filter === f ? c.input : "transparent", color: c.faint }}
                >
                  {counts[f]}
                </span>
              </button>
            ))}
          </div>
          <div
            className="ml-auto flex items-center gap-1.5 px-2 rounded-lg"
            style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}`, width: 220 }}
          >
            <Search size={11} color={c.dim} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search automations"
              className="w-full text-[12px] py-1.5 bg-transparent outline-none"
              style={{ color: c.text }}
            />
          </div>
        </div>

        {/* cards */}
        <div className="flex flex-col gap-2.5 mb-6">
          {filtered.map((a) => (
            <AutomationCard
              key={a.id}
              a={a}
              running={runningIds.has(a.id)}
              onOpen={() => setOpenId(a.id)}
              onToggle={() => update(a.id, (x) => ({ ...x, enabled: !x.enabled }))}
              onRun={() => runNow(a.id)}
            />
          ))}

          {filtered.length === 0 && (
            <div
              className="rounded-xl py-12 text-center text-[12.5px]"
              style={{ backgroundColor: c.panel, border: `1px dashed ${c.border}`, color: c.dim }}
            >
              <Zap size={20} className="mx-auto mb-2" />
              No automations match those filters.
            </div>
          )}
        </div>
      </div>

      {open && (
        <DetailDrawer
          a={open}
          running={runningIds.has(open.id)}
          onClose={() => setOpenId(null)}
          onRun={() => runNow(open.id)}
          onToggle={() => update(open.id, (x) => ({ ...x, enabled: !x.enabled }))}
          onDelete={() => remove(open.id)}
          onUpdateSteps={(steps) => update(open.id, (x) => ({ ...x, steps }))}
        />
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={(a) => {
            setList((prev) => [a, ...prev]);
            setShowCreate(false);
            setOpenId(a.id);
          }}
        />
      )}
    </div>
  );
}
