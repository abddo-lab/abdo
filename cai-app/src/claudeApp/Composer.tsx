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
  Brain,
  Check,
  FileCode2,
  Folder,
  Image as ImageIcon,
  Paperclip,
  Plug,
  Plus,
  Square,
  Wrench,
  Sparkles,
  X,
  Search,
  Upload,
} from "lucide-react";
import { c, mono } from "./theme";
import { EffortDropdown, ModeDropdown, ModelDropdown } from "./Dropdowns";
import {
  mentionTargets,
  slashCommands,
  type MentionTarget,
  type SlashCommand,
} from "./workData";
import { TOOL_DEFINITIONS } from "../services/tools";
import { BUILTIN_SKILLS } from "../services/skills";
import { mcpServers } from "./workData";

/* ---------- floating palette shell ---------- */
function Palette({ title, hint, children }: { title: string; hint: ReactNode; children: ReactNode }) {
  return (
    <div className="absolute left-0 right-0 rounded-xl overflow-hidden popIn z-50"
      style={{ bottom: "calc(100% + 8px)", backgroundColor: "rgba(12,12,12,0.95)", backdropFilter: "blur(20px) saturate(140%)", border: `1px solid ${c.borderStrong}`, boxShadow: c.shadowPop }}>
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase flex items-center gap-2"
        style={{ color: c.faint, letterSpacing: "0.09em", borderBottom: `1px solid ${c.borderSoft}` }}>
        {title}
      </div>
      <div className="max-h-[280px] overflow-y-auto py-1">{children}</div>
      <div className="px-3 py-1.5 text-[10px] flex items-center gap-3"
        style={{ borderTop: `1px solid ${c.borderSoft}`, color: c.dim, backgroundColor: "rgba(0,0,0,0.35)" }}>
        {hint}
      </div>
    </div>
  );
}

function Row({ active, onClick, onHover, children }: { active: boolean; onClick: () => void; onHover: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} onMouseEnter={onHover}
      className="w-full relative flex items-start gap-2.5 pl-3 pr-2.5 py-1.5 text-left"
      style={{ backgroundColor: active ? c.chipHover : "transparent" }}>
      {active && <span className="absolute left-0 top-1 bottom-1 rounded-r" style={{ width: 2, backgroundColor: c.accent }} />}
      {children}
    </button>
  );
}

export interface Attachment {
  id: string;
  label: string;
  kind: string;
  file?: File;
}

