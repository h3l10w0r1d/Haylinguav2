// src/cms/CmsMistakes.jsx
// "Repetitive mistakes" — exercises the system auto-hid because too many
// learners missed them on their first try. Each shows the stats snapshot taken
// at disable time and a Restore button that brings it back into its lesson
// (and marks it immune so it won't be flagged again).
//
// Pilot page for the shared CMS kit: URL-synced search + client-side paging
// (useListQuery + useClientList + Pagination), ListState/EmptyState for the
// non-happy states, and `notify` toasts.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import CmsLayout from "./CmsLayout";
import {
  Badge, Button, EmptyState, ListState, ListToolbar, Note, Pagination, SearchInput,
  notify, useClientList, useListQuery,
} from "./ui";

const SEARCH_KEYS = ["prompt", "kind", "lesson_title", "chapter_title"];

export default function CmsMistakes() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  useEffect(() => { setCmsApiClient(api); }, [api]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restoring, setRestoring] = useState({});

  const list = useListQuery();
  const { pageRows, total, page } = useClientList(items, {
    q: list.q, searchKeys: SEARCH_KEYS, page: list.page, pageSize: list.pageSize,
  });

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
      setItems((rows) => rows.filter((x) => x.id !== id));
      notify("Exercise restored to its lesson");
    } catch (e) {
      notify(e?.message || "Restore failed", "err");
    } finally {
      setRestoring((r) => { const n = { ...r }; delete n[id]; return n; });
    }
  }


  return (
    <CmsLayout active="mistakes" title="Repetitive mistakes" breadcrumb={[{ label: "Repetitive mistakes" }]}>
      <div className="mx-auto max-w-4xl">
        <Note tone="warning" icon={AlertTriangle} className="mb-5">
          These exercises were <strong>automatically hidden</strong> because at least half of
          learners (min. 10) got them wrong on their <strong>first try</strong> — usually a sign
          of a bad answer key or ambiguous wording. They no longer appear in lessons. Review each
          one and <strong>Restore</strong> it if it's actually fine (it won't be flagged again).
        </Note>

        {!loading && !error && items.length > 0 && (
          <ListToolbar
            search={<SearchInput value={list.q} onChange={(q) => list.set({ q })} placeholder="Search by prompt, kind, or lesson…" />}
            count={total}
            countLabel="flagged exercise"
          />
        )}

        <ListState
          loading={loading}
          error={error}
          onRetry={load}
          empty={items.length === 0 || total === 0}
          emptyState={
            items.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                tone="success"
                title="Nothing flagged"
                description="No exercises have crossed the repetitive-mistake threshold."
              />
            ) : (
              <EmptyState
                title="No matches"
                description="No flagged exercise matches that search."
                action={<Button variant="outline" size="sm" onClick={() => list.set({ q: "" })}>Clear search</Button>}
              />
            )
          }
        >
          <div className="space-y-3">
            {pageRows.map((it) => {
              const s = it.stats || {};
              const pct = Number.isFinite(s.wrong_rate) ? Math.round(s.wrong_rate * 100) : null;
              return (
                <div key={it.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{it.kind}</Badge>
                        <span className="text-xs font-semibold text-slate-400">
                          {it.chapter_title ? `${it.chapter_title} · ${it.lesson_title}` : it.lesson_title || "—"}
                        </span>
                      </div>
                      <div className="mt-1.5 truncate font-display text-base font-extrabold text-slate-800">
                        {it.prompt || <span className="text-slate-400">(no prompt)</span>}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        {pct !== null ? (
                          <>
                            <span className="text-cardinal-600">{pct}% wrong</span> on first try
                            {Number.isFinite(s.learners) ? <> · {s.wrong}/{s.learners} learners</> : null}
                          </>
                        ) : (
                          "Auto-hidden"
                        )}
                        {it.disabled_at ? <> · {new Date(it.disabled_at).toLocaleDateString()}</> : null}
                      </div>
                    </div>
                    <Button
                      variant="brand3d"
                      className="shrink-0 !px-3 !py-2 text-sm"
                      onClick={() => restore(it.id)}
                      disabled={!!restoring[it.id]}
                    >
                      {restoring[it.id] ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                      Restore
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <Pagination
            className="mt-4"
            page={page}
            pageSize={list.pageSize}
            total={total}
            onPageChange={(p) => list.set({ page: p })}
            onPageSizeChange={(n) => list.set({ pageSize: n })}
          />
        </ListState>
      </div>
    </CmsLayout>
  );
}
