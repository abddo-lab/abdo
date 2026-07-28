import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Check, ChevronDown } from "lucide-react";
import { c, mono } from "./theme";
import { effortLevels, modeOptions, modelOptions } from "./data";

export function useOutsideClose(open: boolean, setOpen: (v: boolean) => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const escape = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [open, setOpen]);
  return ref;
}

export function DropdownShell({ anchorRef, open, trigger, children, footer, width = 268, align = "left", drop = "up" }: {
  anchorRef: RefObject<HTMLDivElement | null>; open: boolean; trigger: ReactNode; children: ReactNode; footer?: ReactNode; width?: number; align?: "left" | "right"; drop?: "up" | "down";
}) {
  return (
    <div className="relative" ref={anchorRef}>
      {trigger}
      {open && (
        <div className="absolute z-40 rounded-xl overflow-hidden popIn menuPanel" style={{
          width, left: align === "left" ? 0 : "auto", right: align === "right" ? 0 : "auto",
          [drop === "up" ? "bottom" : "top"]: "calc(100% + 8px)",
          backgroundColor: "rgba(14,14,14,.95)", backdropFilter: "blur(20px) saturate(140%)", border: `1px solid ${c.borderStrong}`, boxShadow: c.shadowPop,
        }}>
          <div className="max-h-[340px] overflow-y-auto py-1.5">{children}</div>
          {footer && <div className="px-3 py-1.5 text-[10.5px] flex items-center gap-2" style={{ borderTop: `1px solid ${c.borderSoft}`, color: c.faint, backgroundColor: "rgba(0,0,0,.4)" }}>{footer}</div>}
        </div>
      )}
    </div>
  );
}

export function MenuHeading({ children }: { children: string }) {
  return <div className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase" style={{ color: c.faint, letterSpacing: ".09em" }}>{children}</div>;
}

export function MenuRow({ selected, onClick, children }: { selected?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="w-full relative flex items-start gap-2.5 pl-3 pr-2.5 py-1.5 text-left transition-colors"
      style={{ backgroundColor: selected ? c.chip : "transparent" }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chipHover)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = selected ? c.chip : "transparent")}>
      {selected && <span className="absolute left-0 top-1.5 bottom-1.5 rounded-r" style={{ width: 2, backgroundColor: c.accent }} />}
      {children}
    </button>
  );
}

export function Chip({ children, onClick, active }: { children: ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors text-xs"
      style={{ backgroundColor: active ? c.chipHover : "transparent", border: `1px solid ${active ? c.borderStrong : c.border}`, color: c.muted }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.chipHover)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = active ? c.chipHover : "transparent")}>
      {children}
    </button>
  );
}

/* ─── Mode ─── */
export function ModeDropdown({ value, onChange, drop = "up" }: { value: string; onChange: (v: string) => void; drop?: "up" | "down" }) {
  const [open, setOpen] = useState(false); const ref = useOutsideClose(open, setOpen);
  return (
    <DropdownShell anchorRef={ref} open={open} drop={drop} footer={<>Cycle with <span style={{ fontFamily: mono, color: c.muted }}>shift + tab</span></>}
      trigger={<Chip active={open} onClick={() => setOpen((o) => !o)}>
        <span className="rounded-full" style={{ width: 5, height: 5, backgroundColor: c.accent }} />
        <span style={{ color: c.text, fontWeight: 500 }}>{value}</span><ChevronDown size={11} />
      </Chip>}>
      <MenuHeading>Mode</MenuHeading>
      {modeOptions.map((m) => (
        <MenuRow key={m.label} selected={value === m.label} onClick={() => { onChange(m.label); setOpen(false); }}>
          <span className="flex-1">
            <span className="flex items-center gap-2 text-[13px] font-medium" style={{ color: c.text }}>{m.label}{value === m.label && <Check size={12} color={c.accent} className="ml-auto" />}</span>
            <span className="block text-[11.5px]" style={{ color: c.muted }}>{m.sub}</span>
          </span>
        </MenuRow>
      ))}
    </DropdownShell>
  );
}

