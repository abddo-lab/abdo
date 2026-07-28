import { useState, useEffect } from "react";
import { Keyboard, Plug, Shield, SlidersHorizontal, Sparkles, Save, Check, AlertCircle, Globe, Server, DollarSign, type LucideIcon } from "lucide-react";
import { c, mono } from "./theme";
import { keybindings, mcpServers, settingsSections, type SettingControl, type McpServer } from "./workData";
import { useGitHub, GitHubMark } from "./github";

import { loadConfig, updateConfig, validateConfig, type AppConfig } from "../services/config";
import { getTrainingOptIn, setTrainingOptIn, connectBrowser, disconnectBrowser, isConnected } from "../services/my-browser";

const sectionIcons: Record<string, LucideIcon> = { sliders: SlidersHorizontal, sparkles: Sparkles, shield: Shield };

type Values = Record<string, boolean | string | number>;
function defaults(): Values { const v: Values = {}; settingsSections.forEach((s) => s.items.forEach((i) => (v[i.id] = i.def))); return v; }

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button onClick={() => onChange(!on)} className="relative rounded-full flex-shrink-0" style={{ width: 32, height: 18, backgroundColor: on ? c.accent : c.chipHover, border: `1px solid ${on ? c.accent : c.border}` }}>
    <span className="absolute rounded-full transition-all" style={{ width: 14, height: 14, top: 1, left: on ? 15 : 1, backgroundColor: on ? "#000" : c.muted }} />
  </button>;
}
function Segmented({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return <div className="flex gap-0.5 p-0.5 rounded-lg flex-shrink-0" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}>
    {options.map((o) => <button key={o} onClick={() => onChange(o)} className="px-2 py-0.5 rounded-md text-[10.5px]" style={{ backgroundColor: value === o ? c.chipHover : "transparent", color: value === o ? c.text : c.muted }}>{o}</button>)}
  </div>;
}
function Control({ item, value, onChange }: { item: SettingControl; value: boolean | string | number; onChange: (v: boolean | string | number) => void }) {
  if (item.kind === "toggle") return <Toggle on={value as boolean} onChange={onChange} />;
  if (item.kind === "select") return <Segmented options={item.options} value={value as string} onChange={onChange} />;
  return <Segmented options={["allow", "ask", "deny"]} value={value as string} onChange={onChange} />;
}

function ConfigField({ label, value, onChange, type = "text", placeholder, description }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; description?: string }) {
  return (
    <div className="mb-3">
      <label className="text-[11px] font-medium block mb-1" style={{ color: c.text }}>{label}</label>
      {description && <p className="text-[10px] mb-1.5" style={{ color: c.dim }}>{description}</p>}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={{ backgroundColor: c.input, border: `1px solid ${c.border}`, color: c.text, fontFamily: mono }} />
    </div>
  );
}

