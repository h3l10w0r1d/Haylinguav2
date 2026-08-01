// src/lib/useCountUp.js — animated number tween, mirrors mobile's
// mobile/src/lib/useCountUp.js (Duolingo's signature XP-counter tick rather
// than snap). Two modes via startFromZero:
//  - false (default, e.g. dashboard stat pips): the FIRST render shows the
//    value instantly (no animating from 0 on page load) — only later
//    changes tween from the previous displayed value to the new one, since
//    a live stat should visibly tick from what it was, not restart at zero.
//  - true (e.g. LessonCompletionScreen): always counts up from 0 on mount,
//    for a one-shot "+42 XP" reveal.
// Respects prefers-reduced-motion by snapping instantly.
import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function useCountUp(target, { duration = 700, startFromZero = false } = {}) {
  const to = Number.isFinite(target) ? target : 0;
  const [display, setDisplay] = useState(startFromZero ? 0 : to);
  const fromRef = useRef(startFromZero ? 0 : to);
  const isFirstRun = useRef(true);

  useEffect(() => {
    const from = isFirstRun.current && startFromZero ? 0 : fromRef.current;
    isFirstRun.current = false;

    if (from === to || prefersReducedMotion()) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }

    let raf;
    const start = Date.now();
    function tick() {
      const p = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);

  return display;
}
