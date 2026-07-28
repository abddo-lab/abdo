import { useEffect, useMemo, useState } from "react";
import { Cpu, Search, Zap, Globe, Key, Plus, ExternalLink, Check, ChevronRight, Activity, ArrowUpRight, Sparkles } from "lucide-react";
import { c, mono } from "./theme";
import {
  fetchModels, getProviders, setDefaultModel, setApiKey, addCustomEndpoint,
  formatContext, formatCost, speedLabel, qualityLabel,
  type AiModel, type AiProviderInfo, type AiProvider,
} from "../services/ai-integrations";

// ─── Provider icons ───
const PROVIDER_ICONS: Record<AiProvider, string> = {
  anthropic: "claude", openai: "gpt", google: "gemini", kimi: "kimi", minimax: "minimax",
  deepseek: "deepseek", zhipu: "zhipu", moonshot: "moonshot", caretx: "caretx", other: "custom",
};

function ModelCard({ model, active, onSelect }: { model: AiModel; active: boolean; onSelect: () => void }) {
  const sp = speedLabel(model.speed);
  const ql = qualityLabel(model.quality);
  const isFree = model.costPer1mInput === 0;
  return (
    <button onClick={onSelect}
      className="w-full text-left rounded-xl p-3 transition-all group"
      style={{
        backgroundColor: active ? "rgba(255,255,255,0.06)" : c.panel,
        border: `1px solid ${active ? c.accent : c.borderSoft}`,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.03)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = c.panel; }}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[18px]">{model.icon}</span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold" style={{ color: c.text }}>{model.displayName}</span>
              {active && <Check size={12} color="#4ade80" />}
            </div>
            <span className="text-[10.5px]" style={{ color: c.muted }}>{model.description}</span>
          </div>
        </div>
        {isFree && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "rgba(74,222,128,.15)", color: "#4ade80" }}>FREE</span>
        )}
      </div>
      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: c.chip, color: c.dim, fontFamily: mono }}>
          ctx {formatContext(model.maxContext)}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: sp.color + "18", color: sp.color }}>
          {sp.label}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: ql.color + "18", color: ql.color }}>
          {ql.label}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: c.chip, color: c.dim, fontFamily: mono }}>
          {formatCost(model.costPer1mInput)}/{formatCost(model.costPer1mOutput)} per 1M
        </span>
        <span className="text-[9px] px-1 py-0.5 rounded capitalize" style={{ backgroundColor: "rgba(255,255,255,0.04)", color: c.faint }}>
          {model.category}
        </span>
      </div>
    </button>
  );
}

