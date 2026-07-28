import { useState, useEffect, useRef } from "react";
import { Loader2, Play, Plus, Zap, Trash2, ExternalLink, Bot, Send, Copy, Square, Search, AlertTriangle } from "lucide-react";
import { c, mono } from "./theme";
import { useGitHub } from "./github";
import { createSandbox as createE2bSandbox, runCommand as e2bRunCommand, deleteSandbox as e2bDeleteSandbox } from "../services/e2b";
import { createSandbox as createDaytonaSandbox, runInSandbox as daytonaRunCommand, stopSandbox as daytonaStopSandbox } from "../services/daytona";
import { settingsDB } from "../services/db";
import { chatCompletion, type ChatMessage } from "../services/api";

// ─── Types ───
interface Automation {
  id: string;
  name: string;
  description: string;
  prompt: string;
  cron: string;
  enabled: boolean;
  sandboxType: "e2b" | "daytona";
  sandboxId: string | null;
  deployUrl: string | null;
  lastRun: string | null;
  status: "idle" | "running" | "deployed" | "error";
  error: string | null;
  createdAt: number;
  tags: string[];
}

interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  cron: string;
  prompt: string;
  tags: string[];
}

// ─── Templates ───
const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  { id: "nightly-deploy", name: "Nightly Deploy", description: "Auto-deploy at midnight daily", icon: "deploy", cron: "0 0 * * *", prompt: "Pull latest code, run build, and deploy to production", tags: ["deploy"] },
  { id: "pr-review-bot", name: "PR Review Bot", description: "Review every PR with AI", icon: "review", cron: "*/30 * * * *", prompt: "Check for new PRs, review code with AI, post comments", tags: ["github", "ai"] },
  { id: "db-backup", name: "Database Backup", description: "Backup database every 6 hours", icon: "backup", cron: "0 */6 * * *", prompt: "Connect to database, create backup, upload to S3", tags: ["database"] },
  { id: "health-check", name: "Health Check", description: "Monitor endpoints every 5 minutes", icon: "health", cron: "*/5 * * * *", prompt: "Ping all monitored endpoints, alert on failures", tags: ["monitoring"] },
  { id: "slack-digest", name: "Slack Digest", description: "Daily summary of channel activity", icon: "digest", cron: "0 9 * * *", prompt: "Collect yesterday's Slack messages, summarize with AI, post to #general", tags: ["slack", "ai"] },
  { id: "security-scan", name: "Security Scan", description: "Weekly vulnerability scan", icon: "security", cron: "0 3 * * 1", prompt: "Run npm audit, check for known vulnerabilities, create issues", tags: ["security"] },
  { id: "cache-warm", name: "Cache Warmer", description: "Warm cache every hour", icon: "cache", cron: "0 * * * *", prompt: "Hit critical API endpoints to keep cache warm", tags: ["performance"] },
  { id: "log-rotate", name: "Log Rotation", description: "Clean old logs daily", icon: "logs", cron: "0 2 * * *", prompt: "Delete log files older than 30 days, compress recent ones", tags: ["maintenance"] },
  { id: "ai-triage", name: "AI Issue Triage", description: "Auto-label and prioritize new issues", icon: "triage", cron: "*/15 * * * *", prompt: "Fetch new GitHub issues, classify with AI, add labels and priority", tags: ["github", "ai"] },
  { id: "report-gen", name: "Weekly Report", description: "Generate weekly metrics report", icon: "report", cron: "0 8 * * 1", prompt: "Gather metrics from API, generate markdown report, post to Slack", tags: ["reporting"] },
];

// ─── Cron helpers ───
function describeCron(expr: string): string {
  const parts = expr.split(" ");
  if (parts.length !== 5) return expr;
  const [min, hour, , , dow] = parts;
  if (min.startsWith("*/")) return `Every ${min.slice(2)} minutes`;
  if (hour.startsWith("*/")) return `Every ${hour.slice(2)} hours`;
  if (min === "0" && hour === "0" && dow === "*") return "Daily at midnight";
  if (min === "0" && dow === "*") return `Daily at ${hour}:00`;
  if (dow === "1" && min === "0") return `Weekly on Monday at ${hour}:00`;
  return expr;
}

