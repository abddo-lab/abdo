import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { Icon } from "../icons";
import { highlight } from "../highlight";
import { slashCommands, type Block, type DiffFile, type Project, type Thread } from "../data";
import { useMCP } from "../store";
import { groupModels } from "../modelGroups";
import { Badge, Btn, IconBtn, RichText, Spinner } from "./ui";
import { threads as threadsApi } from "../api";

interface Props {
  thread: Thread;
  project: Project;
  allProjects: Project[];
  files: DiffFile[];
  working: boolean;
  activeTool: string | null;
  mode: "agent" | "plan" | "ask";
  model: string;
  models: any[];
  onMode: (m: "agent" | "plan" | "ask") => void;
  onModel: (modelId: string) => void;
  onSend: (t: string) => void;
  onParallel: (goal: string, breakdown: { name: string; task: string }[]) => void;
  onStop: () => void;
  onCommit: () => void;
  onPR: () => void;
  onOpenTab: (t: "preview" | "changes" | "editor") => void;
  onDesign: () => void;
  onClear: () => void;
  onSwitchProject: (id: string) => void;
  onNewProject: () => void;
}

function parseMentions(text: string): Array<{ kind: "workflow" | "mcp"; value: string; label: string; raw: string }> {
  const mentions: Array<{ kind: "workflow" | "mcp"; value: string; label: string; raw: string }> = [];
  const workflowRegex = /#kiren-workflow:([a-zA-Z0-9_-]+)/g;
  const mcpRegex = /#mcp:([a-zA-Z0-9_-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = workflowRegex.exec(text)) !== null) {
    mentions.push({ kind: "workflow", value: match[1], label: `Workflow ${match[1]}`, raw: match[0] });
  }
  while ((match = mcpRegex.exec(text)) !== null) {
    mentions.push({ kind: "mcp", value: match[1], label: `MCP ${match[1]}`, raw: match[0] });
  }
  return mentions;
}

function MentionBadge({ mention, onRemove }: { mention: { kind: "workflow" | "mcp"; value: string; label: string; raw: string }; onRemove?: () => void }) {
  return (
    <button type="button" onClick={onRemove} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--text)] transition hover:border-[var(--accent)]">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[10px] text-[var(--accent)]">
        <Icon name={mention.kind === "workflow" ? "workflow" : "server"} size={10} />
      </span>
      <span className="font-mono">{mention.raw}</span>
      {onRemove && <span className="text-[var(--faint)]">×</span>}
    </button>
  );
}

