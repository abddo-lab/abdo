export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const ramp = (t: number, start: number, dur: number) => clamp01((t - start) / dur);
export const smooth = (p: number) => p * p * (3 - 2 * p);
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

import { useEffect, useRef, useState } from "react";

export function useClock(loopLength: number, running = true) {
  const [t, setT] = useState(0);
  const [loop, setLoop] = useState(0);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.08, (now - last) / 1000);
      last = now;
      setT((prev) => {
        const next = prev + dt;
        if (next >= loopLength) {
          setLoop((l) => l + 1);
          return next % loopLength;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loopLength, running]);

  return { t, loop };
}

export function useCountUp(target: number, duration = 1200, decimals = 2) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = clamp01((now - start) / duration);
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value.toFixed(decimals);
}

export function useTypewriter(lines: string[], speed = 26, linePause = 320) {
  const [done, setDone] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    let delay = 260;
    const push = (fn: () => void, ms: number) => {
      timers.current.push(window.setTimeout(fn, ms));
    };

    lines.forEach((line, lineIndex) => {
      push(() => setOutput((prev) => [...prev, ""]), delay);
      for (let i = 1; i <= line.length; i++) {
        push(
          () =>
            setOutput((prev) => {
              const next = [...prev];
              next[lineIndex] = line.slice(0, i);
              return next;
            }),
          delay + i * speed
        );
      }
      delay += line.length * speed + linePause;
    });

    push(() => setDone(true), delay);
    const list = timers.current;
    return () => list.forEach(window.clearTimeout);
  }, [lines, speed, linePause]);

  return { output, done };
}
