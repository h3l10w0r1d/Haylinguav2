// src/ExerciseAnalyticsModal.jsx
import { useEffect, useMemo } from "react";
import {
  X,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  RefreshCcw,
} from "lucide-react";

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function pct(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${Math.round(v)}%`;
}

export default function ExerciseAnalyticsModal({
  open,
  onClose,
  loading,
  error,
  data,
  onRetry,
}) {
  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const title = useMemo(() => {
    if (!data) return "Exercise analytics";
    const n = Number.isFinite(data.order) ? `#${data.order + 1}` : "";
    return [n, data.kind || "exercise"].filter(Boolean).join(" · ") || "Exercise analytics";
  }, [data]);

  if (!open) return null;

  const summary = data?.summary;

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="absolute inset-0 flex items-end sm:items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-200 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs text-slate-500">Exercise analytics</div>
              <div className="mt-1 text-lg font-extrabold text-slate-900 truncate">{title}</div>
              {data?.prompt ? (
                <div className="mt-1 text-sm text-slate-600 line-clamp-2">{data.prompt}</div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl p-2 hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-slate-700" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-slate-600">
                <BarChart3 className="w-5 h-5" />
                <span>Loading…</span>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <div className="font-semibold">Couldn’t load exercise analytics</div>
                <div className="mt-1 text-rose-700/90">{error}</div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-950"
                  >
                    <RefreshCcw className="w-4 h-4" />
                    Retry
                  </button>
                </div>
              </div>
            ) : null}

            {data && !loading && !error ? (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-2xl border border-slate-200 p-3">
                    <div className="text-xs text-slate-500">Attempts</div>
                    <div className="mt-1 text-lg font-extrabold text-slate-900">{summary?.attempts ?? 0}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-3">
                    <div className="text-xs text-slate-500">Accuracy</div>
                    <div className="mt-1 text-lg font-extrabold text-slate-900">{pct(summary?.accuracy)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-3">
                    <div className="text-xs text-slate-500">Correct</div>
                    <div className="mt-1 text-lg font-extrabold text-emerald-700">{summary?.correct ?? 0}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-3">
                    <div className="text-xs text-slate-500">Wrong</div>
                    <div className="mt-1 text-lg font-extrabold text-rose-700">{summary?.wrong ?? 0}</div>
                  </div>
                </div>

                {/* Attempts list */}
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Attempt history</div>
                  <div className="rounded-2xl border border-slate-200 overflow-hidden">
                    {data.attempts?.length ? (
                      <div className="divide-y divide-slate-200">
                        {data.attempts.map((a) => (
                          <div key={a.id} className="p-4 flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                {a.is_correct ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-rose-600" />
                                )}
                                <div className="text-sm font-semibold text-slate-900">
                                  Attempt #{a.attempt_no}
                                </div>
                                {Number.isFinite(a.xp_earned) ? (
                                  <div className="text-xs text-slate-500">+{a.xp_earned} XP</div>
                                ) : null}
                              </div>
                              <div className="mt-1 text-xs text-slate-600 flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{fmtDate(a.created_at)}</span>
                                {Number.isFinite(a.time_ms) ? (
                                  <span className="text-slate-400">·</span>
                                ) : null}
                                {Number.isFinite(a.time_ms) ? (
                                  <span>{Math.round(a.time_ms / 1000)}s</span>
                                ) : null}
                              </div>
                              {a.answer_text ? (
                                <div className="mt-2 text-xs text-slate-700">
                                  <span className="font-semibold">Answer:</span> {a.answer_text}
                                </div>
                              ) : null}
                              {Array.isArray(a.selected_indices) && a.selected_indices.length ? (
                                <div className="mt-1 text-xs text-slate-700">
                                  <span className="font-semibold">Selected:</span> {a.selected_indices.join(", ")}
                                </div>
                              ) : null}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const payload = JSON.stringify(a, null, 2);
                                navigator.clipboard?.writeText(payload);
                              }}
                              className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                              title="Copy attempt JSON"
                            >
                              <Copy className="w-4 h-4" />
                              Copy
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-sm text-slate-600">No attempts recorded for this exercise yet.</div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-semibold hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
