import { useState } from "react";
import {
  Check, ChevronDown, ChevronRight, CircleDashed, Folder, FolderOpen, File,
  Search, TerminalSquare, Lightbulb, Sparkles, Wrench, Copy, ExternalLink,
  X, Loader2, Square, GitBranch, AlertTriangle, CheckCircle2, XCircle,
  FileCode2, Clock, Zap, Eye, RefreshCw, Bot, Send, Play, Pause,
  Plus, Trash2, Upload, Download, Settings, LogOut, Users, Key,
  Database, Brain, Figma, Slack, Mail, Globe, Server, Code2,
  Rocket, Zap as ZapIcon, Shield, Activity, TrendingUp, BarChart3,
  MessageSquare, Hash, AtSign, Star, Heart, ThumbsUp, ThumbsDown,
} from "lucide-react";
import { c, mono, font } from "./theme";
import { effortLevels, modeOptions, type ModelOption } from "./data";
import { effortToParams } from "../services/api";

/* ─── Mock data ─── */
const MOCK_TRANSCRIPT = [
  { type: "user" as const, text: "Create a PR automation workflow that reviews code changes, runs tests, and posts a summary to Slack." },
  { type: "text" as const, text: "Here's what I'll do:\n\n1. **Set up GitHub webhook** — listens for PR events\n2. **Run static analysis** — ESLint + TypeScript checks\n3. **Execute test suite** — runs all unit and integration tests\n4. **Generate summary** — creates a PR report with findings\n5. **Post to Slack** — sends formatted notification to #dev-updates\n\nStarting execution now..." },
  { type: "thought" as const, text: "The user wants a PR automation workflow. I need to break this down into steps:\n1. First, set up the GitHub webhook to listen for PR events\n2. Then configure the test runner to execute on PR creation\n3. Finally, set up Slack webhook for notifications\n\nLet me think about the best order of operations and any edge cases..." },
  { type: "terminal" as const, cmd: "bash", out: ["✓ ESLint passed (0 errors)", "✓ TypeScript compiled successfully", "✓ 47 tests passing", "✓ 2 tests skipped (pending)", "Coverage: 94.2%"] },
  { type: "system" as const, text: "Agent completed in 12.4s | 5 steps | 0 corrections | 8432 tokens" },
  { type: "text" as const, text: "Workflow deployed successfully!\n\n- **Status**: Active\n- **Trigger**: PR opened\n- **Tests**: 47 passing\n- **Coverage**: 94.2%\n- **Slack**: #dev-updates notified" },
  { type: "user" as const, text: "Good, now let me see the workflow canvas" },
  { type: "plan" as const, steps: [
    { text: "Create GitHub webhook listener", done: true },
    { text: "Configure test runner integration", done: true },
    { text: "Set up Slack notification webhook", done: true },
    { text: "Create workflow visualization canvas", done: false },
    { text: "Deploy and test end-to-end", done: false },
  ]},
  { type: "files-edited" as const, files: [
    { path: "src/workflows/pr-automation.ts", add: 142, del: 0 },
    { path: "src/workflows/slack-notifier.ts", add: 67, del: 0 },
    { path: "src/config/pr-hooks.json", add: 23, del: 0 },
  ]},
  { type: "tools-used" as const, tools: [
    { label: "bash", detail: "npm test" },
    { label: "read_file", detail: "package.json" },
    { label: "web_search", detail: "Slack webhook API" },
  ]},
];

