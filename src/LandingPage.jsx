// src/LandingPage.jsx — Full marketing landing in the Haylingua brand.
// All auth logic preserved: login, signup, 2FA, captcha, email verification.
import Turnstile from "./lib/Turnstile";
import { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { renderTemplate, useLocale, localizedPath, SUPPORTED_LOCALES } from "./i18n";
import usePageMeta from "./lib/usePageMeta";
import {
  Lock, Mail, User, ArrowRight, Fingerprint, Sparkles,
  Flame, Trophy, Volume2,
  Check, ChevronDown, ShieldCheck,
  BookOpen, Hash, MessageCircle, Keyboard, AudioLines,
  X, Eye, EyeOff, Play, RotateCw, Loader2, Bell, AlertTriangle,
} from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import grandma from "./assets/character-grandma.png";
import { ttsFetch } from "./exercises/tts";
import { sfx } from "./lib/sfx";
import { newTrackedAudio } from "./lib/audioRegistry";
import { track } from "./lib/analytics";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "387340156498-udb3h083d3mcnj135kvbfcstsdslbe64.apps.googleusercontent.com";
const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID || "";
const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "haylinguabot";
// Numeric bot id (first segment of the bot token) — used for the direct OAuth
// navigation. Public information: it's embedded in every Telegram login widget.
const TELEGRAM_BOT_ID = import.meta.env.VITE_TELEGRAM_BOT_ID || "8694793218";

// Non-text metadata only (icons, tone/color, ordinal, star count) — the
// title/text/quote/name/role/q/a strings themselves come from
// src/i18n/locales/{locale}/landing.json (features/steps/testimonials/faqs),
// zipped onto these by index at each render site so the section works for
// every locale without duplicating the icon wiring per language.
// Free standalone pages linked from the "tools & guides" strip. Paths are
// the unprefixed routes from App.jsx's PUBLIC_ROUTE_DEFS — localizedPath()
// prepends the locale segment at render time. Labels live in landing.json
// under tools.items, keyed by `key`.
const TOOL_LINKS = [
  { key: "alphabet", path: "/armenian-alphabet", icon: BookOpen },
  { key: "pronunciation", path: "/armenian-pronunciation", icon: Volume2 },
  { key: "numbers", path: "/armenian-numbers", icon: Hash },
  { key: "phrases", path: "/armenian-phrases", icon: MessageCircle },
  { key: "typing", path: "/armenian-typing", icon: Keyboard },
  { key: "reader", path: "/armenian-text-to-speech", icon: AudioLines },
];

// ── Scroll reveal ─────────────────────────────────────────────────────────────

function useReveal(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function Reveal({ children, delay = 0, className = "" }) {
  const [ref, visible] = useReveal();
  // Honor prefers-reduced-motion: previously every card still faded/slid in
  // for users who'd asked the OS for no motion. Read once — a live listener
  // isn't worth it for a preference that essentially never changes mid-visit.
  const [reduceMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
  const shown = visible || reduceMotion;
  return (
    <div
      ref={ref}
      style={
        reduceMotion
          ? undefined
          : {
              opacity: shown ? 1 : 0,
              transform: shown ? "translateY(0)" : "translateY(2rem)",
              transition: `opacity 0.65s ease-out ${delay}ms, transform 0.65s ease-out ${delay}ms`,
            }
      }
      className={className}
    >
      {children}
    </div>
  );
}

// Exact official marks (path data from the simple-icons project, MIT
// licensed) — not hand-drawn approximations.
function AppleGlyph({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

function GooglePlayGlyph({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z" />
    </svg>
  );
}

// ── Auth popup promo panel ──────────────────────────────────────────────────
// Custom welcome-bonus artwork (2:3 portrait) fills the left panel of the auth
// popup. If it ever fails to load, the on-brand fallback below advertises the
// same 14-day free-trial bonus. Swap the file to change the banner.
const SIGNUP_BANNER_SRC = "/banners/Welcome_banner_5.png";
const SIGNUP_BANNER_WEBP = "/banners/Welcome_banner_5.webp";
const LOGIN_BANNER_SRC = "/banners/Login_banner1.jpg";
const LOGIN_BANNER_WEBP = "/banners/Login_banner1.webp";

function SignupPromoPanel({ mode }) {
  const { t: tt } = useTranslation("landing");
  const locale = useLocale();
  const [imgOk, setImgOk] = useState(true);
  const src = mode === "login" ? LOGIN_BANNER_SRC : SIGNUP_BANNER_SRC;
  const webpSrc = mode === "login" ? LOGIN_BANNER_WEBP : SIGNUP_BANNER_WEBP;
  // Reset the error flag when the banner swaps (login ↔ signup) so a fresh
  // image gets a chance to load instead of staying on the fallback.
  useEffect(() => {
    setImgOk(true);
  }, [src]);
  // The banner images have English text baked into the pixels (not
  // translatable) — only use them on the default English locale. Every
  // other locale always renders the translated text fallback below instead.
  const showImage = imgOk && !locale;
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-pom-600 md:block">
      <picture className={showImage ? "" : "hidden"}>
        <source srcSet={webpSrc} type="image/webp" />
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setImgOk(false)}
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      </picture>
      {!showImage && (
        <div className="relative flex h-full flex-col justify-between p-7 text-white">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold uppercase tracking-wide">
              <Sparkles className="h-3.5 w-3.5" /> {tt("signupPromo.badge")}
            </div>
            <h3 className="mt-4 font-display text-3xl font-extrabold leading-tight">
              {tt("signupPromo.heading")}
            </h3>
            <p className="mt-2 text-sm font-semibold text-white/85">
              {tt("signupPromo.subtitle")}
            </p>
            <ul className="mt-5 space-y-2.5 text-sm font-bold">
              {tt("signupPromo.perks", { returnObjects: true }).map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/20"><Check className="h-3.5 w-3.5" /></span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <img src={grandma} alt="" loading="lazy" className="mt-6 h-24 w-24 self-start rounded-2xl object-cover ring-4 ring-white/20" />
        </div>
      )}
    </div>
  );
}

// ── Playable exercise demo (product preview section) ───────────────────────────
// Each question carries enough context for the simulated AI tutor to explain a
// wrong answer specifically: the real meaning + romanization of the prompt, and
// for every wrong option, the Armenian word that option actually maps to. This
// is what powers the "why was I wrong" feedback (no real LLM call — the demo is
// on the public landing page — but the explanations are tailored per mistake and
// phrased several different ways so it reads like a live tutor, not a canned line).
// Each question declares a `kind` so the demo shows several different
// exercise formats back to back (read→pick-meaning, listen→pick-word,
// true/false judgment, meaning→pick-word) instead of one MCQ type repeated
// with different vocab — matching the variety the real lesson player has.
// Armenian script/romanization/correct-index only — locale-invariant, stays
// identical across every language. The meaning/options/hook/tutor-frame text
// (what actually needs translating) lives in src/i18n/locales/{locale}/
// landing.json's demo.questions/demo.frames, merged onto this at render time
// by useLocalizedDemo() below — see that hook for why it's split this way.
const DEMO_QUESTIONS_BASE = [
  { kind: "translate_mcq", prompt: "Բարև", rom: "ba-rev", correct: 0, wrong: { 1: { arm: "Ցտեսություն", rom: "tse-te-su-tyun" }, 2: { arm: "Շնորհակալություն", rom: "shnor-ha-ka-lu-tyun" } } },
  { kind: "listening", prompt: "Ջուր", rom: "jur", correct: 1, options: ["Հաց", "Ջուր", "Կաթ"], optionsRom: ["hats", "jur", "kat"], wrong: { 0: {}, 2: {} } },
  { kind: "true_false", prompt: "Ընկեր", rom: "ən-ker", correct: 1, wrong: { 0: {} } },
  { kind: "word_match", prompt: "Շնորհակալություն", rom: "shnor-ha-ka-lu-tyun", correct: 2, options: ["Խնդրեմ", "Ներողություն", "Շնորհակալություն"], optionsRom: ["khn-drem", "ne-ro-ghu-tyun", "shnor-ha-ka-lu-tyun"], wrong: { 0: {}, 1: {} } },
  { kind: "trace_letter", prompt: "Ա", rom: "a", correct: 0 },
];

// Merges DEMO_QUESTIONS_BASE (Armenian, fixed) with the current locale's
// demo.questions overrides (meaning/options/hook/statementClaim/
// englishPrompt/wrong[i].meaning) and builds locale-aware KIND_FRAMES
// functions out of demo.frames' {{token}} template strings (functions can't
// survive JSON — see renderTemplate in src/i18n/index.js).
function useLocalizedDemo() {
  const { t } = useTranslation("landing");
  const overrides = t("demo.questions", { returnObjects: true });
  const frameTemplates = t("demo.frames", { returnObjects: true });

  const questions = DEMO_QUESTIONS_BASE.map((base, i) => {
    const o = overrides[i] || {};
    const wrong = {};
    for (const key of Object.keys(base.wrong || {})) {
      wrong[key] = { ...base.wrong[key], ...(o.wrong?.[key] || {}) };
    }
    return {
      ...base,
      ...o,
      options: o.options || base.options,
      optionsRom: base.optionsRom,
      wrong,
    };
  });

  const makeFrames = (tpls, vars) => tpls.map((tpl) => (q, w, picked) => renderTemplate(tpl, vars(q, w, picked)));
  const frames = {
    translate_mcq: makeFrames(frameTemplates.translate_mcq, (q, w, picked) => ({ prompt: q.prompt, meaning: q.meaning, picked, arm: w.arm, rom: w.rom, promptRom: q.rom, hook: q.hook })),
    listening: makeFrames(frameTemplates.listening, (q, w, picked) => ({ picked, wrongMeaning: w.meaning, prompt: q.prompt, meaning: q.meaning, hook: q.hook })),
    true_false: makeFrames(frameTemplates.true_false, (q) => ({ prompt: q.prompt, meaning: q.meaning, statementClaim: q.statementClaim, promptRom: q.rom, hook: q.hook })),
    word_match: makeFrames(frameTemplates.word_match, (q, w, picked) => ({ picked, wrongMeaning: w.meaning, englishPrompt: q.englishPrompt, prompt: q.prompt, promptRom: q.rom, hook: q.hook })),
  };

  return { questions, frames };
}

// The instruction + prompt row varies by kind: translate_mcq shows the
// Armenian word to translate, listening hides the text and leads with audio,
// true_false shows a claim to judge, word_match starts from English instead
// of Armenian.
function DemoPromptHeader({ q }) {
  const { t: tt } = useTranslation("landing");
  const h = tt("demo.header", { returnObjects: true });
  const label = "mt-5 text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-stone-300";
  const big = "max-w-full font-display text-2xl font-extrabold text-slate-800 [overflow-wrap:anywhere] dark:text-white";
  if (q.kind === "listening") {
    return (
      <>
        <div className={label}>{h.tapWhatYouHear}</div>
        <div className="mt-4 flex justify-center">
          <VoiceChip text={q.prompt} displayText={h.playTheWord} />
        </div>
      </>
    );
  }
  if (q.kind === "true_false") {
    return (
      <>
        <div className={label}>{h.trueOrFalse}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <div className={big}>
            «{q.prompt}» <span className="text-base font-semibold text-slate-400 dark:text-stone-500">({q.rom})</span> {renderTemplate(h.meansQuoted, { claim: q.statementClaim })}
          </div>
          <VoiceChip text={q.prompt} tone="slate" />
        </div>
      </>
    );
  }
  if (q.kind === "word_match") {
    return (
      <>
        <div className={label}>{h.selectMatching}</div>
        <div className={big + " mt-1"}>{renderTemplate(h.inArmenianIs, { englishPrompt: q.englishPrompt })}</div>
      </>
    );
  }
  if (q.kind === "trace_letter") {
    return (
      <>
        <div className={label}>{h.traceTheLetter}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <div className={big}>
            {q.prompt} <span className="text-base font-semibold text-slate-400 dark:text-stone-500">— {q.meaning}</span>
          </div>
          <VoiceChip text={q.prompt} tone="slate" />
        </div>
      </>
    );
  }
  return (
    <>
      <div className={label}>{h.selectTranslation}</div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <div className={big}>
          "{q.prompt}" <span className="text-base font-semibold text-slate-400 dark:text-stone-500">({q.rom})</span> {h.means}
        </div>
        <VoiceChip text={q.prompt} tone="slate" />
      </div>
    </>
  );
}

// Freehand tracing pad for the trace_letter demo kind — a scaled-down version
// of the real lesson player's canvas tracer (ExerciseRenderer.jsx's
// ExTraceLetter), minus its stroke-path precision/recall scoring: this is a
// marketing-page teaser, not a graded drill, so any real stroke counts.
// Derives a tracing path for `letter` the same way the real lesson player's
// trace_letter grader (ExerciseRenderer.jsx's _traceGlyphMask/_traceThin)
// scores a handwritten trace: rasterize the glyph, then Zhang–Suen-thin it
// down to a 1px medial skeleton. A naive "vertical centerline per column"
// scan (the first version of this) falls apart on any glyph with tall
// vertical strokes at the edges — e.g. "Ա" renders as a rounded "u" bowl in
// the fallback Armenian font, and a column scan just averages top-to-bottom
// at each x, producing a meaningless zigzag instead of following the bowl.
// The skeleton is a proper 1px-wide centerline, so walking it pixel-to-pixel
// gives an ordered path that actually hugs the glyph's shape.
const _TRACE_GRID = 96;

function _traceGlyphMask(letter, W, H, fontString) {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#000";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = fontString;
  g.fillText(letter, W / 2, H / 2 + H * 0.02);
  const a = g.getImageData(0, 0, W, H).data;
  const bmp = new Uint8Array(W * H);
  for (let p = 0, i = 3; p < bmp.length; p++, i += 4) bmp[p] = a[i] > 60 ? 1 : 0;
  return bmp;
}

// Zhang–Suen thinning → 1px medial skeleton. Mutates and returns bmp.
function _traceThin(bmp, W, H) {
  const at = (x, y) => bmp[y * W + x];
  let changed = true;
  const dead = [];
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      dead.length = 0;
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          if (!bmp[y * W + x]) continue;
          const P2 = at(x, y - 1), P3 = at(x + 1, y - 1), P4 = at(x + 1, y),
                P5 = at(x + 1, y + 1), P6 = at(x, y + 1), P7 = at(x - 1, y + 1),
                P8 = at(x - 1, y), P9 = at(x - 1, y - 1);
          const B = P2 + P3 + P4 + P5 + P6 + P7 + P8 + P9;
          if (B < 2 || B > 6) continue;
          const seq = [P2, P3, P4, P5, P6, P7, P8, P9, P2];
          let A = 0;
          for (let k = 0; k < 8; k++) if (!seq[k] && seq[k + 1]) A++;
          if (A !== 1) continue;
          if (step === 0) {
            if (P2 && P4 && P6) continue;
            if (P4 && P6 && P8) continue;
          } else {
            if (P2 && P4 && P8) continue;
            if (P2 && P6 && P8) continue;
          }
          dead.push(y * W + x);
        }
      }
      if (dead.length) { changed = true; for (const i of dead) bmp[i] = 0; }
    }
  }
  return bmp;
}

