import { useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { Icon } from "../icons";
import { activity, backgroundAgents, lanes, metrics, type Project, type WorkItem } from "../data";
import { Avatar, Badge, Btn, IconBtn, Progress, RichText, Section, Spark, Spinner } from "./ui";

interface Props {
  items: WorkItem[];
  projects: Project[];
  onOpen: (threadId?: string, projectId?: string) => void;
  onNewThread: () => void;
  onToast: (m: string) => void;
  onMerge: (id: string) => void;
}

export default function MyWork({ items, projects, onOpen, onNewThread, onToast, onMerge }: Props) {
  const [proj, setProj] = useState("All projects");
  const [layout, setLayout] = useState<"board" | "list">("board");
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        const p = projects.find((x) => x.id === i.projectId);
        return (proj === "All projects" || p?.name === proj) && (i.title + i.branch).toLowerCase().includes(q.toLowerCase());
      }),
    [items, projects, proj, q],
  );

  const Card = ({ w }: { w: WorkItem }) => {
    const p = projects.find((x) => x.id === w.projectId);
    return (
      <div
        onClick={() => onOpen(w.threadId, w.projectId)}
        className="group a-up cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 shadow-[var(--shadow-sm)] transition duration-200 hover:-translate-y-[2px] hover:border-[var(--border-2)] hover:shadow-[var(--shadow-md)]"
      >
        <div className="flex items-start gap-2">
          <span className="mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
              <Icon
                name={w.lane === "running" ? "spinner" : w.lane === "merged" ? "checkCircle" : w.agent === "background" ? "agentBadge" : "pr"}
                size={11}
                strokeWidth={2}
                className={cn(w.lane === "running" && "a-spin")}
              />
          </span>
          <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-[var(--text)]">{w.title}</p>
          <Icon name="chevRight" size={13} className="mt-1 shrink-0 text-[var(--faint)] opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
        </div>

        <div className="flex items-center gap-1.5 pt-2 text-[10.5px] text-[var(--faint)]">
          <Icon name="boxes" size={10} />
          <span className="truncate">{p?.name}</span>
          <span>·</span>
          <span className="truncate font-mono">{w.branch}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-2.5">
          {(w.add > 0 || w.del > 0) && (
            <span className="flex items-center gap-1 font-mono text-[10.5px] font-semibold">
              <span className="text-[var(--green)]">+{w.add}</span>
              <span className="text-[var(--red)]">−{w.del}</span>
            </span>
          )}
          {w.checks && (
            <Badge tone={w.checks.fail ? "red" : "green"} icon={w.checks.fail ? "alert" : "checkCircle"}>
              {w.checks.fail ? `${w.checks.fail} failing` : `${w.checks.pass} checks`}
            </Badge>
          )}
          <Badge tone="muted">{w.agent}</Badge>
          <span className="ml-auto text-[10.5px] text-[var(--faint)]">{w.time}</span>
        </div>

        {w.progress !== undefined && (
          <div className="pt-2.5">
            <Progress value={w.progress} tone="blue" />
          </div>
        )}

        {w.lane === "review" && (
          <div className="mt-2.5 flex items-center gap-2 border-t border-[var(--border)] pt-2.5">
            <span className="flex -space-x-1.5">{(w.reviewers ?? []).map((r) => <Avatar key={r} initials={r} size={20} />)}</span>
            <span className="ml-auto flex gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Btn variant="ghost" className="!px-2 !py-1 !text-[11px]" onClick={() => onOpen(w.threadId, w.projectId)}>Review</Btn>
              <Btn variant="accent" className="!px-2 !py-1 !text-[11px]" onClick={() => { onMerge(w.id); onToast(`Merged ${w.branch}`); }}>
                Merge
              </Btn>
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
            <h1 className="text-[19px] font-bold tracking-tight text-[var(--text)]">
              Good afternoon, <span className="grad-text">Suaib</span>
            </h1>
            <p className="pt-0.5 text-[12.5px] text-[var(--muted)]">
              {items.filter((i) => i.lane === "review").length} waiting on you · {items.filter((i) => i.lane === "running").length} running · {backgroundAgents.filter((b) => b.status === "running").length} background
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--ring)]">
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
            <button
              key={r}
              onClick={() => setProj(r)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition",
                proj === r ? "border-transparent bg-[var(--text)] text-[var(--app)]" : "border-[var(--border)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--border-2)] hover:text-[var(--text)]",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1080px] px-7 py-6">
        <div className="grid grid-cols-2 gap-3 pb-7 lg:grid-cols-4">
          {metrics.map((m, i) => (
            <div key={m.id} className="a-up rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3.5 shadow-[var(--shadow-sm)] transition hover:border-[var(--border-2)] hover:shadow-[var(--shadow-md)]" style={{ animationDelay: `${i * 60}ms` }}>
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--faint)]">{m.label}</p>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-[21px] font-bold tracking-tight text-[var(--text)]">{m.value}</span>
                <span className={cn("text-[11px] font-semibold", m.label === "Review time" ? "text-[var(--green)]" : "text-[var(--accent)]")}>{m.delta}</span>
              </div>
              <div className="pt-1"><Spark data={m.spark} tone={m.label === "Review time" ? "green" : "accent"} /></div>
            </div>
          ))}
        </div>

        {layout === "board" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {lanes.map((lane) => {
              const list = filtered.filter((i) => i.lane === lane.id);
              return (
                <div key={lane.id} className="flex min-w-0 flex-col">
                  <div className="flex items-center gap-2 pb-2.5">
                    <Icon
                      name={lane.icon}
                      size={13}
                      className={cn(
                        lane.id === "review" && "text-[var(--accent)]",
                        lane.id === "running" && "a-spin text-[var(--blue)]",
                        lane.id === "merged" && "text-[var(--green)]",
                        lane.id === "queued" && "text-[var(--faint)]",
                      )}
                    />
                    <h3 className="text-[12px] font-semibold text-[var(--text)]">{lane.label}</h3>
                    <span className="rounded-full bg-[var(--panel-3)] px-1.5 text-[10px] font-semibold text-[var(--muted)]">{list.length}</span>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {list.map((w) => <Card key={w.id} w={w} />)}
                    {list.length === 0 && (
                      <div className="rounded-xl border border-dashed border-[var(--border-2)] px-3 py-6 text-center text-[11.5px] text-[var(--faint)]">Nothing here</div>
                    )}
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
                  <span className="shrink-0 font-mono text-[11px] font-semibold text-[var(--green)]">+{w.add}</span>
                  <span className="shrink-0 font-mono text-[11px] font-semibold text-[var(--red)]">−{w.del}</span>
                  <span className="w-16 shrink-0 text-right text-[10.5px] text-[var(--faint)]">{w.time}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 pt-8 lg:grid-cols-[1.4fr_1fr]">
          <Section title="Recent activity">
            <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]">
              {activity.map((a, i) => (
                <div key={a.id} className={cn("flex items-start gap-2.5 px-3.5 py-2.5", i > 0 && "border-t border-[var(--border)]")}>
                  <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Icon name={a.icon} size={11} strokeWidth={1.9} />
                  </span>
                  <RichText text={a.text} className="min-w-0 flex-1 text-[12px] leading-relaxed text-[var(--muted)]" />
                  <span className="shrink-0 text-[10.5px] text-[var(--faint)]">{a.time}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Environment">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
              <div className="flex items-center gap-2 pb-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Icon name="cloud" size={16} /></span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-[var(--text)]">Cloud sandbox</p>
                  <p className="text-[10.5px] text-[var(--faint)]">ubuntu-24.04 · 8 vCPU · 16 GB</p>
                </div>
                <Badge tone="green" icon="dot" className="ml-auto">Ready</Badge>
              </div>
              {[
                { icon: "cpu" as const, label: "Node 22.11 · pnpm 9.12" },
                { icon: "shield" as const, label: "Network: allowlist (12 hosts)" },
                { icon: "folder" as const, label: `${projects.length} projects cloned` },
              ].map((r) => (
                <div key={r.label} className="flex items-center gap-2 border-t border-[var(--border)] py-2 text-[11.5px] text-[var(--muted)]">
                  <Icon name={r.icon} size={12} className="text-[var(--faint)]" />
                  {r.label}
                </div>
              ))}
              <div className="flex items-center gap-2 pt-2.5">
                <Btn variant="ghost" icon="refresh" className="flex-1" onClick={() => onToast("Rebuilding sandbox…")}>Rebuild</Btn>
                <Btn variant="soft" icon="terminal" className="flex-1" onClick={() => onToast("Attached to sandbox shell")}>Shell</Btn>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--panel-2)] px-2.5 py-2 text-[11px] text-[var(--muted)]">
                <Spinner size={12} /> Warming caches
              </div>
            </div>
          </Section>
        </div>
      </div>
    </section>
  );
}
