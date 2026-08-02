import { useEffect, useState } from "react";
import { cn } from "../utils/cn";
import { Icon, type IconName } from "../icons";
import { shortcuts } from "../data";
import { Badge, Btn, Progress } from "./ui";
import * as api from "../api";
import NodesPanel from "./NodesPanel";

export type SettingsTab = "general" | "devices" | "mcp" | "subagents" | "usage" | "shortcuts" | "nodes";

interface Props {
  onToast: (m: string) => void;
  initialTab?: SettingsTab;
  onLogout?: () => void;
  user?: any;
  plan?: any;
  billing?: any;
  sandbox?: any;
  threads?: any[];
}

const NAV: { id: SettingsTab; label: string; icon: IconName }[] = [
  { id: "general",   label: "General",        icon: "settings"   },
  { id: "devices",   label: "Devices",         icon: "phone"      },
  { id: "mcp",       label: "MCP Servers",     icon: "server"     },
  { id: "subagents", label: "Subagents",       icon: "agentBadge" },
  { id: "usage",     label: "Usage & Billing", icon: "gauge"      },
  { id: "shortcuts", label: "Shortcuts",       icon: "keyboard"   },
];

/* ── QR (real, generated locally) ─────────────────────────────────────────── */
import QRCode from "qrcode";

function QR({ url, size = 128 }: { url: string; size?: number }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: size * 4 }).then(setSrc).catch(() => {});
  }, [url, size]);
  if (!src) {
    return (
      <div className="flex items-center justify-center rounded-2xl bg-white" style={{ width: size, height: size }}>
        <Icon name="spinner" size={16} className="a-spin text-[var(--text)]" />
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-white p-3 shadow-[var(--shadow-md)] ring-1 ring-[var(--border-2)]">
      <img src={src} width={size} height={size} alt="Pairing QR" />
    </div>
  );
}

/* ── Shared primitives ───────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: string }) {
  return (
    <p className="pb-2 text-[10.5px] font-bold uppercase tracking-[0.09em] text-[var(--faint)]">
      {children}
    </p>
  );
}

function InfoBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel-2)] px-4 py-2.5">
      {children}
    </div>
  );
}

function SW({
  on, onChange,
}: { on: boolean; onChange: () => void }) {
  return (
    <button
      role="switch" aria-checked={on} onClick={onChange}
      className={cn(
        "relative h-[22px] w-10 shrink-0 rounded-full transition-colors duration-200",
        on ? "bg-[var(--text)]" : "bg-[var(--border-2)]",
      )}
    >
      <span className={cn(
        "absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all duration-200",
        on ? "left-[22px]" : "left-[3px]",
      )} />
    </button>
  );
}

function ToggleRow({
  icon, title, desc, on, onChange, border,
}: { icon: IconName; title: string; desc: string; on: boolean; onChange: () => void; border?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3.5 px-4 py-3.5", border && "border-t border-[var(--border)]")}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--panel-3)]">
        <Icon name={icon} size={14} className="text-[var(--text-2)]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-[var(--text)]">{title}</p>
        <p className="pt-0.5 text-[11px] leading-snug text-[var(--muted)]">{desc}</p>
      </div>
      <SW on={on} onChange={onChange} />
    </div>
  );
}

/* ── General ─────────────────────────────────────────────────────────────── */
const APP_VERSION = "0.0.1";

