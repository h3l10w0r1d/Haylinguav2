// src/lib/ChestOpening.jsx — full-screen chest opening with rarity tiers.
// Brawl Stars-style: rarity is rolled server-side; the chest's colors and the
// glow leaking from the lid seam foreshadow the tier, and higher rarities take
// more taps to crack open (wooden 1 → silver/golden 2 → legendary 3).
// reward = { type: "gems" | "xp_boost", gems: number, rarity?: string, xpBoost?: bool }
import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import confetti from "canvas-confetti";
import { Gem } from "lucide-react";
import { sfx } from "./sfx";

// ── Per-rarity theming ────────────────────────────────────────────────────────
// lid/body/trim are [light, dark] gradient stops; taps is the opens-after count.
export const RARITY_THEMES = {
  wooden: {
    label: "Wooden Chest", taps: 1,
    lid: ["#B07A45", "#7A4E22"], lidPanel: "#C08A52",
    body: ["#9A6635", "#663F1A"], bodyPanel: "#AE7840",
    trim: ["#9C9CA6", "#5C5C66"],
    glow: "#FFD9A0", glowRgb: "255,217,160",
    bg: ["#4EC4ED", "#1A90CA"],
    ray: "rgba(255,224,130,.5)",
    confetti: ["#B07A45", "#D9A05B", "#FFE08A", "#9C9CA6", "#FFF3D6"],
    screenShake: false, burst: 1,
  },
  silver: {
    label: "Silver Chest", taps: 2,
    lid: ["#EAF0F6", "#93A7BC"], lidPanel: "#F4F8FC",
    body: ["#C9D6E3", "#7E93A9"], bodyPanel: "#DCE6F0",
    trim: ["#5B7EA6", "#33506F"],
    glow: "#CFE6FF", glowRgb: "207,230,255",
    bg: ["#3B82C4", "#123B66"],
    ray: "rgba(220,240,255,.55)",
    confetti: ["#EAF0F6", "#9FB6CC", "#1CB0F6", "#FFFFFF", "#C9D6E3"],
    screenShake: false, burst: 1.4,
  },
  golden: {
    label: "Golden Chest", taps: 2,
    lid: ["#FFE44D", "#C88800"], lidPanel: "#FFEF8A",
    body: ["#FFC800", "#9B7000"], bodyPanel: "#FFDB4D",
    trim: ["#FFF3B0", "#D9A400"],
    glow: "#FFC800", glowRgb: "255,200,0",
    bg: ["#B8791A", "#5C3A08"],
    ray: "rgba(255,214,64,.6)",
    confetti: ["#FFC800", "#FFE44D", "#FF7A1A", "#FFF3B0", "#FFFFFF"],
    screenShake: true, burst: 2,
  },
  legendary: {
    label: "Legendary Chest", taps: 3,
    lid: ["#C36BFF", "#6B1FB8"], lidPanel: "#D9A2FF",
    body: ["#9B3FE8", "#4C1D95"], bodyPanel: "#B368F0",
    trim: ["#FFE44D", "#C88800"],
    glow: "#E9B8FF", glowRgb: "233,184,255",
    bg: ["#2E1065", "#0B0320"],
    ray: "rgba(233,184,255,.6)",
    confetti: ["#C36BFF", "#FFC800", "#FF4081", "#1CB0F6", "#FFFFFF", "#FFE44D"],
    screenShake: true, burst: 3,
  },
};

