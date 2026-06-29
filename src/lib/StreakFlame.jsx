// src/lib/StreakFlame.jsx — streak flame rendered with a dotLottie animation.
// States: fire (lit) · frozen (a freeze is protecting the streak) · ember (0).
// The web-component script is loaded lazily (once) the first time an animated
// flame is shown, so it never affects pages without a streak.
import React, { useEffect, useState } from "react";

const LOTTIE_SRC = "https://lottie.host/c8c697c2-6303-4e82-aa8d-85c9c3eee9a8/FfcyvrdlJ9.lottie";
const SCRIPT_SRC = "https://unpkg.com/@lottiefiles/dotlottie-wc@0.9.14/dist/dotlottie-wc.js";

// Turn the warm fire icy-blue for the "frozen" state, with a cold glow.
const FROZEN_FILTER = "hue-rotate(165deg) saturate(1.25) brightness(1.05) drop-shadow(0 0 6px rgba(56,189,248,.6))";

let _scriptPromise = null;
function ensureDotLottie() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.customElements?.get("dotlottie-wc")) return Promise.resolve(true);
  if (_scriptPromise) return _scriptPromise;
  _scriptPromise = new Promise((resolve) => {
    const s = document.createElement("script");
    s.type = "module";
    s.src = SCRIPT_SRC;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false); // fail open — we keep the SVG fallback
    document.head.appendChild(s);
  });
  return _scriptPromise;
}

const OUTER = "M32 3 C39 19, 52 26, 50 46 C49 61, 41 77, 32 77 C23 77, 14 62, 15 46 C16 34, 24 33, 26 22 C27 16, 30 11, 32 3 Z";
const INNER = "M32 29 C37 37, 43 44, 41 54 C40 64, 35 73, 32 73 C27 73, 22 64, 23 54 C24 46, 29 41, 32 29 Z";

// tone: "fire" | "frozen" | "ember"
const TONES = {
  fire: { outer: "#FF7A1A", inner: "#FFE08A", opacity: 1 },
  frozen: { outer: "#38BDF8", inner: "#E0F2FE", opacity: 1 },
  ember: { outer: "#CBD5E1", inner: "#E2E8F0", opacity: 0.65 },
};

function SvgFlame({ size, tone }) {
  const t = TONES[tone] || TONES.fire;
  return (
    <svg width={size} height={size} viewBox="0 0 64 80" fill="none" aria-hidden="true" style={{ overflow: "visible", opacity: t.opacity }}>
      <path d={OUTER} fill={t.outer} />
      <path d={INNER} fill={t.inner} />
    </svg>
  );
}

export default function StreakFlame({ size = 56, lit = true, frozen = false }) {
  const animated = lit || frozen; // both fire and frozen play the Lottie
  const [ready, setReady] = useState(
    () => typeof window !== "undefined" && !!window.customElements?.get("dotlottie-wc")
  );

  useEffect(() => {
    if (!animated || ready) return;
    let alive = true;
    ensureDotLottie().then((ok) => {
      if (alive && ok) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [animated, ready]);

  // 0-day streak → calm grey ember, no animation.
  if (!animated) return <SvgFlame size={size} tone="ember" />;

  // While the Lottie web component loads, show the static SVG flame.
  if (!ready) return <SvgFlame size={size} tone={frozen ? "frozen" : "fire"} />;

  return (
    <dotlottie-wc
      src={LOTTIE_SRC}
      autoplay
      loop
      style={{ width: size, height: size, display: "block", filter: frozen ? FROZEN_FILTER : undefined }}
      aria-hidden="true"
    />
  );
}