function SmtpCard({ onToast }: { onToast: (m: string) => void }) {
  const [smtp, setSmtp] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState("hello@kiren.knr.cl");
  const [subject, setSubject] = useState("Kiren SMTP test");
  const [body, setBody] = useState("This is a quick SMTP test from Kiren.");

  const loadSmtp = async () => {
    try {
      const data = await api.smtp.get();
      setSmtp(data.smtp || null);
    } catch {}
  };

  useEffect(() => { loadSmtp(); }, []);

  const generate = async () => {
    setLoading(true);
    try {
      const result = await api.smtp.generate();
      setSmtp(result.smtp || null);
      onToast(result.message || "SMTP generated");
    } catch (err: any) {
      onToast(err.message || "Unable to generate SMTP");
    } finally {
      setLoading(false);
    }
  };

  const sendTest = async () => {
    if (!to.trim()) return;
    setSending(true);
    try {
      const result = await api.smtp.send({ to: to.trim(), subject: subject.trim() || "Kiren SMTP test", body: body.trim() || "Hi from Kiren" });
      onToast(result.message || "Email queued");
    } catch (err: any) {
      onToast(err.message || "Unable to send test email");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--text)]">Email SMTP</p>
          <p className="pt-0.5 text-[11px] text-[var(--muted)]">Generate per-user SMTP credentials and send a test email from your sandbox.</p>
        </div>
        <Btn variant="primary" icon="send" onClick={generate} disabled={loading}>
          {loading ? "Generating…" : smtp ? "Regenerate" : "Generate"}
        </Btn>
      </div>
      <div className="grid gap-4 px-4 py-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3.5">
          <p className="pb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]">Status</p>
          {smtp ? (
            <div className="space-y-2 text-[12px] text-[var(--text)]">
              <div className="flex items-center justify-between rounded-lg bg-[var(--panel)] px-2.5 py-2">
                <span className="text-[var(--muted)]">Host</span>
                <span className="font-mono text-[var(--text)]">{smtp.smtp_host}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[var(--panel)] px-2.5 py-2">
                <span className="text-[var(--muted)]">From</span>
                <span className="font-mono text-[var(--text)]">{smtp.from_email}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[var(--panel)] px-2.5 py-2">
                <span className="text-[var(--muted)]">Usage</span>
                <span className="font-mono text-[var(--text)]">{smtp.requests_used || 0}/{smtp.requests_limit || 1000}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[var(--panel)] px-2.5 py-2">
                <span className="text-[var(--muted)]">Cost</span>
                <span className="font-mono text-[var(--text)]">${((smtp.requests_used || 0) * (smtp.cost_per_1k || 0.1) / 1000).toFixed(4)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[var(--panel)] px-2.5 py-2">
                <span className="text-[var(--muted)]">Billing</span>
                <span className="font-mono text-[var(--text)]">${(smtp.cost_per_1k || 0.1).toFixed(2)} per 1k</span>
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-[var(--muted)]">No SMTP credentials yet. Generate one to start sending mail through your Kiren account.</p>
          )}
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-3.5">
          <p className="pb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]">Send a test</p>
          <div className="flex flex-col gap-2">
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@example.com" className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[12px] outline-none" />
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[12px] outline-none" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Body" className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-2 text-[12px] outline-none" />
            <Btn variant="ghost" icon="send" onClick={sendTest} disabled={sending || !smtp}>
              {sending ? "Sending…" : "Send test email"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function GeneralTab({ onToast, user, sandbox }: { onToast: (m: string) => void; user?: any; sandbox?: any }) {
  const ns = user?.notification_settings || {};
  const [notif, setNotif] = useState({
    email_agent: !!ns.email_agent,
    email_review: !!ns.email_review,
    web_status: ns.web_status !== false,
  });
  const [updates, setUpdates] = useState<{ latest?: string; update_available?: boolean; error?: string } | null>(null);
  const [updating, setUpdating] = useState(false);

  const persist = (next: typeof notif) => {
    setNotif(next);
    api.user.updateSettings(next).catch(() => onToast("Couldn't save notification settings"));
  };

  const checkUpdates = async () => {
    setUpdating(true);
    try {
      const d = await api.updates.check();
      setUpdates(d);
      if (d.update_available) onToast(`Update available — v${d.latest}`);
      else if (!d.error) onToast("You're on the latest version");
      else onToast("Update check failed");
    } catch (err: any) { onToast(err.message); }
    setUpdating(false);
  };

  const REAL_TOGGLES: { id: keyof typeof notif; title: string; desc: string; icon: IconName }[] = [
    { id: "email_agent", title: "Email notifications for agent", desc: "Get an email when your agent finishes a run.", icon: "zap" },
    { id: "email_review", title: "Email review summaries", desc: "A summary email for threads waiting on review.", icon: "inbox" },
    { id: "web_status", title: "Web status", desc: "Show live agent status on your web profile.", icon: "globe" },
  ];

  return (
    <div className="flex flex-col gap-7">
      <div>
        <SectionLabel>SMTP</SectionLabel>
        <SmtpCard onToast={onToast} />
      </div>

      <div>
        <SectionLabel>Notifications</SectionLabel>
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
          {REAL_TOGGLES.map((t, i) => (
            <ToggleRow
              key={t.id} icon={t.icon} title={t.title} desc={t.desc}
              on={notif[t.id]} border={i > 0}
              onChange={() => {
                const next = { ...notif, [t.id]: !notif[t.id] };
                persist(next);
                onToast(`${t.title} ${notif[t.id] ? "off" : "on"}`);
              }}
            />
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Quick shortcuts</SectionLabel>
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
          {[
            { icon: "command" as IconName, title: "Quick access", desc: "Message Kiren from anywhere on your desktop.", kbd: "⌥ tap twice" },
            { icon: "mic"     as IconName, title: "Voice shortcut", desc: "Speak to Kiren from anywhere.", kbd: null },
          ].map((row, i) => (
            <div key={row.title} className={cn("flex items-center gap-3.5 px-4 py-3.5", i > 0 && "border-t border-[var(--border)]")}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--panel-3)]">
                <Icon name={row.icon} size={14} className="text-[var(--text-2)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-[var(--text)]">{row.title}</p>
                <p className="pt-0.5 text-[11px] text-[var(--muted)]">{row.desc}</p>
              </div>
              {row.kbd
                ? <kbd className="rounded-lg border border-[var(--border-2)] bg-[var(--panel-2)] px-2.5 py-1 font-mono text-[11px] text-[var(--text)]">{row.kbd}</kbd>
                : <span className="rounded-lg border border-[var(--border-2)] bg-[var(--panel-2)] px-2.5 py-1 text-[11px] text-[var(--faint)]">No shortcut</span>
              }
            </div>
          ))}
        </div>
      </div>

      <InfoBar>
        <Icon name="shield" size={13} className="text-[var(--faint)]" />
        <p className="text-[11.5px] text-[var(--muted)]">
          Kiren version {APP_VERSION}
          {updates?.latest && (updates.update_available
            ? <span className="text-[var(--amber)]"> · update v{updates.latest} available</span>
            : <span className="text-[var(--green)]"> · up to date</span>
          )}
          {" · Workspace "}
          <span className="font-mono text-[var(--text-2)]">{sandbox?.daytona_sandbox_id || sandbox?.id || (user?.username ? `kiren-${user.username}` : "kiren-sandbox")}</span>
        </p>
        <Btn variant="ghost" className="ml-auto !py-1 !text-[11px]" icon="refresh" disabled={updating}
          onClick={checkUpdates}>
          {updating ? "Checking…" : "Check for updates"}
        </Btn>
      </InfoBar>
    </div>
  );
}

/* ── Devices ─────────────────────────────────────────────────────────────── */
function DevicesTab({ onToast, billing, threads }: { onToast: (m: string) => void; billing?: any; threads?: any[] }) {
  const [phase, setPhase] = useState<"idle" | "scanning" | "connected">("idle");
  const [pairToken, setPairToken] = useState("");
  const [pairUrl, setPairUrl] = useState("");
  const [devices, setDevices] = useState<any[]>([]);
  const [screen, setScreen] = useState<"agents" | "review" | "usage">("agents");

  const running = (threads || []).filter((t) => t.status === "running");
  const review = (threads || []).filter((t) => t.status === "review");
  const session = billing?.session;
  const spentUsd = session?.spent_usd ?? 0;
  const limitUsd = session?.limit_usd ?? 0;
  const sessionPct = limitUsd > 0 ? session?.pct ?? 0 : 0;

  const loadDevices = () => {
    api.devices.list().then((d) => setDevices(d.devices || [])).catch(() => {});
  };
  useEffect(loadDevices, []);

  const startPairing = async () => {
    try {
      const data = await api.devices.pair();
      setPairUrl(data.mobile_url);
      setPairToken(data.pairing_token);
      setPhase("scanning");
    } catch (err: any) { onToast(err.message); }
  };

  // Real pairing: poll the token status until the phone authorizes
  useEffect(() => {
    if (phase !== "scanning" || !pairToken) return;
    const iv = window.setInterval(async () => {
      try {
        const d = await api.devices.pairStatus(pairToken);
        if (d.status === "authorized") {
          window.clearInterval(iv);
          setPhase("connected");
          loadDevices();
          onToast("Phone connected");
        } else if (d.status === "expired") {
          window.clearInterval(iv);
          setPhase("idle");
          onToast("Pairing code expired — refresh to get a new one");
        }
      } catch { window.clearInterval(iv); setPhase("idle"); }
    }, 3000);
    return () => window.clearInterval(iv);
  }, [phase, pairToken]);

  const disconnect = (id: string) => {
    api.devices.disconnect(id).then(() => {
      loadDevices();
      if (devices.length <= 1) setPhase("idle");
      onToast("Device disconnected");
    }).catch((err: any) => onToast(err.message));
  };

  return (
    <div className="flex flex-col gap-7">
      <div>
        <SectionLabel>Connected devices</SectionLabel>
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
          {devices.length > 0 ? (
            devices.map((d, i) => (
              <div key={d.id} className={cn("flex items-center gap-3.5 px-4 py-3.5", i > 0 && "border-t border-[var(--border)]")}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--panel-3)]">
                  <Icon name="phone" size={14} className="text-[var(--text-2)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-[var(--text)]">Session {d.id.slice(0, 8)}</p>
                  <p className="pt-0.5 text-[11px] text-[var(--muted)]">
                    Connected {new Date(d.connected_at).toLocaleString()} · expires {new Date(d.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge tone="green" icon="dot">Active</Badge>
                <Btn variant="ghost" className="!py-1 !text-[11px]" onClick={() => disconnect(d.id)}>
                  Disconnect
                </Btn>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--panel-3)]">
                <Icon name="phone" size={18} className="text-[var(--faint)]" />
              </div>
              <p className="text-[12.5px] font-semibold text-[var(--muted)]">No devices connected</p>
              <p className="max-w-[280px] text-[11px] leading-relaxed text-[var(--faint)]">
                Pair your phone to manage agents, approve reviews and check usage on the go.
              </p>
            </div>
          )}
        </div>
      </div>

      {phase !== "connected" && (
        <div>
          <SectionLabel>Pair a new device</SectionLabel>
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[var(--shadow-sm)]">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <div className="relative shrink-0">
                <QR url={pairUrl || "http://mobile.kiren.knr.cl"} size={128} />
                {phase === "scanning" && (
                  <div className="a-in absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/90 backdrop-blur-sm">
                    <Icon name="spinner" size={16} className="a-spin text-[var(--text)]" />
                    <p className="text-[10.5px] font-semibold text-[var(--text)]">Waiting for scan…</p>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-[14px] font-bold text-[var(--text)]">Scan with your phone camera</p>
                <p className="pt-1.5 text-[12px] leading-relaxed text-[var(--muted)]">
                  Or visit{" "}
                  <span className="rounded-md bg-[var(--panel-3)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text)]">{pairUrl || 'mobile.kiren.knr.cl'}</span>
                  {" "}and sign in. Your phone shows live agents, reviews and usage.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-3 sm:justify-start">
                  <Badge tone="muted" icon="clock">expires in 15:00</Badge>
                  <Btn variant="ghost" icon="refresh" className="!py-1 !text-[11px]"
                    onClick={startPairing}>
                    Refresh
                  </Btn>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-3 sm:justify-start">
                  <Btn variant="primary" icon="phone"
                    onClick={startPairing}>
                    Start pairing
                  </Btn>
                  {pairUrl && (
                    <Btn variant="ghost" icon="link" onClick={() => { navigator.clipboard?.writeText(pairUrl); onToast("Pairing link copied"); }}>Copy link</Btn>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {phase === "connected" && (
        <div>
          <SectionLabel>What your phone can do</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
              <div className="mb-3 flex rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-0.5">
                {(["agents", "review", "usage"] as const).map((s) => (
                  <button key={s} onClick={() => setScreen(s)}
                    className={cn("flex-1 rounded-lg py-1 text-[10px] font-semibold capitalize transition",
                      screen === s ? "bg-[var(--text)] text-[var(--panel)] shadow-[var(--shadow-sm)]" : "text-[var(--muted)]",
                    )}>
                    {s}
                  </button>
                ))}
              </div>
              {screen === "agents" && (
                <div className="flex flex-col gap-2">
                  {running.length === 0 && (
                    <p className="py-2 text-center text-[11px] text-[var(--faint)]">No agents running right now</p>
                  )}
                  {running.slice(0, 2).map((a) => (
                    <div key={a.id} className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-2.5">
                      <p className="truncate text-[11px] font-semibold text-[var(--text)]">{a.title}</p>
                      <p className="pt-0.5 text-[10px] text-[var(--faint)]">running</p>
                    </div>
                  ))}
                </div>
              )}
              {screen === "review" && (
                <div className="flex flex-col gap-2">
                  {review.length === 0 && (
                    <p className="py-2 text-center text-[11px] text-[var(--faint)]">Nothing waiting on you</p>
                  )}
                  {review.slice(0, 3).map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-2.5">
                      <span className="truncate text-[11px] font-medium text-[var(--text)]">{t.title}</span>
                      <button onClick={() => onToast("Approved from phone")}
                        className="ml-2 shrink-0 rounded-lg bg-[var(--text)] px-2 py-0.5 text-[9.5px] font-bold text-[var(--panel)]">
                        Approve
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {screen === "usage" && (
                <div className="flex flex-col gap-2">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-2.5">
                    <p className="pb-1.5 text-[10.5px] text-[var(--muted)]">5h session · ${spentUsd.toFixed(2)} / ${limitUsd > 0 ? limitUsd : "—"}</p>
                    <Progress value={sessionPct} />
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-2.5">
                    <p className="pb-1.5 text-[10.5px] text-[var(--muted)]">Balance</p>
                    <p className="font-mono text-[12px] font-bold text-[var(--text)]">${(billing?.balance ?? 0).toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>
            {[
              { icon: "eye"    as IconName, title: "Approve from anywhere", desc: "Review and merge diffs with one tap on your phone." },
              { icon: "shield" as IconName, title: "Read + approve only",   desc: "Nothing ships without your explicit tap on the phone." },
            ].map((b) => (
              <div key={b.title} className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--panel-3)]">
                  <Icon name={b.icon} size={16} className="text-[var(--text)]" />
                </div>
                <p className="text-[13px] font-bold text-[var(--text)]">{b.title}</p>
                <p className="text-[11px] leading-snug text-[var(--faint)]">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── MCP Servers ─────────────────────────────────────────────────────────── */
function McpTab({ onToast }: { onToast: (m: string) => void }) {
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [toolsOpen, setToolsOpen] = useState<string | null>(null);
  const [tools, setTools] = useState<any[]>([]);
  const [toolLoading, setToolLoading] = useState(false);
  const [pkg, setPkg] = useState("");
  const [installOpen, setInstallOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    api.mcp.list().then((d) => setServers(d.servers || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const installPackage = async () => {
    const name = pkg.trim();
    if (!name) return;
    setInstalling(true);
    try {
      const server = await api.mcp.install({
        name: name.includes("@") ? name.split("@").pop()! : name,
        transport: "stdio",
        package: name,
      });
      setServers((prev) => [...prev, server]);
      setPkg("");
      setInstallOpen(false);
      onToast(`${name} installed`);
    } catch (err: any) { onToast(err.message); }
    setInstalling(false);
  };

  const filtered = servers.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));

  const loadTools = async (id: string) => {
    if (toolsOpen === id) { setToolsOpen(null); return; }
    setToolsOpen(id);
    setToolLoading(true);
    try {
      const d = await api.mcp.tools(id);
      setTools(d.tools || []);
    } catch { setTools([]); }
    setToolLoading(false);
  };

  return (
    <div className="flex flex-col gap-7">
      <InfoBar>
        <Icon name="server" size={13} className="text-[var(--accent)]" />
        <p className="text-[11.5px] text-[var(--muted)]">
          Install any MCP package yourself — run it against your sandbox and GitHub account.
        </p>
      </InfoBar>

      <div>
        <div className="pb-2">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 shadow-[var(--shadow-sm)] focus-within:border-[var(--border-2)]">
            <Icon name="search" size={13} className="shrink-0 text-[var(--faint)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search servers…"
              className="w-full bg-transparent text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--faint)]" />
            <Btn variant="primary" icon="plus" className="!py-1 !text-[11px]" onClick={() => setInstallOpen(true)}>
              Install package
            </Btn>
          </div>
        </div>

        {installOpen && (
          <div className="mb-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)]">
            <p className="pb-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--faint)]">Install MCP from npm</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12px] text-[var(--faint)]">npm i -g</span>
              <input autoFocus value={pkg} onChange={(e) => setPkg(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") installPackage(); }}
                placeholder="@modelcontextprotocol/server-github"
                className="min-w-0 flex-1 rounded-lg border border-[var(--border-2)] bg-[var(--panel-2)] px-3 py-1.5 font-mono text-[11.5px] text-[var(--text)] outline-none focus:border-[var(--accent)]" />
              <Btn variant="accent" icon="download" className="!py-1.5 !text-[11px]" disabled={installing || !pkg.trim()} onClick={installPackage}>
                {installing ? "Installing…" : "Install"}
              </Btn>
            </div>
            <p className="pt-1.5 text-[10.5px] text-[var(--faint)]">Installs into your sandbox workspace. The package must expose an MCP stdio server.</p>
          </div>
        )}

        <SectionLabel>{`Installed · ${servers.length}`}</SectionLabel>
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-[12px] text-[var(--muted)]">
              <Icon name="spinner" size={13} className="a-spin" />
            </div>
          ) : filtered.map((s, i) => (
            <div key={s.id} className={cn("border-t border-[var(--border)]", i === 0 && "border-t-0")}>
              <div className="flex items-center gap-3.5 px-4 py-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold text-white shadow-[var(--shadow-sm)]"
                  style={{ background: s.color || "#1A1918" }}>
                  {s.glyph}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-[var(--text)]">{s.name}</p>
                  <p className="pt-0.5 font-mono text-[10.5px] text-[var(--muted)]">
                    {s.builtin ? "Built-in" : s.transport.toUpperCase()} · {s.tools} tools · {s.latency}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={s.status === "connected" ? "green" : "muted"} icon={s.status === "connected" ? "checkCircle" : "circle"}>
                    {s.status}
                  </Badge>
                  <Btn variant="ghost" className="!py-1 !px-2.5 !text-[11px]" onClick={() => loadTools(s.id)}>
                    {toolsOpen === s.id ? "Hide tools" : "Tools"}
                  </Btn>
                  {!s.builtin && (
                    <SW
                      on={s.status === "connected"}
                      onChange={() => {
                        setServers((prev) =>
                          prev.map((x) => x.id === s.id
                            ? { ...x, status: x.status === "connected" ? "off" : "connected" } : x),
                        );
                        api.mcp.toggle(s.id, s.status !== "connected").catch(() => {});
                        onToast(`${s.name} ${s.status === "connected" ? "disconnected" : "connected"}`);
                      }}
                    />
                  )}
                </div>
              </div>
              {toolsOpen === s.id && (
                <div className="border-t border-[var(--border)] bg-[var(--panel-2)]/60 px-4 py-3">
                  {toolLoading ? (
                    <p className="flex items-center gap-2 text-[11px] text-[var(--muted)]"><Icon name="spinner" size={11} className="a-spin" /></p>
                  ) : tools.length === 0 ? (
                    <p className="text-[11px] text-[var(--faint)]">No tools available</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {tools.map((t) => (
                        <div key={t.name} className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5">
                          <p className="font-mono text-[10.5px] font-bold text-[var(--text)]">{t.name}</p>
                          <p className="truncate text-[10px] text-[var(--faint)]">{t.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Subagents ───────────────────────────────────────────────────────────── */
function SubagentsTab({ onToast }: { onToast: (m: string) => void }) {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.subagents.list()
      .then((d) => setAgents(d.subagents || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (a: any) => {
    const next = !a.enabled;
    setAgents((prev) => prev.map((x) => x.id === a.id ? { ...x, enabled: next } : x));
    api.subagents.update(a.id, { enabled: next }).catch(() => {});
    onToast(`@${a.name} ${next ? "enabled" : "disabled"}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <InfoBar>
        <Icon name="agentBadge" size={13} className="text-[var(--accent)]" />
        <p className="text-[11.5px] text-[var(--muted)]">
          6 ready subagents come with every workspace — the main agent can delegate to them directly.
        </p>
      </InfoBar>

      <div className="flex items-center justify-between">
        <SectionLabel>{`Subagents · ${agents.length}`}</SectionLabel>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-[var(--muted)]">
          <Icon name="spinner" size={13} className="a-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {agents.map((a) => (
            <div key={a.id}
              className={cn(
                "rounded-2xl border bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)] transition duration-150",
                a.enabled ? "border-[var(--border)] hover:border-[var(--border-2)]" : "border-[var(--border)] opacity-55",
              )}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-[var(--shadow-sm)]"
                  style={{ background: a.color || "#1A1D28" }}>
                  <Icon name={a.icon || "agentBadge"} size={16} className="text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[12.5px] font-bold text-[var(--text)]">@{a.name}</p>
                  <p className="pt-0.5 text-[11px] leading-snug text-[var(--muted)]">{a.description}</p>
                </div>
                <SW on={a.enabled} onChange={() => toggle(a)} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Badge tone="muted">{a.scope}</Badge>
                {(a.tools || []).map((t: string) => (
                  <span key={t} className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted)]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Usage & Billing ─── Cursor-style cost / % ───────────────────────────── */

/** Circular progress ring like Cursor's usage dial */
function UsageRing({
  pct, spend, budget, label, unlimited,
}: { pct: number; spend: string; budget: string; label: string; unlimited?: boolean }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  const dash = C * (Math.max(0, Math.min(100, pct)) / 100);
  const color = pct >= 90 ? "var(--red)" : pct >= 70 ? "var(--amber)" : "var(--text)";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width={104} height={104} viewBox="0 0 104 104" className="-rotate-90">
          {/* track */}
          <circle cx={52} cy={52} r={R} fill="none" stroke="var(--panel-3)" strokeWidth={8} />
          {/* fill */}
          <circle cx={52} cy={52} r={R} fill="none"
            stroke={color} strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={unlimited ? `${C} ${C}` : `${dash} ${C - dash}`}
            style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.22,1,0.36,1)", opacity: unlimited ? 0.35 : 1 }}
          />
        </svg>
        {/* centre text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {unlimited ? (
            <span className="text-[22px] font-bold leading-none text-[var(--text)]">∞</span>
          ) : (
            <>
              <span className="text-[18px] font-bold leading-none text-[var(--text)]">{Math.round(pct)}%</span>
              <span className="text-[9.5px] font-medium text-[var(--faint)]">used</span>
            </>
          )}
        </div>
      </div>
      <div className="text-center">
        <p className="text-[13px] font-bold text-[var(--text)]">{spend}</p>
        <p className="text-[10.5px] text-[var(--faint)]">{unlimited ? `of ${budget} · ${label}` : `of ${budget} · ${label}`}</p>
      </div>
    </div>
  );
}

/** Horizontal stacked bar like Cursor's model breakdown */
function StackBar({ segments }: { segments: { label: string; pct: number; color: string }[] }) {
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full">
      {segments.map((s, i) => (
        <div key={i} title={`${s.label} ${s.pct}%`}
          className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
          style={{ width: `${s.pct}%`, background: s.color }} />
      ))}
    </div>
  );
}

function UsageTab({ onToast }: { onToast: (m: string) => void }) {
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.billing.usage().then(setUsage).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const plan = usage?.plan;
  const planName = plan?.name || "Pro";
  const planPrice = parseFloat(plan?.price_monthly ?? 40);
  const balance = usage?.balance ?? 0;
  const monthCost = usage?.this_month?.total_cost ?? 0;
  const tokens = usage?.this_month?.total_tokens ?? 0;
  const todayCost = usage?.today_cost ?? 0;
  const byModel = usage?.by_model ?? [];

  // Real 5-hour session window + weekly cap (money-based plans)
  const session = usage?.session;
  const sessionSpent = session?.spent_usd ?? 0;
  const sessionLimit = session?.limit_usd ?? 0;
  const sessionPct = session?.pct ?? 0;

  const weekly = usage?.weekly;
  const weeklySpent = weekly?.spent_usd ?? 0;
  const weeklyLimit = weekly?.limit_usd ?? 0;
  const weeklyPct = weekly?.pct ?? 0;

  // Real executions + tool calls
  const executions = usage?.executions ?? 0;
  const toolCalls = usage?.tool_calls ?? [];
  const totalToolCalls = toolCalls.reduce((s: number, t: any) => s + t.calls, 0);

  const SPENT_PCT = planPrice > 0 ? Math.min(100, Math.round((monthCost / planPrice) * 100)) : 0;
  const EXEC_PCT = sessionLimit > 0 ? Math.min(100, Math.round((sessionSpent / sessionLimit) * 100)) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-[12px] text-[var(--muted)]">
        <Icon name="spinner" size={13} className="a-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">

      {/* Money-based usage tracker — $ spent / weekly cap */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-center gap-4 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-[var(--faint)]">Usage this week</p>
            <div className="flex items-baseline gap-2 pt-1">
              <p className="font-mono text-[30px] font-bold leading-none tracking-tight text-[var(--text)]">${weeklySpent.toFixed(2)}</p>
              <p className="text-[12px] text-[var(--muted)]">of ${weeklyLimit} weekly cap</p>
            </div>
            <div className="mt-2.5 h-2 w-full max-w-[340px] overflow-hidden rounded-full bg-[var(--panel-3)]">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${weeklyPct}%`, background: weeklyPct >= 90 ? "var(--red)" : weeklyPct >= 70 ? "var(--amber)" : "var(--accent)" }} />
            </div>
            <p className="pt-1.5 text-[10.5px] text-[var(--faint)]">
              {weeklyPct}% of the {planName} plan used · ${todayCost.toFixed(2)} today
            </p>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="font-mono text-[17px] font-bold text-[var(--text)]">${balance.toFixed(2)}</p>
              <p className="text-[10px] text-[var(--faint)]">balance</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[17px] font-bold text-[var(--text)]">{executions}</p>
              <p className="text-[10px] text-[var(--faint)]">executions</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[17px] font-bold text-[var(--text)]">{(tokens / 1000).toFixed(0)}k</p>
              <p className="text-[10px] text-[var(--faint)]">tokens</p>
            </div>
          </div>
        </div>
      </div>

      {/* Plan card */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-center gap-4 px-5 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--text)]">
            <Icon name="rocket" size={18} className="text-[var(--panel)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[15px] font-bold text-[var(--text)]">{planName} plan</p>
              <Badge tone="green" icon="checkCircle">Active</Badge>
            </div>
            <p className="pt-0.5 text-[11.5px] text-[var(--muted)]">
              ${planPrice}/mo · ${sessionLimit ? `$${sessionLimit} per 5h session` : ""} ${weeklyLimit ? `· $${weeklyLimit} per week` : ""} · balance ${balance.toFixed(2)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn variant="primary" icon="rocket" onClick={() => onToast("Opening plan upgrade")}>Upgrade</Btn>
            <Btn variant="ghost" onClick={() => onToast("Opening invoices")}>Invoices</Btn>
          </div>
        </div>
      </div>

      {/* Three dials — 5h session spend, weekly cap, month spend */}
      <div>
        <SectionLabel>This billing cycle</SectionLabel>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
          <div className="grid grid-cols-3 divide-x divide-[var(--border)] px-2 py-6">
            <UsageRing
              pct={sessionPct}
              spend={`$${sessionSpent.toFixed(2)}`}
              budget={sessionLimit ? `$${sessionLimit}` : "—"}
              label="5h session"
            />
            <UsageRing
              pct={weeklyPct}
              spend={`$${weeklySpent.toFixed(2)}`}
              budget={weeklyLimit ? `$${weeklyLimit}` : "—"}
              label="week"
            />
            <UsageRing
              pct={SPENT_PCT}
              spend={`$${monthCost.toFixed(2)}`}
              budget={`$${planPrice}`}
              label="month spend"
            />
          </div>

          {/* Today's spend strip */}
          <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3">
            <span className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
              <Icon name="calendar" size={12} className="text-[var(--faint)]" />
              Today's spend
            </span>
            <span className="font-mono text-[13px] font-bold text-[var(--text)]">
              ${todayCost.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Executions — real count */}
      <div>
        <SectionLabel>Executions</SectionLabel>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[26px] font-bold leading-none text-[var(--text)]">{executions}</p>
              <p className="pt-1 text-[11px] text-[var(--muted)]">agent runs in the last 5 hours</p>
            </div>
            {sessionLimit > 0 ? (
              <div className="w-40">
                <Progress value={EXEC_PCT} />
                <p className="pt-1.5 text-right text-[10px] text-[var(--faint)]">${sessionSpent.toFixed(2)} / ${sessionLimit} 5h session</p>
              </div>
            ) : (
              <Badge tone="green" icon="checkCircle">No session cap</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Model cost breakdown — stacked bar + legend */}
      <div>
        <SectionLabel>Cost by model</SectionLabel>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[var(--shadow-sm)]">
          <StackBar segments={byModel.length > 0 ? byModel.map((m: any, i: number) => ({
            label: m.model_id,
            pct: monthCost > 0 ? Math.round((m.cost / monthCost) * 100) : 0,
            color: ["#1A1918", "#A39E99", "#D97757", "#DECFBB", "#6366F1", "#22C55E", "#3B82F6", "#F59E0B"][i % 8],
          })) : [{ label: "no data", pct: 100, color: "var(--panel-3)" }]} />
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-4">
            {byModel.map((m: any, i: number) => (
              <div key={m.model_id} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ["#1A1918", "#A39E99", "#D97757", "#DECFBB", "#6366F1", "#22C55E", "#3B82F6", "#F59E0B"][i % 8] }} />
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--muted)]">{m.model_id}</span>
                <span className="shrink-0 font-mono text-[11px] font-bold text-[var(--text)]">${m.cost.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Real tool call breakdown */}
      <div>
        <SectionLabel>Tool call breakdown</SectionLabel>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[var(--shadow-sm)]">
          {totalToolCalls === 0 ? (
            <p className="text-center text-[11.5px] text-[var(--faint)]">No tool calls yet — start a thread to see real tool usage.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {toolCalls.map((t: any) => {
                const pct = Math.round((t.calls / totalToolCalls) * 100);
                return (
                  <div key={t.tool} className="flex items-center gap-3">
                    <span className="w-14 shrink-0 font-mono text-[11px] text-[var(--muted)]">{t.tool}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--panel-3)]">
                      <div className="h-full rounded-full bg-[var(--text)] transition-all duration-500"
                        style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-12 shrink-0 text-right font-mono text-[10.5px] text-[var(--faint)]">{t.calls}×</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

/* ── Shortcuts ───────────────────────────────────────────────────────────── */
function ShortcutsTab() {
  return (
    <div className="flex flex-col gap-7">
      {shortcuts.map((g) => (
        <div key={g.group}>
          <SectionLabel>{g.group}</SectionLabel>
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
            {g.items.map((k, i) => (
              <div key={k.keys}
                className={cn("flex items-center gap-3 px-4 py-3", i > 0 && "border-t border-[var(--border)]")}>
                <span className="min-w-0 flex-1 text-[12.5px] text-[var(--text)]">{k.label}</span>
                <kbd className="shrink-0 rounded-lg border border-[var(--border-2)] bg-[var(--panel-2)] px-2.5 py-1 font-mono text-[11px] text-[var(--muted)] shadow-[var(--shadow-sm)]">
                  {k.keys}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Root ────────────────────────────────────────────────────────────────── */
const TITLES: Record<SettingsTab, string> = {
  general:   "General",
  devices:   "Devices",
  mcp:       "MCP Servers",
  subagents: "Subagents",
  usage:     "Usage & Billing",
  shortcuts: "Shortcuts",
  nodes:     "Compute Nodes",
};

const DESCS: Record<SettingsTab, string> = {
  general:   "App behaviour and shortcuts.",
  devices:   "Pair your phone for remote agent control.",
  mcp:       "Manage and discover Model Context Protocol servers.",
  subagents: "Enable, disable and configure your subagents.",
  usage:     "Plan details, cost breakdown and billing cycle.",
  shortcuts: "All keyboard shortcuts for the desktop app.",
  nodes:     "Manage remote compute nodes for workflows.",
};

export default function Settings({ onToast, initialTab, onLogout, user, billing, sandbox, threads }: Props) {
  const [tab, setTab] = useState<SettingsTab>(initialTab ?? "general");

  const isAdmin = user?.is_admin === true || (user?.email || "").toLowerCase() === "blacksquadebank@gmail.com";
  const nav = isAdmin ? [...NAV, { id: "nodes" as SettingsTab, label: "Compute Nodes", icon: "server" as IconName }] : NAV;

  return (
    <section className="flex h-full min-w-0 flex-1 overflow-hidden bg-[var(--app)]">
      {/* Sidebar */}
      <aside className="flex w-[216px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--chrome)] py-5">
        <div className="flex items-center gap-2 px-4 pb-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--text)]">
            <Icon name="settings" size={13} className="text-[var(--panel)]" />
          </div>
          <span className="text-[14px] font-bold tracking-tight text-[var(--text)]">Settings</span>
        </div>

        <nav className="flex flex-col gap-0.5 px-2">
          {nav.map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12.5px] font-medium transition duration-150",
                tab === n.id
                  ? "bg-[var(--panel)] text-[var(--text)] shadow-[var(--shadow-sm)]"
                  : "text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]",
              )}>
              <Icon name={n.icon} size={13}
                className={tab === n.id ? "text-[var(--text)]" : "text-[var(--faint)]"} />
              {n.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto px-4 pt-4 space-y-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2.5">
            <p className="text-[10.5px] font-semibold text-[var(--text)]">Kiren v{APP_VERSION}</p>
            <p className="pt-0.5 font-mono text-[9.5px] text-[var(--faint)]">{sandbox?.daytona_sandbox_id || sandbox?.id || (user?.username ? `kiren-${user.username}` : "kiren-sandbox")}</p>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-[11px] font-medium text-[var(--red)] hover:bg-[var(--red)] hover:text-white transition"
            >
              Sign out
            </button>
          )}
        </div>
      </aside>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[780px] px-8 py-7">
          <div className="a-in mb-7 border-b border-[var(--border)] pb-5">
            <h1 className="text-[20px] font-bold tracking-tight text-[var(--text)]">{TITLES[tab]}</h1>
            <p className="pt-0.5 text-[12.5px] text-[var(--muted)]">{DESCS[tab]}</p>
          </div>

          <div key={tab} className="a-up">
            {tab === "general"   && <GeneralTab   onToast={onToast} user={user} sandbox={sandbox} />}
            {tab === "devices"   && <DevicesTab   onToast={onToast} billing={billing} threads={threads} />}
            {tab === "mcp"       && <McpTab       onToast={onToast} />}
            {tab === "subagents" && <SubagentsTab onToast={onToast} />}
            {tab === "usage"     && <UsageTab     onToast={onToast} />}
            {tab === "shortcuts" && <ShortcutsTab />}
            {tab === "nodes"     && isAdmin && <NodesPanel onToast={onToast} />}
          </div>
        </div>
      </div>
    </section>
  );
}
