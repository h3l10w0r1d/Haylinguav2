// src/lib/ChestOpening.jsx — full-screen, juicy chest-opening reward sequence.
// Phases: shake (anticipation) → open (lid pops, light burst + confetti) →
// reward (gems rise & count up). Plays a celebratory sound on open.
import React, { useEffect, useMemo, useState } from "react";
import { Gem } from "lucide-react";
import { sfx } from "./sfx";

const CONFETTI_COLORS = ["#FF7A1A", "#FFB347", "#FFE08A", "#22B07D", "#1CB0F6", "#E11D48", "#9B5DE5", "#FCD34D"];

function ChestSvg({ open }) {
  return (
    <svg width="200" height="180" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="chestBody" x1="100" y1="86" x2="100" y2="168" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B45309" />
          <stop offset="1" stopColor="#7C3A06" />
        </linearGradient>
        <linearGradient id="chestLid" x1="100" y1="40" x2="100" y2="92" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D97706" />
          <stop offset="1" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id="chestGold" x1="100" y1="0" x2="100" y2="180" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
      </defs>

      {/* glow inside when open */}
      {open && <ellipse cx="100" cy="90" rx="58" ry="22" fill="#FFE9A8" opacity="0.9" />}

      {/* body */}
      <rect x="34" y="86" width="132" height="82" rx="12" fill="url(#chestBody)" />
      <rect x="34" y="118" width="132" height="12" fill="url(#chestGold)" />
      {/* gold corners */}
      <rect x="34" y="86" width="10" height="82" fill="url(#chestGold)" opacity="0.85" />
      <rect x="156" y="86" width="10" height="82" fill="url(#chestGold)" opacity="0.85" />
      {/* lock */}
      <rect x="90" y="112" width="20" height="24" rx="4" fill="url(#chestGold)" />
      <circle cx="100" cy="122" r="4" fill="#7C3A06" />

      {/* lid (rotates open) */}
      <g className={open ? "chest-lid chest-lid-open" : "chest-lid"}>
        <path d="M34 92 V70 C34 49 62 38 100 38 C138 38 166 49 166 70 V92 Z" fill="url(#chestLid)" />
        <rect x="34" y="84" width="132" height="10" rx="3" fill="url(#chestGold)" />
        <rect x="92" y="78" width="16" height="14" rx="3" fill="url(#chestGold)" />
      </g>
    </svg>
  );
}

export default function ChestOpening({ reward = 0, onClose }) {
  const [phase, setPhase] = useState("shake"); // shake → open → reward
  const [count, setCount] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => {
      setPhase("open");
      try { sfx.complete(); } catch {}
    }, 850);
    const t2 = setTimeout(() => setPhase("reward"), 1250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    if (phase !== "reward") return;
    const target = Number(reward) || 0;
    if (target <= 0) return;
    let cur = 0;
    const step = Math.max(1, Math.round(target / 24));
    const id = setInterval(() => {
      cur = Math.min(target, cur + step);
      setCount(cur);
      if (cur >= target) clearInterval(id);
    }, 35);
    return () => clearInterval(id);
  }, [phase, reward]);

  const opened = phase === "open" || phase === "reward";

  const confetti = useMemo(
    () =>
      Array.from({ length: 36 }).map(() => {
        const ang = Math.random() * Math.PI * 2;
        const dist = 120 + Math.random() * 220;
        return {
          tx: Math.cos(ang) * dist,
          ty: Math.sin(ang) * dist - 60, // bias upward
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          size: 7 + Math.round(Math.random() * 7),
          rot: `${Math.round(Math.random() * 540 - 270)}deg`,
          delay: Math.random() * 0.12,
          dur: 0.9 + Math.random() * 0.7,
        };
      }),
    []
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={() => phase === "reward" && onClose?.()} />

      {/* white flash on burst */}
      {opened && <div className="chest-flash pointer-events-none absolute inset-0 bg-white" />}

      <div className="relative flex flex-col items-center">
        {/* chest stage — rays + confetti are centered on the chest itself */}
        <div className="relative" style={{ width: 200, height: 180 }}>
          {/* light rays behind the chest */}
          {opened && (
            <div
              className="chest-rays pointer-events-none absolute left-1/2 top-1/2 z-0 h-[480px] w-[480px]"
              style={{
                marginLeft: "-240px",
                marginTop: "-240px",
                background:
                  "repeating-conic-gradient(from 0deg, rgba(255,214,120,.55) 0deg 9deg, rgba(255,214,120,0) 9deg 18deg)",
                borderRadius: "9999px",
                maskImage: "radial-gradient(circle, #000 35%, transparent 70%)",
                WebkitMaskImage: "radial-gradient(circle, #000 35%, transparent 70%)",
              }}
            />
          )}

          {/* confetti burst — emitted from the chest center */}
          {opened && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-20">
              {confetti.map((p, i) => (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    width: `${p.size}px`,
                    height: `${Math.round(p.size * 1.5)}px`,
                    background: p.color,
                    borderRadius: "2px",
                    "--tx": `${p.tx}px`,
                    "--ty": `${p.ty}px`,
                    "--rot": p.rot,
                    animation: `burstOut ${p.dur}s ease-out ${p.delay}s forwards`,
                  }}
                />
              ))}
            </div>
          )}

          {/* chest */}
          <div className={"absolute inset-0 z-10 chest-pop " + (phase === "shake" ? "chest-shake" : opened ? "chest-jump" : "")}>
            <ChestSvg open={opened} />
          </div>
        </div>

        {/* reward */}
        {phase === "reward" && (
          <div className="reward-rise relative mt-2 flex flex-col items-center">
            <div className="flex items-center gap-2 font-display text-5xl font-extrabold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.4)]">
              <Gem className="h-10 w-10 text-feather-300" />
              <span className="tabular-nums">+{count}</span>
            </div>
            <div className="mt-1 text-sm font-extrabold uppercase tracking-[0.2em] text-white/80">gems earned</div>
            <button onClick={() => onClose?.()} className="btn3d btn3d-brand mt-6 w-56 uppercase">
              Collect
            </button>
          </div>
        )}

        {phase !== "reward" && (
          <div className="relative mt-6 font-display text-lg font-extrabold text-white/90">Opening…</div>
        )}
      </div>
    </div>
  );
}
