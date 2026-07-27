import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Check, ChevronDown, Cloud as CloudIcon, Laptop2, Search, type LucideIcon } from "lucide-react";
import { c, mono } from "./theme";
import { effortLevels, environments, modeOptions, modelOptions, type EffortLevel, type ModelOption } from "./data";
import { useGitHub } from "./github";

export const envIcons: Record<string, LucideIcon> = { local: Laptop2, cloud: CloudIcon };

export function envName(id: string) {
  return environments.find((e) => e.id === id)?.name ?? id;
}

export function useOutsideClose(open: boolean, setOpen: (v: boolean) => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const escape = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open, setOpen]);
  return ref;
}

export function DropdownShell({
  anchorRef, open, trigger, children, footer, width = 268, align = "left", drop = "up",
}: {
  anchorRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  trigger: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  align?: "left" | "right";
  drop?: "up" | "down";
}) {
  return (
    <div className="relative" ref={anchorRef}>
      {trigger}
      {open && (
        <div
          className="absolute z-40 rounded-xl overflow-hidden popIn menuPanel"
          style={{
            width,
            left: align === "left" ? 0 : "auto",
            right: align === "right" ? 0 : "auto",
            [drop === "up" ? "bottom" : "top"]: "calc(100% + 8px)",
            backgroundColor: "rgba(14,14,14,.95)",
            backdropFilter: "blur(20px) saturate(140%)",
            WebkitBackdropFilter: "blur(20px) saturate(140%)",
            border: `1px solid ${c.borderStrong}`,
            boxShadow: c.shadowPop,
          }}
        >
          <div className="max-h-[340px] overflow-y-auto py-1.5">{children}</div>
          {footer && (
            <div
              className="px-3 py-1.5 text-[10.5px] flex items-center gap-2"
              style={{ borderTop: `1px solid ${c.borderSoft}`, color: c.faint, backgroundColor: "rgba(0,0,0,.4)" }}
            >
              {footer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MenuHeading({ children }: { children: string }) {
  return (
    <div className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase" style={{ color: c.faint, letterSpacing: ".09em" }}>
      {children}
    </div>
  );
}

export function MenuRow({ selected, onClick, children }: { selected?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full relative flex items-start gap-2.5 pl-3 pr-2.5 py-1.5 text-left transition-colors"
      style={{ backgroundColor: selected ? c.chip : "transparent" }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chipHover)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = selected ? c.chip : "transparent")}
    >
      {selected && <span className="absolute left-0 top-1.5 bottom-1.5 rounded-r" style={{ width: 2, backgroundColor: c.accent }} />}
      {children}
    </button>
  );
}

export function Chip({ children, onClick, active }: { children: ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors text-xs"
      style={{
        backgroundColor: active ? c.chipHover : "transparent",
        border: `1px solid ${active ? c.borderStrong : c.border}`,
        color: c.muted,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chipHover)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = active ? c.chipHover : "transparent")}
    >
      {children}
    </button>
  );
}

function LockGlyph({ size = 9 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/* ---------------- Environment ---------------- */
export function EnvDropdown({ value, onChange, drop = "up" }: { value: string; onChange: (v: string) => void; drop?: "up" | "down" }) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, setOpen);
  const gh = useGitHub();
  const Icon = envIcons[value] ?? Laptop2;

  const pick = (id: string, locked: boolean) => {
    if (locked) {
      gh.connect();
      return;
    }
    onChange(id);
    setOpen(false);
  };

  return (
    <DropdownShell
      anchorRef={ref}
      open={open}
      width={304}
      drop={drop}
      footer={
        gh.connected ? (
          <>Cloud sandboxes run against <span style={{ fontFamily: mono, color: c.muted }}>{gh.repo}</span></>
        ) : (
          <>Connect GitHub to unlock Cloud sandboxes</>
        )
      }
      trigger={
        <Chip active={open} onClick={() => setOpen((o) => !o)}>
          <Icon size={12} color={c.accent} />
          <span style={{ color: c.text, fontWeight: 500 }}>{envName(value)}</span>
          <ChevronDown size={11} />
        </Chip>
      }
    >
      <MenuHeading>Where Caret builds</MenuHeading>
      {environments.map((env) => {
        const EnvIcon = envIcons[env.id];
        const locked = env.id === "cloud" && !gh.connected;
        return (
          <MenuRow key={env.id} selected={value === env.id} onClick={() => pick(env.id, locked)}>
            <EnvIcon size={14} color={value === env.id ? c.accent : c.muted} className="mt-0.5 flex-shrink-0" style={{ opacity: locked ? 0.5 : 1 }} />
            <span className="flex-1 min-w-0" style={{ opacity: locked ? 0.62 : 1 }}>
              <span className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: c.text }}>
                {env.name}
                {locked && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-[1px] rounded" style={{ backgroundColor: "rgba(255,255,255,.06)", color: c.muted }}>
                    <LockGlyph /> needs GitHub
                  </span>
                )}
                {value === env.id && !locked && <Check size={12} color={c.accent} className="ml-auto" />}
              </span>
              <span className="block text-[11.5px] leading-snug mt-0.5" style={{ color: c.muted }}>
                {locked ? "Connect GitHub to check out a repo into a sandbox." : env.desc}
              </span>
            </span>
          </MenuRow>
        );
      })}
    </DropdownShell>
  );
}

/* ---------------- Mode ---------------- */
export function ModeDropdown({ value, onChange, drop = "up" }: { value: string; onChange: (v: string) => void; drop?: "up" | "down" }) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, setOpen);
  return (
    <DropdownShell
      anchorRef={ref}
      open={open}
      drop={drop}
      footer={<>Cycle modes with <span style={{ fontFamily: mono, color: c.muted }}>shift + tab</span></>}
      trigger={
        <Chip active={open} onClick={() => setOpen((o) => !o)}>
          <span className="rounded-full" style={{ width: 5, height: 5, backgroundColor: c.accent, boxShadow: `0 0 6px ${c.accentSoft}` }} />
          <span style={{ color: c.text, fontWeight: 500 }}>{value}</span>
          <ChevronDown size={11} />
        </Chip>
      }
    >
      <MenuHeading>Mode</MenuHeading>
      {modeOptions.map((m) => (
        <MenuRow key={m.label} selected={value === m.label} onClick={() => { onChange(m.label); setOpen(false); }}>
          <span className="flex-1">
            <span className="flex items-center gap-2 text-[13px] font-medium" style={{ color: c.text }}>
              {m.label}
              {value === m.label && <Check size={12} color={c.accent} className="ml-auto" />}
            </span>
            <span className="block text-[11.5px]" style={{ color: c.muted }}>{m.sub}</span>
          </span>
        </MenuRow>
      ))}
    </DropdownShell>
  );
}

