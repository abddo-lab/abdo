import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MonacoEditor from "@monaco-editor/react";
import { cn } from "../utils/cn";
import { Icon, type IconName } from "../icons";
import { highlight } from "../highlight";
import type { CodeFile, DiffFile, Project } from "../data";
import { Badge, Btn, IconBtn } from "./ui";
import * as api from "../api";

export type PanelTab = "preview" | "changes" | "editor";

interface Props {
  project: Project;
  files: DiffFile[];
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  onToast: (m: string) => void;
  threadId?: string;
}

const base = (p: string) => p.split("/").pop() ?? p;

/* --------------------------------- Preview -------------------------------- */

const DEVICES = [
  { id: "desktop", label: "Desktop", w: "100%", icon: "monitor" as IconName },
  { id: "tablet", label: "Tablet", w: "768px", icon: "tablet" as IconName },
  { id: "mobile", label: "Mobile", w: "380px", icon: "phone" as IconName },
];

/**
 * Live preview backed by a real Cloudflare quick tunnel. When the panel opens
 * it (re)deploys the project from its sandbox and polls until the tunnel URL
 * is live, then renders the app inside an iframe.
 */
function LivePreview({ project, threadId, onToast, width }: { project: Project; threadId?: string; onToast: (m: string) => void; width?: string }) {
  const [state, setState] = useState<"idle" | "provisioning" | "live" | "error">("idle");
  const [url, setUrl] = useState("");
  const [deploying, setDeploying] = useState(false);

  const startDeploy = useCallback(async () => {
    setDeploying(true);
    try {
      const created = await api.deployments.create({ project_id: project.id, thread_id: threadId || "" });
      const deploymentId = created.id;
      // Poll until the quick tunnel URL is ready
      const deadline = Date.now() + 240000; // 4 min max
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 4000));
        const list = await api.deployments.list();
        const dep = (list.deployments || []).find((d: any) => d.id === deploymentId);
        if (dep?.status === "live" && dep.url) {
          setUrl(dep.url);
          setState("live");
          setDeploying(false);
          return;
        }
        if (dep?.status === "error") {
          setState("error");
          setDeploying(false);
          return;
        }
      }
      setState("error");
    } catch (err: any) {
      setState("error");
      onToast(err.message || "Deploy failed");
    } finally {
      setDeploying(false);
    }
  }, [project.id, threadId, onToast]);

  // Look for an existing live deployment first; if none, deploy
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.deployments.list();
        const dep = (list.deployments || [])
          .filter((d: any) => d.project_id === project.id)
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        if (cancelled) return;
        if (dep?.status === "live" && dep.url) {
          setUrl(dep.url);
          setState("live");
        } else if (dep?.status === "provisioning") {
          setState("provisioning");
          // keep polling the existing deployment
          const deadline = Date.now() + 240000;
          while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 4000));
            const again = await api.deployments.list();
            const d = (again.deployments || []).find((x: any) => x.id === dep.id);
            if (cancelled) return;
            if (d?.status === "live" && d.url) { setUrl(d.url); setState("live"); return; }
            if (d?.status === "error") { setState("error"); return; }
          }
          setState("error");
        } else {
          await startDeploy();
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => { cancelled = true; };
  }, [project.id, startDeploy]);

  const reload = () => {
    onToast("Deploying fresh preview…");
    startDeploy();
  };

  if (state === "provisioning" || (state === "idle" && deploying)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <Icon name="spinner" size={20} className="a-spin text-[var(--accent)]" />
        <div>
          <p className="text-[13px] font-semibold text-[var(--text)]">Provisioning preview…</p>
          <p className="max-w-[280px] pt-1 text-[11.5px] leading-relaxed text-[var(--muted)]">
            Spinning up a Cloudflare quick tunnel for <span className="font-mono">{project.name}</span>. This can take up to a minute.
          </p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--red-soft)] text-[var(--red)]">
          <Icon name="alert" size={18} />
        </span>
        <div>
          <p className="text-[13px] font-semibold text-[var(--text)]">Preview unavailable</p>
          <p className="max-w-[300px] pt-1 text-[11.5px] leading-relaxed text-[var(--muted)]">
            Could not reach the tunnel. Make sure your dev server is listening on port 3000 inside the sandbox, then retry.
          </p>
        </div>
        <Btn variant="accent" icon="refresh" onClick={reload}>Deploy again</Btn>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex flex-1 justify-center overflow-hidden bg-[var(--panel-3)]">
        <iframe
          key={url}
          src={url}
          title={`Preview · ${project.name}`}
          style={{ width: width || "100%" }}
          className="h-full border-0 bg-white shadow-[var(--shadow-md)]"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
      </div>
        <div className="flex h-7 shrink-0 items-center gap-2 border-t border-[var(--border)] bg-[var(--chrome)] px-3">
          <Icon name="monitor" size={11} className="text-[var(--accent)]" />
          <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-[var(--muted)]">{url}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
        >
          Open <Icon name="external" size={10} />
        </a>
        <button
          onClick={reload}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--muted)] transition hover:bg-[var(--panel-3)] hover:text-[var(--text)]"
        >
          <Icon name="refresh" size={10} /> Redeploy
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- Changes / Diffs -------------------------------- */