// Walks the 1px skeleton into ordered polylines (a real stroke path a pen
// could draw), starting from endpoints (skeleton pixels with exactly one
// neighbor) so open strokes get traced end-to-end rather than from the
// middle. Falls back to starting anywhere for closed loops.
function _skeletonToStrokes(skel, W, H) {
  const idx = (x, y) => y * W + x;
  const neighborsOf = (x, y) => {
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && skel[idx(nx, ny)]) out.push([nx, ny]);
      }
    }
    return out;
  };
  const visited = new Uint8Array(W * H);
  const points = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (skel[idx(x, y)]) points.push([x, y]);
  const endpoints = points.filter(([x, y]) => neighborsOf(x, y).length === 1);
  const starts = endpoints.length ? endpoints : points.slice(0, 1);

  const strokes = [];
  for (const [sx, sy] of starts) {
    if (visited[idx(sx, sy)]) continue;
    const stroke = [];
    let cur = [sx, sy];
    while (cur) {
      const [cx, cy] = cur;
      if (visited[idx(cx, cy)]) break;
      visited[idx(cx, cy)] = 1;
      stroke.push({ x: cx, y: cy });
      const next = neighborsOf(cx, cy).find(([nx, ny]) => !visited[idx(nx, ny)]);
      cur = next || null;
    }
    if (stroke.length > 3) strokes.push(stroke);
  }
  // Any leftover pixels (a second disconnected component, or a loop with no
  // endpoint) become their own stroke via a plain unvisited sweep.
  for (const [x, y] of points) {
    if (visited[idx(x, y)]) continue;
    const stroke = [];
    let cur = [x, y];
    while (cur) {
      const [cx, cy] = cur;
      if (visited[idx(cx, cy)]) break;
      visited[idx(cx, cy)] = 1;
      stroke.push({ x: cx, y: cy });
      const next = neighborsOf(cx, cy).find(([nx, ny]) => !visited[idx(nx, ny)]);
      cur = next || null;
    }
    if (stroke.length > 3) strokes.push(stroke);
  }
  return strokes;
}

function computeGlyphStrokePath(letter, size, fontString) {
  try {
    const G = _TRACE_GRID;
    const font = fontString
      ? fontString.replace(/[\d.]+px/, `${Math.round(G * 0.62)}px`)
      : `900 ${Math.round(G * 0.62)}px "Baloo 2", "Noto Sans Armenian", sans-serif`;
    const mask = _traceGlyphMask(letter, G, G, font);
    let maskN = 0;
    for (let i = 0; i < mask.length; i++) maskN += mask[i];
    if (!maskN) return [];
    const skel = _traceThin(mask, G, G);
    const strokes = _skeletonToStrokes(skel, G, G);
    const scale = size / G;
    // Downsample each stroke to a handful of points so the animation has a
    // natural pace instead of one point per skeleton pixel.
    return strokes.map((s) => {
      const n = Math.min(9, Math.max(3, Math.round(s.length / 6)));
      const step = (s.length - 1) / (n - 1);
      return Array.from({ length: n }, (_, i) => {
        const p = s[Math.round(i * step)];
        return { x: p.x * scale, y: p.y * scale };
      });
    });
  } catch {
    return [];
  }
}