const MOCK_NODES = [
  { id: "n1", type: "n8n-nodes-base.githubTrigger", name: "githubTrigger", displayName: "GitHub Trigger", category: "Triggers", icon: "🐙", config: {}, position: { x: 100, y: 200 } },
  { id: "n2", type: "n8n-nodes-base.ai", name: "aiAnalysis", displayName: "AI Analysis", category: "AI", icon: "🤖", config: {}, position: { x: 400, y: 150 } },
  { id: "n3", type: "n8n-nodes-base.test", name: "testRunner", displayName: "Test Runner", category: "DevOps", icon: "🧪", config: {}, position: { x: 400, y: 300 } },
  { id: "n4", type: "n8n-nodes-base.slack", name: "slackNotify", displayName: "Slack Notify", category: "Communication", icon: "💬", config: {}, position: { x: 700, y: 200 } },
  { id: "n5", type: "n8n-nodes-base.zendesk", name: "createTicket", displayName: "Create Ticket", category: "CRM", icon: "🎫", config: {}, position: { x: 700, y: 350 } },
];

const MOCK_CONNECTIONS = [
  { id: "c1", from: "n1", fromPort: 0, to: "n2", toPort: 0 },
  { id: "c2", from: "n1", fromPort: 0, to: "n3", toPort: 0 },
  { id: "c3", from: "n2", fromPort: 0, to: "n4", toPort: 0 },
  { id: "c4", from: "n3", fromPort: 0, to: "n5", toPort: 0 },
];

const MOCK_MCP_SERVERS = [
  { id: "google-drive", name: "Google Drive", status: "connected", icon: "📁", authType: "oauth" },
  { id: "notion", name: "Notion", status: "connected", icon: "📝", authType: "oauth" },
  { id: "figma", name: "Figma", status: "connected", icon: "🎨", authType: "oauth" },
  { id: "tavily", name: "Tavily", status: "connected", icon: "🔍", authType: "api_key" },
  { id: "slack", name: "Slack", status: "connected", icon: "💬", authType: "oauth" },
  { id: "gmail", name: "Gmail", status: "connected", icon: "📧", authType: "oauth" },
  { id: "supabase", name: "Supabase", status: "connected", icon: "🗄️", authType: "api_key" },
  { id: "vercel", name: "Vercel", status: "connected", icon: "▲", authType: "api_key" },
];

const MOCK_USAGE = {
  promptTokens: 14283,
  completionTokens: 3847,
  totalTokens: 18130,
  cost: 0.0123,
  model: "claude-fable-5",
};

/* ─── Simulation Panel ─── */
export default function SimulationPanel() {
  const [activeTab, setActiveTab] = useState("transcript");

  const tabs = ["transcript", "canvas", "mcp", "composer", "dropdowns", "effort", "chat"];

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden" style={{ backgroundColor: c.bg, fontFamily: font }}>
      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 flex-shrink-0" style={{ borderBottom: `1px solid ${c.border}` }}>
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-3 py-1 rounded-lg text-[11px] font-medium capitalize transition-colors"
            style={{
              backgroundColor: activeTab === tab ? c.chipHover : "transparent",
              color: activeTab === tab ? c.text : c.muted,
              border: `1px solid ${activeTab === tab ? c.borderStrong : "transparent"}`,
            }}>
            {tab}
          </button>
        ))}
        <span className="ml-auto text-[10px]" style={{ color: c.dim, fontFamily: mono }}>Simulation Mode</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "transcript" && <TranscriptSimulation />}
        {activeTab === "canvas" && <CanvasSimulation />}
        {activeTab === "mcp" && <MCPSimulation />}
        {activeTab === "composer" && <ComposerSimulation />}
        {activeTab === "dropdowns" && <DropdownsSimulation />}
        {activeTab === "effort" && <EffortSimulation />}
        {activeTab === "chat" && <ChatSimulation />}
      </div>
    </div>
  );
}

