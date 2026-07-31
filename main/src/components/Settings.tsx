import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import { Icon, type IconName } from "../icons";
import {
  backgroundAgents,
  mcpServers as seedMcp,
  projects,
  sessionUsage,
  shortcuts,
  subagents as seedSubagents,
} from "../data";
import { Badge, Btn, Progress } from "./ui";

export type SettingsTab = "general" | "devices" | "mcp" | "subagents" | "usage" | "shortcuts";

interface Props {
  onToast: (m: string) => void;
  initialTab?: SettingsTab;
  onLogout?: () => void;
}

const NAV: { id: SettingsTab; label: string; icon: IconName }[] = [
  { id: "general",   label: "General",        icon: "settings"   },
  { id: "devices",   label: "Devices",         icon: "phone"      },
  { id: "mcp",       label: "MCP Servers",     icon: "server"     },
  { id: "subagents", label: "Subagents",       icon: "agentBadge" },
  { id: "usage",     label: "Usage & Billing", icon: "gauge"      },
  { id: "shortcuts", label: "Shortcuts",       icon: "keyboard"   },
];

/* ── QR ─────────────────────────────────────────────────────────────────── */
function fakeQR(seed: string): boolean[][] {
  const N = 21;
  const g = Array.from({ length: N }, () => Array(N).fill(false));
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rand = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
  const inFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= N - 6 && y < 7) || (x < 7 && y >= N - 6);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      if (!inFinder(x, y)) g[y][x] = rand() > 0.53;
  const finder = (ox: number, oy: number) => {
    for (let y = -1; y < 7; y++) for (let x = -1; x < 7; x++) {
      const px = ox + x, py = oy + y;
      if (px < 0 || py < 0 || px >= N || py >= N) continue;
      g[py][px] = !(x === -1 || y === -1 || x === 6 || y === 6)
        ? (x === 0 || y === 0 || x === 5 || y === 5 || (x >= 2 && x <= 3 && y >= 2 && y <= 3))
        : false;
    }
  };
  finder(0, 0); finder(N - 6, 0); finder(0, N - 6);
  return g;
}

