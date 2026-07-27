import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Gauge,
  GitPullRequest,
  Loader2,
  Lightbulb,
  Paperclip,
  Sparkles,
  TerminalSquare,
  Wrench,
} from "lucide-react";
import { c, font, mono } from "./theme";
import { agentReplies, effortLevels, initialTranscript, type TranscriptItem } from "./data";
import { envName } from "./Dropdowns";
import { ContextWindowPopup } from "./RightPanel";
import Composer, { type Attachment } from "./Composer";
import { GitHubMark, useGitHub } from "./github";
import type { SlashCommand } from "./workData";

/* ─── renderers ─── */
function Collapsible({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[11.5px] py-1"
        style={{ color: c.muted }}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {label}
      </button>
      {open && <div className="pl-5 mt-1 flex flex-col gap-1.5">{children}</div>}
    </div>
  );
}

function Item({ item }: { item: TranscriptItem }) {
  if (item.type === "user") {
    return (
      <div className="flex justify-end mb-4">
        <div
          className="rounded-2xl rounded-tr-md px-3.5 py-2.5 text-[13.5px] max-w-[80%] leading-relaxed whitespace-pre-wrap"
          style={{ backgroundColor: c.chip, color: c.text, border: `1px solid ${c.border}` }}
        >
          {item.text}
        </div>
      </div>
    );
  }
  if (item.type === "text")
    return (
      <p className="text-[13.5px] leading-relaxed mb-4 whitespace-pre-wrap" style={{ color: c.text }}>
        {item.text}
      </p>
    );
  if (item.type === "thought")
    return (
      <div className="flex items-start gap-2 my-2.5 text-[12px] italic" style={{ color: c.faint }}>
        <Lightbulb size={12} className="mt-0.5 flex-shrink-0" />
        {item.text}
      </div>
    );
  if (item.type === "system")
    return (
      <div
        className="flex items-center gap-2 my-3 text-[11.5px] px-2.5 py-1.5 rounded-lg"
        style={{ color: c.muted, backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}
      >
        <Sparkles size={12} color={c.accent} />
        {item.text}
      </div>
    );
  if (item.type === "plan")
    return (
      <div className="mb-4 rounded-xl p-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
        <div className="text-[10px] uppercase tracking-wider mb-2 font-semibold" style={{ color: c.faint }}>
          Plan
        </div>
        <div className="flex flex-col gap-1.5">
          {item.steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-[12.5px]" style={{ color: s.done ? c.muted : c.text }}>
              {s.done ? <Check size={12} color={c.accent} /> : <CircleDashed size={12} color={c.faint} />}
              <span style={{ textDecoration: s.done ? "line-through" : "none" }}>{s.text}</span>
            </div>
          ))}
        </div>
      </div>
    );
  if (item.type === "terminal")
    return (
      <div className="mb-4 rounded-xl overflow-hidden" style={{ border: `1px solid ${c.border}`, backgroundColor: c.codeBg }}>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px]"
          style={{ color: c.muted, borderBottom: `1px solid ${c.borderSoft}` }}
        >
          <TerminalSquare size={11} color={c.faint} />
          <span style={{ fontFamily: mono }}>{item.cmd}</span>
        </div>
        <div className="px-2.5 py-2 text-[11px] leading-5" style={{ fontFamily: mono, color: c.faint }}>
          {item.out.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
    );
  if (item.type === "files-edited")
    return (
      <Collapsible label={`Edited ${item.files.length} file${item.files.length > 1 ? "s" : ""}`}>
        {item.files.map((f) => (
          <div key={f.path} className="flex items-center gap-2 text-[11.5px]" style={{ fontFamily: mono }}>
            <span style={{ color: c.muted }}>{f.path}</span>
            <span style={{ color: c.text }}>+{f.add}</span>
            <span style={{ color: c.faint }}>−{f.del}</span>
          </div>
        ))}
      </Collapsible>
    );
  if (item.type === "tools-used")
    return (
      <Collapsible label={`Used ${item.tools.length} tool${item.tools.length > 1 ? "s" : ""}`}>
        {item.tools.map((t, i) => (
          <div key={i} className="flex items-center gap-2 text-[11.5px]" style={{ color: c.muted }}>
            <Wrench size={11} color={c.faint} />
            <span style={{ fontFamily: mono }}>{t.label}</span>
            {t.detail && (
              <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: c.chip, color: c.faint, fontFamily: mono }}>
                {t.detail}
              </span>
            )}
          </div>
        ))}
      </Collapsible>
    );
  if (item.type === "tool") {
    const Icon = item.icon;
    return (
      <div className="flex items-center gap-2 py-1 text-[12.5px]">
        <Icon size={13} color={c.faint} />
        <span style={{ color: c.muted }}>{item.label}</span>
      </div>
    );
  }
  return null;
}

