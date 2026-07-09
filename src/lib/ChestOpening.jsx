// src/lib/ChestOpening.jsx — Duolingo-style full-screen chest opening.
// reward = { type: "gems" | "xp_boost", gems: number }
import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { Gem } from "lucide-react";
import { sfx } from "./sfx";

// ── Particle colors ──────────────────────────────────────────────────────────
const COLORS = [
  "#FF7A1A","#FFB347","#FFE08A","#22B07D",
  "#1CB0F6","#E11D48","#9B5DE5","#FCD34D",
  "#FF4081","#00BCD4","#A3E635","#FB923C",
];

// ── Chest lid SVG — flies away independently ─────────────────────────────────
// Coordinate space 0 0 240 80 (y=30→110 of the combined 240×210 design)
function ChestLidSvg() {
  return (
    <svg width="240" height="80" viewBox="0 30 240 80" fill="none" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="lid-blue" x1="120" y1="34" x2="120" y2="110" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2194D8"/><stop offset="1" stopColor="#1570B0"/>
        </linearGradient>
        <linearGradient id="lid-gold" x1="120" y1="34" x2="120" y2="112" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE44D"/><stop offset="1" stopColor="#C88800"/>
        </linearGradient>
      </defs>
      {/* Lid arch */}
      <path d="M14 110 V80 C14 52 58 34 120 34 C182 34 226 52 226 80 V110 Z" fill="url(#lid-blue)"/>
      {/* Inner panel sheen */}
      <path d="M34 106 V82 C34 62 68 48 120 48 C172 48 206 62 206 82 V106 Z" fill="#2496DC" opacity="0.38"/>
      {/* Bottom trim (joins to body) */}
      <rect x="14" y="96" width="212" height="16" rx="4" fill="url(#lid-gold)"/>
      {/* Left side trim */}
      <rect x="14" y="34" width="20" height="76" rx="6" fill="url(#lid-gold)" opacity="0.92"/>
      {/* Right side trim */}
      <rect x="206" y="34" width="20" height="76" rx="6" fill="url(#lid-gold)" opacity="0.92"/>
      {/* Hinge bump */}
      <rect x="104" y="90" width="32" height="18" rx="6" fill="url(#lid-gold)"/>
      {/* Top edge highlight */}
      <path d="M28 80 C38 56 72 44 120 44 C168 44 202 56 212 80" stroke="rgba(255,255,255,0.22)" strokeWidth="3" fill="none"/>
    </svg>
  );
}

// ── Chest body SVG — stays put ───────────────────────────────────────────────
// Coordinate space 0 98 240 102 (y=98→200 of combined design)
function ChestBodySvg({ glowing }) {
  return (
    <svg width="240" height="102" viewBox="0 98 240 102" fill="none" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="body-blue" x1="120" y1="100" x2="120" y2="196" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1A82CC"/><stop offset="1" stopColor="#0D5B9A"/>
        </linearGradient>
        <linearGradient id="body-gold" x1="120" y1="100" x2="120" y2="196" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFE44D"/><stop offset="1" stopColor="#C88800"/>
        </linearGradient>
        <radialGradient id="body-glow" cx="50%" cy="0%" r="60%">
          <stop offset="0%" stopColor="#FFF9C0" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#FFE44D" stopOpacity="0"/>
        </radialGradient>
      </defs>

      {/* Body */}
      <rect x="14" y="100" width="212" height="96" rx="16" fill="url(#body-blue)"/>
      {/* Inner panel */}
      <rect x="28" y="113" width="184" height="73" rx="8" fill="#2496DC" opacity="0.38"/>
      {/* Left trim */}
      <rect x="14" y="100" width="20" height="96" rx="6" fill="url(#body-gold)"/>
      {/* Right trim */}
      <rect x="206" y="100" width="20" height="96" rx="6" fill="url(#body-gold)"/>
      {/* Horizontal band */}
      <rect x="14" y="148" width="212" height="20" fill="url(#body-gold)"/>
      {/* Lock plate */}
      <rect x="98" y="120" width="44" height="36" rx="10" fill="url(#body-gold)"/>
      {/* Lock outer ring */}
      <circle cx="120" cy="140" r="10" fill="#9B7000"/>
      {/* Lock inner */}
      <circle cx="120" cy="140" r="5" fill="#FFE44D"/>
      {/* Interior glow when open */}
      {glowing && <rect x="28" y="100" width="184" height="24" rx="4" fill="url(#body-glow)" opacity="0.95"/>}
    </svg>
  );
}

