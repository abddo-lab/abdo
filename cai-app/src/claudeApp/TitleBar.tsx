import { ArrowLeft, ArrowRight, PanelLeft, Plus, Search, ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { c, mono } from "./theme";
import Logo from "./Logo";
import { useGitHub, GitHubMark } from "./github";

function IconBtn({ children, onClick, title }: { children: ReactNode; onClick?: () => void; title?: string }) {
  return <button onClick={onClick} title={title} className="p-1.5 rounded-md transition-colors" style={{ color: c.muted }}
    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = c.chipHover; e.currentTarget.style.color = c.text; }}
    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = c.muted; }}>{children}</button>;
}

export default function TitleBar({ onToggleSidebar, onNewThread }: { onToggleSidebar: () => void; onNewThread: () => void; }) {
  const gh = useGitHub();
  const [repoOpen, setRepoOpen] = useState(false);

  return (
    <div className="flex items-center justify-between px-3 h-11 flex-shrink-0 select-none" style={{ backgroundColor: c.bgSubtle, borderBottom: `1px solid ${c.border}` }}>
      <div className="flex items-center gap-1">
        <span className="mr-1.5 flex items-center"><Logo size={22} /></span>
        <IconBtn onClick={onToggleSidebar} title="Toggle sidebar"><PanelLeft size={15} /></IconBtn>
        <IconBtn title="Search"><Search size={14} /></IconBtn>
        <span style={{ width: 1, height: 16, backgroundColor: c.border }} className="mx-1" />
        <IconBtn><ArrowLeft size={14} /></IconBtn>
        <IconBtn><ArrowRight size={14} /></IconBtn>
        <span style={{ width: 1, height: 16, backgroundColor: c.border }} className="mx-1" />
        <button onClick={onNewThread} className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium" style={{ color: c.muted }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chipHover)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
          <Plus size={13} /> New thread
        </button>
      </div>

      <div className="flex items-center gap-2 text-[11px]" style={{ color: c.faint }}>
        <span className="font-medium tracking-tight" style={{ color: c.muted }}>Caret Agent</span>
        <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: c.chip, border: `1px solid ${c.borderSoft}`, fontFamily: mono }}>cloud</span>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Repo selector */}
        <div className="relative">
          <button onClick={() => setRepoOpen((o) => !o)} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10.5px] font-medium" style={{ backgroundColor: c.chip, border: `1px solid ${c.border}`, color: c.text }}>
            <GitHubMark size={11} />
            <span style={{ fontFamily: mono }}>{gh.selectedRepo ?? "select repo"}</span>
            <ChevronDown size={10} />
          </button>
          {repoOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 rounded-xl overflow-hidden popIn" style={{ width: 300, maxHeight: 300, overflowY: "auto", backgroundColor: "rgba(14,14,14,.98)", backdropFilter: "blur(20px)", border: `1px solid ${c.borderStrong}`, boxShadow: c.shadowPop }}>
              <div className="px-3 py-1.5 text-[10px] uppercase" style={{ color: c.faint, borderBottom: `1px solid ${c.borderSoft}` }}>Select repository</div>
              {gh.repos.map((r) => (
                <button key={r.full_name} onClick={() => { gh.selectRepo(r.full_name); setRepoOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px]" style={{ color: gh.selectedRepo === r.full_name ? c.text : c.muted, backgroundColor: gh.selectedRepo === r.full_name ? c.chip : "transparent" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chipHover)} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = gh.selectedRepo === r.full_name ? c.chip : "transparent")}>
                  <span className="flex-1 truncate" style={{ fontFamily: mono }}>{r.full_name}</span>
                  <span className="text-[10px]" style={{ color: c.dim }}>{r.default_branch}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Branch selector */}
        {gh.branches.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: c.chip, color: c.muted, fontFamily: mono }}>
            {gh.selectedBranch ?? "main"}
          </span>
        )}
      </div>
    </div>
  );
}
