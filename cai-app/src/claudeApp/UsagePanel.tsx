import { useEffect, useMemo, useState } from "react";
import { Activity, Coins, Flame, Layers, MessageSquare, TrendingUp, Clock, Zap } from "lucide-react";
import { c, mono } from "./theme";
import { usageDB, type UsageRecord } from "../services/db";
import { useAuth } from "./auth";

function fmt(n: number) { if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`; if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`; return `${n}`; }

function Card({ icon: Icon, label, value, sub, trend }: { icon: typeof Activity; label: string; value: string; sub?: string; trend?: string }) {
  return <div className="rounded-xl p-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider" style={{ color: c.faint }}><Icon size={11} /> {label}</div>
    <div className="text-[20px] font-semibold mt-1 tracking-tight" style={{ color: c.text }}>{value}</div>
    <div className="flex items-center gap-2 mt-0.5">
      {sub && <div className="text-[10.5px]" style={{ color: c.dim, fontFamily: mono }}>{sub}</div>}
      {trend && <div className="text-[9.5px] px-1 py-0.5 rounded" style={{ backgroundColor: c.chip, color: c.muted }}>{trend}</div>}
    </div>
  </div>;
}

function BarChart({ data, max }: { data: { label: string; value: number; color?: string }[]; max: number }) {
  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="text-[9px]" style={{ color: c.dim, fontFamily: mono }}>{fmt(d.value)}</div>
          <div className="w-full rounded-t" style={{ height: `${(d.value / max) * 100}%`, minHeight: 2, backgroundColor: d.color || c.accent }} />
          <div className="text-[8px]" style={{ color: c.faint }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function SparkLine({ values, color = c.accent }: { values: number[]; color?: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-px" style={{ height: 32 }}>
      {values.map((v, i) => (
        <div key={i} className="flex-1 rounded-t" style={{ height: `${(v / max) * 100}%`, minHeight: 1, backgroundColor: color, opacity: 0.6 + (i / values.length) * 0.4 }} />
      ))}
    </div>
  );
}

export default function UsagePanel() {
  const auth = useAuth();
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("7d");

  useEffect(() => { usageDB.getAll().then((r) => { setRecords(r); setLoading(false); }); }, []);

  const agg = useMemo(() => {
    const totalIn = records.reduce((s, r) => s + r.inputTokens, 0);
    const totalOut = records.reduce((s, r) => s + r.outputTokens, 0);
    const totalCost = records.reduce((s, r) => s + r.cost, 0);
    const byModel: Record<string, { in: number; out: number; cost: number; calls: number }> = {};
    for (const r of records) { if (!byModel[r.model]) byModel[r.model] = { in: 0, out: 0, cost: 0, calls: 0 }; byModel[r.model].in += r.inputTokens; byModel[r.model].out += r.outputTokens; byModel[r.model].cost += r.cost; byModel[r.model].calls++; }
    
    // Daily aggregation for charts
    const byDay: Record<string, { tokens: number; cost: number; calls: number }> = {};
    for (const r of records) {
      if (!byDay[r.date]) byDay[r.date] = { tokens: 0, cost: 0, calls: 0 };
      byDay[r.date].tokens += r.inputTokens + r.outputTokens;
      byDay[r.date].cost += r.cost;
      byDay[r.date].calls++;
    }
    
    // Hourly distribution
    const byHour: Record<number, number> = {};
    for (const r of records) {
      const hour = new Date(r.createdAt).getHours();
      byHour[hour] = (byHour[hour] || 0) + r.inputTokens + r.outputTokens;
    }
    
    return { totalIn, totalOut, totalCost, byModel, totalTokens: totalIn + totalOut, byDay, byHour };
  }, [records]);

  const models = Object.entries(agg.byModel);
  const days = Object.entries(agg.byDay).sort(([a], [b]) => a.localeCompare(b));
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({ label: `${i}`, value: agg.byHour[i] || 0 }));

  // Filter by time range
  const filteredDays = useMemo(() => {
    const now = new Date();
    const cutoff = timeRange === "7d" ? new Date(now.getTime() - 7 * 86400000) : timeRange === "30d" ? new Date(now.getTime() - 30 * 86400000) : new Date(0);
    return days.filter(([date]) => new Date(date) >= cutoff);
  }, [days, timeRange]);

  const dailyTokens = filteredDays.map(([, d]) => d.tokens);
  const dailyCosts = filteredDays.map(([, d]) => d.cost);

  return (
    <div className="flex-1 h-full overflow-y-auto" style={{ backgroundColor: c.bg }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-3 mb-5">
          <div><h1 className="text-[20px] font-semibold tracking-tight" style={{ color: c.text }}>Usage Statistics</h1><p className="text-[12px]" style={{ color: c.muted }}>Real-time usage analytics and cost tracking</p></div>
          <div className="ml-auto flex gap-0.5 p-0.5 rounded-lg" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}>
            {(["7d", "30d", "all"] as const).map((r) => (
              <button key={r} onClick={() => setTimeRange(r)} className="px-2 py-1 rounded text-[10px] font-medium" style={{ backgroundColor: timeRange === r ? c.chip : "transparent", color: timeRange === r ? c.text : c.muted }}>{r === "all" ? "All" : r}</button>
            ))}
          </div>
        </div>
        
        {loading ? <div className="text-center py-16 text-[12.5px]" style={{ color: c.dim }}>Loading...</div> : records.length === 0 ? (
          <div className="text-center py-16"><div className="text-[14px] font-medium mb-2" style={{ color: c.text }}>No usage yet</div><div className="text-[12px]" style={{ color: c.muted }}>Start chatting to see costs here.</div></div>
        ) : <>
          <div className="grid grid-cols-4 gap-2.5 mb-5">
            <Card icon={Layers} label="Total Tokens" value={fmt(agg.totalTokens)} sub={`${fmt(agg.totalIn)} in / ${fmt(agg.totalOut)} out`} />
            <Card icon={Coins} label="Total Cost" value={`$${agg.totalCost.toFixed(4)}`} sub={`${records.length} API calls`} />
            <Card icon={MessageSquare} label="Today" value={`$${auth.dailyCost.toFixed(4)}`} sub={`${auth.dailyLimit}/day limit`} trend={`${((auth.dailyCost / auth.dailyLimit) * 100).toFixed(0)}%`} />
            <Card icon={Flame} label="Budget" value={`${((auth.dailyCost / auth.dailyLimit) * 100).toFixed(0)}%`} sub="daily usage" trend={auth.budgetExceeded ? "exceeded" : "ok"} />
          </div>

          {/* Token usage chart */}
          <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <div className="flex items-center gap-2 mb-3"><TrendingUp size={13} color={c.faint} /><span className="text-[12.5px] font-medium" style={{ color: c.text }}>Token Usage</span></div>
            <BarChart data={filteredDays.map(([date, d]) => ({ label: date.slice(5), value: d.tokens }))} max={Math.max(...dailyTokens, 1)} />
          </div>

          {/* Cost chart */}
          <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <div className="flex items-center gap-2 mb-3"><Coins size={13} color={c.faint} /><span className="text-[12.5px] font-medium" style={{ color: c.text }}>Daily Cost</span></div>
            <BarChart data={filteredDays.map(([date, d]) => ({ label: date.slice(5), value: d.cost, color: c.muted }))} max={Math.max(...dailyCosts, 0.001)} />
          </div>

          {/* Hourly distribution */}
          <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <div className="flex items-center gap-2 mb-3"><Clock size={13} color={c.faint} /><span className="text-[12.5px] font-medium" style={{ color: c.text }}>Hourly Activity</span></div>
            <BarChart data={hourlyData} max={Math.max(...hourlyData.map((d) => d.value), 1)} />
          </div>

          {/* Budget bar */}
          <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <div className="flex items-center gap-2 mb-3"><Activity size={13} color={c.faint} /><span className="text-[12.5px] font-medium" style={{ color: c.text }}>Daily Budget</span></div>
            <div className="h-2 rounded-full overflow-hidden mb-2" style={{ backgroundColor: c.chip }}><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (auth.dailyCost / auth.dailyLimit) * 100)}%`, backgroundColor: auth.budgetExceeded ? "#ff6b6b" : c.accent }} /></div>
            <div className="flex justify-between text-[10.5px]" style={{ color: c.dim, fontFamily: mono }}><span>$0.00</span><span>${auth.dailyLimit.toFixed(2)}</span></div>
          </div>

          {/* Model breakdown */}
          {models.length > 0 && <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <div className="flex items-center gap-2 mb-3"><Layers size={13} color={c.faint} /><span className="text-[12.5px] font-medium" style={{ color: c.text }}>Model Breakdown</span></div>
            {models.map(([model, data]) => {
              const pct = agg.totalTokens > 0 ? ((data.in + data.out) / agg.totalTokens) * 100 : 0;
              return (
                <div key={model} className="py-2" style={{ borderTop: `1px solid ${c.borderSoft}` }}>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[11.5px] font-medium" style={{ color: c.text, fontFamily: mono }}>{model}</span>
                    <span className="text-[10px]" style={{ color: c.muted }}>{data.calls} calls</span>
                    <span className="ml-auto text-[11px]" style={{ color: c.text, fontFamily: mono }}>${data.cost.toFixed(4)}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: c.chip }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.accent }} />
                  </div>
                  <div className="flex justify-between mt-1 text-[9.5px]" style={{ color: c.dim, fontFamily: mono }}>
                    <span>{fmt(data.in + data.out)} tokens</span>
                    <span>{pct.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>}

          {/* Recent records */}
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${c.borderSoft}` }}><Zap size={13} color={c.faint} /><span className="text-[12.5px] font-medium" style={{ color: c.text }}>Recent Activity</span></div>
            <table className="w-full text-[11.5px]">
              <thead><tr style={{ color: c.faint }}>
                <th className="text-left font-medium px-4 py-1.5">Time</th>
                <th className="text-left font-medium px-2 py-1.5">Model</th>
                <th className="text-right font-medium px-2 py-1.5">Input</th>
                <th className="text-right font-medium px-2 py-1.5">Output</th>
                <th className="text-right font-medium px-2 py-1.5">Tokens</th>
                <th className="text-right font-medium px-4 py-1.5">Cost</th>
              </tr></thead>
              <tbody>{records.slice(-15).reverse().map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.025]">
                  <td className="px-4 py-1.5" style={{ color: c.text, fontFamily: mono }}>{new Date(r.createdAt).toLocaleTimeString()}</td>
                  <td className="px-2 py-1.5" style={{ color: c.muted, fontFamily: mono }}>{r.model}</td>
                  <td className="px-2 py-1.5 text-right" style={{ color: c.muted, fontFamily: mono }}>{fmt(r.inputTokens)}</td>
                  <td className="px-2 py-1.5 text-right" style={{ color: c.muted, fontFamily: mono }}>{fmt(r.outputTokens)}</td>
                  <td className="px-2 py-1.5 text-right" style={{ color: c.text, fontFamily: mono }}>{fmt(r.inputTokens + r.outputTokens)}</td>
                  <td className="px-4 py-1.5 text-right" style={{ color: c.text, fontFamily: mono }}>${r.cost.toFixed(4)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>}
      </div>
    </div>
  );
}
