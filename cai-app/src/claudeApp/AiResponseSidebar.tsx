/**
 * AI Response Sidebar — matches /home/crime/cai RightPanel style
 * Editor, Preview, Database, Changes, Tasks tabs
 */

import { useState } from "react";
import {
  Code2, Eye, Database, FileDiff, Zap,
  ChevronDown, ChevronRight, Copy, Check,
  Monitor, Smartphone, RefreshCw, SquareCode, X, Loader2,
} from "lucide-react";
import { c, mono } from "./theme";

export interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  content?: string;
  diff?: string;
}

export interface DbChange {
  table: string;
  operation: string;
  query: string;
  rowsAffected?: number;
}

export interface AiResponseData {
  filesChanged: FileChange[];
  dbChanges: DbChange[];
  commandsRun: string[];
  previewUrl?: string;
  commitHash?: string;
  branch?: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="p-1 rounded transition-colors" style={{ color: copied ? c.accent : c.faint }}>
      {copied ? <Check size={10} /> : <Copy size={10} />}
    </button>
  );
}

/* ================= Editor Tab ================= */
function EditorTab({ files }: { files: FileChange[] }) {
  if (files.length === 0) {
    return (
      <div className="p-4">
        <div className="text-[13px] font-medium mb-1" style={{ color: c.text }}>No files edited</div>
        <p className="text-[11.5px] leading-relaxed" style={{ color: c.muted }}>
          Files will appear here when the AI makes changes.
        </p>
      </div>
    );
  }
  return (
    <div className="p-3">
      {files.map((file) => (
        <DiffFileCard key={file.path} file={file} />
      ))}
    </div>
  );
}

