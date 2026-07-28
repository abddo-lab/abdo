import { useEffect, useRef, useState, useCallback } from "react";
import {
  Check, ChevronDown, ChevronRight, CircleDashed, Folder, FolderOpen, File,
  Search, TerminalSquare, Lightbulb, Sparkles, Wrench, Copy, ExternalLink,
  X, Loader2, Square, GitBranch, AlertTriangle, CheckCircle2, XCircle,
  FileCode2, Clock, Zap, Eye, RefreshCw,
} from "lucide-react";
import Editor from "@monaco-editor/react";
import { c, font, mono } from "./theme";
import { type TranscriptItem } from "./data";
import Composer, { type Attachment } from "./Composer";
import { useGitHub, type GitHubFile } from "./github";
import { useAuth } from "./auth";
import type { SlashCommand } from "./workData";
import { chatStream, estimateCost, type ChatMessage, githubAPI } from "../services/api";
import { messagesDB, usageDB } from "../services/db";
import { buildMemoryBlock, buildRulesBlock, uploadMemoryFile } from "../services/memory";
import { dispatchAgent, BUILTIN_AGENTS, type SubagentResult } from "../services/agents";
import { recordFeedback } from "../services/self-improve";
import { TOOL_DEFINITIONS, executeTool, type ToolCall } from "../services/tools";
import { runHooks } from "../services/hooks";
import { executeSkill, getSkills } from "../services/skills";
import { buildProjectMemoryBlock } from "../services/project-memory";
import { getBackgroundTasks, cancelTask, type BackgroundTask } from "../services/background";
import { indexCodebase, getCurrentIndex } from "../services/context";
import { runAgentLoop, type AgentPhase } from "../services/agent-loop";
import AiResponseSidebar, { type AiResponseData } from "./AiResponseSidebar";

/* ─── strip tool/agent/skill blocks from display ─── */
function stripToolBlocks(text: string): string {
  return text.replace(/```tool\s*\n[\s\S]*?```/g, "").replace(/```agent\s*\n[\s\S]*?```/g, "").replace(/```skill\s*\n[\s\S]*?```/g, "").trim();
}

