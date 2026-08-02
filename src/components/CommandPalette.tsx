import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../utils/cn";
import { Icon } from "../icons";
import { commands, type CommandItem, type Thread } from "../data";

interface Props {
  open: boolean;
  threads: Thread[];
  onClose: () => void;
  onRun: (i: CommandItem) => void;
  onThread: (id: string) => void;
}

/** subsequence fuzzy score — higher is better, -1 means no match */
function score(needle: string, hay: string) {
  if (!needle) return 0;
  const n = needle.toLowerCase();
  const h = hay.toLowerCase();
  let hi = 0;
  let s = 0;
  let streak = 0;
  for (const ch of n) {
    const idx = h.indexOf(ch, hi);
    if (idx === -1) return -1;
    streak = idx === hi ? streak + 1 : 0;
    s += 10 - Math.min(idx - hi, 8) + streak * 3 + (idx === 0 || h[idx - 1] === " " || h[idx - 1] === "/" ? 6 : 0);
    hi = idx + 1;
  }
  return s;
}

const SECTIONS: CommandItem["section"][] = ["Navigate", "Thread", "Workspace"];

export default function CommandPalette({ open, threads, onClose, onRun, onThread }: Props) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setCursor(0);
    const t = setTimeout(() => input.current?.focus(), 25);
    return () => clearTimeout(t);
  }, [open]);

  const cmdHits = useMemo(
    () =>
      commands
        .map((c) => ({ c, s: score(q, c.label) }))
        .filter((x) => x.s >= 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.c),
    [q],
  );

  const threadHits = useMemo(
    () =>
      threads
        .map((t) => ({ t, s: score(q, t.title + " " + t.branch) }))
        .filter((x) => x.s >= 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 5)
        .map((x) => x.t),
    [q, threads],
  );

  const flat: ({ type: "cmd"; c: CommandItem } | { type: "thread"; t: Thread })[] = [
    ...(q ? cmdHits : SECTIONS.flatMap((s) => cmdHits.filter((c) => c.section === s))).map(
      (c) => ({ type: "cmd" as const, c }),
    ),
    ...threadHits.map((t) => ({ type: "thread" as const, t })),
  ];

  useEffect(() => setCursor(0), [q]);
  if (!open) return null;

  const key = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      const it = flat[cursor];
      if (!it) return;
      it.type === "cmd" ? onRun(it.c) : onThread(it.t.id);
    } else if (e.key === "Escape") onClose();
  };

  let idx = -1;
  const groups = q
    ? [{ label: "Best matches", items: cmdHits }]
    : SECTIONS.map((s) => ({ label: s, items: cmdHits.filter((c) => c.section === s) }));

  return (
    <div className="a-in fixed inset-0 z-50 bg-[#120c22]/35 backdrop-blur-[3px]" onMouseDown={onClose}>
      <div
        className="a-pop mx-auto mt-[12vh] w-[min(600px,92vw)] overflow-hidden rounded-2xl border border-[var(--border-2)] bg-[var(--panel)] shadow-[var(--shadow-lg)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-4 py-3">
          <Icon name="command" size={15} className="shrink-0 text-[var(--accent)]" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={key}
            placeholder="Search commands, threads and files…"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--faint)]"
          />
          <kbd className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-1.5 py-0.5 text-[10px] text-[var(--faint)]">esc</kbd>
        </div>

        <div className="max-h-[380px] overflow-y-auto py-1.5">
          {flat.length === 0 && (
            <p className="px-4 py-8 text-center text-[12.5px] text-[var(--faint)]">No results for “{q}”.</p>
          )}

          {groups.map((g) =>
            g.items.length === 0 ? null : (
              <div key={g.label}>
                <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--faint)]">
                  {g.label}
                </p>
                {g.items.map((c) => {
                  idx += 1;
                  const i = idx;
                  const on = i === cursor;
                  return (
                    <button
                      key={c.id}
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => onRun(c)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] transition",
                        on ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "text-[var(--text-2)]",
                      )}
                    >
                      <Icon name={c.icon} size={14} className={on ? "text-[var(--accent)]" : "text-[var(--faint)]"} />
                      <span className="flex-1 truncate font-medium">{c.label}</span>
                      {c.hint && <kbd className="text-[10.5px] text-[var(--faint)]">{c.hint}</kbd>}
                      {on && <Icon name="enter" size={12} className="text-[var(--accent)]" />}
                    </button>
                  );
                })}
              </div>
            ),
          )}

          {threadHits.length > 0 && (
            <div>
              <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--faint)]">
                Threads
              </p>
              {threadHits.map((t) => {
                idx += 1;
                const i = idx;
                const on = i === cursor;
                return (
                  <button
                    key={t.id}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => onThread(t.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] transition",
                      on ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "text-[var(--text-2)]",
                    )}
                  >
                    <Icon name="chat" size={14} className={on ? "text-[var(--accent)]" : "text-[var(--faint)]"} />
                    <span className="flex-1 truncate font-medium">{t.title}</span>
                    <span className="truncate font-mono text-[10.5px] text-[var(--faint)]">{t.branch}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-[var(--border)] bg-[var(--panel-2)] px-4 py-2 text-[10.5px] text-[var(--faint)]">
          <span className="flex items-center gap-1"><kbd>↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd>↵</kbd> run</span>
          <span className="ml-auto flex items-center gap-1">
            <Icon name="logo" size={11} className="text-[var(--accent)]" /> Cursor
          </span>
        </div>
      </div>
    </div>
  );
}
