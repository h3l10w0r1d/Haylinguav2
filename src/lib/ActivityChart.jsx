// src/lib/ActivityChart.jsx — small bar chart for "exercises in the last 7 days".
import React from "react";

export default function ActivityChart({ days, height = 160 }) {
  const norm = (Array.isArray(days) ? days : []).map((d, i) => {
    const v = Number(d?.value ?? 0);
    const label = String(d?.label ?? "").trim() || (d?.date ? String(d.date).slice(5) : String(i + 1));
    return { key: d?.date || String(i), v: Number.isFinite(v) && v > 0 ? v : 0, label };
  });
  const max = Math.max(1, ...norm.map((x) => x.v));

  return (
    <div className="mt-4">
      <div className="relative" style={{ height }}>
        {/* gridlines */}
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <div key={g} className="absolute inset-x-0 border-t border-dashed border-slate-100" style={{ bottom: `${g * 100}%` }} />
        ))}
        {/* baseline */}
        <div className="absolute inset-x-0 bottom-0 border-t border-slate-200" />

        {/* bars */}
        <div className="absolute inset-0 flex items-end gap-2 sm:gap-3">
          {norm.map((x) => {
            const frac = x.v > 0 ? Math.max(0.05, x.v / max) : 0;
            return (
              <div key={x.key} className="group flex h-full flex-1 flex-col items-center justify-end">
                <div className="h-4 text-[11px] font-extrabold leading-4 text-slate-500 tabular-nums">
                  {x.v > 0 ? x.v : ""}
                </div>
                {x.v > 0 ? (
                  <div
                    className="w-full max-w-[44px] rounded-t-lg bg-gradient-to-t from-brand-600 to-brand-400 transition-all group-hover:from-brand-500 group-hover:to-brand-300"
                    style={{ height: `calc((100% - 18px) * ${frac})` }}
                    title={`${x.label}: ${x.v}`}
                  />
                ) : (
                  <div className="h-1 w-full max-w-[44px] rounded-full bg-slate-200" title={`${x.label}: 0`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* day labels */}
      <div className="mt-2 flex gap-2 sm:gap-3">
        {norm.map((x) => (
          <div key={x.key} className="flex-1 text-center text-[11px] font-bold text-slate-500">
            {x.label}
          </div>
        ))}
      </div>
    </div>
  );
}
