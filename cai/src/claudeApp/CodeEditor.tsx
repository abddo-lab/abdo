import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Circle,
  FileCode2,
  FileText,
  FolderOpen,
  GitBranch,
  X,
} from "lucide-react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { c, mono } from "./theme";
import { fileTree, type FileNode } from "./data";
import { useOutsideClose } from "./Dropdowns";

/* ---------- helpers ---------- */
function flatFind(nodes: FileNode[], path: string): FileNode | null {
  for (const n of nodes) {
    if (n.path === path) return n;
    if (n.children) {
      const hit = flatFind(n.children, path);
      if (hit) return hit;
    }
  }
  return null;
}

function langFromPath(path: string): string {
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".js") || path.endsWith(".jsx")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".sql")) return "sql";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".css") || path.endsWith(".scss")) return "css";
  if (path.endsWith(".html")) return "html";
  return "plaintext";
}

/* ---------- explorer tree ---------- */
function TreeNode({
  node,
  depth,
  activePath,
  onOpen,
  dirty,
}: {
  node: FileNode;
  depth: number;
  activePath: string;
  onOpen: (n: FileNode) => void;
  dirty: Record<string, boolean>;
}) {
  const [open, setOpen] = useState(depth < 1);
  const active = node.path === activePath;
  const pad = 6 + depth * 11;

  if (node.kind === "dir") {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-1 py-[3px] text-[12px] transition-colors"
          style={{ paddingLeft: pad, color: c.muted }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.sidebarHover)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          <span className="truncate">{node.name}</span>
        </button>
        {open &&
          node.children?.map((ch) => (
            <TreeNode key={ch.path} node={ch} depth={depth + 1} activePath={activePath} onOpen={onOpen} dirty={dirty} />
          ))}
      </div>
    );
  }

  const Icon = node.name.endsWith(".md") ? FileText : FileCode2;
  return (
    <button
      onClick={() => onOpen(node)}
      className="w-full flex items-center gap-1.5 py-[3px] text-[12px] transition-colors"
      style={{
        paddingLeft: pad + 12,
        color: active ? c.text : c.muted,
        backgroundColor: active ? c.sidebarActive : "transparent",
      }}
      onMouseEnter={(e) => !active && (e.currentTarget.style.backgroundColor = c.sidebarHover)}
      onMouseLeave={(e) => !active && (e.currentTarget.style.backgroundColor = "transparent")}
    >
      <Icon size={11} color={c.faint} className="flex-shrink-0" />
      <span className="truncate">{node.name}</span>
      {dirty[node.path] && (
        <Circle size={7} fill={c.accent} color={c.accent} className="ml-auto mr-1.5 flex-shrink-0" />
      )}
      {!dirty[node.path] && node.status && (
        <span className="ml-auto mr-1.5 text-[10px] flex-shrink-0" style={{ color: c.faint, fontFamily: mono }}>
          {node.status}
        </span>
      )}
    </button>
  );
}

/* ---------- monaco dark theme definition ---------- */
const MONACO_THEME = "claude-dark";

