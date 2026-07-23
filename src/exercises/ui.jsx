// src/exercises/ui.jsx
import React from "react";
import { sfx } from "../lib/sfx";

export function normalizeConfig(config) {
  if (!config) return {};
  if (typeof config === "string") {
    try {
      return JSON.parse(config);
    } catch {
      return {};
    }
  }
  if (typeof config === "object") return config;
  return {};
}

export function normalizeText(s) {
  return String(s ?? "")
    .normalize("NFD")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

// No box, no border — exercise content floats directly on the page (the
// shell's own bg-white already matches). Padding is kept purely for
// consistent internal spacing across all exercise kinds, not as a "card".
export function Card({ children, className }) {
  return (
    <div className={cx("py-1", className)}>
      {children}
    </div>
  );
}

export function Title({ children }) {
  return (
    <div className="font-display text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight dark:text-white">
      {children}
    </div>
  );
}

export function Muted({ children, className }) {
  return <div className={cx("text-sm font-semibold text-slate-500 dark:text-stone-400", className)}>{children}</div>;
}

/** Affirmative action (Check / Continue) — Haylingua apricot, pressable 3D. */
export function PrimaryButton({ children, onClick, disabled, className, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx("btn3d btn3d-brand w-full uppercase", className)}
    >
      {children}
    </button>
  );
}

/** Neutral / secondary action (Skip, Reset). */
export function SecondaryButton({ children, onClick, disabled, className, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx("btn3d btn3d-neutral w-full uppercase", className)}
    >
      {children}
    </button>
  );
}

/**
 * ChoiceGrid
 *  - `graded`: when set, locks the grid and reveals answers (Duolingo-style).
 *    Shape: { correct: number|number[], picked: number|number[] } — correct
 *    tiles turn green (✓), an incorrectly-picked tile turns red (✕).
 */
export function ChoiceGrid({ choices, selected, onSelect, columns = 2, multi = false, graded = null }) {
  // Short-option grids (audio "what do you hear", letters) stay a real
  // multi-column grid on mobile too — matching Duolingo's 2×2 card layout —
  // rather than collapsing to a single stacked column.
  const colClass =
    columns === 1
      ? "grid-cols-1"
      : columns === 3
      ? "grid-cols-3"
      : "grid-cols-2";

  const selectedSet = React.useMemo(() => {
    if (!multi) return null;
    const arr = Array.isArray(selected) ? selected : [];
    return new Set(arr.map((n) => Number(n)));
  }, [multi, selected]);

  const toSet = (v) => new Set((Array.isArray(v) ? v : [v]).filter((x) => x != null && x !== -1).map(Number));
  const correctSet = React.useMemo(() => (graded ? toSet(graded.correct) : null), [graded]);
  const pickedSet = React.useMemo(() => (graded ? toSet(graded.picked) : null), [graded]);

  function handleClick(idx) {
    if (graded) return; // locked once checked
    sfx.tileTap();
    if (!multi) return onSelect(idx);
    const cur = selectedSet ?? new Set();
    const next = new Set(cur);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    onSelect(Array.from(next));
  }

  // Keyboard shortcut: press 1–4 to select the corresponding choice.
  // Use a ref so the listener always sees fresh state without re-registering.
  const handleClickRef = React.useRef(handleClick);
  handleClickRef.current = handleClick;
  const choicesLenRef = React.useRef(choices.length);
  choicesLenRef.current = choices.length;
  const gradedRef = React.useRef(graded);
  gradedRef.current = graded;
  React.useEffect(() => {
    function onKey(e) {
      if (gradedRef.current) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= choicesLenRef.current) {
        e.preventDefault();
        handleClickRef.current(n - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // register once; refs keep values fresh

  return (
    <div className={cx("grid gap-3", colClass)}>
      {choices.map((c, idx) => {
        const isSelected = multi ? (selectedSet?.has(idx) ?? false) : selected === idx;
        const isCorrect = graded && correctSet?.has(idx);
        const isWrongPick = graded && !isCorrect && pickedSet?.has(idx);

        const tileState = isCorrect ? "tile-correct" : isWrongPick ? "tile-wrong" : isSelected ? "tile-selected" : "";
        // Corner badge: the ✓/✕ reveal always shows once graded (clear
        // feedback on mobile too); the plain number is a keyboard-shortcut
        // affordance, so it's desktop-only — Duolingo's mobile tiles are
        // clean centered text with no numbers.
        const showGradeBadge = isCorrect || isWrongPick;
        const badgeState = isCorrect
          ? "bg-grass-500 text-white ring-grass-500"
          : isWrongPick
          ? "bg-cardinal-500 text-white ring-cardinal-500"
          : "text-slate-400 ring-slate-200 dark:text-stone-500 dark:ring-white/[0.08]";

        return (
          <button
            key={idx}
            onClick={() => handleClick(idx)}
            className={cx("tile tile-choice text-lg", tileState, graded && "pointer-events-none")}
          >
            {showGradeBadge ? (
              <span className={cx("absolute left-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-xs font-extrabold ring-2", badgeState)}>
                {isCorrect ? "✓" : "✕"}
              </span>
            ) : (
              <span className={cx("absolute left-3 top-1/2 hidden h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-xs font-extrabold ring-2 sm:grid", badgeState)}>
                {idx + 1}
              </span>
            )}
            <span className="block text-center">{c}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Pill({ children, onClick, disabled, active = false, className }) {
  return (
    <button
      onClick={(e) => { sfx.tileTap(); onClick?.(e); }}
      disabled={disabled}
      className={cx(
        "rounded-2xl px-4 py-3 text-base font-bold ring-2 transition active:translate-y-0.5",
        disabled
          ? "bg-slate-50 text-slate-300 ring-slate-100 cursor-not-allowed dark:bg-white/[0.04] dark:text-stone-600 dark:ring-white/[0.06]"
          : active
          ? "bg-feather-50 text-feather-700 ring-feather-300 dark:bg-feather-500/15 dark:text-feather-400 dark:ring-feather-500/30"
          : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 dark:bg-[#18181b] dark:text-stone-200 dark:ring-white/[0.08] dark:hover:bg-white/[0.04]",
        className
      )}
      style={!disabled ? { boxShadow: active ? "0 3px 0 0 #4EC2FF" : "0 3px 0 0 #E2E8F0" } : undefined}
    >
      {children}
    </button>
  );
}

export function InlineInput({ value, onChange, placeholder, autoFocus = true }) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      autoFocus={autoFocus}
      autoCapitalize="none"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      className="w-full rounded-2xl bg-slate-50 px-4 py-4 text-lg font-bold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400 placeholder:font-semibold placeholder:text-slate-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500"
    />
  );
}