/* ---------------- Model — primary list + “More models …” ---------------- */
export function ModelDropdown({ value, onChange, drop = "up" }: { value: string; onChange: (v: string) => void; drop?: "up" | "down" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const ref = useOutsideClose(open, setOpen);

  const q = query.trim().toLowerCase();
  const matches = (m: ModelOption) => !q || `${m.name} ${m.desc}`.toLowerCase().includes(q);

  const primary = modelOptions.filter((m) => !m.more && matches(m));
  const extra = modelOptions.filter((m) => m.more && matches(m));
  // searching always reveals everything; otherwise the extras stay folded away
  const extrasVisible = q.length > 0 || showMore;
  const selectedIsExtra = modelOptions.some((m) => m.more && m.name === value);

  useEffect(() => {
    if (open) {
      setQuery("");
      setNotice(null);
      setShowMore(selectedIsExtra);
    }
  }, [open, selectedIsExtra]);

  const pick = (m: ModelOption) => {
    if (m.locked) {
      setNotice(`${m.name} needs ${m.lockNote}.`);
      return;
    }
    onChange(m.name);
    setOpen(false);
  };

  const row = (m: ModelOption) => (
    <MenuRow key={m.name} selected={value === m.name} onClick={() => pick(m)}>
      <span className="flex-1 min-w-0" style={{ opacity: m.locked ? 0.55 : 1 }}>
        <span className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium truncate" style={{ color: c.text, fontFamily: m.name.startsWith("cai-") ? mono : undefined }}>
            {m.name}
          </span>
          {m.mark && (
            <span className="text-[8px] px-1 py-[1px] rounded font-semibold flex-shrink-0" style={{ backgroundColor: "rgba(255,255,255,.08)", color: c.muted, letterSpacing: ".07em" }}>
              {m.mark}
            </span>
          )}
          {m.locked && <span style={{ color: c.faint }}><LockGlyph /></span>}
          <span className="ml-auto text-[9.5px] flex-shrink-0" style={{ color: c.dim, fontFamily: mono }}>
            {m.hint}
          </span>
          {value === m.name && <Check size={12} color={c.accent} className="flex-shrink-0" />}
        </span>
        <span className="block text-[11px] mt-0.5" style={{ color: c.muted }}>{m.desc}</span>
      </span>
    </MenuRow>
  );

  return (
    <DropdownShell
      anchorRef={ref}
      open={open}
      width={306}
      drop={drop}
      footer={<>Switch anytime with <span style={{ fontFamily: mono, color: c.muted }}>/model</span></>}
      trigger={
        <Chip active={open} onClick={() => setOpen((o) => !o)}>
          <span className="rounded-full" style={{ width: 5, height: 5, backgroundColor: c.text }} />
          <span style={{ color: c.text, fontWeight: 500, fontFamily: value.startsWith("cai-") ? mono : undefined }}>{value}</span>
          <ChevronDown size={11} />
        </Chip>
      }
    >
      <div className="px-2 pb-1.5">
        <div className="flex items-center gap-1.5 px-2 rounded-lg" style={{ backgroundColor: c.chip, border: `1px solid ${c.borderSoft}` }}>
          <Search size={11} color={c.dim} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models"
            className="w-full bg-transparent outline-none py-1.5 text-[12px]"
            style={{ color: c.text }}
          />
        </div>
      </div>

      {notice && (
        <div className="mx-2 mb-1.5 px-2.5 py-1.5 rounded-lg text-[10.5px]" style={{ backgroundColor: "rgba(255,255,255,.05)", border: `1px solid ${c.borderSoft}`, color: c.muted }}>
          {notice}
        </div>
      )}

      {primary.map(row)}

      {extrasVisible && extra.length > 0 && (
        <>
          <div className="my-1" style={{ borderTop: `1px solid ${c.borderSoft}` }} />
          <MenuHeading>Other models</MenuHeading>
          {extra.map(row)}
        </>
      )}

      {!extrasVisible && extra.length > 0 && (
        <button
          onClick={() => setShowMore(true)}
          className="w-full flex items-center gap-2 px-3 py-2 mt-0.5 text-left transition-colors"
          style={{ color: c.muted, borderTop: `1px solid ${c.borderSoft}` }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chipHover)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <span className="text-[12px]">More models</span>
          <span className="text-[12px]" style={{ color: c.dim, letterSpacing: "0.06em" }}>…</span>
          <span className="ml-auto text-[9.5px] px-1.5 py-0.5 rounded" style={{ backgroundColor: c.chip, color: c.dim, fontFamily: mono }}>
            +{extra.length}
          </span>
        </button>
      )}

      {primary.length === 0 && extra.length === 0 && (
        <div className="px-3 py-5 text-center text-[11.5px]" style={{ color: c.dim }}>No models match.</div>
      )}
    </DropdownShell>
  );
}

/* ---------------- Effort — simple thinking levels ---------------- */
function Bars({ level, tone }: { level: number; tone: string }) {
  return (
    <span className="flex items-end gap-[2px] flex-shrink-0" style={{ height: 11 }}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          style={{
            width: 3,
            height: 3 + n * 2.5,
            borderRadius: 999,
            backgroundColor: n <= level ? tone : c.dim,
          }}
        />
      ))}
    </span>
  );
}

