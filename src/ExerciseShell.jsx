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

      <main className="max-w-3xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