function DiffFileView({ file, onToast }: { file: DiffFile; onToast: (m: string) => void }) {
  const [open, setOpen] = useState(true);
  let o = file.startOld;
  let n = file.startNew;
  return (
    <div id={`file-${file.id}`} className="border-b border-[var(--border)]">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-1.5">
        <button onClick={() => setOpen((v) => !v)} className="text-[var(--faint)] hover:text-[var(--text)]">
          <Icon name="chevRight" size={11} strokeWidth={2.2} className={cn("transition-transform", open && "rotate-90")} />
        </button>
        <Badge tone={file.status === "added" ? "green" : "muted"} className="!px-1.5 !text-[9.5px]">
          {file.status === "added" ? "NEW" : "MOD"}
        </Badge>
        <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-[var(--muted)]">{file.path}</span>
        <span className="font-mono text-[11px] font-semibold text-[var(--green)]">+{file.add}</span>
        <span className="font-mono text-[11px] font-semibold text-[var(--red)]">−{file.del}</span>
        <IconBtn icon="copy" size={12} title="Copy" onClick={() => onToast(`Copied ${base(file.path)}`)} />
        <IconBtn icon="close" size={12} title="Reject" onClick={() => onToast(`Rejected ${base(file.path)}`)} />
        <IconBtn icon="check" size={12} title="Accept" onClick={() => onToast(`Accepted ${base(file.path)}`)} />
      </div>
      {open && (
        <div className="overflow-x-auto py-1 font-mono text-[12px] leading-[1.7]">
          {file.lines.map((line, i) => {
            let oldN: string | number = "";
            let newN: string | number = "";
            if (line.t === "ctx") {
              o += 1;
              n += 1;
              oldN = o;
              newN = n;
            } else if (line.t === "add") {
              n += 1;
              newN = n;
            } else {
              o += 1;
              oldN = o;
            }
            const bg = line.t === "add" ? "bg-[var(--add-bg)]" : line.t === "del" ? "bg-[var(--del-bg)]" : "";
            const gut = line.t === "add" ? "bg-[var(--add-gut)]" : line.t === "del" ? "bg-[var(--del-gut)]" : "";
            return (
              <div key={i}>
                <div className={cn("group flex whitespace-pre", bg)}>
                  <span className={cn("w-10 shrink-0 select-none pr-2 text-right text-[10.5px] text-[var(--faint)]", gut)}>{oldN}</span>
                  <span className={cn("w-10 shrink-0 select-none pr-2 text-right text-[10.5px] text-[var(--faint)]", gut)}>{newN}</span>
                  <span
                    className={cn(
                      "w-4 shrink-0 select-none text-center text-[11px]",
                      gut,
                      line.t === "add" ? "text-[var(--add-ink)]" : line.t === "del" ? "text-[var(--del-ink)]" : "text-transparent",
                    )}
                  >
                    {line.t === "add" ? "+" : line.t === "del" ? "−" : "·"}
                  </span>
                  <span className="flex-1 pl-2 pr-6">{line.text ? highlight(line.text) : " "}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* --------------------------- Dev-server console feed --------------------------- */

interface ConsoleLine {
  id: number;
  kind: "info" | "ok" | "warn" | "error" | "net";
  text: string;
}

/** Simulated Vite dev-server console with hot-reload + browser errors. */
function ConsoleFeed({ file, trigger }: { file: string; trigger: number }) {
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [expanded, setExpanded] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const seed: ConsoleLine[] = [
      { id: 1, kind: "ok", text: "VITE v5.4.0  ready in 480 ms" },
      { id: 2, kind: "info", text: "➜  Local:   http://localhost:5173/" },
      { id: 3, kind: "net", text: "GET / 200  (application/xhtml+xml)" },
      { id: 4, kind: "net", text: "GET /src/main.tsx 200  (text/javascript)" },
    ];
    setLines(seed);
  }, []);

  useEffect(() => {
    if (trigger === 0) return;
    const id = Date.now();
    setLines((prev) => [
      ...prev.slice(-80),
      { id, kind: "info", text: `[vite] page reload ${file} · hmr update` },
      { id: id + 1, kind: "net", text: `[vite] server warmed up in ${Math.round(150 + Math.random() * 250)} ms` },
    ]);
  }, [trigger, file]);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  const kindColor: Record<ConsoleLine["kind"], string> = {
    info: "text-[var(--blue)]",
    ok: "text-[var(--green)]",
    warn: "text-[var(--amber)]",
    error: "text-[var(--red)]",
    net: "text-[var(--faint)]",
  };

  return (
    <div className="flex h-full flex-col bg-[var(--chrome)]">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--panel-2)] px-3">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--green)] a-pulse-soft" />
          Dev server · localhost:5173
        </span>
        <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-[var(--green)]">
          <Icon name="zap" size={10} /> hot reload on
        </span>
        <IconBtn icon={expanded ? "chevDown" : "chevRight"} size={11} onClick={() => setExpanded((v) => !v)} title="Toggle console" />
      </div>
      {expanded && (
        <div ref={ref} className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[10.5px] leading-[1.8]">
          {lines.map((l) => (
            <div key={l.id} className={cn("a-in flex items-start gap-2", kindColor[l.kind])}>
              <span className="select-none opacity-50">{l.kind === "ok" ? "✓" : l.kind === "error" ? "✕" : l.kind === "warn" ? "!" : "›"}</span>
              <span className="min-w-0 break-all">{l.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Upgraded Code Editor -------------------------------- */

interface InlineEditState {
  instruction: string;
  selection?: { startLine?: number; endLine?: number; text?: string };
}

function InlineEditPopover({
  onSubmit,
  onClose,
}: {
  onSubmit: (state: InlineEditState) => void;
  onClose: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  return (
    <div className="a-pop absolute left-1/2 top-3 z-40 w-[520px] max-w-[92%] -translate-x-1/2 overflow-hidden rounded-xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent)]">
          <Icon name="sparkle" size={12} />
          Edit with Kiren
        </span>
        <span className="ml-auto rounded-md bg-[var(--panel-3)] px-1.5 py-0.5 font-mono text-[9.5px] text-[var(--faint)]">⌘K</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <input
          ref={inputRef}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && instruction.trim()) onSubmit({ instruction: instruction.trim() });
            if (e.key === "Escape") onClose();
          }}
          placeholder="Describe the edit, e.g. rename `delay` to `debounce` and add a helper…"
          className="w-full bg-transparent text-[12.5px] text-[var(--text)] outline-none placeholder:text-[var(--faint)]"
        />
        <button
          onClick={() => instruction.trim() && onSubmit({ instruction: instruction.trim() })}
          title="Send edit"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--accent)] text-white transition hover:bg-[var(--accent-2)] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!instruction.trim()}
        >
          <Icon name="send" size={13} />
        </button>
      </div>
      <div className="flex items-center gap-3 border-t border-[var(--border)] px-3 py-1.5 text-[10px] text-[var(--faint)]">
        <span>Enter to apply · Esc to cancel</span>
        <span className="ml-auto flex items-center gap-1">
          <Icon name="keyboard" size={10} /> Uses your selected code as context
        </span>
      </div>
    </div>
  );
}

function InlineDiffView({
  path,
  diff,
  lines,
  onAccept,
  onReject,
}: {
  path: string;
  diff: { t: "add" | "del" | "ctx"; text: string }[];
  lines: { add: number; del: number; startOld: number; startNew: number };
  onAccept: () => void;
  onReject: () => void;
}) {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="a-pop absolute inset-x-3 top-3 z-40 overflow-hidden rounded-xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--panel-2)] px-3 py-2">
        <Icon name="fileDiff" size={13} className="text-[var(--accent)]" />
        <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] font-semibold text-[var(--text)]">{path}</span>
        <span className="font-mono text-[10.5px] font-bold text-[var(--green)]">+{lines.add}</span>
        <span className="font-mono text-[10.5px] font-bold text-[var(--red)]">−{lines.del}</span>
        <IconBtn icon="close" size={12} onClick={onReject} title="Discard" />
      </div>
      <div className="max-h-[46vh] overflow-auto">
        <pre className="px-2 py-1.5 font-mono text-[11px] leading-[1.65]">
          {diff.map((l, i) => (
            <div
              key={i}
              className={cn(
                "whitespace-pre rounded-sm px-1",
                l.t === "add" && "bg-[var(--add-bg)] text-[var(--add-ink)]",
                l.t === "del" && "bg-[var(--del-bg)] text-[var(--del-ink)]",
              )}
            >
              <span className="select-none pr-1.5 opacity-60">{l.t === "add" ? "+" : l.t === "del" ? "−" : " "}</span>
              {l.t === "ctx" ? highlight(l.text) : l.text}
            </div>
          ))}
        </pre>
      </div>
      <div className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--panel-2)] px-3 py-2">
        <span className="text-[10.5px] text-[var(--muted)]">
          {accepted ? "Applied to file." : "Kiren edited this file — review and accept."}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <Btn variant="ghost" className="!px-2.5 !py-1 !text-[11px]" disabled={accepted} onClick={onReject}>
            Reject
          </Btn>
          <Btn variant="accent" className="!px-2.5 !py-1 !text-[11px]" disabled={accepted} onClick={() => { onAccept(); setAccepted(true); }}>
            <Icon name="check" size={11} /> Accept
          </Btn>
        </span>
      </div>
    </div>
  );
}

function CodeEditor({
  file,
  onSave,
  threadId,
  onToast,
}: {
  file: CodeFile;
  onSave: (v: string) => void;
  threadId?: string;
  onToast: (m: string) => void;
}) {
  const [value, setValue] = useState(file.content);
  const [inlineOpen, setInlineOpen] = useState(false);
  const [selection, setSelection] = useState<InlineEditState["selection"]>(undefined);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Awaited<ReturnType<typeof api.threads.inlineEdit>> | null>(null);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    setValue(file.content);
    setPending(null);
  }, [file.path, file.content]);

  const startInline = useCallback(() => {
    setInlineOpen(true);
    setPending(null);
  }, []);

  const runInlineEdit = useCallback(async (state: InlineEditState) => {
    if (!threadId || !state.instruction.trim()) return;
    setBusy(true);
    try {
      const res = await api.threads.inlineEdit(threadId, {
        path: file.path,
        content: value,
        instruction: state.instruction,
        selection: selection ?? state.selection,
      });
      setPending(res);
      setInlineOpen(false);
    } catch (err: any) {
      onToast(err.message || "Inline edit failed");
    } finally {
      setBusy(false);
    }
  }, [threadId, file.path, value, selection, onToast]);

  const applyEdit = useCallback(() => {
    if (!pending) return;
    setValue(pending.newContent);
    onSave(pending.newContent);
    setPending(null);
    onToast(`Applied edit to ${base(file.path)}`);
  }, [pending, onSave, onToast, file.path]);

  return (
    <div className="relative h-full">
      {inlineOpen && (
        <InlineEditPopover
          onSubmit={(s) => runInlineEdit({ ...s, selection: selection ?? s.selection })}
          onClose={() => setInlineOpen(false)}
        />
      )}
      {pending && (
        <InlineDiffView
          path={pending.path}
          diff={pending.diff}
          lines={pending.lines}
          onAccept={applyEdit}
          onReject={() => setPending(null)}
        />
      )}
      {busy && (
        <div className="absolute left-1/2 top-3 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--border-2)] bg-[var(--panel)] px-3 py-1.5 shadow-[var(--shadow-lg)]">
          <Icon name="spinner" size={12} className="a-spin text-[var(--accent)]" />
          <span className="text-[11px] text-[var(--muted)]">Kiren is editing…</span>
        </div>
      )}
      <MonacoEditor
        key={file.path}
        height="100%"
        language={file.lang}
        theme="vs"
        value={value}
        onMount={(editor, m) => {
          editorRef.current = editor;
          editor.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyK, () => {
            const sel = editor.getSelection();
            const model = editor.getModel();
            if (!sel || !model) return startInline();
            const text = model.getValueInRange(sel);
            if (text && !sel.isEmpty()) {
              setSelection({ startLine: sel.startLineNumber, endLine: sel.endLineNumber, text });
            }
            startInline();
          });
        }}
        onChange={(v) => {
          setValue(v ?? "");
          onSave(v ?? "");
        }}
        loading={
          <div className="flex h-full items-center justify-center gap-2 text-[12px] text-[var(--faint)]">
            <Icon name="spinner" size={13} className="a-spin" /> Loading editor…
          </div>
        }
        options={{
          fontSize: 12.5,
          fontFamily: "JetBrains Mono, monospace",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          padding: { top: 12 },
          renderLineHighlight: "gutter",
          lineNumbersMinChars: 3,
          tabSize: 2,
        }}
      />
    </div>
  );
}

