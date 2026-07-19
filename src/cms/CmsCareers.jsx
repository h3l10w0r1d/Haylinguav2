// src/cms/CmsCareers.jsx — manage job vacancies shown on the public Careers page.
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { Plus, Save, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Briefcase } from "lucide-react";
import CmsLayout from "./CmsLayout";

const EMPLOYMENT_TYPES = ["full-time", "part-time", "contract", "internship"];

function cx(...a) {
  return a.filter(Boolean).join(" ");
}
const inputCls =
  "w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none";

export default function CmsCareers() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  useEffect(() => { setCmsApiClient(api); }, [api]);

  const [items, setItems] = useState([]);
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [draft, setDraft] = useState({ title: "", location: "Remote", employment_type: "full-time" });

  function showToast(msg, kind = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2400);
  }

  async function refresh() {
    const res = await api.listVacancies();
    const list = Array.isArray(res?.vacancies) ? res.vacancies : [];
    setItems(list);
    const e = {};
    list.forEach((it) => {
      e[it.id] = {
        title: it.title || "", location: it.location || "", employment_type: it.employment_type || "full-time",
        summary: it.summary || "", description: it.description || "",
      };
    });
    setEdits(e);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await refresh();
      } catch (err) {
        showToast(err.message || "Failed to load vacancies", "err");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return <Navigate to="/cms/login" replace />;

  async function createItem() {
    if (!draft.title.trim()) return;
    setBusy(true);
    try {
      await api.createVacancy({ title: draft.title.trim(), location: draft.location.trim(), employment_type: draft.employment_type });
      setDraft({ title: "", location: "Remote", employment_type: "full-time" });
      await refresh();
      showToast("Vacancy created — it's hidden until you publish it");
    } catch (err) {
      showToast(err.message || "Create failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function saveItem(it) {
    const e = edits[it.id] || {};
    setBusy(true);
    try {
      await api.updateVacancy(it.id, {
        title: (e.title || "").trim(), location: (e.location || "").trim(), employment_type: e.employment_type,
        summary: (e.summary || "").trim(), description: (e.description || "").trim(),
      });
      await refresh();
      showToast("Saved");
    } catch (err) {
      showToast(err.message || "Save failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function toggleItem(it) {
    setBusy(true);
    try {
      await api.updateVacancy(it.id, { is_active: !it.is_active });
      await refresh();
    } catch (err) {
      showToast(err.message || "Update failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(it) {
    if (!confirm(`Delete "${it.title}"?`)) return;
    setBusy(true);
    try {
      await api.deleteVacancy(it.id);
      await refresh();
      showToast("Deleted");
    } catch (err) {
      showToast(err.message || "Delete failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function moveItem(idx, dir) {
    const next = items.slice();
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    const [m] = next.splice(idx, 1);
    next.splice(j, 0, m);
    setItems(next);
    setBusy(true);
    try {
      await api.reorderVacancies(next.map((x) => x.id));
      await refresh();
    } catch (err) {
      showToast(err.message || "Reorder failed", "err");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function patch(id, p) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  }

  return (
    <CmsLayout active="careers" title="Careers">
      <div className="space-y-4">
        <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
          <div className="mb-3 font-display text-base font-bold text-slate-900">New vacancy</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_0.8fr_auto]">
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title — e.g. Frontend Engineer" className={inputCls} />
            <input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="Location" className={inputCls} />
            <select value={draft.employment_type} onChange={(e) => setDraft({ ...draft, employment_type: e.target.value })} className={inputCls}>
              {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button type="button" onClick={createItem} disabled={busy || !draft.title.trim()} className="btn3d btn3d-brand text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
          <div className="mt-2 text-xs font-semibold text-slate-500">New vacancies start hidden — publish them once details are filled in. The public Careers page shows an honest "not hiring" message when nothing's published.</div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200 shadow-sm">No vacancies yet.</div>
        ) : (
          <div className="space-y-3">
            {items.map((it, idx) => {
              const e = edits[it.id] || {};
              return (
                <div key={it.id} className={cx("rounded-3xl bg-white p-4 ring-1 shadow-sm", it.is_active ? "ring-slate-200" : "ring-slate-200 opacity-70")}>
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1 pt-1">
                      <button type="button" onClick={() => moveItem(idx, -1)} disabled={busy || idx === 0} className="grid h-7 w-7 place-items-center rounded-xl text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"><ChevronUp className="h-4 w-4" /></button>
                      <button type="button" onClick={() => moveItem(idx, 1)} disabled={busy || idx === items.length - 1} className="grid h-7 w-7 place-items-center rounded-xl text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"><ChevronDown className="h-4 w-4" /></button>
                    </div>
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-feather-50 text-feather-500"><Briefcase className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <input value={e.title || ""} onChange={(ev) => patch(it.id, { title: ev.target.value })} placeholder="Title" className={cx(inputCls, "!py-2 font-bold")} />
                        <input value={e.location || ""} onChange={(ev) => patch(it.id, { location: ev.target.value })} placeholder="Location" className={cx(inputCls, "!py-2")} />
                        <select value={e.employment_type || "full-time"} onChange={(ev) => patch(it.id, { employment_type: ev.target.value })} className={cx(inputCls, "!py-2")}>
                          {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <input value={e.summary || ""} onChange={(ev) => patch(it.id, { summary: ev.target.value })} placeholder="One-line summary shown on the card" className={cx(inputCls, "!py-2 text-xs")} />
                      <textarea value={e.description || ""} onChange={(ev) => patch(it.id, { description: ev.target.value })} placeholder="Full role description (shown when someone opens the role)" rows={3} className={cx(inputCls, "!py-2 text-xs")} data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" />
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <button type="button" onClick={() => toggleItem(it)} disabled={busy}
                          className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 transition",
                            it.is_active ? "bg-grass-50 text-grass-700 ring-grass-200 hover:bg-grass-100" : "bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200")}>
                          {it.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                          {it.is_active ? "Published" : "Hidden"}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button type="button" onClick={() => saveItem(it)} disabled={busy} className="btn3d btn3d-brand text-xs inline-flex items-center gap-1.5"><Save className="h-3.5 w-3.5" /> Save</button>
                      <button type="button" onClick={() => removeItem(it)} disabled={busy} className="btn3d btn3d-cardinal text-xs inline-flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
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
