// src/lib/StreakFlame.jsx — animated flickering flame for streaks (Duolingo-style).
import React from "react";

/**
 * Props:
 *  - size: px (default 56)
 *  - lit: boolean — colored & animated when true, grey ember when false
 */
export default function StreakFlame({ size = 56, lit = true }) {
  const uid = React.useId();
  const gradId = `flame-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible" }}
      aria-hidden="true"
    >
      <g className={lit ? "flame-flicker" : ""} style={lit ? undefined : { opacity: 0.6 }}>
        {/* outer flame */}
        <path
          d="M24 1 C26 12, 36 16, 37 30 C38 44, 31 54, 24 54 C17 54, 10 45, 11 32 C12 24, 17 22, 18 16 C19 11, 22 8, 24 1 Z"
          fill={lit ? `url(#${gradId})` : "#CBD5E1"}
        />
        {/* inner flame */}
        <path
          className={lit ? "flame-inner" : ""}
          d="M24 19 C27 25, 31 30, 30 38 C29 47, 25 51, 24 51 C20 51, 17 46, 18 38 C19 31, 22 27, 24 19 Z"
          fill={lit ? "#FFE08A" : "#E2E8F0"}
        />
      </g>
      <defs>
        <linearGradient id={gradId} x1="24" y1="1" x2="24" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFB347" />
          <stop offset="0.55" stopColor="#FF7A1A" />
          <stop offset="1" stopColor="#E8590C" />
        </linearGradient>
      </defs>
    </svg>
  );
}