function DiffFileCard({ file }: { file: FileChange }) {
  const [open, setOpen] = useState(false);
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
        <span className="ml-auto flex-shrink-0" style={{ color: c.text, fontFamily: mono }}>+{file.additions}</span>
        <span className="flex-shrink-0" style={{ color: c.faint, fontFamily: mono }}>-{file.deletions}</span>
      </button>
      {open && file.content && (
        <div className="py-1 overflow-x-auto" style={{ borderTop: `1px solid ${c.borderSoft}` }}>
          {file.content.split("\n").map((line, i) => (
            <div key={i} className="flex text-[11px] leading-5" style={{ fontFamily: mono }}>
              <span className="pr-1 select-none flex-shrink-0" style={{ color: line.startsWith("+") ? c.accent : line.startsWith("-") ? c.faint : c.dim }}>
                {line.startsWith("+") ? "+" : line.startsWith("-") ? "-" : " "}
              </span>
              <span style={{ color: line.startsWith("+") ? c.text : line.startsWith("-") ? c.faint : c.muted }}>
                {line}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================= Preview Tab ================= */
function PreviewTab({ url }: { url?: string }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  return (
    <div className="p-3">
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs mb-2"
        style={{ backgroundColor: c.input, border: `1px solid ${c.border}`, color: c.muted }}
      >
        <span className="flex-1 flex items-center gap-1.5 truncate px-2 py-1 rounded-md" style={{ backgroundColor: c.chip, fontFamily: mono, fontSize: 11 }}>
          {url || "No preview available"}
        </span>
        <button onClick={() => setDevice("desktop")} style={{ color: device === "desktop" ? c.text : c.faint }}>
          <Monitor size={12} />
        </button>
        <button onClick={() => setDevice("mobile")} style={{ color: device === "mobile" ? c.text : c.faint }}>
          <Smartphone size={12} />
        </button>
      </div>
      {url ? (
        <div className="flex justify-center">
          <div
            className="rounded-xl overflow-hidden transition-all"
            style={{ border: `1px solid ${c.border}`, width: device === "mobile" ? 300 : "100%" }}
          >
            <iframe src={url} className="w-full h-64" style={{ border: "none", backgroundColor: c.bg }} title="Preview" />
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Monitor size={24} className="mx-auto mb-2" style={{ color: c.dim }} />
          <div className="text-[12px]" style={{ color: c.muted }}>No preview available yet.</div>
          <div className="text-[10.5px] mt-1" style={{ color: c.dim }}>Deploy to see a live preview.</div>
        </div>
      )}
    </div>
  );
}

/* ================= Database Tab ================= */
function DatabaseTab({ changes }: { changes: DbChange[] }) {
  if (changes.length === 0) {
    return (
      <div className="p-4">
        <div className="text-[13px] font-medium mb-1" style={{ color: c.text }}>No database changes</div>
        <p className="text-[11.5px] leading-relaxed" style={{ color: c.muted }}>
          Database operations will appear here.
        </p>
      </div>
    );
  }
  return (
    <div className="p-3 space-y-2">
      {changes.map((change, i) => (
        <div key={i} className="rounded-lg p-2.5" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
          <div className="flex items-center gap-2 mb-1.5">
            <Database size={11} color={c.faint} />
            <span className="text-[11px] font-medium" style={{ color: c.text, fontFamily: mono }}>{change.table}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: c.chip, color: c.dim }}>{change.operation}</span>
            {change.rowsAffected !== undefined && (
              <span className="text-[9px] ml-auto" style={{ color: c.dim }}>{change.rowsAffected} rows</span>
            )}
          </div>
          <div className="text-[10px] px-2 py-1.5 rounded" style={{ backgroundColor: c.codeBg, fontFamily: mono, color: c.faint }}>
            {change.query}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================= Changes Tab ================= */
function ChangesTab({ files }: { files: FileChange[] }) {
  const totalAdd = files.reduce((n, f) => n + f.additions, 0);
  const totalDel = files.reduce((n, f) => n + f.deletions, 0);
  return (
    <div className="p-3">
      <div className="flex items-center gap-2 px-1 pb-3 text-xs" style={{ color: c.muted }}>
        <FileDiff size={13} color={c.faint} />
        <span className="font-medium" style={{ color: c.text }}>{files.length} files changed</span>
        <span style={{ color: c.text, fontFamily: mono }}>+{totalAdd}</span>
        <span style={{ color: c.faint, fontFamily: mono }}>-{totalDel}</span>
      </div>
      {files.map((file) => (
        <DiffFileCard key={file.path} file={file} />
      ))}
    </div>
  );
}

/* ================= Tasks Tab ================= */
function TasksTab({ commands }: { commands: string[] }) {
  return (
    <div className="p-3">
      {commands.length === 0 ? (
        <div className="text-center py-12">
          <Zap size={24} className="mx-auto mb-2" style={{ color: c.dim }} />
          <div className="text-[12px]" style={{ color: c.muted }}>No commands run yet.</div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {commands.map((cmd, i) => (
            <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
              <Zap size={11} color={c.faint} />
              <span className="flex-1 text-[10.5px]" style={{ fontFamily: mono, color: c.muted }}>{cmd}</span>
              <CopyButton text={cmd} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================= Main Sidebar ================= */
export default function AiResponseSidebar({ data, isOpen, onClose }: { data: AiResponseData | null; isOpen: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"editor" | "preview" | "database" | "changes" | "tasks">("editor");

  if (!isOpen || !data) return null;

  const tabs = [
    { id: "editor" as const, label: "Editor", icon: SquareCode },
    { id: "preview" as const, label: "Preview", icon: Monitor },
    { id: "database" as const, label: "Database", icon: Database },
    { id: "changes" as const, label: "Changes", icon: FileDiff, count: data.filesChanged.length },
    { id: "tasks" as const, label: "Tasks", icon: Zap, count: data.commandsRun.length },
  ];

  return (
    <div
      className="workspacePanel flex flex-col h-full flex-shrink-0 min-w-0"
      style={{
        width: 520,
        borderLeft: `1px solid ${c.border}`,
        backgroundColor: c.bgSubtle,
      }}
    >
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-2.5 h-11 flex-shrink-0" style={{ borderBottom: `1px solid ${c.border}` }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const on = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11.5px] font-medium transition-colors"
              style={{
                backgroundColor: on ? c.chipHover : "transparent",
                color: on ? c.text : c.muted,
                border: `1px solid ${on ? c.border : "transparent"}`,
              }}
            >
              <Icon size={12} />
              {tab.label}
              {tab.count !== undefined && (
                <span className="px-1 rounded text-[9.5px]" style={{ backgroundColor: c.chip, color: c.muted }}>
                  {tab.count}
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

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === "editor" && <EditorTab files={data.filesChanged} />}
        {activeTab === "preview" && <PreviewTab url={data.previewUrl} />}
        {activeTab === "database" && <DatabaseTab changes={data.dbChanges} />}
        {activeTab === "changes" && <ChangesTab files={data.filesChanged} />}
        {activeTab === "tasks" && <TasksTab commands={data.commandsRun} />}
      </div>
    </div>
  );
}
