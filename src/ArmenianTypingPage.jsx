// src/ArmenianTypingPage.jsx — free, no-signup Armenian typing trainer with
// live multiplayer races. Public page; a logged-in Haylingua user is picked
// up automatically from the usual hay_token and races under their real name,
// but nothing here requires an account.
//
// UI MODEL (deliberately monkeytype-shaped): there is no visible input box
// and almost no chrome. The passage IS the interface — a hidden input holds
// focus, you just start typing, and clicking anywhere refocuses. Everything
// that isn't the text (mode pills, stats, hints) is muted and small so the
// only bright thing on screen is what you're typing.
//
// PALETTE: monkeytype leans on exactly one accent against a flat neutral
// ground. Here that accent is Haylingua apricot (brand-500). Untyped text is
// dim stone, correctly typed text goes bright, mistakes are cardinal-500 —
// so the accent is reserved for the caret and live UI state rather than
// being spent on the characters themselves. Dark ground matches the app's
// own dark mode (#0d0d0f + stone-*), not a generic neon theme.
//
// THREE MODES:
//   learn    — ten-finger touch-typing lessons on the real Armenian PHONETIC
//              layout, with finger-coloured keys and per-lesson accuracy
//              gates. Layout + curriculum live in lib/armenianKeyboard.js;
//              read the confidence note at the top of that file before
//              changing any key.
//   practice — free typing against drills/passages from the backend.
//   race     — live multiplayer against other people and bots.
//
// The optional keyboard shown in practice/race is still the ALPHABETICAL
// picker grid (KEY_ROWS below) rather than the physical layout — it's a
// "which letter comes next" aid there, not a touch-typing tool. Only learn
// mode teaches finger positions, and only it uses the real layout.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { RotateCcw, Keyboard as KeyboardIcon, Users, Trophy } from "lucide-react";
import usePageMeta from "./lib/usePageMeta";
import { useLocale, localizedPath, SUPPORTED_LOCALES } from "./i18n";
import { LAYOUT, ROW_ORDER, FINGERS, CHAR_INFO, LESSONS, fingerForChar } from "./lib/armenianKeyboard";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

function getToken() {
  try {
    return localStorage.getItem("hay_token") || localStorage.getItem("access_token") || "";
  } catch {
    return "";
  }
}

// Same grid as the in-app character picker (see file header caveat).
const KEY_ROWS = [
  ["ա", "բ", "գ", "դ", "ե", "զ", "է", "ը", "թ", "ժ", "ի", "լ", "խ"],
  ["ծ", "կ", "հ", "ձ", "ղ", "ճ", "մ", "յ", "ն", "շ", "ո", "չ", "պ"],
  ["ջ", "ռ", "ս", "վ", "տ", "ր", "ց", "ւ", "փ", "ք", "օ", "ֆ", "և"],
];

const FALLBACK_TEXTS = [
  "Բարև ձեզ, ինչպես եք այսօր",
  "Ես սովորում եմ հայերեն ամեն օր",
  "Այսօր եղանակը շատ լավ է",
];

// ── Typing engine (shared by practice + race) ─────────────────────────────
function useTypingRun(target) {
  const [typed, setTyped] = useState("");
  const [startedAt, setStartedAt] = useState(null);
  const [keystrokes, setKeystrokes] = useState(0);
  const [errors, setErrors] = useState(0);

  const reset = useCallback(() => {
    setTyped(""); setStartedAt(null); setKeystrokes(0); setErrors(0);
  }, []);

  const onChange = useCallback((next) => {
    if (!target) return;
    const clipped = next.slice(0, target.length);
    setTyped((prev) => {
      if (clipped.length > prev.length) {
        setKeystrokes((k) => k + (clipped.length - prev.length));
        const i = clipped.length - 1;
        if (clipped[i] !== target[i]) setErrors((e) => e + 1);
      }
      return clipped;
    });
    setStartedAt((s) => s ?? Date.now());
  }, [target]);

  const done = !!target && typed.length === target.length;
  const elapsed = startedAt ? Math.max(0.001, (Date.now() - startedAt) / 1000) : 0;
  const correctChars = useMemo(() => {
    let n = 0;
    for (let i = 0; i < typed.length; i++) if (typed[i] === target?.[i]) n++;
    return n;
  }, [typed, target]);

  // Standard WPM convention: 5 characters = 1 word.
  //
  // Held at 0 for the first half-second and hard-capped at 300: elapsed time
  // is near zero on the very first keystroke, so an unguarded figure spikes
  // into the tens of thousands before settling. The cap also means a paste
  // (blocked on the input, but belt-and-braces) can't post a nonsense score
  // to the race leaderboard — the server clamps to the same ceiling.
  const wpm = startedAt && elapsed > 0.5
    ? Math.min(300, (correctChars / 5) / (elapsed / 60))
    : 0;
  const accuracy = keystrokes ? Math.max(0, ((keystrokes - errors) / keystrokes) * 100) : 100;
  const progress = target ? typed.length / target.length : 0;

  return { typed, onChange, reset, done, wpm, accuracy, progress, correctChars, startedAt };
}