export default function SettingsPanel() {
  const [values, setValues] = useState<Values>(defaults);
  const [servers, setServers] = useState<McpServer[]>(mcpServers);
  const gh = useGitHub();
  const [active, setActive] = useState("general");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [configErrors, setConfigErrors] = useState<string[]>([]);

  useEffect(() => { loadConfig().then(setConfig); }, []);

  const set = (id: string, v: boolean | string | number) => setValues((p) => ({ ...p, [id]: v }));

  const saveConfig = async () => {
    if (!config) return;
    const validation = validateConfig(config);
    setConfigErrors(validation.errors);
    if (!validation.valid) return;
    await updateConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const navItems = [
    ...settingsSections.map((s) => ({ id: s.id, title: s.title, icon: sectionIcons[s.icon] })),
    { id: "api", title: "API & Models", icon: Server },
    { id: "domains", title: "Domains & Deploy", icon: Globe },
    { id: "billing", title: "Billing & Limits", icon: DollarSign },
    { id: "browser", title: "My Browser", icon: Globe },
    { id: "mcp", title: "Connections", icon: Plug },
    { id: "keys", title: "Keyboard", icon: Keyboard },
  ];

  return (
    <div className="flex-1 h-full flex min-h-0" style={{ backgroundColor: c.bg }}>
      <div className="w-48 flex-shrink-0 py-5 px-3 overflow-y-auto" style={{ borderRight: `1px solid ${c.border}` }}>
        <div className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-2" style={{ color: c.faint }}>Settings</div>
        {navItems.map((n) => <button key={n.id} onClick={() => setActive(n.id)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12.5px] text-left mb-0.5"
          style={{ backgroundColor: active === n.id ? c.sidebarActive : "transparent", color: active === n.id ? c.text : c.muted }}>
          <n.icon size={13} /> {n.title}
        </button>)}
      </div>

      <div className="flex-1 overflow-y-auto min-w-0"><div className="max-w-2xl px-6 py-6">
        {/* General settings */}
        {settingsSections.filter((s) => s.id === active).map((s) => <div key={s.id}>
          <h2 className="text-[18px] font-semibold tracking-tight" style={{ color: c.text }}>{s.title}</h2>
          <p className="text-[12px] mb-4" style={{ color: c.muted }}>{s.blurb}</p>
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${c.borderSoft}` }}>
            {s.items.map((item, i) => <div key={item.id} className="flex items-center gap-4 px-3.5 py-2.5" style={{ backgroundColor: c.panel, borderTop: i === 0 ? "none" : `1px solid ${c.borderSoft}` }}>
              <div className="flex-1 min-w-0"><div className="text-[12.5px]" style={{ color: c.text }}>{item.label}</div>{"desc" in item && item.desc && <div className="text-[11px] mt-0.5" style={{ color: c.muted }}>{item.desc}</div>}</div>
              <Control item={item} value={values[item.id]} onChange={(v) => set(item.id, v)} />
            </div>)}
          </div>
        </div>)}

        {/* API & Models */}
        {active === "api" && config && <div>
          <h2 className="text-[18px] font-semibold tracking-tight" style={{ color: c.text }}>API & Models</h2>
          <p className="text-[12px] mb-4" style={{ color: c.muted }}>Configure the model API endpoint and keys.</p>
          <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <ConfigField label="API Base URL" value={config.modelApi.baseUrl} onChange={(v) => setConfig({ ...config, modelApi: { ...config.modelApi, baseUrl: v } })} placeholder="http://crate.ftp.sh/v1" description="OpenAI-compatible API endpoint" />
            <ConfigField label="Service Key" value={config.modelApi.serviceKey} onChange={(v) => setConfig({ ...config, modelApi: { ...config.modelApi, serviceKey: v } })} type="password" placeholder="mr-..." description="API key for the model service" />
            <ConfigField label="Default Model" value={config.modelApi.defaultModel} onChange={(v) => setConfig({ ...config, modelApi: { ...config.modelApi, defaultModel: v } })} placeholder="creator-mini" />
          </div>
          <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <h3 className="text-[13px] font-medium mb-3" style={{ color: c.text }}>GitHub OAuth</h3>
            <ConfigField label="Client ID" value={config.github.clientId} onChange={(v) => setConfig({ ...config, github: { ...config.github, clientId: v } })} placeholder="Iv1..." description="GitHub OAuth App client ID" />
            <ConfigField label="Client Secret" value={config.github.clientSecret} onChange={(v) => setConfig({ ...config, github: { ...config.github, clientSecret: v } })} type="password" placeholder="secret..." description="GitHub OAuth App client secret" />
          </div>
        </div>}

        {/* Domains & Deploy */}
        {active === "domains" && config && <div>
          <h2 className="text-[18px] font-semibold tracking-tight" style={{ color: c.text }}>Domains & Deploy</h2>
          <p className="text-[12px] mb-4" style={{ color: c.muted }}>Configure FreeDNS domains for deploy previews and web connections.</p>
          <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <h3 className="text-[13px] font-medium mb-3" style={{ color: c.text }}>FreeDNS (afraid.org)</h3>
            <ConfigField label="API Token" value={config.freedns.token} onChange={(v) => setConfig({ ...config, freedns: { ...config.freedns, token: v } })} type="password" placeholder="your-freedns-token" description="Token from afraid.org for subdomain updates" />
            <div className="mt-3">
              <div className="text-[11px] font-medium mb-2" style={{ color: c.text }}>Available Domains</div>
              {config.freedns.domains.map((d, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg mb-1.5" style={{ backgroundColor: c.chip, border: `1px solid ${c.borderSoft}` }}>
                  <Globe size={12} color={c.muted} />
                  <span className="text-[12px] font-medium" style={{ color: c.text, fontFamily: mono }}>{d.domain}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(255,255,255,.06)", color: c.dim }}>{d.type}</span>
                  <span className="text-[10px] ml-auto" style={{ color: c.muted }}>{d.description}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <h3 className="text-[13px] font-medium mb-3" style={{ color: c.text }}>Daytona Sandbox</h3>
            <ConfigField label="API Key" value={config.daytona.apiKey} onChange={(v) => setConfig({ ...config, daytona: { ...config.daytona, apiKey: v } })} type="password" placeholder="daytona-..." description="Daytona API key for sandbox creation" />
            <ConfigField label="API URL" value={config.daytona.apiUrl} onChange={(v) => setConfig({ ...config, daytona: { ...config.daytona, apiUrl: v } })} placeholder="https://app.daytona.io/api" />
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[11px]" style={{ color: c.muted }}>Pricing:</span>
              <span className="text-[12px] font-medium" style={{ color: c.text, fontFamily: mono }}>${config.daytona.pricingPerHour}/hour</span>
            </div>
          </div>
        </div>}

        {/* Billing & Limits */}
        {active === "billing" && config && <div>
          <h2 className="text-[18px] font-semibold tracking-tight" style={{ color: c.text }}>Billing & Limits</h2>
          <p className="text-[12px] mb-4" style={{ color: c.muted }}>Configure usage limits and budget controls.</p>
          <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <ConfigField label="Daily Budget (USD)" value={config.limits.dailyBudgetUsd.toString()} onChange={(v) => setConfig({ ...config, limits: { ...config.limits, dailyBudgetUsd: parseFloat(v) || 0 } })} type="number" placeholder="5" description="Maximum daily spend per user" />
            <ConfigField label="Max Tokens per Request" value={config.limits.maxTokensPerRequest.toString()} onChange={(v) => setConfig({ ...config, limits: { ...config.limits, maxTokensPerRequest: parseInt(v) || 0 } })} type="number" placeholder="32768" />
            <ConfigField label="Max Concurrent Agents" value={config.limits.maxConcurrentAgents.toString()} onChange={(v) => setConfig({ ...config, limits: { ...config.limits, maxConcurrentAgents: parseInt(v) || 0 } })} type="number" placeholder="4" />
            <ConfigField label="Max Background Tasks" value={config.limits.maxBackgroundTasks.toString()} onChange={(v) => setConfig({ ...config, limits: { ...config.limits, maxBackgroundTasks: parseInt(v) || 0 } })} type="number" placeholder="10" />
            <ConfigField label="Sandbox Max Hours" value={config.limits.sandboxMaxHours.toString()} onChange={(v) => setConfig({ ...config, limits: { ...config.limits, sandboxMaxHours: parseInt(v) || 0 } })} type="number" placeholder="24" description="Auto-stop sandboxes after this many hours" />
          </div>
        </div>}

        {/* Connections */}
        {active === "mcp" && <div>
          <h2 className="text-[18px] font-semibold tracking-tight" style={{ color: c.text }}>Connections</h2>
          <p className="text-[12px] mb-4" style={{ color: c.muted }}>Connect external services.</p>
          <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl mb-5" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.chip, border: `1px solid ${c.border}` }}><GitHubMark size={16} color={c.text} /></span>
            <div className="flex-1"><span className="text-[13px] font-medium" style={{ color: c.text }}>GitHub</span><div className="text-[11px] mt-0.5" style={{ color: c.muted }}>{gh.user?.login} · {gh.selectedRepo}</div></div>
          </div>
          <div className="flex flex-col gap-2">
            {servers.map((sv) => <div key={sv.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
              <span className="text-[18px]">{sv.icon}</span>
              <div className="flex-1"><span className="text-[13px] font-medium" style={{ color: c.text }}>{sv.name}</span><div className="text-[11px] mt-0.5" style={{ color: c.muted }}>{sv.desc}</div></div>
              <button onClick={() => setServers((p) => p.map((x) => x.id === sv.id ? { ...x, connected: !x.connected } : x))} className="px-2.5 py-1 rounded-lg text-[11px]" style={{ backgroundColor: sv.connected ? "transparent" : c.chip, border: `1px solid ${c.border}`, color: sv.connected ? c.muted : c.text }}>
                {sv.connected ? "Disconnect" : "Connect"}
              </button>
            </div>)}
          </div>
        </div>}

        {/* My Browser */}
        {active === "browser" && <div>
          <h2 className="text-[18px] font-semibold tracking-tight" style={{ color: c.text }}>My Browser</h2>
          <p className="text-[12px] mb-4" style={{ color: c.muted }}>AI-powered browser automation. Install the extension, connect, and let the agent control your browser.</p>

          <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <div className="flex items-center gap-3 mb-3">
              <Globe size={16} color={c.text} />
              <div className="flex-1">
                <div className="text-[13px] font-medium" style={{ color: c.text }}>Browser Extension</div>
                <div className="text-[11px]" style={{ color: c.muted }}>Chrome, Brave, Edge, Opera, Firefox</div>
              </div>
              <button onClick={() => isConnected() ? disconnectBrowser() : connectBrowser()}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium"
                style={{ backgroundColor: isConnected() ? "transparent" : c.accent, border: `1px solid ${isConnected() ? c.border : c.accent}`, color: isConnected() ? c.muted : "#000" }}>
                {isConnected() ? "Disconnect" : "Connect"}
              </button>
            </div>
            <div className="text-[10px]" style={{ color: c.dim, fontFamily: mono }}>
              1. Install the Caret Agent Browser extension from your browser store<br />
              2. Click Connect above<br />
              3. Tell the agent to "use my browser" in chat
            </div>
          </div>

          {/* Gemini Vision */}
          {config && <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: c.faint }}>Gemini Vision (for screenshots)</div>
            <ConfigField label="Gemini API Key" value={config.gemini?.apiKey ?? ""}
              onChange={(v) => setConfig({ ...config, gemini: { ...config.gemini, apiKey: v, apiUrl: config.gemini?.apiUrl ?? "", model: config.gemini?.model ?? "gemini-2.5-flash" } })}
              type="password" placeholder="AIza..." description="Google AI API key for vision analysis" />
          </div>}

          {/* Training Opt-In */}
          <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[13px] font-medium" style={{ color: c.text }}>Use My Browser to Train AI Models</div>
                <div className="text-[11px]" style={{ color: c.muted }}>When enabled, your browser interactions help improve CAI. You receive <span style={{ fontFamily: mono, color: c.text }}>$0.01</span> per request added to your balance.</div>
              </div>
              <button onClick={async () => {
                const opt = await getTrainingOptIn("current");
                await setTrainingOptIn("current", !opt.enabled);
              }}
                className="relative rounded-full flex-shrink-0"
                style={{ width: 32, height: 18, backgroundColor: c.chipHover, border: `1px solid ${c.border}` }}>
                <span className="absolute rounded-full transition-all" style={{ width: 14, height: 14, top: 1, left: 1, backgroundColor: c.muted }} />
              </button>
            </div>
            <div className="text-[10px] mt-2" style={{ color: c.dim }}>
              Earnings are added to your account balance and can be used for chat, workflows, and automations.
            </div>
          </div>
        </div>}

        {/* Keyboard */}
        {active === "keys" && <div>
          <h2 className="text-[18px] font-semibold tracking-tight" style={{ color: c.text }}>Keyboard</h2>
          <div className="rounded-xl overflow-hidden mt-4" style={{ border: `1px solid ${c.borderSoft}` }}>
            {keybindings.map((k, i) => <div key={k.action} className="flex items-center px-3.5 py-2" style={{ backgroundColor: c.panel, borderTop: i === 0 ? "none" : `1px solid ${c.borderSoft}` }}>
              <span className="text-[12.5px] flex-1" style={{ color: c.text }}>{k.action}</span>
              <span className="px-2 py-0.5 rounded text-[11px]" style={{ backgroundColor: c.chip, color: c.muted, fontFamily: mono }}>{k.keys}</span>
            </div>)}
          </div>
        </div>}

        {/* Save button + errors */}
        {config && active !== "keys" && active !== "mcp" && !settingsSections.some((s) => s.id === active) && (
          <div className="mt-4">
            {configErrors.length > 0 && (
              <div className="rounded-lg px-3 py-2 mb-3" style={{ backgroundColor: "rgba(255,60,60,.08)", border: "1px solid rgba(255,80,80,.25)" }}>
                {configErrors.map((e, i) => <div key={i} className="flex items-center gap-2 text-[11px]" style={{ color: "#f5b0b0" }}><AlertCircle size={11} /> {e}</div>)}
              </div>
            )}
            <button onClick={saveConfig} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium" style={{ backgroundColor: saved ? "rgba(60,255,60,.1)" : c.accent, color: saved ? "#8f8f8f" : "#000", border: `1px solid ${saved ? "rgba(60,255,60,.3)" : c.accent}` }}>
              {saved ? <><Check size={12} /> Saved</> : <><Save size={12} /> Save Configuration</>}
            </button>
          </div>
        )}
      </div></div>
    </div>
  );
}