// ── 4-pointed sparkle decoration ────────────────────────────────────────────
function Sparkle({ style, size = 14, color = "rgba(255,255,255,0.82)", delay = 0 }) {
  return (
    <div className="chest-sparkle" style={{ position: "absolute", animationDelay: `${delay}s`, pointerEvents: "none", ...style }}>
      <svg viewBox="0 0 24 24" width={size} height={size}>
        <path d="M12 0 L13.7 10.3 L24 12 L13.7 13.7 L12 24 L10.3 13.7 L0 12 L10.3 10.3 Z" fill={color}/>
      </svg>
    </div>
  );
}

// ── Potion flask for XP boost reward ────────────────────────────────────────
function FlaskSvg({ size = 88 }) {
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 52 65" fill="none">
      {/* Neck */}
      <rect x="17" y="0" width="18" height="22" rx="4" fill="rgba(255,255,255,0.28)"/>
      {/* Collar */}
      <rect x="13" y="19" width="26" height="7" rx="3.5" fill="rgba(255,255,255,0.45)"/>
      {/* Body */}
      <path d="M17 26 L11 42 C5 54 8 65 18 65 L34 65 C44 65 47 54 41 42 L35 26 Z" fill="rgba(255,255,255,0.22)"/>
      {/* Liquid */}
      <path d="M14 50 L11 42 C5 54 8 65 18 65 L34 65 C44 65 47 54 41 42 L38 50 Z" fill="rgba(255,255,255,0.58)"/>
      {/* Bubbles */}
      <circle cx="22" cy="54" r="3.5" fill="rgba(255,255,255,0.75)"/>
      <circle cx="33" cy="58" r="2.5" fill="rgba(255,255,255,0.6)"/>
      <circle cx="27" cy="49" r="2"   fill="rgba(255,255,255,0.55)"/>
      {/* Neck highlight */}
      <rect x="19" y="2" width="6" height="16" rx="3" fill="rgba(255,255,255,0.2)"/>
      {/* Cap */}
      <rect x="14" y="0" width="24" height="5" rx="2.5" fill="rgba(255,255,255,0.55)"/>
    </svg>
  );
}

// ── Floating background gem icons ────────────────────────────────────────────
const BG_GEMS = [
  { left: "5%",  top: "9%",  size: 32, op: 0.14 },
  { left: "82%", top: "5%",  size: 20, op: 0.18 },
  { left: "3%",  top: "54%", size: 26, op: 0.11 },
  { left: "85%", top: "50%", size: 38, op: 0.10 },
  { left: "10%", top: "84%", size: 18, op: 0.16 },
  { left: "78%", top: "82%", size: 28, op: 0.12 },
  { left: "46%", top: "3%",  size: 16, op: 0.15 },
  { left: "52%", top: "92%", size: 14, op: 0.13 },
];