function ProviderSection({ provider, activeModel, onSelectModel }: {
  provider: AiProviderInfo; activeModel: string; onSelectModel: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  if (provider.models.length === 0) return null;
  return (
    <div className="mb-4">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl mb-1.5"
        style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = c.panel)}>
        <span className="text-[20px]">{PROVIDER_ICONS[provider.id] ?? "model"}</span>
        <div className="flex-1 text-left">
          <div className="text-[13px] font-semibold" style={{ color: c.text }}>{provider.name}</div>
          <div className="text-[10.5px]" style={{ color: c.muted }}>{provider.description}</div>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: c.chip, color: c.dim }}>{provider.models.length} models</span>
        <ChevronRight size={14} color={c.faint} style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
      </button>
      {expanded && (
        <div className="grid gap-2 pl-2">
          {provider.models.map((m) => (
            <ModelCard key={m.id} model={m} active={activeModel === m.id} onSelect={() => onSelectModel(m.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AiIntegrationsPanel() {
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [activeModel, setActiveModel] = useState("creator-mini");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [providerFilter, setProviderFilter] = useState<AiProvider | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [customUrl, setCustomUrl] = useState("");
  const [customName, setCustomName] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const provs = await getProviders();
      setProviders(provs);
      // Load saved default model
      try {
        const { getIntegrationSettings } = await import("../services/ai-integrations");
        const s = await getIntegrationSettings();
        setActiveModel(s.defaultModel);
        setApiKeys(s.apiKeys);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const filteredProviders = useMemo(() => {
    let p = providers;
    if (providerFilter) p = p.filter((x) => x.id === providerFilter);
    if (search) {
      const q = search.toLowerCase();
      p = p.map((prov) => ({
        ...prov,
        models: prov.models.filter((m) =>
          m.displayName.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q)
        ),
      })).filter((prov) => prov.models.length > 0);
    }
    return p;
  }, [providers, search, providerFilter]);

  const activeModelInfo = useMemo(() => {
    for (const p of providers) {
      const m = p.models.find((x) => x.id === activeModel);
      if (m) return m;
    }
    return null;
  }, [providers, activeModel]);

  const handleSelect = async (id: string) => {
    setActiveModel(id);
    try { await setDefaultModel(id); } catch {}
  };

  const handleSaveKey = async (provider: string) => {
    const key = keyInputs[provider] || "";
    await setApiKey(provider, key);
    setApiKeys((prev) => ({ ...prev, [provider]: key }));
    setKeyInputs((prev) => { const n = { ...prev }; delete n[provider]; return n; });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAddEndpoint = async () => {
    if (!customUrl || !customName) return;
    await addCustomEndpoint(customName, customUrl, customKey);
    setCustomUrl(""); setCustomName(""); setCustomKey(""); setShowCustom(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const totalModels = providers.reduce((s, p) => s + p.models.length, 0);

  return (
    <div className="flex-1 h-full overflow-y-auto" style={{ backgroundColor: c.bg }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <Cpu size={18} color={c.accent} />
          </div>
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight" style={{ color: c.text }}>AI Integrations</h1>
            <p className="text-[12px]" style={{ color: c.muted }}>Select your default model and manage API keys</p>
          </div>
          {saved && (
            <span className="ml-auto text-[11px] px-2 py-1 rounded-lg" style={{ backgroundColor: "rgba(74,222,128,.12)", color: "#4ade80" }}>
              Saved
            </span>
          )}
        </div>

        {/* Active model card */}
        {activeModelInfo && (
          <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderStrong}` }}>
            <div className="flex items-center gap-3">
              <span className="text-[28px]">{activeModelInfo.icon}</span>
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wider" style={{ color: c.faint }}>Default Model</div>
                <div className="text-[16px] font-semibold" style={{ color: c.text }}>{activeModelInfo.displayName}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: c.chip, color: c.dim, fontFamily: mono }}>ctx {formatContext(activeModelInfo.maxContext)}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(74,222,128,.1)", color: "#4ade80" }}>{formatCost(activeModelInfo.costPer1mInput)}/in · {formatCost(activeModelInfo.costPer1mOutput)}/out per 1M</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider" style={{ color: c.faint }}>Provider</div>
                <div className="text-[14px] font-medium" style={{ color: c.text }}>{PROVIDER_ICONS[activeModelInfo.provider]} {activeModelInfo.provider}</div>
              </div>
            </div>
          </div>
        )}

        {/* Search + filters */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-xl" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}>
            <Search size={13} color={c.dim} />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${totalModels} models...`}
              className="flex-1 bg-transparent text-[12px] outline-none" style={{ color: c.text }} />
          </div>
        </div>

        {/* Provider filter chips */}
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
          <button onClick={() => setProviderFilter(null)}
            className="text-[10px] px-2 py-1 rounded-lg whitespace-nowrap font-medium"
            style={{ backgroundColor: !providerFilter ? c.chipHover : c.chip, color: !providerFilter ? c.text : c.muted, border: `1px solid ${c.borderSoft}` }}>
            All ({totalModels})
          </button>
          {providers.filter((p) => p.models.length > 0).map((p) => (
            <button key={p.id} onClick={() => setProviderFilter(providerFilter === p.id ? null : p.id)}
              className="text-[10px] px-2 py-1 rounded-lg whitespace-nowrap font-medium"
              style={{ backgroundColor: providerFilter === p.id ? c.chipHover : c.chip, color: providerFilter === p.id ? c.text : c.muted, border: `1px solid ${c.borderSoft}` }}>
              {PROVIDER_ICONS[p.id]} {p.name} ({p.models.length})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-[12.5px]" style={{ color: c.dim }}>Loading models…</div>
        ) : (
          <>
            {/* Model list by provider */}
            {filteredProviders.map((prov) => (
              <ProviderSection key={prov.id} provider={prov} activeModel={activeModel} onSelectModel={handleSelect} />
            ))}
            {filteredProviders.length === 0 && (
              <div className="text-center py-16">
                <div className="text-[14px] font-medium mb-2" style={{ color: c.text }}>No models found</div>
                <div className="text-[12px]" style={{ color: c.muted }}>Try a different search or filter</div>
              </div>
            )}

            {/* API Keys section */}
            <div className="mt-8 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Key size={14} color={c.faint} />
                <span className="text-[13px] font-semibold" style={{ color: c.text }}>API Keys</span>
                <span className="text-[10px]" style={{ color: c.dim }}>(optional — uses built-in key by default)</span>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
                {providers.filter((p) => p.models.length > 0 && p.id !== "other").map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3"
                    style={{ borderTop: i > 0 ? `1px solid ${c.borderSoft}` : undefined }}>
                    <span className="text-[16px]">{PROVIDER_ICONS[p.id]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium" style={{ color: c.text }}>{p.name}</div>
                      {apiKeys[p.id] && (
                        <div className="text-[10px]" style={{ color: c.dim, fontFamily: mono }}>
                          {showKeys[p.id] ? apiKeys[p.id] : "••••••••" + apiKeys[p.id].slice(-4)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        value={keyInputs[p.id] ?? ""}
                        onChange={(e) => setKeyInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder={apiKeys[p.id] ? "Update key…" : "API key…"}
                        type={showKeys[p.id] ? "text" : "password"}
                        className="w-40 bg-transparent text-[11px] px-2 py-1 rounded-lg outline-none"
                        style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}`, color: c.text, fontFamily: mono }}
                      />
                      <button onClick={() => setShowKeys((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                        className="text-[9px] px-1.5 py-1 rounded" style={{ color: c.dim }}>
                        {showKeys[p.id] ? "Hide" : "Show"}
                      </button>
                      <button onClick={() => handleSaveKey(p.id)}
                        className="text-[10px] px-2 py-1 rounded-lg font-medium"
                        style={{ backgroundColor: c.chipHover, color: c.text, border: `1px solid ${c.borderSoft}` }}>
                        Save
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom endpoint */}
            <div className="mt-6 mb-10">
              <button onClick={() => setShowCustom(!showCustom)}
                className="flex items-center gap-2 text-[12px] font-medium mb-3"
                style={{ color: c.muted }}>
                <Plus size={13} /> Add custom endpoint
              </button>
              {showCustom && (
                <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
                  <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Name (e.g. My Llama)"
                    className="w-full bg-transparent text-[12px] px-3 py-2 rounded-lg outline-none"
                    style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}`, color: c.text }} />
                  <input value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="Base URL (e.g. http://localhost:11434/v1)"
                    className="w-full bg-transparent text-[12px] px-3 py-2 rounded-lg outline-none"
                    style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}`, color: c.text, fontFamily: mono }} />
                  <input value={customKey} onChange={(e) => setCustomKey(e.target.value)} placeholder="API key (optional)"
                    className="w-full bg-transparent text-[12px] px-3 py-2 rounded-lg outline-none"
                    style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}`, color: c.text, fontFamily: mono }} />
                  <button onClick={handleAddEndpoint} disabled={!customUrl || !customName}
                    className="text-[11px] px-3 py-1.5 rounded-lg font-medium"
                    style={{ backgroundColor: customUrl && customName ? c.accent : c.chip, color: customUrl && customName ? "#000" : c.dim, cursor: customUrl && customName ? "pointer" : "default" }}>
                    Add Endpoint
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
