// src/lib/StreakCelebration.jsx — full-screen flame + confetti on a streak milestone.
import React, { useEffect, useMemo, useState } from "react";
import StreakFlame from "./StreakFlame";

const MILESTONES = [3, 7, 14, 30, 50, 100, 150, 365];
const COLORS = ["#FF7A1A", "#FFB347", "#FFE08A", "#22B07D", "#1CB0F6", "#E11D48", "#9B5DE5"];

export default function StreakCelebration({ streak }) {
  const [show, setShow] = useState(null);

  useEffect(() => {
    const n = Number(streak) || 0;
    if (!n) return;
    const reached = MILESTONES.filter((m) => n >= m).pop();
    if (!reached) return;
    let celebrated = 0;
    try {
      celebrated = Number(localStorage.getItem("hay_streak_celebrated") || 0);
    } catch {}
    if (reached > celebrated) {
      setShow(reached);
      try {
        localStorage.setItem("hay_streak_celebrated", String(reached));
      } catch {}
    }
  }, [streak]);

  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }).map(() => ({
        left: Math.random() * 100,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: Math.random() * 0.8,
        dur: 2.2 + Math.random() * 1.6,
        dx: Math.round(Math.random() * 220 - 110),
        size: 6 + Math.round(Math.random() * 5),
        rot: Math.round(Math.random() * 360),
      })),
    [show]
  );

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" onClick={() => setShow(null)} />

      {/* confetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map((p, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              top: "-6vh",
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${Math.round(p.size * 1.6)}px`,
              background: p.color,
              borderRadius: "2px",
              "--dx": `${p.dx}px`,
              transform: `rotate(${p.rot}deg)`,
              animation: `confettiFall ${p.dur}s linear ${p.delay}s infinite`,
            }}
          />
        ))}
      </div>

      <div
        className="relative w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl ring-1 ring-slate-200"
        style={{ animation: "celebPop .45s cubic-bezier(.2,.8,.2,1)" }}
      >
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-brand-600">
          🎉 Streak milestone unlocked
        </div>
        <div className="mx-auto mt-4 w-fit">
          <StreakFlame size={120} lit />
        </div>
        <div className="mt-3 flex items-baseline justify-center gap-2">
          <span className="font-display text-5xl font-extrabold tabular-nums text-brand-600">{show}</span>
          <span className="font-display text-xl font-extrabold text-slate-800">days in a row</span>
        </div>
        <p className="mt-2 font-semibold text-slate-500">
          You've practiced {show} days straight without missing one. Come back tomorrow to keep it going!
        </p>
        <button onClick={() => setShow(null)} className="btn3d btn3d-brand mt-6 w-full uppercase">
          Keep going
        </button>
      </div>
    </div>
  );
}