// ─── DB ───
async function getAutomations(): Promise<Automation[]> {
  return settingsDB.get<Automation[]>("automations", []);
}
async function saveAutomation(a: Automation): Promise<void> {
  const all = await getAutomations();
  const idx = all.findIndex((x) => x.id === a.id);
  if (idx >= 0) all[idx] = a;
  else all.push(a);
  await settingsDB.set("automations", all);
}
async function deleteAutomation(id: string): Promise<void> {
  const all = await getAutomations();
  await settingsDB.set("automations", all.filter((a) => a.id !== id));
}

// ─── Component ───
export default function AutomationsPanel() {
  const gh = useGitHub();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showFromTemplate, setShowFromTemplate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCron, setNewCron] = useState("0 6 * * *");
  const [newPrompt, setNewPrompt] = useState("");
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // AI Assistant
  const [aiMessages, setAiMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { getAutomations().then(setAutomations); }, []);
  useEffect(() => { aiScrollRef.current?.scrollTo({ top: aiScrollRef.current.scrollHeight, behavior: "smooth" }); }, [aiMessages]);

  const create = async () => {
    if (!newName.trim()) return;
    const a: Automation = {
      id: `auto-${Date.now()}`, name: newName.trim(), description: newDesc, prompt: newPrompt,
      cron: newCron, enabled: true, sandboxType: "e2b", sandboxId: null, deployUrl: null,
      lastRun: null, status: "idle", error: null, createdAt: Date.now(), tags: [],
    };
    await saveAutomation(a);
    setAutomations((p) => [...p, a]);
    setShowCreate(false); setNewName(""); setNewDesc(""); setNewPrompt(""); setNewCron("0 6 * * *");
  };

  const createFromTemplate = async (tmpl: AutomationTemplate) => {
    const a: Automation = {
      id: `auto-${Date.now()}`, name: tmpl.name, description: tmpl.description, prompt: tmpl.prompt,
      cron: tmpl.cron, enabled: true, sandboxType: "e2b", sandboxId: null, deployUrl: null,
      lastRun: null, status: "idle", error: null, createdAt: Date.now(), tags: tmpl.tags,
    };
    await saveAutomation(a);
    setAutomations((p) => [...p, a]);
    setShowFromTemplate(false);
  };

  const toggleEnabled = async (id: string) => {
    const a = automations.find((x) => x.id === id);
    if (!a) return;
    a.enabled = !a.enabled;
    await saveAutomation(a);
    setAutomations((p) => p.map((x) => (x.id === id ? { ...a } : x)));
  };

  const runAutomation = async (id: string) => {
    const auto = automations.find((a) => a.id === id);
    if (!auto) return;
    setRunning((s) => new Set(s).add(id));
    setAutomations((p) => p.map((a) => a.id === id ? { ...a, status: "running" as const, error: null } : a));

    try {
      let sandboxId: string;
      let deployUrl: string;

      if (auto.sandboxType === "e2b") {
        const sandbox = await createE2bSandbox(`cai-auto-${id}`);
        sandboxId = sandbox.id;
        deployUrl = `https://${sandboxId}.e2b.dev`;
        await e2bRunCommand(sandboxId, `echo '${auto.prompt}' > /tmp/task.txt && cat /tmp/task.txt`);
      } else {
        const sandbox = await createDaytonaSandbox(`cai-auto-${id}`, gh.selectedRepo ? `https://github.com/${gh.selectedRepo}` : "");
        sandboxId = sandbox.id;
        deployUrl = `https://${sandbox.publicDomain || sandboxId}`;
        await daytonaRunCommand(sandboxId, `echo '${auto.prompt}' > /tmp/task.txt`);
      }

      setAutomations((p) => p.map((a) => a.id === id ? { ...a, sandboxId, deployUrl, status: "deployed" as const, lastRun: new Date().toISOString() } : a));
    } catch (err) {
      setAutomations((p) => p.map((a) => a.id === id ? { ...a, status: "error" as const, error: err instanceof Error ? err.message : String(err) } : a));
    }
    setRunning((s) => { const n = new Set(s); n.delete(id); return n; });
  };

  const stopAutomation = async (id: string) => {
    const auto = automations.find((a) => a.id === id);
    if (!auto) return;
    if (auto.sandboxId) {
      try {
        if (auto.sandboxType === "e2b") await e2bDeleteSandbox(auto.sandboxId);
        else await daytonaStopSandbox(auto.sandboxId);
      } catch {}
    }
    setAutomations((p) => p.map((a) => a.id === id ? { ...a, sandboxId: null, deployUrl: null, status: "idle" as const } : a));
  };

  const removeAutomation = async (id: string) => {
    const auto = automations.find((a) => a.id === id);
    if (auto?.sandboxId) {
      try {
        if (auto.sandboxType === "e2b") await e2bDeleteSandbox(auto.sandboxId);
        else await daytonaStopSandbox(auto.sandboxId);
      } catch {}
    }
    await deleteAutomation(id);
    setAutomations((p) => p.filter((a) => a.id !== id));
    if (selected === id) setSelected(null);
  };

  // AI
  const sendAiMessage = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = aiInput.trim();
    setAiInput("");
    setAiMessages((m) => [...m, { role: "user", content: userMsg }]);
    setAiLoading(true);
    try {
      const messages: ChatMessage[] = [
        { role: "system", content: "You are an automation assistant. Help users create scheduled tasks and background automations. Suggest cron expressions, explain what automations do, and help debug them. Current automations: " + automations.map((a) => `${a.name}(${a.cron})`).join(", ") },
        ...aiMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user", content: userMsg },
      ];
      const resp = await chatCompletion("creator-mini", messages, 0.4);
      setAiMessages((m) => [...m, { role: "assistant", content: resp.choices[0]?.message?.content ?? "No response." }]);
    } catch (err) {
      setAiMessages((m) => [...m, { role: "assistant", content: "Error: " + (err instanceof Error ? err.message : String(err)) }]);
    }
    setAiLoading(false);
  };

  const filtered = automations.filter((a) => !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const sel = automations.find((a) => a.id === selected);

  return (
    <div className="flex-1 h-full flex min-h-0" style={{ backgroundColor: c.bg }}>
      {/* ─── Left: automation list ─── */}
      <div className="w-56 flex-shrink-0 py-5 px-2.5 overflow-y-auto" style={{ borderRight: `1px solid ${c.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: c.faint }}>Automations</div>
          <div className="flex gap-1">
            <button onClick={() => setShowFromTemplate(true)} className="p-1 rounded-lg" style={{ color: c.muted }} title="From template"><Copy size={13} /></button>
            <button onClick={() => setShowCreate(true)} className="p-1 rounded-lg" style={{ color: c.muted }}><Plus size={14} /></button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 rounded-lg mb-2" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}>
          <Search size={11} color={c.dim} />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full bg-transparent text-[11px] py-1.5 outline-none" style={{ color: c.text }} />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-8 text-[11px]" style={{ color: c.dim }}>No automations yet.</div>
        ) : filtered.map((a) => (
          <button key={a.id} onClick={() => setSelected(a.id)} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left mb-0.5"
            style={{ backgroundColor: selected === a.id ? c.sidebarActive : "transparent", color: selected === a.id ? c.text : c.muted }}
            onMouseEnter={(e) => selected !== a.id && (e.currentTarget.style.backgroundColor = c.sidebarHover)}
            onMouseLeave={(e) => selected !== a.id && (e.currentTarget.style.backgroundColor = "transparent")}>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: a.status === "deployed" ? "#4ade80" : a.status === "error" ? "#f87171" : a.enabled ? c.accent : c.dim }} />
            <span className="flex-1 truncate text-[12px]">{a.name}</span>
            <span className="text-[9px]" style={{ color: c.dim, fontFamily: mono }}>{describeCron(a.cron).split(" ")[0]}</span>
          </button>
        ))}
      </div>

      {/* ─── Center: details ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {sel ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${c.border}` }}>
              <Zap size={14} color={sel.enabled ? "#4ade80" : c.dim} />
              <span className="text-[14px] font-medium" style={{ color: c.text }}>{sel.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: c.chip, border: `1px solid ${c.borderSoft}`, color: c.dim, fontFamily: mono }}>{sel.cron}</span>
              <span className="text-[11px]" style={{ color: c.muted }}>{sel.description}</span>
              <div className="ml-auto flex items-center gap-2">
                {sel.status === "deployed" && sel.deployUrl && (
                  <a href={sel.deployUrl} target="_blank" rel="noopener" className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(74,222,128,.08)", color: "#4ade80", fontFamily: mono }}>
                    <ExternalLink size={9} /> Open
                  </a>
                )}
                <button onClick={() => removeAutomation(sel.id)} className="p-1 rounded" style={{ color: c.faint }}><Trash2 size={12} /></button>
              </div>
            </div>

            {/* Status */}
            {sel.status === "running" && (
              <div className="px-4 py-1.5 flex items-center gap-2 flex-shrink-0" style={{ backgroundColor: "rgba(74,222,128,.04)", borderBottom: `1px solid rgba(74,222,128,.12)` }}>
                <Loader2 size={11} className="animate-spin" color="#4ade80" />
                <span className="text-[10px]" style={{ color: "#4ade80" }}>Running...</span>
              </div>
            )}
            {sel.status === "error" && sel.error && (
              <div className="px-4 py-1.5 flex items-center gap-2 flex-shrink-0" style={{ backgroundColor: "rgba(248,113,113,.04)", borderBottom: `1px solid rgba(248,113,113,.12)` }}>
                <AlertTriangle size={11} color="#f87171" />
                <span className="text-[10px]" style={{ color: "#f87171" }}>{sel.error}</span>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 flex min-h-0">
              <div className="flex-1 overflow-auto p-5">
                {/* KPIs */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { label: "Status", value: sel.status, color: sel.status === "deployed" ? "#4ade80" : sel.status === "error" ? "#f87171" : c.dim },
                    { label: "Schedule", value: describeCron(sel.cron), color: c.text },
                    { label: "Sandbox", value: sel.sandboxType === "e2b" ? "E2B" : "Daytona", color: c.text },
                    { label: "Last Run", value: sel.lastRun ? new Date(sel.lastRun).toLocaleString() : "Never", color: c.dim },
                  ].map((kpi) => (
                    <div key={kpi.label} className="rounded-xl p-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
                      <div className="text-[9px] uppercase tracking-wider" style={{ color: c.faint }}>{kpi.label}</div>
                      <div className="text-[12px] font-medium mt-1 truncate" style={{ color: kpi.color }}>{kpi.value}</div>
                    </div>
                  ))}
                </div>

                {/* Prompt */}
                <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
                  <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: c.faint }}>Task</div>
                  <div className="text-[12px] leading-relaxed" style={{ color: c.muted }}>{sel.prompt}</div>
                </div>

                {/* Controls */}
                <div className="flex gap-2">
                  {sel.status === "deployed" ? (
                    <button onClick={() => stopAutomation(sel.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium"
                      style={{ backgroundColor: "rgba(248,113,113,.12)", color: "#f87171", border: `1px solid rgba(248,113,113,.25)` }}>
                      <Square size={11} /> Stop
                    </button>
                  ) : (
                    <button onClick={() => runAutomation(sel.id)} disabled={running.has(sel.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium"
                      style={{ backgroundColor: "rgba(74,222,128,.12)", color: "#4ade80", border: `1px solid rgba(74,222,128,.25)` }}>
                      {running.has(sel.id) ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />} Run now
                    </button>
                  )}
                  <button onClick={() => toggleEnabled(sel.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium"
                    style={{ backgroundColor: sel.enabled ? "rgba(74,222,128,.08)" : c.chip, border: `1px solid ${sel.enabled ? "rgba(74,222,128,.2)" : c.border}`, color: sel.enabled ? "#4ade80" : c.muted }}>
                    {sel.enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
              </div>

              {/* Right: AI Assistant */}
              <div className="w-72 flex-shrink-0 flex flex-col" style={{ borderLeft: `1px solid ${c.border}` }}>
                <div className="px-3 py-2 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: `1px solid ${c.borderSoft}` }}>
                  <Bot size={13} color={c.accent} />
                  <span className="text-[11px] font-medium" style={{ color: c.text }}>Assistant</span>
                </div>
                <div ref={aiScrollRef} className="flex-1 overflow-y-auto p-2.5 space-y-2">
                  {aiMessages.length === 0 && (
                    <div className="text-center py-6">
                      <Bot size={16} className="mx-auto mb-1.5" style={{ color: c.dim }} />
                      <div className="text-[10.5px]" style={{ color: c.muted }}>Ask about scheduling, cron, or automation ideas.</div>
                    </div>
                  )}
                  {aiMessages.map((msg, i) => (
                    <div key={i} className={`rounded-lg p-2 text-[10.5px] leading-relaxed ${msg.role === "user" ? "ml-4" : "mr-4"}`}
                      style={{ backgroundColor: msg.role === "user" ? c.chip : c.panel, border: `1px solid ${c.borderSoft}`, color: c.text }}>
                      {msg.content}
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="rounded-lg p-2 mr-4 text-[10.5px]" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}`, color: c.muted }}>
                      <Loader2 size={9} className="animate-spin inline" /> Thinking...
                    </div>
                  )}
                </div>
                <div className="p-2.5 flex-shrink-0" style={{ borderTop: `1px solid ${c.borderSoft}` }}>
                  <div className="flex gap-1.5">
                    <input value={aiInput} onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendAiMessage()}
                      placeholder="Ask about scheduling..."
                      className="flex-1 px-2.5 py-1.5 rounded-lg text-[10.5px] outline-none"
                      style={{ backgroundColor: c.input, border: `1px solid ${c.border}`, color: c.text }} />
                    <button onClick={sendAiMessage} disabled={aiLoading || !aiInput.trim()}
                      className="p-1.5 rounded-lg" style={{ backgroundColor: aiInput.trim() ? c.accent : c.chip, color: aiInput.trim() ? "#000" : c.dim }}>
                      <Send size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* ─── Empty: Welcome ─── */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <Zap size={28} className="mx-auto mb-3" style={{ color: c.dim }} />
              <div className="text-[16px] font-semibold mb-1" style={{ color: c.text }}>Automations</div>
              <div className="text-[12px] mb-5" style={{ color: c.muted }}>Background tasks running in your sandbox.<br />Cron-scheduled or one-shot.</div>

              <div className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: c.faint }}>Quick start</div>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {AUTOMATION_TEMPLATES.slice(0, 6).map((t) => (
                  <button key={t.id} onClick={() => createFromTemplate(t)}
                    className="rounded-xl p-3 text-left transition-colors"
                    style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = c.borderStrong)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = c.borderSoft)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px]">{t.icon}</span>
                      <span className="text-[11px] font-medium" style={{ color: c.text }}>{t.name}</span>
                    </div>
                    <div className="text-[9.5px] line-clamp-2" style={{ color: c.dim }}>{t.description}</div>
                    <div className="text-[9px] mt-1" style={{ color: c.faint, fontFamily: mono }}>{describeCron(t.cron)}</div>
                  </button>
                ))}
              </div>

              <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium mx-auto"
                style={{ backgroundColor: c.accent, color: "#000" }}>
                <Plus size={13} /> New automation
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Create modal ─── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }} onClick={() => setShowCreate(false)}>
          <div className="popIn rounded-2xl overflow-hidden" style={{ width: 520, backgroundColor: "rgba(12,12,12,0.98)", border: `1px solid ${c.borderStrong}`, boxShadow: c.shadowPop }} onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${c.border}` }}>
              <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: c.faint }}>New automation</div>
              <h2 className="text-[16px] font-semibold mt-0.5" style={{ color: c.text }}>Create a background task</h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div><label className="text-[10px] uppercase mb-1 block" style={{ color: c.faint }}>Name</label><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My automation" className="w-full text-[12px] px-3 py-2 rounded-lg outline-none" style={{ backgroundColor: c.input, border: `1px solid ${c.border}`, color: c.text }} /></div>
              <div><label className="text-[10px] uppercase mb-1 block" style={{ color: c.faint }}>Description</label><input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What does it do?" className="w-full text-[12px] px-3 py-2 rounded-lg outline-none" style={{ backgroundColor: c.input, border: `1px solid ${c.border}`, color: c.text }} /></div>
              <div><label className="text-[10px] uppercase mb-1 block" style={{ color: c.faint }}>Cron expression</label><input value={newCron} onChange={(e) => setNewCron(e.target.value)} className="w-full text-[12px] px-3 py-2 rounded-lg outline-none" style={{ backgroundColor: c.input, border: `1px solid ${c.border}`, color: c.text, fontFamily: mono }} />
                <div className="flex gap-2 mt-1">
                  {[{ label: "Every 5m", v: "*/5 * * * *" }, { label: "Hourly", v: "0 * * * *" }, { label: "Daily 9am", v: "0 9 * * *" }, { label: "Weekly Mon", v: "0 9 * * 1" }].map((p) => (
                    <button key={p.v} onClick={() => setNewCron(p.v)} className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: c.chip, border: `1px solid ${c.borderSoft}`, color: c.muted }}>{p.label}</button>
                  ))}
                </div>
              </div>
              <div><label className="text-[10px] uppercase mb-1 block" style={{ color: c.faint }}>Task prompt</label><textarea value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} rows={3} placeholder="What should this automation do?" className="w-full text-[12px] px-3 py-2 rounded-lg outline-none resize-none" style={{ backgroundColor: c.input, border: `1px solid ${c.border}`, color: c.text }} /></div>
            </div>
            <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: `1px solid ${c.border}`, backgroundColor: "rgba(0,0,0,0.35)" }}>
              <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 rounded-lg text-[12px]" style={{ color: c.muted }}>Cancel</button>
              <button onClick={create} disabled={!newName.trim()} className="px-3 py-1.5 rounded-lg text-[12px] font-medium" style={{ backgroundColor: newName.trim() ? c.accent : c.chip, color: newName.trim() ? "#000" : c.dim }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Template modal ─── */}
      {showFromTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }} onClick={() => setShowFromTemplate(false)}>
          <div className="popIn rounded-2xl overflow-hidden" style={{ width: 600, backgroundColor: "rgba(12,12,12,0.98)", border: `1px solid ${c.borderStrong}`, boxShadow: c.shadowPop }} onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${c.border}` }}>
              <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: c.faint }}>Templates</div>
              <h2 className="text-[16px] font-semibold mt-0.5" style={{ color: c.text }}>Start from a template</h2>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
              {AUTOMATION_TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => createFromTemplate(t)}
                  className="rounded-xl p-3 text-left transition-colors"
                  style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = c.borderStrong)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = c.borderSoft)}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[16px]">{t.icon}</span>
                    <span className="text-[12px] font-medium" style={{ color: c.text }}>{t.name}</span>
                  </div>
                  <div className="text-[10px] mb-1.5" style={{ color: c.dim }}>{t.description}</div>
                  <div className="text-[9px]" style={{ color: c.faint, fontFamily: mono }}>{describeCron(t.cron)}</div>
                </button>
              ))}
            </div>
            <div className="px-5 py-3 flex justify-end" style={{ borderTop: `1px solid ${c.border}`, backgroundColor: "rgba(0,0,0,0.35)" }}>
              <button onClick={() => setShowFromTemplate(false)} className="px-3 py-1.5 rounded-lg text-[12px]" style={{ color: c.muted }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