/* ─── Markdown renderer ─── */
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) { codeLines.push(lines[i]); i++; }
      i++;
      elements.push(
        <pre key={elements.length} className="my-2 rounded-lg overflow-x-auto text-[12px] leading-5 p-3 relative group/code" style={{ backgroundColor: c.codeBg, border: `1px solid ${c.borderSoft}`, fontFamily: mono }}>
          {lang && <div className="text-[10px] mb-1 uppercase tracking-wider flex items-center gap-1.5" style={{ color: c.faint }}><FileCode2 size={10} />{lang}</div>}
          <code style={{ color: c.text }}>{codeLines.join("\n")}</code>
          <button onClick={() => navigator.clipboard.writeText(codeLines.join("\n"))} className="absolute top-1.5 right-1.5 opacity-0 group-hover/code:opacity-100 p-1 rounded" style={{ backgroundColor: c.chip, color: c.muted }} title="Copy"><Copy size={10} /></button>
        </pre>
      );
      continue;
    }
    const hMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (hMatch) {
      const size = [16, 15, 14, 13, 12, 11][hMatch[1].length - 1] ?? 12;
      elements.push(<div key={elements.length} className="mt-3 mb-1 font-semibold" style={{ fontSize: size, color: c.text }}>{renderInline(hMatch[2])}</div>);
      i++; continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { elements.push(<hr key={elements.length} className="my-3" style={{ borderColor: c.borderSoft }} />); i++; continue; }
    if (line.startsWith("> ")) { elements.push(<div key={elements.length} className="pl-3 my-1 text-[12.5px]" style={{ borderLeft: `2px solid ${c.accent}`, color: c.muted }}>{renderInline(line.slice(2))}</div>); i++; continue; }
    const ulMatch = line.match(/^(\s*)([-*+])\s+(.*)/);
    if (ulMatch) { elements.push(<div key={elements.length} className="flex gap-2 text-[13px] leading-relaxed" style={{ paddingLeft: ulMatch[1].length * 8 }}><span style={{ color: c.faint }}>{ulMatch[2]}</span><span style={{ color: c.text }}>{renderInline(ulMatch[3])}</span></div>); i++; continue; }
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
    if (olMatch) { elements.push(<div key={elements.length} className="flex gap-2 text-[13px] leading-relaxed" style={{ paddingLeft: olMatch[1].length * 8 }}><span style={{ color: c.faint, fontFamily: mono }}>{olMatch[2]}.</span><span style={{ color: c.text }}>{renderInline(olMatch[3])}</span></div>); i++; continue; }
    if (!line.trim()) { i++; continue; }
    elements.push(<p key={elements.length} className="text-[13.5px] leading-relaxed whitespace-pre-wrap" style={{ color: c.text }}>{renderInline(line)}</p>);
    i++;
  }
  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  while (remaining) {
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) { parts.push(<code key={key++} className="px-1.5 py-0.5 rounded text-[12px]" style={{ backgroundColor: c.chip, color: c.accent, fontFamily: mono }}>{codeMatch[1]}</code>); remaining = remaining.slice(codeMatch[0].length); continue; }
    const boldItalicMatch = remaining.match(/^\*\*\*(.+?)\*\*\*/);
    if (boldItalicMatch) { parts.push(<strong key={key++}><em style={{ color: c.text }}>{boldItalicMatch[1]}</em></strong>); remaining = remaining.slice(boldItalicMatch[0].length); continue; }
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) { parts.push(<strong key={key++} style={{ color: c.text }}>{boldMatch[1]}</strong>); remaining = remaining.slice(boldMatch[0].length); continue; }
    const italicMatch = remaining.match(/^\*(.+?)\*/);
    if (italicMatch) { parts.push(<em key={key++} style={{ color: c.text }}>{italicMatch[1]}</em>); remaining = remaining.slice(italicMatch[0].length); continue; }
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) { parts.push(<a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5" style={{ color: c.accent }}>{linkMatch[1]}<ExternalLink size={9} /></a>); remaining = remaining.slice(linkMatch[0].length); continue; }
    const nextSpecial = remaining.search(/[`*\[]/);
    if (nextSpecial === -1) { parts.push(remaining); break; }
    parts.push(remaining.slice(0, nextSpecial));
    remaining = remaining.slice(nextSpecial);
  }
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

/* ─── Collapsible ─── */
function Collapsible({ label, children, defaultOpen = false }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-3">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 text-[11.5px] py-1 hover:opacity-80 transition-opacity" style={{ color: c.muted }}>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}{label}
      </button>
      {open && <div className="pl-5 mt-1 flex flex-col gap-1.5">{children}</div>}
    </div>
  );
}

/* ─── Transcript Items ─── */
function Item({ item, onFeedback }: { item: TranscriptItem & { id?: string }; onFeedback?: (msgId: string, type: "up" | "down") => void }) {
  if (item.type === "user") {
    return (
      <div className="flex justify-end mb-4">
        <div className="rounded-2xl rounded-tr-md px-3.5 py-2.5 text-[13.5px] max-w-[80%] leading-relaxed whitespace-pre-wrap" style={{ backgroundColor: c.chip, color: c.text, border: `1px solid ${c.border}` }}>
          {item.text}
        </div>
      </div>
    );
  }
  if (item.type === "text") {
    const displayText = stripToolBlocks(item.text);
    if (!displayText) return null;
    return (
      <div className="mb-4 group">
        <Markdown text={displayText} />
        {onFeedback && item.id && (
          <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onFeedback(item.id!, "up")} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px]" style={{ color: c.dim, backgroundColor: c.chip, border: `1px solid ${c.borderSoft}` }}><CheckCircle2 size={10} /> helpful</button>
            <button onClick={() => onFeedback(item.id!, "down")} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px]" style={{ color: c.dim, backgroundColor: c.chip, border: `1px solid ${c.borderSoft}` }}><XCircle size={10} /> wrong</button>
          </div>
        )}
      </div>
    );
  }
  if (item.type === "thought") {
    return (
      <div className="mb-2 rounded-lg px-3 py-2 text-[11.5px] italic" style={{ backgroundColor: "rgba(200,180,100,.06)", border: `1px solid rgba(200,180,100,.12)`, color: c.faint }}>
        <div className="flex items-center gap-1.5 mb-0.5"><Lightbulb size={11} color="#c8b464" /><span className="font-semibold text-[10px] uppercase tracking-wider" style={{ color: "#c8b464" }}>Thinking</span></div>
        {item.text}
      </div>
    );
  }
  if (item.type === "system") {
    const isError = item.text.toLowerCase().startsWith("error");
    return (
      <div className="flex items-center gap-2 my-2 text-[11.5px] px-2.5 py-1.5 rounded-lg" style={{ color: isError ? "#f87171" : c.muted, backgroundColor: isError ? "rgba(248,113,113,.08)" : c.panel, border: `1px solid ${isError ? "rgba(248,113,113,.2)" : c.borderSoft}` }}>
        {isError ? <AlertTriangle size={12} color="#f87171" /> : <Sparkles size={12} color={c.accent} />}
        {item.text}
      </div>
    );
  }
  if (item.type === "plan") {
    return (
      <div className="mb-4 rounded-xl p-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
        <div className="text-[10px] uppercase tracking-wider mb-2 font-semibold flex items-center gap-1.5" style={{ color: c.faint }}><Zap size={10} /> Execution Plan</div>
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
  }
  if (item.type === "terminal") {
    return (
      <div className="mb-3 rounded-xl overflow-hidden" style={{ border: `1px solid ${c.border}`, backgroundColor: c.codeBg }}>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px]" style={{ color: c.muted, borderBottom: `1px solid ${c.borderSoft}` }}>
          <TerminalSquare size={11} color={c.faint} />
          <span style={{ fontFamily: mono }}>{item.cmd}</span>
        </div>
        <div className="px-2.5 py-2 text-[11px] leading-5 max-h-48 overflow-y-auto" style={{ fontFamily: mono, color: c.faint }}>
          {item.out.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>
    );
  }
  if (item.type === "files-edited") {
    return (
      <Collapsible label={`Edited ${item.files.length} file${item.files.length > 1 ? "s" : ""}`}>
        {item.files.map((f) => (
          <div key={f.path} className="flex items-center gap-2 text-[11.5px]" style={{ fontFamily: mono }}>
            <FileCode2 size={11} color={c.faint} />
            <span style={{ color: c.muted }}>{f.path}</span>
            <span style={{ color: "#4ade80" }}>+{f.add}</span>
            <span style={{ color: "#f87171" }}>-{f.del}</span>
          </div>
        ))}
      </Collapsible>
    );
  }
  if (item.type === "tools-used") {
    return (
      <Collapsible label={`Used ${item.tools.length} tool${item.tools.length > 1 ? "s" : ""}`}>
        {item.tools.map((t, i) => (
          <div key={i} className="flex items-center gap-2 text-[11.5px]" style={{ color: c.muted }}>
            <Wrench size={11} color={c.faint} />
            <span style={{ fontFamily: mono }}>{t.label}</span>
            {t.detail && <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: c.chip, color: c.faint, fontFamily: mono }}>{t.detail}</span>}
          </div>
        ))}
      </Collapsible>
    );
  }
  return null;
}

/* ─── Approval Card ─── */
function ApprovalCard({ call, onApprove, onDeny }: { call: ToolCall; onApprove: () => void; onDeny: () => void }) {
  const toolDef = TOOL_DEFINITIONS.find((t) => t.id === call.toolId);
  return (
    <div className="mb-3 rounded-xl p-3" style={{ backgroundColor: "rgba(250,204,21,.06)", border: `1px solid rgba(250,204,21,.2)` }}>
      <div className="flex items-center gap-2 mb-2">
        <Wrench size={13} color="#facc15" />
        <span className="text-[12px] font-semibold" style={{ color: "#facc15" }}>Tool Approval: {call.toolId}</span>
        {toolDef && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: c.chip, color: c.dim }}>{toolDef.group}</span>}
      </div>
      <div className="text-[11px] mb-2 rounded-lg p-2" style={{ backgroundColor: c.codeBg, fontFamily: mono, color: c.muted }}>
        {JSON.stringify(call.arguments, null, 2)}
      </div>
      <div className="flex gap-2">
        <button onClick={onApprove} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium" style={{ backgroundColor: "rgba(74,222,128,.15)", border: `1px solid rgba(74,222,128,.3)`, color: "#4ade80" }}><CheckCircle2 size={12} /> Approve</button>
        <button onClick={onDeny} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium" style={{ backgroundColor: "rgba(248,113,113,.1)", border: `1px solid rgba(248,113,113,.2)`, color: "#f87171" }}><XCircle size={12} /> Deny</button>
      </div>
    </div>
  );
}

/* ─── Subagent Result Card ─── */
function SubagentResultCard({ result }: { result: SubagentResult }) {
  return (
    <div className="mb-3 rounded-xl p-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={12} color={c.accent} />
        <span className="text-[12px] font-semibold" style={{ color: c.text }}>{result.agentName}</span>
        <span className="text-[10px]" style={{ color: c.dim }}>{(result.duration / 1000).toFixed(1)}s</span>
        {result.success ? <CheckCircle2 size={11} color="#4ade80" /> : <XCircle size={11} color="#f87171" />}
      </div>
      <div className="text-[12px] leading-relaxed" style={{ color: c.muted }}>
        <Markdown text={result.output.slice(0, 1000)} />
      </div>
    </div>
  );
}

/* ─── Background Task Card ─── */
function BackgroundTaskCard({ task, onCancel }: { task: BackgroundTask; onCancel: () => void }) {
  return (
    <div className="rounded-lg p-2.5" style={{ backgroundColor: c.chip, border: `1px solid ${c.borderSoft}` }}>
      <div className="flex items-center gap-2 mb-1">
        {task.status === "running" ? <Loader2 size={11} className="animate-spin" color={c.accent} /> : task.status === "completed" ? <CheckCircle2 size={11} color="#4ade80" /> : <XCircle size={11} color="#f87171" />}
        <span className="text-[11px] font-medium flex-1 truncate" style={{ color: c.text }}>{task.label}</span>
        {task.status === "running" && <button onClick={onCancel} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: c.dim, backgroundColor: c.panel }}><X size={10} /></button>}
      </div>
      {task.status === "running" && <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: c.chip }}><div className="h-full rounded-full transition-all" style={{ width: `${task.progress}%`, backgroundColor: c.accent }} /></div>}
    </div>
  );
}

/* ─── File Tree Browser ─── */
function FileTree({ files, onFileClick, expanded, onToggle }: { files: GitHubFile[]; onFileClick: (path: string) => void; expanded: Set<string>; onToggle: (path: string) => void }) {
  const dirs = files.filter((f) => f.type === "dir").sort((a, b) => a.name.localeCompare(b.name));
  const fileItems = files.filter((f) => f.type === "file").sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="flex flex-col">
      {dirs.map((d) => (
        <div key={d.path}>
          <button onClick={() => onToggle(d.path)} className="flex items-center gap-1.5 w-full text-left py-0.5 px-1 rounded text-[11px] hover:bg-white/5 transition-colors" style={{ color: c.text, paddingLeft: `${(d.path.split("/").length - 1) * 12 + 4}px` }}>
            {expanded.has(d.path) ? <FolderOpen size={11} color={c.accent} /> : <Folder size={11} color={c.faint} />}
            <span className="truncate">{d.name}</span>
          </button>
          {expanded.has(d.path) && (
            <div className="flex flex-col">
              {fileItems.filter((f) => f.path.startsWith(d.path + "/") && !f.path.slice(d.path.length + 1).includes("/")).map((f) => (
                <button key={f.path} onClick={() => onFileClick(f.path)} className="flex items-center gap-1.5 w-full text-left py-0.5 px-1 rounded text-[11px] hover:bg-white/5 transition-colors" style={{ color: c.muted, paddingLeft: `${(f.path.split("/").length - 1) * 12 + 4}px` }}>
                  <File size={11} color={c.faint} />
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      {fileItems.filter((f) => !f.path.includes("/")).map((f) => (
        <button key={f.path} onClick={() => onFileClick(f.path)} className="flex items-center gap-1.5 w-full text-left py-0.5 px-1 rounded text-[11px] hover:bg-white/5 transition-colors" style={{ color: c.muted, paddingLeft: "4px" }}>
          <File size={11} color={c.faint} />
          <span className="truncate">{f.name}</span>
        </button>
      ))}
    </div>
  );
}

/* ─── File Viewer Panel (Monaco Editor) ─── */
function FileViewer({ path, content, onClose }: { path: string; content: string; onClose: () => void }) {
  const language = path.split(".").pop() || "plaintext";
  
  return (
    <div className="rounded-xl overflow-hidden mb-4" style={{ border: `1px solid ${c.border}`, backgroundColor: c.codeBg }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${c.borderSoft}` }}>
        <FileCode2 size={12} color={c.accent} />
        <span className="text-[11px] font-medium flex-1 truncate" style={{ fontFamily: mono, color: c.text }}>{path}</span>
        <button onClick={() => navigator.clipboard.writeText(content)} className="p-1 rounded hover:bg-white/5" title="Copy"><Copy size={11} color={c.muted} /></button>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/5" title="Close"><X size={11} color={c.muted} /></button>
      </div>
      <div style={{ height: "400px" }}>
        <Editor
          height="100%"
          language={language}
          value={content}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 12,
            fontFamily: mono,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}

/* ─── System prompt (Claude Fable 5 level) ─── */
async function buildSystemPrompt(mode: string, effort: string, repo: string, branch: string, threadId: string): Promise<string> {
  const memoryBlock = await buildMemoryBlock(threadId);
  const rulesBlock = await buildRulesBlock();
  const projectMemoryBlock = await buildProjectMemoryBlock(repo);
  const toolList = TOOL_DEFINITIONS.map((t) => `  ${t.id}: ${t.desc}`).join("\n");
  const agentList = BUILTIN_AGENTS.map((a) => `  ${a.id}: ${a.role}`).join("\n");
  const skills = await getSkills();
  const skillList = skills.map((s) => `  ${s.id}: ${s.description}`).join("\n");

  const base = `You are Caret Agent, an expert software engineer and AI coding assistant. You operate like Claude Code: you read code before writing it, you think before acting, and you produce production-quality output. You are connected to a live GitHub repository and can read, write, edit, and manage real files through the GitHub API.

## Identity & Principles
- You are a senior software engineer with deep expertise across all languages, frameworks, and systems
- You NEVER guess or assume. You read the actual code first, verify assumptions, and let the codebase teach you how to move
- You produce minimal, precise, production-quality changes. You do not over-engineer
- You resist adding unnecessary abstractions. Follow the repo's existing patterns
- You explain your reasoning briefly, then execute. No fluff, no padding
- You always tell the user exactly what you did, what files changed, and why

## Repository
- Repo: ${repo}
- Branch: ${branch}
- Date: ${new Date().toISOString().slice(0, 10)}

## Available Tools
${toolList}

## Available Subagents
${agentList}

## Available Skills
${skillList}

## MCP Integration
Connected MCP servers can be used via the mcp_call tool. When a relevant MCP is connected, use it proactively for tasks that benefit from it (e.g., Google Drive for file access, Notion for documentation, Figma for design, Slack for communication, Tavily/Firecrawl for web search, etc.).
Format: {"tool": "mcp_call", "args": {"server": "server_id", "method": "method_name", "params": {}}}

## How to Use Tools
When you need to use a tool, output a code block in this exact format:

\`\`\`tool
{"tool": "tool_name", "args": {"param": "value"}}
\`\`\`

You can call multiple tools in a single response by outputting multiple tool blocks.

To dispatch a subagent:
\`\`\`agent
{"agent": "agent_id", "task": "task description"}
\`\`\`

To run a skill:
\`\`\`skill
{"skill": "skill_id", "task": "task description"}
\`\`\`

## Workflow (Claude Code style)
1. **Understand first**: Read the relevant files to understand the current state before making changes
2. **Plan**: For complex tasks, outline your approach before executing
3. **Execute precisely**: Make minimal, targeted changes. Use replace_in_file for surgical edits
4. **Verify**: After making changes, read the file back to confirm the edit applied correctly
5. **Report**: Tell the user exactly what you changed and why

## Critical Rules
- No emojis. Ever. Use plain text only
- Always read files before modifying them. Never blind-write
- When editing, use replace_in_file with exact text matching (whitespace-sensitive)
- Keep responses concise. One to two sentences for simple answers
- For complex tasks, show a numbered plan first
- If something fails, analyze the error and fix it automatically
- When you finish a task, list every file changed with what was done
- If you cannot do something, say so briefly and suggest alternatives
- Prefer the repo's existing patterns and conventions over inventing new ones
- Add comments only where the code is not self-explanatory

${memoryBlock}${rulesBlock}${projectMemoryBlock}`;

  if (mode === "Interactive") return `${base}\n\n## Mode: Interactive\nBefore using any tool, briefly explain what you plan to do and wait for user approval. Show the tool call, wait for the user to approve or deny it.`;
  if (mode === "Plan") return `${base}\n\n## Mode: Plan\nResearch the codebase thoroughly, create a detailed step-by-step plan with numbered steps. Present the plan to the user for review before executing any changes.`;
  return `${base}\n\n## Mode: Autopilot\nYou have full autonomy. Plan and execute without asking permission. Use tools freely. Report what you did at the end. Focus on producing the best possible output.`;
}

/* ─── Main ChatSession ─── */
export default function ChatSession({ sessionName, onOpenSettings }: {
  sessionName: string; onOpenSettings: () => void;
}) {
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState("Interactive");
  const [model, setModel] = useState("Auto");
  const [effort, setEffort] = useState("Zinc");
  const [phase, setPhase] = useState<"idle" | "thinking" | "streaming">("idle");
  const [pendingApprovals, setPendingApprovals] = useState<ToolCall[]>([]);
  const [agentResults, setAgentResults] = useState<SubagentResult[]>([]);
  const [bgTasks, setBgTasks] = useState<BackgroundTask[]>([]);
  const [indexing, setIndexing] = useState(false);
  const [agentThinking, setAgentThinking] = useState("");
  const [agentPhaseDisplay, setAgentPhaseDisplay] = useState<AgentPhase>("idle");
  const [contextTokens, setContextTokens] = useState(0);
  const [maxContext, setMaxContext] = useState(1000000);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarData, setSidebarData] = useState<AiResponseData | null>(null);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [repoFiles, setRepoFiles] = useState<GitHubFile[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [viewingFile, setViewingFile] = useState<{ path: string; content: string } | null>(null);
  const gh = useGitHub();
  const auth = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (scrollTimeout.current) clearTimeout(scrollTimeout.current); scrollTimeout.current = setTimeout(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, 50); }, [transcript, phase, pendingApprovals, agentResults, bgTasks]);
  useEffect(() => { setTranscript([]); setPhase("idle"); setPendingApprovals([]); setAgentResults([]); setBgTasks([]); }, [sessionName]);

  // Context token counter (debounced to avoid lag)
  const tokenCalcRef = useRef(0);
  useEffect(() => {
    const total = transcript.reduce((sum, item) => {
      if (item.type === "user" || item.type === "text") return sum + Math.ceil(item.text.length / 4);
      if (item.type === "terminal") return sum + Math.ceil((item.cmd + item.out.join("\n")).length / 4);
      if (item.type === "system") return sum + Math.ceil(item.text.length / 4);
      if (item.type === "thought") return sum + Math.ceil(item.text.length / 4);
      return sum;
    }, 0);
    tokenCalcRef.current = total;
    if (contextTokens !== total) setContextTokens(total);
  }, [transcript]);

  // Load repo files
  const loadRepoFiles = useCallback(async () => {
    if (!gh.token || !gh.selectedRepo) return;
    try {
      const files = await gh.getFileTree("");
      setRepoFiles(files);
    } catch {}
  }, [gh]);

  useEffect(() => { if (gh.connected && gh.selectedRepo) loadRepoFiles(); }, [gh.connected, gh.selectedRepo, loadRepoFiles]);

  // Parse tool/agent/skill calls from AI response
  const parseCalls = useCallback((text: string): { tools: ToolCall[]; agents: Array<{ agent: string; task: string }>; skills: Array<{ skill: string; task: string }> } => {
    const tools: ToolCall[] = [];
    const agents: Array<{ agent: string; task: string }> = [];
    const skills: Array<{ skill: string; task: string }> = [];
    const toolRegex = /```tool\s*\n([\s\S]*?)```/g;
    let match;
    while ((match = toolRegex.exec(text)) !== null) {
      try { const j = JSON.parse(match[1]); tools.push({ id: `tc-${Date.now()}-${tools.length}`, toolId: j.tool, arguments: j.args ?? {} }); } catch {}
    }
    const agentRegex = /```agent\s*\n([\s\S]*?)```/g;
    while ((match = agentRegex.exec(text)) !== null) {
      try { const j = JSON.parse(match[1]); agents.push({ agent: j.agent, task: j.task }); } catch {}
    }
    const skillRegex = /```skill\s*\n([\s\S]*?)```/g;
    while ((match = skillRegex.exec(text)) !== null) {
      try { const j = JSON.parse(match[1]); skills.push({ skill: j.skill, task: j.task }); } catch {}
    }
    return { tools, agents, skills };
  }, []);

  // Approve tool
  const approveTool = useCallback(async (callId: string) => {
    const call = pendingApprovals.find((c) => c.id === callId);
    if (!call) return;
    setPendingApprovals((p) => p.filter((c) => c.id !== callId));
    const hookOutput = await runHooks("pre_tool", { toolName: call.toolId, args: call.arguments });
    if (hookOutput.length) setTranscript((t) => [...t, ...hookOutput.map((h) => ({ type: "system" as const, text: h }))]);
    setTranscript((t) => [...t, { type: "system", text: `Executing ${call.toolId}...` }]);
    const start = Date.now();
    const result = await executeTool(call.toolId, call.arguments, gh.token ?? undefined, gh.selectedRepo ?? undefined, gh.selectedBranch ?? undefined);
    const duration = Date.now() - start;
    const postHook = await runHooks("post_tool", { toolName: call.toolId, result: result.output });
    if (postHook.length) setTranscript((t) => [...t, ...postHook.map((h) => ({ type: "system" as const, text: h }))]);
    setTranscript((t) => [...t, { type: "terminal", cmd: `${call.toolId}(${JSON.stringify(call.arguments).slice(0, 100)})`, out: (result.output || result.error || "").split("\n").slice(0, 50) }]);
    await sendInternal(`Tool ${call.toolId} result:\n${result.output || result.error || "done"}`, true);
  }, [pendingApprovals, gh]);

  const denyTool = useCallback((callId: string) => {
    setPendingApprovals((p) => p.filter((c) => c.id !== callId));
    setTranscript((t) => [...t, { type: "system", text: "Tool call denied by user." }]);
  }, []);

  const handleFeedback = useCallback(async (msgId: string, type: "up" | "down") => {
    await recordFeedback({ threadId: sessionName, messageId: msgId, type: type === "up" ? "thumbs_up" : "thumbs_down" });
    setTranscript((t) => [...t, { type: "system", text: type === "up" ? "Positive feedback recorded." : "Negative feedback recorded. Will learn from this." }]);
  }, [sessionName]);

  const doIndex = useCallback(async () => {
    if (!gh.token || !gh.selectedRepo) return;
    setIndexing(true);
    const [owner, repo] = gh.selectedRepo.split("/");
    await indexCodebase(gh.token, owner, repo, gh.selectedBranch ?? "main");
    setIndexing(false);
    setTranscript((t) => [...t, { type: "system", text: `Codebase indexed: ${getCurrentIndex()?.files.length ?? 0} files, ${getCurrentIndex()?.symbols.length ?? 0} symbols` }]);
  }, [gh]);

  // Internal send
  const sendInternal = useCallback(async (text: string, isToolResult = false) => {
    if (auth.budgetExceeded && !isToolResult) {
      setTranscript((t) => [...t, { type: "user", text }, { type: "system", text: `Daily budget of $${auth.dailyLimit} exceeded.` }]);
      return;
    }
    if (!isToolResult) {
      setTranscript((t) => [...t, { type: "user", text }]);
      await messagesDB.put({ id: `msg-${Date.now()}-user`, threadId: sessionName, role: "user", content: text, createdAt: Date.now() });
    }
    setPhase("thinking");
    const systemPrompt = await buildSystemPrompt(mode, effort, gh.selectedRepo ?? "", gh.selectedBranch ?? "main", sessionName);
    const msgs: ChatMessage[] = [{ role: "system", content: systemPrompt }];
    const recent = transcript.slice(-30);
    for (const item of recent) { if (item.type === "user") msgs.push({ role: "user", content: item.text }); else if (item.type === "text") msgs.push({ role: "assistant", content: stripToolBlocks(item.text) }); }
    msgs.push({ role: "user", content: text });

    let fullText = "";
    setPhase("streaming");
    setTranscript((t) => [...t, { type: "text", text: "" }]);
    const actualModel = model === "Auto" ? "claude-fable-5" : model;
    await chatStream(actualModel, msgs,
      (token) => { fullText += token; setTranscript((t) => { const next = [...t]; const last = next[next.length - 1]; if (last?.type === "text") next[next.length - 1] = { type: "text", text: fullText }; return next; }); },
      async (usage) => {
        setPhase("idle");
        const { tools, agents, skills } = parseCalls(fullText);
        const sidebarFiles: AiResponseData["filesChanged"] = [];
        const sidebarDb: AiResponseData["dbChanges"] = [];
        const sidebarCmds: string[] = [];

        if (tools.length > 0 && mode === "Interactive") {
          setPendingApprovals(tools);
          setTranscript((t) => [...t, { type: "system", text: `${tools.length} tool call(s) pending approval` }]);
        } else if (tools.length > 0 && (mode === "Autopilot" || mode === "Plan")) {
          for (const call of tools) {
            await runHooks("pre_tool", { toolName: call.toolId, args: call.arguments });
            const start = Date.now();
            const result = await executeTool(call.toolId, call.arguments, gh.token ?? undefined, gh.selectedRepo ?? undefined, gh.selectedBranch ?? undefined);
            const duration = Date.now() - start;
            await runHooks("post_tool", { toolName: call.toolId, result: result.output });
            setTranscript((t) => [...t, { type: "terminal", cmd: `${call.toolId}(${JSON.stringify(call.arguments).slice(0, 100)})`, out: (result.output || result.error || "").split("\n").slice(0, 50) }]);
            if (call.toolId === "write_file" || call.toolId === "replace_in_file") {
              sidebarFiles.push({ path: call.arguments.path as string, additions: 10, deletions: 2, content: result.output.slice(0, 500) });
            } else if (call.toolId === "bash") {
              sidebarCmds.push(call.arguments.command as string);
            } else if (call.toolId === "mcp_call") {
              sidebarDb.push({ table: call.arguments.server as string, operation: call.arguments.method as string, query: JSON.stringify(call.arguments.params), rowsAffected: 1 });
            }
          }
        }

        for (const a of agents) {
          const agent = BUILTIN_AGENTS.find((x) => x.id === a.agent);
          if (agent) {
            setTranscript((t) => [...t, { type: "system", text: `Dispatching ${agent.name}...` }]);
            const result = await dispatchAgent(agent, a.task, transcript.slice(-10).map((t) => t.type === "text" ? t.text : "").join("\n"));
            setAgentResults((r) => [...r, result]);
          }
        }

        for (const s of skills) {
          setTranscript((t) => [...t, { type: "system", text: `Running skill ${s.skill}...` }]);
          const result = await executeSkill(s.skill, s.task);
          setTranscript((t) => [...t, { type: "system", text: result }]);
        }

        await messagesDB.put({ id: `msg-${Date.now()}-asst`, threadId: sessionName, role: "assistant", content: fullText, model, usage, createdAt: Date.now() });
        if (usage) { const cost = estimateCost(actualModel, usage.prompt_tokens, usage.completion_tokens); await usageDB.addUsage(actualModel, usage.prompt_tokens, usage.completion_tokens, cost, gh.user?.login ?? "unknown"); auth.refreshBudget(); }
        setSidebarData({ filesChanged: sidebarFiles, dbChanges: sidebarDb, commandsRun: sidebarCmds, branch: gh.selectedBranch ?? "main" });
        setSidebarOpen(true);
      },
      (err) => { setPhase("idle"); setTranscript((t) => { const next = [...t]; const last = next[next.length - 1]; if (last?.type === "text" && last.text === "") next[next.length - 1] = { type: "system", text: `Error: ${err.message}` }; else next.push({ type: "system", text: `Error: ${err.message}` }); return next; }); },
    );
  }, [auth, gh, mode, effort, model, sessionName, transcript, parseCalls]);

  const send = useCallback(async (text: string, attachments: Attachment[]) => {
    const label = attachments.length ? `${text}${text ? "\n\n" : ""}${attachments.map((a) => `[${a.label}]`).join("\n")}` : text;
    setMessage("");
    for (const a of attachments) { if (a.kind === "memory" && a.file) { await uploadMemoryFile(a.file); setTranscript((t) => [...t, { type: "system", text: `Memory file "${a.label}" added` }]); } }
    await sendInternal(label);
  }, [sendInternal]);

  const dispatchSubagent = useCallback(async (agentId: string, task: string) => {
    const agent = BUILTIN_AGENTS.find((a) => a.id === agentId);
    if (!agent) return;
    setTranscript((t) => [...t, { type: "system", text: `Dispatching ${agent.name}...` }]);
    const result = await dispatchAgent(agent, task, transcript.slice(-10).map((t) => t.type === "text" ? t.text : "").join("\n"));
    setAgentResults((r) => [...r, result]);
    setTranscript((t) => [...t, { type: "system", text: `${agent.name} completed in ${(result.duration / 1000).toFixed(1)}s` }]);
  }, [transcript]);

  const runAutonomousAgent = useCallback(async (task: string) => {
    setTranscript((t) => [...t, { type: "user", text: task }, { type: "system", text: "Autonomous agent started..." }]);
    setPhase("thinking");
    await runAgentLoop(task, mode, effort, {
      onThinking: (thought) => { setAgentThinking(thought); setTranscript((t) => [...t, { type: "thought", text: thought.slice(0, 500) + (thought.length > 500 ? "..." : "") }]); },
      onPhaseChange: (phase) => { setAgentPhaseDisplay(phase); const labels: Record<string, string> = { planning: "Planning", coding: "Coding", debugging: "Debugging", verifying: "Verifying", deploying: "Deploying", correcting: "Auto-correcting" }; setTranscript((t) => [...t, { type: "system", text: labels[phase] ?? phase }]); },
      onStep: (step) => { if (step.action) setTranscript((t) => [...t, { type: "system", text: `-> ${step.action}` }]); },
      onToolCall: (call) => { setTranscript((t) => [...t, { type: "system", text: `Calling ${call.toolId}(...)` }]); },
      onToolResult: (call, result) => { setTranscript((t) => [...t, { type: "terminal", cmd: call.toolId, out: result.split("\n").slice(0, 20) }]); },
      onPlanUpdate: (plan) => { setTranscript((t) => [...t, { type: "plan", steps: plan.map((s) => ({ text: s, done: false })) }]); },
      onCorrection: (error, fix) => { setTranscript((t) => [...t, { type: "system", text: `Auto-correction: ${error.slice(0, 100)} -> ${fix}` }]); },
      onVerification: (results) => { if (results) { const summary = results.checks.map((c) => `${c.passed ? "pass" : "fail"} ${c.name}`).join(" | "); setTranscript((t) => [...t, { type: "system", text: `Verification: ${summary}` }]); } },
      onComplete: (run) => { const duration = ((run.finishedAt! - run.startedAt) / 1000).toFixed(1); setTranscript((t) => [...t, { type: "system", text: `Agent completed in ${duration}s | ${run.steps.length} steps | ${run.correctionCount} corrections | ${run.totalTokens} tokens` }]); setPhase("idle"); },
      onError: (error) => { setTranscript((t) => [...t, { type: "system", text: `Agent error: ${error}` }]); setPhase("idle"); },
      onToken: () => {},
    }, { maxSteps: 15, maxCorrections: 3, autoVerify: true, autoDeploy: false });
  }, [mode, effort]);

  useEffect(() => { const iv = setInterval(() => setBgTasks(getBackgroundTasks()), 2000); return () => clearInterval(iv); });

  const runCommand = useCallback((cmd: SlashCommand) => {
    if (cmd.action === "settings") return onOpenSettings();
    if (cmd.action === "clear") { setTranscript([]); messagesDB.clearThread(sessionName); return; }
    if (cmd.action === "review") { dispatchSubagent("reviewer", "Review the current codebase for bugs, security issues, and improvements"); return; }
    if (cmd.action === "test") { dispatchSubagent("tester", "Run the test suite and fix any failures"); return; }
    if (cmd.action === "init") { runAutonomousAgent("Scan the codebase, understand the architecture, and create a CLAUDE.md project memory file."); return; }
    if (cmd.action === "help") { setTranscript((t) => [...t, { type: "user", text: "/help" }, { type: "text", text: "## Caret Agent\n\nAI coding assistant. Reads your code, understands context, and produces production-quality changes.\n\n## Slash Commands\n- `/clear` — Clear conversation\n- `/review` — Adversarial code review\n- `/test` — Run and fix tests\n- `/init` — Auto-index codebase\n- `/help` — This message\n\n## Modes\n- **Interactive** — Approve each tool call\n- **Plan** — Research + plan, then execute\n- **Autopilot** — Full autonomy, best output\n\n## Effort Levels\n- **Zinc** — x1.5 cost, 8 subagents, medium thinking with self-correction\n- **Manguzuime** — x4 cost, 12 subagents, max thinking + searching + planning + reasoning\n\n## Tools\n- `read_file` — Read file contents\n- `write_file` — Create/overwrite files\n- `replace_in_file` — Surgical text replacement\n- `list_files` — Browse repository files\n- `search_files` — Regex search across files\n- `git_status` — Working tree status\n- `git_diff` — Show file diffs\n- `bash` — Run shell commands\n- `web_search` — Search the web\n- `spawn_agent` — Dispatch specialist\n- `remember` — Store persistent memory\n\n## MCPs & Skills\nUse the + menu to connect MCP servers and install skills." }]); return; }
    sendInternal(cmd.cmd);
  }, [onOpenSettings, sessionName, dispatchSubagent, sendInternal, runAutonomousAgent]);

  const busy = phase !== "idle";
  const tokenPct = maxContext > 0 ? Math.min(100, (contextTokens / maxContext) * 100) : 0;
  const tokenColor = tokenPct > 90 ? "#f87171" : tokenPct > 70 ? "#facc15" : c.muted;

  return (
    <div className="flex-1 flex h-full min-w-0 relative" style={{ backgroundColor: c.bg, fontFamily: font }}>
      {/* Subtle glow effect */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.03) 0%, transparent 50%)`,
      }} />
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 sm:px-5 h-11 flex-shrink-0" style={{ borderBottom: `1px solid ${c.border}` }}>
          <span className="text-[11px]" style={{ color: c.dim, fontFamily: mono }}>thread /</span>
          <span className="text-[13px] font-medium truncate" style={{ color: c.text }}>{sessionName}</span>
          {gh.selectedRepo && <span className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1" style={{ backgroundColor: c.chip, color: c.muted, border: `1px solid ${c.borderSoft}`, fontFamily: mono }}><GitBranch size={9} />{gh.selectedBranch ?? "main"}</span>}
          <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
            {(gh.connected && gh.selectedRepo) && <button onClick={async () => {
              if (!gh.token || !gh.selectedRepo) return;
              const [owner, repo] = gh.selectedRepo.split("/");
              const branch = gh.selectedBranch ?? "main";
              const resp = await chatCompletion("claude-fable-5", [
                { role: "system", content: "You are a PR creation assistant. Create a concise PR title and description for the current branch changes." },
                { role: "user", content: `Create a PR for ${owner}/${repo} branch ${branch}. Provide a one-line title and brief description.` }
              ], 0.4);
              const summary = resp.choices[0]?.message?.content ?? "Update";
              const lines = summary.split("\n");
              const title = lines[0].replace(/^#+\s*/, "").trim();
              const body = lines.slice(2).join("\n").trim();
              try {
                await githubAPI.createPR(gh.token, owner, repo, title || `PR: ${branch}`, branch, "main", body || undefined);
                setTranscript((t) => [...t, { type: "system", text: `PR created: ${title || branch}` }]);
              } catch (err) {
                setTranscript((t) => [...t, { type: "system", text: `PR creation failed: ${err instanceof Error ? err.message : String(err)}` }]);
              }
            }} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px]" style={{ backgroundColor: "rgba(255,255,255,.05)", border: `1px solid ${c.borderSoft}`, color: c.muted }} title="Push PR">
              <GitBranch size={9} /> PR
            </button>}
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* File browser sidebar */}
          {showFileBrowser && (
            <div className="w-56 flex-shrink-0 overflow-y-auto p-2" style={{ borderRight: `1px solid ${c.border}` }}>
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: c.faint }}>Repository Files</div>
              {repoFiles.length > 0 ? (
                <FileTree files={repoFiles} onFileClick={async (path) => { if (!gh.token || !gh.selectedRepo) return; try { const content = await gh.getFileContent(path); setViewingFile({ path, content }); } catch {} }} expanded={expandedDirs} onToggle={(path) => { setExpandedDirs((prev) => { const next = new Set(prev); if (next.has(path)) next.delete(path); else next.add(path); return next; }); }} />
              ) : (
                <div className="text-[11px] px-1 py-2" style={{ color: c.dim }}>{gh.connected ? "Loading..." : "Connect GitHub to browse files"}</div>
              )}
            </div>
          )}

          {/* Transcript */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">
            <div className="max-w-2xl mx-auto w-full">
              {viewingFile && <FileViewer path={viewingFile.path} content={viewingFile.content} onClose={() => setViewingFile(null)} />}
              {transcript.map((item, i) => <Item key={i} item={item} onFeedback={handleFeedback} />)}
              {pendingApprovals.map((call) => <ApprovalCard key={call.id} call={call} onApprove={() => approveTool(call.id)} onDeny={() => denyTool(call.id)} />)}
              {agentResults.map((r, i) => <SubagentResultCard key={i} result={r} />)}
              {bgTasks.length > 0 && (
                <Collapsible label={`Background Tasks (${bgTasks.length})`} defaultOpen={bgTasks.some((t) => t.status === "running")}>
                  {bgTasks.map((t) => <BackgroundTaskCard key={t.id} task={t} onCancel={() => cancelTask(t.id)} />)}
                </Collapsible>
              )}
              {agentPhaseDisplay !== "idle" && phase !== "idle" && (
                <div className="mb-3 rounded-xl p-3" style={{ backgroundColor: "rgba(100,200,255,.06)", border: "1px solid rgba(100,200,255,.15)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Loader2 size={12} className="animate-spin" color={c.accent} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: c.accent }}>Agent: {agentPhaseDisplay}</span>
                  </div>
                  {agentThinking && <div className="text-[11px] mt-1 max-h-20 overflow-y-auto" style={{ color: c.muted, fontFamily: mono }}>{agentThinking.slice(0, 500)}{agentThinking.length > 500 ? "..." : ""}</div>}
                </div>
              )}
              {phase === "thinking" && agentPhaseDisplay === "idle" && <div className="flex items-center gap-2 text-[12px]" style={{ color: c.faint }}><span className="inline-block" style={{ animation: "pulse 1.2s ease-in-out infinite", color: effort.toLowerCase() === "manguzuime" ? "#c084fc" : "#7dd3fc" }}>●</span> <span style={{ color: "inherit" }}>{effort}</span> mode<span style={{ fontFamily: mono, color: c.dim, marginLeft: 4 }}>• streaming</span></div>}
              {phase === "streaming" && <div className="flex items-center gap-2 text-[12px]" style={{ color: c.faint }}><span className="inline-block" style={{ animation: "pulse 1.2s ease-in-out infinite", color: "#4ade80" }}>●</span> Generating response</div>}
              {transcript.length === 0 && (
                <div className="text-center py-16">
                  <div className="text-[18px] font-medium mb-2" style={{ color: c.text }}>Caret Agent</div>
                  <div className="text-[12px] mb-1" style={{ color: c.muted }}>Connected to {gh.selectedRepo ?? "no repository"}</div>
                  <div className="text-[11px] mb-5" style={{ color: c.dim }}>Type a task, use <span style={{ fontFamily: mono }}>/</span> for commands, <span style={{ fontFamily: mono }}>@</span> for context, <span style={{ fontFamily: mono }}>+</span> to attach</div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {[{ label: "/review", desc: "Code review" }, { label: "/test", desc: "Run tests" }, { label: "/init", desc: "Auto-agent" }, { label: "Index", desc: "Index codebase" }].map((s) => (
                      <button key={s.label} onClick={() => s.label === "Index" ? doIndex() : runCommand({ cmd: s.label, desc: s.desc, group: "" } as SlashCommand)} className="px-3 py-1.5 rounded-lg text-[11px]" style={{ backgroundColor: c.chip, border: `1px solid ${c.border}`, color: c.muted }}>
                        {s.label} <span style={{ color: c.dim }}>| {s.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Composer */}
        <div className="px-5 pb-4 pt-3 flex-shrink-0" style={{ borderTop: `1px solid ${c.border}` }}>
          <div className="max-w-2xl mx-auto">
            <Composer value={message} onChange={setMessage} onSubmit={send} onCommand={runCommand} placeholder="Reply...   / commands · @ context · + attach" rows={3} mode={mode} onMode={setMode} model={model} onModel={setModel} effort={effort} onEffort={setEffort} busy={busy}
              contextTokens={contextTokens} maxContext={maxContext}
              onStop={() => { setPhase("idle"); setTranscript((t) => [...t, { type: "system", text: "Interrupted." }]); }} />
            <div className="mt-2 relative flex items-center gap-3 text-[10.5px]" style={{ color: c.dim, fontFamily: mono }}>
              <span>{model === "Auto" ? "claude-fable-5" : model}</span>
              <span>{effort.toLowerCase()} effort</span>
              <span>{mode.toLowerCase()}</span>
              <span className="flex items-center gap-1">
                <div className="w-10 h-1 rounded-full overflow-hidden" style={{ backgroundColor: c.chip }}>
                  <div className="h-full rounded-full" style={{ width: `${tokenPct}%`, backgroundColor: tokenColor }} />
                </div>
                <span style={{ color: tokenColor }}>{contextTokens >= 1000000 ? `${(contextTokens / 1000000).toFixed(1)}M` : `${Math.round(contextTokens / 1000)}k`}/{maxContext >= 1000000 ? `${(maxContext / 1000000).toFixed(0)}M` : `${Math.round(maxContext / 1000)}k`}</span>
              </span>
              <span>{getCurrentIndex() ? `${getCurrentIndex()!.files.length} indexed` : ""}</span>
              <button onClick={doIndex} disabled={indexing} className="flex items-center gap-1 text-[10px]" style={{ color: indexing ? c.muted : c.accent, backgroundColor: "transparent", border: `1px solid ${c.borderSoft}`, padding: "2px 8px", borderRadius: "6px" }}>{indexing ? <Loader2 size={9} className="animate-spin" /> : <RefreshCw size={9} />} Index</button>
              <span className="ml-auto">{busy ? "esc to interrupt" : "send"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Response Sidebar */}
      <AiResponseSidebar data={sidebarData} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
}
