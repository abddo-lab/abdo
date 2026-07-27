import { useMemo, useState } from "react";
import {
  Code2,
  Keyboard,
  Plug,
  RotateCcw,
  Shield,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { c, mono } from "./theme";
import { keybindings, mcpServers, settingsSections, type SettingControl } from "./workData";
import { GitHubMark, useGitHub } from "./github";

const sectionIcons: Record<string, LucideIcon> = {
  sliders: SlidersHorizontal,
  code: Code2,
  sparkles: Sparkles,
  shield: Shield,
};

type Values = Record<string, boolean | string | number>;

function defaults(): Values {
  const v: Values = {};
  settingsSections.forEach((s) => s.items.forEach((i) => (v[i.id] = i.def)));
  return v;
}

/* ---------- controls ---------- */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className="relative rounded-full flex-shrink-0 transition-colors"
      style={{
        width: 32,
        height: 18,
        backgroundColor: on ? c.accent : c.chipHover,
        border: `1px solid ${on ? c.accent : c.border}`,
      }}
    >
      <span
        className="absolute rounded-full transition-all"
        style={{
          width: 14,
          height: 14,
          top: 1,
          left: on ? 15 : 1,
          backgroundColor: on ? "#000" : c.muted,
        }}
      />
    </button>
  );
}

