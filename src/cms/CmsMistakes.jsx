// src/cms/CmsMistakes.jsx
// "Repetitive mistakes" — exercises the system auto-hid because too many
// learners missed them on their first try. Each shows the stats snapshot taken
// at disable time and a Restore button that brings it back into its lesson
// (and marks it immune so it won't be flagged again).
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { AlertTriangle, RotateCcw, CheckCircle2, Loader2 } from "lucide-react";
import CmsLayout from "./CmsLayout";

export default function CmsMistakes() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  useEffect(() => { setCmsApiClient(api); }, [api]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restoring, setRestoring] = useState({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listRepetitiveMistakes();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (token) load(); /* eslint-disable-next-line */ }, [token]);

  async function restore(id) {
    setRestoring((r) => ({ ...r, [id]: true }));
    try {
      await api.restoreExercise(id);
      setItems((list) => list.filter((x) => x.id !== id));
    } catch (e) {
      setError(e?.message || "Restore failed");
    } finally {
      setRestoring((r) => { const n = { ...r }; delete n[id]; return n; });
    }
  }

  if (!token) return <Navigate to="/cms/login" replace />;

  return (
    <CmsLayout active="mistakes" title="Repetitive mistakes" breadcrumb={[{ label: "Repetitive mistakes" }]}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            These exercises were <strong>automatically hidden</strong> because at least half of
            learners (min. 10) got them wrong on their <strong>first try</strong> — usually a sign
            of a bad answer key or ambiguous wording. They no longer appear in lessons. Review each
            one and <strong>Restore</strong> it if it's actually fine (it won't be flagged again).
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center py-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700 ring-1 ring-red-200">{error}</div>
        ) : items.length === 0 ? (
          <div className="grid place-items-center rounded-2xl bg-white py-16 text-center ring-1 ring-slate-200">
            <CheckCircle2 className="h-10 w-10 text-grass-500" />
            <div className="mt-3 font-display text-lg font-extrabold text-slate-800">Nothing flagged</div>
            <div className="mt-1 text-sm text-slate-500">No exercises have crossed the repetitive-mistake threshold.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((it) => {
              const s = it.stats || {};
              const pct = Number.isFinite(s.wrong_rate) ? Math.round(s.wrong_rate * 100) : null;
              return (
                <div key={it.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{it.kind}</span>
                        {it.chapter_title ? (
                          <span className="text-xs font-semibold text-slate-400">
                            {it.chapter_title} · {it.lesson_title}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">{it.lesson_title || "—"}</span>
                        )}
                      </div>
                      <div className="mt-1.5 truncate font-display text-base font-extrabold text-slate-800">
                        {it.prompt || <span className="text-slate-400">(no prompt)</span>}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        {pct !== null ? (
                          <>
                            <span className="text-red-600">{pct}% wrong</span> on first try
                            {Number.isFinite(s.learners) ? <> · {s.wrong}/{s.learners} learners</> : null}
                          </>
                        ) : (
                          "Auto-hidden"
                        )}
                        {it.disabled_at ? <> · {new Date(it.disabled_at).toLocaleDateString()}</> : null}
                      </div>
                    </div>
                    <button
                      onClick={() => restore(it.id)}
                      disabled={!!restoring[it.id]}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-sm font-extrabold text-white shadow-[0_3px_0_0_#c2410c] transition active:translate-y-0.5 disabled:opacity-60"
                    >
                      {restoring[it.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      Restore
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CmsLayout>
  );
}