/* ─── Transcript Simulation ─── */
function TranscriptSimulation() {
  return (
    <div className="p-4 max-w-3xl mx-auto space-y-3">
      <h3 className="text-[12px] font-semibold uppercase tracking-wider mb-3" style={{ color: c.faint }}>Message Transcript Simulation</h3>
      {MOCK_TRANSCRIPT.map((msg, i) => (
        <div key={i} className={`rounded-xl p-3 ${msg.type === "user" ? "ml-8" : "mr-4"}`}
          style={{ backgroundColor: msg.type === "user" ? c.chip : c.panel, border: `1px solid ${c.borderSoft}`, color: c.text }}>
          {msg.type === "user" && <div className="text-[10px] mb-1 font-medium" style={{ color: c.accent }}>You</div>}
          {msg.type === "thought" && <div className="flex items-center gap-1.5 mb-1"><Lightbulb size={10} color="#c8b464" /><span className="text-[10px] font-semibold uppercase" style={{ color: "#c8b464" }}>Thinking</span></div>}
          {msg.type === "terminal" && <div className="flex items-center gap-1.5 mb-1"><TerminalSquare size={10} color={c.faint} /><span className="text-[10px] font-medium" style={{ color: c.faint, fontFamily: mono }}>{msg.cmd}</span></div>}
          {msg.type === "system" && <div className="flex items-center gap-1.5 mb-1"><Sparkles size={10} color={c.accent} /><span className="text-[10px]" style={{ color: c.muted }}>System</span></div>}
          {msg.type === "plan" && <div className="flex items-center gap-1.5 mb-1"><ZapIcon size={10} color={c.accent} /><span className="text-[10px] font-semibold uppercase" style={{ color: c.faint }}>Execution Plan</span></div>}
          {msg.type === "text" && <div className="text-[12px]">{msg.text.replace(/\*\*/g, "").replace(/\*/g, "").replace(/`/g, "")}</div>}
          {msg.type === "files-edited" && <div className="text-[11px]"><div className="font-medium mb-1" style={{ color: c.text }}>Edited files:</div>{msg.files.map((f, j) => <div key={j} className="flex items-center gap-2" style={{ fontFamily: mono, color: c.muted, fontSize: 10 }}><FileCode2 size={10} />{f.path} <span style={{ color: "#4ade80" }}>+{f.add}</span> <span style={{ color: "#f87171" }}>-{f.del}</span></div>)}</div>}
          {msg.type === "tools-used" && <div className="text-[11px]"><div className="font-medium mb-1" style={{ color: c.text }}>Tools used:</div>{msg.tools.map((t, j) => <div key={j} className="flex items-center gap-2" style={{ color: c.muted, fontSize: 10 }}><Wrench size={10} />{t.label} {t.detail && <span style={{ fontFamily: mono, color: c.dim }}>{t.detail}</span>}</div>)}</div>}
          {msg.type === "plan" && msg.steps && <div className="flex flex-col gap-1">{msg.steps.map((s, j) => <div key={j} className="flex items-center gap-2 text-[11px]" style={{ color: s.done ? c.muted : c.text }}>{s.done ? <Check size={10} color={c.accent} /> : <CircleDashed size={10} color={c.faint} />}<span style={{ textDecoration: s.done ? "line-through" : "none" }}>{s.text}</span></div>)}</div>}
        </div>
      ))}
    </div>
  );
}

/* ─── Canvas Simulation ─── */
function CanvasSimulation() {
  return (
    <div className="p-4">
      <h3 className="text-[12px] font-semibold uppercase tracking-wider mb-3" style={{ color: c.faint }}>Workflow Canvas Simulation</h3>
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#050505", border: `1px solid ${c.border}`, height: "400px", position: "relative" }}>
        <svg width="100%" height="100%" style={{ cursor: "default" }}>
          <defs>
            <pattern id="simGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="0.5" fill={c.borderSoft} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#simGrid)" />
          {MOCK_CONNECTIONS.map((conn) => {
            const from = MOCK_NODES.find((n) => n.id === conn.from);
            const to = MOCK_NODES.find((n) => n.id === conn.to);
            if (!from || !to) return null;
            const x1 = from.position.x + 200;
            const y1 = from.position.y + 28;
            const x2 = to.position.x;
            const y2 = to.position.y + 28;
            const cx1 = x1 + Math.abs(x2 - x1) * 0.4;
            const cx2 = x2 - Math.abs(x2 - x1) * 0.4;
            return <path key={conn.id} d={`M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`} fill="none" stroke={c.borderStrong} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.6} />;
          })}
          {MOCK_NODES.map((node) => (
            <g key={node.id} transform={`translate(${node.position.x},${node.position.y})`}>
              <rect x={1} y={2} width={200} height={56} rx={10} fill="rgba(0,0,0,.5)" />
              <rect width={200} height={56} rx={10} fill="rgba(20,20,20,.8)" stroke={c.border} strokeWidth={1} />
              <circle cx={22} cy={28} r={14} fill="rgba(20,20,20,.8)" stroke={c.border} strokeWidth={1} />
              <text x={22} y={32} textAnchor="middle" fontSize={14}>{node.icon}</text>
              <text x={42} y={22} fill={c.text} fontSize={11} fontWeight={600} fontFamily="-apple-system,sans-serif">{node.displayName}</text>
              <text x={42} y={38} fill={c.dim} fontSize={9} fontFamily={mono}>{node.category}</text>
              {!node.category?.toLowerCase().startsWith("trigger") && (
                <circle cx={0} cy={28} r={5} fill={c.bg} stroke={c.border} strokeWidth={1.5} />
              )}
              <circle cx={200} cy={28} r={5} fill={c.bg} stroke={c.accent} strokeWidth={1.5} />
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-2">
        {MOCK_NODES.map((node) => (
          <div key={node.id} className="rounded-lg p-2 text-center" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <div className="text-lg mb-1">{node.icon}</div>
            <div className="text-[10px] font-medium truncate" style={{ color: c.text }}>{node.displayName}</div>
            <div className="text-[8px]" style={{ color: c.dim, fontFamily: mono }}>{node.category}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── MCP Simulation ─── */
function MCPSimulation() {
  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h3 className="text-[12px] font-semibold uppercase tracking-wider mb-3" style={{ color: c.faint }}>MCP Servers Simulation</h3>
      <div className="grid grid-cols-2 gap-2">
        {MOCK_MCP_SERVERS.map((mcp) => (
          <div key={mcp.id} className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: c.chip, border: `1px solid ${c.border}` }}>
              {mcp.icon}
            </div>
            <div className="flex-1">
              <div className="text-[12px] font-medium" style={{ color: c.text }}>{mcp.name}</div>
              <div className="text-[10px]" style={{ color: c.dim, fontFamily: mono }}>{mcp.authType}</div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#4ade80" }} />
              <span className="text-[10px]" style={{ color: "#4ade80" }}>Connected</span>
            </div>
            <button className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]" style={{ backgroundColor: c.chip, border: `1px solid ${c.border}`, color: c.muted }}>
              <Settings size={10} /> Configure
            </button>
          </div>
        ))}
      </div>

      <h4 className="text-[11px] font-semibold uppercase tracking-wider mt-5 mb-2" style={{ color: c.faint }}>MCP Methods (Google Drive example)</h4>
      <div className="rounded-xl p-3 text-[11px]" style={{ backgroundColor: c.codeBg, border: `1px solid ${c.border}`, fontFamily: mono, color: c.muted }}>
        <div style={{ color: c.faint }}>// Available methods:</div>
        <div>list_files(query, pageSize)</div>
        <div>get_file(fileId)</div>
        <div>read_file(fileId)</div>
        <div>create_file(name, content, mimeType?)</div>
        <div>update_file(fileId, content)</div>
        <div>delete_file(fileId)</div>
      </div>
    </div>
  );
}

/* ─── Composer Simulation ─── */
function ComposerSimulation() {
  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h3 className="text-[12px] font-semibold uppercase tracking-wider mb-3" style={{ color: c.faint }}>Composer Simulation</h3>
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: c.panel, border: `1px solid ${c.border}`, maxWidth: "500px" }}>
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#4ade80" }} />
            <span className="text-[10px]" style={{ color: c.dim, fontFamily: mono }}>mode: interactive</span>
            <span className="text-[10px]" style={{ color: c.dim, fontFamily: mono }}>model: claude-fable-5</span>
            <span className="text-[10px]" style={{ color: c.dim, fontFamily: mono }}>effort: Zinc</span>
          </div>
          <div className="rounded-lg p-2 text-[12px]" style={{ backgroundColor: c.input, border: `1px solid ${c.border}`, color: c.text, minHeight: "60px", whiteSpace: "pre-wrap" }}>
            Build a PR automation workflow that reviews code, runs tests, and notifies Slack
          </div>
          <div className="flex items-center gap-2 pt-1" style={{ borderTop: `1px solid ${c.borderSoft}` }}>
            <div className="flex items-center gap-1.5">
              <AtSign size={12} style={{ color: c.dim }} /><span className="text-[10px]" style={{ color: c.dim }}>@mentions</span>
              <Hash size={12} style={{ color: c.dim, marginLeft: 4 }} /><span className="text-[10px]" style={{ color: c.dim }}>#commands</span>
              <Plus size={12} style={{ color: c.dim, marginLeft: 4 }} /><span className="text-[10px]" style={{ color: c.dim }}>+attach</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button className="px-2 py-1 rounded-lg text-[10px]" style={{ backgroundColor: c.chip, border: `1px solid ${c.border}`, color: c.muted }}>Ctrl+J</button>
              <button className="px-3 py-1 rounded-lg text-[10px] font-medium" style={{ backgroundColor: c.accent, color: "#000" }}>Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Dropdowns Simulation ─── */
function DropdownsSimulation() {
  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <h3 className="text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: c.faint }}>Dropdown Components Simulation</h3>

      {/* Mode dropdown */}
      <div>
        <label className="text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: c.faint }}>Mode</label>
        <div className="flex gap-2">
          {modeOptions.map((m) => (
            <button key={m.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]"
              style={{ backgroundColor: m.label === "Interactive" ? c.chipHover : c.chip, border: `1px solid ${c.border}`, color: c.text }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.label === "Interactive" ? c.accent : c.dim }} />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Model dropdown */}
      <div>
        <label className="text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: c.faint }}>Model</label>
        <div className="flex gap-2 flex-wrap">
          {["claude-fable-5", "claude-opus-5", "gpt-5.6-luna", "kimi-k3", "gemini-3.6-flash"].map((m) => (
            <button key={m} className="px-3 py-1.5 rounded-lg text-[11px] font-mono"
              style={{ backgroundColor: m === "claude-fable-5" ? c.chipHover : c.chip, border: `1px solid ${c.border}`, color: c.text }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Effort dropdown */}
      <div>
        <label className="text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: c.faint }}>Effort</label>
        <div className="flex gap-3">
          {effortLevels.map((level) => (
            <button key={level.value} className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px]"
              style={{ backgroundColor: level.value === "thinking" ? c.chipHover : c.chip, border: `1px solid ${c.border}`, color: c.text, minWidth: "120px" }}>
              <div className="flex items-end gap-[2px]" style={{ height: 13 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} style={{ width: 3, height: 2 + n * 2, borderRadius: 999, backgroundColor: n <= level.barLevel ? c.text : c.dim }} />
                ))}
              </div>
              <div className="text-left">
                <div className="font-medium">{level.label}</div>
                <div className="text-[9px]" style={{ color: c.dim }}>×{level.costMultiplier} cost</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Effort Simulation ─── */
function EffortSimulation() {
  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <h3 className="text-[12px] font-semibold uppercase tracking-wider mb-2" style={{ color: c.faint }}>Effort Levels — Zinc & Manguzuime</h3>
      {effortLevels.map((level) => (
        <div key={level.value} className="rounded-xl p-4" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-end gap-[2px]" style={{ height: 16 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} style={{ width: 4, height: 3 + n * 2.5, borderRadius: 999, backgroundColor: n <= level.barLevel ? c.accent : c.dim }} />
              ))}
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-semibold" style={{ color: c.text }}>{level.label}</div>
              <div className="text-[11px]" style={{ color: c.muted }}>{level.desc}</div>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded font-mono" style={{ backgroundColor: "rgba(255,255,255,.06)", color: c.dim }}>×{level.costMultiplier}</span>
            <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: c.chip, color: c.muted }}>{level.subagents} subagents</span>
          </div>
          <p className="text-[11px] mb-3" style={{ color: c.muted }}>{level.detail}</p>
          <div className="flex flex-wrap gap-1.5">
            {level.features.map((f) => (
              <span key={f} className="text-[9px] px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,.05)", color: c.faint, border: `1px solid ${c.borderSoft}` }}>{f}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Chat Simulation ─── */
function ChatSimulation() {
  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h3 className="text-[12px] font-semibold uppercase tracking-wider mb-3" style={{ color: c.faint }}>Chat View Simulation</h3>
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: c.bg, border: `1px solid ${c.border}`, height: "450px", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div className="flex items-center gap-2 px-3 h-9 flex-shrink-0" style={{ borderBottom: `1px solid ${c.border}` }}>
          <span className="text-[10px]" style={{ color: c.dim, fontFamily: mono }}>thread /</span>
          <span className="text-[12px] font-medium truncate" style={{ color: c.text }}>PR Automation Workflow</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1" style={{ backgroundColor: c.chip, color: c.muted, border: `1px solid ${c.borderSoft}`, fontFamily: mono }}><GitBranch size={8} />main</span>
          <div className="ml-auto flex items-center gap-1.5">
            <button className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px]" style={{ backgroundColor: "rgba(255,255,255,.05)", border: `1px solid ${c.border}`, color: c.muted }}><RefreshCw size={9} /> PR</button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {MOCK_TRANSCRIPT.slice(0, 4).map((msg, i) => (
            <div key={i} className={`rounded-xl p-3 text-[12px] leading-relaxed ${msg.type === "user" ? "ml-8" : "mr-4"}`}
              style={{ backgroundColor: msg.type === "user" ? c.chip : c.panel, border: `1px solid ${c.borderSoft}`, color: c.text }}>
              {msg.type === "user" && <div className="text-[10px] mb-1 font-medium" style={{ color: c.accent }}>You</div>}
              {msg.type === "thought" && <div className="flex items-center gap-1.5 mb-1"><Lightbulb size={10} color="#c8b464" /><span className="text-[10px] font-semibold" style={{ color: "#c8b464" }}>Thinking</span></div>}
              {"text" in msg && <div className="whitespace-pre-wrap">{(msg as { text: string }).text}</div>}
              {"out" in msg && <div style={{ fontFamily: mono, fontSize: 10, color: c.faint }}>{(msg as { out: string[] }).out.map((l, j) => <div key={j}>{l}</div>)}</div>}
            </div>
          ))}
          {/* Streaming indicator */}
          <div className="flex items-center gap-2 text-[11px]" style={{ color: c.faint }}>
            <span className="blink" style={{ animation: "pulse 1.2s ease-in-out infinite", color: "#7dd3fc" }}>●</span>
            <span>Zinc mode • streaming</span>
          </div>
        </div>

        {/* Composer */}
        <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: `1px solid ${c.border}` }}>
          <div className="flex items-center gap-2">
            <div className="flex-1 text-[11px] px-3 py-2 rounded-lg" style={{ backgroundColor: c.input, border: `1px solid ${c.border}`, color: c.text }}>
              ... type a message
            </div>
            <button className="px-3 py-2 rounded-lg text-[11px] font-medium" style={{ backgroundColor: c.accent, color: "#000" }}>Send</button>
          </div>
          <div className="mt-2 flex items-center gap-3 text-[9px]" style={{ color: c.dim, fontFamily: mono }}>
            <span>claude-fable-5</span>
            <span>Zinc effort</span>
            <span>interactive</span>
            <span>1.2k/1M</span>
            <span className="ml-auto">send</span>
          </div>
        </div>
      </div>
    </div>
  );
}