// ── Main component ───────────────────────────────────────────────────────────
export default function ChestOpening({ reward = { type: "gems", gems: 0 }, onClose }) {
  const rewardType = reward?.type || "gems";
  const rewardGems = Number(reward?.gems ?? reward ?? 0);

  // phases: intro (waits for tap) → shake → open → reveal
  const [phase, setPhase]           = useState("intro");
  const [lidOpen, setLidOpen]       = useState(false);
  const [rewardIn, setRewardIn]     = useState(false);
  const [bgPurple, setBgPurple]     = useState(false);
  const [gemCount, setGemCount]     = useState(0);

  // The reveal is user-triggered: anticipation peaks on the tap, not on a
  // timer. The chest idles with a pulse + "Tap to open!" until clicked.
  const startOpen = () => {
    setPhase((cur) => {
      if (cur !== "intro") return cur; // ignore double taps
      try { sfx.chestRumble(); } catch {}
      return "shake";
    });
  };

  // One timer per phase, chained — a single effect owning both timers would
  // cancel the pending reveal in its own cleanup when the phase flips to
  // "open" (the effect re-runs on the phase change it caused).
  useEffect(() => {
    if (phase !== "shake") return;
    const t = setTimeout(() => { setPhase("open"); setLidOpen(true); try { sfx.chestOpen(); } catch {} }, 930);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "open") return;
    const t = setTimeout(() => setPhase("reveal"), 850);
    return () => clearTimeout(t);
  }, [phase]);

  // Separate tick so the reveal DOM mounts before the "in" transition class.
  // setTimeout (not rAF): rAF is throttled to zero in hidden/occluded tabs,
  // which would leave the reveal hanging forever.
  useEffect(() => {
    if (phase !== "reveal") return;
    const t = setTimeout(() => {
      setRewardIn(true);
      if (rewardType === "xp_boost") setBgPurple(true);
      try { sfx.gemReveal(); } catch {}
    }, 30);
    return () => clearTimeout(t);
  }, [phase, rewardType]);

  // Reduced motion: skip the theater, reveal immediately on tap.
  useEffect(() => {
    if (phase !== "shake") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setPhase("reveal");
      setLidOpen(true);
      setRewardIn(true);
      if (rewardType === "xp_boost") setBgPurple(true);
    }
  }, [phase, rewardType]);

  // Gem counter ticks up after reward slides in
  useEffect(() => {
    if (!rewardIn || rewardType !== "gems") return;
    const target = rewardGems;
    if (!target) return;
    let cur = 0;
    const step = Math.max(1, Math.round(target / 20));
    const id = setInterval(() => {
      cur = Math.min(target, cur + step);
      setGemCount(cur);
      if (cur >= target) clearInterval(id);
    }, 42);
    return () => clearInterval(id);
  }, [rewardIn, rewardType, rewardGems]);

  // Particles — 3 shape types, 2 waves
  const particles = useMemo(() => {
    const shapes = ["rect", "circle", "rect", "rect", "circle"];
    return Array.from({ length: 60 }).map((_, i) => {
      const ang  = (i / 60) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 90 + Math.random() * 260;
      return {
        tx:    Math.cos(ang) * dist,
        ty:    Math.sin(ang) * dist - 80,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        w:     6 + Math.round(Math.random() * 9),
        h:     i % 5 === 1 ? 6 + Math.round(Math.random() * 6) : 10 + Math.round(Math.random() * 12),
        shape: shapes[i % shapes.length],
        rot:   `${Math.round(Math.random() * 720 - 360)}deg`,
        delay: Math.random() * 0.22 + (i > 30 ? 0.08 : 0),
        dur:   1.0 + Math.random() * 0.8,
      };
    });
  }, []);

  const isOpened = phase === "open" || phase === "reveal";
  const isChestHidden = phase === "reveal" && rewardIn;

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 99999,
        overflow: "hidden",
        fontFamily: "'Baloo 2','Nunito',sans-serif",
      }}
    >
      {/* Sky-blue base */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(175deg, #4EC4ED 0%, #1A90CA 100%)",
        transition: "opacity 0.6s ease",
        opacity: bgPurple ? 0 : 1,
      }}/>
      {/* Purple overlay for XP boost */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(175deg, #7C3AED 0%, #4C1D95 100%)",
        opacity: bgPurple ? 1 : 0,
        transition: "opacity 0.6s ease",
      }}/>

      {/* Floating bg gems */}
      {BG_GEMS.map((g, i) => (
        <div key={i} style={{ position: "absolute", left: g.left, top: g.top, opacity: g.op, pointerEvents: "none" }}>
          <Gem style={{ width: g.size, height: g.size, color: "white" }}/>
        </div>
      ))}

      {/* ── Chest stage — tap anywhere to open ── */}
      <div
        onClick={startOpen}
        role={phase === "intro" ? "button" : undefined}
        aria-label={phase === "intro" ? "Open chest" : undefined}
        style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          opacity: isChestHidden ? 0 : 1,
          transition: "opacity 0.3s ease",
          pointerEvents: isChestHidden ? "none" : "auto",
          cursor: phase === "intro" ? "pointer" : "default",
        }}>
        {/* Sun rays */}
        {isOpened && (
          <div className="chest-rays-spin" style={{
            position: "absolute",
            top: "50%", left: "50%",
            width: 560, height: 560,
            marginTop: -280, marginLeft: -280,
            pointerEvents: "none",
          }}>
            <div className="chest-rays-burst" style={{
              width: "100%", height: "100%",
              background: "repeating-conic-gradient(from 0deg,rgba(255,232,80,.5) 0deg 7deg,rgba(255,232,80,0) 7deg 18deg)",
              borderRadius: "50%",
              maskImage: "radial-gradient(circle,#000 30%,transparent 68%)",
              WebkitMaskImage: "radial-gradient(circle,#000 30%,transparent 68%)",
            }}/>
          </div>
        )}

        {/* Chest wrapper — shake/jump applied here; idle bob while waiting for tap */}
        <div
          className={
            phase === "shake" ? "chest-shake" :
            isOpened         ? "chest-jump"  : "chest-pop chest-idle"
          }
          style={{ position: "relative", width: 240, height: 200 }}
        >
          {/* Glow ring during idle + shake (anticipation / invitation) */}
          {(phase === "intro" || phase === "shake") && (
            <div className="chest-glow" style={{
              position: "absolute",
              top: 10, left: 10, right: 10, bottom: 10,
              borderRadius: 24,
              pointerEvents: "none",
              zIndex: 0,
            }}/>
          )}

          {/* Lid — flies away on open */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0,
            height: 80,
            zIndex: 3,
            transformOrigin: "50% 100%",
            transform: lidOpen
              ? "translateY(-84px) rotate(-15deg) scale(0.86)"
              : "translateY(0) rotate(0deg) scale(1)",
            transition: lidOpen
              ? "transform 0.52s cubic-bezier(0.34, 1.56, 0.5, 1)"
              : "none",
          }}>
            <ChestLidSvg/>
          </div>

          {/* Body */}
          <div style={{ position: "absolute", top: 80, left: 0, right: 0, zIndex: 2 }}>
            <ChestBodySvg glowing={isOpened}/>
          </div>

          {/* Light pillar from chest gap */}
          {isOpened && (
            <div style={{
              position: "absolute",
              top: lidOpen ? 0 : 64,
              left: "50%",
              width: 80,
              height: 180,
              pointerEvents: "none", zIndex: 1,
              animation: "pillarRise 0.45s ease-out forwards",
              background: "linear-gradient(to top, rgba(255,235,100,0.9), rgba(255,255,200,0.45), transparent)",
              borderRadius: "50% 50% 0 0 / 30% 30% 0 0",
            }}/>
          )}

          {/* Confetti burst */}
          {isOpened && (
            <div style={{ position: "absolute", left: "50%", top: "45%", pointerEvents: "none", zIndex: 4 }}>
              {particles.map((p, i) => (
                <div key={i} style={{
                  position: "absolute",
                  width: p.w, height: p.h,
                  background: p.color,
                  borderRadius: p.shape === "circle" ? "50%" : 2,
                  "--tx": `${p.tx}px`,
                  "--ty": `${p.ty}px`,
                  "--rot": p.rot,
                  animation: `burstOut ${p.dur}s ease-out ${p.delay}s forwards`,
                }}/>
              ))}
            </div>
          )}

          {/* White screen flash */}
          {phase === "open" && (
            <div className="chest-flash" style={{
              position: "absolute",
              top: -160, left: -160, right: -160, bottom: -160,
              borderRadius: "50%",
              background: "radial-gradient(circle,rgba(255,255,255,0.92) 0%,rgba(255,255,255,0) 66%)",
              pointerEvents: "none", zIndex: 5,
            }}/>
          )}
        </div>

        {/* Status label */}
        <p className={phase === "intro" ? "chest-tap-hint" : ""} style={{
          marginTop: 28, color: "rgba(255,255,255,0.92)",
          fontWeight: 800, fontSize: phase === "intro" ? 19 : 16,
          letterSpacing: "0.08em", textTransform: "uppercase",
          minHeight: 26,
        }}>
          {phase === "intro" ? "Tap to open!" : phase === "shake" ? "Opening…" : ""}
        </p>
      </div>

      {/* ── Reward screen ── */}
      {rewardIn && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "0 28px 100px",
        }}>
          <div className="reward-pop" style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", textAlign: "center",
          }}>
            {rewardType === "xp_boost" ? (
              /* ── XP Boost card ── */
              <>
                {/* Flask with surrounding sparkles */}
                <div style={{ position: "relative", display: "inline-flex" }}>
                  <Sparkle style={{ left: -36, top: -18 }} size={16} color="rgba(255,255,255,0.85)" delay={0.1}/>
                  <Sparkle style={{ right: -30, top: -24 }} size={12} color="rgba(255,255,255,0.7)"  delay={0.3}/>
                  <Sparkle style={{ left: -42, bottom: 8  }} size={10} color="rgba(255,255,255,0.75)" delay={0.55}/>
                  <Sparkle style={{ right: -34, bottom: 4  }} size={18} color="rgba(255,255,255,0.8)"  delay={0.2}/>
                  <Sparkle style={{ left: "30%", top: -38 }} size={8}  color="rgba(255,255,255,0.65)" delay={0.72}/>
                  <div style={{
                    width: 124, height: 124,
                    background: "rgba(255,255,255,0.14)",
                    borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 0 70px rgba(255,255,255,0.22), 0 0 0 2px rgba(255,255,255,0.18)",
                  }}>
                    <FlaskSvg size={72}/>
                  </div>
                </div>

                <div style={{
                  fontSize: 82, fontWeight: 900, color: "white", lineHeight: 1,
                  marginTop: 22,
                  filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.28))",
                  letterSpacing: "-2px",
                }}>
                  x2
                </div>
                <p style={{
                  marginTop: 2, fontSize: 22, fontWeight: 900, color: "white",
                  letterSpacing: "0.05em",
                }}>
                  XP BOOST
                </p>
                <p style={{
                  marginTop: 6, fontSize: 14, fontWeight: 700,
                  color: "rgba(255,255,255,0.72)",
                }}>
                  Double XP on your next lesson!
                </p>
              </>
            ) : (
              /* ── Gems card ── */
              <>
                <div style={{ position: "relative", display: "inline-flex" }}>
                  <Sparkle style={{ left: -38, top: -20 }} size={16} delay={0.08}/>
                  <Sparkle style={{ right: -30, top: -26 }} size={12} delay={0.3}/>
                  <Sparkle style={{ left: -44, bottom: 6  }} size={10} delay={0.55}/>
                  <Sparkle style={{ right: -36, bottom: 2  }} size={18} delay={0.18}/>
                  <Sparkle style={{ left: "30%", top: -42 }} size={8}  delay={0.7}/>
                  <div style={{
                    width: 124, height: 124,
                    background: "rgba(255,255,255,0.16)",
                    borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 0 70px rgba(255,255,255,0.25), 0 0 0 2px rgba(255,255,255,0.2)",
                  }}>
                    <Gem style={{ width: 66, height: 66, color: "white" }}/>
                  </div>
                </div>

                <div style={{
                  fontSize: 82, fontWeight: 900, color: "white", lineHeight: 1,
                  marginTop: 22,
                  filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.24))",
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-2px",
                }}>
                  +{gemCount}
                </div>
                <p style={{
                  marginTop: 6, fontSize: 14, fontWeight: 800,
                  color: "rgba(255,255,255,0.78)",
                  letterSpacing: "0.2em", textTransform: "uppercase",
                }}>
                  GEMS COLLECTED
                </p>
              </>
            )}
          </div>

          {/* COLLECT / CONTINUE button — white pill */}
          <button
            onClick={onClose}
            style={{
              position: "absolute", bottom: 36, left: 24, right: 24,
              background: "white",
              color: rewardType === "xp_boost" ? "#5B21B6" : "#0D78B0",
              border: "none", borderRadius: 18,
              padding: "18px 0",
              fontSize: 17, fontWeight: 900,
              letterSpacing: "0.08em", textTransform: "uppercase",
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 5px 0 rgba(0,0,0,0.16)",
              transition: "transform 0.08s, box-shadow 0.08s",
            }}
            onPointerDown={e => {
              e.currentTarget.style.transform = "translateY(3px)";
              e.currentTarget.style.boxShadow = "0 2px 0 rgba(0,0,0,0.16)";
            }}
            onPointerUp={e => {
              e.currentTarget.style.transform = "";
              e.currentTarget.style.boxShadow = "0 5px 0 rgba(0,0,0,0.16)";
            }}
            onPointerLeave={e => {
              e.currentTarget.style.transform = "";
              e.currentTarget.style.boxShadow = "0 5px 0 rgba(0,0,0,0.16)";
            }}
          >
            {rewardType === "xp_boost" ? "CONTINUE" : "COLLECT"}
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
