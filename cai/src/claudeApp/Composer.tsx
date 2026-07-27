import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  ArrowUp,
  Bot,
  Brain,
  Camera,
  FileCode2,
  Folder,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Plug,
  Plus,
  SlashSquare,
  Square,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { c, mono } from "./theme";
import { EffortDropdown, EnvDropdown, ModeDropdown, ModelDropdown } from "./Dropdowns";
import {
  mentionTargets,
  plusActions,
  slashCommands,
  type MentionTarget,
  type SlashCommand,
} from "./workData";

const plusIcons: Record<string, LucideIcon> = {
  paperclip: Paperclip,
  camera: Camera,
  folder: Folder,
  plug: Plug,
  brain: Brain,
  zap: Zap,
};

const mentionIcons: Record<MentionTarget["kind"], LucideIcon> = {
  file: FileCode2,
  dir: Folder,
  agent: Bot,
  symbol: SlashSquare,
};

export interface Attachment {
  id: string;
  label: string;
  kind: string;
}

/* ---------- floating palette shell ---------- */
function Palette({
  title,
  hint,
  children,
}: {
  title: string;
  hint: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="absolute left-0 right-0 rounded-xl overflow-hidden popIn z-50"
      style={{
        bottom: "calc(100% + 8px)",
        backgroundColor: "rgba(12,12,12,0.95)",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        border: `1px solid ${c.borderStrong}`,
        boxShadow: c.shadowPop,
      }}
    >
      <div
        className="px-3 py-1.5 text-[10px] font-semibold uppercase flex items-center gap-2"
        style={{ color: c.faint, letterSpacing: "0.09em", borderBottom: `1px solid ${c.borderSoft}` }}
      >
        {title}
      </div>
      <div className="max-h-[280px] overflow-y-auto py-1">{children}</div>
      <div
        className="px-3 py-1.5 text-[10px] flex items-center gap-3"
        style={{ borderTop: `1px solid ${c.borderSoft}`, color: c.dim, backgroundColor: "rgba(0,0,0,0.35)" }}
      >
        {hint}
      </div>
    </div>
  );
}

function Row({
  active,
  onClick,
  onHover,
  children,
}: {
  active: boolean;
  onClick: () => void;
  onHover: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      className="w-full relative flex items-start gap-2.5 pl-3 pr-2.5 py-1.5 text-left"
      style={{ backgroundColor: active ? c.chipHover : "transparent" }}
    >
      {active && (
        <span className="absolute left-0 top-1 bottom-1 rounded-r" style={{ width: 2, backgroundColor: c.accent }} />
      )}
      {children}
    </button>
  );
}

