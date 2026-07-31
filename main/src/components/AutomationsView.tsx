import { useEffect, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { Icon } from "../icons";
import { modelIds, projects, seedSimulations, simSteps, triggers, type Simulation } from "../data";
import { Badge, Btn, IconBtn, Section, Spinner } from "./ui";

interface Props {
  onToast: (m: string) => void;
}

interface RunEvent {
  id: number;
  tool: string;
  target: string;
  meta?: string;
  out?: string[];
  icon: (typeof simSteps)[number]["icon"];
  done: boolean;
}

/* -------------------------------- run chat -------------------------------- */

function SimulationRun({ sim, onExit, onToast }: { sim: Simulation; onExit: () => void; onToast: (m: string) => void }) {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [finished, setFinished] = useState(false);
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    simSteps.forEach((s, i) => {
      const start = window.setTimeout(() => {
        setEvents((p) => [...p, { id: i, tool: s.tool, target: s.target, meta: s.meta, out: s.out, icon: s.icon, done: false }]);
      }, i * 1200);
      const end = window.setTimeout(() => {
        setEvents((p) => p.map((e) => (e.id === i ? { ...e, done: true } : e)));
        if (i === simSteps.length - 1) {
          setFinished(true);
          onToast(`${sim.name} finished`);
        }
      }, i * 1200 + 900);
      timers.current.push(start, end);
    });
    return () => timers.current.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.id]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [events.length, notes.length, finished]);

  const project = projects.find((p) => p.id === sim.projectId);

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-[var(--app)]">
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-[var(--border)] px-4">
        <IconBtn icon="arrowLeft" size={15} onClick={onExit} title="Back to automations" />
        <span className="grad-accent flex h-7 w-7 items-center justify-center rounded-lg text-white">
          <Icon name="zap" size={14} fill />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight text-[var(--text)]">{sim.name}</p>
          <p className="truncate text-[10.5px] leading-tight text-[var(--faint)]">
            simulation · {sim.modelId} · {project?.name ?? "workspace"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Badge tone={finished ? "green" : "blue"} icon={finished ? "checkCircle" : "spinner"}>
            {finished ? "Completed" : "Running"}
          </Badge>
          <Btn variant="ghost" icon="doc" className="!py-1 !text-[11px]" onClick={() => onToast("Run log exported")}>Log</Btn>
        </div>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex max-w-[680px] flex-col gap-3">
          <div className="a-up rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3.5">
            <p className="pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]">System prompt</p>
            <p className="text-[12.5px] leading-relaxed text-[var(--text)]">{sim.prompt}</p>
            <div className="flex flex-wrap gap-1.5 pt-2.5">
              <Badge tone="accent" icon="cpu">{sim.modelId}</Badge>
              <Badge tone="muted" icon="clock">{sim.trigger}</Badge>
              <Badge tone="muted" icon="boxes">{project?.name}</Badge>
            </div>
          </div>

          {events.map((e) => (
            <div key={e.id} className="a-up overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]">
              <div className="flex items-center gap-2.5 px-3 py-2">
                <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", e.done ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--blue-soft)] text-[var(--blue)]")}>
                  <Icon name={e.icon} size={12} />
                </span>
                <span className="shrink-0 text-[12px] font-semibold text-[var(--text)]">{e.tool}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--muted)]">{e.target}</span>
                {e.meta && e.done && <span className="shrink-0 text-[10.5px] text-[var(--faint)]">{e.meta}</span>}
                {e.done ? <Icon name="check" size={13} strokeWidth={2.2} className="shrink-0 text-[var(--green)]" /> : <Spinner size={12} />}
              </div>
              {e.done && e.out && (
                <pre className="a-in overflow-x-auto border-t border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 font-mono text-[10.5px] leading-relaxed text-[var(--muted)]">
                  {e.out.join("\n")}
                </pre>
              )}
            </div>
          ))}

          {!finished && events.length > 0 && (
            <div className="ml-1 flex items-center gap-2 text-[12px] text-[var(--muted)]">
              <Spinner size={12} />
              simulating step {events.length} of {simSteps.length}
              <span className="ml-1 h-1.5 w-24 overflow-hidden rounded-full bg-[var(--panel-3)]">
                <span className="grad-accent block h-full transition-all duration-500" style={{ width: `${(events.length / simSteps.length) * 100}%` }} />
              </span>
            </div>
          )}

          {notes.map((n, i) => (
            <div key={i} className="a-up ml-auto max-w-[80%] rounded-xl rounded-tr-sm bg-[var(--accent-soft)] px-3 py-2 text-[12.5px] text-[var(--accent-ink)]">
              {n}
            </div>
          ))}

          {finished && (
            <div className="a-up rounded-xl border border-[var(--accent)]/25 bg-gradient-to-br from-[var(--accent-soft)] to-transparent p-4">
              <div className="flex items-center gap-2 pb-2">
                <Icon name="sparkle" size={14} className="text-[var(--accent)]" fill />
                <p className="text-[13px] font-bold text-[var(--text)]">Simulation complete</p>
              </div>
              <ul className="flex flex-col gap-1.5 text-[12.5px] leading-relaxed text-[var(--muted)]">
                {[
                  "14 quarantined specs re-run 20× each — 3 unstable.",
                  "Root causes clustered: timer leak (2), unawaited promise (1).",
                  "3 candidate fixes applied · +34 −11 · all specs stable after patch.",
                  "Published as a thread for review — no changes pushed automatically.",
                ].map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
                    {b}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-1.5 pt-3">
                <Btn variant="accent" icon="pr" onClick={() => onToast("Thread published for review")}>Publish thread</Btn>
                <Btn variant="ghost" icon="refresh" onClick={() => onToast("Re-running simulation…")}>Run again</Btn>
                <Btn variant="ghost" icon="save" onClick={() => onToast("Saved as scheduled automation")}>Save schedule</Btn>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-[var(--border)] px-4 py-3">
        <div className="mx-auto flex max-w-[680px] items-center gap-2 rounded-xl border border-[var(--border-2)] bg-[var(--panel)] px-3 py-2 shadow-[var(--shadow-sm)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--ring)]">
          <Icon name="sparkle" size={13} className="text-[var(--accent)]" />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && note.trim()) {
                setNotes((n) => [...n, note.trim()]);
                setNote("");
                onToast("Steering the simulation…");
              }
            }}
            placeholder="Steer the run — e.g. “only patch the timer leaks”"
            className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-[var(--faint)]"
          />
          <span className="font-mono text-[10.5px] text-[var(--faint)]">{sim.modelId}</span>
          <button
            onClick={() => {
              if (!note.trim()) return;
              setNotes((n) => [...n, note.trim()]);
              setNote("");
            }}
            className="grad-accent flex h-7 w-7 items-center justify-center rounded-lg text-white"
          >
            <Icon name="arrowUp" size={13} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- main ----------------------------------- */

