// src/cms/CmsSegments.jsx — reusable audience definitions, referenced from
// automation campaign triggers/conditions via the "in_segment" operator
// (see FilterRuleBuilder.jsx + backend/automations.py). Structurally mirrors
// CmsPremium.jsx: a "new segment" form + a list of existing ones, each
// inline-editable, with a live match-count preview.
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { Plus, Save, Trash2, UsersRound } from "lucide-react";
import CmsLayout from "./CmsLayout";
import FilterRuleBuilder from "./FilterRuleBuilder";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}
const inputCls =
  "w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none";

const NEW_SEGMENT_DEFAULT = { name: "", description: "", filters: [] };

export default function CmsSegments() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  useEffect(() => { setCmsApiClient(api); }, [api]);

  const [segments, setSegments] = useState([]);
  const [edits, setEdits] = useState({});
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [draft, setDraft] = useState(NEW_SEGMENT_DEFAULT);

  function showToast(msg, kind = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2400);
  }

  async function refresh() {
    const d = await api.listSegments();
    const list = Array.isArray(d?.segments) ? d.segments : [];
    setSegments(list);
    const e = {};
    list.forEach((s) => {
      e[s.id] = { name: s.name || "", description: s.description || "", filters: Array.isArray(s.filters) ? s.filters : [] };
    });
    setEdits(e);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await refresh();
      } catch (err) {
        showToast(err.message || "Failed to load segments", "err");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return <Navigate to="/cms/login" replace />;

  function patch(id, p) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  }

  async function createSegment() {
    if (!draft.name.trim()) return;
    setBusy(true);
    try {
      await api.createSegment({ name: draft.name.trim(), description: draft.description.trim() || null, filters: draft.filters });
      setDraft(NEW_SEGMENT_DEFAULT);
      await refresh();
      showToast("Segment created");
    } catch (err) {
      showToast(err.message || "Create failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function saveSegment(s) {
    const e = edits[s.id] || {};
    setBusy(true);
    try {
      await api.updateSegment(s.id, { name: (e.name || "").trim(), description: (e.description || "").trim() || null, filters: e.filters || [] });
      await refresh();
      showToast("Saved");
    } catch (err) {
      showToast(err.message || "Save failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function removeSegment(s) {
    if (!confirm(`Delete segment "${s.name}"? Campaigns referencing it will stop matching on it.`)) return;
    setBusy(true);
    try {
      await api.deleteSegment(s.id);
      await refresh();
      showToast("Deleted");
    } catch (err) {
      showToast(err.message || "Delete failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function previewCount(id) {
    try {
      const d = await api.previewSegmentCount(id);
      setCounts((prev) => ({ ...prev, [id]: d }));
    } catch (err) {
      showToast(err.message || "Preview failed", "err");
    }
  }

  return (
    <CmsLayout active="segments" title="Segments">
      <div className="space-y-6">
        <div className="rounded-2xl bg-brand-50 p-4 text-sm font-semibold text-brand-800 ring-1 ring-brand-200">
          Reusable audiences — reference these from an automation's trigger filters or condition
          steps via "in segment" instead of retyping the same filter rules on every campaign.
        </div>

        {/* New segment */}
        <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
          <div className="mb-3 font-display text-base font-bold text-slate-900">New segment</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name — e.g. Premium users" className={inputCls} />
            <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Description (optional)" className={inputCls} />
          </div>
          <div className="mt-3">
            <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-500">Filters</div>
            <FilterRuleBuilder filters={draft.filters} onChange={(filters) => setDraft({ ...draft, filters })} segments={segments} />
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={createSegment} disabled={busy || !draft.name.trim()} className="btn3d btn3d-brand text-sm inline-flex items-center gap-2 disabled:opacity-60">
              <Plus className="h-4 w-4" /> Add segment
            </button>
          </div>
        </section>

        {/* Existing segments */}
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading…</div>
        ) : segments.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200 shadow-sm">No segments yet.</div>
        ) : (
          <div className="space-y-3">
            {segments.map((s) => {
              const e = edits[s.id] || {};
              const count = counts[s.id];
              return (
                <div key={s.id} className="rounded-3xl bg-white p-4 ring-1 ring-slate-200 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-feather-50 text-feather-600"><UsersRound className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input value={e.name || ""} onChange={(ev) => patch(s.id, { name: ev.target.value })} placeholder="Name" className={cx(inputCls, "!py-2 font-bold")} />
                        <input value={e.description || ""} onChange={(ev) => patch(s.id, { description: ev.target.value })} placeholder="Description" className={cx(inputCls, "!py-2 text-xs")} />
                      </div>
                      <FilterRuleBuilder filters={e.filters || []} onChange={(filters) => patch(s.id, { filters })} segments={segments} />
                      <div className="flex items-center gap-2 pt-0.5">
                        <button type="button" onClick={() => previewCount(s.id)} className="text-xs font-bold text-brand-600 hover:underline">Preview match count</button>
                        {count && <span className="text-xs font-semibold text-slate-400">{count.count} of {count.total_users} users match</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button type="button" onClick={() => saveSegment(s)} disabled={busy} className="btn3d btn3d-brand text-xs inline-flex items-center gap-1.5"><Save className="h-3.5 w-3.5" /> Save</button>
                      <button type="button" onClick={() => removeSegment(s)} disabled={busy} className="btn3d btn3d-cardinal text-xs inline-flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
          <div className={cx("rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg ring-1", toast.kind === "err" ? "bg-cardinal-50 text-cardinal-700 ring-cardinal-200" : "bg-grass-50 text-grass-700 ring-grass-200")}>
            {toast.msg}
          </div>
        </div>
      )}
    </CmsLayout>
  );
}
