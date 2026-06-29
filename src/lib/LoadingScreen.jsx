// src/lib/LoadingScreen.jsx — branded full-screen loader (Suspense fallback).
import React from "react";

export default function LoadingScreen({ label = "Loading…" }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-brand-50/50 to-white">
      <div className="relative grid place-items-center">
        {/* pulsing ring */}
        <span className="hl-load-ring absolute h-16 w-16 rounded-3xl bg-brand-400/40" />
        {/* logo mark */}
        <div className="hl-load-pop relative grid h-16 w-16 place-items-center rounded-3xl bg-brand-500 text-white shadow-lg ring-1 ring-brand-600/20">
          <span className="font-display text-3xl font-extrabold leading-none">Հ</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="hl-load-dot" />
        <span className="hl-load-dot" style={{ animationDelay: ".15s" }} />
        <span className="hl-load-dot" style={{ animationDelay: ".3s" }} />
      </div>

      <div className="font-display text-sm font-bold text-slate-400">{label}</div>
    </div>
  );
}
