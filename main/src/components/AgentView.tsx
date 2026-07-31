import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { Icon } from "../icons";
import { highlight } from "../highlight";
import { slashCommands, type Block, type DiffFile, type Project, type Thread } from "../data";
import { Badge, Btn, IconBtn, RichText, Spinner } from "./ui";

interface Props {
  thread: Thread;
  project: Project;
  allProjects: Project[];
  files: DiffFile[];
  working: boolean;
  activeTool: string | null;
  mode: "agent" | "plan" | "ask";
  model: string;
  onMode: (m: "agent" | "plan" | "ask") => void;
  onSend: (t: string) => void;
  onStop: () => void;
  onCommit: () => void;
  onPR: () => void;
  onOpenTab: (t: "preview" | "changes" | "editor") => void;
  onDesign: () => void;
  onClear: () => void;
  onSwitchProject: (id: string) => void;
  onNewProject: () => void;
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
  return (
    <div className="a-up ml-8">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 py-0.5 text-[11.5px] text-[var(--faint)] transition hover:text-[var(--text)]">
        <Icon name="brain" size={12} />
        <span className="italic">Thought for {(b.ms / 1000).toFixed(1)}s</span>
        <Icon name="chevRight" size={10} strokeWidth={2.2} className={cn("transition-transform", open && "rotate-90")} />
      </button>
      {open && <p className="a-in mt-1 border-l-2 border-[var(--border-2)] py-1 pl-3 text-[12px] italic leading-relaxed text-[var(--muted)]">{b.text}</p>}
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

function Permission({ b }: { b: Extract<Block, { k: "permission" }> }) {
  const [state, setState] = useState<"allow" | "deny" | null>(b.resolved ?? null);
  return (
    <div className={cn("a-up ml-8 rounded-xl border px-3 py-2.5", state === "deny" ? "border-[var(--border)] bg-[var(--panel-2)]" : "border-[var(--accent)]/40 bg-[var(--panel-2)]")}>
      <div className="flex items-start gap-2">
        <Icon name="shield" size={13} className="mt-0.5 shrink-0 text-[var(--accent)]" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-[var(--text)]">Allow <span className="font-mono">{b.tool}</span>?</p>
          <p className="pt-0.5 text-[11.5px] leading-relaxed text-[var(--muted)]">{b.detail}</p>
        </div>
        {state ? (
          <Badge tone={state === "allow" ? "green" : "muted"} icon={state === "allow" ? "check" : "close"}>{state === "allow" ? "Allowed" : "Denied"}</Badge>
        ) : (
          <span className="flex shrink-0 gap-1.5">
            <Btn variant="ghost" className="!px-2 !py-1 !text-[11px]" onClick={() => setState("deny")}>Deny</Btn>
            <Btn variant="accent" className="!px-2 !py-1 !text-[11px]" onClick={() => setState("allow")}>Allow</Btn>
          </span>
        )}
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
  thread, project, allProjects, files, working, activeTool, mode, model,
  onMode, onSend, onStop, onCommit, onPR, onOpenTab, onDesign,
  onSwitchProject, onNewProject,
}: Props) {
  const [draft, setDraft] = useState("");
  const [slash, setSlash] = useState(false);
  const [at, setAt] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [branch, setBranch] = useState(thread.branch);
  const [branchOpen, setBranchOpen] = useState(false);
  const [branchQ, setBranchQ] = useState("");
  const [chatModel, setChatModel] = useState(model);
  const [chatModelOpen, setChatModelOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => setBranch(thread.branch), [thread.id, thread.branch]);
  useEffect(() => setChatModel(model), [model]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [thread.blocks.length, working, activeTool]);

  useEffect(() => {
    setSlash(draft.startsWith("/"));
    setAt(/(^|\s)@\w*$/.test(draft));
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

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col border-r border-[var(--border)] bg-[var(--app)]">
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
                  {[project.branch, "main", "suaib/module-ui-fix", "meaghan/search-fix", "george/version-update", "susan/onboarding-review", "nate/gui-observer"]
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
              case "todo": return <Todo key={i} b={b} />;
              case "tool": return <Tool key={i} b={b} />;
              case "terminal": return <Term key={i} b={b} />;
              case "permission": return <Permission key={i} b={b} />;
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

          {/* Command Auto-complete Popover */}
          {slash && (
            <div className="a-pop absolute bottom-[90px] left-4 right-4 z-20 mx-auto max-w-[620px] overflow-hidden rounded-xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
              <p className="border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]">Commands</p>
              <div className="max-h-[180px] overflow-y-auto">
                {slashCommands.filter((s) => s.cmd.startsWith(draft.split(" ")[0])).map((s) => (
                  <button key={s.cmd} onClick={() => setDraft(s.cmd + " ")} className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition hover:bg-[var(--accent-soft)]">
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
              placeholder={mode === "ask" ? "Ask about this project…" : mode === "plan" ? "Outline a plan before editing…" : "Describe what to build · / for commands · @ for files"}
              className="w-full resize-none bg-transparent px-3 pt-2.5 text-[13px] leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--faint)]"
            />
            <div className="flex items-center gap-1.5 px-2 pb-2">
              {/* File / Image Upload Icon (+) */}
              <label className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--panel-2)] text-[var(--text-2)] transition hover:border-[var(--border-2)] hover:bg-[var(--panel-3)] cursor-pointer" title="Upload files or images">
                <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                <Icon name="plus" size={14} strokeWidth={2.2} />
              </label>

              <IconBtn icon="slash" size={14} title="Insert command" onClick={() => setDraft((d) => d + "/")} />
              <IconBtn icon="at" size={14} title="Mention file" onClick={() => setDraft((d) => d + "@")} />

              {/* Integrated Model Selector dropdown inside thread chatbox */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setChatModelOpen(!chatModelOpen);
                  }}
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--muted)] transition hover:bg-[var(--panel-3)]"
                >
                  <Icon name="cpu" size={10} className="text-[var(--faint)]" />
                  <span>{chatModel}</span>
                  <Icon name="chevDown" size={8} />
                </button>
                {chatModelOpen && (
                  <div className="a-pop absolute bottom-full left-0 z-30 mb-1.5 w-[160px] overflow-hidden rounded-xl border border-[var(--border-2)] bg-[var(--panel)] py-1 shadow-[var(--shadow-lg)]">
                    {["kiren-2.5", "kiren-2.5-fast", "kiren-thinking", "gpt-4o"].map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setChatModel(m);
                          setChatModelOpen(false);
                        }}
                        className={cn(
                          "w-full px-3 py-1.5 text-left font-mono text-[11.5px] transition hover:bg-[var(--panel-2)]",
                          chatModel === m ? "font-bold text-[var(--text)]" : "text-[var(--muted)]",
                        )}
                      >
                        {m}
                      </button>
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
    </section>
  );
}