const TraceLetterPad = forwardRef(function TraceLetterPad({ letter, onDirtyChange, onInteractStart }, ref) {
  const { t: tt } = useTranslation("landing");
  const SIZE = 180;
  const drawRef = useRef(null);
  const ghostRef = useRef(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const strokePathRef = useRef([]);

  useEffect(() => {
    const c = drawRef.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = SIZE * dpr;
    c.height = SIZE * dpr;
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    hasInk.current = false;
    onDirtyChange?.(false);
    // Read the ghost glyph's own resolved font instead of guessing a font
    // stack string — Baloo 2/Nunito don't cover Armenian, so the ghost
    // (and this canvas scan) actually render Armenian letters in whatever
    // font the cascade falls through to; hardcoding a stack here silently
    // produced a DIFFERENT glyph shape than what's on screen. Recomputes
    // once webfonts are confirmed loaded too, since the very first paint
    // can race ahead of that and get a fallback-font shape otherwise.
    const compute = () => {
      const cs = ghostRef.current && getComputedStyle(ghostRef.current);
      const fontString = cs ? `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}` : null;
      strokePathRef.current = computeGlyphStrokePath(letter, SIZE, fontString);
    };
    compute();
    if (document.fonts?.ready) document.fonts.ready.then(compute);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter]);

  function at(e) {
    const rect = drawRef.current.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  }
  function strokeTo(x, y, down) {
    const ctx = drawRef.current.getContext("2d");
    if (down) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#e07b39";
    }
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  function markInk() {
    if (!hasInk.current) {
      hasInk.current = true;
      onDirtyChange?.(true);
    }
  }
  function onDown(e) {
    e.preventDefault();
    onInteractStart?.();
    drawing.current = true;
    const { x, y } = at(e);
    strokeTo(x, y, true);
    strokeTo(x + 0.01, y + 0.01, false);
    markInk();
  }
  function onMove(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const { x, y } = at(e);
    strokeTo(x, y, false);
  }
  function onUp() {
    drawing.current = false;
  }
  function clear() {
    drawRef.current?.getContext("2d").clearRect(0, 0, SIZE, SIZE);
    hasInk.current = false;
    onDirtyChange?.(false);
  }

  // Imperative paint primitives for the autoplay ghost cursor to actually
  // draw a visible stroke (not just flip a "done" flag) — see
  // simulateAutoTrace below, which drives these the same way a real
  // pointerdown/pointermove/pointerup sequence would. Deliberately does NOT
  // call markInk() until finishPaint() — marking ink (onDirtyChange) is a
  // state update, and firing it mid-gesture makes the pick-phase effect's
  // deps change, which cancels the *remaining* animation steps via the
  // shared autoTimers array before the simulated stroke finishes drawing.
  useImperativeHandle(ref, () => ({
    canvasRect: () => drawRef.current?.getBoundingClientRect(),
    strokePath: () => strokePathRef.current,
    paintDown: (x, y) => strokeTo(x, y, true),
    paintMove: (x, y) => strokeTo(x, y, false),
    finishPaint: () => markInk(),
  }));

  return (
    <div>
      <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
        <div
          ref={ghostRef}
          className="absolute inset-0 grid select-none place-items-center rounded-3xl bg-slate-50 font-display font-black ring-1 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/[0.08]"
          style={{ fontSize: SIZE * 0.62, color: "rgba(120,120,120,0.25)" }}
          aria-hidden="true"
        >
          {letter}
        </div>
        <canvas
          ref={drawRef}
          style={{ position: "absolute", inset: 0, width: SIZE, height: SIZE, touchAction: "none", cursor: "crosshair" }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        />
      </div>
      <div className="mt-2 text-center">
        <button type="button" onClick={clear} className="text-sm font-bold text-slate-400 hover:text-slate-600 dark:text-stone-500 dark:hover:text-stone-300">
          {tt("demo.trace.clear")}
        </button>
      </div>
    </div>
  );
});

// Small speaker chip that plays real Armenian TTS for a word via the same /audio
// pipeline the learner app uses — so a visitor can actually hear pronunciation.
function VoiceChip({ text, label, tone = "brand", displayText }) {
  const [state, setState] = useState("idle"); // idle | loading | playing
  const audioRef = useRef(null);
  const urlRef = useRef(null);

  useEffect(() => () => {
    if (audioRef.current) audioRef.current.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  async function toggle() {
    if (state === "playing") {
      audioRef.current?.pause();
      setState("idle");
      return;
    }
    if (state === "loading") return;
    try {
      setState("loading");
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
      const url = await ttsFetch(API_BASE, { text });
      urlRef.current = url;
      const audio = newTrackedAudio(url);
      audioRef.current = audio;
      audio.onended = () => setState("idle");
      audio.onerror = () => setState("idle");
      setState("playing");
      await audio.play();
    } catch {
      setState("idle");
    }
  }

  const tones = {
    brand: "bg-white dark:bg-[#18181b] text-brand-700 dark:text-brand-400 ring-brand-200 dark:ring-brand-500/30 hover:bg-brand-50 dark:hover:bg-brand-500/10",
    slate: "bg-white dark:bg-[#18181b] text-slate-600 dark:text-stone-300 ring-slate-200 dark:ring-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.04]",
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className={"inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-extrabold ring-2 transition-colors " + (tones[tone] || tones.brand)}
    >
      {state === "loading" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Volume2 className={"h-4 w-4 " + (state === "playing" ? "animate-pulse" : "")} />
      )}
      <span>{displayText || text}</span>
      {label && <span className="font-bold text-slate-400 dark:text-stone-500">· {label}</span>}
    </button>
  );
}

// Defers mounting the full LandingExerciseDemo (a dozen+ hooks/effects/refs,
// the localized-question merge, the whole first-question render tree) until
// its container is actually near the viewport. On desktop it sits beside
// the hero (lg:grid-cols-2 below) so the observer fires within a frame —
// no visible difference. On mobile it's stacked BELOW the hero text, so
// this genuinely skips that render cost during initial page load, which is
// what mobile PageSpeed's Total Blocking Time / long-main-thread-tasks
// audits actually measure (mobile's simulated CPU throttling makes this
// component's mount cost matter far more than it does on desktop).
// rootMargin starts mounting 500px early so a normal scroll never shows a
// pop-in. The placeholder mirrors the real card's rounded/ring/shadow
// styling at a plausible height so there's no layout shift once it swaps in.
function LazyLandingDemo({ onSignup }) {
  const ref = useRef(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (mounted) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setMounted(true); obs.disconnect(); }
      },
      { rootMargin: "500px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [mounted]);
  if (mounted) return <LandingExerciseDemo onSignup={onSignup} />;
  return <div ref={ref} className="h-[420px] rounded-3xl bg-white dark:bg-[#18181b] shadow-xl ring-1 ring-slate-200 dark:ring-white/[0.08]" />;
}

function LandingExerciseDemo({ onSignup }) {
  const { t: tt } = useTranslation("landing");
  const { questions: DEMO_QUESTIONS, frames: KIND_FRAMES } = useLocalizedDemo();
  const [qi, setQi] = useState(0);
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(false);
  const [hearts, setHearts] = useState(4);
  const [frameIdx, setFrameIdx] = useState(0);   // which AI phrasing to show
  const [aiPhase, setAiPhase] = useState("thinking"); // thinking | reveal
  const [typed, setTyped] = useState(0);         // typewriter cursor position
  const [done, setDone] = useState(false);       // finished all demo questions
  const [traceDirty, setTraceDirty] = useState(false); // trace_letter: has the learner drawn anything
  const comboRef = useRef(0);                    // correct-answer streak, for sfx pitch escalation

  // Ambient autoplay: a ghost cursor plays the demo by itself until a visitor
  // actually touches it — the very first real click hands control over for
  // good (never resumes autoplay on the same visit).
  const [autoActive, setAutoActive] = useState(true);
  const [cursorPos, setCursorPos] = useState(null);
  const [tapping, setTapping] = useState(false);
  const cardRef = useRef(null);
  const optionRefs = useRef([]);
  const padRef = useRef(null);
  const traceRef = useRef(null);
  const checkRef = useRef(null);
  const continueRef = useRef(null);
  const autoTimers = useRef([]);

  function clearAutoTimers() {
    autoTimers.current.forEach(clearTimeout);
    autoTimers.current = [];
  }
  function scheduleAuto(fn, ms) {
    const id = setTimeout(fn, ms);
    autoTimers.current.push(id);
    return id;
  }
  function stopAutoplay() {
    setAutoActive(false);
    setCursorPos(null);
    clearAutoTimers();
  }
  function moveCursorTo(el, ms, onArrive) {
    scheduleAuto(() => {
      if (!el || !cardRef.current) return;
      const c = cardRef.current.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setCursorPos({ x: r.left + r.width / 2 - c.left, y: r.top + r.height / 2 - c.top });
      scheduleAuto(() => {
        setTapping(true);
        scheduleAuto(() => setTapping(false), 220);
        onArrive();
      }, 550);
    }, ms);
  }
  // Actually draws the trace_letter demo instead of just flipping a "done"
  // flag — the ghost cursor drags across two rough strokes over the pad
  // (SIZE=180 coordinate space, see TraceLetterPad) while real ink appears
  // on the canvas via its imperative paintDown/paintMove handle, the same
  // way a real pointerdown/move sequence would. Ink is only marked "dirty"
  // (finishPaint) once both strokes are fully drawn — see the comment on
  // TraceLetterPad's useImperativeHandle for why doing it earlier breaks
  // the animation. The path itself comes from strokePath() — the real
  // glyph's shape (see computeGlyphStrokePath) — with a rough fallback only
  // if that somehow comes back empty (e.g. canvas unsupported).
  function simulateAutoTrace(onDone) {
    const pad = traceRef.current;
    const rect = pad?.canvasRect?.();
    if (!pad || !rect || !cardRef.current) {
      onDone();
      return;
    }
    const c = cardRef.current.getBoundingClientRect();
    const computed = pad.strokePath?.();
    const strokes = computed && computed.length ? computed : [
      [{ x: 90, y: 38 }, { x: 72, y: 88 }, { x: 55, y: 140 }],
      [{ x: 90, y: 68 }, { x: 108, y: 104 }, { x: 126, y: 140 }],
    ];
    const toCard = (p) => ({ x: rect.left + p.x - c.left, y: rect.top + p.y - c.top });
    let strokeIdx = 0;
    let pointIdx = 0;
    const step = () => {
      const stroke = strokes[strokeIdx];
      const p = stroke[pointIdx];
      setCursorPos(toCard(p));
      if (pointIdx === 0) pad.paintDown(p.x, p.y);
      else pad.paintMove(p.x, p.y);
      pointIdx += 1;
      if (pointIdx >= stroke.length) {
        strokeIdx += 1;
        pointIdx = 0;
        if (strokeIdx >= strokes.length) {
          scheduleAuto(() => { pad.finishPaint(); onDone(); }, 200);
          return;
        }
        scheduleAuto(step, 240);
        return;
      }
      scheduleAuto(step, 140);
    };
    step();
  }
  useEffect(() => clearAutoTimers, []);

  // Autoplay (and the sfx it triggers) only runs while the demo card is
  // actually on screen AND the tab itself is the active/foreground one —
  // scrolling past it, switching tabs, or backgrounding the window all pause
  // the whole loop instead of it ticking away and playing sound unseen.
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  const canAutoplay = inView && tabVisible;
  useEffect(() => {
    if (!canAutoplay) {
      setCursorPos(null);
      clearAutoTimers();
    }
  }, [canAutoplay]);

  const q = DEMO_QUESTIONS[qi];
  const isCorrect = checked && selected === q.correct;
  const isWrong = checked && selected !== q.correct;
  const wrongInfo = isWrong ? q.wrong[selected] : null;
  const pickedText = checked && selected != null ? (q.options || [])[selected] : "";
  const frames = KIND_FRAMES[q.kind] || KIND_FRAMES.translate_mcq;
  const feedbackText = wrongInfo ? frames[frameIdx % frames.length](q, wrongInfo, pickedText) : "";

  // Wrong answer → the tutor "thinks" briefly, then types its reply. Re-runs when
  // the learner asks for a different phrasing (frameIdx changes).
  useEffect(() => {
    if (!isWrong) return;
    setAiPhase("thinking");
    setTyped(0);
    const t = setTimeout(() => setAiPhase("reveal"), 620);
    return () => clearTimeout(t);
  }, [isWrong, qi, frameIdx]);

  // Typewriter reveal — a couple of characters per tick reads like live generation.
  useEffect(() => {
    if (aiPhase !== "reveal" || !feedbackText || typed >= feedbackText.length) return;
    const t = setTimeout(() => setTyped((n) => Math.min(feedbackText.length, n + 2)), 16);
    return () => clearTimeout(t);
  }, [aiPhase, typed, feedbackText]);

  function pick(i) {
    if (checked) return;
    setSelected(i);
  }

  function onCheck() {
    if (checked) return;
    // trace_letter has no MCQ selection — any real stroke counts, so checking
    // is just "did they draw something" (traceDirty) rather than "did they
    // pick the right option". Force sel to q.correct so the rest of the
    // correct/wrong plumbing below (shared with every other kind) just works.
    const sel = q.kind === "trace_letter" ? q.correct : selected;
    if (sel == null || (q.kind === "trace_letter" && !traceDirty)) return;
    setSelected(sel);
    setChecked(true);
    if (sel === q.correct) {
      sfx.correct(comboRef.current);
      comboRef.current += 1;
    } else {
      comboRef.current = 0;
      sfx.wrong();
      setHearts((h) => Math.max(0, h - 1));
    }
  }

  function regenerate() {
    setFrameIdx((n) => n + 1); // effect above restarts thinking→typing with a new frame
  }

  function onContinue() {
    // End on a high note instead of looping forever — a visitor who finishes
    // all four questions just proved to themselves the product works, which is
    // exactly the moment to ask for the signup, not silently restart.
    if (qi >= DEMO_QUESTIONS.length - 1) {
      sfx.complete();
      setDone(true);
      return;
    }
    setQi((i) => i + 1);
    setSelected(null);
    setChecked(false);
    setTraceDirty(false);
    setAiPhase("thinking");
    setTyped(0);
  }

  function practiceAgain() {
    setDone(false);
    setQi(0);
    setSelected(null);
    setChecked(false);
    setTraceDirty(false);
    setHearts(4);
    setFrameIdx(0);
    setAiPhase("thinking");
    setTyped(0);
  }

  const typing = aiPhase === "reveal" && typed < feedbackText.length;

  // Autoplay driver — three steps mirroring the state machine above: move the
  // ghost cursor to the correct option and pick it, move to Check, then move to
  // Continue. Each effect only fires when it's actually that step's turn, so it
  // stays in sync with the real state instead of a blind timer chain.
  useEffect(() => {
    if (!autoActive || !canAutoplay || checked) return;
    const ready = q.kind === "trace_letter" ? traceDirty : selected != null;
    if (ready) return;
    if (q.kind === "trace_letter") {
      moveCursorTo(padRef.current, 1200, () => simulateAutoTrace(() => setTraceDirty(true)));
    } else {
      moveCursorTo(optionRefs.current[q.correct], 1000, () => pick(q.correct));
    }
    return clearAutoTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoActive, canAutoplay, checked, selected, traceDirty, qi]);

  useEffect(() => {
    if (!autoActive || !canAutoplay || checked) return;
    const ready = q.kind === "trace_letter" ? traceDirty : selected != null;
    if (!ready) return;
    moveCursorTo(checkRef.current, 500, onCheck);
    return clearAutoTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoActive, canAutoplay, checked, selected, traceDirty]);

  useEffect(() => {
    if (!autoActive || !canAutoplay || !checked) return;
    moveCursorTo(continueRef.current, 1400, onContinue);
    return clearAutoTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoActive, canAutoplay, checked, qi]);

  useEffect(() => {
    if (!autoActive || !canAutoplay || !done) return;
    scheduleAuto(practiceAgain, 2600);
    return clearAutoTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoActive, canAutoplay, done]);

  if (done) {
    return (
      <div className="rounded-3xl bg-white dark:bg-[#18181b] p-6 text-center shadow-xl ring-1 ring-slate-200 dark:ring-white/[0.08]">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-grass-50 text-grass-500">
          <Trophy className="h-7 w-7" />
        </div>
        <div className="mt-4 font-display text-xl font-extrabold text-slate-800 dark:text-white">
          {renderTemplate(tt("demo.completion.triedExercises"), { count: DEMO_QUESTIONS.length })}
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-stone-400">
          {tt("demo.completion.body")}
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {DEMO_QUESTIONS.map((dq) => (
            <span key={dq.prompt} className="rounded-full bg-slate-50 dark:bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-500 dark:text-stone-400 ring-1 ring-slate-200 dark:ring-white/[0.08]">
              {dq.prompt} — {dq.meaning}
            </span>
          ))}
        </div>
        <button type="button" onClick={() => { stopAutoplay(); onSignup(); }} className="btn3d btn3d-brand mt-6 w-full text-base uppercase">
          {tt("demo.completion.createAccount")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
        </button>
        <button type="button" onClick={() => { stopAutoplay(); practiceAgain(); }} className="mt-3 text-sm font-bold text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300">
          {tt("demo.completion.practiceAgain")}
        </button>
      </div>
    );
  }

  return (
    <div ref={cardRef} className="relative rounded-3xl bg-white dark:bg-[#18181b] p-5 shadow-xl ring-1 ring-slate-200 dark:ring-white/[0.08]">
      {autoActive && cursorPos && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-500 ease-out"
          style={{ left: cursorPos.x, top: cursorPos.y }}
        >
          <span className={"block h-8 w-8 rounded-full border-2 border-white bg-brand-500/80 shadow-lg transition-transform duration-150 " + (tapping ? "scale-75" : "scale-100")} />
        </div>
      )}
      {/* No simulated lesson chrome (close ✕, progress bar, hearts) — on a
          marketing hero those mean nothing to a first-time visitor and just
          add elements to scan past. Prompt → play → tiles → check. */}
      <DemoPromptHeader q={q} />

      {q.kind === "trace_letter" ? (
        <div ref={padRef} className="mt-4">
          <TraceLetterPad ref={traceRef} letter={q.prompt} onDirtyChange={setTraceDirty} onInteractStart={stopAutoplay} />
        </div>
      ) : (
      <div className="mt-4 grid grid-cols-1 gap-3">
        {q.options.map((t, i) => {
          const isSel = selected === i;
          const tone =
            checked && i === q.correct
              ? "tile-correct"
              : checked && isSel && i !== q.correct
              ? "tile-wrong"
              : isSel
              ? "tile-selected-brand"
              : "";
          return (
            <button
              key={t}
              ref={(el) => (optionRefs.current[i] = el)}
              type="button"
              onClick={() => { stopAutoplay(); pick(i); }}
              disabled={checked}
              className={"tile text-start " + tone}
            >
              <span className="flex items-center gap-3">
                <span
                  className={
                    "grid h-7 w-7 place-items-center rounded-lg text-xs font-extrabold ring-2 " +
                    (checked && i === q.correct
                      ? "bg-grass-500 text-white ring-grass-500"
                      : checked && isSel && i !== q.correct
                      ? "bg-cardinal-500 text-white ring-cardinal-500"
                      : isSel
                      ? "bg-brand-500 text-white ring-brand-500"
                      : "text-slate-400 dark:text-stone-500 ring-slate-200 dark:ring-white/[0.08]")
                  }
                >
                  {i + 1}
                </span>
                <span>
                  {t}
                  {q.optionsRom?.[i] && (
                    <span className="ms-1.5 font-semibold text-slate-400 dark:text-stone-500">({q.optionsRom[i]})</span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      )}

      {checked ? (
        isCorrect ? (
          <div className="mt-5 -mx-5 -mb-5 rounded-b-3xl bg-grass-50 px-5 py-4 dark:bg-grass-500/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-display text-base font-extrabold text-grass-700 dark:text-grass-300">{tt("demo.ui.correctFeedback")}</div>
                <div className="mt-2"><VoiceChip text={q.prompt} label={q.meaning} /></div>
              </div>
              <button ref={continueRef} type="button" onClick={() => { stopAutoplay(); onContinue(); }} className="btn3d btn3d-grass uppercase">{tt("demo.ui.continue")}</button>
            </div>
          </div>
        ) : (
          <div className="mt-5 -mx-5 -mb-5 rounded-b-3xl bg-cardinal-50 px-5 py-4 dark:bg-cardinal-500/10">
            {/* Simulated AI tutor: explains the specific mistake instead of just
                flashing the right answer, so a visitor sees why they were wrong. */}
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-cardinal-500/10 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-cardinal-700 dark:bg-cardinal-500/20 dark:text-cardinal-300">
                <Sparkles className="h-3.5 w-3.5" /> {tt("demo.ui.tutorLabel")}
              </div>
              <button
                type="button"
                onClick={() => { stopAutoplay(); regenerate(); }}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-cardinal-600 hover:bg-cardinal-500/10 dark:text-cardinal-400 dark:hover:bg-cardinal-500/15"
                title={tt("demo.ui.explainDifferentlyTitle")}
              >
                <RotateCw className="h-3.5 w-3.5" /> {tt("demo.ui.explainDifferently")}
              </button>
            </div>

            <div className="mt-2 min-h-[3.5rem] text-sm font-semibold leading-relaxed text-slate-700 dark:text-stone-200">
              {aiPhase === "thinking" ? (
                <span className="inline-flex items-center gap-2 text-slate-400 dark:text-stone-500">
                  <span className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-cardinal-400 [animation-delay:-0.2s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-cardinal-400 [animation-delay:-0.1s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-cardinal-400" />
                  </span>
                  {tt("demo.ui.thinking")}
                </span>
              ) : (
                <span>
                  {feedbackText.slice(0, typed)}
                  {typing && <span className="ms-0.5 inline-block h-4 w-0.5 -translate-y-0.5 animate-pulse bg-slate-400 align-middle" />}
                </span>
              )}
            </div>

            {aiPhase === "reveal" && !typing && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <VoiceChip text={q.prompt} label={q.meaning} />
                {q.kind === "translate_mcq" && wrongInfo?.arm && (
                  <VoiceChip text={wrongInfo.arm} label={pickedText} tone="slate" />
                )}
                {(q.kind === "listening" || q.kind === "word_match") && (
                  <VoiceChip text={pickedText} label={wrongInfo?.meaning} tone="slate" />
                )}
              </div>
            )}

            <div className="mt-3 flex justify-end">
              <button type="button" onClick={() => { stopAutoplay(); onContinue(); }} className="btn3d btn3d-cardinal uppercase">{tt("demo.ui.continue")}</button>
            </div>
          </div>
        )
      ) : (
        <div className="mt-5 flex justify-end">
          <button
            ref={checkRef}
            type="button"
            onClick={() => { stopAutoplay(); onCheck(); }}
            disabled={q.kind === "trace_letter" ? !traceDirty : selected == null}
            className="btn3d btn3d-ink uppercase disabled:cursor-not-allowed disabled:opacity-40"
          >
            {tt("demo.ui.check")}
          </button>
        </div>
      )}
    </div>
  );
}

// Faint connector line behind the "How it works" step cards, echoing the
// lesson-path metaphor. Runs behind the cards (painted first, same stacking
// context) so it only shows in the gaps, like the cards sit along the path.
// ── Learning path preview (product preview section) ─────────────────────────
const PATH_PREVIEW_STATUSES = ["done", "done", "current", "locked", "locked"];

// x = % across the card (viewBox is 0–100 wide, so these double as percentages),
// y = px down the track. Zigzag pattern mirrors the real in-app lesson path.
const PATH_NODE_POS = [
  { x: 50, y: 44 },
  { x: 80, y: 146 },
  { x: 50, y: 248 },
  { x: 20, y: 350 },
  { x: 50, y: 452 },
];
const PATH_TRACK_HEIGHT = 452;

function pathTrackD() {
  let d = `M${PATH_NODE_POS[0].x},${PATH_NODE_POS[0].y}`;
  for (let i = 1; i < PATH_NODE_POS.length; i++) {
    const a = PATH_NODE_POS[i - 1];
    const b = PATH_NODE_POS[i];
    const midY = (a.y + b.y) / 2;
    d += ` C${a.x},${midY} ${b.x},${midY} ${b.x},${b.y}`;
  }
  return d;
}

function PathPreview() {
  const { t: tt } = useTranslation("landing");
  const [ref, visible] = useReveal(0.25);
  const units = tt("yourPath.units", { returnObjects: true });
  const PATH_PREVIEW_LESSONS = PATH_PREVIEW_STATUSES.map((status, i) => ({ title: units[i].title, status }));
  return (
    <div ref={ref} className="relative overflow-hidden rounded-3xl bg-white dark:bg-[#18181b] p-6 shadow-xl ring-1 ring-slate-200 dark:ring-white/[0.08] sm:p-7">
      <div className="flex items-center justify-between">
        <div className="font-display text-sm font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">{tt("yourPath.label")}</div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-extrabold text-brand-600 dark:bg-brand-500/15">
          <Flame className="h-3.5 w-3.5 fill-brand-500 text-brand-500" /> {tt("yourPath.streakLabel", { days: 487 })}
        </div>
      </div>

      <div className="relative mt-8" style={{ height: PATH_TRACK_HEIGHT + 60 }}>
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 100 ${PATH_TRACK_HEIGHT}`}
          preserveAspectRatio="none"
        >
          <path
            d={pathTrackD()}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="1.2 5"
            pathLength="100"
            strokeDashoffset={visible ? 0 : 100}
            style={{ transition: "stroke-dashoffset 1.1s ease-out" }}
            vectorEffect="non-scaling-stroke"
            className="text-slate-200 dark:text-white/10"
          />
        </svg>

        {PATH_PREVIEW_LESSONS.map((lesson, i) => {
          const isDone = lesson.status === "done";
          const isCurrent = lesson.status === "current";
          const pos = PATH_NODE_POS[i];
          return (
            <div
              key={lesson.title}
              className="absolute flex flex-col items-center gap-2"
              style={{
                left: `${pos.x}%`,
                top: pos.y,
                opacity: visible ? 1 : 0,
                transform: `translate(-50%, -50%) scale(${visible ? 1 : 0.4})`,
                transitionProperty: "opacity, transform",
                transitionDuration: "420ms",
                transitionTimingFunction: "cubic-bezier(.34,1.56,.64,1)",
                transitionDelay: `${450 + i * 160}ms`,
              }}
            >
              {isCurrent && (
                <span className="pointer-events-none absolute -top-9 whitespace-nowrap rounded-xl bg-brand-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-btn-brand">
                  {tt("yourPath.startBadge")}
                  <span className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-brand-500" />
                </span>
              )}
              <div className="relative">
                {isCurrent && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-brand-400 opacity-50" />
                )}
                <div
                  className={
                    "relative grid h-16 w-16 place-items-center rounded-full text-white shadow-node transition active:translate-y-1 " +
                    (isDone
                      ? "bg-grass-500"
                      : isCurrent
                      ? "bg-brand-500"
                      : "bg-slate-200 text-slate-400 dark:bg-white/10 dark:text-stone-500")
                  }
                >
                  {isDone ? (
                    <Check className="h-7 w-7" strokeWidth={3} />
                  ) : isCurrent ? (
                    <Play className="h-6 w-6 fill-white" />
                  ) : (
                    <Lock className="h-6 w-6" />
                  )}
                </div>
              </div>
              <div className="text-center">
                <div className={"font-display text-sm font-extrabold leading-tight " + (lesson.status === "locked" ? "text-slate-400 dark:text-stone-500" : "text-slate-800 dark:text-white")}>
                  {lesson.title}
                </div>
                <div className={"text-[11px] font-bold " + (isDone ? "text-grass-600" : isCurrent ? "text-brand-500" : "text-slate-300 dark:text-stone-600")}>
                  {isDone ? tt("yourPath.statusCompleted") : isCurrent ? tt("yourPath.statusHere") : tt("yourPath.statusLocked")}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LandingPage({ onLogin, onSignup }) {
  const { t: tt } = useTranslation("landing");
  const locale = useLocale();
  const faqs = tt("faqs", { returnObjects: true });

  // Homepage FAQ rich-result data. This used to live in index.html, which
  // meant EVERY page shipped it — colliding with the page-level FAQPage on
  // the SEO landing pages, and Google only honours one FAQPage per page. It
  // belongs to the homepage's own FAQ section, so it lives with it and is
  // torn down on unmount like the rest of usePageMeta's structured data.
  const HOMEPAGE_FAQ = useMemo(() => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
          {
                "@type": "Question",
                "name": "Is Haylingua free?",
                "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Yes — you can create an account and start learning the Armenian alphabet and your first lessons for free."
                }
          },
          {
                "@type": "Question",
                "name": "I don't know the Armenian alphabet at all. Is that okay?",
                "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Perfect, that's exactly where we begin. The first lessons introduce each letter with its sound, examples, and typing practice before you ever build a word."
                }
          },
          {
                "@type": "Question",
                "name": "Do I need a special keyboard?",
                "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "No. Exercises are tap-and-choose or use on-screen prompts, and typing exercises accept the Armenian letters shown to you."
                }
          },
          {
                "@type": "Question",
                "name": "Does it work on my phone?",
                "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "Yes. Haylingua is built mobile-first and works in any modern browser on phone, tablet, or desktop."
                }
          },
          {
                "@type": "Question",
                "name": "How do streaks and hearts work?",
                "acceptedAnswer": {
                      "@type": "Answer",
                      "text": "You earn XP for correct answers and keep a daily streak by practicing each day. Hearts give you a few tries per session so mistakes feel low-stakes."
                }
          }
  ],
  }), []);

  usePageMeta(tt("meta.title"), tt("meta.description"), {
    path: "/",
    structuredData: HOMEPAGE_FAQ,
    keywords: tt("meta.keywords", { returnObjects: true }),
    alternates: SUPPORTED_LOCALES.map((loc) => ({ locale: loc, path: "/" })).concat([{ locale: "", path: "/" }]),
  });
  const [mode, setMode] = useState("login"); // login | signup | forgot | verify
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [needsCaptcha, setNeedsCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Verification state
  const [token, setToken] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  // Six single-digit boxes that compose into the same `code` string
  // handleVerify already validates/submits — only how the digits get typed
  // in changes, not the verification logic itself.
  const verifyBoxRefs = useRef([]);

  // UI-only state
  const [faqOpen, setFaqOpen] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const authRef = useRef(null);

  // Mobile sticky CTA: once a visitor has scrolled past the hero (where the
  // primary buttons already are), a persistent "Start free" bar keeps the
  // conversion action one thumb-tap away instead of requiring a scroll back up.
  useEffect(() => {
    const onScroll = () => setShowStickyCta(window.scrollY > 640);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Warm the browser cache with both auth banners so the modal's promo image
  // is already decoded and pops in instantly the moment it opens (instead of
  // loading — and briefly flashing the fallback — on click). Deferred to
  // idle rather than firing on first paint: these are two images (~460KB
  // combined) nobody sees unless they open the modal, so fetching them
  // immediately competes with the actual hero content for bandwidth during
  // the LCP window on slow connections — same idle-load pattern index.html
  // already uses for Clarity/Brevo.
  useEffect(() => {
    const warm = () => {
      [SIGNUP_BANNER_WEBP, LOGIN_BANNER_WEBP].forEach((s) => {
        const img = new Image();
        img.src = s;
      });
    };
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 2000));
    const id = idle(warm, { timeout: 4000 });
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(id) : clearTimeout(id));
  }, []);

  // Auth modal: lock background scroll, close on Escape, move focus in on
  // open and back to whatever opened it on close — without this a keyboard
  // or screen-reader user has no idea the modal appeared at all (focus was
  // previously left sitting on <body>).
  useEffect(() => {
    if (!authOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previouslyFocused = document.activeElement;
    authRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") closeAuth(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [authOpen]);


  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const goAuth = (m) => {
    setMode(m);
    setError("");
    setAuthOpen(true);
  };

  // Other pages (e.g. Pricing) navigate here with `state: { openAuth: "signup" }`
  // to deep-link straight into this page's own auth modal. Clear the state
  // right after so a back-nav or refresh doesn't reopen it.
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (location.state?.openAuth) {
      goAuth(location.state.openAuth);
      navigate(".", { replace: true, state: {} });
    }
  }, [location.state]);

  // /signup and /login are real, linkable routes (App.jsx renders this same
  // LandingPage at both) — previously login/signup existed only as modal
  // state with no URL of their own, so nobody could link straight to the
  // signup screen, a paid ad couldn't land on it, browser back didn't close
  // it, and every signup attempt showed up in analytics as a homepage
  // pageview with no way to measure funnel drop-off. Opening here from the
  // URL (rather than only from a click) needed its own effect since goAuth
  // above only fires from in-page interactions.
  useEffect(() => {
    if (location.pathname === localizedPath("/signup", locale)) goAuth("signup");
    else if (location.pathname === localizedPath("/login", locale)) goAuth("login");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Closing the modal when it was opened via /signup or /login navigates
  // back to "/" — otherwise the URL would keep claiming "you are on the
  // signup screen" after the visitor has closed it.
  const closeAuth = () => {
    setAuthOpen(false);
    if (location.pathname === localizedPath("/signup", locale) || location.pathname === localizedPath("/login", locale)) {
      navigate(localizedPath("/", locale), { replace: true });
    }
  };

  // Affiliate attribution — a `?ref=CODE` visit is remembered for 30 days
  // (matches the cookie-window promise on /affiliates) so signup can credit
  // whichever affiliate sent this visitor, even if they sign up days later.
  useEffect(() => {
    const code = new URLSearchParams(location.search).get("ref");
    if (!code) return;
    localStorage.setItem("hay_ref_code", code);
    localStorage.setItem("hay_ref_ts", String(Date.now()));
    fetch(`${API_BASE}/affiliates/track-click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).catch(() => {});
  }, [location.search]);

  // ── Auth Handlers ───────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (mode === "signup") {
      if (!username.trim()) { setError(tt("authModal.errors.usernameRequired")); return; }
      const u = username.trim();
      if (u.length < 3 || u.length > 20) { setError(tt("authModal.errors.usernameLength")); return; }
      for (const ch of u) {
        const ok = /[a-zA-Z0-9_.]/.test(ch);
        if (!ok) { setError(tt("authModal.errors.usernameChars")); return; }
      }
      if (!password || password.length < 8) { setError(tt("authModal.errors.passwordLength")); return; }
    }

    setLoading(true);
    try {
      if (mode === "forgot") {
        const res = await fetch(`${API_BASE}/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d?.detail || tt("authModal.errors.generic")); }
        setForgotSent(true);
        setLoading(false);
        return;
      }
      if (mode === "login") {
        await onLogin(email.trim(), password, needs2FA ? otp : null, needsCaptcha ? captchaToken : null);
      } else {
        await handleSignup();
      }
    } catch (err) {
      if (mode === "login" && err?.requires2fa) {
        setNeeds2FA(true);
        setError(tt("authModal.errors.need2fa"));
      } else if (mode === "login" && err?.requiresCaptcha) {
        setNeedsCaptcha(true);
        setCaptchaToken(null);
        setCaptchaKey((k) => k + 1);
        setError(tt("authModal.errors.needCaptcha"));
      } else if (mode === "login" && err?.locked) {
        setError(err?.message || tt("authModal.errors.tooManyAttemptsLogin"));
      } else {
        setError(err?.message || tt("authModal.errors.somethingWrong"));
      }
    } finally {
      if ((mode === "login" && needsCaptcha) || mode === "signup") {
        setCaptchaToken(null);
        setCaptchaKey((k) => k + 1);
      }
      setLoading(false);
    }
  };

  function getStoredRefCode() {
    const code = localStorage.getItem("hay_ref_code");
    const ts = Number(localStorage.getItem("hay_ref_ts") || 0);
    if (!code || !ts) return null;
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    return Date.now() - ts < THIRTY_DAYS_MS ? code : null;
  }

  const handleSignup = async () => {
    const refCode = getStoredRefCode();
    const res = await fetch(`${API_BASE}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || null,
        username: username.trim(),
        email: email.trim(),
        password,
        ref_code: refCode,
        turnstile_token: captchaToken,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data?.detail?.field) throw new Error((data.detail.errors || []).join(". "));
      const msg = data?.detail || data?.message || tt("authModal.errors.signupFailed");
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    const accessToken = data?.access_token;
    if (!accessToken) throw new Error(tt("authModal.errors.signupNoToken"));
    setToken(accessToken);
    localStorage.setItem("hay_token", accessToken);
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("user_email", email.trim());
    const newUser = {
      id: 1, email: email.trim(),
      name: name.trim() || email.split("@")[0],
      username: username.trim(),
      firstName: "", lastName: "", avatarUrl: "",
      level: 1, xp: 0, streak: 0, completedLessons: [], email_verified: false,
    };
    localStorage.setItem("hay_user", JSON.stringify(newUser));
    if (data.verification_code) setDevCode(data.verification_code);
    track("signup_completed", { source: "landing_modal_inline", has_referral: !!refCode });
    setMode("verify");
    setLoading(false);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6 || !/^\d{6}$/.test(trimmedCode)) {
      setError(tt("authModal.errors.invalidVerifyCode"));
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: trimmedCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data?.detail || tt("authModal.errors.verificationFailed");
        const msgs = {
          INVALID_CODE: tt("authModal.errors.invalidCode"),
          CODE_EXPIRED: tt("authModal.errors.codeExpired"),
          NO_CODE: tt("authModal.errors.noCodeFound"),
          TOO_MANY_ATTEMPTS: tt("authModal.errors.tooManyAttemptsCode"),
        };
        setError(msgs[detail] || (typeof detail === "string" ? detail : JSON.stringify(detail)));
        setLoading(false);
        return;
      }
      const userStr = localStorage.getItem("hay_user");
      if (userStr) {
        const u = JSON.parse(userStr);
        u.email_verified = true;
        localStorage.setItem("hay_user", JSON.stringify(u));
      }
      window.location.href = "/onboarding";
    } catch (err) {
      setError(tt("authModal.errors.networkErrorRetry"));
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/resend-verification`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data?.detail;
        if (res.status === 429 && detail?.retry_after_s) {
          setCooldown(Number(detail.retry_after_s) || 60);
          setError(tt("authModal.errors.resendWait", { s: detail.retry_after_s }));
          return;
        }
        if (detail === "ALREADY_VERIFIED") { window.location.href = "/dashboard"; return; }
        setError(typeof detail === "string" ? detail : tt("authModal.errors.resendFailed"));
        return;
      }
      if (data.verification_code) setDevCode(data.verification_code);
      setCooldown(Number(data?.retry_after_s) || 60);
    } catch { setError(tt("authModal.errors.networkError")); }
    finally { setLoading(false); }
  };

  // ── Verification Screen ─────────────────────────────────────────────────────

  function setVerifyDigit(i, raw) {
    const val = raw.replace(/\D/g, "");
    const chars = code.split("");
    if (!val) {
      chars[i] = "";
      setCode(chars.join("").slice(0, 6));
      return;
    }
    // A multi-char value here means a paste landed in this box — spread the
    // rest of the pasted digits forward starting at this position.
    const spread = val.split("");
    spread.forEach((d, j) => { chars[i + j] = d; });
    const next = chars.join("").slice(0, 6);
    setCode(next);
    if (error && next.length === 6) setError("");
    verifyBoxRefs.current[Math.min(i + spread.length, 5)]?.focus();
  }

  function onVerifyBoxKeyDown(i, e) {
    if (e.key === "Backspace" && !code[i] && i > 0) verifyBoxRefs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) verifyBoxRefs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) verifyBoxRefs.current[i + 1]?.focus();
  }

  if (mode === "verify") {
    const verifyDigits = Array.from({ length: 6 }, (_, i) => code[i] || "");
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50/60 to-white dark:from-[#0d0d0f] dark:to-[#0d0d0f] px-4">
        <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#18181b] p-8 text-center shadow-xl ring-1 ring-slate-200 dark:ring-white/[0.08]">
          <img src={grandma} alt="" loading="lazy" className="mx-auto h-20 w-20 animate-floaty rounded-2xl object-cover" />
          <h2 className="mt-4 font-display text-2xl font-extrabold text-slate-800 dark:text-white">{tt("authModal.verify.checkInbox")}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">
            {tt("authModal.verify.codeSentTo").split("{{email}}")[0]}<span className="text-slate-700 dark:text-stone-200">{email}</span>{tt("authModal.verify.codeSentTo").split("{{email}}")[1]}
          </p>

          {devCode && (
            <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-start ring-1 ring-amber-200">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" /> {tt("authModal.verify.devModeLabel")}
              </div>
              <div className="mt-2 rounded-xl bg-white py-2.5 text-center font-display text-2xl font-extrabold tracking-[0.3em] text-amber-900 ring-1 ring-amber-200">
                {devCode}
              </div>
              <button onClick={() => { setCode(devCode); setError(""); }} className="btn3d btn3d-brand mt-2.5 w-full !py-2.5 text-sm">
                {tt("authModal.verify.useThisCode")}
              </button>
            </div>
          )}

          <form onSubmit={handleVerify} className="mt-6">
            <div
              className="flex justify-center gap-2"
              onPaste={(e) => {
                const pasted = (e.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, 6);
                if (!pasted) return;
                e.preventDefault();
                setVerifyDigit(0, pasted);
              }}
            >
              {verifyDigits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => (verifyBoxRefs.current[i] = el)}
                  value={d}
                  onChange={(e) => setVerifyDigit(i, e.target.value)}
                  onKeyDown={(e) => onVerifyBoxKeyDown(i, e)}
                  inputMode="numeric"
                  maxLength={1}
                  autoFocus={i === 0}
                  aria-label={tt("authModal.verify.digitLabel", { n: i + 1 })}
                  className={
                    "h-14 w-11 rounded-2xl bg-slate-50 text-center font-display text-2xl font-extrabold text-slate-800 ring-2 transition focus:bg-white focus:outline-none focus:ring-brand-400 dark:bg-white/[0.04] dark:text-white dark:focus:bg-white/[0.06] " +
                    (error ? "ring-cardinal-400" : "ring-slate-200 dark:ring-white/[0.08]")
                  }
                />
              ))}
            </div>
            {error && <div className="mt-4 rounded-xl bg-cardinal-50 px-4 py-2.5 text-sm font-semibold text-cardinal-600">{error}</div>}
            <button type="submit" disabled={loading || code.trim().length !== 6} className="btn3d btn3d-grass mt-4 w-full uppercase">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? tt("authModal.verify.verifying") : tt("authModal.verify.verifyEmail")}
            </button>
          </form>

          <button onClick={handleResend} disabled={loading || cooldown > 0} className="mt-4 text-sm font-bold text-slate-500 dark:text-stone-400 hover:text-slate-700 dark:hover:text-stone-200 disabled:opacity-50">
            {cooldown > 0 ? tt("authModal.verify.resendIn", { s: cooldown }) : tt("authModal.verify.resendCode")}
          </button>
          <p className="mt-2 text-xs font-semibold text-slate-400 dark:text-stone-500">{tt("authModal.verify.codeExpiresNote")}</p>
        </div>
      </div>
    );
  }

  // ── Auth card ────────────────────────────────────────────────────────────────
  const authCard = (
    <div
      ref={authRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={mode === "login" ? tt("authModal.tabs.login") : mode === "signup" ? tt("authModal.tabs.signup") : tt("authModal.forgot.sendResetLink")}
      className="relative w-full bg-white dark:bg-[#18181b] px-6 pb-6 pt-12 outline-none sm:px-7 sm:pb-7 sm:pt-12"
    >
      <button
        type="button"
        onClick={closeAuth}
        aria-label={tt("authModal.close")}
        className="absolute end-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-stone-400 transition hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-stone-200"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 dark:bg-white/[0.06] p-1">
        {["login", "signup"].map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(""); setForgotSent(false); }}
            className={
              "rounded-xl py-2.5 font-display text-sm font-extrabold transition " +
              (mode === m ? "bg-white dark:bg-white/10 text-slate-800 dark:text-white shadow-sm" : "text-slate-500 dark:text-stone-400 hover:text-slate-700 dark:hover:text-stone-200")
            }
          >
            {m === "login" ? tt("authModal.tabs.login") : tt("authModal.tabs.signup")}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Forgot password — sent confirmation */}
        {mode === "forgot" && forgotSent ? (
          <div className="rounded-2xl bg-grass-50 px-4 py-5 text-center">
            <div className="text-2xl mb-1">📬</div>
            <p className="font-bold text-grass-700">{tt("authModal.verify.checkInbox")}</p>
            <p className="mt-1 text-sm text-grass-600">{tt("authModal.forgot.sentBody")}</p>
            <button type="button" onClick={() => { setMode("login"); setForgotSent(false); setEmail(""); setError(""); }} className="mt-4 text-sm font-bold text-brand-500 hover:underline">
              {tt("authModal.forgot.backToLogin")}
            </button>
          </div>
        ) : mode === "forgot" ? (
          <>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setMode("login"); setError(""); }} className="text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300 transition">
                ←
              </button>
              <p className="text-sm font-semibold text-slate-600 dark:text-stone-300">{tt("authModal.forgot.intro")}</p>
            </div>
            <Field label={tt("authModal.fields.email")} icon={Mail} name="email" type="email" value={email} onChange={setEmail} placeholder={tt("authModal.fields.emailPlaceholder")} autoComplete="email" />
            {error && <div className="rounded-xl bg-cardinal-50 px-4 py-2.5 text-sm font-semibold text-cardinal-600">{error}</div>}
            <button type="submit" disabled={loading || !email} className="btn3d btn3d-brand w-full uppercase disabled:opacity-60">
              {loading ? tt("authModal.forgot.sending") : tt("authModal.forgot.sendResetLink")}
              {!loading && <ArrowRight className="h-4 w-4 rtl:rotate-180" />}
            </button>
          </>
        ) : (
          <>
            {mode === "signup" && (
              // Name is collected during onboarding, not here.
              <Field label={tt("authModal.fields.username")} icon={Fingerprint} name="username" value={username} onChange={setUsername} placeholder={tt("authModal.fields.usernamePlaceholder")} autoComplete="username" />
            )}

            <Field
              label={mode === "login" ? tt("authModal.fields.emailOrUsername") : tt("authModal.fields.email")}
              icon={Mail}
              value={email}
              onChange={setEmail}
              placeholder={mode === "login" ? tt("authModal.fields.emailOrUsernamePlaceholder") : tt("authModal.fields.emailPlaceholder")}
              // Login: this IS the credential identifier, so mark it as the
              // "username" field (autocomplete="email" would make browsers treat
              // it as a contact/address field and skip password-manager fill).
              // Signup: it's a real email → use email semantics.
              name={mode === "login" ? "username" : "email"}
              type={mode === "login" ? "text" : "email"}
              autoComplete={mode === "login" ? "username" : "email"}
            />

            <div>
              <Field label={tt("authModal.fields.password")} icon={Lock} name="password" type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "signup" ? 8 : undefined} />
              {mode === "signup" && (
                <p className="mt-1.5 text-xs font-semibold text-slate-400 dark:text-stone-500">{tt("authModal.fields.passwordHint")}</p>
              )}
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setError(""); setForgotSent(false); }}
                  className="mt-1.5 block text-xs font-semibold text-brand-500 hover:underline"
                >
                  {tt("authModal.fields.forgotPasswordLink")}
                </button>
              )}
            </div>

            {mode === "login" && needs2FA && (
              <Field label={tt("authModal.fields.twoFaCode")} value={otp} onChange={setOtp} placeholder={tt("authModal.fields.twoFaPlaceholder")} autoComplete="one-time-code" />
            )}

            {((mode === "login" && needsCaptcha) || mode === "signup") && (
              <div className="rounded-2xl bg-slate-50 dark:bg-white/[0.04] p-3 ring-1 ring-slate-200 dark:ring-white/[0.08]">
                <div className="mb-2 text-xs font-bold text-slate-600 dark:text-stone-300">{tt("authModal.securityCheck")}</div>
                <Turnstile key={captchaKey} onVerify={(t) => { setCaptchaToken(t); if (t) setError(""); }} />
              </div>
            )}

            {error && <div className="rounded-xl bg-cardinal-50 px-4 py-2.5 text-sm font-semibold text-cardinal-600">{error}</div>}

            <button type="submit" disabled={loading || (mode === "signup" && !captchaToken)} className="btn3d btn3d-brand w-full uppercase">
              {loading ? tt("authModal.submit.pleaseWait") : mode === "login" ? (needs2FA ? tt("authModal.submit.verifyAndLogIn") : tt("authModal.submit.logIn")) : tt("authModal.submit.createAccount")}
              {!loading && <ArrowRight className="h-4 w-4 rtl:rotate-180" />}
            </button>
          </>
        )}
      </form>

      {/* Social sign-in — below the form (not shown on the forgot-password step) */}
      {mode !== "forgot" && (GOOGLE_CLIENT_ID || FACEBOOK_APP_ID || TELEGRAM_BOT_USERNAME) && (
        <div className="mt-5">
          <div className="relative mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            <span className="text-xs font-semibold text-slate-400 dark:text-stone-500">{tt("authModal.orDivider")}</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {TELEGRAM_BOT_ID && (
              // Plain button → top-level navigation to Telegram's OAuth page (the
              // same URL the login widget's popup opens). No iframe, no popup, no
              // transparent overlay — nothing for a popup blocker or hit-testing
              // quirk to break. Telegram redirects back to /auth/telegram/callback
              // with the signed result in the URL fragment (#tgAuthResult=…).
              <button
                type="button"
                onClick={() => {
                  const origin = window.location.origin;
                  const cb = origin + "/auth/telegram/callback";
                  window.location.href =
                    "https://oauth.telegram.org/auth?bot_id=" + encodeURIComponent(TELEGRAM_BOT_ID) +
                    "&origin=" + encodeURIComponent(origin) +
                    "&request_access=write" +
                    "&return_to=" + encodeURIComponent(cb);
                }}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#18181b] text-sm font-semibold text-slate-700 dark:text-stone-200 shadow-sm transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="#2AABEE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#2AABEE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Telegram
              </button>
            )}
            {GOOGLE_CLIENT_ID && (
              <button
                type="button"
                onClick={() => {
                  const buf = new Uint8Array(16);
                  crypto.getRandomValues(buf);
                  const state = Array.from(buf, b => b.toString(16).padStart(2, "0")).join("");
                  sessionStorage.setItem("oauth_state", state);
                  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent("https://haylingua.am/auth/google/callback")}&response_type=code&scope=openid%20email%20profile&prompt=select_account&state=${encodeURIComponent(state)}`;
                }}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#18181b] text-sm font-semibold text-slate-700 dark:text-stone-200 shadow-sm transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C16.658 14.015 17.64 11.707 17.64 9.2z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/><path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
                Google
              </button>
            )}
            {FACEBOOK_APP_ID && (
              <button
                type="button"
                onClick={() => {
                  const buf = new Uint8Array(16);
                  crypto.getRandomValues(buf);
                  const state = Array.from(buf, b => b.toString(16).padStart(2, "0")).join("");
                  sessionStorage.setItem("oauth_state", state);
                  window.location.href = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent("https://haylingua.am/auth/facebook/callback")}&response_type=code&scope=email,public_profile&state=${encodeURIComponent(state)}`;
                }}
                className="col-span-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#18181b] text-sm font-semibold text-slate-700 dark:text-stone-200 shadow-sm transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M18 9a9 9 0 1 0-10.406 8.89v-6.29H5.309V9h2.285V7.017c0-2.256 1.344-3.502 3.4-3.502.985 0 2.015.176 2.015.176v2.215h-1.135c-1.118 0-1.467.694-1.467 1.406V9h2.497l-.4 2.6h-2.097v6.29A9.002 9.002 0 0 0 18 9z" fill="#1877F2"/></svg>
                Facebook
              </button>
            )}
          </div>
        </div>
      )}

      {mode === "signup" && (
        <p className="mt-4 text-center text-xs font-medium text-slate-400 dark:text-stone-500">
          {tt("authModal.legal.agreePrefix")}{" "}
          <Link to="/terms" className="font-bold text-slate-500 underline hover:text-slate-700 dark:text-stone-400 dark:hover:text-stone-200">{tt("authModal.legal.terms")}</Link>{" "}
          {tt("authModal.legal.and")}{" "}
          <Link to="/privacy" className="font-bold text-slate-500 underline hover:text-slate-700 dark:text-stone-400 dark:hover:text-stone-200">{tt("authModal.legal.privacyPolicy")}</Link>.
        </p>
      )}
    </div>
  );

  // ── Main Landing ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white dark:bg-[#0d0d0f] text-slate-800 dark:text-white">
      {/* Nav — shared header (src/SiteNav.jsx), same on every marketing page.
          `inPage` swaps the section links to same-page anchors and routes
          the auth buttons into this page's own login/signup modal. */}
      <SiteNav inPage onLogin={() => goAuth("login")} onSignup={() => goAuth("signup")} />

      <main id="main-content">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute -end-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-brand-100/50 blur-3xl dark:bg-brand-500/10" />
        <div className="pointer-events-none absolute -start-24 top-40 h-72 w-72 rounded-full bg-feather-100/40 blur-3xl dark:bg-feather-500/10" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 lg:grid-cols-2 lg:py-20">
          <div>
            <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-slate-800 dark:text-white sm:text-6xl">
              {tt("hero.title1")}
              <br />
              <span className="text-brand-500">{tt("hero.title2")}</span>
            </h1>
            <p className="mt-5 max-w-md text-lg font-semibold text-slate-500 dark:text-stone-400">
              {tt("hero.subtitle")}
            </p>
            {/* Who it's for. The whole brand is heritage/diaspora learners
                (see the seven city pages) and the hero never said so. */}
            <p className="mt-3 max-w-md text-sm font-bold text-brand-700 dark:text-brand-300">
              {tt("hero.audience")}
            </p>

            {/* One CTA row, one trust line underneath. The hero deliberately
                stays at headline → subtitle → buttons → demo: the rotating
                word card, the "made playful" badge, and the 4-item value band
                that used to sit here all competed with the demo for the same
                "here's a taste of Armenian" job, and the eye had nowhere to
                land. */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button onClick={() => goAuth("signup")} className="btn3d btn3d-brand text-base">
                {tt("hero.ctaStart")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
              </button>
              <button onClick={() => goAuth("login")} className="btn3d btn3d-neutral text-base">{tt("hero.ctaLogin")}</button>
            </div>
            {/* One honest pricing line at the button — answers "what's the
                catch" right where the hesitation happens. */}
            <div className="mt-4 text-sm font-bold text-slate-500 dark:text-stone-400">
              {tt("hero.pricingLine")}
            </div>
          </div>

          <div className="relative">
            <LazyLandingDemo onSignup={() => goAuth("signup")} />
          </div>
        </div>
      </header>

      {/* Product preview. This is the one "what is it" section: the old
          "How it works" (3 steps) and "Features" (6 cards) that used to
          bracket it said the same things a second and third time — feedback,
          audio, hearts, streaks — so their strongest points are folded into
          the bullets here, next to the only real visual (the path preview). */}
      <section className="bg-gradient-to-b from-brand-50/60 to-white dark:from-[#0d0d0f] dark:to-[#0d0d0f]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 lg:grid-cols-2">
          <Reveal>
            <div>
              <SectionHeading align="left" eyebrow={tt("seeItInAction.eyebrow")} title={tt("seeItInAction.title")} />
              <p className="mt-4 max-w-md text-base font-semibold text-slate-500 dark:text-stone-400">
                {tt("seeItInAction.subtitle")}
              </p>
              <ul className="mt-6 space-y-3">
                {tt("seeItInAction.bullets", { returnObjects: true }).map((t) => (
                  <li key={t} className="flex items-center gap-3 font-bold text-slate-700 dark:text-stone-200">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-grass-100 text-grass-600"><Check className="h-4 w-4" /></span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* Learning path preview */}
          <Reveal delay={120}>
            <PathPreview />
          </Reveal>
        </div>
      </section>

      {/* Free tools & guides — links to the standalone SEO/utility pages,
          which the homepage previously didn't link to at all. A no-signup
          way in, and internal links for pages that carry the SEO weight.
          Kept visually quiet on purpose: this is a row of links to real
          pages, not a feature grid (the 4-item claims band that used to sit
          under the hero was cut for being exactly that). */}
      <section className="border-t border-slate-100 dark:border-white/[0.06]">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <Reveal>
            <SectionHeading eyebrow={tt("tools.eyebrow")} title={tt("tools.title")} />
            <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TOOL_LINKS.map((tool) => (
                <Link
                  key={tool.key}
                  to={localizedPath(tool.path, locale)}
                  className="group flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 font-bold text-slate-700 ring-1 ring-slate-200 transition hover:ring-brand-300 dark:bg-[#18181b] dark:text-stone-200 dark:ring-white/[0.08] dark:hover:ring-brand-500/40"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                    <tool.icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1">{tt(`tools.items.${tool.key}`)}</span>
                  <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500 rtl:rotate-180 dark:text-stone-600" />
                </Link>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* No testimonials section: the quotes it carried ("Ani M. · Los
          Angeles" etc.) weren't from identifiable learners, and in the EU a
          testimonial that isn't real or clearly labeled illustrative is a
          misleading-commercial-practice problem, not a taste call. Reinstate
          only with real, consented quotes. */}

      {/* Mobile app teaser */}
      <section className="bg-slate-50 dark:bg-white/[0.04]">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-2 md:gap-8">
          <Reveal className="order-2 md:order-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              <Bell className="h-3.5 w-3.5" /> {tt("mobileTeaser.badge")}
            </div>
            <h2 className="mt-4 text-balance font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-4xl">
              {tt("mobileTeaser.title")}
            </h2>
            <p className="mt-4 max-w-md text-sm font-semibold leading-relaxed text-slate-500 dark:text-stone-400">
              {tt("mobileTeaser.subtitle")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <div className="flex cursor-not-allowed items-center gap-2.5 rounded-2xl bg-slate-800 px-4 py-2.5 text-white opacity-60 dark:bg-white/10">
                <AppleGlyph className="h-6 w-6 shrink-0" />
                <div className="text-start leading-none">
                  <div className="text-[10px] font-semibold">{tt("mobileTeaser.appStoreComingSoon")}</div>
                  <div className="text-sm font-extrabold">{tt("mobileTeaser.appStoreName")}</div>
                </div>
              </div>
              <div className="flex cursor-not-allowed items-center gap-2.5 rounded-2xl bg-slate-800 px-4 py-2.5 text-white opacity-60 dark:bg-white/10">
                <GooglePlayGlyph className="h-6 w-6 shrink-0" />
                <div className="text-start leading-none">
                  <div className="text-[10px] font-semibold">{tt("mobileTeaser.googlePlayComingSoon")}</div>
                  <div className="text-sm font-extrabold">{tt("mobileTeaser.googlePlayName")}</div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Real screenshots of the actual app (Shop + Learn screens on
              phone frames, transparent PNG → WebP with alpha kept), in place
              of the hand-built CSS phone mockup that used to be here. That
              mockup showed made-up content and reintroduced the orange +
              rose + amber + green pile-up the hero had just been cleaned of. */}
          <Reveal delay={120} className="order-1 flex justify-center md:order-2">
            <picture>
              <source srcSet="/banners/haylingua-phones.webp" type="image/webp" />
              <img
                src="/banners/haylingua-phones.png"
                alt="The Haylingua mobile app: the Learn screen with today's lesson and unit path, and the Shop screen with power-ups"
                loading="lazy"
                width="832"
                height="893"
                className="h-auto w-full max-w-[420px] drop-shadow-2xl"
              />
            </picture>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-white dark:bg-[#0d0d0f]">
        <div className="mx-auto max-w-3xl px-5 py-16">
          <Reveal>
            <SectionHeading eyebrow={tt("faqSection.eyebrow")} title={tt("faqSection.title")} />
          </Reveal>
          {/* One reveal for the whole list, not one per item — five cards
              staggering in one after another was a lot of motion for a FAQ. */}
          <Reveal className="mt-8 space-y-3">
            {faqs.map((f, i) => {
              const open = faqOpen === i;
              return (
                <div key={i} className="overflow-hidden rounded-2xl bg-white dark:bg-[#18181b] ring-1 ring-slate-200 dark:ring-white/[0.08]">
                  <button
                    onClick={() => setFaqOpen(open ? -1 : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start"
                  >
                    <span className="font-display text-base font-extrabold text-slate-800 dark:text-white">{f.q}</span>
                    <ChevronDown className={"h-5 w-5 shrink-0 text-slate-400 dark:text-stone-500 transition " + (open ? "rotate-180" : "")} />
                  </button>
                  {open && <div className="px-5 pb-5 text-sm font-semibold text-slate-500 dark:text-stone-400">{f.a}</div>}
                </div>
              );
            })}
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 py-16">
        <Reveal>
          {/* Heading + one button. The "14 days free" badge, the subtitle,
              and the rotated photo that used to sit here all repeated claims
              already made on the signup modal and pricing page. */}
          <div className="relative mx-auto flex max-w-5xl flex-col items-center overflow-hidden rounded-[2rem] bg-brand-500 px-6 py-14 text-center text-white shadow-btn-brand">
            <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{tt("ctaBanner.heading")}</h2>
            <button onClick={() => goAuth("signup")} className="btn3d mt-7 bg-white !text-brand-600 shadow-[0_4px_0_0_#B84B00] text-base uppercase hover:brightness-100">
              {tt("ctaBannerExtra.cta")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </button>
          </div>
        </Reveal>
      </section>
      </main>

      {/* Footer */}
      <SiteFooter />

      {/* Sticky mobile CTA — keeps signup one tap away once the hero's own
          buttons have scrolled out of view. Hidden on desktop (header CTA is
          always visible there) and while the auth modal is open. */}
      {showStickyCta && !authOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-brand-600/20 bg-brand-500 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] sm:hidden">
          <div className="min-w-0 text-white">
            <div className="truncate text-sm font-extrabold">{tt("hero.premiumDays")}</div>
            <div className="text-xs font-semibold text-white/80">{tt("hero.noCard")}</div>
          </div>
          <button
            onClick={() => goAuth("signup")}
            className="btn3d shrink-0 bg-white !text-brand-600 shadow-[0_4px_0_0_#B84B00] text-sm uppercase hover:brightness-100"
          >
            {tt("stickyCta.startFree")}
          </button>
        </div>
      )}

      {/* Auth popup — login/signup, triggered from header, hero, and CTA buttons */}
      {authOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeAuth(); }}
        >
          <div className="max-h-[92vh] w-full max-w-md overflow-hidden rounded-3xl bg-white dark:bg-[#18181b] shadow-2xl md:max-w-4xl md:grid md:grid-cols-[44%_56%]">
            <SignupPromoPanel mode={mode} />
            <div className="min-w-0 overflow-y-auto">{authCard}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Field({ label, optional, icon: Icon, value, onChange, placeholder, type = "text", autoComplete, name, minLength }) {
  const [showPw, setShowPw] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPw ? "text" : "password") : type;
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-extrabold text-slate-700 dark:text-stone-200">
        {label} {optional && <span className="font-semibold text-slate-400 dark:text-stone-500">(optional)</span>}
      </label>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-stone-500" />}
        <input
          className={"w-full rounded-2xl bg-slate-50 dark:bg-white/[0.04] py-3 font-semibold text-slate-800 dark:text-white ring-2 ring-slate-200 dark:ring-white/[0.08] transition focus:bg-white dark:focus:bg-white/[0.06] focus:outline-none focus:ring-brand-400 placeholder:text-slate-400 dark:placeholder:text-stone-500 " + (Icon ? "ps-10" : "px-3.5") + (isPassword ? " pe-10" : " pe-3.5")}
          type={inputType}
          name={name}
          id={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={!optional}
          minLength={minLength}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute end-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-stone-500 hover:text-slate-600 dark:hover:text-stone-300 transition"
            tabIndex={-1}
            aria-label={showPw ? "Hide password" : "Show password"}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, align = "center" }) {
  return (
    <div className={align === "center" ? "text-center" : "text-start"}>
      <div className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-500">{eyebrow}</div>
      <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-4xl">{title}</h2>
    </div>
  );
}