/* ---------- Context Counter ---------- */
function ContextCounter({ value, maxContext }: { value: number; maxContext: number }) {
  const pct = Math.min(100, (value / maxContext) * 100);
  const color = pct > 90 ? c.dim : pct > 70 ? c.dim : c.muted;
  const used = value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : `${Math.round(value / 1000)}k`;
  const max = maxContext >= 1000000 ? `${(maxContext / 1000000).toFixed(0)}M` : `${Math.round(maxContext / 1000)}k`;
  return (
    <div className="flex items-center gap-1.5 text-[10px]" style={{ fontFamily: mono, color }}>
      <div className="w-12 h-1 rounded-full overflow-hidden" style={{ backgroundColor: c.chip }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span>{used}/{max}</span>
    </div>
  );
}

/* ---------- main composer ---------- */
export default function Composer({
  value, onChange, onSubmit, onCommand, placeholder, rows = 3,
  showEnv = false, env: _env, onEnv: _onEnv,
  mode, onMode, model, onModel, effort, onEffort,
  dropDirection = "up", busy = false, onStop,
  contextTokens = 0, maxContext = 200000,
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
  contextTokens?: number;
  maxContext?: number;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const memoryFileRef = useRef<HTMLInputElement>(null);
  const [caret, setCaret] = useState(0);
  const [sel, setSel] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Plus menu state
  const [plusTab, setPlusTab] = useState<"files" | "mcp" | "skills">("files");
  const [plusOpen, setPlusOpen] = useState(false);
  const [mcpSearch, setMcpSearch] = useState("");
  const [connectedMcps, setConnectedMcps] = useState<Set<string>>(new Set());

  // File upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const f of Array.from(files)) {
      addAttachment(`file-${Date.now()}-${f.name}`, f.name, f.type.startsWith("image/") ? "image" : "file", f);
    }
    e.target.value = "";
  };

  const handleMemoryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const f of Array.from(files)) {
      if (f.name.endsWith(".md") || f.name.endsWith(".txt")) {
        addAttachment(`memory-${Date.now()}-${f.name}`, f.name, "memory", f);
      }
    }
    e.target.value = "";
  };

  const toggleMcp = (id: string) => {
    setConnectedMcps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // slash / @ triggers
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
    return mentionTargets.filter((m) => m.label.toLowerCase().includes(q) || m.sub.toLowerCase().includes(q)).slice(0, 40);
  }, [trigger]);

  const results: (SlashCommand | MentionTarget)[] = trigger?.type === "slash" ? slashResults : trigger?.type === "at" ? atResults : [];

  useEffect(() => setSel(0), [trigger?.type, trigger?.query]);

  useEffect(() => {
    if (!plusOpen) return;
    const h = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPlusOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [plusOpen]);

  const syncCaret = () => { requestAnimationFrame(() => setCaret(taRef.current?.selectionStart ?? 0)); };

  const replaceToken = (insert: string) => {
    if (!trigger) return;
    const before = value.slice(0, trigger.start);
    const after = value.slice(caret);
    const next = `${before}${insert}${after}`;
    onChange(next);
    const pos = before.length + insert.length;
    requestAnimationFrame(() => { taRef.current?.focus(); taRef.current?.setSelectionRange(pos, pos); setCaret(pos); });
  };

  const pickSlash = (s: SlashCommand) => {
    if (s.action && onCommand) {
      const before = value.slice(0, trigger?.start ?? 0);
      const after = value.slice(caret);
      onChange(`${before}${after}`);
      setCaret(before.length);
      onCommand(s);
      requestAnimationFrame(() => taRef.current?.focus());
      return;
    }
    replaceToken(`${s.cmd} `);
  };

  const pickAt = (m: MentionTarget) => replaceToken(`@${m.label} `);
  const commit = (i: number) => { if (trigger?.type === "slash") pickSlash(slashResults[i]); else if (trigger?.type === "at") pickAt(atResults[i]); };

  const send = () => { const text = value.trim(); if (!text && !attachments.length) return; onSubmit(text, attachments); setAttachments([]); };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (results.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => (s + 1) % results.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => (s - 1 + results.length) % results.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); commit(sel); return; }
      if (e.key === "Escape") { e.preventDefault(); setDismissed(true); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const addAttachment = (id: string, label: string, kind: string, file?: File) =>
    setAttachments((a) => (a.some((x) => x.id === id) ? a : [...a, { id, label, kind, file }]));

  const canSend = !!value.trim() || attachments.length > 0;

  const filteredMcp = mcpServers.filter((m) => !mcpSearch || m.name.toLowerCase().includes(mcpSearch.toLowerCase()));

  return (
    <div ref={wrapRef} className="relative rounded-2xl" style={{ backgroundColor: c.input, border: `1px solid ${c.border}`, boxShadow: c.shadow }}>
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} accept="*/*" />
      <input ref={memoryFileRef} type="file" multiple className="hidden" onChange={handleMemoryUpload} accept=".md,.txt,.markdown" />

      {/* slash palette */}
      {trigger?.type === "slash" && slashResults.length > 0 && (
        <Palette title={`Commands · ${slashResults.length}`}
          hint={<><span style={{ fontFamily: mono }}>↑↓</span> navigate <span style={{ fontFamily: mono }}>⏎</span> run <span style={{ fontFamily: mono }}>esc</span> dismiss</>}>
          {slashResults.map((s, i) => (
            <Row key={s.cmd} active={i === sel} onClick={() => commit(i)} onHover={() => setSel(i)}>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[12.5px] font-medium" style={{ color: c.text, fontFamily: mono }}>{s.cmd}</span>
                  {s.args && <span className="text-[10.5px]" style={{ color: c.dim, fontFamily: mono }}>{s.args}</span>}
                  <span className="ml-auto text-[9.5px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: c.chip, color: c.faint }}>{s.group}</span>
                </span>
                <span className="block text-[11px] mt-0.5" style={{ color: c.muted }}>{s.desc}</span>
              </span>
            </Row>
          ))}
        </Palette>
      )}

      {/* @ palette */}
      {trigger?.type === "at" && atResults.length > 0 && (
        <Palette title={`Add context · ${atResults.length}`}
          hint={<><span style={{ fontFamily: mono }}>↑↓</span> navigate <span style={{ fontFamily: mono }}>⏎</span> insert <span style={{ fontFamily: mono }}>esc</span> dismiss</>}>
          {atResults.map((m, i) => (
            <Row key={m.id} active={i === sel} onClick={() => commit(i)} onHover={() => setSel(i)}>
              <FileCode2 size={12} color={i === sel ? c.text : c.faint} className="mt-0.5 flex-shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[12.5px] truncate" style={{ color: c.text, fontFamily: mono }}>{m.label}</span>
                  <span className="ml-auto text-[9.5px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: c.chip, color: c.faint }}>{m.kind}</span>
                </span>
                <span className="block text-[10.5px] truncate" style={{ color: c.muted }}>{m.sub}</span>
              </span>
            </Row>
          ))}
        </Palette>
      )}

      {/* ─── Plus Menu ─── */}
      {plusOpen && (
        <div className="absolute rounded-2xl overflow-hidden popIn z-50"
          style={{ bottom: "calc(100% + 8px)", left: 0, width: 380, backgroundColor: "rgba(10,10,10,0.96)", backdropFilter: "blur(26px) saturate(140%)", border: `1px solid ${c.borderStrong}`, boxShadow: c.shadowPop }}>

          {/* Tab bar */}
          <div className="flex items-center gap-0.5 px-2 pt-2 pb-1 overflow-x-auto">
            {([
              { id: "files" as const, label: "Files", icon: Upload },
              { id: "mcp" as const, label: "MCPs", icon: Plug },
              { id: "skills" as const, label: "Skills", icon: Sparkles },
            ]).map((tab) => (
              <button key={tab.id} onClick={() => setPlusTab(tab.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-medium transition-colors whitespace-nowrap"
                style={{ backgroundColor: plusTab === tab.id ? c.chipHover : "transparent", color: plusTab === tab.id ? c.text : c.muted }}>
                <tab.icon size={11} /> {tab.label}
              </button>
            ))}
          </div>

          <div className="max-h-[360px] overflow-y-auto px-2 pb-2">
            {/* ─── FILES TAB ─── */}
            {plusTab === "files" && (
              <div className="space-y-1">
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-start gap-2.5 px-2 py-1.5 rounded-lg text-left"
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                  <span className="p-1 rounded-md" style={{ backgroundColor: "rgba(255,255,255,0.02)", border: `1px solid ${c.borderSoft}` }}><Upload size={12} color={c.text} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="text-[12px] font-medium" style={{ color: c.text }}>Upload files</span>
                    <span className="block text-[10px]" style={{ color: c.muted }}>Images, logs, docs, code -- any file</span>
                  </span>
                </button>
                <button onClick={() => memoryFileRef.current?.click()}
                  className="w-full flex items-start gap-2.5 px-2 py-1.5 rounded-lg text-left"
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                  <span className="p-1 rounded-md" style={{ backgroundColor: "rgba(255,255,255,0.02)", border: `1px solid ${c.borderSoft}` }}><Brain size={12} color={c.text} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="text-[12px] font-medium" style={{ color: c.text }}>Upload memory file</span>
                    <span className="block text-[10px]" style={{ color: c.muted }}>.md or .txt for persistent context</span>
                  </span>
                </button>
              </div>
            )}

            {/* ─── MCP TAB ─── */}
            {plusTab === "mcp" && (
              <div>
                <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}`, borderRadius: 8 }}>
                  <Search size={11} color={c.dim} />
                  <input value={mcpSearch} onChange={(e) => setMcpSearch(e.target.value)} placeholder="Search MCP servers..." className="flex-1 bg-transparent text-[11px] outline-none" style={{ color: c.text }} />
                </div>
                <div className="space-y-0.5">
                  {filteredMcp.map((m) => (
                    <div key={m.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg"
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                      <span className="text-[16px]">{m.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-medium" style={{ color: c.text }}>{m.name}</span>
                          <span className="text-[8px] px-1 py-[1px] rounded" style={{ backgroundColor: c.chip, color: c.dim }}>{m.authType}</span>
                        </div>
                        <div className="text-[10px]" style={{ color: c.muted }}>{m.desc}</div>
                      </div>
                      <button onClick={() => toggleMcp(m.id)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all"
                        style={{
                          backgroundColor: connectedMcps.has(m.id) ? "rgba(74,222,128,.15)" : c.chip,
                          border: `1px solid ${connectedMcps.has(m.id) ? "rgba(74,222,128,.3)" : c.border}`,
                          color: connectedMcps.has(m.id) ? "#4ade80" : c.muted,
                        }}>
                        {connectedMcps.has(m.id) ? "Connected" : "Connect"}
                      </button>
                    </div>
                  ))}
                </div>
                {filteredMcp.length === 0 && <div className="text-center py-6 text-[11px]" style={{ color: c.dim }}>No matching MCP servers.</div>}
              </div>
            )}

            {/* ─── SKILLS TAB ─── */}
            {plusTab === "skills" && (
              <div className="space-y-0.5">
                {BUILTIN_SKILLS.map((skill) => (
                  <button key={skill.id}
                    onClick={() => { onChange(value + (value.endsWith(" ") ? "" : " ") + `/skill ${skill.id} `); setPlusOpen(false); taRef.current?.focus(); }}
                    className="w-full flex items-start gap-2.5 px-2 py-1.5 rounded-lg text-left"
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                    <span className="p-1 rounded-md" style={{ backgroundColor: "rgba(255,255,255,0.02)", border: `1px solid ${c.borderSoft}` }}><Sparkles size={10} color={c.text} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="text-[11.5px] font-medium" style={{ color: c.text }}>{skill.name}</span>
                        <span className="text-[8px] px-1 py-[1px] rounded" style={{ backgroundColor: c.chip, color: c.dim }}>{skill.category}</span>
                      </span>
                      <span className="block text-[10px]" style={{ color: c.muted }}>{skill.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-1 pt-1.5 px-3 pb-1.5 flex items-center justify-between" style={{ borderTop: `1px solid ${c.borderSoft}`, color: c.dim, backgroundColor: "rgba(0,0,0,0.35)" }}>
            <span className="text-[9.5px]">{mcpServers.length} MCP servers · {BUILTIN_SKILLS.length} skills</span>
            <span className="text-[9.5px]" style={{ fontFamily: mono }}>esc close</span>
          </div>
        </div>
      )}

      {/* env / mode / model on top row when requested */}
      {showEnv && (
        <div className="flex items-center gap-1.5 px-3 pt-3 pb-1 flex-wrap">
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
            <span key={a.id} className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg text-[11px]"
              style={{ backgroundColor: c.chip, border: `1px solid ${c.border}`, color: c.muted }}>
              {a.kind === "image" ? <ImageIcon size={10} /> : a.kind === "memory" ? <Brain size={10} color={c.accent} /> : a.kind === "dir" ? <Folder size={10} /> : <Paperclip size={10} />}
              <span style={{ fontFamily: mono }}>{a.label}</span>
              <button onClick={() => setAttachments((x) => x.filter((y) => y.id !== a.id))} className="p-0.5 rounded" style={{ color: c.faint }}>
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => { onChange(e.target.value); setCaret(e.target.selectionStart); setDismissed(false); }}
        onKeyDown={onKeyDown}
        onKeyUp={syncCaret}
        onClick={syncCaret}
        onSelect={syncCaret}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 pt-3 pb-2 text-[13.5px] outline-none resize-none bg-transparent leading-relaxed"
        style={{ color: c.text }}
      />

      <div className="composerRow flex items-center gap-1.5 px-3 pb-3 pt-1 flex-wrap" style={{ borderTop: `1px solid ${c.borderSoft}` }}>
        {!showEnv && (
          <>
            <ModeDropdown value={mode} onChange={onMode} drop={dropDirection} />
            <ModelDropdown value={model} onChange={onModel} drop={dropDirection} />
          </>
        )}

        {/* Plus button */}
        <button onClick={() => { setPlusOpen((o) => !o); if (!plusOpen) setPlusTab("files"); }}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: plusOpen ? c.text : c.muted, backgroundColor: plusOpen ? c.chipHover : "transparent" }}
          title="Upload files, connect MCPs, or use skills">
          <Plus size={14} />
        </button>

        <div className="ml-auto flex items-center gap-2">
          <ContextCounter value={contextTokens} maxContext={maxContext ?? 200000} />
          {!showEnv && <EffortDropdown value={effort} onChange={onEffort} drop={dropDirection} />}
          {busy ? (
            <button onClick={onStop} className="rounded-full p-2 transition-all"
              style={{ backgroundColor: c.chipHover, border: `1px solid ${c.borderStrong}` }} title="Stop">
              <Square size={12} fill={c.text} color={c.text} />
            </button>
          ) : (
            <button onClick={send} disabled={!canSend} className="rounded-full p-2 transition-all"
              style={{ backgroundColor: canSend ? c.accent : c.chip, border: `1px solid ${canSend ? c.accent : c.border}`, cursor: canSend ? "pointer" : "default" }}>
              <ArrowUp size={14} color={canSend ? "#000" : c.faint} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