function defineClaudeTheme(monacoInstance: Parameters<OnMount>[1]) {
  monacoInstance.editor.defineTheme(MONACO_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "c9c9c9" },
      { token: "comment", foreground: "4f4f4f", fontStyle: "italic" },
      { token: "keyword", foreground: "ffffff", fontStyle: "bold" },
      { token: "string", foreground: "9e9e9e" },
      { token: "number", foreground: "bdbdbd" },
      { token: "type", foreground: "e2e2e2" },
      { token: "identifier", foreground: "c9c9c9" },
      { token: "delimiter", foreground: "6e6e6e" },
      { token: "operator", foreground: "9a9a9a" },
      { token: "variable", foreground: "d6d6d6" },
      { token: "function", foreground: "e2e2e2" },
      { token: "tag", foreground: "ffffff" },
      { token: "attribute.name", foreground: "b0b0b0" },
      { token: "attribute.value", foreground: "9e9e9e" },
      { token: "metatag", foreground: "6e6e6e" },
    ],
    colors: {
      "editor.background": "#000000",
      "editor.foreground": "#c9c9c9",
      "editor.lineHighlightBackground": "#0a0a0a",
      "editor.selectionBackground": "#ffffff18",
      "editor.inactiveSelectionBackground": "#ffffff0c",
      "editorLineNumber.foreground": "#3d3d3d",
      "editorLineNumber.activeForeground": "#8a8a8a",
      "editorCursor.foreground": "#e8e8e8",
      "editorWhitespace.foreground": "#1a1a1a",
      "editorIndentGuide.background": "#1a1a1a",
      "editorIndentGuide.activeBackground": "#2e2e2e",
      "editor.selectionHighlightBackground": "#ffffff10",
      "editorBracketMatch.background": "#ffffff10",
      "editorBracketMatch.border": "#5e5e5e",
      "editorGutter.background": "#000000",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#26262680",
      "scrollbarSlider.hoverBackground": "#3a3a3a80",
      "scrollbarSlider.activeBackground": "#4a4a4a80",
      "editorOverviewRuler.border": "#00000000",
      "minimap.background": "#000000",
    },
  });
}