/* ─── command simulation scripts ─── */
const COMMAND_SCRIPTS: Record<string, TranscriptItem[]> = {
  diff: [
    { type: "terminal", cmd: "git diff --stat", out: ["src/systems/Lighting.js | 27 +++++++---", "src/world/Level.js      | 24 ++++++---", "2 files changed, 42 insertions(+), 9 deletions(-)"] },
    { type: "text", text: "Two files are dirty — the lighting rig and the lamp placement. Open the Changes tab for the full hunks." },
  ],
  test: [
    { type: "terminal", cmd: "npm run test", out: ["✓ lighting.spec.js (8)", "✓ level.spec.js (12)", "✓ links.spec.ts (14)", "", "Test Files  3 passed (3)", "Tests  34 passed (34)", "Duration  4.21s"] },
    { type: "text", text: "All 34 tests pass in 4.2s. Nothing regressed from the lighting change." },
  ],
  review: [
    { type: "system", text: "Adversarial review dispatched — 4 agents over 2 phases." },
    { type: "thought", text: "Spawning correctness, threejs, gameplay and lifecycle reviewers in parallel." },
    { type: "text", text: "Review is running in the background. I'll surface findings in the Tasks tab as each agent reports." },
  ],
  commit: [
    { type: "terminal", cmd: "git commit -am 'lighting: brighten night path'", out: ["[claude/night-lighting 7f3a91c] lighting: brighten night path", " 2 files changed, 42 insertions(+), 9 deletions(-)"] },
    { type: "text", text: "Committed as 7f3a91c. Want me to push and open a PR?" },
  ],
  init: [
    { type: "tools-used", tools: [{ label: "glob", detail: "**/*.{js,ts,json}" }, { label: "read_file", detail: "package.json" }, { label: "write_file", detail: "CLAUDE.md" }] },
    { type: "text", text: "Scanned 148 files and wrote CLAUDE.md with the build commands, directory map and code conventions I inferred." },
  ],
  compact: [
    { type: "system", text: "Context compacted — 254.1k → 38.2k tokens. Full history preserved in the summary." },
  ],
  clear: [],
  help: [
    { type: "text", text: "I can read and edit files, run shell commands and tests, drive git and GitHub, query your database, browse the web, control a live preview, and dispatch parallel subagents for reviews or large refactors.\n\nType / for the command list, @ to pull a file, agent or symbol into context, and + to attach things." },
  ],
};

