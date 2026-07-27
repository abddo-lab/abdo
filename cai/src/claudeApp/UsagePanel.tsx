import { useMemo, useState } from "react";
import { Activity, Clock, Coins, Download, Flame, Layers, MessageSquare, TrendingUp } from "lucide-react";
import { c, mono } from "./theme";
import { MODELS, hourly, planLimits, threadCosts, usageDays, type ModelName } from "./workData";

const RANGES = [7, 14, 30, 45] as const;
const MODEL_SHADE: Record<ModelName, string> = {
  "Opus 4.8": "#ededed",
  "Sonnet 4.6": "#8f8f8f",
  "Haiku 4.5": "#4a4a4a",
};

function fmt(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return `${n}`;
}

function Card({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider" style={{ color: c.faint }}>
        <Icon size={11} /> {label}
      </div>
      <div className="text-[20px] font-semibold mt-1 tracking-tight" style={{ color: c.text }}>
        {value}
      </div>
      {sub && (
        <div className="text-[10.5px] mt-0.5" style={{ color: c.dim, fontFamily: mono }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export default function UsagePanel() {
  const [range, setRange] = useState<number>(14);
  const [hover, setHover] = useState<number | null>(null);
  const [metric, setMetric] = useState<"tokens" | "cost" | "msgs">("tokens");

  const days = useMemo(() => usageDays.slice(-range), [range]);

  const agg = useMemo(() => {
    const inTok = days.reduce((s, d) => s + d.inTok, 0);
    const outTok = days.reduce((s, d) => s + d.outTok, 0);
    const cacheTok = days.reduce((s, d) => s + d.cacheTok, 0);
    const cost = days.reduce((s, d) => s + d.cost, 0);
    const msgs = days.reduce((s, d) => s + d.msgs, 0);
    const sessions = days.reduce((s, d) => s + d.sessions, 0);
    const active = days.filter((d) => d.sessions > 0).length;
    const byModel = MODELS.reduce(
      (acc, m) => ({ ...acc, [m]: days.reduce((s, d) => s + d.byModel[m], 0) }),
      {} as Record<ModelName, number>
    );
    const peak = days.reduce((a, b) => (b.inTok + b.outTok > a.inTok + a.outTok ? b : a), days[0]);

    // longest streak of active days
    let streak = 0;
    let best = 0;
    for (const d of days) {
      if (d.sessions > 0) {
        streak++;
        best = Math.max(best, streak);
      } else streak = 0;
    }
    let current = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].sessions > 0) current++;
      else break;
    }
    return { inTok, outTok, cacheTok, cost, msgs, sessions, active, byModel, peak, best, current };
  }, [days]);

  const totalTok = agg.inTok + agg.outTok;
  const modelTotal = MODELS.reduce((s, m) => s + agg.byModel[m], 0) || 1;

  const metricOf = (d: (typeof days)[number]) =>
    metric === "tokens" ? d.inTok + d.outTok : metric === "cost" ? d.cost : d.msgs;
  const maxMetric = Math.max(...days.map(metricOf), 1);

  const exportCsv = () => {
    const head = "date,sessions,messages,input_tokens,output_tokens,cache_tokens,cost_usd";
    const body = days
      .map((d) => [d.iso, d.sessions, d.msgs, d.inTok, d.outTok, d.cacheTok, d.cost].join(","))
      .join("\n");
    const blob = new Blob([`${head}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `claude-usage-${range}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxHour = Math.max(...hourly);
  const peakHour = hourly.indexOf(maxHour);

  return (
    <div className="flex-1 h-full overflow-y-auto" style={{ backgroundColor: c.bg }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* header */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight" style={{ color: c.text }}>
              Usage
            </h1>
            <p className="text-[12px]" style={{ color: c.muted }}>
              Token spend, model mix and activity across your workspace.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div
              className="flex gap-0.5 p-0.5 rounded-lg"
              style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}
            >
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className="px-2 py-1 rounded-md text-[11px] font-medium transition-colors"
                  style={{
                    backgroundColor: range === r ? c.chipHover : "transparent",
                    color: range === r ? c.text : c.muted,
                  }}
                >
                  {r}d
                </button>
              ))}
            </div>
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors"
              style={{ backgroundColor: c.chip, border: `1px solid ${c.border}`, color: c.text }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chipHover)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = c.chip)}
            >
              <Download size={12} /> CSV
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid kpiGrid gap-2.5 mb-5">
          <Card icon={Layers} label="Tokens" value={fmt(totalTok)} sub={`${fmt(agg.cacheTok)} cached`} />
          <Card icon={Coins} label="Spend" value={`$${agg.cost.toFixed(0)}`} sub={`$${(agg.cost / range).toFixed(2)}/day`} />
          <Card icon={MessageSquare} label="Messages" value={fmt(agg.msgs)} sub={`${agg.sessions} sessions`} />
          <Card icon={Flame} label="Streak" value={`${agg.current}d`} sub={`best ${agg.best}d · ${agg.active} active`} />
        </div>

        {/* main chart */}
        <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={13} color={c.faint} />
            <span className="text-[12.5px] font-medium" style={{ color: c.text }}>
              Daily {metric === "tokens" ? "tokens" : metric === "cost" ? "spend" : "messages"}
            </span>
            <div className="ml-auto flex gap-0.5 p-0.5 rounded-lg" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}>
              {(["tokens", "cost", "msgs"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className="px-2 py-0.5 rounded-md text-[10.5px] transition-colors"
                  style={{ backgroundColor: metric === m ? c.chipHover : "transparent", color: metric === m ? c.text : c.muted }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="relative" style={{ height: 148 }}>
            {/* gridlines */}
            {[0, 0.25, 0.5, 0.75, 1].map((g) => (
              <div
                key={g}
                className="absolute left-0 right-0"
                style={{ bottom: `${g * 100}%`, height: 1, backgroundColor: c.borderSoft, opacity: g === 0 ? 1 : 0.5 }}
              />
            ))}
            <div className="absolute inset-0 flex items-end gap-[3px]">
              {days.map((d, i) => {
                const v = metricOf(d);
                const h = (v / maxMetric) * 100;
                const on = hover === i;
                const inShare = metric === "tokens" ? d.inTok / (d.inTok + d.outTok) : 1;
                return (
                  <div
                    key={d.iso}
                    className="flex-1 flex flex-col justify-end cursor-pointer"
                    style={{ height: "100%" }}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  >
                    <div style={{ height: `${h}%` }} className="flex flex-col justify-end rounded-t overflow-hidden">
                      {metric === "tokens" && (
                        <div style={{ height: `${(1 - inShare) * 100}%`, backgroundColor: on ? "#ffffff" : "#8f8f8f" }} />
                      )}
                      <div
                        style={{
                          height: metric === "tokens" ? `${inShare * 100}%` : "100%",
                          backgroundColor: on ? "#d8d8d8" : "#3a3a3a",
                          transition: "background-color 120ms",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* tooltip */}
            {hover !== null && (
              <div
                className="absolute rounded-lg px-2.5 py-1.5 pointer-events-none z-10"
                style={{
                  bottom: "100%",
                  left: `${(hover / days.length) * 100}%`,
                  transform: `translateX(${hover > days.length * 0.7 ? "-100%" : "0"})`,
                  backgroundColor: "rgba(18,18,18,0.97)",
                  border: `1px solid ${c.borderStrong}`,
                  boxShadow: c.shadowPop,
                  minWidth: 132,
                }}
              >
                <div className="text-[11px] font-medium mb-1" style={{ color: c.text }}>
                  {days[hover].label}
                </div>
                <div className="text-[10px] flex justify-between gap-3" style={{ color: c.muted, fontFamily: mono }}>
                  <span>in</span>
                  <span>{fmt(days[hover].inTok)}</span>
                </div>
                <div className="text-[10px] flex justify-between gap-3" style={{ color: c.muted, fontFamily: mono }}>
                  <span>out</span>
                  <span>{fmt(days[hover].outTok)}</span>
                </div>
                <div className="text-[10px] flex justify-between gap-3" style={{ color: c.muted, fontFamily: mono }}>
                  <span>cache</span>
                  <span>{fmt(days[hover].cacheTok)}</span>
                </div>
                <div
                  className="text-[10px] flex justify-between gap-3 mt-1 pt-1"
                  style={{ color: c.text, fontFamily: mono, borderTop: `1px solid ${c.borderSoft}` }}
                >
                  <span>cost</span>
                  <span>${days[hover].cost.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between mt-2 text-[9.5px]" style={{ color: c.dim, fontFamily: mono }}>
            <span>{days[0].label}</span>
            <span>{days[Math.floor(days.length / 2)].label}</span>
            <span>{days[days.length - 1].label}</span>
          </div>

          {metric === "tokens" && (
            <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ color: c.muted }}>
              <span className="flex items-center gap-1.5">
                <span style={{ width: 8, height: 8, backgroundColor: "#3a3a3a", borderRadius: 2 }} /> input
              </span>
              <span className="flex items-center gap-1.5">
                <span style={{ width: 8, height: 8, backgroundColor: "#8f8f8f", borderRadius: 2 }} /> output
              </span>
            </div>
          )}
        </div>

        {/* two-up: model split + hourly */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <div className="rounded-xl p-4" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <div className="flex items-center gap-2 mb-3">
              <Layers size={13} color={c.faint} />
              <span className="text-[12.5px] font-medium" style={{ color: c.text }}>
                Model mix
              </span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden mb-3">
              {MODELS.map((m) => (
                <span key={m} style={{ width: `${(agg.byModel[m] / modelTotal) * 100}%`, backgroundColor: MODEL_SHADE[m] }} />
              ))}
            </div>
            {MODELS.map((m) => (
              <div key={m} className="flex items-center gap-2 py-1 text-[11.5px]">
                <span className="rounded-sm" style={{ width: 8, height: 8, backgroundColor: MODEL_SHADE[m] }} />
                <span style={{ color: c.muted }}>{m}</span>
                <span className="ml-auto" style={{ color: c.text, fontFamily: mono }}>
                  {fmt(agg.byModel[m])}
                </span>
                <span style={{ color: c.dim, fontFamily: mono, width: 42, textAlign: "right" }}>
                  {((agg.byModel[m] / modelTotal) * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-xl p-4" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={13} color={c.faint} />
              <span className="text-[12.5px] font-medium" style={{ color: c.text }}>
                Activity by hour
              </span>
              <span className="ml-auto text-[10.5px]" style={{ color: c.dim, fontFamily: mono }}>
                peak {peakHour}:00
              </span>
            </div>
            <div className="flex items-end gap-[2px]" style={{ height: 82 }}>
              {hourly.map((v, h) => (
                <div
                  key={h}
                  title={`${h}:00 — ${v} messages`}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${(v / maxHour) * 100}%`,
                    backgroundColor: h === peakHour ? "#ededed" : "#333",
                    minHeight: 2,
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1.5 text-[9.5px]" style={{ color: c.dim, fontFamily: mono }}>
              <span>00</span>
              <span>06</span>
              <span>12</span>
              <span>18</span>
              <span>23</span>
            </div>
          </div>
        </div>

        {/* plan limits */}
        <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
          <div className="flex items-center gap-2 mb-3">
            <Activity size={13} color={c.faint} />
            <span className="text-[12.5px] font-medium" style={{ color: c.text }}>
              Plan limits
            </span>
            <span
              className="ml-auto text-[10px] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: c.chip, color: c.muted, border: `1px solid ${c.borderSoft}` }}
            >
              Max 20×
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {planLimits.map((p) => (
              <div key={p.label}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[11px]" style={{ color: c.muted }}>
                    {p.label}
                  </span>
                  <span className="text-[11px] font-medium" style={{ color: c.text, fontFamily: mono }}>
                    {p.used}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: c.chip }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${p.used}%`,
                      backgroundColor: p.used > 80 ? "#fff" : p.used > 40 ? "#b4b4b4" : "#6e6e6e",
                    }}
                  />
                </div>
                <div className="text-[9.5px] mt-1" style={{ color: c.dim, fontFamily: mono }}>
                  resets {p.reset} · {p.detail}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* thread costs */}
        <div className="rounded-xl overflow-hidden mb-6" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${c.borderSoft}` }}>
            <Coins size={13} color={c.faint} />
            <span className="text-[12.5px] font-medium" style={{ color: c.text }}>
              Most expensive threads
            </span>
          </div>
          <table className="w-full text-[11.5px]">
            <thead>
              <tr style={{ color: c.faint }}>
                <th className="text-left font-medium px-4 py-1.5">Thread</th>
                <th className="text-left font-medium px-2 py-1.5">Model</th>
                <th className="text-right font-medium px-2 py-1.5">Runs</th>
                <th className="text-right font-medium px-2 py-1.5">Tokens</th>
                <th className="text-right font-medium px-4 py-1.5">Cost</th>
              </tr>
            </thead>
            <tbody>
              {threadCosts.map((t) => (
                <tr key={t.name} className="hover:bg-white/[0.025]">
                  <td className="px-4 py-1.5 truncate max-w-[240px]" style={{ color: c.text }}>
                    {t.name}
                  </td>
                  <td className="px-2 py-1.5" style={{ color: c.muted, fontFamily: mono }}>
                    {t.model}
                  </td>
                  <td className="px-2 py-1.5 text-right" style={{ color: c.muted, fontFamily: mono }}>
                    {t.runs}
                  </td>
                  <td className="px-2 py-1.5 text-right" style={{ color: c.muted, fontFamily: mono }}>
                    {fmt(t.tokens)}
                  </td>
                  <td className="px-4 py-1.5 text-right" style={{ color: c.text, fontFamily: mono }}>
                    ${t.cost.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