function prefersReducedMotion() {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// ── Chest lid — flies away independently ─────────────────────────────────────
function ChestLidSvg({ theme, rarity }) {
  const id = (n) => `${n}-${rarity}`;
  return (
    <svg width="240" height="80" viewBox="0 30 240 80" fill="none" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={id("lid-main")} x1="120" y1="34" x2="120" y2="110" gradientUnits="userSpaceOnUse">
          <stop stopColor={theme.lid[0]} /><stop offset="1" stopColor={theme.lid[1]} />
        </linearGradient>
        <linearGradient id={id("lid-trim")} x1="120" y1="34" x2="120" y2="112" gradientUnits="userSpaceOnUse">
          <stop stopColor={theme.trim[0]} /><stop offset="1" stopColor={theme.trim[1]} />
        </linearGradient>
      </defs>
      <path d="M14 110 V80 C14 52 58 34 120 34 C182 34 226 52 226 80 V110 Z" fill={`url(#${id("lid-main")})`} />
      <path d="M34 106 V82 C34 62 68 48 120 48 C172 48 206 62 206 82 V106 Z" fill={theme.lidPanel} opacity="0.38" />
      <rect x="14" y="96" width="212" height="16" rx="4" fill={`url(#${id("lid-trim")})`} />
      <rect x="14" y="34" width="20" height="76" rx="6" fill={`url(#${id("lid-trim")})`} opacity="0.92" />
      <rect x="206" y="34" width="20" height="76" rx="6" fill={`url(#${id("lid-trim")})`} opacity="0.92" />
      <rect x="104" y="90" width="32" height="18" rx="6" fill={`url(#${id("lid-trim")})`} />
      <path d="M28 80 C38 56 72 44 120 44 C168 44 202 56 212 80" stroke="rgba(255,255,255,0.22)" strokeWidth="3" fill="none" />
    </svg>
  );
}

// ── Chest body — stays put; shows cracks as taps land ────────────────────────
function ChestBodySvg({ theme, rarity, cracks = 0, glowing }) {
  const id = (n) => `${n}-${rarity}`;
  return (
    <svg width="240" height="102" viewBox="0 98 240 102" fill="none" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={id("body-main")} x1="120" y1="100" x2="120" y2="196" gradientUnits="userSpaceOnUse">
          <stop stopColor={theme.body[0]} /><stop offset="1" stopColor={theme.body[1]} />
        </linearGradient>
        <linearGradient id={id("body-trim")} x1="120" y1="100" x2="120" y2="196" gradientUnits="userSpaceOnUse">
          <stop stopColor={theme.trim[0]} /><stop offset="1" stopColor={theme.trim[1]} />
        </linearGradient>
        <radialGradient id={id("body-glow")} cx="50%" cy="0%" r="60%">
          <stop offset="0%" stopColor="#FFF9C0" stopOpacity="0.9" />
          <stop offset="100%" stopColor={theme.glow} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="14" y="100" width="212" height="96" rx="16" fill={`url(#${id("body-main")})`} />
      <rect x="28" y="113" width="184" height="73" rx="8" fill={theme.bodyPanel} opacity="0.38" />
      <rect x="14" y="100" width="20" height="96" rx="6" fill={`url(#${id("body-trim")})`} />
      <rect x="206" y="100" width="20" height="96" rx="6" fill={`url(#${id("body-trim")})`} />
      <rect x="14" y="148" width="212" height="20" fill={`url(#${id("body-trim")})`} />
      <rect x="98" y="120" width="44" height="36" rx="10" fill={`url(#${id("body-trim")})`} />
      <circle cx="120" cy="140" r="10" fill="rgba(0,0,0,0.35)" />
      <circle cx="120" cy="140" r="5" fill={theme.trim[0]} />

      {/* Cracks — light leaks through in the rarity's glow color */}
      {cracks >= 1 && (
        <g strokeLinecap="round" fill="none">
          <path d="M120 156 L109 167 L115 181 L105 193" stroke="rgba(20,10,4,0.55)" strokeWidth="3.5" />
          <path d="M120 156 L109 167 L115 181 L105 193" stroke={theme.glow} strokeWidth="1.4" opacity="0.9" />
        </g>
      )}
      {cracks >= 2 && (
        <g strokeLinecap="round" fill="none">
          <path d="M142 122 L156 133 L150 147 L166 158" stroke="rgba(20,10,4,0.55)" strokeWidth="3.5" />
          <path d="M142 122 L156 133 L150 147 L166 158" stroke={theme.glow} strokeWidth="1.4" opacity="0.9" />
          <path d="M62 120 L54 136 L64 148" stroke="rgba(20,10,4,0.5)" strokeWidth="3" />
          <path d="M62 120 L54 136 L64 148" stroke={theme.glow} strokeWidth="1.2" opacity="0.85" />
        </g>
      )}
      {cracks >= 3 && (
        <g strokeLinecap="round" fill="none">
          <path d="M40 168 L66 176 L88 170 L112 182 L138 174 L164 184 L192 172" stroke="rgba(20,10,4,0.55)" strokeWidth="3.5" />
          <path d="M40 168 L66 176 L88 170 L112 182 L138 174 L164 184 L192 172" stroke={theme.glow} strokeWidth="1.4" opacity="0.95" />
          <path d="M178 114 L188 128" stroke="rgba(20,10,4,0.5)" strokeWidth="3" />
          <path d="M178 114 L188 128" stroke={theme.glow} strokeWidth="1.2" opacity="0.85" />
        </g>
      )}

      {glowing && <rect x="28" y="100" width="184" height="24" rx="4" fill={`url(#${id("body-glow")})`} opacity="0.95" />}
    </svg>
  );
}

// ── 4-pointed sparkle decoration ─────────────────────────────────────────────
function Sparkle({ style, size = 14, color = "rgba(255,255,255,0.82)", delay = 0 }) {
  return (
    <div className="chest-sparkle" style={{ position: "absolute", animationDelay: `${delay}s`, pointerEvents: "none", ...style }}>
      <svg viewBox="0 0 24 24" width={size} height={size}>
        <path d="M12 0 L13.7 10.3 L24 12 L13.7 13.7 L12 24 L10.3 13.7 L0 12 L10.3 10.3 Z" fill={color} />
      </svg>
    </div>
  );
}

// ── Potion flask for XP boost reward ─────────────────────────────────────────
function FlaskSvg({ size = 88 }) {
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 52 65" fill="none">
      <rect x="17" y="0" width="18" height="22" rx="4" fill="rgba(255,255,255,0.28)" />
      <rect x="13" y="19" width="26" height="7" rx="3.5" fill="rgba(255,255,255,0.45)" />
      <path d="M17 26 L11 42 C5 54 8 65 18 65 L34 65 C44 65 47 54 41 42 L35 26 Z" fill="rgba(255,255,255,0.22)" />
      <path d="M14 50 L11 42 C5 54 8 65 18 65 L34 65 C44 65 47 54 41 42 L38 50 Z" fill="rgba(255,255,255,0.58)" />
      <circle cx="22" cy="54" r="3.5" fill="rgba(255,255,255,0.75)" />
      <circle cx="33" cy="58" r="2.5" fill="rgba(255,255,255,0.6)" />
      <circle cx="27" cy="49" r="2" fill="rgba(255,255,255,0.55)" />
      <rect x="19" y="2" width="6" height="16" rx="3" fill="rgba(255,255,255,0.2)" />
      <rect x="14" y="0" width="24" height="5" rx="2.5" fill="rgba(255,255,255,0.55)" />
    </svg>
  );
}