// ── The typing surface ────────────────────────────────────────────────────
// A hidden input carries focus and the real value; the rendered passage is
// purely a view of it. That's what removes the input box from the UI while
// keeping normal text-input behaviour (IME, mobile keyboards, backspace).
function TypingSurface({ target, run, disabled, showKeyboard }) {
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(true);

  useEffect(() => { if (!disabled) inputRef.current?.focus(); }, [target, disabled]);

  // Any keypress anywhere pulls focus back to the passage.
  useEffect(() => {
    const onKey = () => { if (!disabled) inputRef.current?.focus(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled]);

  const nextChar = target[run.typed.length];

  return (
    <div onClick={() => !disabled && inputRef.current?.focus()}>
      {/* The blur-and-prompt state must cover ONLY the passage — wrapping the
          keyboard too would centre the prompt on top of the keys. */}
      <div className="relative">
      <input
        ref={inputRef}
        value={run.typed}
        onChange={(e) => run.onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPaste={(e) => e.preventDefault()}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="Type the passage"
        // Visually hidden, still focusable and still a real text input.
        className="absolute inset-0 h-full w-full cursor-default opacity-0"
      />

      <p
        className={
          "select-none break-words text-center font-mono text-3xl leading-[1.9] tracking-wide transition sm:text-4xl " +
          (focused || disabled ? "" : "blur-[3px]")
        }
      >
        {target.split("").map((ch, i) => {
          const state = i >= run.typed.length ? "pending" : run.typed[i] === ch ? "ok" : "bad";
          return (
            <span
              key={i}
              className={
                (i === run.typed.length ? "border-l-2 border-brand-500 " : "") +
                (state === "ok"
                  ? "text-stone-100 "
                  : state === "bad"
                  ? "text-cardinal-500 underline decoration-cardinal-500/70 decoration-2 underline-offset-4 "
                  : "text-stone-600 ")
              }
            >
              {ch}
            </span>
          );
        })}
      </p>

      {!focused && !disabled && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-mono text-sm text-stone-400">Click here or press any key to focus</span>
        </div>
      )}
      </div>

      {showKeyboard && (
        <div className="mt-10">
          {KEY_ROWS.map((row, i) => (
            <div key={i} className="mb-1.5 flex justify-center gap-1.5 last:mb-0">
              {row.map((ch) => (
                <span
                  key={ch}
                  className={
                    "grid h-8 w-8 shrink-0 place-items-center rounded-md font-mono text-sm transition " +
                    // Case-folded: the grid is lowercase but passages start
                    // with a capital, so a strict match would leave the very
                    // first keystroke of every drill unhighlighted.
                    (nextChar && ch === nextChar.toLowerCase()
                      ? "bg-brand-500 text-[#0d0d0f]"
                      : "bg-white/[0.04] text-stone-600")
                  }
                >
                  {ch}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Deterministic "web3"-style identicon — the jazzicon/blockie idea: hash the
// name, then lay coloured geometric shapes over a coloured disc at rotations
// derived from that hash. Same name always yields the same avatar, and no
// two names collide visually in practice.
//
// Generated inline as SVG rather than pulled from an avatar service: no
// request, no dependency, no third-party data sharing, and it renders
// instantly. Signed-in racers pass a real avatar_url and get their actual
// picture instead.
function hashOf(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// A wide, saturated spread so adjacent racers never read as the same colour.
const IDENTICON_HUES = [8, 32, 52, 96, 150, 178, 200, 232, 268, 292, 320, 344];

function Identicon({ name, size = 26, dim }) {
  const { bg, shapes } = useMemo(() => {
    const h = hashOf(name || "?");
    const base = IDENTICON_HUES[h % IDENTICON_HUES.length];
    const out = [];
    for (let i = 0; i < 3; i++) {
      const n = (h >>> (i * 5 + 3)) & 0xff;
      out.push({
        hue: IDENTICON_HUES[(h + (i + 1) * 5) % IDENTICON_HUES.length],
        // Spread across the tile, rotated — the jazzicon look.
        x: (n % 10) / 10, y: ((n >> 3) % 10) / 10,
        rot: (n * 7) % 360,
        w: 0.55 + ((n >> 2) % 5) / 10,
      });
    }
    return { bg: base, shapes: out };
  }, [name]);

  return (
    <span
      aria-hidden
      className={"inline-block shrink-0 overflow-hidden rounded-full " + (dim ? "opacity-60" : "")}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <rect width="100" height="100" fill={`hsl(${bg} 62% 42%)`} />
        {shapes.map((s, i) => (
          <rect
            key={i}
            x={s.x * 100 - 20} y={s.y * 100 - 20}
            width={s.w * 100} height={s.w * 100}
            fill={`hsl(${s.hue} 68% 55%)`}
            transform={`rotate(${s.rot} 50 50)`}
            opacity="0.85"
          />
        ))}
      </svg>
    </span>
  );
}

function Avatar({ name, src, dim, size }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setBroken(true)}
        style={{ width: size || 26, height: size || 26 }}
        className={"shrink-0 rounded-full object-cover " + (dim ? "opacity-60" : "")}
      />
    );
  }
  return <Identicon name={name || "?"} size={size} dim={dim} />;
}

// Small, dim, monospace — never competes with the passage for attention.
function LiveStats({ run, extra }) {
  return (
    <div className="flex items-center justify-center gap-8 font-mono text-sm text-stone-500">
      <span><span className="text-brand-500">{run.wpm.toFixed(0)}</span> wpm</span>
      <span><span className="text-brand-500">{run.accuracy.toFixed(0)}%</span> acc</span>
      {extra}
    </div>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full px-3.5 py-1.5 font-mono text-xs transition " +
        (active ? "bg-brand-500/15 text-brand-500" : "text-stone-500 hover:text-stone-300")
      }
    >
      {children}
    </button>
  );
}

// Key -> finger, rebuilt from CHAR_INFO so the layout module stays the one
// source of truth for both.
const FINGER_BY_KEY_PUBLIC = Object.fromEntries(
  Object.values(CHAR_INFO).map((i) => [i.key, i.finger])
);

// ── Learn mode: ten-finger touch typing ───────────────────────────────────
// Full keyboard, keys tinted by which finger owns them, next key lit. This
// is the only mode that shows the whole board on purpose: the point is
// learning where keys live, so hiding them would defeat it.
// Hands seen from above, the way every typing course shows them. The finger
// that should press the next key lights up in that finger's colour, so the
// learner never has to decode a text label mid-drill.
const HAND_FINGERS = {
  left: [
    { id: "lPinky", x: 6, y: 30, h: 40 },
    { id: "lRing", x: 22, y: 17, h: 53 },
    { id: "lMiddle", x: 38, y: 11, h: 59 },
    { id: "lIndex", x: 54, y: 19, h: 51 },
  ],
  right: [
    { id: "rIndex", x: 22, y: 19, h: 51 },
    { id: "rMiddle", x: 38, y: 11, h: 59 },
    { id: "rRing", x: 54, y: 17, h: 53 },
    { id: "rPinky", x: 70, y: 30, h: 40 },
  ],
};

function Hand({ side, activeFinger }) {
  const fingers = HAND_FINGERS[side];
  const thumbActive = false;
  return (
    <svg viewBox="0 0 92 118" className="h-28 w-auto" aria-hidden>
      {fingers.map((f) => {
        const on = f.id === activeFinger;
        const hue = FINGERS[f.id].hue;
        return (
          <rect
            key={f.id}
            x={f.x} y={f.y} width={13} height={f.h} rx={6.5}
            fill={on ? `hsl(${hue} 65% 52%)` : "rgba(255,255,255,0.05)"}
            stroke={on ? `hsl(${hue} 70% 65%)` : "rgba(255,255,255,0.09)"}
            strokeWidth="1"
            className="transition-all duration-150"
          />
        );
      })}
      {/* palm */}
      <rect x={6} y={66} width={77} height={40} rx={14}
        fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.09)" strokeWidth="1" />
      {/* thumb, angled outward on the side away from the other hand */}
      <rect
        x={side === "left" ? 70 : 6} y={70} width={13} height={30} rx={6.5}
        transform={`rotate(${side === "left" ? 28 : -28} ${side === "left" ? 76 : 12} 76)`}
        fill={thumbActive ? "hsl(0 0% 60%)" : "rgba(255,255,255,0.05)"}
        stroke="rgba(255,255,255,0.09)" strokeWidth="1"
      />
    </svg>
  );
}

function HandsPreview({ activeFinger }) {
  const f = FINGERS[activeFinger];
  return (
    <div>
      <div className="flex items-end justify-center gap-8">
        <Hand side="left" activeFinger={activeFinger} />
        <Hand side="right" activeFinger={activeFinger} />
      </div>
      <div className="mt-3 h-4 text-center font-mono text-xs">
        {f ? <span style={{ color: `hsl(${f.hue} 60% 66%)` }}>{f.label.toLowerCase()}</span> : null}
      </div>
    </div>
  );
}

function FingerKeyboard({ nextChar, activeKeys }) {
  const nextKey = nextChar ? CHAR_INFO[nextChar]?.key : null;
  const nextFinger = nextChar ? fingerForChar(nextChar) : null;
  const isSpace = nextChar === " ";
  // Stagger each row, the way a real keyboard is offset.
  const indent = { number: 0, top: 18, home: 28, bottom: 46 };

  return (
    <div className="mt-10">
      <div className="mx-auto w-fit rounded-2xl bg-black/40 p-3 ring-1 ring-white/[0.06]">
        {ROW_ORDER.map((row) => (
          <div key={row} className="mb-2 flex justify-center gap-2 last:mb-0" style={{ paddingLeft: indent[row] }}>
            {LAYOUT[row].map(([key, ch]) => {
              const finger = FINGER_BY_KEY_PUBLIC[key];
              const hue = FINGERS[finger]?.hue;
              const isNext = ch && key === nextKey;
              const inLesson = !ch ? false : !activeKeys || activeKeys.includes(ch);
              // The two home-row anchor keys carry the physical bump.
              const isAnchor = key === "f" || key === "j";
              return (
                <span
                  key={key}
                  className={
                    "relative grid h-10 w-10 shrink-0 place-items-center rounded-lg border font-mono text-base transition-all duration-100 " +
                    (isNext ? "-translate-y-0.5 scale-110 shadow-lg " : "") +
                    (inLesson || isNext ? "" : "opacity-30 ")
                  }
                  style={{
                    background: isNext
                      ? `linear-gradient(180deg, hsl(${hue} 72% 58%), hsl(${hue} 72% 46%))`
                      : `linear-gradient(180deg, hsl(${hue} 40% 18%), hsl(${hue} 42% 13%))`,
                    borderColor: isNext ? `hsl(${hue} 80% 70%)` : "rgba(255,255,255,0.07)",
                    color: isNext ? "#0d0d0f" : `hsl(${hue} 55% 68%)`,
                    boxShadow: isNext ? `0 0 22px hsl(${hue} 70% 45% / 0.55)` : "inset 0 -2px 0 rgba(0,0,0,0.35)",
                  }}
                  title={ch ? `${ch} — ${key.toUpperCase()} — ${FINGERS[finger]?.label || ""}` : "unread key"}
                >
                  {/* the physical key you actually press, as a corner hint */}
                  <span className="absolute left-1 top-0.5 text-[8px] leading-none opacity-45">{key.toUpperCase()}</span>
                  {ch || "·"}
                  {isAnchor && <span className="absolute bottom-1 h-0.5 w-2.5 rounded-full bg-current opacity-60" />}
                </span>
              );
            })}
          </div>
        ))}
        {/* spacebar — thumbs */}
        <div className="mt-2 flex justify-center">
          <span
            className={
              "h-8 w-56 rounded-lg border transition-all duration-100 " +
              (isSpace ? "-translate-y-0.5 border-white/40 bg-white/25" : "border-white/[0.07] bg-white/[0.04]")
            }
          />
        </div>
      </div>
    </div>
  );
}

function LearnMode() {
  const [idx, setIdx] = useState(0);
  const [drill, setDrill] = useState(0);
  const [passed, setPassed] = useState(() => {
    try { return JSON.parse(localStorage.getItem("hay_typing_passed") || "[]"); } catch { return []; }
  });

  const lesson = LESSONS[idx];
  const target = lesson.drills[drill % lesson.drills.length];
  const run = useTypingRun(target);

  useEffect(() => { run.reset(); }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  // A lesson counts as passed once a drill is completed at or above its
  // accuracy gate — speed deliberately isn't part of the gate, because
  // chasing speed before accuracy is exactly how bad habits set in.
  useEffect(() => {
    if (!run.done || run.accuracy < lesson.accuracyGate || passed.includes(lesson.id)) return;
    const next = [...passed, lesson.id];
    setPassed(next);
    try { localStorage.setItem("hay_typing_passed", JSON.stringify(next)); } catch { /* private mode */ }
  }, [run.done, run.accuracy, lesson, passed]);

  const gateMet = run.done && run.accuracy >= lesson.accuracyGate;

  const advance = useCallback(() => {
    if (gateMet && idx < LESSONS.length - 1) { setIdx(idx + 1); setDrill(0); }
    else setDrill((d) => d + 1);
  }, [gateMet, idx]);

  // Enter moves you on once the drill is complete. Ignored mid-drill so a
  // stray Enter can't skip a line you're halfway through.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Enter" || !run.done) return;
      e.preventDefault();
      advance();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run.done, advance]);

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-center gap-1">
        {LESSONS.map((l, i) => (
          <button
            key={l.id}
            onClick={() => { setIdx(i); setDrill(0); }}
            title={l.name}
            className={
              "h-7 w-7 rounded-full font-mono text-[11px] transition " +
              (i === idx
                ? "bg-brand-500/15 text-brand-500"
                : passed.includes(l.id)
                ? "text-brand-500/60 hover:text-brand-500"
                : "text-stone-600 hover:text-stone-400")
            }
          >
            {passed.includes(l.id) && i !== idx ? "✓" : l.id}
          </button>
        ))}
      </div>

      <div className="mx-auto mb-10 max-w-xl text-center">
        <div className="font-display text-lg font-extrabold text-stone-200">{lesson.name}</div>
        <p className="mt-2 font-mono text-xs leading-relaxed text-stone-500">{lesson.teach}</p>
        {lesson.unverified && (
          <p className="mt-3 font-mono text-xs text-cardinal-500">
            ⚠ these key positions are unverified — see the note below
          </p>
        )}
      </div>

      <div className="mb-8 h-5">
        {run.startedAt && (
          <LiveStats
            run={run}
            extra={<span className="text-stone-600">target {lesson.accuracyGate}% acc</span>}
          />
        )}
      </div>

      <TypingSurface target={target} run={run} showKeyboard={false} />

      <div className="mt-12">
        <HandsPreview activeFinger={fingerForChar(target[run.typed.length])} />
      </div>

      <FingerKeyboard nextChar={target[run.typed.length]} activeKeys={lesson.keys} />

      {run.done && (
        <div className="mt-10 text-center font-mono text-sm">
          {gateMet ? (
            <span className="text-brand-500">
              passed — {run.accuracy.toFixed(0)}% accuracy at {run.wpm.toFixed(0)} wpm
            </span>
          ) : (
            <span className="text-cardinal-500">
              {run.accuracy.toFixed(0)}% — needs {lesson.accuracyGate}% to pass. Slow down and try again.
            </span>
          )}
          <div className="mt-2 font-mono text-xs text-stone-600">
            press <kbd className="rounded bg-white/[0.08] px-1.5 py-0.5 text-stone-400">enter</kbd>{" "}
            {gateMet && idx < LESSONS.length - 1 ? "for the next lesson" : "for the next exercise"}
          </div>
        </div>
      )}

      <div className="mt-10 flex items-center justify-center gap-6">
        <button onClick={() => setDrill((d) => d + 1)} className="rounded-lg p-3 text-stone-600 transition hover:text-brand-500" aria-label="Next exercise">
          <RotateCcw className="h-5 w-5" />
        </button>
        {gateMet && idx < LESSONS.length - 1 && (
          <button
            onClick={advance}
            className="rounded-lg bg-brand-500 px-4 py-2 font-mono text-sm text-[#0d0d0f] transition hover:bg-brand-400"
          >
            next lesson →
          </button>
        )}
      </div>
    </>
  );
}

// ── Practice mode ─────────────────────────────────────────────────────────
function PracticeMode({ levels, showKeyboard }) {
  const [levelIdx, setLevelIdx] = useState(0);
  const [drillIdx, setDrillIdx] = useState(0);

  const level = levels[levelIdx];
  const target = level.drills[drillIdx % level.drills.length];
  const run = useTypingRun(target);
  const submitted = useRef(false);

  useEffect(() => { run.reset(); submitted.current = false; }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!run.done || submitted.current) return;
    submitted.current = true;
    fetch(`${API_BASE}/typing/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: JSON.stringify({ wpm: run.wpm, accuracy: run.accuracy, name: "Practice" }),
    }).catch(() => {});
  }, [run.done, run.wpm, run.accuracy]);

  const next = () => setDrillIdx((i) => i + 1);

  return (
    <>
      <div className="mb-16 flex flex-wrap items-center justify-center gap-1">
        {levels.map((l, i) => (
          <Pill key={l.id} active={i === levelIdx} onClick={() => { setLevelIdx(i); setDrillIdx(0); }}>
            {l.name.toLowerCase()}
          </Pill>
        ))}
      </div>

      <div className="mb-10 h-5">
        {run.startedAt ? <LiveStats run={run} /> : (
          level.letters && level.letters !== "all" ? (
            <div className="text-center font-mono text-sm text-stone-500">
              new letters <span className="text-brand-500">{level.letters}</span>
            </div>
          ) : null
        )}
      </div>

      <TypingSurface target={target} run={run} showKeyboard={showKeyboard} />

      {run.done && (
        <div className="mt-14 text-center">
          <div className="font-mono text-5xl text-brand-500">{run.wpm.toFixed(0)}<span className="ml-2 text-xl text-stone-500">wpm</span></div>
          <div className="mt-1 font-mono text-sm text-stone-500">{run.accuracy.toFixed(0)}% accuracy</div>
        </div>
      )}

      <div className="mt-14 flex justify-center">
        <button
          onClick={next}
          aria-label="Next drill"
          className="rounded-lg p-3 text-stone-600 transition hover:text-brand-500"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
      </div>
    </>
  );
}

// ── Race mode ─────────────────────────────────────────────────────────────
function RaceMode({ showKeyboard }) {
  const [name, setName] = useState(() => {
    try { return localStorage.getItem("hay_typing_name") || ""; } catch { return ""; }
  });
  const [phase, setPhase] = useState("idle"); // idle | connecting | lobby | countdown | racing | results
  const [players, setPlayers] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [target, setTarget] = useState("");
  const [youId, setYouId] = useState(null);
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState("");
  const [myResult, setMyResult] = useState(null); // {place, wpm, accuracy}
  const wsRef = useRef(null);

  const run = useTypingRun(target);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (phase !== "racing" || !wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({
      type: "progress", progress: run.progress, wpm: run.wpm, accuracy: run.accuracy,
    }));
  }, [run.progress, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== "racing" || !run.done || finishedRef.current) return;
    finishedRef.current = true;
    wsRef.current?.send(JSON.stringify({ type: "finish", wpm: run.wpm, accuracy: run.accuracy }));
  }, [run.done, phase, run.wpm, run.accuracy]);

  function connect() {
    const nick = name.trim() || "Anonymous";
    try { localStorage.setItem("hay_typing_name", nick); } catch { /* private mode */ }
    setError("");
    setPhase("connecting");
    finishedRef.current = false;
    setMyResult(null);
    run.reset();

    const wsUrl = API_BASE.replace(/^http/, "ws") + "/ws/typing-race";
    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      setError("could not connect");
      setPhase("idle");
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ type: "join", name: nick, token: getToken() || undefined }));
    ws.onerror = () => { setError("connection failed — check you're online"); setPhase("idle"); };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === "joined") { setYouId(msg.youId); setAuthed(!!msg.authed); setPlayers(msg.players || []); setPhase("lobby"); }
      else if (msg.type === "lobby") setPlayers(msg.players || []);
      else if (msg.type === "countdown") { setPhase("countdown"); setCountdown(msg.seconds); setTarget(msg.text || ""); setPlayers(msg.players || []); }
      else if (msg.type === "start") { setPhase("racing"); setTarget(msg.text || ""); setPlayers(msg.players || []); }
      else if (msg.type === "progress") setPlayers(msg.players || []);
      else if (msg.type === "you_finished") { setMyResult({ place: msg.place, wpm: msg.wpm, accuracy: msg.accuracy }); setPlayers(msg.players || []); }
      else if (msg.type === "results") { setPhase("results"); setPlayers(msg.players || []); }
    };
  }

  useEffect(() => () => wsRef.current?.close(), []);

  if (phase === "idle" || phase === "connecting") {
    return (
      <div className="mx-auto max-w-sm text-center">
        <Users className="mx-auto mb-5 h-6 w-6 text-stone-600" />
        <p className="mb-6 font-mono text-sm leading-relaxed text-stone-500">
          no account needed — pick a name and you'll be matched with whoever's online
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 24))}
          onKeyDown={(e) => e.key === "Enter" && connect()}
          placeholder="your name"
          aria-label="Your racing name"
          className="w-full rounded-lg bg-white/[0.04] px-4 py-3 text-center font-mono text-stone-200 outline-none transition placeholder:text-stone-600 focus:bg-white/[0.07]"
        />
        {error && <div className="mt-3 font-mono text-xs text-cardinal-500">{error}</div>}
        <button
          onClick={connect}
          disabled={phase === "connecting"}
          className="mt-4 w-full rounded-lg bg-brand-500 px-5 py-3 font-mono text-sm text-[#0d0d0f] transition hover:bg-brand-400 disabled:opacity-50"
        >
          {phase === "connecting" ? "connecting…" : "find a race"}
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Opponent progress — thin bars, no cards. Keeps updating after you
          finish so you can watch the rest of the field come in. */}
      <div className="mb-14 space-y-2.5">
        {players.map((p) => (
          <div key={p.id}>
            <div className="mb-1 flex items-center gap-2 font-mono text-xs">
              <Avatar name={p.name} src={p.avatar} dim={p.bot} />
              <span className={p.id === youId ? "text-brand-500" : "text-stone-500"}>
                {p.name}{p.id === youId ? " (you)" : ""}
              </span>
              {/* Bots are labelled, never passed off as human opponents. */}
              {p.bot && <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-stone-600">bot</span>}
              {p.finished && (
                <span className="inline-flex items-center gap-1 text-stone-500">
                  <Trophy className="h-3 w-3" />{p.place ? `#${p.place}` : ""}
                </span>
              )}
              <span className="ml-auto tabular-nums text-stone-600">{p.wpm.toFixed(0)} wpm</span>
            </div>
            <div className="h-0.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={"h-full transition-[width] duration-200 " + (p.id === youId ? "bg-brand-500" : "bg-stone-600")}
                style={{ width: `${Math.round((p.progress || 0) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {phase === "lobby" && (
        <p className="animate-pulse text-center font-mono text-sm text-stone-500">waiting for racers…</p>
      )}

      {phase === "countdown" && (
        <div className="text-center font-mono text-7xl text-brand-500">{countdown}</div>
      )}

      {(phase === "racing" || phase === "results") && target && (
        <>
          <div className="mb-10 h-5">{run.startedAt && <LiveStats run={run} />}</div>
          <TypingSurface
            target={target}
            run={run}
            disabled={phase === "results" || run.done}
            showKeyboard={showKeyboard && phase === "racing"}
          />
        </>
      )}

      {/* Your result lands the moment you finish — no waiting for the whole
          field — and the standings above keep ticking behind it. */}
      {myResult && phase !== "results" && (
        <div className="mt-14 text-center">
          <div className="font-mono text-sm text-stone-500">
            you finished <span className="text-brand-500">#{myResult.place}</span> · {myResult.wpm.toFixed(0)} wpm · {myResult.accuracy.toFixed(0)}% acc
          </div>
          <div className="mt-2 font-mono text-xs text-stone-600">still racing — watching the others finish</div>
        </div>
      )}

      {phase === "results" && (
        <div className="mt-14 text-center">
          {myResult && (
            <div className="mb-3 font-mono text-sm text-stone-500">
              finished <span className="text-brand-500">#{myResult.place}</span> of {players.length}
            </div>
          )}
          <div className="font-mono text-5xl text-brand-500">{run.wpm.toFixed(0)}<span className="ml-2 text-xl text-stone-500">wpm</span></div>
          <button
            onClick={() => { wsRef.current?.close(); setPhase("idle"); setTarget(""); setPlayers([]); }}
            className="mt-8 rounded-lg p-3 text-stone-600 transition hover:text-brand-500"
            aria-label="Race again"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>
      )}

      {phase !== "idle" && (
        <div className="mt-10 text-center font-mono text-xs text-stone-600">
          {authed ? "racing as your Haylingua account" : "racing as a guest"}
        </div>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function ArmenianTypingPage() {
  const { t } = useTranslation("seoPages");
  const locale = useLocale();
  const lp = (path) => localizedPath(path, locale);
  const [mode, setMode] = useState("learn");
  const [levels, setLevels] = useState(null);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [board, setBoard] = useState([]);

  const faq = t("armenianTyping.faq", { returnObjects: true });

  usePageMeta(t("armenianTyping.meta.title"), t("armenianTyping.meta.description"), {
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("armenianTyping.breadcrumb.home"), item: "https://www.haylingua.am/" },
          { "@type": "ListItem", position: 2, name: t("armenianTyping.breadcrumb.current"), item: "https://www.haylingua.am/armenian-typing" },
        ],
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: (Array.isArray(faq) ? faq : []).map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
    alternates: SUPPORTED_LOCALES.map((loc) => ({ locale: loc, path: "/armenian-typing" })).concat([
      { locale: "", path: "/armenian-typing" },
    ]),
  });

  useEffect(() => {
    fetch(`${API_BASE}/typing/texts`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.levels?.length && setLevels(d.levels))
      .catch(() => {});
    fetch(`${API_BASE}/typing/leaderboard?range=today`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setBoard(d.entries || []))
      .catch(() => {});
  }, []);

  const effectiveLevels = levels || [{ id: 0, name: "warm up", letters: "all", drills: FALLBACK_TEXTS }];

  return (
    <div className="flex min-h-screen flex-col bg-[#0d0d0f] text-stone-300">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-8">
        {/* Header — wordmark left, one link right. Nothing else. */}
        <div className="mb-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-extrabold text-stone-400 transition hover:text-stone-200">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-500 text-[#0d0d0f]">Հ</span>
            haylingua
          </Link>
          <div className="flex items-center gap-1">
            <Pill active={mode === "learn"} onClick={() => setMode("learn")}>learn</Pill>
            <Pill active={mode === "practice"} onClick={() => setMode("practice")}>practice</Pill>
            <Pill active={mode === "race"} onClick={() => setMode("race")}>race</Pill>
          </div>
        </div>

        <main className="flex-1">
          {mode === "learn" ? <LearnMode />
            : mode === "practice" ? <PracticeMode levels={effectiveLevels} showKeyboard={showKeyboard} />
            : <RaceMode showKeyboard={showKeyboard} />}
        </main>

        {/* Footer hints — monkeytype-style: dim, mono, out of the way. */}
        <footer className="mt-20 space-y-4">
          <div className={"flex justify-center " + (mode === "learn" ? "hidden" : "")}>
            <button
              onClick={() => setShowKeyboard((v) => !v)}
              className={
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-xs transition " +
                (showKeyboard ? "text-brand-500" : "text-stone-600 hover:text-stone-400")
              }
            >
              <KeyboardIcon className="h-3.5 w-3.5" />
              {showKeyboard ? "hide keyboard" : "show keyboard"}
            </button>
          </div>

          {board.length > 0 && (
            <div className="mx-auto max-w-sm">
              <div className="mb-2 text-center font-mono text-[11px] uppercase tracking-widest text-stone-600">fastest today</div>
              {board.slice(0, 5).map((e, i) => (
                <div key={i} className="flex justify-between py-1 font-mono text-xs text-stone-500">
                  <span>{i + 1}. {e.display_name}</span>
                  <span className="tabular-nums">{Number(e.wpm).toFixed(0)} wpm</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 font-mono text-xs text-stone-600">
            <Link to={lp("/armenian-alphabet")} className="transition hover:text-stone-400">alphabet</Link>
            <Link to={lp("/armenian-vocabulary")} className="transition hover:text-stone-400">vocabulary</Link>
            <Link to={lp("/")} className="transition hover:text-stone-400">haylingua</Link>
          </div>
        </footer>

        {/* Crawlable content. The tool above is almost entirely JS-rendered
            widgets with no prose, so on its own this page gave search engines
            nothing to rank for "armenian typing test" / "armenian keyboard
            online" — the exact queries it should own. Kept below the tool so
            it never delays what someone came here to use. */}
        <article className="mx-auto mt-24 max-w-2xl border-t border-white/[0.06] pt-16 text-stone-400">
          <h2 className="font-display text-2xl font-extrabold text-stone-100">{t("armenianTyping.intro.heading")}</h2>
          <p className="mt-4 leading-relaxed">{t("armenianTyping.intro.body")}</p>

          <h2 className="mt-14 font-display text-2xl font-extrabold text-stone-100">{t("armenianTyping.modes.heading")}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {(t("armenianTyping.modes.items", { returnObjects: true }) || []).map((m) => (
              <div key={m.title} className="rounded-xl bg-white/[0.03] p-4">
                <div className="font-display text-sm font-extrabold text-brand-500">{m.title}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-500">{m.text}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-14 font-display text-2xl font-extrabold text-stone-100">{t("armenianTyping.setup.heading")}</h2>
          <p className="mt-4 leading-relaxed">{t("armenianTyping.setup.body")}</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {[["macTitle", "macSteps"], ["winTitle", "winSteps"]].map(([titleKey, stepsKey]) => (
              <div key={titleKey} className="rounded-xl bg-white/[0.03] p-5">
                <div className="font-display text-sm font-extrabold text-stone-200">{t(`armenianTyping.setup.${titleKey}`)}</div>
                <ol className="mt-3 space-y-1.5 text-sm text-stone-500">
                  {(t(`armenianTyping.setup.${stepsKey}`, { returnObjects: true }) || []).map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-mono text-stone-600">{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>

          <h2 className="mt-14 font-display text-2xl font-extrabold text-stone-100">{t("armenianTyping.why.heading")}</h2>
          <p className="mt-4 leading-relaxed">{t("armenianTyping.why.body")}</p>

          <h2 className="mt-14 font-display text-2xl font-extrabold text-stone-100">{t("armenianTyping.faqHeading")}</h2>
          <div className="mt-5 space-y-4">
            {(Array.isArray(faq) ? faq : []).map((f) => (
              <div key={f.q} className="rounded-xl bg-white/[0.03] p-5">
                <div className="font-display text-sm font-extrabold text-stone-200">{f.q}</div>
                <p className="mt-2 text-sm leading-relaxed text-stone-500">{f.a}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-14 font-display text-2xl font-extrabold text-stone-100">{t("armenianTyping.keepGoing.heading")}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              ["/armenian-alphabet", 0],
              ["/armenian-vocabulary", 1],
              ["/learn-armenian-online", 2],
            ].map(([path, i]) => {
              const card = (t("armenianTyping.keepGoing.cards", { returnObjects: true }) || [])[i];
              if (!card) return null;
              return (
                <Link key={path} to={lp(path)} className="rounded-xl bg-white/[0.03] p-4 transition hover:bg-white/[0.06]">
                  <div className="font-display text-sm font-extrabold text-stone-200">{card.title}</div>
                  <p className="mt-1 text-sm text-stone-500">{card.text}</p>
                </Link>
              );
            })}
          </div>
        </article>
      </div>
    </div>
  );
}
