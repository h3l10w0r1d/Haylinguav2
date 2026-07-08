// src/lib/ChestOpening.jsx — Duolingo-style full-screen chest opening sequence.
import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { Gem } from "lucide-react";
import { sfx } from "./sfx";

// ── Chest SVG — gold + blue flat-design inspired by Duolingo ────────────────
function ChestSvg({ open }) {
  return (
    <svg
      width="240" height="210" viewBox="0 0 240 210"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id="co-body" x1="120" y1="100" x2="120" y2="194" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1A82CC"/><stop offset="1" stopColor="#0D5B9A"/>
        </linearGradient>
        <linearGradient id="co-lid" x1="120" y1="34" x2="120" y2="110" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2194D8"/><stop offset="1" stopColor="#1570B0"/>
        </linearGradient>
        <linearGradient id="co-gold" x1="120" y1="34" x2="120" y2="196" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE44D"/><stop offset="1" stopColor="#C88800"/>
        </linearGradient>
        <radialGradient id="co-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFBD0" stopOpacity="0.96"/>
          <stop offset="100%" stopColor="#FFE44D" stopOpacity="0"/>
        </radialGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="120" cy="203" rx="80" ry="9" fill="rgba(0,0,0,0.16)"/>

      {/* ── Body ── */}
      <rect x="14" y="100" width="212" height="96" rx="16" fill="url(#co-body)"/>
      {/* Body inner panel */}
      <rect x="28" y="113" width="184" height="73" rx="8" fill="#2496DC" opacity="0.4"/>
      {/* Left trim */}
      <rect x="14" y="100" width="20" height="96" rx="6" fill="url(#co-gold)"/>
      {/* Right trim */}
      <rect x="206" y="100" width="20" height="96" rx="6" fill="url(#co-gold)"/>
      {/* Horizontal band */}
      <rect x="14" y="146" width="212" height="20" fill="url(#co-gold)"/>
      {/* Lock plate */}
      <rect x="98" y="118" width="44" height="36" rx="10" fill="url(#co-gold)"/>
      {/* Lock outer ring */}
      <circle cx="120" cy="138" r="10" fill="#9B7000"/>
      {/* Lock inner pip */}
      <circle cx="120" cy="138" r="5" fill="#FFE44D"/>

      {/* ── Lid ── */}
      <g className={open ? "chest-lid chest-lid-open" : "chest-lid"}>
        <path d="M14 110 V80 C14 52 58 34 120 34 C182 34 226 52 226 80 V110 Z" fill="url(#co-lid)"/>
        <path d="M34 106 V82 C34 62 68 48 120 48 C172 48 206 62 206 82 V106 Z" fill="#2496DC" opacity="0.4"/>
        {/* Lid bottom trim */}
        <rect x="14" y="96" width="212" height="16" rx="4" fill="url(#co-gold)"/>
        {/* Lid left trim */}
        <rect x="14" y="34" width="20" height="62" rx="6" fill="url(#co-gold)" opacity="0.9"/>
        {/* Lid right trim */}
        <rect x="206" y="34" width="20" height="62" rx="6" fill="url(#co-gold)" opacity="0.9"/>
        {/* Hinge tab */}
        <rect x="104" y="90" width="32" height="16" rx="6" fill="url(#co-gold)"/>
      </g>

      {/* Inner glow when open */}
      {open && <ellipse cx="120" cy="106" rx="62" ry="22" fill="url(#co-glow)"/>}
    </svg>
  );
}

// ── 4-pointed sparkle star ───────────────────────────────────────────────────
function Sparkle({ style, size = 14, color = "rgba(255,255,255,0.75)", delay = 0 }) {
  return (
    <div className="chest-sparkle" style={{ position: "absolute", animationDelay: `${delay}s`, ...style }}>
      <svg viewBox="0 0 24 24" width={size} height={size}>
        <path
          d="M12 0 L13.6 10.4 L24 12 L13.6 13.6 L12 24 L10.4 13.6 L0 12 L10.4 10.4 Z"
          fill={color}
        />
      </svg>
    </div>
  );
}

