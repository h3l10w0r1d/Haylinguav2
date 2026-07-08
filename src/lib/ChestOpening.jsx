// src/lib/ChestOpening.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Gem } from "lucide-react";
import { sfx } from "./sfx";

const CONFETTI_COLORS = ["#FF7A1A","#FFB347","#FFE08A","#22B07D","#1CB0F6","#E11D48","#9B5DE5","#FCD34D"];

function ChestSvg({ open }) {
  return (
    <svg width="200" height="180" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="chestBody" x1="100" y1="86" x2="100" y2="168" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B45309" /><stop offset="1" stopColor="#7C3A06" />
        </linearGradient>
        <linearGradient id="chestLid" x1="100" y1="40" x2="100" y2="92" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D97706" /><stop offset="1" stopColor="#B45309" />
        </linearGradient>
        <linearGradient id="chestGold" x1="100" y1="0" x2="100" y2="180" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A" /><stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      {open && <ellipse cx="100" cy="90" rx="58" ry="22" fill="#FFE9A8" opacity="0.9" />}
      <rect x="34" y="86" width="132" height="82" rx="12" fill="url(#chestBody)" />
      <rect x="34" y="118" width="132" height="12" fill="url(#chestGold)" />
      <rect x="34" y="86" width="10" height="82" fill="url(#chestGold)" opacity="0.85" />
      <rect x="156" y="86" width="10" height="82" fill="url(#chestGold)" opacity="0.85" />
      <rect x="90" y="112" width="20" height="24" rx="4" fill="url(#chestGold)" />
      <circle cx="100" cy="122" r="4" fill="#7C3A06" />
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
  // `shown` drives CSS transitions — never relies on animation-fill-mode
  const [shown, setShown] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Double rAF: paints opacity:0/scale:0.3 first, then transitions to visible
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setShown(true))
    );
    const t1 = setTimeout(() => {
      setPhase("open");
      try { sfx.complete(); } catch {}
    }, 850);
    const t2 = setTimeout(() => setPhase("reward"), 1250);
    const t3 = setTimeout(() => onClose?.(), 5200);
    return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    if (phase !== "reward") return;
    const target = Number(reward) || 0;
    if (!target) return;
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

  const confetti = useMemo(() =>
    Array.from({ length: 36 }).map(() => {
      const ang = Math.random() * Math.PI * 2;
      const dist = 120 + Math.random() * 200;
      return {
        tx: Math.cos(ang) * dist,
        ty: Math.sin(ang) * dist - 60,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: 7 + Math.round(Math.random() * 7),
        rot: `${Math.round(Math.random() * 540 - 270)}deg`,
        delay: Math.random() * 0.12,
        dur: 0.9 + Math.random() * 0.6,
      };
    }), []
  );

  return (
    <div
      onClick={() => phase === "reward" && onClose?.()}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(15,23,42,0.88)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        // Fade in via React state — no animation-fill-mode involved
        opacity: shown ? 1 : 0,
        transition: "opacity 0.25s ease",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Chest stage */}
        <div style={{ position: "relative", width: 200, height: 180 }}>
          {/* Rays — rendered behind chest by DOM order */}
          {opened && (
            <div
              className="chest-rays-spin"
              style={{
                position: "absolute", left: "50%", top: "50%",
                width: 480, height: 480,
                marginLeft: -240, marginTop: -240,
                pointerEvents: "none",
              }}
            >
              <div
                className="chest-rays-burst"
                style={{
                  width: "100%", height: "100%",
                  background: "repeating-conic-gradient(from 0deg,rgba(255,214,120,.55) 0deg 9deg,rgba(255,214,120,0) 9deg 18deg)",
                  borderRadius: "50%",
                  maskImage: "radial-gradient(circle,#000 35%,transparent 70%)",
                  WebkitMaskImage: "radial-gradient(circle,#000 35%,transparent 70%)",
                }}
              />
            </div>
          )}

          {/* Chest — scale-in via React transition, opacity always 1 */}
          <div
            style={{
              position: "absolute", inset: 0,
              transform: shown ? "scale(1) translateY(0)" : "scale(0.3) translateY(30px)",
              transition: "transform 0.45s cubic-bezier(0.2,0.8,0.2,1)",
            }}
          >
            <div
              className={phase === "shake" ? "chest-shake" : opened ? "chest-jump" : ""}
              style={{ width: "100%", height: "100%" }}
            >
              <ChestSvg open={opened} />
            </div>
          </div>

          {/* Confetti — rendered after chest so it appears in front */}
          {opened && (
            <div style={{ position: "absolute", left: "50%", top: "50%", pointerEvents: "none" }}>
              {confetti.map((p, i) => (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    width: p.size, height: Math.round(p.size * 1.5),
                    background: p.color, borderRadius: 2,
                    "--tx": `${p.tx}px`, "--ty": `${p.ty}px`, "--rot": p.rot,
                    animation: `burstOut ${p.dur}s ease-out ${p.delay}s forwards`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* "Opening..." label */}
        {phase !== "reward" && (
          <p style={{
            marginTop: 24,
            color: "rgba(255,255,255,0.9)",
            fontFamily: "'Baloo 2','Nunito',sans-serif",
            fontWeight: 800, fontSize: 18,
            margin: "24px 0 0",
          }}>
            Opening…
          </p>
        )}

        {/* Reward panel — uses reward-rise animation (scale only, no opacity) */}
        {phase === "reward" && (
          <div
            className="reward-rise"
            style={{ marginTop: 8, display: "flex", flexDirection: "column", alignItems: "center" }}
          >
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              fontFamily: "'Baloo 2','Nunito',sans-serif",
              fontSize: 48, fontWeight: 800, color: "white",
              filter: "drop-shadow(0 2px 8px rgba(0,0,0,.4))",
            }}>
              <Gem style={{ width: 40, height: 40, color: "#38bdf8" }} />
              <span style={{ fontVariantNumeric: "tabular-nums" }}>+{count}</span>
            </div>
            <p style={{
              margin: "4px 0 0",
              fontSize: 12, fontWeight: 800,
              letterSpacing: "0.2em", textTransform: "uppercase",
              color: "rgba(255,255,255,0.8)",
            }}>
              gems earned
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); onClose?.(); }}
              className="btn3d btn3d-brand"
              style={{ marginTop: 24, width: 224, textTransform: "uppercase" }}
            >
              Collect
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
