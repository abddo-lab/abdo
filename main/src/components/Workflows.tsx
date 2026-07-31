import { useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { Icon } from "../icons";
import { plans, regions, seedInstances, takenSlugs, workflowTemplates, type WorkflowInstance } from "../data";
import { Badge, Btn, IconBtn, Section, Spark } from "./ui";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28);

export default function Workflows({ onToast }: { onToast: (m: string) => void }) {
  const [items, setItems] = useState<WorkflowInstance[]>(seedInstances);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState(workflowTemplates[0].name);
  const [region, setRegion] = useState(regions[0]);
  const [plan, setPlan] = useState(plans[1]);
  const [creating, setCreating] = useState(false);

  const slug = slugify(name);
  const taken = takenSlugs.includes(slug) || items.some((i) => i.slug === slug);
  const valid = slug.length >= 3 && !taken;

  const totals = useMemo(
    () => ({
      live: items.filter((i) => i.status === "live").length,
      execs: items.reduce((a, i) => a + i.execs.reduce((x, y) => x + y, 0), 0),
      nodes: items.reduce((a, i) => a + i.nodes, 0),
    }),
    [items],
  );

  const create = () => {
    if (!valid) return;
    setCreating(true);
    const inst: WorkflowInstance = {
      id: `wf${Date.now()}`,
      name: name.trim(),
      slug,
      template,
      region,
      plan,
      status: "provisioning",
      nodes: workflowTemplates.find((t) => t.name === template)?.nodes ?? 1,
      execs: [0, 0, 0, 0, 0, 0, 0],
      created: "just now",
      offered: true,
    };
    setItems((p) => [inst, ...p]);
    setTimeout(() => {
      setItems((p) => p.map((i) => (i.id === inst.id ? { ...i, status: "live" } : i)));
      setCreating(false);
      setOpen(false);
      setName("");
      onToast(`${inst.slug}.kiren.app is live`);
    }, 1600);
  };

  return (
    <section className="h-full min-w-0 flex-1 overflow-y-auto bg-[var(--app)]">
      <div className="sticky top-0 z-10 glass border-b border-[var(--border)] px-7 py-4">
        <div className="mx-auto flex max-w-[940px] items-center gap-3">
          <div>
            <h1 className="text-[19px] font-bold tracking-tight text-[var(--text)]">Workflows</h1>
            <p className="pt-0.5 text-[12.5px] text-[var(--muted)]">
              Managed instances — no canvas, no editor. Name it, pick a template, get a domain.
            </p>
          </div>
          <Btn variant="accent" icon="plus" className="ml-auto" onClick={() => setOpen(true)}>
            New instance
          </Btn>
        </div>
      </div>

      <div className="mx-auto max-w-[940px] px-7 py-6">
        <div className="grid grid-cols-3 gap-3 pb-7">
          {[
            { label: "Live instances", value: String(totals.live), icon: "rocket" as const },
            { label: "Executions (7d)", value: totals.execs.toLocaleString(), icon: "refresh" as const },
            { label: "Managed steps", value: String(totals.nodes), icon: "boxes" as const },
          ].map((s, i) => (
            <div key={s.label} className="a-up flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3.5 shadow-[var(--shadow-sm)]" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                <Icon name={s.icon} size={16} />
              </span>
              <div>
                <p className="text-[18px] font-bold leading-tight tracking-tight text-[var(--text)]">{s.value}</p>
                <p className="text-[11px] text-[var(--faint)]">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <Section title={`Instances · ${items.length}`}>
          <div className="flex flex-col gap-2.5">
            {items.map((i, idx) => (
              <div key={i.id} className="a-up flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3.5 shadow-[var(--shadow-sm)] transition hover:border-[var(--border-2)]" style={{ animationDelay: `${idx * 45}ms` }}>
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", i.status === "live" ? "grad-accent text-white" : i.status === "provisioning" ? "bg-[var(--blue-soft)] text-[var(--blue)]" : "bg-[var(--panel-3)] text-[var(--faint)]")}>
                  <Icon name={i.status === "provisioning" ? "spinner" : "workflow"} size={15} className={cn(i.status === "provisioning" && "a-spin")} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[13px] font-semibold text-[var(--text)]">{i.name}</p>
                    <Badge tone={i.status === "live" ? "green" : i.status === "provisioning" ? "blue" : "muted"}>
                      {i.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[10.5px] text-[var(--faint)]">
                    <span className="flex items-center gap-1 font-mono text-[var(--accent-ink)]">
                      <Icon name="globe" size={10} /> {i.slug}.kiren.app
                    </span>
                    <span>· {i.template}</span>
                    <span>· {i.region}</span>
                    <span>· {i.nodes} steps</span>
                  </div>
                </div>
                <div className="hidden w-24 shrink-0 md:block">
                  <Spark data={i.execs} tone={i.status === "live" ? "accent" : "muted"} />
                </div>
                <Badge tone="muted" className="hidden shrink-0 sm:inline-flex">{i.plan}</Badge>
                <Badge tone={i.offered ? "green" : "amber"} icon={i.offered ? "checkCircle" : "alert"} className="shrink-0">
                  {i.offered ? "Offered" : "Not offered"}
                </Badge>
                <div className="flex shrink-0 items-center gap-1">
                  <IconBtn icon="external" size={13} title="Open" onClick={() => onToast(`Opening ${i.slug}.kiren.app`)} />
                  <IconBtn
                    icon={i.status === "paused" ? "play" : "stop"}
                    size={13}
                    title={i.status === "paused" ? "Resume" : "Pause"}
                    onClick={() => {
                      setItems((p) => p.map((x) => (x.id === i.id ? { ...x, status: x.status === "paused" ? "live" : "paused", offered: x.status === "paused" } : x)));
                      onToast(i.status === "paused" ? `${i.slug} resumed` : `${i.slug} paused`);
                    }}
                  />
                  <IconBtn icon="trash" size={13} title="Delete" onClick={() => { setItems((p) => p.filter((x) => x.id !== i.id)); onToast(`${i.slug} destroyed`); }} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* creator */}
      {open && (
        <div className="a-in fixed inset-0 z-50 flex items-center justify-center bg-[#12101a]/35 p-4 backdrop-blur-[3px]" onMouseDown={() => !creating && setOpen(false)}>
          <div className="a-pop w-[min(560px,94vw)] overflow-hidden rounded-2xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-lg)]" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
              <Icon name="workflow" size={15} className="text-[var(--accent)]" />
              <p className="text-[13.5px] font-bold text-[var(--text)]">Create instance</p>
              <IconBtn icon="close" size={13} className="ml-auto" onClick={() => setOpen(false)} />
            </div>

            <div className="max-h-[62vh] overflow-y-auto px-4 py-4">
              <label className="block pb-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--faint)]">Project name</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Onboarding sync"
                className="w-full rounded-lg border border-[var(--border-2)] bg-[var(--panel-2)] px-3 py-2 text-[13px] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
              />

              <div className={cn("mt-2 flex items-center gap-2 rounded-lg border px-3 py-2", !slug ? "border-[var(--border)] bg-[var(--panel-2)]" : taken ? "border-[var(--red)]/40 bg-[var(--red-soft)]" : "border-[var(--green)]/40 bg-[var(--green-soft)]")}>
                <Icon name="globe" size={13} className={!slug ? "text-[var(--faint)]" : taken ? "text-[var(--red)]" : "text-[var(--green)]"} />
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--text)]">
                  {slug || "your-project"}<span className="text-[var(--faint)]">.kiren.app</span>
                </span>
                {slug.length >= 3 ? (
                  <Badge tone={taken ? "red" : "green"} icon={taken ? "alert" : "checkCircle"}>
                    {taken ? "Not offered" : "Offered"}
                  </Badge>
                ) : (
                  <span className="text-[10.5px] text-[var(--faint)]">min 3 chars</span>
                )}
              </div>

              <p className="pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--faint)]">Template</p>
              <div className="grid grid-cols-2 gap-2">
                {workflowTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplate(t.name)}
                    className={cn(
                      "flex items-start gap-2 rounded-xl border p-2.5 text-left transition",
                      template === t.name ? "border-[var(--accent)] bg-[var(--accent-soft)]/50" : "border-[var(--border)] bg-[var(--panel)] hover:border-[var(--border-2)]",
                    )}
                  >
                    <Icon name={t.icon} size={14} className={template === t.name ? "text-[var(--accent)]" : "text-[var(--faint)]"} />
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-semibold text-[var(--text)]">{t.name}</span>
                      <span className="block text-[10.5px] leading-snug text-[var(--faint)]">{t.desc}</span>
                      <span className="block pt-1 text-[10px] font-medium text-[var(--muted)]">{t.nodes} steps</span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4">
                <div>
                  <p className="pb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--faint)]">Region</p>
                  <div className="flex flex-wrap gap-1.5">
                    {regions.map((r) => (
                      <button key={r} onClick={() => setRegion(r)} className={cn("rounded-full border px-2.5 py-1 font-mono text-[11px] transition", region === r ? "border-transparent bg-[var(--text)] text-[var(--app)]" : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-2)]")}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="pb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--faint)]">Plan</p>
                  <div className="flex flex-wrap gap-1.5">
                    {plans.map((p) => (
                      <button key={p} onClick={() => setPlan(p)} className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium transition", plan === p ? "border-transparent bg-[var(--text)] text-[var(--app)]" : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-2)]")}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--panel-2)] px-4 py-3">
              <p className="text-[11px] text-[var(--faint)]">Provisioning takes ~30s · no editor, fully managed</p>
              <Btn variant="ghost" className="ml-auto" onClick={() => setOpen(false)}>Cancel</Btn>
              <Btn variant="accent" icon={creating ? "spinner" : "rocket"} disabled={!valid || creating} onClick={create} className={cn(creating && "[&_svg]:a-spin")}>
                {creating ? "Provisioning…" : "Create instance"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
