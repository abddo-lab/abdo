import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, FileCode2, FolderOpen, Loader2 } from "lucide-react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { c, mono } from "./theme";
import { useGitHub, type GitHubFile } from "./github";

function langFromPath(p: string): string {
  if (p.endsWith(".ts") || p.endsWith(".tsx")) return "typescript";
  if (p.endsWith(".js") || p.endsWith(".jsx")) return "javascript";
  if (p.endsWith(".json")) return "json";
  if (p.endsWith(".sql")) return "sql";
  if (p.endsWith(".md")) return "markdown";
  if (p.endsWith(".css")) return "css";
  if (p.endsWith(".html")) return "html";
  if (p.endsWith(".py")) return "python";
  if (p.endsWith(".go")) return "go";
  if (p.endsWith(".rs")) return "rust";
  return "plaintext";
}

export default function CodeEditor() {
  const gh = useGitHub();
  const [files, setFiles] = useState<GitHubFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [tabs, setTabs] = useState<string[]>([]);
  const [active, setActive] = useState<string>("");
  const [contents, setContents] = useState<Record<string, string>>({});
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dirPath, setDirPath] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);

  // Load file tree
  useEffect(() => {
    if (!gh.connected) return;
    setLoading(true);
    gh.getFileTree(dirPath).then((f) => { setFiles(f); setLoading(false); }).catch(() => setLoading(false));
  }, [gh.connected, dirPath, gh.selectedRepo, gh.selectedBranch]);

  const openFile = async (f: GitHubFile) => {
    if (f.type === "dir") { setDirPath(f.path); return; }
    if (!tabs.includes(f.path)) setTabs((t) => [...t, f.path]);
    setActive(f.path);
    if (!contents[f.path]) {
      setLoadingFile(true);
      try {
        const content = await gh.getFileContent(f.path);
        setContents((cs) => ({ ...cs, [f.path]: content }));
      } catch { setContents((cs) => ({ ...cs, [f.path]: "// Failed to load file" })); }
      setLoadingFile(false);
    }
  };

  const closeTab = (path: string) => {
    setTabs((t) => { const next = t.filter((p) => p !== path); if (active === path && next.length) setActive(next[next.length - 1]); return next; });
  };

  const goUp = () => {
    const parts = dirPath.split("/"); parts.pop(); setDirPath(parts.join("/"));
  };

  const handleMount: OnMount = useCallback((editor, monaco) => {
    monaco.editor.defineTheme("cai-dark", {
      base: "vs-dark", inherit: true,
      rules: [
        { token: "", foreground: "c9c9c9" }, { token: "comment", foreground: "4f4f4f", fontStyle: "italic" },
        { token: "keyword", foreground: "ffffff", fontStyle: "bold" }, { token: "string", foreground: "9e9e9e" },
        { token: "number", foreground: "bdbdbd" }, { token: "type", foreground: "e2e2e2" },
      ],
      colors: { "editor.background": "#000000", "editor.foreground": "#c9c9c9", "editorLineNumber.foreground": "#3d3d3d", "editorCursor.foreground": "#e8e8e8" },
    });
    monaco.editor.setTheme("cai-dark");
    editor.onDidChangeCursorPosition((e) => setCursorPos({ line: e.position.lineNumber, col: e.position.column }));
    editor.updateOptions({ fontSize: 12.5, fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace", minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true });
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "#000" }}>
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs + file picker */}
          <div className="flex items-center overflow-x-auto flex-shrink-0" style={{ borderBottom: `1px solid ${c.border}`, backgroundColor: c.bgSubtle }}>
            <div className="relative flex-shrink-0">
              <button onClick={() => setPickerOpen((o) => !o)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px]" style={{ color: c.muted, borderRight: `1px solid ${c.border}` }}>
                <FolderOpen size={12} /><ChevronDown size={10} />
              </button>
              {pickerOpen && (
                <div className="absolute z-40 mt-1 rounded-xl overflow-hidden popIn" style={{ left: 6, width: 280, maxHeight: 400, overflowY: "auto", backgroundColor: "rgba(14,14,14,.98)", backdropFilter: "blur(18px)", border: `1px solid ${c.borderStrong}`, boxShadow: c.shadowPop }}>
                  <div className="px-2.5 py-1.5 flex items-center gap-1.5 text-[10px]" style={{ color: c.faint, borderBottom: `1px solid ${c.borderSoft}` }}>
                    <span style={{ fontFamily: mono }}>{gh.selectedRepo ?? "repo"}</span>
                    <span>·</span>
                    <span style={{ fontFamily: mono }}>{gh.selectedBranch ?? "main"}</span>
                  </div>
                  {dirPath && (
                    <button onClick={goUp} className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px]" style={{ color: c.muted }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chipHover)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                      <ChevronRight size={11} style={{ transform: "rotate(180deg)" }} /> ..
                    </button>
                  )}
                  {loading ? (
                    <div className="px-3 py-4 text-center text-[11px]" style={{ color: c.dim }}><Loader2 size={14} className="animate-spin" /></div>
                  ) : files.map((f) => (
                    <button key={f.path} onClick={() => openFile(f)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-left"
                      style={{ color: c.muted }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chipHover)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                      {f.type === "dir" ? <ChevronRight size={11} /> : <FileCode2 size={11} color={c.faint} />}
                      <span className="truncate">{f.name}</span>
                      {f.size && <span className="ml-auto text-[10px]" style={{ color: c.dim }}>{f.size}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {tabs.map((p) => (
              <div key={p} onClick={() => setActive(p)} className="group flex items-center gap-1.5 px-2.5 py-1.5 text-[11.5px] cursor-pointer flex-shrink-0"
                style={{ backgroundColor: p === active ? "#000" : "transparent", color: p === active ? c.text : c.faint, borderRight: `1px solid ${c.border}`, borderTop: `2px solid ${p === active ? c.accent : "transparent"}`, fontFamily: mono }}>
                <FileCode2 size={11} color={p === active ? c.muted : c.dim} />
                {p.split("/").pop()}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-1" onClick={(e) => { e.stopPropagation(); closeTab(p); }} style={{ color: c.faint }}>×</span>
              </div>
            ))}
          </div>

          {/* Editor */}
          <div className="flex-1 min-h-0">
            {active ? (
              loadingFile ? (
                <div className="flex items-center justify-center h-full" style={{ color: c.faint }}><Loader2 size={20} className="animate-spin" /></div>
              ) : (
                <Editor key={active} defaultLanguage={langFromPath(active)} value={contents[active] ?? ""} theme="cai-dark" onMount={handleMount}
                  onChange={(val) => { if (val !== undefined) setContents((cs) => ({ ...cs, [active]: val })); }}
                  loading={<div className="flex items-center justify-center h-full" style={{ color: c.faint }}>Loading…</div>}
                  options={{ fontSize: 12.5, fontFamily: "'JetBrains Mono', Menlo, monospace", minimap: { enabled: false }, scrollBeyondLastLine: false, automaticLayout: true }} />
              )
            ) : (
              <div className="flex items-center justify-center h-full text-[13px]" style={{ color: c.dim }}>
                Open a file from the picker above
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Status bar */}
      <div className="flex items-center gap-3 px-2.5 h-6 flex-shrink-0 text-[10.5px]" style={{ borderTop: `1px solid ${c.border}`, backgroundColor: c.bgSubtle, color: c.faint, fontFamily: mono }}>
        <span>{gh.selectedBranch ?? "main"}</span>
        <span className="ml-auto">Ln {cursorPos.line}, Col {cursorPos.col}</span>
        <span>UTF-8</span>
        <span>{langFromPath(active)}</span>
      </div>
    </div>
  );
}
