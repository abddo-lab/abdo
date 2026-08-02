// src/components/AutomationsView.tsx — Real automations via API
import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { Icon } from "../icons";
import { Badge, Btn, IconBtn, Section } from "./ui";
import * as api from "../api";
import { useAutomations, useModels } from "../store";

const triggers = ["Manual", "Daily · 02:00", "Weekdays · 09:00", "On merge to main", "On failing CI"];

export default function AutomationsView({ onToast }: { onToast: (m: string) => void }) {
  const { automations, loading, refresh } = useAutomations();
  const { models } = useModels();
  const modelIds = models.map((m: any) => m.id);
  const [wizard, setWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState<any | null>(null);
  const [runEvents, setRunEvents] = useState<any[]>([]);
  const [runFinished, setRunFinished] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState({
    name: "", goal: "", trigger: triggers[0], project_id: "", prompt: "", model_id: "",
  });

  useEffect(() => {
    if (!draft.model_id && modelIds.length > 0) setDraft({ ...draft, model_id: modelIds[0] });
  }, [modelIds]);

  const canNext = step === 0 ? draft.name.trim().length > 2 && draft.goal.trim().length > 2 : draft.prompt.trim().length > 10;

  const create = async () => {
    try {
      await api.automations.create({
        name: draft.name, goal: draft.goal, trigger_config: draft.trigger,
        project_id: draft.project_id || "none", prompt: draft.prompt, model_id: draft.model_id,
      });
      setWizard(false); setStep(0);
      refresh();
      onToast(`${draft.name} created`);
      setDraft({ ...draft, name: "", goal: "", prompt: "" });
    } catch (err: any) { onToast(err.message); }
  };

  const runAutomation = async (auto: any) => {
    setRunning(auto);
    setRunEvents([]);
    setRunFinished(false);
    try {
      const { thread_id } = await api.automations.run(auto.id);
      // Poll the real thread until the agent finishes
      const started = Date.now();
      for (;;) {
        await new Promise(r => setTimeout(r, 2500));
        const t = await api.threads.get(thread_id);
        setRunEvents([{ tool: "Agent", target: `thread ${t.status}`, done: false }]);
        if (t.status !== "running" && t.status !== "queued") break;
        if (Date.now() - started > 300_000) break;
      }
      setRunFinished(true);
      refresh();
      onToast(`${auto.name} finished`);
    } catch (err: any) {
      onToast(err.message);
      setRunning(null);
    }
  };

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [runEvents]);

  // Running view
  if (running) {
    return (
      <section className="flex h-full min-w-0 flex-1 flex-col bg-[var(--app)]">
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-[var(--border)] px-4">
          <IconBtn icon="arrowLeft" size={15} onClick={() => { setRunning(null); setRunEvents([]); }} title="Back" />
          <span className="grad-accent flex h-7 w-7 items-center justify-center rounded-lg text-white"><Icon name="zap" size={14} fill /></span>
          <div className="min-w-0"><p className="truncate text-[13px] font-semibold leading-tight text-[var(--text)]">{running.name}</p><p className="truncate text-[10.5px] leading-tight text-[var(--faint)]">{running.model_id} · {running.trigger_config}</p></div>
          <div className="ml-auto"><Badge tone={runFinished ? "green" : "blue"} icon={runFinished ? "checkCircle" : "spinner"}>{runFinished ? "Completed" : "Running"}</Badge></div>
        </div>
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <div className="mx-auto flex max-w-[680px] flex-col gap-3">
            <div className="a-up rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3.5">
              <p className="pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]">System prompt</p>
              <p className="text-[12.5px] leading-relaxed text-[var(--text)]">{running.prompt}</p>
            </div>
            {runEvents.map((e, i) => (
              <div key={i} className="a-up overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]">
                <div className="flex items-center gap-2.5 px-3 py-2">
                  <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", e.done ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--blue-soft)] text-[var(--blue)]")}>
                    <Icon name={e.done ? "check" : "spinner"} size={12} className={cn(!e.done && "a-spin")} />
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold text-[var(--text)]">{e.tool}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--muted)]">{e.target}</span>
                </div>
              </div>
            ))}
            {runFinished && (
              <div className="a-up rounded-xl border border-[var(--accent)]/25 bg-gradient-to-br from-[var(--accent-soft)] to-transparent p-4">
                <div className="flex items-center gap-2 pb-2"><Icon name="sparkle" size={14} className="text-[var(--accent)]" fill /><p className="text-[13px] font-bold text-[var(--text)]">Automation complete</p></div>
                <p className="text-[12px] text-[var(--muted)]">Results saved. Thread created for review.</p>
                <div className="flex gap-2 pt-3">
                  <Btn variant="accent" icon="eye" onClick={() => onToast("Opening thread")}>View Thread</Btn>
                  <Btn variant="ghost" icon="refresh" onClick={() => runAutomation(running)}>Run Again</Btn>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  const STEPS = ["Setup", "Prompt & model", "Review"];

  return (
    <section className="h-full min-w-0 flex-1 overflow-y-auto bg-[var(--app)]">
      <div className="sticky top-0 z-10 glass border-b border-[var(--border)] px-7 py-4">
        <div className="mx-auto flex max-w-[880px] items-center gap-3">
          <div>
            <h1 className="text-[19px] font-bold tracking-tight text-[var(--text)]">Automations</h1>
            <p className="pt-0.5 text-[12.5px] text-[var(--muted)]">Build an automation, approve it, and watch the agent work end to end.</p>
          </div>
          <Btn variant="accent" icon="plus" className="ml-auto" onClick={() => { setWizard(true); setStep(0); }}>New automation</Btn>
        </div>
      </div>

      <div className="mx-auto max-w-[880px] px-7 py-6">
        <div className="grid grid-cols-3 gap-3 pb-7">
          {[
            { label: "Automations", value: String(automations.length), icon: "boxes" as const },
            { label: "Total runs", value: String(automations.reduce((a, s) => a + (s.runs || 0), 0)), icon: "refresh" as const },
            { label: "Active", value: String(automations.filter((s) => s.status === "running").length), icon: "zap" as const },
          ].map((s, i) => (
            <div key={s.label} className="a-up flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3.5 shadow-[var(--shadow-sm)]" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Icon name={s.icon} size={16} /></span>
              <div><p className="text-[18px] font-bold leading-tight tracking-tight text-[var(--text)]">{s.value}</p><p className="text-[11px] text-[var(--faint)]">{s.label}</p></div>
            </div>
          ))}
        </div>

        <Section title="Your automations">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-[12px] text-[var(--muted)]"><Icon name="spinner" size={13} className="a-spin" /></div>
          ) : automations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border-2)] px-3 py-10 text-center">
              <p className="text-[13px] font-semibold text-[var(--muted)]">No automations</p>
              <p className="pt-1 text-[11px] text-[var(--faint)]">Create one to start automating your workflow.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {automations.map((s, i) => (
                <div key={s.id} className="a-up flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3.5 shadow-[var(--shadow-sm)] transition hover:border-[var(--border-2)]" style={{ animationDelay: `${i * 45}ms` }}>
                  <span className="grad-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"><Icon name="zap" size={15} fill /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[var(--text)]">{s.name}</p>
                    <p className="truncate text-[11.5px] text-[var(--muted)]">{s.goal}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[10.5px] text-[var(--faint)]">
                      <span className="flex items-center gap-1"><Icon name="clock" size={10} /> {s.trigger_config}</span>
                      <span className="flex items-center gap-1 font-mono"><Icon name="cpu" size={10} /> {s.model_id}</span>
                      <span>· {s.runs || 0} runs</span>
                    </div>
                  </div>
                  <Btn variant="accent" icon="play" className="!py-1 !text-[11px]" onClick={() => runAutomation(s)}>Run</Btn>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Wizard */}
      {wizard && (
        <div className="a-in fixed inset-0 z-50 flex items-center justify-center bg-[#12101a]/35 p-4 backdrop-blur-[3px]" onMouseDown={() => setWizard(false)}>
          <div className="a-pop w-[min(600px,94vw)] overflow-hidden rounded-2xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-lg)]" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
              <Icon name="zap" size={15} className="text-[var(--accent)]" />
              <p className="text-[13.5px] font-bold text-[var(--text)]">New automation</p>
              <IconBtn icon="close" size={13} className="ml-auto" onClick={() => setWizard(false)} />
            </div>
            <div className="flex items-center gap-1.5 border-b border-[var(--border)] bg-[var(--panel-2)] px-4 py-2.5">
              {STEPS.map((s, i) => (
                <div key={s} className="flex flex-1 items-center gap-1.5">
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition", i <= step ? "grad-accent text-white" : "bg-[var(--panel-3)] text-[var(--faint)]")}>{i < step ? "✓" : i + 1}</span>
                  <span className={cn("text-[11.5px] font-medium", i === step ? "text-[var(--text)]" : "text-[var(--faint)]")}>{s}</span>
                  {i < STEPS.length - 1 && <span className={cn("ml-1 h-px flex-1", i < step ? "bg-[var(--accent)]" : "bg-[var(--border-2)]")} />}
                </div>
              ))}
            </div>
            <div className="max-h-[58vh] overflow-y-auto px-4 py-4">
              {step === 0 && (
                <div className="a-in flex flex-col gap-3.5">
                  <div><label className="block pb-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--faint)]">Name</label><input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nightly flake sweep" className="w-full rounded-lg border border-[var(--border-2)] bg-[var(--panel-2)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]" /></div>
                  <div><label className="block pb-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--faint)]">Goal</label><input value={draft.goal} onChange={(e) => setDraft({ ...draft, goal: e.target.value })} placeholder="Find and fix flaky tests" className="w-full rounded-lg border border-[var(--border-2)] bg-[var(--panel-2)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]" /></div>
                  <div><p className="pb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--faint)]">Trigger</p><div className="flex flex-wrap gap-1.5">{triggers.map((t) => (<button key={t} onClick={() => setDraft({ ...draft, trigger: t })} className={cn("rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition", draft.trigger === t ? "border-transparent bg-[var(--text)] text-[var(--app)]" : "border-[var(--border)] text-[var(--muted)]")}>{t}</button>))}</div></div>
                </div>
              )}
              {step === 1 && (
                <div className="a-in flex flex-col gap-3.5">
                  <div><label className="block pb-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--faint)]">Prompt</label><textarea autoFocus rows={6} value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} placeholder="Describe exactly what the agent should do." className="w-full resize-none rounded-lg border border-[var(--border-2)] bg-[var(--panel-2)] px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-[var(--accent)]" /><p className="pt-1 text-[10.5px] text-[var(--faint)]">{draft.prompt.length} characters</p></div>
                  <div><p className="pb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--faint)]">Model</p><div className="grid grid-cols-2 gap-2">{modelIds.map((m) => (<button key={m} onClick={() => setDraft({ ...draft, model_id: m })} className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition", draft.model_id === m ? "border-[var(--accent)] bg-[var(--accent-soft)]/50" : "border-[var(--border)]")}>  <Icon name="cpu" size={13} className={draft.model_id === m ? "text-[var(--accent)]" : "text-[var(--faint)]"} /><span className="font-mono text-[11.5px] font-medium text-[var(--text)]">{m}</span></button>))}</div></div>
                </div>
              )}
              {step === 2 && (
                <div className="a-in flex flex-col gap-2.5">
                  {[["Name", draft.name], ["Goal", draft.goal], ["Trigger", draft.trigger], ["Model", draft.model_id]].map(([k, v]) => (
                    <div key={k} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2"><span className="w-20 shrink-0 text-[10.5px] uppercase tracking-[0.06em] text-[var(--faint)]">{k}</span><span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--text)]">{v}</span></div>
                  ))}
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2"><p className="pb-1 text-[10.5px] uppercase tracking-[0.06em] text-[var(--faint)]">Prompt</p><p className="text-[12.5px] leading-relaxed text-[var(--text)]">{draft.prompt}</p></div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--panel-2)] px-4 py-3">
              {step > 0 && <Btn variant="ghost" icon="arrowLeft" onClick={() => setStep(step - 1)}>Back</Btn>}
              <span className="ml-auto flex gap-2"><Btn variant="ghost" onClick={() => setWizard(false)}>Cancel</Btn>{step < 2 ? <Btn variant="accent" icon="chevRight" disabled={!canNext} onClick={() => setStep(step + 1)}>Continue</Btn> : <Btn variant="accent" icon="check" onClick={create}>Create &amp; run</Btn>}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
