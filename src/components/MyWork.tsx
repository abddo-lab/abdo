// src/components/MyWork.tsx — Real work items from API
import { useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { Icon } from "../icons";
import type { Project, WorkItem } from "../data";
import { Badge, Btn, IconBtn } from "./ui";
import * as api from "../api";

interface Props {
  items: WorkItem[];
  projects: Project[];
  sandbox?: any;
  onOpen: (threadId?: string, projectId?: string) => void;
  onNewThread: () => void;
  onToast: (m: string) => void;
  onMerge: (id: string) => void;
}

const lanes = [
  { id: "review", label: "Ready for review", icon: "eye" as const },
  { id: "running", label: "In progress", icon: "spinner" as const },
  { id: "queued", label: "Queued", icon: "clock" as const },
  { id: "merged", label: "Shipped", icon: "checkCircle" as const },
] as const;

export default function MyWork({ items, projects, sandbox, onOpen, onNewThread, onMerge, onToast }: Props) {
  const [proj, setProj] = useState("All projects");
  const [layout, setLayout] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");
  const [connect, setConnect] = useState<{ kind: "ssh" | "desktop"; info: any } | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connectTo = async (kind: "ssh" | "desktop") => {
    if (!sandbox?.id) { onToast("No sandbox yet"); return; }
    setConnecting(true);
    try {
      const info = await api.sandboxes.connect(sandbox.id, kind);
      setConnect({ kind, info });
    } catch (err: any) { onToast(err.message); }
    setConnecting(false);
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    onToast("Copied");
  };

  const filtered = useMemo(() =>
    items.filter((i) => {
      const p = projects.find((x) => x.id === i.projectId);
      return (proj === "All projects" || p?.name === proj) && (i.title + i.branch).toLowerCase().includes(q.toLowerCase());
    }), [items, projects, proj, q]);

  const Card = ({ w }: { w: WorkItem }) => {
    const p = projects.find((x) => x.id === w.projectId);
    return (
      <div onClick={() => onOpen(w.threadId, w.projectId)} className="group a-up cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 shadow-[var(--shadow-sm)] transition duration-200 hover:-translate-y-[2px] hover:border-[var(--border-2)] hover:shadow-[var(--shadow-md)]">
        <div className="flex items-start gap-2">
          <span className="mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
            <Icon name={w.lane === "running" ? "spinner" : w.lane === "merged" ? "checkCircle" : "pr"} size={11} strokeWidth={2} className={cn(w.lane === "running" && "a-spin")} />
          </span>
          <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-[var(--text)]">{w.title}</p>
          <Icon name="chevRight" size={13} className="mt-1 shrink-0 text-[var(--faint)] opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
        </div>
        <div className="flex items-center gap-1.5 pt-2 text-[10.5px] text-[var(--faint)]">
          <Icon name="boxes" size={10} /><span className="truncate">{p?.name}</span><span>·</span><span className="truncate font-mono">{w.branch}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-2.5">
          {(w.add > 0 || w.del > 0) && (<span className="flex items-center gap-1 font-mono text-[10.5px] font-semibold"><span className="text-[var(--green)]">+{w.add}</span><span className="text-[var(--red)]">−{w.del}</span></span>)}
          <Badge tone="muted">{w.agent}</Badge>
          <span className="ml-auto text-[10.5px] text-[var(--faint)]">{w.time}</span>
        </div>
        {w.lane === "review" && (
          <div className="mt-2.5 flex items-center gap-2 border-t border-[var(--border)] pt-2.5">
            <span className="ml-auto flex gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Btn variant="ghost" className="!px-2 !py-1 !text-[11px]" onClick={() => onOpen(w.threadId, w.projectId)}>Review</Btn>
              <Btn variant="accent" className="!px-2 !py-1 !text-[11px]" onClick={() => { onMerge(w.id); }}>Merge</Btn>
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="h-full min-w-0 flex-1 overflow-y-auto bg-[var(--app)]">
      <div className="sticky top-0 z-10 glass border-b border-[var(--border)] px-7 py-4">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[19px] font-bold tracking-tight text-[var(--text)]">My Work</h1>
            <p className="pt-0.5 text-[12.5px] text-[var(--muted)]">
              {items.filter((i) => i.lane === "review").length} waiting on you · {items.filter((i) => i.lane === "running").length} running
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 focus-within:border-[var(--accent)]">
              <Icon name="search" size={13} className="text-[var(--faint)]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search work…" className="w-[130px] bg-transparent text-[12px] outline-none placeholder:text-[var(--faint)]" />
            </div>
            <div className="flex rounded-lg border border-[var(--border)] bg-[var(--panel)] p-0.5">
              <IconBtn icon="grid" size={13} active={layout === "board"} onClick={() => setLayout("board")} title="Board" />
              <IconBtn icon="list" size={13} active={layout === "list"} onClick={() => setLayout("list")} title="List" />
            </div>
            <Btn variant="accent" icon="plus" onClick={onNewThread}>New Thread</Btn>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center gap-1.5 pt-3">
          {["All projects", ...projects.map((p) => p.name)].map((r) => (
            <button key={r} onClick={() => setProj(r)} className={cn("rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition", proj === r ? "border-transparent bg-[var(--text)] text-[var(--app)]" : "border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--border-2)]")}>{r}</button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1080px] px-7 py-6">
        {/* User sandbox — auto-created at plan purchase, all threads run here */}
        <div className="a-up mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3.5 shadow-[var(--shadow-sm)]">
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", sandbox?.status === "running" ? "bg-[var(--green)]/12 text-[var(--green)]" : "bg-[var(--panel-3)] text-[var(--faint)]")}>
            <Icon name={sandbox?.status === "running" ? "boxes" : "spinner"} size={16} className={cn(sandbox?.status === "running" ? "" : "a-spin")} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-bold text-[var(--text)]">Your sandbox</p>
              <Badge tone={sandbox?.status === "running" ? "green" : "muted"} icon={sandbox?.status === "running" ? "dot" : "circle"}>
                {sandbox?.status === "running" ? "Running" : "Provisioning"}
              </Badge>
            </div>
            <p className="pt-0.5 font-mono text-[11px] text-[var(--muted)]">
              {sandbox?.daytona_sandbox_id || sandbox?.id || "kiren-sandbox"} · Linux · non-root user
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Btn variant="ghost" icon="terminal" className="!py-1 !text-[11px]" disabled={connecting} onClick={() => connectTo("ssh")}>
              SSH
            </Btn>
            <Btn variant="ghost" icon="monitor" className="!py-1 !text-[11px]" disabled={connecting} onClick={() => connectTo("desktop")}>
              Desktop
            </Btn>
          </div>
        </div>

        {/* Connect modal — real SSH credentials / noVNC desktop stream */}
        {connect && (
          <div className="a-in fixed inset-0 z-50 flex items-center justify-center bg-[#12101a]/35 p-4 backdrop-blur-[3px]" onMouseDown={() => setConnect(null)}>
            <div className="a-pop w-[min(560px,94vw)] overflow-hidden rounded-2xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-lg)]" onMouseDown={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
                <Icon name={connect.kind === "ssh" ? "terminal" : "monitor"} size={15} className="text-[var(--accent)]" />
                <p className="text-[13.5px] font-bold text-[var(--text)]">
                  {connect.kind === "ssh" ? "SSH into your sandbox" : "Desktop stream"}
                </p>
                <IconBtn icon="close" size={13} className="ml-auto" onClick={() => setConnect(null)} />
              </div>
              <div className="max-h-[60vh] overflow-y-auto px-4 py-4">
                {connect.kind === "ssh" ? (
                  <div className="flex flex-col gap-3">
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-3 font-mono text-[12px] leading-relaxed text-[var(--text)]">
                      {connect.info.command}
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2">
                      <span className="text-[11.5px] text-[var(--muted)]">Password</span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[12px] font-bold text-[var(--text)]">{connect.info.password}</span>
                        <IconBtn icon="copy" size={12} onClick={() => copy(connect.info.password)} title="Copy" />
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2">
                      <span className="text-[11.5px] text-[var(--muted)]">Host · port · user</span>
                      <span className="font-mono text-[12px] font-bold text-[var(--text)]">{connect.info.host}:{connect.info.port} · {connect.info.user}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[var(--faint)]">
                      Login as a non-root user. Root access is disabled inside the sandbox.
                    </p>
                    {connect.info.public_url && (
                      <>
                        <a href={connect.info.public_url} target="_blank" rel="noreferrer"
                          className="flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-[var(--accent-2)]">
                          <Icon name="globe" size={13} /> Open web terminal (anywhere)
                        </a>
                        <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2">
                          <span className="text-[11.5px] text-[var(--muted)]">Public URL</span>
                          <span className="flex items-center gap-2">
                            <span className="max-w-[280px] truncate font-mono text-[11px] text-[var(--text)]">{connect.info.public_url}</span>
                            <IconBtn icon="copy" size={12} onClick={() => copy(connect.info.public_url)} title="Copy" />
                          </span>
                        </div>
                      </>
                    )}
                    <Btn variant="accent" icon="copy" onClick={() => copy(`${connect.info.command}\nPassword: ${connect.info.password}`)}>
                      Copy SSH command
                    </Btn>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {connect.info.public_url_vnc ? (
                      <a href={connect.info.public_url_vnc} target="_blank" rel="noreferrer"
                        className="flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-[var(--accent-2)]">
                        <Icon name="globe" size={13} /> Open desktop stream (anywhere)
                      </a>
                    ) : (
                      <a href={connect.info.url} target="_blank" rel="noreferrer"
                        className="flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-[var(--accent-2)]">
                        <Icon name="monitor" size={13} /> Open desktop stream
                      </a>
                    )}
                    <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2">
                      <span className="text-[11.5px] text-[var(--muted)]">Stream URL</span>
                      <span className="flex items-center gap-2">
                        <span className="max-w-[260px] truncate font-mono text-[11px] text-[var(--text)]">{connect.info.public_url_vnc || connect.info.url}</span>
                        <IconBtn icon="copy" size={12} onClick={() => copy(connect.info.public_url_vnc || connect.info.url)} title="Copy" />
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[var(--faint)]">
                      Streams the Linux desktop in your browser from anywhere via a Cloudflare quick tunnel.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--panel-3)]"><Icon name="inbox" size={24} className="text-[var(--faint)]" /></span>
            <p className="text-[14px] font-bold text-[var(--text)]">No work items</p>
            <p className="max-w-[300px] text-[12px] text-[var(--muted)]">Start a new thread to see your work here.</p>
            <Btn variant="accent" icon="plus" onClick={onNewThread}>New Thread</Btn>
          </div>
        ) : layout === "board" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {lanes.map((lane) => {
              const list = filtered.filter((i) => i.lane === lane.id);
              return (
                <div key={lane.id} className="flex min-w-0 flex-col">
                  <div className="flex items-center gap-2 pb-2.5">
                    <Icon name={lane.icon} size={13} className={cn(lane.id === "review" && "text-[var(--accent)]", lane.id === "running" && "a-spin text-[var(--blue)]", lane.id === "merged" && "text-[var(--green)]", lane.id === "queued" && "text-[var(--faint)]")} />
                    <h3 className="text-[12px] font-semibold text-[var(--text)]">{lane.label}</h3>
                    <span className="rounded-full bg-[var(--panel-3)] px-1.5 text-[10px] font-semibold text-[var(--muted)]">{list.length}</span>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {list.map((w) => <Card key={w.id} w={w} />)}
                    {list.length === 0 && <div className="rounded-xl border border-dashed border-[var(--border-2)] px-3 py-6 text-center text-[11.5px] text-[var(--faint)]">Nothing here</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            {filtered.map((w, i) => {
              const p = projects.find((x) => x.id === w.projectId);
              return (
                <button key={w.id} onClick={() => onOpen(w.threadId, w.projectId)} className={cn("flex w-full items-center gap-3 bg-[var(--panel)] px-3.5 py-2.5 text-left transition hover:bg-[var(--panel-2)]", i > 0 && "border-t border-[var(--border)]")}>
                  <Icon name={w.lane === "running" ? "spinner" : w.lane === "merged" ? "checkCircle" : "pr"} size={13} className={cn(w.lane === "running" ? "a-spin text-[var(--blue)]" : w.lane === "merged" ? "text-[var(--green)]" : "text-[var(--accent)]")} />
                  <span className="w-52 shrink-0 truncate text-[12.5px] font-semibold text-[var(--text)]">{w.title}</span>
                  <span className="hidden w-28 shrink-0 truncate text-[11px] text-[var(--muted)] sm:block">{p?.name}</span>
                  <span className="hidden min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--faint)] sm:block">{w.branch}</span>
                  <span className="w-16 shrink-0 text-right text-[10.5px] text-[var(--faint)]">{w.time}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
