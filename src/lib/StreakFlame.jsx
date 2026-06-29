// src/lib/StreakFlame.jsx — a realistic animated fire for streaks.
// Uses an SVG fractal-noise displacement filter so the flame edges ripple like
// real fire, plus a gentle sway, a pulsing inner core, glow and rising sparks.
import React from "react";

const OUTER = "M32 3 C39 19, 52 26, 50 46 C49 61, 41 77, 32 77 C23 77, 14 62, 15 46 C16 34, 24 33, 26 22 C27 16, 30 11, 32 3 Z";
const INNER = "M32 29 C37 37, 43 44, 41 54 C40 64, 35 73, 32 73 C27 73, 22 64, 23 54 C24 46, 29 41, 32 29 Z";

export default function StreakFlame({ size = 56, lit = true }) {
  const raw = React.useId();
  const id = String(raw).replace(/[^a-zA-Z0-9]/g, "");

  if (!lit) {
    // Calm grey ember — no animation.
    return (
      <svg width={size} height={size} viewBox="0 0 64 80" fill="none" aria-hidden="true" style={{ overflow: "visible", opacity: 0.65 }}>
        <path d={OUTER} fill="#CBD5E1" />
        <path d={INNER} fill="#E2E8F0" />
      </svg>
    );
  }

  return (
    <span className="hl-fire" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 64 80" fill="none" aria-hidden="true" style={{ overflow: "visible" }}>
        <defs>
          <filter id={`turb${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018 0.045" numOctaves="2" seed="5" result="n">
              <animate
                attributeName="baseFrequency"
                dur="4.6s"
                values="0.018 0.045; 0.02 0.072; 0.017 0.05; 0.022 0.063; 0.018 0.045"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <linearGradient id={`go${id}`} x1="32" y1="4" x2="32" y2="78" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFD24D" />
            <stop offset="0.45" stopColor="#FF7A1A" />
            <stop offset="1" stopColor="#E8400C" />
          </linearGradient>
          <linearGradient id={`gi${id}`} x1="32" y1="29" x2="32" y2="73" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFF4C2" />
            <stop offset="1" stopColor="#FFC24B" />
          </linearGradient>
        </defs>
        <g filter={`url(#turb${id})`}>
          <g className="hl-fire-sway">
            <path d={OUTER} fill={`url(#go${id})`} />
            <path className="hl-fire-core" d={INNER} fill={`url(#gi${id})`} />
          </g>
        </g>
      </svg>
      <span className="hl-spark" style={{ left: "38%", animationDelay: "0s" }} />
      <span className="hl-spark" style={{ left: "56%", animationDelay: "0.7s" }} />
      <span className="hl-spark" style={{ left: "47%", animationDelay: "1.3s" }} />
    </span>
  );
}
