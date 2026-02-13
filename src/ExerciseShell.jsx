// src/ExerciseShell.jsx
import React, { useEffect } from "react";
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
  // Phase 2.5: unified result sheet
  result,
  onResultPrimary,
  children,
}) {
  const pct = total > 0 ? Math.round((step / total) * 100) : 0;

  // Keyboard: when result sheet is open, Enter triggers primary action.
  useEffect(() => {
    if (!result) return;
    const onKeyDown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onResultPrimary?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [result, onResultPrimary]);

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

      {/* Unified Result Sheet (Phase 2.5) */}
      {result ? (
        <div className="fixed inset-0 z-[60] flex items-end">
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/20" />

          <div className="relative w-full">
            <div className="max-w-3xl mx-auto px-4 pb-4">
              <div
                className={
                  "rounded-3xl border p-4 sm:p-5 shadow-2xl " +
                  (result.variant === "correct"
                    ? "border-emerald-200 bg-emerald-50"
                    : result.variant === "skipped"
                    ? "border-slate-200 bg-white"
                    : "border-rose-200 bg-rose-50")
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="text-2xl" aria-hidden>
                        {result.variant === "correct"
                          ? "✅"
                          : result.variant === "skipped"
                          ? "⏭️"
                          : "❌"}
                      </div>
                      <div className="text-lg font-extrabold text-slate-900">
                        {result.variant === "correct"
                          ? "Correct!"
                          : result.variant === "skipped"
                          ? "Skipped"
                          : "Not quite"}
                      </div>
                    </div>

                    <div className="text-sm text-slate-600">
                      {result.variant === "correct"
                        ? `+${Number(result.xpEarned || 0)} XP`
                        : result.variant === "skipped"
                        ? "No XP gained"
                        : "Try again — you’ve got this."}
                    </div>

                    {result.subtext ? (
                      <div className="text-xs text-slate-500">{result.subtext}</div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={onResultPrimary}
                    className={
                      "cta-float relative overflow-hidden rounded-2xl px-5 py-3 text-sm font-extrabold text-white shadow-md transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99] " +
                      (result.variant === "wrong"
                        ? "bg-gradient-to-r from-slate-900 to-slate-800"
                        : "bg-gradient-to-r from-orange-500 to-pink-500")
                    }
                  >
                    {result.primaryLabel || (result.variant === "wrong" ? "Try again" : "Continue")}
                  </button>
                </div>

                {result.detail ? (
                  <div className="mt-3 text-sm text-slate-700">{result.detail}</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
