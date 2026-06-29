// src/lib/StreakFlame.jsx — streak flame rendered with a dotLottie animation.
// The web-component script is loaded lazily (once) the first time a lit flame is
// shown, so it never affects pages without a streak. While it loads we show a
// small SVG flame; an unlit streak shows a calm grey ember.
import React, { useEffect, useState } from "react";

const LOTTIE_SRC = "https://lottie.host/c8c697c2-6303-4e82-aa8d-85c9c3eee9a8/FfcyvrdlJ9.lottie";
const SCRIPT_SRC = "https://unpkg.com/@lottiefiles/dotlottie-wc@0.9.14/dist/dotlottie-wc.js";

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

function SvgFlame({ size, lit }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 80" fill="none" aria-hidden="true" style={{ overflow: "visible", opacity: lit ? 1 : 0.65 }}>
      <path d={OUTER} fill={lit ? "#FF7A1A" : "#CBD5E1"} />
      <path d={INNER} fill={lit ? "#FFE08A" : "#E2E8F0"} />
    </svg>
  );
}

export default function StreakFlame({ size = 56, lit = true }) {
  const [ready, setReady] = useState(
    () => typeof window !== "undefined" && !!window.customElements?.get("dotlottie-wc")
  );

  useEffect(() => {
    if (!lit || ready) return;
    let alive = true;
    ensureDotLottie().then((ok) => {
      if (alive && ok) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [lit, ready]);

  // 0-day streak → calm grey ember, no animation.
  if (!lit) return <SvgFlame size={size} lit={false} />;

  // While the Lottie web component loads, show the static SVG flame (no blank box).
  if (!ready) return <SvgFlame size={size} lit />;

  return (
    <dotlottie-wc
      src={LOTTIE_SRC}
      autoplay
      loop
      style={{ width: size, height: size, display: "block" }}
      aria-hidden="true"
    />
  );
}
