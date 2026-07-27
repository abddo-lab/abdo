import { useMemo, useState } from "react";
import {
  Bot,
  Boxes,
  Check,
  Cpu,
  Database,
  FolderTree,
  Globe,
  GitBranch,
  Plug,
  Play,
  Search,
  Loader2,
  Terminal,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { c, mono } from "./theme";
import { subagents as seedAgents, tools as seedTools, type Subagent, type Tool } from "./workData";

const groupIcons: Record<Tool["group"], LucideIcon> = {
  Filesystem: FolderTree,
  Execution: Terminal,
  "Version control": GitBranch,
  Web: Globe,
  Data: Database,
  Agents: Bot,
};

const permTone: Record<Tool["perm"], { fg: string; bg: string }> = {
  allow: { fg: "#ededed", bg: "rgba(255,255,255,.10)" },
  ask: { fg: "#b4b4b4", bg: "rgba(255,255,255,.06)" },
  deny: { fg: "#7a7a7a", bg: "rgba(255,255,255,.03)" },
};

function fmtMs(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function fmtNum(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className="relative rounded-full flex-shrink-0 transition-colors"
      style={{ width: 30, height: 17, backgroundColor: on ? c.accent : c.chipHover, border: `1px solid ${on ? c.accent : c.border}` }}
    >
      <span
        className="absolute rounded-full transition-all"
        style={{ width: 13, height: 13, top: 1, left: on ? 14 : 1, backgroundColor: on ? "#000" : c.muted }}
      />
    </button>
  );
}

/* ---------------- tools tab ---------------- */
function ToolsTab() {
  const [list, setList] = useState<Tool[]>(seedTools);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<"All" | Tool["group"]>("All");

  const groups: ("All" | Tool["group"])[] = ["All", "Filesystem", "Execution", "Version control", "Web", "Data", "Agents"];

  const filtered = useMemo(
    () =>
      list.filter((t) => {
        if (group !== "All" && t.group !== group) return false;
        const q = query.trim().toLowerCase();
        return !q || `${t.name} ${t.desc}`.toLowerCase().includes(q);
      }),
    [list, group, query]
  );

  const setPerm = (id: string, perm: Tool["perm"]) => setList((p) => p.map((t) => (t.id === id ? { ...t, perm } : t)));
  const toggle = (id: string) => setList((p) => p.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)));

  const enabled = list.filter((t) => t.enabled).length;
  const mcp = list.filter((t) => t.source === "mcp").length;

  return (
    <div>
      <div className="grid gap-2.5 mb-4 kpiGrid">
        {[
          { icon: Wrench, label: "Tools", value: `${list.length}`, sub: `${enabled} enabled` },
          { icon: Plug, label: "From MCP", value: `${mcp}`, sub: "external servers" },
          { icon: Cpu, label: "Calls", value: fmtNum(list.reduce((s, t) => s + t.calls, 0)), sub: "last 30 days" },
          { icon: Check, label: "Auto-allowed", value: `${list.filter((t) => t.perm === "allow").length}`, sub: "run without asking" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl p-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider" style={{ color: c.faint }}>
              <k.icon size={11} /> {k.label}
            </div>
            <div className="text-[19px] font-semibold mt-1 tracking-tight" style={{ color: c.text }}>{k.value}</div>
            <div className="text-[10.5px] mt-0.5" style={{ color: c.dim, fontFamily: mono }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex gap-0.5 p-0.5 rounded-lg overflow-x-auto" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}>
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className="px-2.5 py-1 rounded-md text-[11.5px] font-medium whitespace-nowrap transition-colors"
              style={{ backgroundColor: group === g ? c.chipHover : "transparent", color: group === g ? c.text : c.muted }}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-2 rounded-lg" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}`, minWidth: 180 }}>
          <Search size={11} color={c.dim} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools"
            className="w-full bg-transparent outline-none py-1.5 text-[12px]"
            style={{ color: c.text }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map((t) => {
          const Icon = groupIcons[t.group];
          const tone = permTone[t.perm];
          return (
            <div
              key={t.id}
              className="rounded-xl p-3 flex items-start gap-3"
              style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}`, opacity: t.enabled ? 1 : 0.6 }}
            >
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: c.chip, border: `1px solid ${c.border}` }}
              >
                <Icon size={13} color={t.enabled ? c.text : c.faint} />
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12.5px] font-medium" style={{ color: c.text, fontFamily: mono }}>{t.name}</span>
                  {t.source === "mcp" && (
                    <span className="text-[8.5px] px-1 py-[1px] rounded font-semibold" style={{ backgroundColor: "rgba(255,255,255,.07)", color: c.muted, letterSpacing: ".06em" }}>
                      MCP · {t.server}
                    </span>
                  )}
                </div>
                <p className="text-[11.5px] mt-1 leading-snug" style={{ color: c.muted }}>{t.desc}</p>
                <div className="flex items-center gap-3 mt-1.5 text-[10px]" style={{ color: c.dim, fontFamily: mono }}>
                  <span>{fmtNum(t.calls)} calls</span>
                  <span>·</span>
                  <span>avg {fmtMs(t.avgMs)}</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <Toggle on={t.enabled} onChange={() => toggle(t.id)} />
                <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}>
                  {(["allow", "ask", "deny"] as Tool["perm"][]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPerm(t.id, p)}
                      className="px-1.5 py-0.5 rounded text-[9.5px] capitalize transition-colors"
                      style={{
                        backgroundColor: t.perm === p ? tone.bg : "transparent",
                        color: t.perm === p ? tone.fg : c.dim,
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-xl py-10 text-center text-[12.5px]" style={{ backgroundColor: c.panel, border: `1px dashed ${c.border}`, color: c.dim }}>
            No tools match.
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- subagents tab ---------------- */
function AgentsTab() {
  const [list, setList] = useState<Subagent[]>(seedAgents);
  const [running, setRunning] = useState<string | null>(null);

  const toggle = (id: string) => setList((p) => p.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));

  const dispatch = (id: string) => {
    setRunning(id);
    window.setTimeout(() => {
      setRunning(null);
      setList((p) => p.map((a) => (a.id === id ? { ...a, runs: a.runs + 1 } : a)));
    }, 2200);
  };

  return (
    <div>
      <div className="grid gap-2.5 mb-4 kpiGrid">
        {[
          { icon: Bot, label: "Subagents", value: `${list.length}`, sub: `${list.filter((a) => a.enabled).length} enabled` },
          { icon: Boxes, label: "Parallel cap", value: "4", sub: "concurrent runs" },
          { icon: Play, label: "Dispatches", value: fmtNum(list.reduce((s, a) => s + a.runs, 0)), sub: "all time" },
          { icon: Check, label: "Success", value: `${Math.round((list.reduce((s, a) => s + a.successRate, 0) / list.length) * 100)}%`, sub: "average" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl p-3" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider" style={{ color: c.faint }}>
              <k.icon size={11} /> {k.label}
            </div>
            <div className="text-[19px] font-semibold mt-1 tracking-tight" style={{ color: c.text }}>{k.value}</div>
            <div className="text-[10.5px] mt-0.5" style={{ color: c.dim, fontFamily: mono }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-2.5 agentGrid">
        {list.map((a) => {
          const busy = running === a.id;
          return (
            <div
              key={a.id}
              className="rounded-xl p-3.5 flex flex-col"
              style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}`, opacity: a.enabled ? 1 : 0.62 }}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: c.chip, border: `1px solid ${c.border}` }}
                >
                  <Bot size={13} color={a.enabled ? c.text : c.faint} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[13px] font-semibold tracking-tight" style={{ color: c.text, fontFamily: mono }}>{a.name}</span>
                    {a.builtin && (
                      <span className="text-[8px] px-1 py-[1px] rounded font-semibold" style={{ backgroundColor: "rgba(255,255,255,.07)", color: c.muted, letterSpacing: ".06em" }}>
                        BUILT-IN
                      </span>
                    )}
                  </div>
                  <span className="block text-[10.5px] mt-0.5" style={{ color: c.dim }}>{a.role}</span>
                </div>
                <Toggle on={a.enabled} onChange={() => toggle(a.id)} />
              </div>

              <p className="text-[11.5px] leading-relaxed mt-2.5" style={{ color: c.muted }}>{a.desc}</p>

              <div className="flex flex-wrap gap-1 mt-2.5">
                {a.tools.map((t) => (
                  <span key={t} className="text-[9.5px] px-1.5 py-0.5 rounded" style={{ backgroundColor: c.chip, color: c.muted, fontFamily: mono }}>
                    {t}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${c.borderSoft}` }}>
                {[
                  ["Model", a.model],
                  ["Thinking", a.thinking],
                  ["Avg run", fmtMs(a.avgMs)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <span className="block text-[8.5px] uppercase tracking-wider" style={{ color: c.dim }}>{k}</span>
                    <span className="block text-[10.5px] mt-0.5" style={{ color: c.text, fontFamily: mono }}>{v}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px]" style={{ color: c.dim, fontFamily: mono }}>
                  {a.runs} runs · {Math.round(a.successRate * 100)}% ok
                </span>
                <button
                  onClick={() => dispatch(a.id)}
                  disabled={!a.enabled || busy}
                  className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
                  style={{
                    backgroundColor: a.enabled && !busy ? c.chip : "transparent",
                    border: `1px solid ${c.border}`,
                    color: a.enabled ? c.text : c.dim,
                  }}
                >
                  {busy ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                  {busy ? "Running" : "Dispatch"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- panel ---------------- */
export default function ToolsPanel() {
  const [tab, setTab] = useState<"Tools" | "Subagents">("Tools");

  return (
    <div className="flex-1 h-full overflow-y-auto" style={{ backgroundColor: c.bg }}>
      <div className="mx-auto px-4 sm:px-6 py-6" style={{ maxWidth: 900 }}>
        <div className="flex items-start gap-3 mb-4 flex-wrap">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight" style={{ color: c.text }}>Tools &amp; Subagents</h1>
            <p className="text-[12px]" style={{ color: c.muted }}>
              Everything Caret can call, and the specialists it can dispatch in parallel.
            </p>
          </div>
        </div>

        <div className="flex gap-0.5 p-0.5 rounded-lg mb-4" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}`, maxWidth: 300 }}>
          {(["Tools", "Subagents"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-1.5 rounded-md text-[11.5px] font-medium transition-colors"
              style={{ backgroundColor: tab === t ? c.chipHover : "transparent", color: tab === t ? c.text : c.muted }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Tools" ? <ToolsTab /> : <AgentsTab />}
      </div>
    </div>
  );
}
