// src/exercises/ui.jsx
import React from "react";

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
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function Card({ children, className }) {
  return (
    <div
      className={cx(
        "rounded-3xl bg-white p-5 md:p-7 ring-1 ring-slate-200/80 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Title({ children }) {
  return (
    <div className="font-display text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
      {children}
    </div>
  );
}

export function Muted({ children, className }) {
  return <div className={cx("text-sm font-semibold text-slate-500", className)}>{children}</div>;
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
  const colClass =
    columns === 1
      ? "grid-cols-1"
      : columns === 3
      ? "grid-cols-1 sm:grid-cols-3"
      : "grid-cols-1 sm:grid-cols-2";

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
    if (!multi) return onSelect(idx);
    const cur = selectedSet ?? new Set();
    const next = new Set(cur);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    onSelect(Array.from(next));
  }

  // Keyboard shortcut: press 1–4 to select the corresponding choice.
  React.useEffect(() => {
    if (graded) return;
    function onKey(e) {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= choices.length) {
        e.preventDefault();
        handleClick(n - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // no dep array — re-register each render to avoid stale closure

  return (
    <div className={cx("grid gap-3", colClass)}>
      {choices.map((c, idx) => {
        const isSelected = multi ? (selectedSet?.has(idx) ?? false) : selected === idx;
        const isCorrect = graded && correctSet?.has(idx);
        const isWrongPick = graded && !isCorrect && pickedSet?.has(idx);

        const tileState = isCorrect ? "tile-correct" : isWrongPick ? "tile-wrong" : isSelected ? "tile-selected" : "";
        const badgeState = isCorrect
          ? "bg-grass-500 text-white ring-grass-500"
          : isWrongPick
          ? "bg-cardinal-500 text-white ring-cardinal-500"
          : isSelected
          ? "bg-feather-500 text-white ring-feather-500"
          : "text-slate-400 ring-slate-200";
        const badge = isCorrect ? "✓" : isWrongPick ? "✕" : idx + 1;

        return (
          <button
            key={idx}
            onClick={() => handleClick(idx)}
            className={cx("tile text-lg", tileState, graded && "pointer-events-none")}
          >
            <span className="flex items-center gap-3">
              <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-extrabold ring-2", badgeState)}>
                {badge}
              </span>
              <span>{c}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Pill({ children, onClick, disabled, active = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "rounded-2xl px-4 py-2.5 text-base font-bold ring-2 transition active:translate-y-0.5",
        disabled
          ? "bg-slate-50 text-slate-300 ring-slate-100 cursor-not-allowed"
          : active
          ? "bg-feather-50 text-feather-700 ring-feather-300"
          : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
      )}
      style={!disabled ? { boxShadow: active ? "0 3px 0 0 #4EC2FF" : "0 3px 0 0 #E2E8F0" } : undefined}
    >
      {children}
    </button>
  );
}

export function InlineInput({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl bg-slate-50 px-4 py-4 text-lg font-bold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400 placeholder:font-semibold placeholder:text-slate-400"
    />
  );
}
