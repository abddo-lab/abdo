import { useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  GitMerge,
  ListChecks,
  Plus,
  Search,
  LogOut,
  UserRound,
  Wrench,
  Zap,
} from "lucide-react";
import { c, mono } from "./theme";
import { threads, type ThreadStatus } from "./data";
import { envIcons, useOutsideClose } from "./Dropdowns";
import Logo from "./Logo";
import { GitHubMark, useGitHub } from "./github";
import { useAuth } from "./auth";

const filters = ["All", "Active", "Merged"] as const;
type Filter = (typeof filters)[number];

function statusIcon(status: ThreadStatus) {
  if (status === "merge") return <GitMerge size={12} color={c.muted} className="flex-shrink-0" />;
  if (status === "working")
    return <CircleDot size={12} color={c.accent} className="flex-shrink-0 animate-pulse" />;
  return <CheckCircle2 size={12} color={c.dim} className="flex-shrink-0" />;
}

export default function Sidebar({
  onOpenSession,
  onNewThread,
  activeSession,
  view,
  onView,
}: {
  onOpenSession: (label: string) => void;
  onNewThread: () => void;
  activeSession: string | null;
  view: string;
  onView: (v: "work" | "usage" | "automations" | "tools" | "settings") => void;
}) {
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useOutsideClose(profileOpen, setProfileOpen);
  const gh = useGitHub();
  const auth = useAuth();

  const visible = threads.filter((t) => {
    const byFilter =
      filter === "All" ||
      (filter === "Active" && t.status === "working") ||
      (filter === "Merged" && t.status === "merge");
    return byFilter && t.label.toLowerCase().includes(query.toLowerCase());
  });

  const navItems = [
    { id: "work" as const, icon: ListChecks, label: "My work", kbd: "⌘1" },
    { id: "usage" as const, icon: BarChart3, label: "Usage", kbd: "⌘2" },
    { id: "automations" as const, icon: Zap, label: "Automations", kbd: "⌘3" },
  ];

  return (
    <div
      className="appSidebar w-60 flex-shrink-0 h-full flex flex-col px-2.5 pb-3 overflow-y-auto"
      style={{ backgroundColor: c.sidebar, borderRight: `1px solid ${c.border}` }}
    >
      {/* workspace / profile */}
      <div className="relative mt-3" ref={profileRef}>
        <button
          onClick={() => setProfileOpen((o) => !o)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left"
          style={{ backgroundColor: profileOpen ? c.sidebarHover : "transparent" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.sidebarHover)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = profileOpen ? c.sidebarHover : "transparent")}
        >
          <Logo size={22} />
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-medium truncate" style={{ color: c.sidebarText }}>
              {auth.user?.name ?? "Christina Warren"}
            </span>
            <span className="block text-[10.5px] truncate" style={{ color: c.sidebarMuted }}>
              {gh.connected ? `${gh.account} · connected` : "Personal workspace"}
            </span>
          </span>
          <ChevronDown size={13} color={c.faint} className="flex-shrink-0" style={{ transform: profileOpen ? "rotate(180deg)" : "none", transition: "transform 140ms" }} />
        </button>

        {profileOpen && (
          <div
            className="absolute left-0 right-0 z-50 mt-1.5 rounded-xl overflow-hidden popIn"
            style={{
              backgroundColor: "rgba(16,16,16,.98)",
              backdropFilter: "blur(20px)",
              border: `1px solid ${c.borderStrong}`,
              boxShadow: c.shadowPop,
            }}
          >
            <div className="px-3 py-2" style={{ borderBottom: `1px solid ${c.borderSoft}` }}>
              <div className="text-[12px] font-medium" style={{ color: c.text }}>
                {auth.user?.name ?? "Christina Warren"}
              </div>
              <div className="text-[10.5px]" style={{ color: c.dim }}>
                {auth.user?.email ?? "christina@tailspin.dev"}
              </div>
              <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px]" style={{ backgroundColor: c.chip, color: c.muted }}>
                {auth.user?.plan ?? "Max plan · 20×"}
              </div>
            </div>

            <button
              onClick={() => { gh.connected ? gh.disconnect() : gh.connect(); setProfileOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left transition-colors"
              style={{ color: c.text }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.sidebarHover)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <GitHubMark size={13} color={c.muted} />
              {gh.connected ? "Disconnect GitHub" : "Connect GitHub"}
              {gh.connected && <span className="ml-auto rounded-full" style={{ width: 5, height: 5, backgroundColor: c.accent }} />}
            </button>

            {[
              { icon: UserRound, label: "Account settings", act: () => onView("settings") },
              { icon: Wrench, label: "Tools & agents", act: () => onView("tools") },
              { icon: BarChart3, label: "Usage & billing", act: () => onView("usage") },
            ].map((it) => (
              <button
                key={it.label}
                onClick={() => { it.act(); setProfileOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left transition-colors"
                style={{ color: c.text }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.sidebarHover)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <it.icon size={13} color={c.muted} /> {it.label}
              </button>
            ))}

            <button
              onClick={() => {
                auth.logout();
                setProfileOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left transition-colors"
              style={{ color: c.muted, borderTop: `1px solid ${c.borderSoft}` }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.sidebarHover)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <LogOut size={13} color={c.muted} /> Sign out
            </button>
          </div>
        )}
      </div>

      {/* new thread */}
      <button
        onClick={onNewThread}
        className="mt-2.5 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors"
        style={{ backgroundColor: c.chip, border: `1px solid ${c.border}`, color: c.text }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chipHover)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = c.chip)}
      >
        <Plus size={14} color={c.accent} /> New thread
        <span className="ml-auto text-[10.5px]" style={{ color: c.faint, fontFamily: mono }}>
          ⌘N
        </span>
      </button>

      {/* search */}
      <div
        className="mt-2 flex items-center gap-1.5 px-2 rounded-lg"
        style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}
      >
        <Search size={12} color={c.faint} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search threads"
          className="w-full bg-transparent text-[12.5px] py-1.5 outline-none"
          style={{ color: c.text }}
        />
      </div>

      {/* nav */}
      <div className="flex flex-col gap-0.5 mt-2.5">
        {navItems.map((n) => {
          const on = view === n.id;
          return (
            <button
              key={n.label}
              onClick={() => onView(n.id)}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] text-left transition-colors"
              style={{
                color: on ? c.sidebarText : c.sidebarMuted,
                backgroundColor: on ? c.sidebarActive : "transparent",
              }}
              onMouseEnter={(e) => !on && (e.currentTarget.style.backgroundColor = c.sidebarHover)}
              onMouseLeave={(e) => !on && (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <n.icon size={14} color={on ? c.sidebarText : c.sidebarMuted} /> {n.label}
              <span className="ml-auto text-[10.5px]" style={{ color: c.faint, fontFamily: mono }}>
                {n.kbd}
              </span>
            </button>
          );
        })}
      </div>

      {/* thread filters */}
      <div
        className="mt-4 mb-2 flex items-center gap-0.5 p-0.5 rounded-lg"
        style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}
      >
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="flex-1 py-1 rounded-md text-[11px] font-medium transition-colors"
            style={{
              backgroundColor: filter === f ? c.chipHover : "transparent",
              color: filter === f ? c.text : c.sidebarMuted,
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* threads */}
      <div className="flex flex-col gap-0.5">
        {visible.map((t) => {
          const EnvIcon = envIcons[t.env];
          const active = activeSession === t.label;
          return (
            <button
              key={t.label}
              onClick={() => onOpenSession(t.label)}
              className="group w-full relative flex flex-col gap-0.5 px-2 py-1.5 rounded-md text-left transition-colors"
              style={{
                color: active ? c.sidebarText : c.sidebarMuted,
                backgroundColor: active ? c.sidebarActive : "transparent",
              }}
              onMouseEnter={(e) => !active && (e.currentTarget.style.backgroundColor = c.sidebarHover)}
              onMouseLeave={(e) => !active && (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <span className="flex items-center gap-2 w-full">
                {statusIcon(t.status)}
                <span className="truncate text-[12.5px]">{t.label}</span>
                <span className="ml-auto text-[10px] flex-shrink-0" style={{ color: c.faint }}>
                  {t.time}
                </span>
              </span>
              <span className="flex items-center gap-1.5 pl-5 text-[10px]" style={{ color: c.dim }}>
                <EnvIcon size={9} />
                <span style={{ fontFamily: mono }}>{t.env}</span>
                <span>·</span>
                <span style={{ fontFamily: mono }}>{t.changes} files</span>
              </span>
            </button>
          );
        })}
        {!visible.length && (
          <div className="px-2 py-4 text-[12px]" style={{ color: c.dim }}>
            No threads match.
          </div>
        )}
      </div>

      {/* footer */}
      <div className="mt-auto pt-3" style={{ borderTop: `1px solid ${c.border}` }}>
        <div className="px-2 pb-2">
          <div className="flex items-center justify-between text-[10.5px] mb-1" style={{ color: c.sidebarMuted }}>
            <span>Max plan · weekly</span>
            <span style={{ fontFamily: mono }}>19%</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: c.chip }}>
            <div className="h-full rounded-full" style={{ width: "19%", backgroundColor: c.accent }} />
          </div>
        </div>
        <div className="flex items-center gap-2 px-2 pt-1">
          <span className="truncate text-[11px]" style={{ color: c.sidebarMuted }}>
            christina@tailspin.dev
          </span>
        </div>
      </div>
    </div>
  );
}
