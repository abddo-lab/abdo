import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Copy, Eye, EyeOff, KeyRound, Loader2, MonitorUp, Play } from "lucide-react";
import { c, font, mono } from "./theme";
import Logo from "./Logo";
import { useAuth, type AuthMethod } from "./auth";

const METHODS: Array<{ id: AuthMethod; label: string; short: string; desc: string; icon: typeof MonitorUp }> = [
  { id: "browser", label: "Browser sign in", short: "Browser", desc: "Open a secure Caret page and pair this desktop app.", icon: MonitorUp },
  { id: "key", label: "API key", short: "API key", desc: "Use a local key from your OS keychain or caret.ai/keys.", icon: KeyRound },
  { id: "demo", label: "Demo workspace", short: "Demo", desc: "Try Caret with a ready-made repo, PRs, agents and usage data.", icon: Play },
];

function MethodIcon({ method }: { method: AuthMethod }) {
  const found = METHODS.find((m) => m.id === method) ?? METHODS[0];
  const Icon = found.icon;
  return <Icon size={14} color={c.text} />;
}

function StatusSteps({ step }: { step: number }) {
  const labels = ["Start", "Pair", "Verify", "Ready"];
  return (
    <div className="flex items-center gap-1.5">
      {labels.map((label, i) => {
        const active = i <= step;
        return (
          <div key={label} className="flex flex-col gap-1 flex-1">
            <span className="h-1 rounded-full transition-colors" style={{ backgroundColor: active ? c.text : c.borderStrong }} />
            <span className="text-[9px]" style={{ color: active ? c.muted : c.dim, fontFamily: mono }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function LoginView() {
  const auth = useAuth();
  const [keyValue, setKeyValue] = useState("caret_sk_live_98a72b819f032e718c");
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const keyRef = useRef<HTMLInputElement>(null);

  const busy = auth.status === "verifying" || auth.status === "success";
  const method = METHODS.find((m) => m.id === auth.method) ?? METHODS[0];

  const submit = () => {
    if (busy) return;
    if (auth.method === "demo") return auth.signInDemo();
    if (auth.method === "key") return auth.signInWithKey(keyValue);
    if (auth.status === "waiting") return auth.approve();
    return auth.startBrowser();
  };

  useEffect(() => {
    if (auth.method === "key") window.setTimeout(() => keyRef.current?.focus(), 40);
  }, [auth.method]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === "INPUT";
      if (e.key === "Escape") {
        if (auth.status !== "idle") auth.cancel();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
        return;
      }
      if (typing || busy) return;
      if (["1", "2", "3"].includes(e.key)) auth.setMethod(METHODS[Number(e.key) - 1].id);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  const copyPairCode = () => {
    navigator.clipboard?.writeText(auth.pairCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const actionLabel =
    auth.status === "success"
      ? "Connected"
      : auth.status === "verifying"
      ? "Verifying..."
      : auth.method === "demo"
      ? "Open demo workspace"
      : auth.method === "key"
      ? "Connect with key"
      : auth.status === "waiting"
      ? "I approved in browser"
      : "Continue in browser";

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden"
      style={{ fontFamily: font, backgroundColor: c.bg, background: "radial-gradient(620px 360px at 50% 12%, rgba(255,255,255,.055), transparent 70%), #000" }}
    >
      <style>{`
        @keyframes loginFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .loginFade { animation: loginFade 240ms cubic-bezier(.16,1,.3,1); }
        input::placeholder { color: ${c.dim}; font-family: ${mono}; }
      `}</style>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
          maskImage: "radial-gradient(520px 380px at 50% 28%, black, transparent 78%)",
          WebkitMaskImage: "radial-gradient(520px 380px at 50% 28%, black, transparent 78%)",
        }}
      />

      <div className="relative loginFade w-full" style={{ maxWidth: 390 }}>
        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-3 rounded-2xl mb-4" style={{ backgroundColor: "rgba(255,255,255,.035)", border: `1px solid ${c.borderStrong}`, boxShadow: "0 16px 42px rgba(0,0,0,.8), inset 0 1px rgba(255,255,255,.08)" }}>
            <Logo size={42} />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: c.text }}>Sign in to Caret</h1>
            <span className="px-1.5 py-0.5 rounded text-[9px]" style={{ backgroundColor: c.chip, border: `1px solid ${c.borderSoft}`, color: c.muted, fontFamily: mono }}>desktop</span>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: c.muted }}>
            Connect your account to sync threads, unlock Cloud, and open pull requests.
          </p>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "rgba(13,13,13,.96)", border: `1px solid ${c.borderStrong}`, boxShadow: "0 28px 80px rgba(0,0,0,.86), inset 0 1px rgba(255,255,255,.05)" }}>
          <div className="p-2" style={{ borderBottom: `1px solid ${c.borderSoft}` }}>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}` }}>
              {METHODS.map((m, i) => {
                const active = auth.method === m.id;
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    onClick={() => auth.setMethod(m.id)}
                    disabled={busy}
                    className="rounded-lg py-1.5 px-1.5 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
                    style={{ backgroundColor: active ? c.chipHover : "transparent", color: active ? c.text : c.muted, border: `1px solid ${active ? c.border : "transparent"}` }}
                  >
                    <Icon size={12} color={active ? c.text : c.faint} />
                    <span className="truncate">{m.short}</span>
                    <span className="hidden sm:inline" style={{ color: c.dim, fontFamily: mono }}>{i + 1}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c.chip, border: `1px solid ${c.border}` }}>
                <MethodIcon method={auth.method} />
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-medium" style={{ color: c.text }}>{method.label}</div>
                <div className="text-[11.5px] mt-0.5 leading-relaxed" style={{ color: c.muted }}>{method.desc}</div>
              </div>
            </div>

            {auth.method === "browser" && (
              <div className="flex flex-col gap-3">
                <StatusSteps step={auth.step} />
                {auth.status === "waiting" ? (
                  <div className="rounded-xl px-3 py-2.5 flex items-center justify-between loginFade" style={{ backgroundColor: c.input, border: `1px solid ${c.borderStrong}` }}>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider" style={{ color: c.faint }}>Pairing code</div>
                      <div className="text-[16px] font-semibold tracking-[0.14em] mt-0.5" style={{ color: c.text, fontFamily: mono }}>{auth.pairCode}</div>
                    </div>
                    <button onClick={copyPairCode} className="px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-1.5" style={{ backgroundColor: c.chip, border: `1px solid ${c.border}`, color: copied ? c.text : c.muted }}>
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl px-3 py-2.5 text-[11.5px]" style={{ backgroundColor: c.input, border: `1px solid ${c.borderSoft}`, color: c.muted }}>
                    A browser window will open at <span style={{ color: c.text, fontFamily: mono }}>caret.ai/auth</span>.
                  </div>
                )}
              </div>
            )}

            {auth.method === "key" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ backgroundColor: c.input, border: `1px solid ${auth.error ? "rgba(255,80,80,.45)" : c.borderStrong}` }}>
                  <KeyRound size={13} color={c.faint} />
                  <input ref={keyRef} type={showKey ? "text" : "password"} value={keyValue} onChange={(e) => setKeyValue(e.target.value)} placeholder="caret_sk_live_..." className="w-full bg-transparent outline-none text-[12.5px]" style={{ color: c.text, fontFamily: mono }} />
                  <button onClick={() => setShowKey((v) => !v)} className="p-1" style={{ color: c.faint }}>
                    {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px]" style={{ color: c.dim }}>Region</span>
                  <div className="flex gap-1">
                    {["us-west", "us-east", "eu-central"].map((r) => (
                      <button key={r} onClick={() => auth.setRegion(r)} className="px-2 py-0.5 rounded text-[10px]" style={{ backgroundColor: auth.region === r ? c.chipHover : "transparent", color: auth.region === r ? c.text : c.dim, fontFamily: mono }}>{r}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {auth.method === "demo" && (
              <div className="rounded-xl p-3 flex items-center gap-3 loginFade" style={{ backgroundColor: c.input, border: `1px solid ${c.borderStrong}` }}>
                <span className="w-10 h-10 rounded-lg flex items-center justify-center font-semibold flex-shrink-0" style={{ backgroundColor: c.chipHover, border: `1px solid ${c.border}`, color: c.text, fontFamily: mono }}>CW</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium" style={{ color: c.text }}>Christina Warren</div>
                  <div className="text-[11px] truncate" style={{ color: c.muted }}>Tailspin Toys · Max plan · seeded workspace</div>
                </div>
                <Check size={14} color={c.accent} />
              </div>
            )}

            {auth.error && <div className="mt-3 rounded-xl px-3 py-2 text-[11px] loginFade" style={{ color: "#f5b0b0", backgroundColor: "rgba(255,60,60,.08)", border: "1px solid rgba(255,80,80,.25)" }}>{auth.error}</div>}
          </div>

          <div className="px-5 py-4 flex flex-col gap-3" style={{ borderTop: `1px solid ${c.borderSoft}`, backgroundColor: "rgba(0,0,0,.35)" }}>
            <button onClick={submit} disabled={busy} className="w-full rounded-xl py-2.5 text-[13px] font-medium flex items-center justify-center gap-2 transition-all" style={{ backgroundColor: busy ? c.chipHover : c.text, color: busy ? c.muted : "#000", border: `1px solid ${busy ? c.border : c.text}` }}>
              {auth.status === "verifying" && <Loader2 size={14} className="animate-spin" />}
              {auth.status === "success" && <Check size={14} />}
              {actionLabel}
              {!busy && <ArrowRight size={14} />}
            </button>
            <div className="flex items-center justify-between text-[11px]" style={{ color: c.muted }}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="sr-only" checked={auth.remember} onChange={(e) => auth.setRemember(e.target.checked)} />
                <span className="rounded flex items-center justify-center" style={{ width: 13, height: 13, backgroundColor: auth.remember ? c.text : "transparent", border: `1px solid ${auth.remember ? c.text : c.dim}` }}>{auth.remember && <Check size={9} color="#000" strokeWidth={3.5} />}</span>
                Keep me signed in
              </label>
              {auth.status !== "idle" && <button onClick={auth.cancel} className="underline" style={{ color: c.faint }}>Reset</button>}
            </div>
          </div>

          <div className="px-5 py-2.5 flex items-center justify-between text-[9.5px]" style={{ borderTop: `1px solid ${c.borderSoft}`, color: c.dim, backgroundColor: "rgba(0,0,0,.45)", fontFamily: mono }}>
            <span>1-3 switch</span><span>enter continue</span><span>esc reset</span>
          </div>
        </div>

        <p className="mt-5 text-center text-[11px]" style={{ color: c.dim }}>
          Need help? <span style={{ color: c.muted }}>caret.ai/support</span>
        </p>
      </div>
    </div>
  );
}