// ── Floating background gem icons ────────────────────────────────────────────
const BG_GEMS = [
  { left: "5%", top: "9%", size: 32, op: 0.14 },
  { left: "82%", top: "5%", size: 20, op: 0.18 },
  { left: "3%", top: "54%", size: 26, op: 0.11 },
  { left: "85%", top: "50%", size: 38, op: 0.10 },
  { left: "10%", top: "84%", size: 18, op: 0.16 },
  { left: "78%", top: "82%", size: 28, op: 0.12 },
  { left: "46%", top: "3%", size: 16, op: 0.15 },
  { left: "52%", top: "92%", size: 14, op: 0.13 },
];

// ── Confetti bursts, escalating with rarity ──────────────────────────────────
function fireBurst(theme) {
  const base = {
    colors: theme.confetti,
    zIndex: 100000,
    disableForReducedMotion: true,
    gravity: 0.9,
    ticks: 220,
    startVelocity: 46,
    scalar: 1 + (theme.burst - 1) * 0.15,
  };
  confetti({ ...base, particleCount: Math.round(90 * theme.burst), spread: 100, origin: { x: 0.5, y: 0.55 } });
  if (theme.burst >= 1.4) {
    setTimeout(() => confetti({ ...base, particleCount: 50, spread: 70, startVelocity: 55, origin: { x: 0.5, y: 0.6 } }), 140);
  }
  if (theme.burst >= 2) {
    setTimeout(() => {
      confetti({ ...base, particleCount: 60, angle: 60, spread: 55, origin: { x: 0, y: 0.7 } });
      confetti({ ...base, particleCount: 60, angle: 120, spread: 55, origin: { x: 1, y: 0.7 } });
    }, 220);
  }
  if (theme.burst >= 3) {
    setTimeout(() => confetti({
      ...base, particleCount: 80, spread: 160, startVelocity: 30,
      shapes: ["star"], scalar: 1.6, origin: { x: 0.5, y: -0.05 },
    }), 420);
  }
}