function QR({ seed, size = 136 }: { seed: string; size?: number }) {
  const grid = useMemo(() => fakeQR(seed), [seed]);
  const cell = size / 21;
  return (
    <div className="rounded-2xl bg-white p-3 shadow-[var(--shadow-md)] ring-1 ring-[var(--border-2)]">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect width={size} height={size} fill="#ffffff" />
        {grid.flatMap((row, y) =>
          row.map((on, x) =>
            on ? (
              <rect key={`${x}-${y}`} x={x * cell + 0.4} y={y * cell + 0.4}
                width={cell - 0.6} height={cell - 0.6} rx={0.9} fill="#1A1918" />
            ) : null,
          ),
        )}
      </svg>
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
const GENERAL_TOGGLES: { id: string; title: string; desc: string; icon: IconName; on: boolean }[] = [
  { id: "notify",   title: "Desktop notifications", desc: "Notify when a thread needs your review.", icon: "zap",  on: true  },
  { id: "sound",    title: "Sound effects",          desc: "Play a sound when an agent finishes.",   icon: "mic",  on: false },
  { id: "autosave", title: "Autosave editor changes", desc: "Save files automatically as you type.", icon: "save", on: true  },
];

function GeneralTab({ onToast }: { onToast: (m: string) => void }) {
  const [toggles, setToggles] = useState(
    () => Object.fromEntries(GENERAL_TOGGLES.map((t) => [t.id, t.on])),
  );

  return (
    <div className="flex flex-col gap-7">
      <div>
        <SectionLabel>Desktop app</SectionLabel>
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
          {GENERAL_TOGGLES.map((t, i) => (
            <ToggleRow
              key={t.id} icon={t.icon} title={t.title} desc={t.desc}
              on={toggles[t.id]} border={i > 0}
              onChange={() => {
                setToggles((s) => ({ ...s, [t.id]: !s[t.id] }));
                onToast(`${t.title} ${toggles[t.id] ? "off" : "on"}`);
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
          Kiren version 2.6.0 · Workspace{" "}
          <span className="font-mono text-[var(--text-2)]">kiren-sa-7842</span>
        </p>
        <Btn variant="ghost" className="ml-auto !py-1 !text-[11px]" icon="refresh"
          onClick={() => onToast("Checking for updates…")}>
          Check for updates
        </Btn>
      </InfoBar>
    </div>
  );
}

/* ── Devices ─────────────────────────────────────────────────────────────── */
function DevicesTab({ onToast }: { onToast: (m: string) => void }) {
  const [phase, setPhase] = useState<"idle" | "scanning" | "connected">("idle");
  const [seconds, setSeconds] = useState(280);
  const [screen, setScreen] = useState<"agents" | "review" | "usage">("agents");

  useEffect(() => {
    if (phase !== "scanning") return;
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 280)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const mins = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-7">
      <div>
        <SectionLabel>Connected devices</SectionLabel>
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
          {phase === "connected" ? (
            <div className="flex items-center gap-3.5 px-4 py-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--panel-3)]">
                <Icon name="phone" size={14} className="text-[var(--text-2)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-[var(--text)]">iPhone 15 Pro</p>
                <p className="pt-0.5 text-[11px] text-[var(--muted)]">Active now · kiren.to/SA-7842 · full control enabled</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="green" icon="dot">Active</Badge>
                <Btn variant="ghost" className="!py-1 !text-[11px]"
                  onClick={() => { setPhase("idle"); setSeconds(280); onToast("iPhone disconnected"); }}>
                  Disconnect
                </Btn>
              </div>
            </div>
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
                <QR seed="kiren-to-SA-7842" size={128} />
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
                  <span className="rounded-md bg-[var(--panel-3)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text)]">kiren.to/SA-7842</span>
                  {" "}and sign in. Your phone shows live agents, reviews and usage.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-3 sm:justify-start">
                  <Badge tone="muted" icon="clock">refreshes in {mins}</Badge>
                  <Btn variant="ghost" icon="refresh" className="!py-1 !text-[11px]"
                    onClick={() => { setSeconds(280); onToast("New pairing code generated"); }}>
                    Refresh
                  </Btn>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-3 sm:justify-start">
                  <Btn variant="primary" icon="phone"
                    onClick={() => {
                      setPhase("scanning");
                      setTimeout(() => { setPhase("connected"); onToast("iPhone connected"); }, 1400);
                    }}>
                    Simulate a scan
                  </Btn>
                  <Btn variant="ghost" icon="link" onClick={() => onToast("Pairing link copied")}>Copy link</Btn>
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
                  {backgroundAgents.slice(0, 2).map((a) => (
                    <div key={a.id} className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-2.5">
                      <p className="truncate text-[11px] font-semibold text-[var(--text)]">{a.title}</p>
                      {a.status === "running" && <div className="pt-1.5"><Progress value={a.progress} tone="blue" /></div>}
                    </div>
                  ))}
                </div>
              )}
              {screen === "review" && (
                <div className="flex flex-col gap-2">
                  {["Rewrite the hero + tokens", "Rate limit /v1/search"].map((t) => (
                    <div key={t} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-2.5">
                      <span className="truncate text-[11px] font-medium text-[var(--text)]">{t}</span>
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
                    <p className="pb-1.5 text-[10.5px] text-[var(--muted)]">Spend · $22.40 / $40</p>
                    <Progress value={56} />
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-2)] p-2.5">
                    <p className="pb-1.5 text-[10.5px] text-[var(--muted)]">Tokens · {(sessionUsage.contextUsed / 1000).toFixed(0)}k / 200k</p>
                    <Progress value={Math.round((sessionUsage.contextUsed / sessionUsage.contextTotal) * 100)} />
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
const DISCOVER: { name: string; glyph: string; color: string; desc: string }[] = [
  { name: "Slack",  glyph: "SL", color: "#4A154B", desc: "Search channels and send messages."  },
  { name: "Notion", glyph: "NO", color: "#1A1918", desc: "Read and write Notion pages."         },
  { name: "Stripe", glyph: "ST", color: "#635BFF", desc: "Query invoices and subscriptions."   },
  { name: "Vercel", glyph: "VE", color: "#1A1918", desc: "Manage deployments and domains."     },
];

function McpTab({ onToast }: { onToast: (m: string) => void }) {
  const [servers, setServers] = useState(seedMcp);
  const [q, setQ] = useState("");
  const filtered = servers.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 shadow-[var(--shadow-sm)] focus-within:border-[var(--border-2)]">
          <Icon name="search" size={13} className="shrink-0 text-[var(--faint)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search connected servers…"
            className="w-full bg-transparent text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--faint)]" />
        </div>
        <Btn variant="primary" icon="plus" onClick={() => onToast("Add a custom MCP server")}>Add server</Btn>
      </div>

      <div>
        <SectionLabel>Connected · {servers.filter((s) => s.status === "connected").length}</SectionLabel>
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
          {filtered.map((s, i) => (
            <div key={s.id} className={cn("flex items-center gap-3.5 px-4 py-3.5", i > 0 && "border-t border-[var(--border)]")}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold text-white shadow-[var(--shadow-sm)]"
                style={{ background: s.status === "connected" ? "#1A1918" : "#A39E99" }}>
                {s.glyph}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-[var(--text)]">{s.name}</p>
                <p className="pt-0.5 font-mono text-[10.5px] text-[var(--muted)]">
                  {s.transport.toUpperCase()} · {s.tools} tools · {s.latency}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  tone={s.status === "connected" ? "green" : s.status === "error" ? "red" : "muted"}
                  icon={s.status === "connected" ? "checkCircle" : s.status === "error" ? "alert" : "circle"}>
                  {s.status}
                </Badge>
                <SW
                  on={s.status === "connected"}
                  onChange={() => {
                    setServers((prev) =>
                      prev.map((x) => x.id === s.id
                        ? { ...x, status: x.status === "connected" ? "off" : "connected" } : x),
                    );
                    onToast(`${s.name} ${s.status === "connected" ? "disconnected" : "connected"}`);
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Discover more servers</SectionLabel>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {DISCOVER.map((d) => (
            <div key={d.name} className="flex items-center gap-3.5 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-3.5 shadow-[var(--shadow-sm)]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold text-white shadow-[var(--shadow-sm)]"
                style={{ background: d.color }}>
                {d.glyph}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-[var(--text)]">{d.name}</span>
                <span className="block truncate text-[11px] text-[var(--faint)]">{d.desc}</span>
              </span>
              <Btn variant="ghost" className="!py-1 !text-[11px]" onClick={() => onToast(`${d.name} connected`)}>
                Connect
              </Btn>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Subagents ───────────────────────────────────────────────────────────── */
function SubagentsTab({ onToast }: { onToast: (m: string) => void }) {
  const [agents, setAgents] = useState(() => seedSubagents.map((a) => ({ ...a, on: true })));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <SectionLabel>Subagents · {agents.length}</SectionLabel>
        <Btn variant="primary" icon="plus" onClick={() => onToast("New subagent draft created")}>
          New subagent
        </Btn>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {agents.map((a) => (
          <div key={a.id}
            className={cn(
              "rounded-2xl border bg-[var(--panel)] p-4 shadow-[var(--shadow-sm)] transition duration-150",
              a.on ? "border-[var(--border)] hover:border-[var(--border-2)]" : "border-[var(--border)] opacity-55",
            )}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-[var(--shadow-sm)]"
                style={{ background: a.color }}>
                <Icon name={a.icon} size={16} className="text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[12.5px] font-bold text-[var(--text)]">@{a.name}</p>
                <p className="pt-0.5 text-[11px] leading-snug text-[var(--muted)]">{a.desc}</p>
              </div>
              <SW on={a.on} onChange={() => {
                setAgents((prev) => prev.map((x) => x.id === a.id ? { ...x, on: !x.on } : x));
                onToast(`@${a.name} ${a.on ? "disabled" : "enabled"}`);
              }} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge tone="muted">{a.scope}</Badge>
              {a.tools.map((t) => (
                <span key={t} className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted)]">
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <InfoBar>
        <Icon name="doc" size={13} className="text-[var(--faint)]" />
        <p className="text-[11.5px] text-[var(--muted)]">
          Configure tool access and scope in{" "}
          <span className="font-mono text-[var(--text-2)]">AGENTS.md</span>
        </p>
        <Btn variant="ghost" className="ml-auto !py-1 !text-[11px]" icon="pencil"
          onClick={() => onToast("Opening AGENTS.md")}>
          Edit
        </Btn>
      </InfoBar>
    </div>
  );
}

/* ── Usage & Billing ─── Cursor-style cost / % ───────────────────────────── */

/** Circular progress ring like Cursor's usage dial */
function UsageRing({
  pct, spend, budget, label,
}: { pct: number; spend: string; budget: string; label: string }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  const dash = C * (pct / 100);
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
            strokeDasharray={`${dash} ${C - dash}`}
            style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.22,1,0.36,1)" }}
          />
        </svg>
        {/* centre text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[18px] font-bold leading-none text-[var(--text)]">{pct}%</span>
          <span className="text-[9.5px] font-medium text-[var(--faint)]">used</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[13px] font-bold text-[var(--text)]">{spend}</p>
        <p className="text-[10.5px] text-[var(--faint)]">of {budget} · {label}</p>
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

/* plan limits — everything in $ */
const PLAN_BUDGET    = 40;      // $/mo
const SPENT          = 22.40;   // this cycle
const DAILY_SPEND    = sessionUsage.costUsd;
const SPENT_PCT      = Math.round((SPENT / PLAN_BUDGET) * 100);

/* token ring */
const TOKEN_USED     = sessionUsage.contextUsed;
const TOKEN_TOTAL    = sessionUsage.contextTotal;
const TOKEN_PCT      = Math.round((TOKEN_USED / TOKEN_TOTAL) * 100);

/* model cost breakdown (simulated) */
const MODEL_SEGMENTS = [
  { label: "kiren-2.5",      pct: 54, color: "#1A1918" },
  { label: "kiren-fast",     pct: 24, color: "#A39E99" },
  { label: "kiren-thinking", pct: 14, color: "#D97757" },
  { label: "other",          pct: 8,  color: "#DECFBB" },
];

function UsageTab({ onToast }: { onToast: (m: string) => void }) {
  return (
    <div className="flex flex-col gap-7">

      {/* Plan card */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-center gap-4 px-5 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--text)]">
            <Icon name="rocket" size={18} className="text-[var(--panel)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[15px] font-bold text-[var(--text)]">Pro plan</p>
              <Badge tone="green" icon="checkCircle">Active</Badge>
            </div>
            <p className="pt-0.5 text-[11.5px] text-[var(--muted)]">
              ${PLAN_BUDGET}/mo · renews on the 14th · {projects.length} projects
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn variant="primary" icon="rocket" onClick={() => onToast("Opening plan upgrade")}>Upgrade</Btn>
            <Btn variant="ghost" onClick={() => onToast("Opening invoices")}>Invoices</Btn>
          </div>
        </div>
      </div>

      {/* Three dials — spend, tokens, requests */}
      <div>
        <SectionLabel>This billing cycle</SectionLabel>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-sm)]">
          <div className="grid grid-cols-3 divide-x divide-[var(--border)] px-2 py-6">
            <UsageRing
              pct={SPENT_PCT}
              spend={`$${SPENT.toFixed(2)}`}
              budget={`$${PLAN_BUDGET}`}
              label="spend"
            />
            <UsageRing
              pct={TOKEN_PCT}
              spend={`${(TOKEN_USED / 1000).toFixed(0)}k`}
              budget="200k tokens"
              label="context"
            />
            <UsageRing
              pct={42}
              spend="2,140"
              budget="5,000"
              label="executions"
            />
          </div>

          {/* Today's spend strip */}
          <div className="flex items-center justify-between border-t border-[var(--border)] px-5 py-3">
            <span className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
              <Icon name="calendar" size={12} className="text-[var(--faint)]" />
              Today's spend
            </span>
            <span className="font-mono text-[13px] font-bold text-[var(--text)]">
              ${DAILY_SPEND.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Model cost breakdown — stacked bar + legend */}
      <div>
        <SectionLabel>Cost by model</SectionLabel>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[var(--shadow-sm)]">
          <StackBar segments={MODEL_SEGMENTS} />
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-4">
            {MODEL_SEGMENTS.map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--muted)]">{s.label}</span>
                <span className="shrink-0 font-mono text-[11px] font-bold text-[var(--text)]">{s.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tool call breakdown */}
      <div>
        <SectionLabel>Tool call breakdown</SectionLabel>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 shadow-[var(--shadow-sm)]">
          <div className="flex flex-col gap-3">
            {sessionUsage.toolBreakdown.map((t) => (
              <div key={t.name} className="flex items-center gap-3">
                <span className="w-14 shrink-0 font-mono text-[11px] text-[var(--muted)]">{t.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--panel-3)]">
                  <div className="h-full rounded-full bg-[var(--text)] transition-all duration-500"
                    style={{ width: `${t.pct}%` }} />
                </div>
                <span className="w-9 shrink-0 text-right font-mono text-[10.5px] text-[var(--faint)]">{t.pct}%</span>
              </div>
            ))}
          </div>
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
};

const DESCS: Record<SettingsTab, string> = {
  general:   "App behaviour and shortcuts.",
  devices:   "Pair your phone for remote agent control.",
  mcp:       "Manage and discover Model Context Protocol servers.",
  subagents: "Enable, disable and configure your subagents.",
  usage:     "Plan details, cost breakdown and billing cycle.",
  shortcuts: "All keyboard shortcuts for the desktop app.",
};

export default function Settings({ onToast, initialTab, onLogout }: Props) {
  const [tab, setTab] = useState<SettingsTab>(initialTab ?? "general");

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
          {NAV.map((n) => (
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
            <p className="text-[10.5px] font-semibold text-[var(--text)]">Kiren 2.6.0</p>
            <p className="pt-0.5 font-mono text-[9.5px] text-[var(--faint)]">kiren-sa-7842</p>
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
            {tab === "general"   && <GeneralTab   onToast={onToast} />}
            {tab === "devices"   && <DevicesTab   onToast={onToast} />}
            {tab === "mcp"       && <McpTab       onToast={onToast} />}
            {tab === "subagents" && <SubagentsTab onToast={onToast} />}
            {tab === "usage"     && <UsageTab     onToast={onToast} />}
            {tab === "shortcuts" && <ShortcutsTab />}
          </div>
        </div>
      </div>
    </section>
  );
}
