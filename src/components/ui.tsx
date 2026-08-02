import type { ReactNode } from "react";
import { cn } from "../utils/cn";
import { Icon, type IconName } from "../icons";

export const TONE: Record<string, { fg: string; bg: string }> = {
  accent: { fg: "text-[var(--accent)]", bg: "bg-[var(--accent-soft)]" },
  green: { fg: "text-[var(--green)]", bg: "bg-[var(--green-soft)]" },
  red: { fg: "text-[var(--red)]", bg: "bg-[var(--red-soft)]" },
  amber: { fg: "text-[var(--amber)]", bg: "bg-[var(--amber-soft)]" },
  blue: { fg: "text-[var(--blue)]", bg: "bg-[var(--blue-soft)]" },
  muted: { fg: "text-[var(--muted)]", bg: "bg-[var(--panel-3)]" },
};

export function Badge({
  children,
  tone = "muted",
  icon,
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof TONE | string;
  icon?: IconName;
  className?: string;
}) {
  const t = TONE[tone] ?? TONE.muted;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[3px] text-[10.5px] font-semibold tracking-tight",
        t.bg,
        t.fg,
        className,
      )}
    >
      {icon && <Icon name={icon} size={10} strokeWidth={2} />}
      {children}
    </span>
  );
}

export function IconBtn({
  icon,
  onClick,
  title,
  active,
  size = 15,
  className,
}: {
  icon: IconName;
  onClick?: () => void;
  title?: string;
  active?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "flex items-center justify-center rounded-md p-1.5 transition duration-150",
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
          : "text-[var(--faint)] hover:bg-[var(--panel-3)] hover:text-[var(--text)]",
        className,
      )}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

export function Btn({
  children,
  onClick,
  variant = "ghost",
  icon,
  className,
  disabled,
}: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "soft" | "accent";
  icon?: IconName;
  className?: string;
  disabled?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";
  const styles = {
    primary: "bg-[var(--text)] text-[var(--app)] hover:opacity-85",
    accent: "grad-accent text-white shadow-[var(--shadow-sm)] hover:brightness-110",
    soft: "bg-[var(--accent-soft)] text-[var(--accent-ink)] hover:bg-[var(--accent-soft-2)]",
    ghost:
      "border border-[var(--border)] bg-[var(--panel)] text-[var(--text-2)] hover:border-[var(--border-2)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]",
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled} className={cn(base, styles, className)}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </button>
  );
}

export function Tile({ color, glyph, size = 30 }: { color: string; glyph: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[8px] font-semibold text-white shadow-[var(--shadow-sm)]"
      style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}
    >
      {glyph}
    </span>
  );
}

export function Avatar({ initials, size = 22 }: { initials: string; size?: number }) {
  return (
    <span
      className="grad-accent flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-[var(--panel)]"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </span>
  );
}

export function Spark({ data, tone = "accent" }: { data: number[]; tone?: string }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const pts = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 26 - ((d - min) / Math.max(max - min, 1)) * 22 - 2;
      return `${x},${y}`;
    })
    .join(" ");
  const color = TONE[tone]?.fg ?? TONE.accent.fg;
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className={cn("h-7 w-full", color)}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <polygon points={`0,28 ${pts} 100,28`} fill="currentColor" opacity="0.1" />
    </svg>
  );
}

export function Progress({ value, tone = "accent" }: { value: number; tone?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel-3)]">
      <div
        className={cn("a-bar h-full rounded-full", tone === "accent" ? "grad-accent" : "bg-[var(--blue)]")}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between pb-2.5">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.07em] text-[var(--faint)]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Renders **bold** segments inside plain text. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <span className={className}>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**"))
          return (
            <strong key={i} className="font-semibold text-[var(--text)]">
              {p.slice(2, -2)}
            </strong>
          );
        if (p.startsWith("`") && p.endsWith("`"))
          return (
            <code
              key={i}
              className="rounded bg-[var(--panel-3)] px-1 py-px font-mono text-[0.9em] text-[var(--accent-ink)]"
            >
              {p.slice(1, -1)}
            </code>
          );
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

export function Spinner({ size = 13 }: { size?: number }) {
  return <Icon name="spinner" size={size} className="a-spin text-[var(--accent)]" strokeWidth={2} />;
}
