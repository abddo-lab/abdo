import { useEffect, useState } from "react";
import { GitMerge, GitPullRequest, Loader2, ExternalLink } from "lucide-react";
import { c, mono } from "./theme";
import { useGitHub, type GitHubPR } from "./github";

export default function MyWorkPanel({ onOpenThread }: { onOpenThread: (label: string) => void }) {
  const gh = useGitHub();
  const [prs, setPRs] = useState<GitHubPR[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!gh.connected || !gh.selectedRepo) return;
    setLoading(true);
    gh.refreshPRs().then(() => { setPRs(gh.prs); setLoading(false); }).catch(() => setLoading(false));
  }, [gh.connected, gh.selectedRepo]);

  useEffect(() => { setPRs(gh.prs); }, [gh.prs]);

  return (
    <div className="flex-1 h-full overflow-y-auto" style={{ backgroundColor: c.bg }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-end gap-3 mb-4">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight" style={{ color: c.text }}>My Work</h1>
            <p className="text-[12px]" style={{ color: c.muted }}>
              Pull requests and branches in <span style={{ fontFamily: mono, color: c.text }}>{gh.selectedRepo ?? "—"}</span>
            </p>
          </div>
          <button onClick={() => { setLoading(true); gh.refreshPRs().then(() => setLoading(false)); }} className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px]" style={{ backgroundColor: c.chip, border: `1px solid ${c.border}`, color: c.text }}>
            {loading ? <Loader2 size={12} className="animate-spin" /> : "Refresh"}
          </button>
        </div>

        {!gh.connected ? (
          <div className="rounded-xl py-12 text-center" style={{ backgroundColor: c.panel, border: `1px dashed ${c.border}`, color: c.dim }}>
            <GitPullRequest size={20} className="mx-auto mb-2" /><div className="text-[12.5px]">Connect GitHub to see your work</div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin" style={{ color: c.faint }} /></div>
        ) : prs.length === 0 ? (
          <div className="rounded-xl py-12 text-center" style={{ backgroundColor: c.panel, border: `1px dashed ${c.border}`, color: c.dim }}>
            <GitPullRequest size={20} className="mx-auto mb-2" /><div className="text-[12.5px]">No open pull requests</div><div className="text-[11px] mt-1">Create a branch and push changes to see PRs here.</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {prs.map((pr) => (
              <div key={pr.id} className="rounded-xl p-3.5" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
                <div className="flex items-start gap-2.5">
                  {pr.state === "open" ? <GitPullRequest size={14} color={c.muted} className="mt-0.5 flex-shrink-0" /> : <GitMerge size={14} color={c.text} className="mt-0.5 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium truncate" style={{ color: c.text }}>{pr.title}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9.5px]" style={{ backgroundColor: pr.state === "open" ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.14)", color: pr.state === "open" ? "#ededed" : "#ffffff" }}>{pr.state}</span>
                      <span className="text-[10px]" style={{ color: c.dim, fontFamily: mono }}>#{pr.number}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10.5px]" style={{ color: c.dim, fontFamily: mono }}>
                      <span>{pr.head.ref}</span><span>→</span><span>{pr.base.ref}</span>
                      <span>·</span><span style={{ color: c.text }}>+{pr.additions}</span><span>−{pr.deletions}</span>
                      <span>·</span><span>{pr.changed_files} files</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => onOpenThread(`pr-${pr.number}`)} className="px-2.5 py-1 rounded-lg text-[11px]" style={{ backgroundColor: c.chip, border: `1px solid ${c.border}`, color: c.text }}>Open thread</button>
                      <a href={pr.html_url} target="_blank" rel="noopener" className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px]" style={{ color: c.muted }}>
                        <ExternalLink size={10} /> View on GitHub
                      </a>
                    </div>
                  </div>
                  <span className="text-[10px] flex-shrink-0" style={{ color: c.dim }}>{new Date(pr.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