// ── Main component ───────────────────────────────────────────────────────────
export default function ChestOpening({ reward = { type: "gems", gems: 0 }, onClose }) {
  const rewardType = reward?.type || "gems";
  const rewardGems = Number(reward?.gems ?? reward ?? 0);
  const rarity = RARITY_THEMES[reward?.rarity] ? reward.rarity : "wooden";
  const theme = RARITY_THEMES[rarity];
  const isJackpot = !!reward?.xpBoost && rewardType === "gems";

  // phases: intro → crack (per non-final tap) → shake (final tap) → open → reveal
  const [phase, setPhase] = useState("intro");
  const [tapCount, setTapCount] = useState(0);
  const [lidOpen, setLidOpen] = useState(false);
  const [rewardIn, setRewardIn] = useState(false);
  const [bgPurple, setBgPurple] = useState(false);
  const [gemCount, setGemCount] = useState(0);

  // Ambient rising embers in the rarity's glow color — count scales with tier.
  const embers = useMemo(() => {
    const n = Math.round(8 * theme.burst);
    return Array.from({ length: n }).map((_, i) => ({
      left: Math.round((i / n) * 100 + (Math.random() * 8 - 4)),
      size: 3 + Math.round(Math.random() * 4),
      sway: Math.round(Math.random() * 80 - 40),
      dur: 6 + Math.random() * 7,
      delay: Math.random() * 8,
      op: 0.35 + Math.random() * 0.5,
    }));
  }, [theme.burst]);

  // Tap handler — non-final taps crack the chest; the final tap opens it.
  // Synchronous ref guards (NOT nested functional setState updaters: React
  // does not run a nested updater before the outer one returns, which
  // silently swallowed the final tap's phase change).
  const tapRef = React.useRef(0);
  const openingRef = React.useRef(false);

  const handleTap = () => {
    if (openingRef.current) return; // final tap already accepted
    // Reduced motion: first tap reveals instantly, regardless of tier.
    if (prefersReducedMotion()) {
      openingRef.current = true;
      setLidOpen(true);
      setRewardIn(true);
      if (rewardType === "xp_boost") setBgPurple(true);
      setPhase("reveal");
      return;
    }
    const t = tapRef.current + 1;
    tapRef.current = t;
    setTapCount(t);
    if (t >= theme.taps) {
      openingRef.current = true;
      setPhase("shake");
      try { sfx.chestRumble(theme.burst); } catch {}
    } else {
      setPhase("crack");
      try { sfx.chestCrack?.(t); } catch {}
    }
  };

  // crack → back to idle (accepting the next tap) after the burst-shake.
  useEffect(() => {
    if (phase !== "crack") return;
    const t = setTimeout(() => setPhase((c) => (c === "crack" ? "intro" : c)), 450);
    return () => clearTimeout(t);
  }, [phase, tapCount]);

  // One timer per phase, chained — a single effect owning multiple timers
  // would cancel its own pending steps on the phase flip it causes.
  useEffect(() => {
    if (phase !== "shake") return;
    const t = setTimeout(() => { setPhase("open"); setLidOpen(true); try { sfx.chestOpen(theme.burst); } catch {} }, 930);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "open") return;
    fireBurst(theme);
    const t = setTimeout(() => setPhase("reveal"), 850);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Separate tick so the reveal DOM mounts before the "in" transition class.
  // setTimeout (not rAF): rAF is throttled to zero in hidden/occluded tabs.
  useEffect(() => {
    if (phase !== "reveal") return;
    const t = setTimeout(() => {
      setRewardIn(true);
      if (rewardType === "xp_boost") setBgPurple(true);
      try { sfx.gemReveal(theme.burst); } catch {}
    }, 30);
    return () => clearTimeout(t);
  }, [phase, rewardType]);

  // Gem counter ticks up after reward slides in (setInterval — hidden-tab safe).
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

  const isOpened = phase === "open" || phase === "reveal";
  const isChestHidden = phase === "reveal" && rewardIn;
  const awaitingTap = phase === "intro" || phase === "crack";
  const tapsLeft = theme.taps - tapCount;

  const tapLabel =
    phase === "shake" ? "Opening…" :
    phase === "crack" || (phase === "intro" && tapCount > 0)
      ? (tapsLeft <= 1 ? "One more!" : "Tap again!")
      : phase === "intro" ? "Tap to open!" : "";

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className={isOpened && theme.screenShake ? "screen-shake" : ""}
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 99999,
        overflow: "hidden",
        fontFamily: "'Baloo 2','Nunito',sans-serif",
      }}
    >
      {/* Rarity-themed base */}
      <div style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(175deg, ${theme.bg[0]} 0%, ${theme.bg[1]} 100%)`,
        transition: "opacity 0.6s ease",
        opacity: bgPurple ? 0 : 1,
      }} />
      {/* Purple overlay for XP boost reveal */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(175deg, #7C3AED 0%, #4C1D95 100%)",
        opacity: bgPurple ? 1 : 0,
        transition: "opacity 0.6s ease",
      }} />

      {/* Breathing aurora halo behind the chest — depth + rarity color wash */}
      <div className="chest-aura" style={{
        position: "absolute",
        left: "50%", top: "50%",
        width: 720, height: 720,
        marginLeft: -360, marginTop: -360,
        borderRadius: "50%",
        background: `radial-gradient(circle, rgba(${theme.glowRgb}, ${rarity === "legendary" ? 0.30 : 0.20}) 0%, rgba(${theme.glowRgb}, 0.07) 42%, transparent 68%)`,
        pointerEvents: "none",
      }} />

      {/* Floating bg gems — slow ambient drift */}
      {BG_GEMS.map((g, i) => (
        <div
          key={i}
          className="chest-bg-drift"
          style={{
            position: "absolute", left: g.left, top: g.top, opacity: g.op,
            pointerEvents: "none",
            animationDuration: `${5 + (i % 4) * 1.6}s`,
            animationDelay: `${(i % 5) * 0.9}s`,
          }}
        >
          <Gem style={{ width: g.size, height: g.size, color: "white" }} />
        </div>
      ))}

      {/* Rising embers in the rarity's glow color */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} aria-hidden="true">
        {embers.map((e, i) => (
          <span
            key={i}
            className="chest-ember"
            style={{
              position: "absolute",
              bottom: -12,
              left: `${e.left}%`,
              width: e.size,
              height: e.size,
              borderRadius: "50%",
              background: theme.glow,
              boxShadow: `0 0 ${e.size * 2}px rgba(${theme.glowRgb}, 0.8)`,
              opacity: 0,
              "--ember-sway": `${e.sway}px`,
              "--ember-op": e.op,
              animationDuration: `${e.dur}s`,
              animationDelay: `${e.delay}s`,
            }}
          />
        ))}
      </div>

      {/* ── Chest stage — tap to crack/open ── */}
      <div
        onClick={handleTap}
        role={awaitingTap ? "button" : undefined}
        aria-label={awaitingTap ? "Open chest" : undefined}
        style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          opacity: isChestHidden ? 0 : 1,
          transition: "opacity 0.3s ease",
          pointerEvents: isChestHidden ? "none" : "auto",
          cursor: awaitingTap ? "pointer" : "default",
        }}
      >
        {/* Rarity banner — names the tier from the first frame */}
        <div style={{
          marginBottom: 26,
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(0,0,0,0.28)",
          borderRadius: 999, padding: "8px 18px",
        }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: theme.glow }} />
          <span style={{
            color: "white", fontWeight: 800, fontSize: 14,
            letterSpacing: "0.14em", textTransform: "uppercase",
          }}>
            {theme.label}
          </span>
        </div>

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
              background: `repeating-conic-gradient(from 0deg,${theme.ray} 0deg 7deg,rgba(255,255,255,0) 7deg 18deg)`,
              borderRadius: "50%",
              maskImage: "radial-gradient(circle,#000 30%,transparent 68%)",
              WebkitMaskImage: "radial-gradient(circle,#000 30%,transparent 68%)",
            }} />
          </div>
        )}

        {/* Chest wrapper — keyed by tapCount so per-tap animations retrigger */}
        <div
          key={tapCount}
          className={
            phase === "shake" ? "chest-shake" :
            phase === "crack" ? (tapCount >= 2 ? "chest-shake-t2" : "chest-shake-t1") :
            isOpened ? "chest-jump" : "chest-pop chest-idle"
          }
          style={{ position: "relative", width: 240, height: 200, "--glow-rgb": theme.glowRgb }}
        >
          {/* Glow ring while waiting / shaking (invitation + anticipation) */}
          {(awaitingTap || phase === "shake") && (
            <div className="chest-glow" style={{
              position: "absolute",
              top: 10, left: 10, right: 10, bottom: 10,
              borderRadius: 24,
              pointerEvents: "none",
              zIndex: 0,
            }} />
          )}

          {/* Seam glow leak — brightens with each tap, colored by rarity */}
          {!isOpened && tapCount > 0 && (
            <div className="chest-seam-glow" style={{
              position: "absolute",
              top: 74, left: 18, right: 18, height: 10,
              borderRadius: 6,
              background: theme.glow,
              opacity: 0.35 + 0.65 * (tapCount / theme.taps),
              pointerEvents: "none",
              zIndex: 4,
            }} />
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
            <ChestLidSvg theme={theme} rarity={rarity} />
          </div>

          {/* Body with cracks */}
          <div style={{ position: "absolute", top: 80, left: 0, right: 0, zIndex: 2 }}>
            <ChestBodySvg theme={theme} rarity={rarity} cracks={tapCount} glowing={isOpened} />
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
              background: `linear-gradient(to top, ${theme.glow}E6, ${theme.glow}73, transparent)`,
              borderRadius: "50% 50% 0 0 / 30% 30% 0 0",
            }} />
          )}

          {/* White screen flash */}
          {phase === "open" && (
            <div className="chest-flash" style={{
              position: "absolute",
              top: -160, left: -160, right: -160, bottom: -160,
              borderRadius: "50%",
              background: "radial-gradient(circle,rgba(255,255,255,0.92) 0%,rgba(255,255,255,0) 66%)",
              pointerEvents: "none", zIndex: 5,
            }} />
          )}
        </div>

        {/* Status label */}
        <p className={awaitingTap ? "chest-tap-hint" : ""} style={{
          marginTop: 28, color: "rgba(255,255,255,0.92)",
          fontWeight: 800, fontSize: awaitingTap ? 19 : 16,
          letterSpacing: "0.08em", textTransform: "uppercase",
          minHeight: 26,
        }}>
          {tapLabel}
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
            {/* Rarity banner above the reward */}
            <p style={{
              marginBottom: 18, fontSize: 15, fontWeight: 900,
              letterSpacing: "0.22em", textTransform: "uppercase",
              color: theme.glow,
              textShadow: "0 2px 12px rgba(0,0,0,0.35)",
            }}>
              {theme.label}!
            </p>

            {rewardType === "xp_boost" ? (
              /* ── XP Boost card ── */
              <>
                <div style={{ position: "relative", display: "inline-flex" }}>
                  <Sparkle style={{ left: -36, top: -18 }} size={16} color="rgba(255,255,255,0.85)" delay={0.1} />
                  <Sparkle style={{ right: -30, top: -24 }} size={12} color="rgba(255,255,255,0.7)" delay={0.3} />
                  <Sparkle style={{ left: -42, bottom: 8 }} size={10} color="rgba(255,255,255,0.75)" delay={0.55} />
                  <Sparkle style={{ right: -34, bottom: 4 }} size={18} color="rgba(255,255,255,0.8)" delay={0.2} />
                  <Sparkle style={{ left: "30%", top: -38 }} size={8} color="rgba(255,255,255,0.65)" delay={0.72} />
                  <div style={{
                    width: 124, height: 124,
                    background: "rgba(255,255,255,0.14)",
                    borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 0 70px rgba(255,255,255,0.22), 0 0 0 2px rgba(255,255,255,0.18)",
                  }}>
                    <FlaskSvg size={72} />
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
                <p style={{ marginTop: 2, fontSize: 22, fontWeight: 900, color: "white", letterSpacing: "0.05em" }}>
                  XP BOOST
                </p>
                <p style={{ marginTop: 6, fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.72)" }}>
                  Double XP on your next lesson!
                </p>
              </>
            ) : (
              /* ── Gems card (+ jackpot boost row for legendary) ── */
              <>
                <div style={{ position: "relative", display: "inline-flex" }}>
                  <Sparkle style={{ left: -38, top: -20 }} size={16} delay={0.08} />
                  <Sparkle style={{ right: -30, top: -26 }} size={12} delay={0.3} />
                  <Sparkle style={{ left: -44, bottom: 6 }} size={10} delay={0.55} />
                  <Sparkle style={{ right: -36, bottom: 2 }} size={18} delay={0.18} />
                  <Sparkle style={{ left: "30%", top: -42 }} size={8} delay={0.7} />
                  <div style={{
                    width: 124, height: 124,
                    background: "rgba(255,255,255,0.16)",
                    borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: `0 0 70px rgba(${theme.glowRgb},0.4), 0 0 0 2px rgba(255,255,255,0.2)`,
                  }}>
                    <Gem style={{ width: 66, height: 66, color: "white" }} />
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

                {isJackpot && (
                  <div style={{
                    marginTop: 18,
                    display: "inline-flex", alignItems: "center", gap: 10,
                    background: "rgba(255,255,255,0.14)",
                    borderRadius: 16, padding: "10px 18px",
                    boxShadow: "0 0 0 2px rgba(255,255,255,0.18)",
                  }}>
                    <FlaskSvg size={26} />
                    <div style={{ textAlign: "left" }}>
                      <div style={{ color: "white", fontWeight: 900, fontSize: 15, letterSpacing: "0.06em" }}>
                        + XP BOOST
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.72)", fontWeight: 700, fontSize: 12 }}>
                        Double XP on your next lesson
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* COLLECT / CONTINUE button — white pill */}
          <button
            onClick={onClose}
            style={{
              position: "absolute", bottom: 36, left: 24, right: 24,
              background: "white",
              color: rewardType === "xp_boost" ? "#5B21B6" : rarity === "legendary" ? "#6B1FB8" : "#0D78B0",
              border: "none", borderRadius: 18,
              padding: "18px 0",
              fontSize: 17, fontWeight: 900,
              letterSpacing: "0.08em", textTransform: "uppercase",
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 5px 0 rgba(0,0,0,0.16)",
              transition: "transform 0.08s, box-shadow 0.08s",
            }}
            onPointerDown={(e) => {
              e.currentTarget.style.transform = "translateY(3px)";
              e.currentTarget.style.boxShadow = "0 2px 0 rgba(0,0,0,0.16)";
            }}
            onPointerUp={(e) => {
              e.currentTarget.style.transform = "";
              e.currentTarget.style.boxShadow = "0 5px 0 rgba(0,0,0,0.16)";
            }}
            onPointerLeave={(e) => {
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