/* ─── session ─── */
export default function ChatSession({
  sessionName,
  env,
  onOpenUsage,
  onOpenWork,
  onOpenSettings,
}: {
  sessionName: string;
  env: string;
  onOpenUsage: () => void;
  onOpenWork: () => void;
  onOpenSettings: () => void;
}) {
  const [transcript, setTranscript] = useState<TranscriptItem[]>(initialTranscript);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState("Interactive");
  const [model, setModel] = useState("cai-luna-1");
  const [effort, setEffort] = useState("Extended");
  const [ctxOpen, setCtxOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "thinking" | "streaming">("idle");
  const [prState, setPrState] = useState<"idle" | "pushing" | "opened">("idle");
  const gh = useGitHub();
  const scrollRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript, phase]);

  useEffect(() => {
    clearTimers();
    setTranscript(initialTranscript);
    setPhase("idle");
  }, [sessionName]);

  /* word-by-word streaming so replies feel live — pacing follows the thinking level */
  const thinkDelay: Record<string, number> = { Standard: 360, Extended: 1200, "Deep Think": 2600 };
  const streamReply = (full: string, after?: TranscriptItem[]) => {
    const thinkMs = thinkDelay[effort] ?? 600;
    setPhase("thinking");
    timers.current.push(
      window.setTimeout(() => {
        setPhase("streaming");
        setTranscript((t) => [...t, { type: "text", text: "" }]);
        const words = full.split(" ");
        words.forEach((w, i) => {
          timers.current.push(
            window.setTimeout(() => {
              setTranscript((t) => {
                const next = [...t];
                const last = next[next.length - 1];
                if (last?.type === "text") {
                  next[next.length - 1] = { type: "text", text: (last.text ? `${last.text} ` : "") + w };
                }
                return next;
              });
              if (i === words.length - 1) {
                if (after?.length) setTranscript((t) => [...t, ...after]);
                setPhase("idle");
              }
            }, 34 * i)
          );
        });
      }, thinkMs)
    );
  };

  const runCommand = (cmd: SlashCommand) => {
    const a = cmd.action;
    if (!a) return;
    if (a === "cost") return onOpenUsage();
    if (a === "work") return onOpenWork();
    if (a === "settings") return onOpenSettings();
    if (a === "clear") {
      clearTimers();
      setTranscript([]);
      setPhase("idle");
      return;
    }
    const script = COMMAND_SCRIPTS[a];
    if (!script) return;
    setTranscript((t) => [...t, { type: "user", text: cmd.cmd }]);
    setPhase("thinking");
    timers.current.push(
      window.setTimeout(() => {
        setTranscript((t) => [...t, ...script]);
        setPhase("idle");
      }, 700)
    );
  };

  const send = (text: string, attachments: Attachment[]) => {
    const label = attachments.length
      ? `${text}${text ? "\n\n" : ""}${attachments.map((a) => `📎 ${a.label}`).join("\n")}`
      : text;
    setTranscript((t) => [...t, { type: "user", text: label }]);
    setMessage("");

    const mentions = text.match(/@[\w./-]+/g);
    const after: TranscriptItem[] = mentions
      ? [{ type: "tools-used", tools: mentions.slice(0, 4).map((m) => ({ label: "read_file", detail: m.slice(1) })) }]
      : [];

    streamReply(agentReplies[Math.floor(Math.random() * agentReplies.length)], after);
  };

  const openPr = () => {
    if (prState !== "idle") return;
    setPrState("pushing");
    setTranscript((t) => [
      ...t,
      { type: "terminal", cmd: `git push origin ${gh.branch}`, out: [`Enumerating objects: 14, done.`, `To github.com:${gh.repo}.git`, ` * [new branch]  ${gh.branch}`] },
    ]);
    timers.current.push(
      window.setTimeout(() => {
        setPrState("opened");
        setTranscript((t) => [
          ...t,
          { type: "system", text: `Pull request #419 opened against main — “${sessionName}”.` },
        ]);
      }, 1700)
    );
  };

  const stop = () => {
    clearTimers();
    setPhase("idle");
    setTranscript((t) => [...t, { type: "system", text: "Interrupted by user." }]);
  };

  const busy = phase !== "idle";

  return (
    <div className="flex-1 flex flex-col h-full min-w-0" style={{ backgroundColor: c.bg, fontFamily: font }}>
      <div className="flex items-center gap-2 px-3 sm:px-5 h-11 flex-shrink-0" style={{ borderBottom: `1px solid ${c.border}` }}>
        <span className="threadMeta text-[11px]" style={{ color: c.dim, fontFamily: mono }}>
          thread /
        </span>
        <span className="text-[13px] font-medium truncate" style={{ color: c.text }}>
          {sessionName}
        </span>

        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          {gh.connected ? (
            <button
              onClick={openPr}
              disabled={prState !== "idle"}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10.5px] font-medium transition-colors"
              style={{
                backgroundColor: prState === "opened" ? "transparent" : c.accent,
                border: `1px solid ${prState === "opened" ? c.borderSoft : c.accent}`,
                color: prState === "opened" ? c.muted : "#000",
              }}
              title={`Push ${gh.branch} and open a pull request`}
            >
              {prState === "pushing" ? (
                <Loader2 size={11} className="animate-spin" />
              ) : prState === "opened" ? (
                <Check size={11} />
              ) : (
                <GitPullRequest size={11} />
              )}
              {prState === "pushing" ? "Pushing…" : prState === "opened" ? "PR #419 opened" : "Push & open PR"}
            </button>
          ) : (
            <button
              onClick={gh.connect}
              disabled={gh.connecting}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10.5px] font-medium transition-colors"
              style={{ backgroundColor: c.chip, border: `1px solid ${c.border}`, color: c.text }}
              title="Connect GitHub to push and open pull requests"
            >
              {gh.connecting ? <Loader2 size={11} className="animate-spin" /> : <GitHubMark size={11} />}
              {gh.connecting ? "Connecting…" : "Connect to open PRs"}
            </button>
          )}
          <span
            className="threadMeta text-[10.5px] px-1.5 py-0.5 rounded"
            style={{ backgroundColor: c.chip, color: c.muted, border: `1px solid ${c.borderSoft}`, fontFamily: mono }}
            title="Environment is fixed when a thread is created"
          >
            {envName(env).toLowerCase()}
          </span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">
        <div className="max-w-2xl mx-auto w-full">
          {transcript.map((item, i) => (
            <Item key={i} item={item} />
          ))}
          {phase === "thinking" && (
            <div className="flex items-center gap-2 text-[12px]" style={{ color: c.faint }}>
              <span className="blink">✳</span> Thinking…
              <span style={{ fontFamily: mono, color: c.dim }}>
                {effort.toLowerCase()} effort
              </span>
            </div>
          )}
          {transcript.length === 0 && (
            <div className="text-center py-16 text-[12.5px]" style={{ color: c.dim }}>
              Context cleared. Start fresh below.
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pb-4 pt-3 flex-shrink-0" style={{ borderTop: `1px solid ${c.border}` }}>
        <div className="max-w-2xl mx-auto">
          <Composer
            value={message}
            onChange={setMessage}
            onSubmit={send}
            onCommand={runCommand}
            placeholder="Reply…   / for commands, @ for files"
            rows={3}
            mode={mode}
            onMode={setMode}
            model={model}
            onModel={setModel}
            effort={effort}
            onEffort={setEffort}
            busy={busy}
            onStop={stop}
          />

          <div
            className="mt-2 relative flex items-center gap-3 text-[10.5px]"
            style={{ color: c.dim, fontFamily: mono }}
          >
            <button
              onClick={() => setCtxOpen((o) => !o)}
              className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md transition-colors"
              style={{ color: c.faint }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chip)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <Gauge size={11} /> context 28%
            </button>
            {ctxOpen && <ContextWindowPopup onClose={() => setCtxOpen(false)} />}
            <span>{model.toLowerCase()}</span>
            <span title={effortLevels.find((e) => e.label === effort)?.desc}>
              {effort.toLowerCase()} thinking
            </span>
            <span className="flex items-center gap-1">
              <Paperclip size={10} /> {envName(env).toLowerCase()}
            </span>
            <span className="ml-auto">{busy ? "esc to interrupt" : "⏎ send · ⇧⏎ newline"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
