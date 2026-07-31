import { useEffect, useMemo, useRef, useState } from "react";
import MonacoEditor from "@monaco-editor/react";
import { cn } from "../utils/cn";
import { Icon, type IconName } from "../icons";
import { highlight } from "../highlight";
import type { CodeFile, DiffFile, PreviewNode, Project } from "../data";
import { Badge, Btn, IconBtn } from "./ui";

export type PanelTab = "preview" | "changes" | "editor";

interface Props {
  project: Project;
  files: DiffFile[];
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  design: boolean;
  onDesign: (v: boolean) => void;
  nodes: PreviewNode[];
  onNodePatch: (id: string, text: string, accent?: boolean) => void;
  onToast: (m: string) => void;
}

const base = (p: string) => p.split("/").pop() ?? p;

/* --------------------------------- Preview -------------------------------- */

const DEVICES = [
  { id: "desktop", label: "Desktop", w: "100%", icon: "monitor" as IconName },
  { id: "tablet", label: "Tablet", w: "768px", icon: "tablet" as IconName },
  { id: "mobile", label: "Mobile", w: "380px", icon: "phone" as IconName },
];

function PreviewSurface({
  nodes,
  design,
  selected,
  onSelect,
}: {
  nodes: PreviewNode[];
  design: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const wrap = (n: PreviewNode, child: React.ReactNode) => (
    <div
      key={n.id}
      onClick={(e) => {
        if (!design) return;
        e.stopPropagation();
        onSelect(n.id);
      }}
      className={cn(
        "relative rounded-md transition",
        design && "cursor-crosshair hover:outline hover:outline-1 hover:outline-offset-4 hover:outline-[var(--accent)]",
        design && selected === n.id && "outline outline-2 outline-offset-4 outline-[var(--accent)]",
      )}
    >
      {design && selected === n.id && (
        <span className="absolute -top-6 left-0 z-10 rounded-md bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--app)] shadow-[var(--shadow-sm)]">
          {n.kind}
        </span>
      )}
      {child}
    </div>
  );

  const cards = nodes.filter((n) => n.kind === "card");
  const stat = nodes.find((n) => n.kind === "stat");

  return (
    <div className="mx-auto w-full bg-white px-8 py-10 text-[#111116]">
      <div className="flex flex-col items-start gap-4">
        {nodes
          .filter((n) => ["eyebrow", "heading", "lede"].includes(n.kind))
          .map((n) =>
            wrap(
              n,
              n.kind === "eyebrow" ? (
                <span className="inline-block rounded-full border border-[#e2e2e6] bg-[#f8f8fa] px-2.5 py-1 text-[11px] font-medium text-[#5a5a64]">
                  {n.text}
                </span>
              ) : n.kind === "heading" ? (
                <h1 className="max-w-[16ch] text-[36px] font-bold leading-[1.1] tracking-tight">{n.text}</h1>
              ) : (
                <p className="max-w-[46ch] text-[14.5px] leading-relaxed text-[#50505a]">{n.text}</p>
              ),
            ),
          )}

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {nodes
            .filter((n) => n.kind === "cta" || n.kind === "ghost")
            .map((n) =>
              wrap(
                n,
                n.kind === "cta" ? (
                  <span
                    className="inline-flex h-10 items-center rounded-xl px-4.5 text-[13.5px] font-semibold text-white shadow-sm"
                    style={{ background: "#111116" }}
                  >
                    {n.text}
                  </span>
                ) : (
                  <span className="inline-flex h-10 items-center rounded-xl border border-[#d8d8e0] px-4.5 text-[13.5px] font-semibold text-[#111116]">
                    {n.text}
                  </span>
                ),
              ),
            )}
        </div>

        {cards.length > 0 && (
          <div className="grid w-full grid-cols-1 gap-3 pt-6 sm:grid-cols-3">
            {cards.map((n) =>
              wrap(
                n,
                <div
                  className="h-full rounded-xl border border-[#e4e4e8] bg-[#f8f8fa] p-4"
                >
                  <p className="text-[13px] font-semibold">{n.text}</p>
                  <p className="pt-1 text-[11.5px] leading-relaxed text-[#60606a]">{n.sub}</p>
                </div>,
              ),
            )}
          </div>
        )}

        {stat &&
          wrap(
            stat,
            <div className="mt-6 flex items-baseline gap-2.5 border-t border-[#e4e4e8] pt-5">
              <span className="text-[32px] font-bold tracking-tight text-[#111116]">
                {stat.text}
              </span>
              <span className="text-[12.5px] text-[#60606a]">{stat.sub}</span>
            </div>,
          )}
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

/* --------------------------------- Upgraded Code Editor -------------------------------- */

function CodeEditor({ file, onSave }: { file: CodeFile; onSave: (v: string) => void }) {
  const [value, setValue] = useState(file.content);

  useEffect(() => setValue(file.content), [file.path, file.content]);

  return (
    <MonacoEditor
      key={file.path}
      height="100%"
      language={file.lang}
      theme="vs"
      value={value}
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
  );
}

/* ─────────────────────── Kiren Design Compact Bar ──────────────────────────── */

const DESIGN_MODELS = [
  { id: "kiren-2.5",      label: "Kiren 2.5" },
  { id: "kiren-fast",     label: "Kiren Fast" },
  { id: "kiren-thinking", label: "Kiren Thinking" },
];

function DesignBar({
  node, thinking, onApply, onClose,
}: {
  node: PreviewNode | null;
  thinking: boolean;
  onApply: (text: string) => void;
  onClose: () => void;
}) {
  const [msg, setMsg] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const [model, setModel] = useState("kiren-2.5");

  const submit = () => { if (!msg.trim() || thinking || !node) return; onApply(msg.trim()); setMsg(""); };

  return (
    <div className="absolute bottom-3 left-3 right-3 z-20">
      <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border-2)] bg-[var(--panel)]/95 backdrop-blur-md px-2 py-1.5 shadow-[var(--shadow-lg)]"
        style={{ boxShadow: "0 8px 32px rgba(15,17,28,0.18), 0 0 0 1px rgba(15,17,28,0.06)" }}>
        <div className="relative">
          <button onClick={() => setModelOpen((v) => !v)}
            className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)] transition hover:bg-[var(--panel-3)]">
            {DESIGN_MODELS.find((m) => m.id === model)?.label}
            <Icon name="chevDown" size={7} className={cn("transition-transform", modelOpen && "rotate-180")} />
          </button>
          {modelOpen && (
            <div className="a-pop absolute bottom-full left-0 z-30 mb-1.5 w-[150px] overflow-hidden rounded-xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
              {DESIGN_MODELS.map((m) => (
                <button key={m.id} onClick={() => { setModel(m.id); setModelOpen(false); }}
                  className={cn("flex w-full items-center justify-between px-3 py-1.5 text-[11px] transition hover:bg-[var(--panel-2)]", model === m.id ? "font-bold text-[var(--text)]" : "text-[var(--muted)]")}>
                  {m.label}
                  {model === m.id && <Icon name="check" size={10} strokeWidth={2.4} className="text-[var(--accent)]" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="text-[var(--border-3)]">|</span>
        <input value={msg} onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={node ? `Edit ${node.kind}…` : "Select element…"}
          disabled={!node}
          className="min-w-0 flex-1 bg-transparent text-[11.5px] text-[var(--text)] outline-none placeholder:text-[var(--faint)] disabled:opacity-40" />
        {thinking && <Icon name="spinner" size={11} className="a-spin text-[var(--accent)]" />}
        <button onClick={submit} disabled={!msg.trim() || thinking || !node}
          className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition active:scale-95",
            msg.trim() && !thinking && node ? "bg-[var(--accent)] text-white" : "bg-[var(--panel-3)] text-[var(--faint)]")}>
          <Icon name="arrowUp" size={12} strokeWidth={2.2} />
        </button>
        <button onClick={onClose} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[var(--faint)] transition hover:bg-[var(--panel-3)] hover:text-[var(--text)]">
          <Icon name="close" size={11} />
        </button>
      </div>
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
  design,
  onDesign,
  nodes,
  onNodePatch,
  onToast,
}: Props) {
  const [device, setDevice] = useState("desktop");
  const [selected, setSelected] = useState<string | null>(null);
  const [designLog, setDesignLog] = useState<{ id: number; text: string }[]>([]);
  const [openFile, setOpenFile] = useState(project.code[0]?.path ?? "");
  const [openTabs, setOpenTabs] = useState<string[]>([project.code[0]?.path ?? ""]);
  const [fileFilter, setFileFilter] = useState("");
  const [showTree, setShowSideTree] = useState(true);
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [thinking, setThinking] = useState(false);
  const logId = useRef(0);

  useEffect(() => {
    const initialPath = project.code[0]?.path ?? "";
    setOpenFile(initialPath);
    setOpenTabs([initialPath]);
    setSelected(null);
  }, [project.id]);

  const totals = files.reduce((a, f) => ({ add: a.add + f.add, del: a.del + f.del }), { add: 0, del: 0 });
  const node = nodes.find((n) => n.id === selected) ?? null;

  const applyDesign = (text: string) => {
    if (!node) return;
    setThinking(true);
    const id = ++logId.current;
    setDesignLog((l) => [...l, { id, text }]);
    setTimeout(() => {
      const t = text.toLowerCase();
      let next = node.text;
      let accent = node.accent;
      if (t.includes("accent") || t.includes("color") || t.includes("colour")) accent = !accent;
      else if (t.includes("short") || t.includes("tighten")) next = node.text.split(" ").slice(0, 4).join(" ");
      else if (t.includes("bold") || t.includes("upper")) next = node.text.toUpperCase();
      else if (t.includes("urgen")) next = `${node.text} — today`;
      else if (t.includes("soft") || t.includes("gentle")) next = node.text.replace(/!/g, ".").toLowerCase().replace(/^./, (s) => s.toUpperCase());
      else if (t.includes("expand")) next = `${node.text} — built for teams who ship fast`;
      else next = text.replace(/^(make it|change it to|set to|rewrite as)\s*/i, "").slice(0, 60) || node.text;
      onNodePatch(node.id, next, accent);
      setThinking(false);
      onToast(`Design applied to ${node.kind}`);
    }, 800);
  };

  const code = useMemo(
    () => project.code.find((c) => c.path === openFile) ?? project.code[0],
    [project.code, openFile],
  );

  const filteredCodeFiles = useMemo(
    () => project.code.filter((c) => c.path.toLowerCase().includes(fileFilter.toLowerCase())),
    [project.code, fileFilter],
  );

  const fileTree = useMemo(() => buildTree(filteredCodeFiles), [filteredCodeFiles]);

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
          </>
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
          <IconBtn icon="refresh" size={13} title="Reload preview" onClick={() => onToast("Preview reloaded")} />
          <IconBtn icon="external" size={13} title="Open external" onClick={() => onToast(`Opening ${project.domain}.kiren.app`)} />
        </div>
      </div>

      {/* Main Panel Content Body */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Tab 1: Clean Live Preview (No MacOS Titlebar Frame) */}
        {tab === "preview" && (
          <div className="relative h-full overflow-y-auto bg-[var(--panel-3)] p-4">
            <div
              className="mx-auto overflow-hidden rounded-xl border border-[var(--border-2)] bg-white shadow-[var(--shadow-md)] transition-all duration-300"
              style={{ maxWidth: DEVICES.find((d) => d.id === device)?.w }}
              onClick={() => design && setSelected(null)}
            >
              <PreviewSurface nodes={nodes} design={design} selected={selected} onSelect={setSelected} />
            </div>

            {/* Kiren Design Compact Bar */}
            {design && (
              <DesignBar
                node={node}
                thinking={thinking}
                onApply={applyDesign}
                onClose={() => { onDesign(false); setSelected(null); }}
              />
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

            {/* Monaco Editor Container */}
            <div className="flex min-w-0 flex-1 flex-col">
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
                    onSave={(v) => setDirty((d) => ({ ...d, [code.path]: v }))}
                  />
                )}
              </div>

              {/* Editor Bottom Status Bar */}
              <div className="flex h-6 shrink-0 items-center justify-between border-t border-[var(--border)] bg-[var(--chrome)] px-3 font-mono text-[10px] text-[var(--faint)]">
                <span>{code?.path}</span>
                <div className="flex items-center gap-3">
                  <span>Lines: {code?.content.split("\n").length ?? 0}</span>
                  <span>UTF-8</span>
                  <span className="uppercase">{code?.lang}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