/* ---------- main composer ---------- */
export default function Composer({
  value,
  onChange,
  onSubmit,
  onCommand,
  placeholder,
  rows = 3,
  showEnv = false,
  env,
  onEnv,
  mode,
  onMode,
  model,
  onModel,
  effort,
  onEffort,
  dropDirection = "up",
  busy = false,
  onStop,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (text: string, attachments: Attachment[]) => void;
  onCommand?: (cmd: SlashCommand) => void;
  placeholder: string;
  rows?: number;
  showEnv?: boolean;
  env?: string;
  onEnv?: (v: string) => void;
  mode: string;
  onMode: (v: string) => void;
  model: string;
  onModel: (v: string) => void;
  effort: string;
  onEffort: (v: string) => void;
  dropDirection?: "up" | "down";
  busy?: boolean;
  onStop?: () => void;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [caret, setCaret] = useState(0);
  const [sel, setSel] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  /* --- detect the active trigger token before the caret --- */
  const trigger = useMemo(() => {
    if (dismissed || caret < 0) return null;
    const upto = value.slice(0, caret);
    const slashM = /(^|\n)\/([a-z-]*)$/i.exec(upto);
    if (slashM) return { type: "slash" as const, query: slashM[2], start: caret - slashM[2].length - 1 };
    const atM = /(^|\s)@([^\s@]*)$/.exec(upto);
    if (atM) return { type: "at" as const, query: atM[2], start: caret - atM[2].length - 1 };
    return null;
  }, [value, caret, dismissed]);

  const slashResults = useMemo(() => {
    if (trigger?.type !== "slash") return [];
    const q = trigger.query.toLowerCase();
    return slashCommands.filter((s) => s.cmd.slice(1).toLowerCase().startsWith(q)).slice(0, 40);
  }, [trigger]);

  const atResults = useMemo(() => {
    if (trigger?.type !== "at") return [];
    const q = trigger.query.toLowerCase();
    return mentionTargets
      .filter((m) => m.label.toLowerCase().includes(q) || m.sub.toLowerCase().includes(q))
      .slice(0, 40);
  }, [trigger]);

  const results: (SlashCommand | MentionTarget)[] =
    trigger?.type === "slash" ? slashResults : trigger?.type === "at" ? atResults : [];

  useEffect(() => setSel(0), [trigger?.type, trigger?.query]);

  /* --- close + menu on outside click --- */
  useEffect(() => {
    if (!plusOpen) return;
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPlusOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [plusOpen]);

  const syncCaret = () => {
    requestAnimationFrame(() => setCaret(taRef.current?.selectionStart ?? 0));
  };

  const replaceToken = (insert: string) => {
    if (!trigger) return;
    const before = value.slice(0, trigger.start);
    const after = value.slice(caret);
    const next = `${before}${insert}${after}`;
    onChange(next);
    const pos = before.length + insert.length;
    requestAnimationFrame(() => {
      taRef.current?.focus();
      taRef.current?.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  };

  const pickSlash = (s: SlashCommand) => {
    if (s.action && onCommand) {
      // executable command — run it and wipe the token
      const before = value.slice(0, trigger?.start ?? 0);
      const after = value.slice(caret);
      onChange(`${before}${after}`);
      setCaret(before.length);
      onCommand(s);
      requestAnimationFrame(() => taRef.current?.focus());
      return;
    }
    replaceToken(`${s.cmd}${s.args ? " " : " "}`);
  };

  const pickAt = (m: MentionTarget) => replaceToken(`@${m.label} `);

  const commit = (i: number) => {
    if (trigger?.type === "slash") pickSlash(slashResults[i]);
    else if (trigger?.type === "at") pickAt(atResults[i]);
  };

  const send = () => {
    const text = value.trim();
    if (!text && !attachments.length) return;
    onSubmit(text, attachments);
    setAttachments([]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (results.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSel((s) => (s + 1) % results.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSel((s) => (s - 1 + results.length) % results.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        commit(sel);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissed(true);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const addAttachment = (id: string, label: string, kind: string) =>
    setAttachments((a) => (a.some((x) => x.id === id) ? a : [...a, { id, label, kind }]));

  const runPlus = (actionId: string) => {
    setPlusOpen(false);
    const map: Record<string, [string, string]> = {
      file: ["design-notes.pdf", "file"],
      screenshot: ["screenshot-2026-02-18.png", "image"],
      dir: ["src/systems/", "dir"],
      mcp: ["mcp:github", "mcp"],
      memory: ["CLAUDE.md entry", "memory"],
      task: ["background: test sweep", "task"],
    };
    const [label, kind] = map[actionId] ?? ["attachment", "file"];
    addAttachment(`${actionId}-${Date.now()}`, label, kind);
  };

  const canSend = !!value.trim() || attachments.length > 0;

  return (
    <div
      ref={wrapRef}
      className="relative rounded-2xl"
      style={{ backgroundColor: c.input, border: `1px solid ${c.border}`, boxShadow: c.shadow }}
    >
      {/* slash palette */}
      {trigger?.type === "slash" && slashResults.length > 0 && (
        <Palette
          title={`Commands · ${slashResults.length}`}
          hint={
            <>
              <span style={{ fontFamily: mono }}>↑↓</span> navigate
              <span style={{ fontFamily: mono }}>⏎</span> run
              <span style={{ fontFamily: mono }}>esc</span> dismiss
            </>
          }
        >
          {slashResults.map((s, i) => (
            <Row key={s.cmd} active={i === sel} onClick={() => commit(i)} onHover={() => setSel(i)}>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[12.5px] font-medium" style={{ color: c.text, fontFamily: mono }}>
                    {s.cmd}
                  </span>
                  {s.args && (
                    <span className="text-[10.5px]" style={{ color: c.dim, fontFamily: mono }}>
                      {s.args}
                    </span>
                  )}
                  <span
                    className="ml-auto text-[9.5px] px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ backgroundColor: c.chip, color: c.faint }}
                  >
                    {s.group}
                  </span>
                </span>
                <span className="block text-[11px] mt-0.5" style={{ color: c.muted }}>
                  {s.desc}
                </span>
              </span>
            </Row>
          ))}
        </Palette>
      )}

      {/* @ palette */}
      {trigger?.type === "at" && atResults.length > 0 && (
        <Palette
          title={`Add context · ${atResults.length}`}
          hint={
            <>
              <span style={{ fontFamily: mono }}>↑↓</span> navigate
              <span style={{ fontFamily: mono }}>⏎</span> insert
              <span style={{ fontFamily: mono }}>esc</span> dismiss
            </>
          }
        >
          {atResults.map((m, i) => {
            const Icon = mentionIcons[m.kind];
            return (
              <Row key={m.id} active={i === sel} onClick={() => commit(i)} onHover={() => setSel(i)}>
                <Icon size={12} color={i === sel ? c.text : c.faint} className="mt-0.5 flex-shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-[12.5px] truncate" style={{ color: c.text, fontFamily: mono }}>
                      {m.label}
                    </span>
                    <span
                      className="ml-auto text-[9.5px] px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ backgroundColor: c.chip, color: c.faint }}
                    >
                      {m.kind}
                    </span>
                  </span>
                  <span className="block text-[10.5px] truncate" style={{ color: c.muted }}>
                    {m.sub}
                  </span>
                </span>
              </Row>
            );
          })}
        </Palette>
      )}

      {/* + menu */}
      {plusOpen && (
        <div
          className="absolute rounded-2xl overflow-hidden popIn z-50 p-2.5"
          style={{
            bottom: "calc(100% + 8px)",
            left: 0,
            width: 320,
            backgroundColor: "rgba(10,10,10,0.96)",
            backdropFilter: "blur(26px) saturate(140%)",
            WebkitBackdropFilter: "blur(26px) saturate(140%)",
            border: `1px solid ${c.borderStrong}`,
            boxShadow: c.shadowPop,
          }}
        >
          <div
            className="px-2 pb-1.5 text-[10px] font-bold uppercase"
            style={{ color: c.faint, letterSpacing: "0.1em" }}
          >
            Insert Context &amp; Tools
          </div>

          <div className="grid grid-cols-1 gap-1">
            {/* Category: File injection */}
            <div className="text-[9px] uppercase font-semibold px-2 pt-1 pb-0.5" style={{ color: c.dim, letterSpacing: "0.08em" }}>
              Workspace &amp; Media
            </div>
            {plusActions.slice(0, 3).map((p, idx) => {
              const Icon = plusIcons[p.icon] ?? Paperclip;
              return (
                <button
                  key={p.id}
                  onClick={() => runPlus(p.id)}
                  className="w-full flex items-start gap-2.5 px-2 py-1.5 rounded-lg text-left transition-all"
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <span className="p-1 rounded-md" style={{ backgroundColor: "rgba(255,255,255,0.02)", border: `1px solid ${c.borderSoft}` }}>
                    <Icon size={12} color={c.text} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center justify-between">
                      <span className="text-[12px] font-medium" style={{ color: c.text }}>{p.label}</span>
                      <span className="text-[9.5px]" style={{ color: c.faint, fontFamily: mono }}>⌥{idx + 1}</span>
                    </span>
                    <span className="block text-[10px]" style={{ color: c.muted }}>{p.desc}</span>
                  </span>
                </button>
              );
            })}

            {/* Category: Powerups */}
            <div className="text-[9px] uppercase font-semibold px-2 pt-2 pb-0.5" style={{ color: c.dim, letterSpacing: "0.08em" }}>
              Integration &amp; Agents
            </div>
            {plusActions.slice(3).map((p, idx) => {
              const Icon = plusIcons[p.icon] ?? Paperclip;
              return (
                <button
                  key={p.id}
                  onClick={() => runPlus(p.id)}
                  className="w-full flex items-start gap-2.5 px-2 py-1.5 rounded-lg text-left transition-all"
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <span className="p-1 rounded-md" style={{ backgroundColor: "rgba(255,255,255,0.02)", border: `1px solid ${c.borderSoft}` }}>
                    <Icon size={12} color={c.text} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center justify-between">
                      <span className="text-[12px] font-medium" style={{ color: c.text }}>{p.label}</span>
                      <span className="text-[9.5px]" style={{ color: c.faint, fontFamily: mono }}>⌥{idx + 4}</span>
                    </span>
                    <span className="block text-[10px]" style={{ color: c.muted }}>{p.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-2 pt-2 px-2 text-[9.5px] flex items-center justify-between" style={{ borderTop: `1px solid ${c.borderSoft}`, color: c.dim }}>
            <span>Tip: Drag files here to attach</span>
            <span style={{ fontFamily: mono }}>+ key</span>
          </div>
        </div>
      )}

      {/* env / mode / model on top row when requested */}
      {showEnv && env && onEnv && (
        <div className="flex items-center gap-1.5 px-3 pt-3 pb-1 flex-wrap">
          <EnvDropdown value={env} onChange={onEnv} drop={dropDirection} />
          <ModeDropdown value={mode} onChange={onMode} drop={dropDirection} />
          <ModelDropdown value={model} onChange={onModel} drop={dropDirection} />
          <div className="ml-auto">
            <EffortDropdown value={effort} onChange={onEffort} drop={dropDirection} />
          </div>
        </div>
      )}

      {/* attachments */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
          {attachments.map((a) => (
            <span
              key={a.id}
              className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg text-[11px]"
              style={{ backgroundColor: c.chip, border: `1px solid ${c.border}`, color: c.muted }}
            >
              {a.kind === "image" ? <ImageIcon size={10} /> : a.kind === "dir" ? <Folder size={10} /> : a.kind === "task" ? <Zap size={10} /> : <Paperclip size={10} />}
              <span style={{ fontFamily: mono }}>{a.label}</span>
              <button
                onClick={() => setAttachments((x) => x.filter((y) => y.id !== a.id))}
                className="p-0.5 rounded"
                style={{ color: c.faint }}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart);
          setDismissed(false);
        }}
        onKeyDown={onKeyDown}
        onKeyUp={syncCaret}
        onClick={syncCaret}
        onSelect={syncCaret}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 pt-3 pb-2 text-[13.5px] outline-none resize-none bg-transparent leading-relaxed"
        style={{ color: c.text }}
      />

      <div
        className="composerRow flex items-center gap-1.5 px-3 pb-3 pt-1 flex-wrap"
        style={{ borderTop: `1px solid ${c.borderSoft}` }}
      >
        {!showEnv && (
          <>
            <ModeDropdown value={mode} onChange={onMode} drop={dropDirection} />
            <ModelDropdown value={model} onChange={onModel} drop={dropDirection} />
          </>
        )}

        <button
          onClick={() => setPlusOpen((o) => !o)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: plusOpen ? c.text : c.muted, backgroundColor: plusOpen ? c.chipHover : "transparent" }}
          title="Add to thread"
        >
          <Plus size={14} />
        </button>

        <button className="p-1.5 rounded-lg transition-colors" style={{ color: c.muted }} title="Dictate">
          <Mic size={14} />
        </button>

        <div className="ml-auto flex items-center gap-2">
          {!showEnv && <EffortDropdown value={effort} onChange={onEffort} drop={dropDirection} />}
          {busy ? (
            <button
              onClick={onStop}
              className="rounded-full p-2 transition-all"
              style={{ backgroundColor: c.chipHover, border: `1px solid ${c.borderStrong}` }}
              title="Stop"
            >
              <Square size={12} fill={c.text} color={c.text} />
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!canSend}
              className="rounded-full p-2 transition-all"
              style={{
                backgroundColor: canSend ? c.accent : c.chip,
                border: `1px solid ${canSend ? c.accent : c.border}`,
                cursor: canSend ? "pointer" : "default",
              }}
            >
              <ArrowUp size={14} color={canSend ? "#000" : c.faint} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
