import { useState, useEffect } from "react";
import { Users, Shield, Check, Crown, Zap, Search, Plus } from "lucide-react";
import { c, mono } from "./theme";
import { PLANS, getAllAccounts, adminSetPlan, adminAddCredit, adminUpdateAccount, type UserAccount, type PlanTier } from "../services/plans";

export default function AdminPanel() {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState(false);
  const [creditAmount, setCreditAmount] = useState("10");

  useEffect(() => { getAllAccounts().then(setAccounts); }, []);

  const filtered = accounts.filter((a) => {
    if (!search) return true;
    return a.email.toLowerCase().includes(search.toLowerCase()) || a.githubLogin.toLowerCase().includes(search.toLowerCase());
  });

  const sel = accounts.find((a) => a.id === selected);

  const updatePlan = async (email: string, plan: PlanTier) => {
    await adminSetPlan(email, plan);
    setAccounts(await getAllAccounts());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const addCredit = async (email: string) => {
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) return;
    await adminAddCredit(email, amount);
    setAccounts(await getAllAccounts());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const toggleAdmin = async (email: string) => {
    const account = accounts.find((a) => a.email === email);
    if (!account) return;
    await adminUpdateAccount(email, { isAdmin: !account.isAdmin });
    setAccounts(await getAllAccounts());
  };

  const tierColors: Record<PlanTier, string> = { free: c.muted, pro: c.accent, max: "#ffc832" };
  const tierIcons: Record<PlanTier, typeof Crown> = { free: Shield, pro: Zap, max: Crown };

  return (
    <div className="flex-1 h-full flex min-h-0" style={{ backgroundColor: c.bg }}>
      {/* Left: user list */}
      <div className="w-80 flex-shrink-0 py-5 px-3 overflow-y-auto" style={{ borderRight: `1px solid ${c.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: c.faint }}>Admin Panel</div>
          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: c.panel, color: c.dim, border: `1px solid ${c.borderSoft}` }}>Admin Only</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-lg p-2" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <div className="text-[9px] uppercase" style={{ color: c.faint }}>Users</div>
            <div className="text-[16px] font-semibold" style={{ color: c.text }}>{accounts.length}</div>
          </div>
          <div className="rounded-lg p-2" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
            <div className="text-[9px] uppercase" style={{ color: c.faint }}>Revenue</div>
            <div className="text-[16px] font-semibold" style={{ color: c.text }}>${accounts.reduce((s, a) => s + PLANS[a.plan].monthlyPrice, 0)}</div>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-1.5 px-2 rounded-lg mb-3" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}>
          <Search size={11} color={c.dim} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="w-full bg-transparent text-[11px] py-1.5 outline-none" style={{ color: c.text }} />
        </div>

        {/* User list */}
        {filtered.map((a) => {
          const Icon = tierIcons[a.plan];
          return (
            <button key={a.id} onClick={() => setSelected(a.id)} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left mb-1"
              style={{ backgroundColor: selected === a.id ? c.sidebarActive : "transparent", color: selected === a.id ? c.text : c.muted }}
              onMouseEnter={(e) => selected !== a.id && (e.currentTarget.style.backgroundColor = c.sidebarHover)}
              onMouseLeave={(e) => selected !== a.id && (e.currentTarget.style.backgroundColor = "transparent")}>
              <Icon size={12} color={tierColors[a.plan]} />
              <span className="flex-1 truncate text-[11px]">{a.email}</span>
              <span className="text-[8px] px-1 py-0.5 rounded" style={{ backgroundColor: `${tierColors[a.plan]}15`, color: tierColors[a.plan], border: `1px solid ${tierColors[a.plan]}30` }}>{a.plan}</span>
              {a.isAdmin && <span className="text-[8px]" style={{ color: "#ffc832" }}>⭐</span>}
            </button>
          );
        })}
      </div>

      {/* Right: user details */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {sel ? (
          <div className="max-w-xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: c.chip, border: `1px solid ${c.border}` }}>
                {(() => { const Icon = tierIcons[sel.plan]; return <Icon size={18} color={tierColors[sel.plan]} />; })()}
              </span>
              <div>
                <h2 className="text-[16px] font-semibold" style={{ color: c.text }}>{sel.email}</h2>
                <div className="text-[11px]" style={{ color: c.muted }}>@{sel.githubLogin} · Joined {new Date(sel.createdAt).toLocaleDateString()}</div>
              </div>
              <span className="ml-auto text-[10px] px-2 py-1 rounded" style={{ backgroundColor: `${tierColors[sel.plan]}15`, color: tierColors[sel.plan], border: `1px solid ${tierColors[sel.plan]}30`, fontFamily: mono }}>
                {PLANS[sel.plan].name} Plan
              </span>
            </div>

            {/* Plan selection */}
            <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: c.faint }}>Change Plan</div>
              <div className="grid grid-cols-3 gap-2">
                {(["free", "pro", "max"] as PlanTier[]).map((tier) => {
                  const plan = PLANS[tier];
                  const active = sel.plan === tier;
                  const Icon = tierIcons[tier];
                  return (
                    <button key={tier} onClick={() => updatePlan(sel.email, tier)} className="rounded-lg p-3 text-left transition-colors"
                      style={{ backgroundColor: active ? `${tierColors[tier]}15` : c.chip, border: `1px solid ${active ? tierColors[tier] : c.border}`, opacity: active ? 1 : 0.7 }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon size={12} color={tierColors[tier]} />
                        <span className="text-[12px] font-medium" style={{ color: c.text }}>{plan.name}</span>
                      </div>
                      <div className="text-[10px]" style={{ color: c.muted }}>${plan.monthlyPrice}/mo</div>
                      <div className="text-[9px] mt-1" style={{ color: c.dim }}>{plan.weeklyLimit}/week · {plan.sessionLimit}/5h</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Credits */}
            <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: c.faint }}>Add Credits</div>
              <div className="flex items-center gap-2">
                <input type="number" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} className="w-24 px-2 py-1.5 rounded text-[12px] outline-none" style={{ backgroundColor: c.input, border: `1px solid ${c.border}`, color: c.text, fontFamily: mono }} />
                <button onClick={() => addCredit(sel.email)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium" style={{ backgroundColor: c.accent, color: "#000" }}>
                  <Plus size={11} /> Add $
                </button>
                {saved && <span className="text-[10px]" style={{ color: "#8f8f8f" }}><Check size={10} /> Saved</span>}
              </div>
            </div>

            {/* Usage */}
            <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: c.faint }}>Current Usage</div>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div><span style={{ color: c.muted }}>Session credit:</span> <span style={{ color: c.text, fontFamily: mono }}>${sel.sessionCredit.toFixed(2)}</span></div>
                <div><span style={{ color: c.muted }}>Weekly credit:</span> <span style={{ color: c.text, fontFamily: mono }}>${sel.weeklyCredit.toFixed(2)}</span></div>
                <div><span style={{ color: c.muted }}>Monthly credit:</span> <span style={{ color: c.text, fontFamily: mono }}>${sel.monthlyCredit.toFixed(2)}</span></div>
                <div><span style={{ color: c.muted }}>Workflow instances:</span> <span style={{ color: c.text, fontFamily: mono }}>{sel.workflowInstancesActive}</span></div>
                <div><span style={{ color: c.muted }}>AgentMail sent:</span> <span style={{ color: c.text, fontFamily: mono }}>{sel.agentMailUsed}</span></div>
                <div><span style={{ color: c.muted }}>SMS sent:</span> <span style={{ color: c.text, fontFamily: mono }}>{sel.agentPhoneSmsUsed}</span></div>
              </div>
            </div>

            {/* Permissions */}
            <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: c.faint }}>Permissions</div>
              <div className="flex items-center gap-3">
                <button onClick={() => toggleAdmin(sel.email)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px]"
                  style={{ backgroundColor: sel.isAdmin ? "rgba(255,200,50,.1)" : c.chip, border: `1px solid ${sel.isAdmin ? "rgba(255,200,50,.3)" : c.border}`, color: sel.isAdmin ? "#ffc832" : c.muted }}>
                  {sel.isAdmin ? "⭐ Admin" : "Make Admin"}
                </button>
              </div>
            </div>

            {/* Plan features */}
            <div className="rounded-xl p-4" style={{ backgroundColor: c.panel, border: `1px solid ${c.borderSoft}` }}>
              <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: c.faint }}>Plan Features</div>
              <div className="flex flex-wrap gap-1.5">
                {PLANS[sel.plan].features.map((f, i) => (
                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: c.chip, color: c.muted, border: `1px solid ${c.borderSoft}` }}>{f}</span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Users size={24} className="mx-auto mb-2" style={{ color: c.dim }} />
              <div className="text-[14px] font-medium mb-1" style={{ color: c.text }}>Admin Panel</div>
              <div className="text-[12px]" style={{ color: c.muted }}>Select a user to manage their plan, credits, and permissions.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