/* ---------- main component ---------- */
export default function CodeEditor() {
  const first = "src/systems/Lighting.js";
  const [contents, setContents] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [tabs, setTabs] = useState<string[]>([first, "src/world/Level.js"]);
  const [active, setActive] = useState(first);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useOutsideClose(pickerOpen, setPickerOpen);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const node = useMemo(() => flatFind(fileTree, active), [active]);
  const text = contents[active] ?? node?.content ?? "";

  const openFile = (n: FileNode) => {
    if (n.kind !== "file") return;
    setTabs((t) => (t.includes(n.path) ? t : [...t, n.path]));
    setActive(n.path);
  };

  const close = (path: string) => {
    setTabs((t) => {
      const next = t.filter((p) => p !== path);
      if (active === path && next.length) setActive(next[next.length - 1]);
      return next;
    });
  };

  const handleMount: OnMount = useCallback((editor, monaco) => {
    monacoRef.current = monaco;
    editorRef.current = editor;
    defineClaudeTheme(monaco);
    monaco.editor.setTheme(MONACO_THEME);

    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column });
    });

    // Ctrl/Cmd+S to mark saved
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      setDirty((d) => ({ ...d, [active]: false }));
    });

    editor.updateOptions({
      fontSize: 12.5,
      lineHeight: 20,
      fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
      fontLigatures: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderLineHighlight: "line",
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      smoothScrolling: true,
      padding: { top: 8 },
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      overviewRulerBorder: false,
      guides: { indentation: true, bracketPairs: true },
      bracketPairColorization: { enabled: false },
      automaticLayout: true,
    });
  }, [active]);

  // When active tab changes, ensure theme is set
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(MONACO_THEME);
    }
  }, [active]);

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "#000" }}>
      <div className="flex flex-1 min-h-0">
        {/* editor area — no activity bar, no explorer sidebar */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* tabs */}
          <div
            className="flex items-center overflow-x-auto flex-shrink-0"
            style={{ borderBottom: `1px solid ${c.border}`, backgroundColor: c.bgSubtle }}
          >
            {/* compact file picker replaces the explorer */}
            <div className="relative flex-shrink-0" ref={pickerRef}>
              <button
                onClick={() => setPickerOpen((o) => !o)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] transition-colors"
                style={{
                  color: pickerOpen ? c.text : c.muted,
                  backgroundColor: pickerOpen ? c.chipHover : "transparent",
                  borderRight: `1px solid ${c.border}`,
                }}
                title="Open a file"
              >
                <FolderOpen size={12} />
                <ChevronDown size={10} />
              </button>
              {pickerOpen && (
                <div
                  className="absolute z-40 mt-1 rounded-xl overflow-hidden popIn"
                  style={{
                    left: 6,
                    width: 236,
                    maxHeight: 300,
                    overflowY: "auto",
                    backgroundColor: "rgba(14,14,14,.98)",
                    backdropFilter: "blur(18px)",
                    border: `1px solid ${c.borderStrong}`,
                    boxShadow: c.shadowPop,
                  }}
                >
                  <div className="px-2.5 py-1.5 flex items-center gap-1.5 text-[10px]" style={{ color: c.faint, borderBottom: `1px solid ${c.borderSoft}` }}>
                    <GitBranch size={10} />
                    <span style={{ fontFamily: mono }}>caret/night-lighting</span>
                  </div>
                  {fileTree.map((n) => (
                    <TreeNode
                      key={n.path}
                      node={n}
                      depth={0}
                      activePath={active}
                      onOpen={(f) => {
                        openFile(f);
                        setPickerOpen(false);
                      }}
                      dirty={dirty}
                    />
                  ))}
                </div>
              )}
            </div>

            {tabs.map((p) => {
              const isActive = p === active;
              return (
                <div
                  key={p}
                  onClick={() => setActive(p)}
                  className="group flex items-center gap-1.5 px-2.5 py-1.5 text-[11.5px] cursor-pointer flex-shrink-0"
                  style={{
                    backgroundColor: isActive ? "#000" : "transparent",
                    color: isActive ? c.text : c.faint,
                    borderRight: `1px solid ${c.border}`,
                    borderTop: `2px solid ${isActive ? c.accent : "transparent"}`,
                    fontFamily: mono,
                  }}
                >
                  <FileCode2 size={11} color={isActive ? c.muted : c.dim} />
                  {p.split("/").pop()}
                  {dirty[p] ? (
                    <Circle size={7} fill={c.accent} color={c.accent} />
                  ) : (
                    <X
                      size={11}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      color={c.faint}
                      onClick={(e) => {
                        e.stopPropagation();
                        close(p);
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Monaco editor */}
          <div className="flex-1 min-h-0">
            <Editor
              key={active}
              defaultLanguage={langFromPath(active)}
              defaultValue={text}
              theme={MONACO_THEME}
              onMount={handleMount}
              onChange={(val) => {
                if (val !== undefined) {
                  setContents((cs) => ({ ...cs, [active]: val }));
                  setDirty((d) => ({ ...d, [active]: true }));
                }
              }}
              loading={
                <div className="flex items-center justify-center h-full" style={{ color: c.faint }}>
                  <span className="text-[13px]">Loading editor…</span>
                </div>
              }
              options={{
                fontSize: 12.5,
                lineHeight: 20,
                fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                renderLineHighlight: "line",
                cursorBlinking: "smooth",
                cursorSmoothCaretAnimation: "on",
                smoothScrolling: true,
                padding: { top: 8 },
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                overviewRulerBorder: false,
                guides: { indentation: true, bracketPairs: true },
                bracketPairColorization: { enabled: false },
                automaticLayout: true,
              }}
            />
          </div>

        </div>
      </div>

      {/* status bar */}
      <div
        className="flex items-center gap-3 px-2.5 h-6 flex-shrink-0 text-[10.5px]"
        style={{
          borderTop: `1px solid ${c.border}`,
          backgroundColor: c.bgSubtle,
          color: c.faint,
          fontFamily: mono,
        }}
      >
        <span className="flex items-center gap-1">
          <GitBranch size={10} /> claude/night-lighting
        </span>
        <span>
          {Object.values(dirty).filter(Boolean).length} unsaved
        </span>
        <span className="ml-auto">
          Ln {cursorPos.line}, Col {cursorPos.col}
        </span>
        <span>UTF-8</span>
        <span>{langFromPath(active)}</span>
      </div>
    </div>
  );
}