export default function AutomationsView({ onToast }: Props) {
  const [sims, setSims] = useState<Simulation[]>(seedSimulations);
  const [running, setRunning] = useState<Simulation | null>(null);
  const [wizard, setWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Simulation>({
    id: "",
    name: "",
    goal: "",
    trigger: triggers[0],
    projectId: projects[0].id,
    prompt: "",
    modelId: modelIds[0],
    runs: 0,
    status: "idle",
    created: "just now",
  });

  if (running) return <SimulationRun sim={running} onExit={() => setRunning(null)} onToast={onToast} />;

  const canNext = step === 0 ? draft.name.trim().length > 2 && draft.goal.trim().length > 2 : draft.prompt.trim().length > 10;

  const approve = () => {
    const sim = { ...draft, id: `sim${Date.now()}` };
    setSims((p) => [sim, ...p]);
    setWizard(false);
    setStep(0);
    setRunning(sim);
    onToast(`${sim.name} approved — starting simulation`);
    setDraft({ ...draft, name: "", goal: "", prompt: "" });
  };

  const STEPS = ["Setup", "Prompt & model", "Review"];

  return (
    <section className="h-full min-w-0 flex-1 overflow-y-auto bg-[var(--app)]">
      <div className="sticky top-0 z-10 glass border-b border-[var(--border)] px-7 py-4">
        <div className="mx-auto flex max-w-[880px] items-center gap-3">
          <div>
            <h1 className="text-[19px] font-bold tracking-tight text-[var(--text)]">Automations</h1>
            <p className="pt-0.5 text-[12.5px] text-[var(--muted)]">
              Build a simulation, approve it, and watch the agent work it end to end.
            </p>
          </div>
          <Btn variant="accent" icon="plus" className="ml-auto" onClick={() => { setWizard(true); setStep(0); }}>
            New simulation
          </Btn>
        </div>
      </div>

      <div className="mx-auto max-w-[880px] px-7 py-6">
        <div className="grid grid-cols-3 gap-3 pb-7">
          {[
            { label: "Simulations", value: String(sims.length), icon: "boxes" as const },
            { label: "Runs this month", value: "174", icon: "refresh" as const },
            { label: "Fixes proposed", value: "23", icon: "wrench" as const },
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

        <Section title="Your simulations">
          <div className="flex flex-col gap-2.5">
            {sims.map((s, i) => (
              <div key={s.id} className="a-up flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3.5 shadow-[var(--shadow-sm)] transition hover:border-[var(--border-2)]" style={{ animationDelay: `${i * 45}ms` }}>
                <span className="grad-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white">
                  <Icon name="zap" size={15} fill />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--text)]">{s.name}</p>
                  <p className="truncate text-[11.5px] text-[var(--muted)]">{s.goal}</p>
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[10.5px] text-[var(--faint)]">
                    <span className="flex items-center gap-1"><Icon name="clock" size={10} /> {s.trigger}</span>
                    <span className="flex items-center gap-1 font-mono"><Icon name="cpu" size={10} /> {s.modelId}</span>
                    <span>· {s.runs} runs</span>
                  </div>
                </div>
                <Btn variant="ghost" icon="eye" className="!py-1 !text-[11px]" onClick={() => onToast("Opening run history")}>History</Btn>
                <Btn variant="accent" icon="play" className="!py-1 !text-[11px]" onClick={() => setRunning(s)}>Simulate</Btn>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* wizard */}
      {wizard && (
        <div className="a-in fixed inset-0 z-50 flex items-center justify-center bg-[#12101a]/35 p-4 backdrop-blur-[3px]" onMouseDown={() => setWizard(false)}>
          <div className="a-pop w-[min(600px,94vw)] overflow-hidden rounded-2xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-lg)]" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
              <Icon name="zap" size={15} className="text-[var(--accent)]" />
              <p className="text-[13.5px] font-bold text-[var(--text)]">New simulation</p>
              <IconBtn icon="close" size={13} className="ml-auto" onClick={() => setWizard(false)} />
            </div>

            <div className="flex items-center gap-1.5 border-b border-[var(--border)] bg-[var(--panel-2)] px-4 py-2.5">
              {STEPS.map((s, i) => (
                <div key={s} className="flex flex-1 items-center gap-1.5">
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition", i <= step ? "grad-accent text-white" : "bg-[var(--panel-3)] text-[var(--faint)]")}>
                    {i < step ? "✓" : i + 1}
                  </span>
                  <span className={cn("text-[11.5px] font-medium", i === step ? "text-[var(--text)]" : "text-[var(--faint)]")}>{s}</span>
                  {i < STEPS.length - 1 && <span className={cn("ml-1 h-px flex-1", i < step ? "bg-[var(--accent)]" : "bg-[var(--border-2)]")} />}
                </div>
              ))}
            </div>

            <div className="max-h-[58vh] overflow-y-auto px-4 py-4">
              {step === 0 && (
                <div className="a-in flex flex-col gap-3.5">
                  <div>
                    <label className="block pb-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--faint)]">Name</label>
                    <input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nightly flake sweep" className="w-full rounded-lg border border-[var(--border-2)] bg-[var(--panel-2)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]" />
                  </div>
                  <div>
                    <label className="block pb-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--faint)]">Goal</label>
                    <input value={draft.goal} onChange={(e) => setDraft({ ...draft, goal: e.target.value })} placeholder="Find and fix flaky tests" className="w-full rounded-lg border border-[var(--border-2)] bg-[var(--panel-2)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]" />
                  </div>
                  <div>
                    <p className="pb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--faint)]">Project</p>
                    <div className="flex flex-wrap gap-1.5">
                      {projects.map((p) => (
                        <button key={p.id} onClick={() => setDraft({ ...draft, projectId: p.id })} className={cn("rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition", draft.projectId === p.id ? "border-transparent bg-[var(--text)] text-[var(--app)]" : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-2)]")}>
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="pb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--faint)]">Trigger</p>
                    <div className="flex flex-wrap gap-1.5">
                      {triggers.map((t) => (
                        <button key={t} onClick={() => setDraft({ ...draft, trigger: t })} className={cn("rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition", draft.trigger === t ? "border-transparent bg-[var(--text)] text-[var(--app)]" : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-2)]")}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="a-in flex flex-col gap-3.5">
                  <div>
                    <label className="block pb-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--faint)]">Prompt</label>
                    <textarea
                      autoFocus
                      rows={6}
                      value={draft.prompt}
                      onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
                      placeholder="Describe exactly what the agent should do on every run, what it may change, and what it must never do."
                      className="w-full resize-none rounded-lg border border-[var(--border-2)] bg-[var(--panel-2)] px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
                    />
                    <p className="pt-1 text-[10.5px] text-[var(--faint)]">{draft.prompt.length} characters · minimum 10</p>
                  </div>
                  <div>
                    <p className="pb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--faint)]">Model ID</p>
                    <div className="grid grid-cols-2 gap-2">
                      {modelIds.map((m) => (
                        <button key={m} onClick={() => setDraft({ ...draft, modelId: m })} className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition", draft.modelId === m ? "border-[var(--accent)] bg-[var(--accent-soft)]/50" : "border-[var(--border)] hover:border-[var(--border-2)]")}>
                          <Icon name="cpu" size={13} className={draft.modelId === m ? "text-[var(--accent)]" : "text-[var(--faint)]"} />
                          <span className="font-mono text-[11.5px] font-medium text-[var(--text)]">{m}</span>
                          {draft.modelId === m && <Icon name="check" size={12} strokeWidth={2.2} className="ml-auto text-[var(--accent)]" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="a-in flex flex-col gap-2.5">
                  {[
                    ["Name", draft.name],
                    ["Goal", draft.goal],
                    ["Project", projects.find((p) => p.id === draft.projectId)?.name ?? ""],
                    ["Trigger", draft.trigger],
                    ["Model ID", draft.modelId],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2">
                      <span className="w-20 shrink-0 text-[10.5px] uppercase tracking-[0.06em] text-[var(--faint)]">{k}</span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--text)]">{v}</span>
                    </div>
                  ))}
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2">
                    <p className="pb-1 text-[10.5px] uppercase tracking-[0.06em] text-[var(--faint)]">Prompt</p>
                    <p className="text-[12.5px] leading-relaxed text-[var(--text)]">{draft.prompt}</p>
                  </div>
                  <div className="flex items-start gap-2 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)]/50 px-3 py-2.5">
                    <Icon name="shield" size={13} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                    <p className="text-[11.5px] leading-relaxed text-[var(--muted)]">
                      On approval the simulation runs in a sandbox. It can read, patch and test — nothing is pushed until you publish the resulting thread.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--panel-2)] px-4 py-3">
              {step > 0 && <Btn variant="ghost" icon="arrowLeft" onClick={() => setStep(step - 1)}>Back</Btn>}
              <span className="ml-auto flex gap-2">
                <Btn variant="ghost" onClick={() => setWizard(false)}>Cancel</Btn>
                {step < 2 ? (
                  <Btn variant="accent" icon="chevRight" disabled={!canNext} onClick={() => setStep(step + 1)}>Continue</Btn>
                ) : (
                  <Btn variant="accent" icon="check" onClick={approve}>Approve &amp; run</Btn>
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
