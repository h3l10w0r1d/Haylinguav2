// src/cms/analytics/widgetShells.jsx
// Shared card shells. All heights defined once here.

export const CARD_H    = "h-[220px]";
export const CARD_H_LG = "h-[300px]";

function fmt(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString();
}

function pct(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${(Number(n) * 100).toFixed(1)}%`;
}

// ── Small KPI card ────────────────────────────────────────────────────────────
// Shows just a big number + label + optional sub-line. Used for sm size.
export function SmallKPI({ label, value, sub, accent = "#E85F00" }) {
  return (
    <div className={`flex flex-col justify-between ${CARD_H} w-full rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm p-4 overflow-hidden`}>
      <div
        className="w-8 h-1.5 rounded-full mb-2"
        style={{ background: accent }}
      />
      <div>
        <div
          className="font-display text-3xl font-extrabold tabular-nums leading-none"
          style={{ color: accent }}
        >
          {fmt(value)}
        </div>
        <div className="mt-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-500">
          {label}
        </div>
        {sub && (
          <div className="mt-0.5 text-xs font-semibold text-slate-400 truncate">{sub}</div>
        )}
      </div>
    </div>
  );
}

// ── Medium KPI (number + mini sparkline) ─────────────────────────────────────
// Used for sm/md widgets that also have a time series.
export function MediumKPI({ label, value, sub, accent = "#E85F00", sparkData }) {
  const max = Math.max(1, ...(sparkData || []).map((d) => d.value || 0));
  return (
    <div className={`flex flex-col ${CARD_H} w-full rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm p-4 overflow-hidden`}>
      <div className="mb-2">
        <div
          className="font-display text-3xl font-extrabold tabular-nums leading-none"
          style={{ color: accent }}
        >
          {value != null ? fmt(value) : "—"}
        </div>
        <div className="mt-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</div>
        {sub && <div className="mt-0.5 text-xs font-semibold text-slate-400">{sub}</div>}
      </div>
      {sparkData && sparkData.length > 0 && (
        <div className="mt-auto flex-1 flex items-end gap-px min-h-0 pt-2">
          {sparkData.slice(-20).map((d, i) => {
            const frac = d.value > 0 ? Math.max(0.04, d.value / max) : 0;
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{
                    height: `${frac * 100}%`,
                    background: accent,
                    opacity: 0.7 + 0.3 * (i / sparkData.length),
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Large card wrapper ────────────────────────────────────────────────────────
export function LgCard({ label, sub, accent = "#E85F00", children }) {
  return (
    <div className={`flex flex-col ${CARD_H_LG} w-full rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm p-5 overflow-hidden`}>
      <div className="flex items-start justify-between mb-3 shrink-0">
        <div>
          <div className="font-display text-sm font-extrabold text-slate-800">{label}</div>
          {sub && <div className="text-xs font-semibold text-slate-400 mt-0.5">{sub}</div>}
        </div>
        <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: accent }} />
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

// ── Standard card (md size, chart + label) ────────────────────────────────────
export function MdCard({ label, sub, accent = "#E85F00", children }) {
  return (
    <div className={`flex flex-col ${CARD_H} w-full rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm p-4 overflow-hidden`}>
      <div className="flex items-start justify-between mb-2 shrink-0">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</div>
          {sub && <div className="text-xs font-semibold text-slate-400 mt-0.5">{sub}</div>}
        </div>
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: accent }} />
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
