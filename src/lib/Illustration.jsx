// src/lib/Illustration.jsx — one reusable illustration component, Duolingo-style.
//
// Renders a named illustration. If the registry entry has a `lottie` URL it
// plays that animation (dotLottie web-component, lazy-loaded once from CDN);
// otherwise it shows the static `fallback` image with an optional CSS wiggle.
// Honors prefers-reduced-motion (always falls back to the static image).
//
// ── To add a licensed LottieFiles animation ──────────────────────────────
// 1. On lottiefiles.com, open the animation → "Save to Workspace" or use a
//    free one → grab its dotLottie URL (looks like
//    "https://lottie.host/<id>/<name>.lottie").
// 2. Paste it as the `lottie:` value on the matching entry below.
// That's it — every screen using that name animates automatically, with the
// PNG still shown as the instant fallback while the Lottie loads.
import React, { useEffect, useState } from "react";
import grandma from "../assets/character-grandma.png";
import teacher from "../assets/character-teacher.png";
import student from "../assets/character-student.png";

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
    s.onerror = () => resolve(false); // fail open — keep the static fallback
    document.head.appendChild(s);
  });
  return _scriptPromise;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// The illustration catalogue. `fallback` is required (always renders); `lottie`
// is optional — fill it with a LottieFiles dotLottie URL to make it move.
export const ILLUSTRATIONS = {
  // Mascot (tatik) — emotional beats
  "mascot-cheer":  { fallback: grandma, anim: "animate-bouncey", lottie: null }, // correct answer, lesson complete
  "mascot-idle":   { fallback: grandma, anim: "animate-floaty",  lottie: null }, // dashboard greeting, ambient
  "mascot-sad":    { fallback: grandma, anim: "",                lottie: null }, // wrong answer, out of hearts
  "mascot-wave":   { fallback: grandma, anim: "animate-floaty",  lottie: null }, // onboarding, empty states
  // Supporting characters
  "teacher":       { fallback: teacher, anim: "animate-floaty",  lottie: null },
  "student":       { fallback: student, anim: "animate-floaty",  lottie: null },
};

// Fallback to the tatik so an unknown/typo'd name never renders nothing.
function entryFor(name) {
  return ILLUSTRATIONS[name] || ILLUSTRATIONS["mascot-idle"];
}

/**
 * <Illustration name="mascot-cheer" className="h-28 w-28 rounded-3xl" />
 * - `className` controls size / rounding / margins (applied to both modes).
 * - `alt` for the static image (decorative by default).
 */
export default function Illustration({
  name,
  className = "",
  alt = "",
  loop = true,
  autoplay = true,
  style,
}) {
  const entry = entryFor(name);
  const wantAnim = !!entry.lottie && !prefersReducedMotion();

  const [ready, setReady] = useState(
    () => wantAnim && typeof window !== "undefined" && !!window.customElements?.get("dotlottie-wc")
  );

  useEffect(() => {
    if (!wantAnim || ready) return;
    let alive = true;
    ensureDotLottie().then((ok) => alive && ok && setReady(true));
    return () => { alive = false; };
  }, [wantAnim, ready]);

  if (wantAnim && ready) {
    return (
      <span className={"inline-block overflow-hidden " + className} style={style} aria-hidden={alt ? undefined : "true"} role={alt ? "img" : undefined} aria-label={alt || undefined}>
        <dotlottie-wc
          src={entry.lottie}
          autoplay={autoplay ? "" : undefined}
          loop={loop ? "" : undefined}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </span>
    );
  }

  return (
    <img
      src={entry.fallback}
      alt={alt}
      aria-hidden={alt ? undefined : "true"}
      className={(entry.anim && !prefersReducedMotion() ? entry.anim + " " : "") + className}
      style={style}
    />
  );
}