const stageOf = (m: EffortLevel["mode"]) => (m === "standard" ? 1 : m === "extended" ? 2 : 3);

export function EffortDropdown({ value, onChange, drop = "up" }: { value: string; onChange: (v: string) => void; drop?: "up" | "down" }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const ref = useOutsideClose(open, setOpen);
  const current = effortLevels.find((l) => l.label === value) ?? effortLevels[0];

  useEffect(() => {
    if (!open) setNotice(null);
  }, [open]);

  const commit = (level: EffortLevel) => {
    if (level.gated) {
      setNotice(`${level.label} needs ${level.gateNote}.`);
      return;
    }
    onChange(level.label);
    setOpen(false);
  };

  return (
    <DropdownShell
      anchorRef={ref}
      open={open}
      width={278}
      align="right"
      drop={drop}
      footer={<>Deeper thinking costs more tokens · <span style={{ fontFamily: mono, color: c.muted }}>⌥E</span></>}
      trigger={
        <Chip active={open} onClick={() => setOpen((o) => !o)}>
          <Bars level={stageOf(current.mode)} tone={c.text} />
          <span style={{ color: c.text, fontWeight: 500 }}>{current.label}</span>
          <ChevronDown size={11} />
        </Chip>
      }
    >
      <MenuHeading>Thinking</MenuHeading>

      {notice && (
        <div className="mx-2 mb-1.5 px-2.5 py-1.5 rounded-lg text-[10.5px]" style={{ backgroundColor: "rgba(255,255,255,.05)", border: `1px solid ${c.borderSoft}`, color: c.muted }}>
          {notice}
        </div>
      )}

      {effortLevels.map((level) => {
        const on = level.label === value;
        return (
          <MenuRow key={level.mode} selected={on} onClick={() => commit(level)}>
            <span className="mt-[3px]" style={{ opacity: level.gated ? 0.55 : 1 }}>
              <Bars level={stageOf(level.mode)} tone={on ? c.text : c.muted} />
            </span>
            <span className="flex-1 min-w-0" style={{ opacity: level.gated ? 0.55 : 1 }}>
              <span className="flex items-center gap-1.5">
                <span className="text-[13px] font-medium" style={{ color: c.text }}>{level.label}</span>
                {level.gated && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] px-1 py-[1px] rounded" style={{ backgroundColor: "rgba(255,255,255,.06)", color: c.muted }}>
                    <LockGlyph /> {level.gateNote}
                  </span>
                )}
                {on && <Check size={12} color={c.accent} className="ml-auto flex-shrink-0" />}
              </span>
              <span className="block text-[11px] mt-0.5 leading-snug" style={{ color: c.muted }}>{level.desc}</span>
            </span>
          </MenuRow>
        );
      })}
    </DropdownShell>
  );
}
