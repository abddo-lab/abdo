import { useEffect, useState } from "react";
import { ChevronDown, ListChecks, Plus, Search, LogOut, Wrench, Zap, GitBranch, MessageSquare, Terminal, Code2, Bot, Cpu, Globe, Sparkles, Boxes, BarChart3, UserRound } from "lucide-react";
import { c, mono } from "./theme";
import { threadsDB, type ThreadRecord } from "../services/db";
import { useGitHub } from "./github";
import { useAuth } from "./auth";

export default function Sidebar({ activeSession, view, onView, onNewThread, onOpenSession }: {
  activeSession: string | null; view: string;   onView: (v: "work" | "automations" | "tools" | "settings" | "workflows" | "usage" | "ai-integrations") => void;
  onNewThread: () => void; onOpenSession: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [dbThreads, setDbThreads] = useState<ThreadRecord[]>([]);
  const gh = useGitHub();
  const auth = useAuth();

  useEffect(() => { threadsDB.getAll().then((t) => setDbThreads(t.sort((a, b) => b.updatedAt - a.updatedAt))); }, [view]);

  const visible = dbThreads.filter((t) => t.title.toLowerCase().includes(query.toLowerCase()));
  const navItems = [
    { id: "work" as const, icon: ListChecks, label: "My work", kbd: "⌘1" },
    { id: "automations" as const, icon: Zap, label: "Automations", kbd: "⌘3" },
    { id: "workflows" as const, icon: GitBranch, label: "Workflows", kbd: "⌘W" },
  ];

  const threadIcons = [MessageSquare, Terminal, Code2, Bot, Cpu, Globe, Sparkles, Boxes, Zap, GitBranch];
  const getThreadIcon = (title: string) => {
    let hash = 0;
    for (let i = 0; i < title.length; i++) hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
    return threadIcons[Math.abs(hash) % threadIcons.length];
  };

  return (
    <div className="appSidebar w-60 flex-shrink-0 h-full flex flex-col px-2.5 pb-3 overflow-y-auto" style={{ backgroundColor: c.sidebar, borderRight: `1px solid ${c.border}` }}>
      <div className="relative mt-3">
        <button onClick={() => setProfileOpen((o) => !o)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left" style={{ backgroundColor: profileOpen ? c.sidebarHover : "transparent" }}>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-medium truncate" style={{ color: c.sidebarText }}>{gh.user?.name ?? gh.user?.login ?? "Developer"}</span>
            <span className="block text-[10.5px] truncate" style={{ color: c.sidebarMuted }}>{gh.selectedRepo ?? "No repo"}</span>
          </span>
          <ChevronDown size={13} color={c.faint} style={{ transform: profileOpen ? "rotate(180deg)" : "none", transition: "transform 140ms" }} />
        </button>
        {profileOpen && (
          <div className="absolute left-0 right-0 z-50 mt-1.5 rounded-xl overflow-hidden popIn" style={{ backgroundColor: "rgba(16,16,16,.98)", backdropFilter: "blur(20px)", border: `1px solid ${c.borderStrong}`, boxShadow: c.shadowPop }}>
            <div className="px-3 py-2" style={{ borderBottom: `1px solid ${c.borderSoft}` }}>
              <div className="text-[12px] font-medium" style={{ color: c.text }}>{gh.user?.name ?? gh.user?.login}</div>
              <div className="text-[10.5px]" style={{ color: c.dim }}>{gh.user?.login}@github · ${auth.dailyCost.toFixed(4)} today</div>
            </div>
            {[
              { icon: UserRound, label: "Account settings", act: () => onView("settings") },
              { icon: Wrench, label: "Tools & agents", act: () => onView("tools") },
              { icon: BarChart3, label: "Usage & billing", act: () => onView("usage") },
            ].map((it) => (
              <button key={it.label} onClick={() => { it.act(); setProfileOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left" style={{ color: c.text }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.sidebarHover)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                <it.icon size={13} color={c.muted} /> {it.label}
              </button>
            ))}
            <button onClick={() => { gh.disconnect(); setProfileOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left" style={{ color: c.muted, borderTop: `1px solid ${c.borderSoft}` }}>
              <LogOut size={13} /> Sign out
            </button>
          </div>
        )}
      </div>

      <button onClick={onNewThread} className="mt-2.5 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[13px] font-medium" style={{ backgroundColor: c.chip, border: `1px solid ${c.border}`, color: c.text }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chipHover)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = c.chip)}>
        <Plus size={14} color={c.accent} /> New thread
        <span className="ml-auto text-[10.5px]" style={{ color: c.faint, fontFamily: mono }}>⌘N</span>
      </button>

      <div className="mt-2 flex items-center gap-1.5 px-2 rounded-lg" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}>
        <Search size={12} color={c.faint} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search threads" className="w-full bg-transparent text-[12.5px] py-1.5 outline-none" style={{ color: c.text }} />
      </div>

      <div className="flex flex-col gap-0.5 mt-2.5">
        {navItems.map((n) => {
          const on = view === n.id;
          return <button key={n.label} onClick={() => onView(n.id)} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] text-left" style={{ color: on ? c.sidebarText : c.sidebarMuted, backgroundColor: on ? c.sidebarActive : "transparent" }}
            onMouseEnter={(e) => !on && (e.currentTarget.style.backgroundColor = c.sidebarHover)} onMouseLeave={(e) => !on && (e.currentTarget.style.backgroundColor = "transparent")}>
            <n.icon size={14} color={on ? c.sidebarText : c.sidebarMuted} /> {n.label}
            <span className="ml-auto text-[10.5px]" style={{ color: c.faint, fontFamily: mono }}>{n.kbd}</span>
          </button>;
        })}
      </div>

      <div className="mt-4 mb-2 text-[10px] font-semibold uppercase tracking-wider px-2" style={{ color: c.faint }}>Threads</div>
      <div className="flex flex-col gap-0.5">
        {visible.map((t) => {
          const active = activeSession === t.id;
          const ThreadIcon = getThreadIcon(t.title);
          return <button key={t.id} onClick={() => onOpenSession(t.id)} className="group w-full flex flex-col gap-0.5 px-2 py-1.5 rounded-md text-left" style={{ color: active ? c.sidebarText : c.sidebarMuted, backgroundColor: active ? c.sidebarActive : "transparent" }}
            onMouseEnter={(e) => !active && (e.currentTarget.style.backgroundColor = c.sidebarHover)} onMouseLeave={(e) => !active && (e.currentTarget.style.backgroundColor = "transparent")}>
            <span className="flex items-center gap-2 w-full">
              <ThreadIcon size={12} color={active ? c.accent : c.faint} className="flex-shrink-0" />
              <span className="truncate text-[12.5px]">{t.title}</span>
            </span>
            <span className="flex items-center gap-1.5 text-[10px] pl-[20px]" style={{ color: c.dim }}><span style={{ fontFamily: mono }}>{t.repo}</span><span>·</span><span style={{ fontFamily: mono }}>{t.model}</span></span>
          </button>;
        })}
        {visible.length === 0 && <div className="px-2 py-4 text-[12px]" style={{ color: c.dim }}>No threads yet.</div>}
      </div>

      <div className="mt-auto pt-3" style={{ borderTop: `1px solid ${c.border}` }}>
        <div className="px-2 pb-2">
          <div className="flex items-center justify-between text-[10.5px] mb-1" style={{ color: c.sidebarMuted }}>
            <span>Daily budget</span><span style={{ fontFamily: mono }}>${auth.dailyCost.toFixed(2)} / ${auth.dailyLimit}</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: c.chip }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (auth.dailyCost / auth.dailyLimit) * 100)}%`, backgroundColor: auth.budgetExceeded ? "#ff6b6b" : c.accent }} />
          </div>
        </div>
      </div>
    </div>
  );
}
