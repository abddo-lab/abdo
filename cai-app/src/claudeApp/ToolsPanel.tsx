import { useState, useEffect } from "react";
import { Bot, Cpu, FolderTree, Globe, GitBranch, Search, Terminal, Wrench, Zap, Trash2, type LucideIcon } from "lucide-react";
import { c, mono } from "./theme";
import { TOOL_DEFINITIONS, type ToolDef, type ToolPermission } from "../services/tools";
import { BUILTIN_AGENTS } from "../services/agents";
import { getSkills, deleteCustomSkill, type Skill } from "../services/skills";
import { getHooks, DEFAULT_HOOKS, type Hook } from "../services/hooks";

const groupIcons: Record<string, LucideIcon> = { Filesystem: FolderTree, Execution: Terminal, Git: GitBranch, Web: Globe, Agents: Bot, Deploy: Zap };

type Tab = "tools" | "agents" | "skills" | "hooks";

export default function ToolsPanel() {
  const [tab, setTab] = useState<Tab>("tools");
  const [tools, setTools] = useState<ToolDef[]>(TOOL_DEFINITIONS);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");

  useEffect(() => { getSkills().then(setSkills); getHooks().then(setHooks); }, []);

  const groups = ["All", ...new Set(tools.map((t) => t.group))];
  const filtered = tools.filter((t) => (group === "All" || t.group === group) && (!query || `${t.name} ${t.desc}`.toLowerCase().includes(query.toLowerCase())));
  const setPerm = (id: string, perm: ToolPermission) => setTools((p) => p.map((t) => t.id === id ? { ...t, permission: perm } : t));

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: "tools", label: "Tools", count: tools.length },
    { id: "agents", label: "Subagents", count: BUILTIN_AGENTS.length },
    { id: "skills", label: "Skills", count: skills.length },
    { id: "hooks", label: "Hooks", count: hooks.length },
  ];

  return (
    <div className="flex-1 h-full overflow-y-auto" style={{ backgroundColor: c.bg }}>
      <div className="mx-auto px-4 sm:px-6 py-6" style={{ maxWidth: 900 }}>
        <h1 className="text-[20px] font-semibold tracking-tight" style={{ color: c.text }}>Tools, Agents & Skills</h1>
        <p className="text-[12px] mb-4" style={{ color: c.muted }}>Everything Caret Agent can call -- tools, subagents, skills, and lifecycle hooks.</p>

        {/* Tabs */}
        <div className="flex gap-0.5 p-0.5 rounded-lg mb-4" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}`, maxWidth: 500 }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11.5px] font-medium"
              style={{ backgroundColor: tab === t.id ? c.chipHover : "transparent", color: tab === t.id ? c.text : c.muted }}>
              {t.label}<span className="px-1 rounded text-[9.5px]" style={{ backgroundColor: tab === t.id ? c.input : "transparent", color: c.faint }}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Tools Tab */}
        {tab === "tools" && <>
          <div className="grid kpiGrid gap-2.5 mb-4">
            {[{ icon: Wrench, label: "Tools", value: `${tools.length}`, sub: "available" },
              { icon: Cpu, label: "Auto-allowed", value: `${tools.filter((t) => t.permission === "allow").length}`, sub: "no approval needed" },
            ].map((k) => <div key={k.label} className="rounded-xl p-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider" style={{ color: c.faint }}><k.icon size={11} /> {k.label}</div>
              <div className="text-[19px] font-semibold mt-1" style={{ color: c.text }}>{k.value}</div><div className="text-[10.5px] mt-0.5" style={{ color: c.dim }}>{k.sub}</div>
            </div>)}
          </div>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex gap-0.5 p-0.5 rounded-lg overflow-x-auto" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}>
              {groups.map((g) => <button key={g} onClick={() => setGroup(g)} className="px-2.5 py-1 rounded-md text-[11.5px] font-medium whitespace-nowrap" style={{ backgroundColor: group === g ? c.chipHover : "transparent", color: group === g ? c.text : c.muted }}>{g}</button>)}
            </div>
            <div className="ml-auto flex items-center gap-1.5 px-2 rounded-lg" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}`, minWidth: 180 }}>
              <Search size={11} color={c.dim} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="w-full bg-transparent outline-none py-1.5 text-[12px]" style={{ color: c.text }} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {filtered.map((t) => {
              const Icon = groupIcons[t.group] ?? Wrench;
              return <div key={t.id} className="rounded-xl p-3 flex items-start gap-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}`, opacity: 1 }}>
                <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.chip, border: `1px solid ${c.border}` }}><Icon size={13} color={c.text} /></span>
                <div className="flex-1 min-w-0">
                  <span className="text-[12.5px] font-medium" style={{ color: c.text, fontFamily: mono }}>{t.name}</span>
                  <p className="text-[11.5px] mt-1" style={{ color: c.muted }}>{t.desc}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}>
                    {(["allow", "ask", "deny"] as const).map((p) => <button key={p} onClick={() => setPerm(t.id, p)} className="px-1.5 py-0.5 rounded text-[9.5px] capitalize" style={{ backgroundColor: t.permission === p ? "rgba(255,255,255,.1)" : "transparent", color: t.permission === p ? c.text : c.dim }}>{p}</button>)}
                  </div>
                </div>
              </div>;
            })}
          </div>
        </>}

        {/* Subagents Tab */}
        {tab === "agents" && (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {BUILTIN_AGENTS.map((a) => (
              <div key={a.id} className="rounded-xl p-3.5" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
                <div className="flex items-start gap-2.5">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.chip, border: `1px solid ${c.border}` }}><Bot size={13} color={c.text} /></span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-semibold" style={{ color: c.text, fontFamily: mono }}>{a.name}</span>
                    <span className="block text-[10.5px] mt-0.5" style={{ color: c.dim }}>{a.role}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2.5">
                  {a.tools.map((t) => <span key={t} className="text-[9.5px] px-1.5 py-0.5 rounded" style={{ backgroundColor: c.chip, color: c.muted, fontFamily: mono }}>{t}</span>)}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${c.borderSoft}` }}>
                  {[["Model", a.model], ["Temp", a.temperature.toString()]].map(([k, v]) => (
                    <div key={k}><span className="block text-[8.5px] uppercase tracking-wider" style={{ color: c.dim }}>{k}</span><span className="block text-[10.5px] mt-0.5" style={{ color: c.text, fontFamily: mono }}>{v}</span></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Skills Tab */}
        {tab === "skills" && (
          <div className="flex flex-col gap-2">
            {skills.map((s) => (
              <div key={s.id} className="rounded-xl p-3 flex items-start gap-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
                <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.chip, border: `1px solid ${c.border}` }}><Zap size={13} color={c.text} /></span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-medium" style={{ color: c.text }}>{s.name}</span>
                    <span className="text-[8px] px-1 py-[1px] rounded" style={{ backgroundColor: "rgba(255,255,255,.07)", color: c.muted }}>{s.category}</span>
                    {s.builtin && <span className="text-[8px] px-1 py-[1px] rounded" style={{ backgroundColor: "rgba(255,255,255,.05)", color: c.dim }}>built-in</span>}
                  </div>
                  <p className="text-[11.5px] mt-1" style={{ color: c.muted }}>{s.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {s.tools.map((t) => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: c.chip, color: c.dim, fontFamily: mono }}>{t}</span>)}
                  </div>
                </div>
                {!s.builtin && <button onClick={() => { deleteCustomSkill(s.id); setSkills((p) => p.filter((x) => x.id !== s.id)); }} className="p-1 rounded" style={{ color: c.faint }}><Trash2 size={12} /></button>}
              </div>
            ))}
          </div>
        )}

        {/* Hooks Tab */}
        {tab === "hooks" && <>
          <p className="text-[11px] mb-3" style={{ color: c.muted }}>Lifecycle hooks run before/after tool execution. Inspired by Claude Code hooks.</p>
          <div className="flex flex-col gap-2">
            {[...DEFAULT_HOOKS, ...hooks].map((h) => (
              <div key={h.id} className="rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: h.enabled ? c.accent : c.dim }} />
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-medium" style={{ color: c.text }}>{h.name}</span>
                  <div className="text-[10px] mt-0.5" style={{ color: c.dim, fontFamily: mono }}>{h.event} · {h.command}</div>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: c.chip, color: c.muted }}>{h.event}</span>
              </div>
            ))}
          </div>
        </>}
      </div>
    </div>
  );
}
