// src/components/Workflows.tsx — Real workflow management via API + n8n sandbox & templates
import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { Icon } from "../icons";
import { Badge, Btn, IconBtn, Section } from "./ui";
import * as api from "../api";
import { useWorkflows } from "../store";

const defaultTemplates = [
  { id: "wt1", name: "Onboarding sync", description: "New signup → CRM → welcome sequence → Slack ping.", category: "onboarding", icon: "users" },
  { id: "wt2", name: "Support triage", description: "Inbound ticket → classify → route → draft reply.", category: "support", icon: "inbox" },
  { id: "wt3", name: "Release notes", description: "Merged PRs → summarise → publish changelog.", category: "dev", icon: "doc" },
  { id: "wt4", name: "Data refresh", description: "Nightly extract → transform → warehouse load.", category: "data", icon: "layers" },
  { id: "wt5", name: "Lead scoring", description: "Form fill → enrich → score → assign owner.", category: "marketing", icon: "gauge" },
];

const regions = ["eu-west-1", "us-east-1", "ap-south-1"];
const plans = ["Starter", "Team", "Scale"];

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28);

export default function Workflows({ onToast }: { onToast: (m: string) => void }) {
  const { instances, loading, refresh } = useWorkflows();
  const [n8nState, setN8nState] = useState<any>(null);
  const [n8nLoading, setN8nLoading] = useState(false);
  const [showIframe, setShowIframe] = useState(false);
  const [templates, setTemplates] = useState<any[]>(defaultTemplates);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState(defaultTemplates[0].name);
  const [region, setRegion] = useState(regions[0]);
  const [plan, setPlan] = useState(plans[1]);
  const [creating, setCreating] = useState(false);

  const slug = slugify(name);
  const taken = instances.some((i) => i.slug === slug);
  const valid = slug.length >= 3 && !taken;

  const fetchN8nStatus = async () => {
    try {
      const data = await api.n8n.get();
      setN8nState(data.instance || null);
    } catch {}
  };

  const fetchTemplates = async () => {
    try {
      const data = await api.workflowTemplates.list();
      if (data.templates?.length) setTemplates(data.templates);
    } catch {}
  };

  useEffect(() => {
    fetchN8nStatus();
    fetchTemplates();
  }, []);

  const startN8n = async () => {
    setN8nLoading(true);
    try {
      const instance = await api.n8n.start();
      setN8nState(instance);
      onToast("n8n installed & started on sandbox!");
    } catch (err: any) {
      onToast(err.message || "Failed to start n8n");
    } finally {
      setN8nLoading(false);
    }
  };

  const stopN8n = async () => {
    try {
      await api.n8n.stop();
      fetchN8nStatus();
      onToast("n8n instance stopped");
    } catch (err: any) {
      onToast(err.message);
    }
  };

  const injectTemplate = async (templateId: string) => {
    try {
      await api.n8n.injectTemplate(templateId);
      onToast("Workflow template injected successfully!");
      refresh();
    } catch (err: any) {
      onToast(err.message || "Failed to inject template");
    }
  };

  const totals = useMemo(() => ({
    live: instances.filter((i) => i.status === "live" || i.status === "running").length,
    execs: instances.reduce((a, i) => a + (i.executions_total || 0), 0),
    nodes: instances.reduce((a, i) => a + (i.nodes || 0), 0),
  }), [instances]);

  const create = async () => {
    if (!valid) return;
    setCreating(true);
    try {
      await api.workflows.create({ name: name.trim(), slug, template, region, plan });
      onToast(`${slug}.kiren.app is provisioning`);
      setName(""); setOpen(false);
      refresh();
    } catch (err: any) {
      onToast(err.message);
    } finally { setCreating(false); }
  };

  const togglePause = async (id: string, status: string) => {
    try {
      if (status === "paused") await api.workflows.resume(id);
      else await api.workflows.pause(id);
      refresh();
      onToast(status === "paused" ? "Resumed" : "Paused");
    } catch (err: any) { onToast(err.message); }
  };

  const deleteInstance = async (id: string, slug: string) => {
    try {
      await api.workflows.delete(id);
      refresh();
      onToast(`${slug} destroyed`);
    } catch (err: any) { onToast(err.message); }
  };

  const accessUrl = n8nState?.tunnel_url || n8nState?.access_url || "http://localhost:5678";

  return (
    <section className="h-full min-w-0 flex-1 overflow-y-auto bg-[var(--app)]">
      <div className="sticky top-0 z-10 glass border-b border-[var(--border)] px-7 py-4">
        <div className="mx-auto flex max-w-[940px] items-center gap-3">
          <div>
            <h1 className="text-[19px] font-bold tracking-tight text-[var(--text)]">Workflows &amp; n8n Sandbox</h1>
            <p className="pt-0.5 text-[12.5px] text-[var(--muted)]">
              Managed n8n workflows — $0.50/hour billing, fast sandbox install &amp; AI MCP integration.
            </p>
          </div>
          <Btn variant="accent" icon="plus" className="ml-auto" onClick={() => setOpen(true)}>New instance</Btn>
        </div>
      </div>

      <div className="mx-auto max-w-[940px] px-7 py-6 flex flex-col gap-6">
        {/* n8n Sandbox Control Banner */}
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[var(--shadow-sm)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-red-500 text-white font-bold shadow-md">
                n8n
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-bold text-[var(--text)]">n8n Sandbox Instance</p>
                  <Badge tone={n8nState?.status === "running" ? "green" : "muted"} icon={n8nState?.status === "running" ? "checkCircle" : "circle"}>
                    {n8nState?.status === "running" ? "Running" : "Stopped"}
                  </Badge>
                </div>
                <p className="pt-0.5 text-[11.5px] text-[var(--muted)]">
                  Rate: <span className="font-semibold text-[var(--green)]">$0.50 / hour</span> · Total hours: {n8nState?.total_hours || 0}h · Total cost: ${(n8nState?.total_cost || 0).toFixed(2)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {n8nState?.status === "running" ? (
                <>
                  <Btn variant="primary" icon="external" onClick={() => window.open(accessUrl, "_blank")}>
                    Open n8n Web UI
                  </Btn>
                  <Btn variant="ghost" icon="monitor" onClick={() => setShowIframe(!showIframe)}>
                    {showIframe ? "Hide Embedded Canvas" : "Show Canvas"}
                  </Btn>
                  <Btn variant="ghost" icon="stop" onClick={stopN8n}>
                    Stop
                  </Btn>
                </>
              ) : (
                <Btn variant="accent" icon="rocket" onClick={startN8n} disabled={n8nLoading}>
                  {n8nLoading ? "Installing & Starting n8n…" : "Fast Install & Start n8n ($0.50/hr)"}
                </Btn>
              )}
            </div>
          </div>

          {/* Embedded iframe preview */}
          {showIframe && n8nState?.status === "running" && (
            <div className="mt-4 rounded-xl border border-[var(--border)] overflow-hidden h-[540px] bg-white">
              <iframe src={accessUrl} className="w-full h-full border-0" title="n8n Web UI" />
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Live instances", value: String(totals.live), icon: "rocket" as const },
            { label: "Total executions", value: totals.execs.toLocaleString(), icon: "refresh" as const },
            { label: "Managed steps", value: String(totals.nodes), icon: "boxes" as const },
          ].map((s, i) => (
            <div key={s.label} className="a-up flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3.5 shadow-[var(--shadow-sm)]" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Icon name={s.icon} size={16} /></span>
              <div><p className="text-[18px] font-bold leading-tight tracking-tight text-[var(--text)]">{s.value}</p><p className="text-[11px] text-[var(--faint)]">{s.label}</p></div>
            </div>
          ))}
        </div>

        {/* Workflow Templates Section */}
        <div>
          <h3 className="pb-3 text-[13px] font-bold text-[var(--text)] uppercase tracking-wider">Injectable Workflow Templates</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map((t) => (
              <div key={t.id} className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3.5 flex items-start justify-between gap-3 shadow-[var(--shadow-sm)] hover:border-[var(--border-2)] transition">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-bold text-[var(--text)]">{t.name}</p>
                    <Badge tone="blue">{t.category}</Badge>
                  </div>
                  <p className="pt-1 text-[11.5px] leading-snug text-[var(--muted)]">{t.description}</p>
                </div>
                <Btn variant="primary" className="!py-1 !text-[11px] shrink-0" icon="plus" onClick={() => injectTemplate(t.id)}>
                  Inject
                </Btn>
              </div>
            ))}
          </div>
        </div>

        {/* Instances List */}
        <Section title={`Instances · ${instances.length}`}>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-[12px] text-[var(--muted)]"><Icon name="spinner" size={13} className="a-spin" /></div>
          ) : instances.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border-2)] px-3 py-10 text-center">
              <p className="text-[13px] font-semibold text-[var(--muted)]">No workflow instances</p>
              <p className="pt-1 text-[11px] text-[var(--faint)]">Create one to get started with n8n automation.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {instances.map((i, idx) => (
                <div key={i.id} className="a-up flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3.5 shadow-[var(--shadow-sm)] transition hover:border-[var(--border-2)]" style={{ animationDelay: `${idx * 45}ms` }}>
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", i.status === "live" || i.status === "running" ? "grad-accent text-white" : i.status === "provisioning" ? "bg-[var(--blue-soft)] text-[var(--blue)]" : "bg-[var(--panel-3)] text-[var(--faint)]")}>
                    <Icon name={i.status === "provisioning" ? "spinner" : "workflow"} size={15} className={cn(i.status === "provisioning" && "a-spin")} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[13px] font-semibold text-[var(--text)]">{i.name}</p>
                      <Badge tone={i.status === "live" || i.status === "running" ? "green" : i.status === "provisioning" ? "blue" : i.status === "paused" ? "amber" : "muted"}>{i.status}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[10.5px] text-[var(--faint)]">
                      {i.tunnel_url && <span className="flex items-center gap-1 font-mono text-[var(--accent-ink)]"><Icon name="globe" size={10} /> {i.tunnel_url}</span>}
                      <span>· {i.template}</span>
                      <span>· {i.region}</span>
                      <span>· {i.nodes || 0} steps</span>
                    </div>
                  </div>
                  <Badge tone="muted" className="hidden shrink-0 sm:inline-flex">{i.plan}</Badge>
                  <div className="flex shrink-0 items-center gap-1">
                    {i.tunnel_url && <IconBtn icon="external" size={13} title="Open" onClick={() => window.open(i.tunnel_url, "_blank")} />}
                    <IconBtn icon={i.status === "paused" ? "play" : "stop"} size={13} title={i.status === "paused" ? "Resume" : "Pause"} onClick={() => togglePause(i.id, i.status)} />
                    <IconBtn icon="trash" size={13} title="Delete" onClick={() => deleteInstance(i.id, i.slug)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Creator modal */}
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
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Onboarding sync" className="w-full rounded-lg border border-[var(--border-2)] bg-[var(--panel-2)] px-3 py-2 text-[13px] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]" />
              <div className={cn("mt-2 flex items-center gap-2 rounded-lg border px-3 py-2", !slug ? "border-[var(--border)] bg-[var(--panel-2)]" : taken ? "border-[var(--red)]/40 bg-[var(--red-soft)]" : "border-[var(--green)]/40 bg-[var(--green-soft)]")}>
                <Icon name="globe" size={13} className={!slug ? "text-[var(--faint)]" : taken ? "text-[var(--red)]" : "text-[var(--green)]"} />
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--text)]">{slug || "your-project"}<span className="text-[var(--faint)]">.kiren.app</span></span>
                {slug.length >= 3 && <Badge tone={taken ? "red" : "green"} icon={taken ? "alert" : "checkCircle"}>{taken ? "Taken" : "Available"}</Badge>}
              </div>
              <p className="pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--faint)]">Template</p>
              <div className="grid grid-cols-2 gap-2">
                {templates.map((t) => (
                  <button key={t.id} onClick={() => setTemplate(t.name)} className={cn("flex items-start gap-2 rounded-xl border p-2.5 text-left transition", template === t.name ? "border-[var(--accent)] bg-[var(--accent-soft)]/50" : "border-[var(--border)] bg-[var(--panel)] hover:border-[var(--border-2)]")}>
                    <Icon name="workflow" size={14} className={template === t.name ? "text-[var(--accent)]" : "text-[var(--faint)]"} />
                    <span className="min-w-0"><span className="block truncate text-[12px] font-semibold text-[var(--text)]">{t.name}</span><span className="block text-[10.5px] leading-snug text-[var(--faint)]">{t.description}</span></span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-4">
                <div>
                  <p className="pb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--faint)]">Region</p>
                  <div className="flex flex-wrap gap-1.5">
                    {regions.map((r) => (<button key={r} onClick={() => setRegion(r)} className={cn("rounded-full border px-2.5 py-1 font-mono text-[11px] transition", region === r ? "border-transparent bg-[var(--text)] text-[var(--app)]" : "border-[var(--border)] text-[var(--muted)]")}>{r}</button>))}
                  </div>
                </div>
                <div>
                  <p className="pb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--faint)]">Plan</p>
                  <div className="flex flex-wrap gap-1.5">
                    {plans.map((p) => (<button key={p} onClick={() => setPlan(p)} className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium transition", plan === p ? "border-transparent bg-[var(--text)] text-[var(--app)]" : "border-[var(--border)] text-[var(--muted)]")}>{p}</button>))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--panel-2)] px-4 py-3">
              <p className="text-[11px] text-[var(--faint)]">Provisioning takes ~30s · n8n with no auth</p>
              <Btn variant="ghost" className="ml-auto" onClick={() => setOpen(false)}>Cancel</Btn>
              <Btn variant="accent" icon={creating ? "spinner" : "rocket"} disabled={!valid || creating} onClick={create} className={cn(creating && "[&_svg]:a-spin")}>{creating ? "Provisioning…" : "Create instance"}</Btn>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
