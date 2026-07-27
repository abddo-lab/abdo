import { ArrowLeft, ArrowRight, Loader2, PanelLeft, PanelRight, Plus, Search } from "lucide-react";
import type { ReactNode } from "react";
import { c, mono } from "./theme";
import Logo from "./Logo";
import { GitHubMark, useGitHub } from "./github";

function IconBtn({
  children,
  onClick,
  danger,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-md transition-colors"
      style={{ color: c.muted }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = danger ? "#3a1414" : c.chipHover;
        e.currentTarget.style.color = danger ? "#ff9a9a" : c.text;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
        e.currentTarget.style.color = c.muted;
      }}
    >
      {children}
    </button>
  );
}

export default function TitleBar({
  onToggleSidebar,
  onTogglePanel,
  onNewThread,
  env,
}: {
  onToggleSidebar: () => void;
  onTogglePanel: () => void;
  onNewThread: () => void;
  env: string;
}) {
  const gh = useGitHub();
  return (
    <div
      className="flex items-center justify-between px-3 h-11 flex-shrink-0 select-none"
      style={{ backgroundColor: c.bgSubtle, borderBottom: `1px solid ${c.border}` }}
    >
      <div className="flex items-center gap-1">
        <span className="mr-1.5 flex items-center">
          <Logo size={22} />
        </span>
        <IconBtn onClick={onToggleSidebar} title="Toggle sidebar">
          <PanelLeft size={15} />
        </IconBtn>
        <IconBtn title="Search">
          <Search size={14} />
        </IconBtn>
        <span className="titleNavBtns flex items-center gap-1">
          <span style={{ width: 1, height: 16, backgroundColor: c.border }} className="mx-1" />
          <IconBtn>
            <ArrowLeft size={14} />
          </IconBtn>
          <IconBtn>
            <ArrowRight size={14} />
          </IconBtn>
        </span>
        <span style={{ width: 1, height: 16, backgroundColor: c.border }} className="mx-1" />
        <button
          onClick={onNewThread}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors"
          style={{ color: c.muted }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chipHover)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <Plus size={13} /> New thread
        </button>
      </div>

      <div className="flex items-center gap-2 text-[11px]" style={{ color: c.faint }}>
        <span className="font-medium tracking-tight" style={{ color: c.muted }}>
          Caret Agent
        </span>
        <span
          className="titleEnvChip px-1.5 py-0.5 rounded"
          style={{ backgroundColor: c.chip, border: `1px solid ${c.borderSoft}`, fontFamily: mono }}
        >
          {env}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={gh.connected ? undefined : gh.connect}
          disabled={gh.connecting}
          title={gh.connected ? `Connected as ${gh.account}` : "Connect GitHub"}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10.5px] font-medium transition-colors"
          style={{
            backgroundColor: gh.connected ? "transparent" : c.chip,
            border: `1px solid ${gh.connected ? c.borderSoft : c.border}`,
            color: gh.connected ? c.muted : c.text,
            cursor: gh.connected ? "default" : "pointer",
          }}
        >
          {gh.connecting ? <Loader2 size={11} className="animate-spin" /> : <GitHubMark size={12} />}
          <span className="titleEnvChip">
            {gh.connecting ? "Connecting…" : gh.connected ? gh.account : "Connect GitHub"}
          </span>
          {gh.connected && (
            <span className="rounded-full" style={{ width: 5, height: 5, backgroundColor: c.accent, boxShadow: `0 0 6px ${c.accentSoft}` }} />
          )}
        </button>
        <IconBtn onClick={onTogglePanel} title="Toggle workspace panel">
          <PanelRight size={15} />
        </IconBtn>
      </div>
    </div>
  );
}