/* ─────────────────────── Folder-aware file tree ────────────────────────── */

interface FolderNode {
  name: string;
  path: string;           // full path for files, prefix for folders
  isDir: boolean;
  children: FolderNode[];
}

function buildTree(files: { path: string }[]): FolderNode[] {
  const root: FolderNode[] = [];
  for (const f of files) {
    const parts = f.path.split("/");
    let level = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isDir = i < parts.length - 1;
      const pathSoFar = parts.slice(0, i + 1).join("/");
      let node = level.find((n) => n.name === name);
      if (!node) {
        node = { name, path: pathSoFar, isDir, children: [] };
        level.push(node);
      }
      level = node.children;
    }
  }
  return root;
}

function FileTreeNode({
  node, openFile, dirty, depth, onSelect,
}: {
  node: FolderNode;
  openFile: string;
  dirty: Record<string, string>;
  depth: number;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const indent = depth * 12;

  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-1 px-2 py-1 text-left transition hover:bg-[var(--panel-2)]"
          style={{ paddingLeft: `${8 + indent}px` }}
        >
          <Icon
            name="chevRight"
            size={10}
            strokeWidth={2.2}
            className={cn("shrink-0 text-[var(--faint)] transition-transform", open && "rotate-90")}
          />
          <Icon name="folder" size={12} className="shrink-0 text-[var(--muted)]" />
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--muted)]">{node.name}</span>
        </button>
        {open && node.children.map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            openFile={openFile}
            dirty={dirty}
            depth={depth + 1}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }

  const active = openFile === node.path;
  return (
    <button
      onClick={() => onSelect(node.path)}
      className={cn(
        "flex w-full items-center gap-1.5 py-1 text-left transition",
        active ? "bg-[var(--panel)] font-semibold text-[var(--text)]" : "text-[var(--muted)] hover:bg-[var(--panel-2)]",
      )}
      style={{ paddingLeft: `${20 + indent}px`, paddingRight: "8px" }}
    >
      <Icon name="file" size={11} className={active ? "shrink-0 text-[var(--accent)]" : "shrink-0 text-[var(--faint)]"} />
      <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{node.name}</span>
      {dirty[node.path] !== undefined && (
        <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
      )}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

export default function RightPanel({
  project,
  files,
  tab,
  onTab,
  onToast,
  threadId,
}: Props) {
  const [device, setDevice] = useState("desktop");
  const [openFile, setOpenFile] = useState(project.code[0]?.path ?? "");
  const [openTabs, setOpenTabs] = useState<string[]>([project.code[0]?.path ?? ""]);
  const [fileFilter, setFileFilter] = useState("");
  const [showTree, setShowSideTree] = useState(true);
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [split, setSplit] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);

  const code = useMemo(
    () => project.code.find((c) => c.path === openFile) ?? project.code[0],
    [project.code, openFile],
  );

  const filteredCodeFiles = useMemo(
    () => project.code.filter((c) => c.path.toLowerCase().includes(fileFilter.toLowerCase())),
    [project.code, fileFilter],
  );

  const fileTree = useMemo(() => buildTree(filteredCodeFiles), [filteredCodeFiles]);

  const totals = useMemo(
    () => files.reduce((a, f) => ({ add: a.add + f.add, del: a.del + f.del }), { add: 0, del: 0 }),
    [files],
  );

  const handleSelectFile = (path: string) => {
    setOpenFile(path);
    if (!openTabs.includes(path)) setOpenTabs((prev) => [...prev, path]);
  };

  const handleCloseTab = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const nextTabs = openTabs.filter((t) => t !== path);
    setOpenTabs(nextTabs);
    if (openFile === path && nextTabs.length > 0) setOpenFile(nextTabs[nextTabs.length - 1]);
  };

  const TABS: { id: PanelTab; label: string; icon: IconName }[] = [
    { id: "preview", label: "Preview", icon: "monitor" },
    { id: "changes", label: "Changes", icon: "fileDiff" },
    { id: "editor", label: "Editor", icon: "code" },
  ];

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-[var(--app)]">
      {/* Workspace Panel Navigation Bar */}
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-[var(--border)] px-2.5">
        <div className="flex rounded-lg border border-[var(--border)] bg-[var(--panel-3)] p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition",
                tab === t.id ? "bg-[var(--panel)] text-[var(--text)] shadow-[var(--shadow-sm)]" : "text-[var(--muted)] hover:text-[var(--text)]",
              )}
            >
              <Icon name={t.icon} size={12} className={tab === t.id ? "text-[var(--accent)]" : ""} />
              {t.label}
              {t.id === "changes" && files.length > 0 && (
                <span className="rounded-full bg-[var(--panel-3)] px-1.5 text-[9.5px] font-bold text-[var(--text)]">
                  {files.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "preview" && (
          <>
            <div className="ml-1 flex rounded-lg border border-[var(--border)] bg-[var(--panel)] p-0.5">
              {DEVICES.map((d) => (
                <IconBtn key={d.id} icon={d.icon} size={12} active={device === d.id} onClick={() => setDevice(d.id)} title={d.label} />
              ))}
            </div>
            <div className="ml-1 flex rounded-lg border border-[var(--border)] bg-[var(--panel)] p-0.5">
              <IconBtn icon="terminal" size={12} active={consoleOpen} onClick={() => setConsoleOpen((v) => !v)} title="Dev console" />
            </div>
          </>
        )}

        {tab === "editor" && (
          <div className="ml-1 flex rounded-lg border border-[var(--border)] bg-[var(--panel)] p-0.5">
            <IconBtn icon="columns" size={12} active={split} onClick={() => setSplit((v) => !v)} title="Split: editor + preview" />
            <IconBtn icon="terminal" size={12} active={consoleOpen} onClick={() => setConsoleOpen((v) => !v)} title="Dev console" />
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {tab === "changes" && (
            <>
              <span className="font-mono text-[11px] font-bold text-[var(--green)]">+{totals.add}</span>
              <span className="font-mono text-[11px] font-bold text-[var(--red)]">−{totals.del}</span>
            </>
          )}
          {tab === "editor" && Object.keys(dirty).length > 0 && (
            <Btn variant="soft" icon="save" className="!py-1 !text-[11px]" onClick={() => { setDirty({}); onToast("Saved to workspace"); }}>
              Save {Object.keys(dirty).length}
            </Btn>
          )}
        </div>
      </div>

      {/* Main Panel Content Body */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Tab 1: Clean Live Preview (Cloudflare quick tunnel iframe) */}
        {tab === "preview" && (
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1 bg-[var(--panel-3)]">
              <LivePreview project={project} threadId={threadId} onToast={onToast} width={DEVICES.find((d) => d.id === device)?.w} />
            </div>
            {consoleOpen && (
              <div className="h-[38%] shrink-0 border-t border-[var(--border)]">
                <ConsoleFeed file={openFile || project.code[0]?.path || ""} trigger={Object.keys(dirty).length} />
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Changes / Diffs View */}
        {tab === "changes" && (
          <div className="h-full overflow-y-auto">
            {files.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--panel-3)] text-[var(--text)]">
                  <Icon name="fileDiff" size={20} />
                </span>
                <p className="text-[13px] font-semibold text-[var(--text)]">No changes yet</p>
                <p className="max-w-[250px] text-[12px] leading-relaxed text-[var(--muted)]">
                  Diffs created by agent threads land here for review and approval.
                </p>
              </div>
            ) : (
              <>
                {files.map((f) => (
                  <DiffFileView key={f.id} file={f} onToast={onToast} />
                ))}
                <div className="h-10" />
              </>
            )}
          </div>
        )}

        {/* Tab 3: Upgraded Editor Workspace */}
        {tab === "editor" && (
          <div className="flex h-full">
            {/* File Tree Sidebar Panel */}
            {showTree && (
              <div className="w-[210px] shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--chrome)]">
                {/* File Tree Header & Search */}
                <div className="p-2 border-b border-[var(--border)]">
                  <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1">
                    <Icon name="search" size={11} className="text-[var(--faint)]" />
                    <input
                      value={fileFilter}
                      onChange={(e) => setFileFilter(e.target.value)}
                      placeholder="Search files…"
                      className="w-full bg-transparent text-[11px] outline-none placeholder:text-[var(--faint)]"
                    />
                  </div>
                </div>

                {/* File Tree List */}
                <div className="flex-1 overflow-y-auto py-1">
                  {fileTree.map((node) => (
                    <FileTreeNode
                      key={node.path}
                      node={node}
                      openFile={openFile}
                      dirty={dirty}
                      depth={0}
                      onSelect={handleSelectFile}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Editor + optional live preview (split view) */}
            <div className={cn("flex min-w-0 flex-1 flex-col", split && "max-w-[55%] border-r border-[var(--border)]")}>
              {/* Editor Tabs & Controls Toolbar */}
              <div className="flex h-9 shrink-0 items-center border-b border-[var(--border)] bg-[var(--panel-2)] px-2">
                <IconBtn
                  icon="panel"
                  size={12}
                  active={showTree}
                  onClick={() => setShowSideTree((v) => !v)}
                  title="Toggle file tree"
                />

                {/* Tab Bar */}
                <div className="flex flex-1 items-center gap-1 overflow-x-auto no-scrollbar px-2">
                  {openTabs.map((path) => {
                    const active = openFile === path;
                    return (
                      <div
                        key={path}
                        onClick={() => setOpenFile(path)}
                        className={cn(
                          "group flex items-center gap-1.5 rounded-t-md border-b-2 px-2.5 py-1 text-[11px] font-mono cursor-pointer transition",
                          active
                            ? "border-[var(--accent)] bg-[var(--panel)] text-[var(--text)] font-semibold"
                            : "border-transparent text-[var(--muted)] hover:bg-[var(--panel-3)]",
                        )}
                      >
                        <Icon name="file" size={11} className={active ? "text-[var(--text)]" : "text-[var(--faint)]"} />
                        <span>{base(path)}</span>
                        {dirty[path] !== undefined && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
                        {openTabs.length > 1 && (
                          <button
                            onClick={(e) => handleCloseTab(e, path)}
                            className="text-[var(--faint)] opacity-0 group-hover:opacity-100 hover:text-[var(--text)] ml-1"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Format Action Button */}
                <Btn variant="ghost" className="!py-0.5 !px-2 !text-[10.5px]" onClick={() => onToast("Formatted code with Prettier")}>
                  Format
                </Btn>
              </div>

              {/* Monaco Code View */}
              <div className="min-h-0 flex-1">
                {code && (
                  <CodeEditor
                    file={code}
                    threadId={threadId}
                    onToast={onToast}
                    onSave={(v) => setDirty((d) => ({ ...d, [code.path]: v }))}
                  />
                )}
              </div>

              {/* Editor Bottom Status Bar */}
              <div className="flex h-6 shrink-0 items-center justify-between border-t border-[var(--border)] bg-[var(--chrome)] px-3 font-mono text-[10px] text-[var(--faint)]">
                <span>{code?.path}</span>
                <div className="flex items-center gap-3">
                  {Object.keys(dirty).length > 0 && (
                    <span className="flex items-center gap-1 text-[var(--amber)]">
                      <Icon name="refresh" size={10} /> unsaved
                    </span>
                  )}
                  <span>Lines: {code?.content.split("\n").length ?? 0}</span>
                  <span>UTF-8</span>
                  <span className="uppercase">{code?.lang}</span>
                </div>
              </div>

              {consoleOpen && (
                <div className="h-[34%] shrink-0 border-t border-[var(--border)]">
                  <ConsoleFeed file={openFile || project.code[0]?.path || ""} trigger={Object.keys(dirty).length} />
                </div>
              )}
            </div>

            {split && (
              <div className="flex min-w-0 flex-1 flex-col bg-[var(--panel-3)]">
                <div className="min-h-0 flex-1">
                  <LivePreview project={project} threadId={threadId} onToast={onToast} width="100%" />
                </div>
                {consoleOpen && (
                  <div className="h-[34%] shrink-0 border-t border-[var(--border)]">
                    <ConsoleFeed file={openFile || project.code[0]?.path || ""} trigger={Object.keys(dirty).length} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