function Segmented({
  options,
  value,
  onChange,
  compact,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  return (
    <div
      className="flex gap-0.5 p-0.5 rounded-lg flex-shrink-0"
      style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}
    >
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-md transition-colors ${compact ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-[11px]"}`}
          style={{
            backgroundColor: value === o ? c.chipHover : "transparent",
            color: value === o ? c.text : c.muted,
            fontWeight: value === o ? 500 : 400,
          }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Slider({
  min,
  max,
  step,
  value,
  unit,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-2.5 flex-shrink-0" style={{ width: 172 }}>
      <div className="relative flex-1 h-4 flex items-center">
        <div className="absolute left-0 right-0 h-1 rounded-full" style={{ backgroundColor: c.chipHover }} />
        <div className="absolute left-0 h-1 rounded-full" style={{ width: `${pct}%`, backgroundColor: c.accent }} />
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `calc(${pct}% - 5px)`,
            width: 10,
            height: 10,
            backgroundColor: "#fff",
            boxShadow: "0 0 0 3px rgba(255,255,255,0.12)",
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
      </div>
      <span className="text-[11px] w-11 text-right" style={{ color: c.text, fontFamily: mono }}>
        {value}
        {unit ?? ""}
      </span>
    </div>
  );
}

function Control({
  item,
  value,
  onChange,
}: {
  item: SettingControl;
  value: boolean | string | number;
  onChange: (v: boolean | string | number) => void;
}) {
  if (item.kind === "toggle") return <Toggle on={value as boolean} onChange={onChange} />;
  if (item.kind === "select")
    return <Segmented options={item.options} value={value as string} onChange={onChange} compact />;
  if (item.kind === "slider")
    return (
      <Slider min={item.min} max={item.max} step={item.step} unit={item.unit} value={value as number} onChange={onChange} />
    );
  return <Segmented options={["allow", "ask", "deny"]} value={value as string} onChange={onChange} compact />;
}

/* ---------- panel ---------- */
export default function SettingsPanel() {
  const [values, setValues] = useState<Values>(defaults);
  const [servers, setServers] = useState(mcpServers);
  const gh = useGitHub();
  const [active, setActive] = useState(settingsSections[0].id);

  const dirtyCount = useMemo(
    () =>
      settingsSections
        .flatMap((s) => s.items)
        .filter((i) => values[i.id] !== i.def).length,
    [values]
  );

  const set = (id: string, v: boolean | string | number) => setValues((p) => ({ ...p, [id]: v }));

  const navItems = [
    ...settingsSections.map((s) => ({ id: s.id, title: s.title, icon: sectionIcons[s.icon] })),
    { id: "mcp", title: "Connections", icon: Plug },
    { id: "keys", title: "Keyboard", icon: Keyboard },
  ];

  return (
    <div className="flex-1 h-full flex min-h-0" style={{ backgroundColor: c.bg }}>
      {/* section nav */}
      <div
        className="w-48 flex-shrink-0 py-5 px-3 overflow-y-auto"
        style={{ borderRight: `1px solid ${c.border}` }}
      >
        <div className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-2" style={{ color: c.faint }}>
          Settings
        </div>
        {navItems.map((n) => (
          <button
            key={n.id}
            onClick={() => setActive(n.id)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12.5px] text-left transition-colors mb-0.5"
            style={{
              backgroundColor: active === n.id ? c.sidebarActive : "transparent",
              color: active === n.id ? c.text : c.muted,
            }}
            onMouseEnter={(e) => active !== n.id && (e.currentTarget.style.backgroundColor = c.sidebarHover)}
            onMouseLeave={(e) => active !== n.id && (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <n.icon size={13} /> {n.title}
          </button>
        ))}

        {dirtyCount > 0 && (
          <button
            onClick={() => setValues(defaults())}
            className="w-full flex items-center gap-1.5 mt-4 px-2 py-1.5 rounded-md text-[11px] transition-colors"
            style={{ color: c.faint, border: `1px solid ${c.borderSoft}` }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.sidebarHover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <RotateCcw size={11} /> Reset {dirtyCount} change{dirtyCount > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="max-w-2xl px-6 py-6">
          {settingsSections
            .filter((s) => s.id === active)
            .map((s) => (
              <div key={s.id}>
                <h2 className="text-[18px] font-semibold tracking-tight" style={{ color: c.text }}>
                  {s.title}
                </h2>
                <p className="text-[12px] mb-4" style={{ color: c.muted }}>
                  {s.blurb}
                </p>
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${c.borderSoft}` }}>
                  {s.items.map((item, i) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 px-3.5 py-2.5"
                      style={{
                        backgroundColor: c.panel,
                        borderTop: i === 0 ? "none" : `1px solid ${c.borderSoft}`,
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px]" style={{ color: c.text }}>
                          {item.label}
                          {values[item.id] !== item.def && (
                            <span
                              className="ml-2 px-1 py-0.5 rounded text-[9px]"
                              style={{ backgroundColor: c.chipHover, color: c.muted }}
                            >
                              changed
                            </span>
                          )}
                        </div>
                        {"desc" in item && item.desc && (
                          <div className="text-[11px] mt-0.5" style={{ color: c.muted }}>
                            {item.desc}
                          </div>
                        )}
                      </div>
                      <Control item={item} value={values[item.id]} onChange={(v) => set(item.id, v)} />
                    </div>
                  ))}
                </div>

                {s.id === "perms" && (
                  <p className="text-[11px] mt-3 leading-relaxed" style={{ color: c.dim }}>
                    <span style={{ color: c.muted }}>allow</span> runs silently ·{" "}
                    <span style={{ color: c.muted }}>ask</span> prompts you inline ·{" "}
                    <span style={{ color: c.muted }}>deny</span> blocks the tool entirely. Autopilot mode
                    upgrades every <span style={{ fontFamily: mono }}>ask</span> to{" "}
                    <span style={{ fontFamily: mono }}>allow</span> for the duration of a run.
                  </p>
                )}
              </div>
            ))}

          {active === "mcp" && (
            <div>
              <h2 className="text-[18px] font-semibold tracking-tight" style={{ color: c.text }}>
                Connections
              </h2>
              <p className="text-[12px] mb-4" style={{ color: c.muted }}>
                GitHub unlocks Cloud sandboxes and pull requests.
              </p>
              <div
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl mb-5"
                style={{ backgroundColor: c.panel, border: `1px solid ${gh.connected ? c.borderStrong : c.borderSoft}` }}
              >
                <span
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: c.chip, border: `1px solid ${c.border}` }}
                >
                  <GitHubMark size={16} color={gh.connected ? c.text : c.faint} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium" style={{ color: c.text }}>GitHub</span>
                    {gh.connected && (
                      <span className="rounded-full" style={{ width: 6, height: 6, backgroundColor: c.accent, boxShadow: `0 0 6px ${c.accentSoft}` }} />
                    )}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: c.muted }}>
                    {gh.connected
                      ? `${gh.account} · ${gh.repo}`
                      : "Not connected — Cloud and pull requests are disabled."}
                  </div>
                </div>
                <button
                  onClick={gh.connected ? gh.disconnect : gh.connect}
                  disabled={gh.connecting}
                  className="px-3 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors flex-shrink-0"
                  style={{
                    backgroundColor: gh.connected ? "transparent" : c.accent,
                    border: `1px solid ${gh.connected ? c.border : c.accent}`,
                    color: gh.connected ? c.muted : "#000",
                  }}
                >
                  {gh.connecting ? "Connecting…" : gh.connected ? "Disconnect" : "Connect"}
                </button>
              </div>

              <h2 className="text-[18px] font-semibold tracking-tight" style={{ color: c.text }}>
                MCP servers
              </h2>
              <p className="text-[12px] mb-4" style={{ color: c.muted }}>
                External tool providers Claude can call during a thread.
              </p>
              <div className="flex flex-col gap-2">
                {servers.map((sv) => (
                  <div
                    key={sv.id}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl"
                    style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}
                  >
                    <span
                      className="rounded-full flex-shrink-0"
                      style={{
                        width: 7,
                        height: 7,
                        backgroundColor: sv.connected ? c.accent : c.dim,
                        boxShadow: sv.connected ? `0 0 8px ${c.accentSoft}` : "none",
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px]" style={{ color: c.text, fontFamily: mono }}>
                        {sv.name}
                      </div>
                      <div className="text-[10.5px]" style={{ color: c.dim, fontFamily: mono }}>
                        {sv.transport} · {sv.tools} tools
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setServers((p) => p.map((x) => (x.id === sv.id ? { ...x, connected: !x.connected } : x)))
                      }
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
                      style={{
                        backgroundColor: sv.connected ? "transparent" : c.chip,
                        border: `1px solid ${c.border}`,
                        color: sv.connected ? c.muted : c.text,
                      }}
                    >
                      {sv.connected ? "Disconnect" : "Connect"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {active === "keys" && (
            <div>
              <h2 className="text-[18px] font-semibold tracking-tight" style={{ color: c.text }}>
                Keyboard
              </h2>
              <p className="text-[12px] mb-4" style={{ color: c.muted }}>
                Shortcuts available anywhere in the app.
              </p>
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${c.borderSoft}` }}>
                {keybindings.map((k, i) => (
                  <div
                    key={k.action}
                    className="flex items-center px-3.5 py-2"
                    style={{
                      backgroundColor: c.panel,
                      borderTop: i === 0 ? "none" : `1px solid ${c.borderSoft}`,
                    }}
                  >
                    <span className="text-[12.5px] flex-1" style={{ color: c.text }}>
                      {k.action}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded text-[11px]"
                      style={{ backgroundColor: c.chip, color: c.muted, fontFamily: mono, border: `1px solid ${c.borderSoft}` }}
                    >
                      {k.keys}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
