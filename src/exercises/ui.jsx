// src/exercises/ui.js
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
        "rounded-2xl bg-white/90 shadow-sm ring-1 ring-black/5 p-4 md:p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Title({ children }) {
  return (
    <div className="text-lg md:text-xl font-semibold text-slate-900">
      {children}
    </div>
  );
}

export function Muted({ children, className }) {
  return <div className={cx("text-sm text-slate-600", className)}>{children}</div>;
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  className,
  type = "button",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "w-full rounded-xl px-4 py-3 font-semibold transition",
        disabled
          ? "bg-slate-200 text-slate-500 cursor-not-allowed"
          : "bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700",
        className
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
  className,
  type = "button",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "w-full rounded-xl px-4 py-3 font-semibold transition ring-1 ring-slate-200",
        disabled
          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
          : "bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100",
        className
      )}
    >
      {children}
    </button>
  );
}

export function ChoiceGrid({ choices, selected, onSelect, columns = 2, multi = false }) {
  const colClass =
    columns === 1
      ? "grid-cols-1"
      : columns === 3
      ? "grid-cols-1 sm:grid-cols-3"
      : "grid-cols-1 sm:grid-cols-2";

  // selected:
  //  - single mode: number | null
  //  - multi mode: number[] (indices)
  const selectedSet = React.useMemo(() => {
    if (!multi) return null;
    const arr = Array.isArray(selected) ? selected : [];
    return new Set(arr.map((n) => Number(n)));
  }, [multi, selected]);

  function handleClick(idx) {
    if (!multi) return onSelect(idx);

    const cur = selectedSet ?? new Set();
    const next = new Set(cur);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    onSelect(Array.from(next));
  }

  return (
    <div className={cx("grid gap-3", colClass)}>
      {choices.map((c, idx) => {
        const isSelected = multi ? (selectedSet?.has(idx) ?? false) : selected === idx;
        return (
          <button
            key={idx}
            onClick={() => handleClick(idx)}
            className={cx(
              "rounded-xl px-4 py-3 text-left font-semibold transition ring-1",
              isSelected
                ? "bg-orange-50 ring-orange-300 text-orange-800"
                : "bg-white ring-slate-200 hover:bg-slate-50"
            )}
          >
            {c}
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
        "rounded-full px-4 py-2 text-sm font-semibold ring-1 transition",
        disabled
          ? "bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed"
          : active
          ? "bg-orange-50 text-orange-800 ring-orange-300"
          : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50"
      )}
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
      className="w-full rounded-xl px-4 py-3 ring-1 ring-slate-200 focus:outline-none focus:ring-orange-300"
    />
  );
}