// ── Floating background gem decorations ─────────────────────────────────────
const BG_GEMS = [
  { left: "6%",  top: "10%", size: 36, opacity: 0.16 },
  { left: "80%", top: "6%",  size: 22, opacity: 0.20 },
  { left: "4%",  top: "52%", size: 28, opacity: 0.13 },
  { left: "84%", top: "48%", size: 40, opacity: 0.12 },
  { left: "12%", top: "82%", size: 20, opacity: 0.18 },
  { left: "76%", top: "80%", size: 30, opacity: 0.14 },
  { left: "44%", top: "4%",  size: 18, opacity: 0.17 },
  { left: "50%", top: "90%", size: 16, opacity: 0.15 },
];

const CONFETTI_COLORS = [
  "#FF7A1A","#FFB347","#FFE08A","#22B07D",
  "#1CB0F6","#E11D48","#9B5DE5","#FCD34D",
];

export default function ChestOpening({ reward = 0, onClose }) {
  const [phase, setPhase] = useState("shake"); // shake → open → reveal
  const [rewardVisible, setRewardVisible] = useState(false);
  const [count, setCount] = useState(0);

  // Phase sequencing + sounds
  useEffect(() => {
    try { sfx.chestRumble(); } catch {}

    const t1 = setTimeout(() => {
      setPhase("open");
      try { sfx.chestOpen(); } catch {}
    }, 950);

    const t2 = setTimeout(() => {
      setPhase("reveal");
      // Tiny delay so CSS transition starts after paint
      requestAnimationFrame(() => requestAnimationFrame(() => setRewardVisible(true)));
      try { sfx.gemReveal(); } catch {}
    }, 1650);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Animate gem counter after reveal slides in
  useEffect(() => {
    if (!rewardVisible) return;
    const target = Number(reward) || 0;
    if (!target) return;
    let cur = 0;
    const step = Math.max(1, Math.round(target / 22));
    const id = setInterval(() => {
      cur = Math.min(target, cur + step);
      setCount(cur);
      if (cur >= target) clearInterval(id);
    }, 38);
    return () => clearInterval(id);
  }, [rewardVisible, reward]);

  const opened = phase === "open" || phase === "reveal";

  const confetti = useMemo(() =>
    Array.from({ length: 44 }).map(() => ({
      tx: (Math.random() - 0.5) * 480,
      ty: -(100 + Math.random() * 280),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 7 + Math.round(Math.random() * 9),
      rot: `${Math.round(Math.random() * 540 - 270)}deg`,
      delay: Math.random() * 0.18,
      dur: 0.9 + Math.random() * 0.7,
    })), []
  );

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 99999,
        background: "linear-gradient(178deg, #4EC4ED 0%, #1A90CA 100%)",
        fontFamily: "'Baloo 2','Nunito',sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Floating background gems */}
      {BG_GEMS.map((g, i) => (
        <div key={i} style={{ position: "absolute", left: g.left, top: g.top, opacity: g.opacity, pointerEvents: "none" }}>
          <Gem style={{ width: g.size, height: g.size, color: "white" }} />
        </div>
      ))}

      {/* ── Chest stage (fades out when reveal slides in) ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        opacity: rewardVisible ? 0 : 1,
        transition: "opacity 0.28s ease 0.12s",
        pointerEvents: rewardVisible ? "none" : "auto",
      }}>
        <div style={{ position: "relative", width: 240, height: 210 }}>
          {/* Sun rays */}
          {opened && (
            <div className="chest-rays-spin" style={{
              position: "absolute", left: "50%", top: "50%",
              width: 540, height: 540,
              marginLeft: -270, marginTop: -270,
              pointerEvents: "none",
            }}>
              <div className="chest-rays-burst" style={{
                width: "100%", height: "100%",
                background: "repeating-conic-gradient(from 0deg,rgba(255,232,80,.52) 0deg 8deg,rgba(255,232,80,0) 8deg 18deg)",
                borderRadius: "50%",
                maskImage: "radial-gradient(circle,#000 34%,transparent 70%)",
                WebkitMaskImage: "radial-gradient(circle,#000 34%,transparent 70%)",
              }} />
            </div>
          )}

          {/* Chest */}
          <div
            className={phase === "shake" ? "chest-shake" : opened ? "chest-jump" : ""}
            style={{ width: "100%", height: "100%" }}
          >
            <ChestSvg open={opened} />
          </div>

          {/* Confetti burst */}
          {opened && (
            <div style={{ position: "absolute", left: "50%", top: "50%", pointerEvents: "none" }}>
              {confetti.map((p, i) => (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    width: p.size,
                    height: Math.round(p.size * 1.6),
                    background: p.color,
                    borderRadius: 2,
                    "--tx": `${p.tx}px`,
                    "--ty": `${p.ty}px`,
                    "--rot": p.rot,
                    animation: `burstOut ${p.dur}s ease-out ${p.delay}s forwards`,
                  }}
                />
              ))}
            </div>
          )}

          {/* White flash on open */}
          {phase === "open" && (
            <div className="chest-flash" style={{
              position: "absolute", top: -140, left: -140, right: -140, bottom: -140,
              borderRadius: "50%",
              background: "radial-gradient(circle,rgba(255,255,255,0.88) 0%,rgba(255,255,255,0) 68%)",
              pointerEvents: "none",
            }} />
          )}
        </div>

        {/* Status label */}
        <p style={{
          marginTop: 28,
          color: "rgba(255,255,255,0.88)",
          fontWeight: 800, fontSize: 17,
          letterSpacing: "0.06em", textTransform: "uppercase",
          minHeight: 24,
        }}>
          {phase === "shake" ? "Opening…" : ""}
        </p>
      </div>

      {/* ── Reward panel — slides up from bottom ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "0 28px 100px",
        transform: rewardVisible ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.55s cubic-bezier(0.34,1.56,0.5,1)",
        background: "linear-gradient(178deg, #4EC4ED 0%, #1A90CA 100%)",
      }}>
        {/* Gem orb with sparkles */}
        <div style={{ position: "relative", marginBottom: 4 }}>
          <Sparkle style={{ left: -36, top: -18 }} size={15} delay={0.05} />
          <Sparkle style={{ left: 88,  top: -26 }} size={11} delay={0.28} />
          <Sparkle style={{ left: -46, top: 52  }} size={9}  delay={0.52} />
          <Sparkle style={{ left: 96,  top: 44  }} size={17} delay={0.18} />
          <Sparkle style={{ left: 22,  top: -40 }} size={8}  delay={0.7}  />

          <div style={{
            width: 124, height: 124,
            background: "rgba(255,255,255,0.18)",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 64px rgba(255,255,255,0.28), 0 0 0 2px rgba(255,255,255,0.22)",
          }}>
            <Gem style={{ width: 66, height: 66, color: "white" }} />
          </div>
        </div>

        {/* Gem count */}
        <div style={{
          fontSize: 76, fontWeight: 900, color: "white", lineHeight: 1,
          marginTop: 20,
          filter: "drop-shadow(0 3px 14px rgba(0,0,0,0.22))",
          fontVariantNumeric: "tabular-nums",
        }}>
          +{count}
        </div>

        <p style={{
          marginTop: 6, fontSize: 14, fontWeight: 800,
          color: "rgba(255,255,255,0.78)",
          letterSpacing: "0.2em", textTransform: "uppercase",
        }}>
          gems collected
        </p>

        {/* COLLECT button — white pill, like Duo's CONTINUE */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", bottom: 36, left: 24, right: 24,
            background: "white", color: "#0D78B0",
            border: "none", borderRadius: 18,
            padding: "18px 0",
            fontSize: 16, fontWeight: 900,
            letterSpacing: "0.1em", textTransform: "uppercase",
            cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 5px 0 rgba(0,0,0,0.14)",
            transition: "transform 0.08s, box-shadow 0.08s",
          }}
          onPointerDown={e => {
            e.currentTarget.style.transform = "translateY(3px)";
            e.currentTarget.style.boxShadow = "0 2px 0 rgba(0,0,0,0.14)";
          }}
          onPointerUp={e => {
            e.currentTarget.style.transform = "";
            e.currentTarget.style.boxShadow = "0 5px 0 rgba(0,0,0,0.14)";
          }}
        >
          COLLECT
        </button>
      </div>
    </div>,
    document.body
  );
}
