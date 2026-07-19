// src/cms/CmsCareers.jsx — manage job vacancies shown on the public Careers page.
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import {
  Plus, Save, Trash2, ChevronUp, ChevronDown, ChevronRight, Eye, EyeOff, Briefcase,
  ListPlus, FileText, Download, Linkedin, Mail,
} from "lucide-react";
import CmsLayout from "./CmsLayout";

const EMPLOYMENT_TYPES = ["full-time", "part-time", "contract", "internship"];
const FIELD_TYPES = ["text", "textarea", "url", "file"];
const APPLICATION_STATUSES = ["new", "reviewed", "shortlisted", "rejected", "hired"];
const STATUS_TONE = {
  new: "bg-brand-50 text-brand-700 ring-brand-200",
  reviewed: "bg-slate-100 text-slate-600 ring-slate-200",
  shortlisted: "bg-gold-50 text-gold-700 ring-gold-200",
  rejected: "bg-cardinal-50 text-cardinal-700 ring-cardinal-200",
  hired: "bg-grass-50 text-grass-700 ring-grass-200",
};

function cx(...a) {
  return a.filter(Boolean).join(" ");
}
const inputCls =
  "w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none";

// Fields + applications for one vacancy — fetched lazily when its card expands.
function VacancyPanel({ vacancy, api, showToast }) {
  const [fields, setFields] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fieldDraft, setFieldDraft] = useState({ label: "", field_type: "text", is_required: false });
  const [openAppId, setOpenAppId] = useState(null);
  const [appDetail, setAppDetail] = useState(null);

  async function refresh() {
    const [f, a] = await Promise.all([api.listVacancyFields(vacancy.id), api.listApplications(vacancy.id)]);
    setFields(Array.isArray(f?.fields) ? f.fields : []);
    setApplications(Array.isArray(a?.applications) ? a.applications : []);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await refresh();
      } catch (err) {
        showToast(err.message || "Failed to load", "err");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vacancy.id]);

  async function addField() {
    if (!fieldDraft.label.trim()) return;
    setBusy(true);
    try {
      await api.createVacancyField(vacancy.id, fieldDraft);
      setFieldDraft({ label: "", field_type: "text", is_required: false });
      await refresh();
    } catch (err) {
      showToast(err.message || "Add field failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function removeField(f) {
    if (!confirm(`Delete the "${f.label}" question? Existing answers to it will also be removed.`)) return;
    setBusy(true);
    try {
      await api.deleteVacancyField(f.id);
      await refresh();
    } catch (err) {
      showToast(err.message || "Delete failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function toggleApp(appId) {
    if (openAppId === appId) { setOpenAppId(null); setAppDetail(null); return; }
    setOpenAppId(appId);
    try {
      const d = await api.getApplication(appId);
      setAppDetail(d);
    } catch (err) {
      showToast(err.message || "Failed to load application", "err");
    }
  }

  async function setStatus(appId, status) {
    setBusy(true);
    try {
      await api.updateApplicationStatus(appId, status);
      await refresh();
      if (openAppId === appId) {
        const d = await api.getApplication(appId);
        setAppDetail(d);
      }
    } catch (err) {
      showToast(err.message || "Update failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function download(appId, kind, filename) {
    try {
      await api.downloadApplicationFile(appId, kind, filename);
    } catch (err) {
      showToast(err.message || "Download failed", "err");
    }
  }

  if (loading) return <div className="border-t border-slate-100 p-4 text-sm text-slate-500">Loading…</div>;

  return (
    <div className="space-y-5 border-t border-slate-100 p-4">
      {/* Application form fields */}
      <div>
        <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-400">Application questions</div>
        <p className="mb-2 text-xs font-semibold text-slate-400">Name, email, LinkedIn, and CV are always collected. Add extra questions candidates should answer.</p>
        <div className="space-y-1.5">
          {fields.map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700">{f.label}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold uppercase text-slate-400 ring-1 ring-slate-200">{f.field_type}</span>
              {f.is_required && <span className="rounded-full bg-cardinal-50 px-2 py-0.5 text-[10px] font-extrabold uppercase text-cardinal-600">Required</span>}
              <button type="button" onClick={() => removeField(f)} disabled={busy} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-cardinal-500 hover:bg-cardinal-50"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr_1fr_auto_auto]">
          <input value={fieldDraft.label} onChange={(e) => setFieldDraft({ ...fieldDraft, label: e.target.value })} placeholder="Question — e.g. Portfolio link" className={cx(inputCls, "!py-2 text-sm")} />
          <select value={fieldDraft.field_type} onChange={(e) => setFieldDraft({ ...fieldDraft, field_type: e.target.value })} className={cx(inputCls, "!py-2 text-sm")}>
            {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label className="flex items-center gap-1.5 whitespace-nowrap rounded-2xl bg-slate-50 px-3 text-xs font-bold text-slate-600 ring-2 ring-slate-200">
            <input type="checkbox" checked={fieldDraft.is_required} onChange={(e) => setFieldDraft({ ...fieldDraft, is_required: e.target.checked })} /> Required
          </label>
          <button type="button" onClick={addField} disabled={busy || !fieldDraft.label.trim()} className="btn3d btn3d-neutral text-xs inline-flex items-center justify-center gap-1.5 disabled:opacity-60">
            <ListPlus className="h-3.5 w-3.5" /> Add question
          </button>
        </div>
      </div>

      {/* Applications */}
      <div>
        <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-400">Applications ({applications.length})</div>
        {applications.length === 0 ? (
          <div className="rounded-xl bg-slate-50 p-4 text-center text-xs font-semibold text-slate-400">No applications yet.</div>
        ) : (
          <div className="space-y-1.5">
            {applications.map((a) => (
              <div key={a.id} className="rounded-xl bg-slate-50">
                <button type="button" onClick={() => toggleApp(a.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left">
                  <ChevronRight className={cx("h-4 w-4 shrink-0 text-slate-400 transition-transform", openAppId === a.id && "rotate-90")} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700">{a.applicant_name}</span>
                  <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ring-1", STATUS_TONE[a.status] || STATUS_TONE.new)}>{a.status}</span>
                </button>
                {openAppId === a.id && (
                  <div className="space-y-3 border-t border-white px-3 pb-3 pt-2">
                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
                      <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {a.applicant_email}</span>
                      {a.linkedin_url && <a href={a.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline"><Linkedin className="h-3.5 w-3.5" /> LinkedIn</a>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => download(a.id, "cv", a.cv_filename)} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
                        <Download className="h-3.5 w-3.5" /> CV
                      </button>
                      {a.has_cover_letter && (
                        <button type="button" onClick={() => download(a.id, "cover_letter", a.cover_letter_filename)} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
                          <Download className="h-3.5 w-3.5" /> Cover letter
                        </button>
                      )}
                      <select value={a.status} onChange={(e) => setStatus(a.id, e.target.value)} disabled={busy} className="ml-auto rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                        {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    {appDetail?.application?.id === a.id && appDetail.answers?.length > 0 && (
                      <div className="space-y-1.5 rounded-xl bg-white p-3 ring-1 ring-slate-200">
                        {appDetail.answers.map((ans) => (
                          <div key={ans.field_id} className="text-xs">
                            <div className="font-extrabold text-slate-400">{ans.label}</div>
                            {ans.field_type === "file" ? (
                              ans.file_name ? (
                                <button type="button" onClick={() => download(a.id, `answer:${ans.field_id}`, ans.file_name)} className="mt-0.5 inline-flex items-center gap-1 font-bold text-brand-600 hover:underline">
                                  <FileText className="h-3.5 w-3.5" /> {ans.file_name}
                                </button>
                              ) : <div className="mt-0.5 text-slate-400">No file uploaded</div>
                            ) : (
                              <div className="mt-0.5 whitespace-pre-wrap font-semibold text-slate-600">{ans.value || "—"}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [expandedId, setExpandedId] = useState(null);

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
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === it.id ? null : it.id)}
                          className="ml-auto inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-200"
                        >
                          <ChevronRight className={cx("h-3.5 w-3.5 transition-transform", expandedId === it.id && "rotate-90")} />
                          Questions & applications
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button type="button" onClick={() => saveItem(it)} disabled={busy} className="btn3d btn3d-brand text-xs inline-flex items-center gap-1.5"><Save className="h-3.5 w-3.5" /> Save</button>
                      <button type="button" onClick={() => removeItem(it)} disabled={busy} className="btn3d btn3d-cardinal text-xs inline-flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                    </div>
                  </div>
                  {expandedId === it.id && <VacancyPanel vacancy={it} api={api} showToast={showToast} />}
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
