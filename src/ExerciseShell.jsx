// src/ExerciseShell.jsx
import React from "react";
import { ArrowLeft } from "lucide-react";

/**
 * ExerciseShell
 * A consistent, Duolingo-like frame for ALL exercises:
 *  - Sticky top bar with Back + progress
 *  - Friendly, centered content area
 */
export default function ExerciseShell({
  title,
  step,
  total,
  onBack,
  primaryLabel,
  primaryDisabled,
  onPrimary,
  secondaryLabel,
  secondaryDisabled,
  onSecondary,
  children,
}) {
  const pct = total > 0 ? Math.round((step / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-slate-50 to-slate-50">
      <header className="sticky top-0 z-20 bg-white/70 backdrop-blur border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex-1" />

          <div className="text-xs font-semibold text-slate-600">
            {step}/{total} · {pct}%
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 pb-3">
          <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          {title ? (
            <div className="mt-3 text-sm font-semibold text-slate-700 line-clamp-1">
              {title}
            </div>
          ) : null}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-28">
        {children}
      </main>

      {/* Unified bottom action bar (Phase 2) */}
      {(primaryLabel || secondaryLabel) ? (
        <div className="fixed bottom-0 left-0 right-0 z-30">
          <div className="bg-white/80 backdrop-blur border-t border-slate-200">
            <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
              {secondaryLabel ? (
                <button
                  type="button"
                  disabled={secondaryDisabled}
                  onClick={onSecondary}
                  className={
                    "h-11 px-4 rounded-xl font-semibold ring-1 transition " +
                    (secondaryDisabled
                      ? "bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed"
                      : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50")
                  }
                >
                  {secondaryLabel}
                </button>
              ) : null}

              {primaryLabel ? (
                <button
                  type="button"
                  disabled={primaryDisabled}
                  onClick={onPrimary}
                  className={
                    "cta-float ml-auto h-11 px-5 rounded-xl font-semibold text-white shadow-md transition-transform duration-200 " +
                    "bg-gradient-to-r from-orange-500 to-pink-500 " +
                    (primaryDisabled
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:scale-[1.02] active:scale-[0.99]")
                  }
                >
                  {primaryLabel}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