/* ─── Model ─── */
export function ModelDropdown({ value, onChange, drop = "up" }: { value: string; onChange: (v: string) => void; drop?: "up" | "down" }) {
  const [open, setOpen] = useState(false); const ref = useOutsideClose(open, setOpen);
  return (
    <DropdownShell anchorRef={ref} open={open} drop={drop} width={280}
      footer={<span>All models available · select based on your task</span>}
      trigger={<Chip active={open} onClick={() => setOpen((o) => !o)}>
        <span className="rounded-full" style={{ width: 5, height: 5, backgroundColor: value === "auto" ? c.accent : c.text }} />
        <span style={{ color: c.text, fontWeight: 500, fontFamily: mono }}>{value}</span><ChevronDown size={11} />
      </Chip>}>
      <MenuHeading>Model</MenuHeading>
      {modelOptions.map((m) => (
        <MenuRow key={m.name} selected={value === m.name} onClick={() => { onChange(m.name); setOpen(false); }}>
          <span className="flex-1">
            <span className="flex items-center gap-1.5">
              <span className="text-[13px] font-medium" style={{ color: c.text, fontFamily: mono }}>{m.name}</span>
              {m.mark && <span className="text-[8px] px-1 py-[1px] rounded font-semibold" style={{ backgroundColor: "rgba(255,255,255,.08)", color: c.muted }}>{m.mark}</span>}
              <span className="ml-auto text-[9.5px]" style={{ color: c.dim }}>{m.hint}</span>
              {value === m.name && <Check size={12} color={c.accent} />}
            </span>
            <span className="block text-[11px] mt-0.5" style={{ color: c.muted }}>{m.desc}</span>
          </span>
        </MenuRow>
      ))}
    </DropdownShell>
  );
}

/* ─── Effort (2 levels: Zinc x1.5, Manguzuime x4) ─── */
function Bars({ level, tone }: { level: number; tone: string }) {
  return (
    <span className="flex items-end gap-[2px] flex-shrink-0" style={{ height: 13 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ width: 3, height: 2 + n * 2, borderRadius: 999, backgroundColor: n <= level ? tone : c.dim }} />
      ))}
    </span>
  );
}

export function EffortDropdown({ value, onChange, drop = "up" }: { value: string; onChange: (v: string) => void; drop?: "up" | "down" }) {
  const [open, setOpen] = useState(false); const ref = useOutsideClose(open, setOpen);
  const current = effortLevels.find((l) => l.label === value) ?? effortLevels[0]; // default to Zinc

  return (
    <DropdownShell anchorRef={ref} open={open} width={320} align="right" drop={drop}
      footer={<div className="flex items-center justify-between w-full">
        <span>Higher effort = more tokens + better quality</span>
        <span style={{ fontFamily: mono }}>×{current.costMultiplier} cost</span>
      </div>}
      trigger={<Chip active={open} onClick={() => setOpen((o) => !o)}>
        <Bars level={current.barLevel} tone={c.text} />
        <span style={{ color: c.text, fontWeight: 500 }}>{current.label}</span><ChevronDown size={11} />
      </Chip>}>
      <MenuHeading>Effort Mode</MenuHeading>
      {effortLevels.map((level) => {
        const on = level.label === value;
        return (
          <MenuRow key={level.value} selected={on} onClick={() => { onChange(level.label); setOpen(false); }}>
            <span className="mt-[2px]"><Bars level={level.barLevel} tone={on ? c.text : c.muted} /></span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="text-[13px] font-medium" style={{ color: c.text }}>{level.label}</span>
                <span className="text-[9px] px-1 py-[1px] rounded" style={{ backgroundColor: "rgba(255,255,255,.06)", color: c.dim, fontFamily: mono }}>×{level.costMultiplier}</span>
                {level.value === "thinking" && <span className="text-[8px] px-1 py-[1px] rounded" style={{ backgroundColor: "rgba(255,255,255,.08)", color: c.muted }}>DEFAULT</span>}
                {on && <Check size={12} color={c.accent} className="ml-auto" />}
              </span>
              <span className="block text-[11px] mt-0.5 leading-snug" style={{ color: c.muted }}>{level.desc}</span>
              <span className="block text-[10px] mt-0.5" style={{ color: c.dim }}>{level.detail}</span>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {level.features.map((f) => (
                  <span key={f} className="text-[8px] px-1.5 py-[2px] rounded" style={{ backgroundColor: "rgba(255,255,255,.05)", color: c.faint }}>{f}</span>
                ))}
              </div>
            </span>
          </MenuRow>
        );
      })}
    </DropdownShell>
  );
}