function UserBlock({ b }: { b: Extract<Block, { k: "user" }> }) {
  return (
    <div className="a-up flex gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-[var(--app)]">SA</span>
      <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm border border-[var(--border)] bg-[var(--panel-2)] px-3.5 py-2.5">
        <p className="text-[13px] leading-relaxed text-[var(--text)]">{b.text}</p>
        {b.attach && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {b.attach.map((a) => (
              <span key={a} className="inline-flex items-center gap-1 rounded-md border border-[var(--border-2)] bg-[var(--panel)] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--muted)]">
                <Icon name="file" size={10} />
                {a}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Thinking({ b }: { b: Extract<Block, { k: "thinking" }> }) {
  const [open, setOpen] = useState(false);
  // Support both old format (just text/ms) and new autonomous format (confidence, plan)
  const data = b as any;
  const confidence = data.confidence as number | undefined;
  const plan = data.plan as string[] | undefined;
  return (
    <div className="a-up ml-8">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 py-0.5 text-[11.5px] text-[var(--faint)] transition hover:text-[var(--text)]">
        <Icon name="brain" size={12} />
        <span className="italic">Thought for {(b.ms / 1000).toFixed(1)}s</span>
        {confidence !== undefined && (
          <span className={cn(
            "rounded-full px-1.5 py-px text-[9.5px] font-bold",
            confidence >= 70 ? "bg-[var(--green-soft)] text-[var(--green)]" :
            confidence >= 40 ? "bg-[var(--amber-soft)] text-[var(--amber)]" :
            "bg-[var(--red-soft)] text-[var(--red)]"
          )}>{confidence}% confident</span>
        )}
        <Icon name="chevRight" size={10} strokeWidth={2.2} className={cn("transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="a-in mt-1 border-l-2 border-[var(--border-2)] py-1 pl-3">
          <p className="text-[12px] italic leading-relaxed text-[var(--muted)]">{b.text}</p>
          {plan && plan.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--faint)]">Plan</p>
              <ol className="mt-1 flex flex-col gap-0.5">
                {plan.map((p, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-[var(--muted)]">
                    <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full bg-[var(--panel-3)] text-center text-[9px] font-bold leading-3.5 text-[var(--faint)]">{i + 1}</span>
                    {p}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Todo({ b }: { b: Extract<Block, { k: "todo" }> }) {
  const done = b.items.filter((i) => i.state === "done").length;
  return (
    <div className="a-up ml-8 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-2">
        <Icon name="todo" size={12} className="text-[var(--accent)]" />
        <span className="text-[11.5px] font-semibold text-[var(--text)]">Task plan</span>
        <span className="ml-auto font-mono text-[10.5px] text-[var(--faint)]">{done}/{b.items.length}</span>
        <div className="h-1 w-14 overflow-hidden rounded-full bg-[var(--panel-4)]">
          <div className="a-bar h-full bg-[var(--accent)]" style={{ width: `${(done / b.items.length) * 100}%` }} />
        </div>
      </div>
      <ul className="px-3 py-2">
        {b.items.map((i, idx) => (
          <li key={idx} className="flex items-center gap-2 py-[3px] text-[12px]">
            {i.state === "done" ? <Icon name="checkCircle" size={13} className="shrink-0 text-[var(--green)]" /> : i.state === "active" ? <Spinner size={13} /> : <Icon name="circle" size={13} className="shrink-0 text-[var(--border-3)]" />}
            <span className={cn(i.state === "done" && "text-[var(--faint)] line-through", i.state === "active" && "font-medium text-[var(--text)]", i.state === "todo" && "text-[var(--muted)]")}>{i.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tool({ b }: { b: Extract<Block, { k: "tool" }> }) {
  const [open, setOpen] = useState(false);
  const has = !!b.output?.length;
  return (
    <div className="a-up ml-8 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
      <button onClick={() => has && setOpen((v) => !v)} className={cn("flex w-full items-center gap-2.5 px-3 py-2 text-left", has && "hover:bg-[var(--panel-2)]")}>
        <span className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px]",
          b.status === "running" ? "bg-[var(--blue-soft)] text-[var(--blue)]" : "bg-[var(--panel-3)] text-[var(--text-2)]",
        )}>
          <Icon name={b.icon} size={12} strokeWidth={1.9} />
        </span>
        <span className="shrink-0 text-[12px] font-semibold text-[var(--text)]">{b.tool}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--muted)]">{b.target}</span>
        {b.meta && <span className="shrink-0 rounded-md bg-[var(--panel-3)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--faint)]">{b.meta}</span>}
        {b.status === "running" ? <Spinner size={12} /> : b.status === "failed"
          ? <span className="flex items-center gap-1 rounded-full bg-[var(--red-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--red)]"><Icon name="alert" size={10} /> failed</span>
          : <span className="flex items-center gap-1 rounded-full bg-[var(--green-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--green)]"><Icon name="check" size={10} strokeWidth={2.2} /> done</span>
        }
        {has && <Icon name="chevRight" size={11} className={cn("shrink-0 text-[var(--faint)] transition-transform", open && "rotate-90")} />}
      </button>
      {open && has && (
        <div className="a-in overflow-x-auto border-t border-[var(--border)] bg-[var(--panel-2)] px-3 py-2">
          {b.output!.map((line, i) => (
            <div key={i} className="flex items-start gap-2 py-0.5">
              <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--border-3)]" />
              <span className="font-mono text-[11px] text-[var(--muted)]">{line}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Term({ b }: { b: Extract<Block, { k: "terminal" }> }) {
  return (
    <div className="a-up ml-8 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] text-[var(--text)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-1.5">
        <Icon name="terminal" size={11} className="text-[var(--muted)]" />
        <span className="truncate font-mono text-[10.5px] text-[var(--muted)]">{b.cmd}</span>
        <span className={cn("ml-auto rounded px-1.5 py-px font-mono text-[9.5px] font-semibold", b.exit === 0 ? "bg-[var(--green-soft)] text-[var(--green)]" : "bg-[var(--red-soft)] text-[var(--red)]")}>exit {b.exit}</span>
      </div>
      <pre className="overflow-x-auto px-3 py-2 font-mono text-[10.5px] leading-[1.7] text-[var(--text-2)]">
        {b.lines.map((l, i) => (
          <div key={i} className={cn("a-in", l.includes("✓") && "text-[var(--green)]", l.includes("passed") && "text-[var(--green)]")} style={{ animationDelay: `${i * 25}ms` }}>
            {l || " "}
          </div>
        ))}
      </pre>
    </div>
  );
}

function Permission({ b, threadId }: { b: Extract<Block, { k: "permission" }>; threadId: string }) {
  const [state, setState] = useState<"allow" | "deny" | null>(b.resolved ?? null);
  const [busy, setBusy] = useState(false);

  const resolve = async (approved: boolean) => {
    if (!threadId || !b.requestId) { setState(approved ? "allow" : "deny"); return; }
    setBusy(true);
    try {
      await threadsApi.resolvePermission(threadId, b.requestId, approved);
      setState(approved ? "allow" : "deny");
    } catch (err: any) {
      console.error("Permission resolve failed:", err);
    } finally {
      setBusy(false);
    }
  };

  const isMcp = b.tool === "mcp_install";
  return (
    <div className={cn("a-up ml-8 rounded-xl border px-3 py-2.5", state === "deny" ? "border-[var(--border)] bg-[var(--panel-2)]" : "border-[var(--accent)]/40 bg-[var(--panel-2)]")}>
      <div className="flex items-start gap-2">
        <Icon name={isMcp ? "server" : "shield"} size={13} className="mt-0.5 shrink-0 text-[var(--accent)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-[var(--text)]">
            {isMcp ? <>Install MCP server <span className="font-mono">{b.mcpInstall?.name || "…"}</span>?</> : <>Allow <span className="font-mono">{b.tool}</span>?</>}
          </p>
          <p className="pt-0.5 text-[11.5px] leading-relaxed text-[var(--muted)]">{b.detail}</p>
        </div>
        {state ? (
          <Badge tone={state === "allow" ? "green" : "muted"} icon={state === "allow" ? "check" : "close"}>{state === "allow" ? "Allowed" : "Denied"}</Badge>
        ) : (
          <span className="flex shrink-0 gap-1.5">
            <Btn variant="ghost" className="!px-2 !py-1 !text-[11px]" disabled={busy} onClick={() => resolve(false)}>Deny</Btn>
            <Btn variant="accent" className="!px-2 !py-1 !text-[11px]" disabled={busy} onClick={() => resolve(true)}>Allow</Btn>
          </span>
        )}
      </div>
    </div>
  );
}

function Memory({ b }: { b: Extract<Block, { k: "memory" }> }) {
  return (
    <div className="a-up ml-8 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)]/60 px-3 py-2">
      <Icon name="brain" size={13} className="shrink-0 text-[var(--accent)]" />
      <p className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--muted)]">{b.text}</p>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">Memory</span>
    </div>
  );
}

const PARALLEL_PRESETS = [
  { name: "implementer", task: "Implement the core change" },
  { name: "test-writer", task: "Write tests covering the change" },
  { name: "reviewer", task: "Review the diff for edge cases" },
];

function ParallelPanel({
  goal,
  onGoal,
  onLaunch,
  onClose,
}: {
  goal: string;
  onGoal: (g: string) => void;
  onLaunch: (breakdown: { name: string; task: string }[]) => void;
  onClose: () => void;
}) {
  const [count, setCount] = useState(2);
  const [tasks, setTasks] = useState<{ name: string; task: string }[]>(
    PARALLEL_PRESETS.map((p) => ({ ...p }))
  );

  const setTask = (i: number, field: "name" | "task", v: string) =>
    setTasks((prev) => prev.map((t, j) => (j === i ? { ...t, [field]: v } : t)));

  const launch = () => {
    const final = tasks.slice(0, count).map((t) => ({
      name: t.name || "agent",
      task: t.task || goal,
    }));
    onLaunch(final);
  };

  return (
    <div className="a-pop absolute bottom-[90px] left-4 right-4 z-20 mx-auto max-w-[620px] overflow-hidden rounded-xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent)]">
          <Icon name="boxes" size={12} /> Parallel agents
        </span>
        <span className="rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[9.5px] font-bold text-[var(--accent)]">{count}×</span>
        <span className="ml-auto flex items-center gap-1.5">
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => setCount(n)}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md font-mono text-[11px] font-bold transition",
                count === n ? "bg-[var(--accent)] text-[var(--app)]" : "bg-[var(--panel-3)] text-[var(--muted)] hover:text-[var(--text)]"
              )}
            >
              {n}
            </button>
          ))}
        </span>
        <IconBtn icon="close" size={12} onClick={onClose} title="Close" />
      </div>

      <div className="px-3 py-2.5">
        <textarea
          value={goal}
          onChange={(e) => onGoal(e.target.value)}
          rows={2}
          placeholder="One goal split across agents, e.g. 'Add dark mode to the landing page'"
          className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-1.5 text-[12.5px] leading-relaxed text-[var(--text)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--faint)]"
        />
        <div className="mt-2 flex flex-col gap-1.5">
          {tasks.slice(0, count).map((t, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--panel-3)] font-mono text-[10px] font-bold text-[var(--faint)]">{i + 1}</span>
              <input
                value={t.name}
                onChange={(e) => setTask(i, "name", e.target.value)}
                placeholder="agent name"
                className="w-[110px] shrink-0 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1 font-mono text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--faint)]"
              />
              <input
                value={t.task}
                onChange={(e) => setTask(i, "task", e.target.value)}
                placeholder="task for this agent"
                className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1 text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--faint)]"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--panel-2)] px-3 py-2">
        <span className="text-[10.5px] text-[var(--faint)]">Each agent runs in its own thread — results merge here.</span>
        <span className="ml-auto flex items-center gap-1.5">
          <Btn variant="ghost" className="!px-2.5 !py-1 !text-[11px]" onClick={onClose}>Cancel</Btn>
          <Btn variant="accent" className="!px-2.5 !py-1 !text-[11px]" disabled={!goal.trim()} onClick={launch}>
            <Icon name="boxes" size={11} /> Launch {count} agents
          </Btn>
        </span>
      </div>
    </div>
  );
}

const TOUR_STEPS = [
  {
    title: "Welcome to Kiren",
    body: "Kiren is an autonomous AI coding agent with a Cursor-style editor and Codex-style parallel agents. Here's a 15-second tour.",
    icon: "sparkle" as const,
  },
  {
    title: "Composer",
    body: "Describe what to build here. Autopilot plans, edits and verifies on its own. /plan, /test and /review are one slash away.",
    icon: "terminal" as const,
  },
  {
    title: "Parallel agents",
    body: "Hit the ▦ button to split a goal across up to 4 agents. Each runs in its own thread and the results merge back into this chat.",
    icon: "boxes" as const,
  },
  {
    title: "Workspace tabs",
    body: "Preview live, review diffs and edit code with Cmd+K inline edits — all in the panel on the right.",
    icon: "monitor" as const,
  },
];

function WelcomeTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const s = TOUR_STEPS[step];
  return (
    <div className="absolute inset-0 z-[55] flex items-center justify-center bg-[var(--app)]/60 p-4 backdrop-blur-[2px]">
      <div className="a-pop w-full max-w-[400px] overflow-hidden rounded-2xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
        <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--panel-2)] px-4 py-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--app)]">
            <Icon name={s.icon} size={14} />
          </span>
          <span className="text-[12.5px] font-bold text-[var(--text)]">{s.title}</span>
          <span className="ml-auto font-mono text-[10px] text-[var(--faint)]">{step + 1}/{TOUR_STEPS.length}</span>
          <IconBtn icon="close" size={12} onClick={onClose} title="Dismiss" />
        </div>
        <div className="px-4 py-3">
          <p className="text-[12.5px] leading-relaxed text-[var(--muted)]">{s.body}</p>
        </div>
        <div className="flex items-center gap-1.5 border-t border-[var(--border)] bg-[var(--panel-2)] px-4 py-2.5">
          {TOUR_STEPS.map((_, i) => (
            <span key={i} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-6 bg-[var(--accent)]" : "w-1.5 bg-[var(--border-3)]")} />
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            {step > 0 && <Btn variant="ghost" className="!px-2.5 !py-1 !text-[11px]" onClick={() => setStep((s) => s - 1)}>Back</Btn>}
            {step < TOUR_STEPS.length - 1 ? (
              <Btn variant="accent" className="!px-2.5 !py-1 !text-[11px]" onClick={() => setStep((s) => s + 1)}>Next</Btn>
            ) : (
              <Btn variant="accent" className="!px-2.5 !py-1 !text-[11px]" onClick={onClose}>Get building</Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DiffCard({ files, onOpen }: { files: DiffFile[]; onOpen: () => void }) {
  if (!files.length) return null;
  return (
    <div className="a-up ml-8 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]">
      <button onClick={onOpen} className="flex w-full items-center gap-2 border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-1.5 hover:bg-[var(--panel-3)]">
        <Icon name="fileDiff" size={12} className="text-[var(--accent)]" />
        <span className="text-[11.5px] font-semibold text-[var(--text)]">Edited {files.length} file{files.length === 1 ? "" : "s"}</span>
        <span className="ml-auto font-mono text-[10.5px] font-semibold text-[var(--green)]">+{files.reduce((a, f) => a + f.add, 0)}</span>
        <span className="font-mono text-[10.5px] font-semibold text-[var(--red)]">−{files.reduce((a, f) => a + f.del, 0)}</span>
        <Icon name="chevRight" size={11} className="text-[var(--faint)]" />
      </button>
      {files.map((f) => (
        <div key={f.id} className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-1.5 last:border-0">
          <Badge tone={f.status === "added" ? "green" : "muted"} className="!px-1.5 !text-[9.5px]">{f.status === "added" ? "NEW" : "MOD"}</Badge>
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--muted)]">{f.path}</span>
          <span className="font-mono text-[10.5px] text-[var(--green)]">+{f.add}</span>
          <span className="font-mono text-[10.5px] text-[var(--red)]">−{f.del}</span>
        </div>
      ))}
      <pre className="overflow-x-auto bg-[var(--panel-2)] px-3 py-1.5 font-mono text-[10.5px] leading-relaxed">
        {files[0].lines.slice(0, 4).map((l, i) => (
          <div key={i} className={cn("whitespace-pre", l.t === "add" && "bg-[var(--add-bg)] text-[var(--add-ink)]", l.t === "del" && "bg-[var(--del-bg)] text-[var(--del-ink)]")}>
            <span className="select-none pr-1 opacity-60">{l.t === "add" ? "+" : l.t === "del" ? "−" : " "}</span>
            {l.t === "ctx" ? highlight(l.text) : l.text}
          </div>
        ))}
      </pre>
    </div>
  );
}

export default function AgentView({
  thread, project, files, working, activeTool, mode, model, models,
  onMode, onModel, onSend, onParallel, onStop, onCommit, onPR, onOpenTab, onDesign,
}: Props) {
  const [draft, setDraft] = useState("");
  const [slash, setSlash] = useState(false);
  const [at, setAt] = useState(false);
  const [parallelOpen, setParallelOpen] = useState(false);
  const [parallelGoal, setParallelGoal] = useState("");
  const [tour, setTour] = useState(() => {
    try { return localStorage.getItem("kiren_tour_done") !== "1"; } catch { return false; }
  });
  const [attachments, setAttachments] = useState<string[]>([]);
  const [branch, setBranch] = useState(thread.branch);
  const [branchOpen, setBranchOpen] = useState(false);
  const [branchQ, setBranchQ] = useState("");
  const [chatModel, setChatModel] = useState(model);
  const [chatModelOpen, setChatModelOpen] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [hashOpen, setHashOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const { servers: mcpServers } = useMCP();

  useEffect(() => setBranch(thread.branch), [thread.id, thread.branch]);
  useEffect(() => setChatModel(model), [model]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [thread.blocks.length, working, activeTool]);

  useEffect(() => {
    setSlash(draft.startsWith("/"));
    setAt(/(^|\s)@\w*$/.test(draft));
    setHashOpen(/(^|\s)#\w*$/.test(draft));
  }, [draft]);

  const submit = () => {
    if (!draft.trim() || working) return;
    onSend(draft.trim());
    setDraft("");
    setAttachments([]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files;
    if (!uploaded || uploaded.length === 0) return;
    const names = Array.from(uploaded).map((f) => f.name);
    setAttachments((prev) => [...prev, ...names]);
  };

  const insertMention = (mention: string) => {
    setDraft((d) => d.replace(/#\w*$/, mention));
    setHashOpen(false);
    textarea.current?.focus();
  };

  const mentions = parseMentions(draft);

  const closeTour = () => {
    setTour(false);
    try { localStorage.setItem("kiren_tour_done", "1"); } catch {}
  };

  return (
    <section className="relative flex h-full min-w-0 flex-1 flex-col border-r border-[var(--border)] bg-[var(--app)]">
      {/* Header Bar */}
      <div className="flex min-h-[44px] shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border)] px-3.5 py-1.5">
        {/* Thread title + branch */}
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--panel-3)] text-[var(--text)]">
          <Icon name="chat" size={12} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[13px] font-semibold leading-tight text-[var(--text)]">{thread.title}</h2>
          <div className="relative flex items-center gap-1.5 text-[10.5px] leading-tight text-[var(--faint)]">
            <Icon name="github" size={9} />
            <span className="font-mono">{project.repo}</span>
            <span>·</span>
            <button
              onClick={() => setBranchOpen((v) => !v)}
              className="flex items-center gap-0.5 rounded px-1 py-0.5 font-mono text-[var(--text-2)] transition hover:bg-[var(--panel-3)]"
            >
              <Icon name="branchSm" size={9} />
              {branch}
              <Icon name="chevDown" size={8} />
            </button>
            {branchOpen && (
              <div className="a-pop absolute left-24 top-full z-30 mt-1 w-[240px] overflow-hidden rounded-xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
                <div className="border-b border-[var(--border)] p-1.5">
                  <input
                    autoFocus
                    value={branchQ}
                    onChange={(e) => setBranchQ(e.target.value)}
                    placeholder="Search branches"
                    className="w-full rounded-lg border border-[var(--border-2)] bg-[var(--panel-2)] px-2.5 py-1.5 text-[11.5px] outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div className="max-h-[190px] overflow-y-auto py-1">
                  {[project.branch, "main", branch]
                    .filter((b, i, arr) => arr.indexOf(b) === i && b.toLowerCase().includes(branchQ.toLowerCase()))
                    .map((b) => (
                      <button
                        key={b}
                        onClick={() => { setBranch(b); setBranchOpen(false); }}
                        className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[11.5px] transition hover:bg-[var(--panel-2)]", b === branch ? "font-bold text-[var(--text)]" : "text-[var(--muted)]")}
                      >
                        {b}
                        {b === branch && <Icon name="check" size={11} strokeWidth={2.2} className="ml-auto" />}
                      </button>
                    ))}
              </div>
            </div>
          )}

          {/* MCP Server Popover */}
          {mcpOpen && (
            <div className="a-pop absolute bottom-[90px] left-4 right-4 z-20 mx-auto max-w-[620px] overflow-hidden rounded-xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
              <p className="flex items-center gap-1.5 border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]">
                <Icon name="server" size={11} /> MCP Servers
                <span className="ml-auto normal-case tracking-normal">@{mcpServers.filter((s) => s.status === "connected").length} connected</span>
              </p>
              <div className="max-h-[190px] overflow-y-auto py-1">
                {mcpServers.length === 0 && (
                  <p className="px-3 py-2 text-[11.5px] text-[var(--muted)]">No servers yet — add them in Settings → MCP Servers.</p>
                )}
                {mcpServers.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (s.status !== "connected") return;
                      setDraft((d) => d.replace(/@\w*$/, "") + `@${s.name} `);
                      setMcpOpen(false);
                      textarea.current?.focus();
                    }}
                    className={cn("flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-[var(--panel-2)]", s.status !== "connected" && "opacity-45")}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold" style={{ background: s.color, color: "#fff" }}>{s.glyph}</span>
                    <span className="font-mono text-[12px] font-semibold text-[var(--text)]">{s.name}</span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--muted)]">{s.config?.description}</span>
                    <span className="shrink-0 font-mono text-[10.5px] text-[var(--faint)]">{s.tools} tools</span>
                    <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold", s.status === "connected" ? "bg-[var(--green-soft)] text-[var(--green)]" : "bg-[var(--red-soft)] text-[var(--red)]")}>{s.status}</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-[var(--border)] bg-[var(--panel-2)] px-3 py-1.5 text-[10.5px] text-[var(--faint)]">
                Mention a server in your message to give the agent live access — e.g. <span className="font-mono text-[var(--text-2)]">@github</span>.
              </div>
            </div>
          )}
            <span>·</span>
            <span className="font-mono">{model}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge tone={thread.status === "running" ? "blue" : thread.status === "done" ? "green" : "accent"}>
            {thread.status === "review" ? "In review" : thread.status}
          </Badge>
          <Btn variant="ghost" icon="pr" className="!py-1 !text-[11px]" onClick={onPR}>PR</Btn>
          <Btn variant="primary" icon="gitCommit" className="!py-1 !text-[11px]" onClick={onCommit}>Commit &amp; Push</Btn>
        </div>
      </div>

      {/* Message Transcript */}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-[620px] flex-col gap-3">
          {thread.blocks.length === 0 && !working && (
            <div className="flex flex-col items-center gap-2.5 pt-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--app)] shadow-[var(--shadow-sm)]">
                <Icon name="sparkle" size={22} fill />
              </span>
              <p className="pt-1 text-[15px] font-bold tracking-tight text-[var(--text)]">What should we build?</p>
              <p className="max-w-[330px] text-[12.5px] leading-relaxed text-[var(--muted)]">
                Scoped to <span className="font-semibold text-[var(--text)]">{project.name}</span>. Type <code className="rounded bg-[var(--panel-3)] px-1 font-mono">/</code> for commands or <code className="rounded bg-[var(--panel-3)] px-1 font-mono">@</code> for files.
              </p>
              <div className="flex flex-wrap justify-center gap-1.5 pt-3">
                {[
                  { icon: "fileDiff", text: "Fix the failing tests in CI" },
                  { icon: "wand",     text: "Redesign the hero section copy" },
                  { icon: "search",   text: "Audit render-blocking resources" },
                  { icon: "layers",   text: "Extract shared components to design-system" },
                  { icon: "shield",   text: "Add rate limiting to /v1/search" },
                  { icon: "doc",      text: "Write docs for the new API endpoints" },
                ].map((s) => (
                  <button
                    key={s.text}
                    onClick={() => setDraft(s.text)}
                    className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-[11.5px] font-medium text-[var(--muted)] shadow-[var(--shadow-sm)] transition hover:border-[var(--border-2)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
                  >
                    <Icon name={s.icon as import("../icons").IconName} size={12} className="text-[var(--faint)]" />
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {thread.blocks.map((b, i) => {
            switch (b.k) {
              case "user": return <UserBlock key={i} b={b} />;
              case "thinking": return <Thinking key={i} b={b} />;
              case "memory": return <Memory key={i} b={b} />;
              case "todo": return <Todo key={i} b={b} />;
              case "tool": return <Tool key={i} b={b} />;
              case "terminal": return <Term key={i} b={b} />;
              case "permission": return <Permission key={i} b={b} threadId={thread.id} />;
              case "diff":
                return <DiffCard key={i} files={b.fileIds.length ? files.filter((f) => b.fileIds.includes(f.id)) : files} onOpen={() => onOpenTab("changes")} />;
              case "preview":
                return (
                  <button key={i} onClick={() => onOpenTab("preview")} className="a-up ml-8 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-left transition hover:border-[var(--accent)]">
                    <Icon name="monitor" size={13} className="text-[var(--accent)]" />
                    <span className="flex-1 truncate text-[12px] font-medium text-[var(--text)]">{b.label}</span>
                    <Badge tone="accent" icon="wand">Open Preview</Badge>
                  </button>
                );
              case "summary":
                return (
                  <div key={i} className="a-up ml-8 rounded-xl border border-[var(--border-2)] bg-[var(--panel-2)] p-3.5">
                    <div className="flex items-center gap-2 pb-2">
                      <Icon name="sparkle" size={13} className="text-[var(--accent)]" fill />
                      <p className="text-[13px] font-bold tracking-tight text-[var(--text)]">{b.title}</p>
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {b.bullets.map((x, j) => (
                        <li key={j} className="flex gap-2 text-[12.5px] leading-relaxed text-[var(--muted)]">
                          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
                          <RichText text={x} />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              case "text":
                return <p key={i} className="a-up ml-8 text-[13px] leading-relaxed text-[var(--text-2)]"><RichText text={b.text} /></p>;
              default: return null;
            }
          })}

          {working && (
            <div className="a-up ml-8 flex flex-col gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-1.5 text-[12px]">
                <Spinner size={13} />
                <span className="font-semibold text-[var(--text)]">{activeTool ?? "Agent"}</span>
                <span className="truncate text-[var(--muted)]">{activeTool ? "running…" : "is working"}</span>
                <span className="flex gap-0.5">
                  {[0, 1, 2].map((i) => <span key={i} className="dot-pulse h-1 w-1 rounded-full bg-[var(--accent)]" style={{ animationDelay: `${i * 0.18}s` }} />)}
                </span>
                <button onClick={onStop} className="ml-auto flex items-center gap-1 text-[11px] font-medium text-[var(--red)] hover:underline">
                  <Icon name="stop" size={10} /> Stop
                </button>
              </div>
              <div className="shimmer h-2.5 w-4/5 rounded-full" />
            </div>
          )}
        </div>
      </div>

      {/* Upgraded Clean Composer */}
      <div className="relative shrink-0 border-t border-[var(--border)] px-4 pb-3 pt-2.5">
        <div className="mx-auto max-w-[620px]">
          {/* Top Row: Mode Toggle + Kiren Design */}
          <div className="flex items-center justify-between pb-2">
            <div className="flex rounded-xl border border-[var(--border)] bg-[var(--panel)] p-0.5 shadow-[var(--shadow-sm)]">
              {(["agent", "plan", "ask"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onMode(m)}
                  className={cn(
                    "rounded-lg px-2.5 py-[3px] text-[11px] font-semibold capitalize transition",
                    mode === m ? "bg-[var(--accent)] text-[var(--panel)]" : "text-[var(--muted)] hover:text-[var(--text)]",
                  )}
                >
                  {m === "agent" ? "Autopilot" : m}
                </button>
              ))}
            </div>
            <button
              onClick={onDesign}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--text)] shadow-[var(--shadow-sm)] transition hover:border-[var(--border-2)]"
              title="Enable Kiren Design on live preview"
            >
              <Icon name="wand" size={13} className="text-[var(--accent-warm)]" />
              Kiren Design
            </button>
          </div>

          {/* Attachments Display */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-2">
              {attachments.map((aName, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 rounded-md border border-[var(--border-2)] bg-[var(--panel-2)] px-2 py-0.5 text-[11px] text-[var(--text)]">
                  <Icon name="file" size={11} className="text-[var(--faint)]" />
                  <span className="truncate max-w-[140px]">{aName}</span>
                  <button onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))} className="text-[var(--faint)] hover:text-[var(--text)]">×</button>
                </span>
              ))}
            </div>
          )}

          {/* Mention Auto-complete Popover */}
          {hashOpen && (
            <div className="a-pop absolute bottom-[90px] left-4 right-4 z-20 mx-auto max-w-[620px] overflow-hidden rounded-xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
              <p className="border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]">Mentions</p>
              <div className="max-h-[180px] overflow-y-auto">
                <button onClick={() => insertMention("#kiren-workflow:main")} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition hover:bg-[var(--panel-2)]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[10px] text-[var(--accent)]"><Icon name="workflow" size={10} /></span>
                  <span className="font-mono text-[12px] font-semibold text-[var(--text)]">#kiren-workflow:main</span>
                  <span className="truncate text-[11px] text-[var(--muted)]">workflow reference</span>
                </button>
                {mcpServers.filter((s) => s.status === "connected").map((s) => (
                  <button key={s.id} onClick={() => insertMention(`#mcp:${s.name}`)} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition hover:bg-[var(--panel-2)]">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md text-[8.5px] font-bold" style={{ background: s.color, color: "#fff" }}>{s.glyph}</span>
                    <span className="font-mono text-[12px] font-semibold text-[var(--text)]">#{s.name}</span>
                    <span className="truncate text-[11px] text-[var(--muted)]">MCP server</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Parallel Agents Popover */}
          {parallelOpen && (
            <ParallelPanel
              goal={parallelGoal}
              onGoal={setParallelGoal}
              onClose={() => setParallelOpen(false)}
              onLaunch={(breakdown) => {
                setParallelOpen(false);
                onParallel(parallelGoal.trim(), breakdown);
                setParallelGoal("");
              }}
            />
          )}

          {/* Command Auto-complete Popover */}
          {slash && (
            <div className="a-pop absolute bottom-[90px] left-4 right-4 z-20 mx-auto max-w-[620px] overflow-hidden rounded-xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
              <p className="border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]">Commands</p>
              <div className="max-h-[180px] overflow-y-auto">
                {slashCommands.filter((s) => s.cmd.startsWith(draft.split(" ")[0])).map((s) => (
                  <button key={s.cmd} onClick={() => {
                    if (s.cmd === "/mcp") { setSlash(false); setMcpOpen(true); return; }
                    setDraft(s.cmd + " ");
                  }} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition hover:bg-[var(--accent-soft)]">
                    <Icon name="slash" size={11} className="text-[var(--accent)]" />
                    <span className="font-mono text-[12px] font-semibold text-[var(--text)]">{s.cmd}</span>
                    <span className="truncate text-[11.5px] text-[var(--muted)]">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* File Auto-complete Popover */}
          {at && (
            <div className="a-pop absolute bottom-[90px] left-4 right-4 z-20 mx-auto max-w-[620px] overflow-hidden rounded-xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
              <p className="border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]">Attach File Context</p>
              <div className="max-h-[180px] overflow-y-auto">
                {mcpServers.filter((s) => s.status === "connected").length > 0 && (
                  <p className="border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]">MCP Tools</p>
                )}
                {mcpServers.filter((s) => s.status === "connected").map((s) => (
                  <button key={s.id} onClick={() => {
                    setDraft((d) => d.replace(/@\w*$/, `@${s.name} `));
                    setAt(false);
                    textarea.current?.focus();
                  }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-[var(--panel-2)]">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[8.5px] font-bold" style={{ background: s.color, color: "#fff" }}>{s.glyph}</span>
                    <span className="font-mono text-[12px] font-semibold text-[var(--text)]">{s.name}</span>
                    <span className="ml-auto flex items-center gap-1 text-[10.5px] text-[var(--faint)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--green)]" />
                      {s.tools} tools
                    </span>
                  </button>
                ))}
                {project.code.map((c) => (
                  <button key={c.path} onClick={() => setDraft((d) => d.replace(/@\w*$/, `@${c.path.split("/").pop()} `))} className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-[var(--panel-2)]">
                    <Icon name="file" size={11} className="text-[var(--faint)]" />
                    <span className="font-mono text-[11.5px] text-[var(--text)]">{c.path}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Main Input Box */}
          <div className="rounded-xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-sm)] transition focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--ring)]">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={2}
              placeholder={mode === "ask" ? "Ask about this project…" : mode === "plan" ? "Outline a plan before editing…" : "Describe what to build"}
              className="w-full resize-none bg-transparent px-3 pt-2.5 text-[13px] leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--faint)]"
              ref={textarea}
            />
            {mentions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                {mentions.map((mention, idx) => (
                  <MentionBadge key={`${mention.raw}-${idx}`} mention={mention} onRemove={() => setDraft((d) => d.replace(mention.raw, ""))} />
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2 pb-2">
              {/* File / Image Upload Icon (+) */}
              <label className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--panel-2)] text-[var(--text-2)] transition hover:border-[var(--border-2)] hover:bg-[var(--panel-3)] cursor-pointer" title="Upload files or images">
                <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                <Icon name="plus" size={14} strokeWidth={2.2} />
              </label>

              <IconBtn icon="workflow" size={14} title="Mention workflow or MCP" onClick={() => { setDraft((d) => d + "#"); setHashOpen(true); setSlash(false); setAt(false); }} className={cn(hashOpen && "bg-[var(--accent-soft)] text-[var(--accent)]")} />
              <IconBtn icon="server" size={14} title="Attach MCP server" onClick={() => { setMcpOpen((v) => !v); setSlash(false); setAt(false); setHashOpen(false); }} className={cn(mcpOpen && "bg-[var(--accent-soft)] text-[var(--accent)]")} />
              <IconBtn icon="boxes" size={14} title="Run in parallel agents" onClick={() => { setParallelOpen((v) => !v); setSlash(false); setAt(false); setHashOpen(false); setMcpOpen(false); }} className={cn(parallelOpen && "bg-[var(--accent-soft)] text-[var(--accent)]")} />

              {/* Integrated Model Selector dropdown inside thread chatbox */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setChatModelOpen(!chatModelOpen);
                  }}
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--muted)] transition hover:bg-[var(--panel-3)]"
                >
                  <span>{chatModel}</span>
                  <Icon name="chevDown" size={8} />
                </button>
                {chatModelOpen && (
                  <div className="a-pop absolute bottom-full left-0 z-30 mb-1.5 max-h-[280px] w-[260px] overflow-y-auto rounded-xl border border-[var(--border-2)] bg-[var(--panel)] py-1 shadow-[var(--shadow-lg)]">
                    {(models.length > 0 ? groupModels(models) : [{ label: "Other", models: [{ id: chatModel }] }]).map((g) => (
                      <div key={g.label}>
                        <p className="px-3 pt-1 pb-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--faint)]">{g.label}</p>
                        {g.models.map((m: any) => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setChatModel(m.id);
                              setChatModelOpen(false);
                              onModel(m.id);
                            }}
                            className={cn(
                              "w-full px-3 py-1.5 text-left transition hover:bg-[var(--panel-2)]",
                              chatModel === m.id ? "bg-[var(--accent-soft)]" : "",
                            )}
                          >
                            <span className={cn("block font-mono text-[11.5px]", chatModel === m.id ? "font-bold text-[var(--text)]" : "text-[var(--muted)]")}>
                              {m.id}
                            </span>
                            <span className="block truncate text-[10px] text-[var(--faint)]">
                              {m.description || m.owner || "available on kiren.knr.cl"}
                            </span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={working ? onStop : submit}
                  disabled={!working && !draft.trim()}
                  className={cn("flex h-7 w-7 items-center justify-center rounded-lg transition active:scale-95", working ? "bg-[var(--red)] text-white" : draft.trim() ? "bg-[var(--accent)] text-[var(--app)]" : "cursor-not-allowed bg-[var(--panel-3)] text-[var(--faint)]")}
                >
                  <Icon name={working ? "stop" : "arrowUp"} size={14} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {tour && <WelcomeTour onClose={closeTour} />}
    </section>
  );
}
