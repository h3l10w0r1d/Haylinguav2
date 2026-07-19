// src/cms/CmsForum.jsx — manage forum categories and moderate threads/posts.
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { Plus, Save, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Pin, Lock, Unlock, MessagesSquare, ChevronRight } from "lucide-react";
import CmsLayout from "./CmsLayout";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}
const inputCls =
  "w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none";

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function CmsForum() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  useEffect(() => { setCmsApiClient(api); }, [api]);

  const [categories, setCategories] = useState([]);
  const [edits, setEdits] = useState({});
  const [threads, setThreads] = useState([]);
  const [expandedThread, setExpandedThread] = useState(null);
  const [threadPosts, setThreadPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [draft, setDraft] = useState({ name: "", description: "" });

  function showToast(msg, kind = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2400);
  }

  async function refresh() {
    const [cats, th] = await Promise.all([api.listForumCategories(), api.listForumThreadsAdmin()]);
    const list = Array.isArray(cats?.categories) ? cats.categories : [];
    setCategories(list);
    const e = {};
    list.forEach((c) => { e[c.id] = { name: c.name || "", slug: c.slug || "", description: c.description || "" }; });
    setEdits(e);
    setThreads(Array.isArray(th?.threads) ? th.threads : []);
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
  }, [token]);

  if (!token) return <Navigate to="/cms/login" replace />;

  async function createCategory() {
    if (!draft.name.trim()) return;
    setBusy(true);
    try {
      await api.createForumCategory({ name: draft.name.trim(), slug: slugify(draft.name), description: draft.description.trim() });
      setDraft({ name: "", description: "" });
      await refresh();
      showToast("Category created");
    } catch (err) {
      showToast(err.message || "Create failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function saveCategory(c) {
    const e = edits[c.id] || {};
    setBusy(true);
    try {
      await api.updateForumCategory(c.id, { name: (e.name || "").trim(), slug: slugify(e.slug || e.name || ""), description: (e.description || "").trim() });
      await refresh();
      showToast("Saved");
    } catch (err) {
      showToast(err.message || "Save failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function toggleCategory(c) {
    setBusy(true);
    try {
      await api.updateForumCategory(c.id, { is_active: !c.is_active });
      await refresh();
    } catch (err) {
      showToast(err.message || "Update failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(c) {
    if (!confirm(`Delete "${c.name}"? All its threads and posts will be deleted too.`)) return;
    setBusy(true);
    try {
      await api.deleteForumCategory(c.id);
      await refresh();
      showToast("Deleted");
    } catch (err) {
      showToast(err.message || "Delete failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function moveCategory(idx, dir) {
    const next = categories.slice();
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    const [m] = next.splice(idx, 1);
    next.splice(j, 0, m);
    setCategories(next);
    setBusy(true);
    try {
      await api.reorderForumCategories(next.map((x) => x.id));
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

  async function toggleThreadFlag(t, field) {
    setBusy(true);
    try {
      await api.updateForumThread(t.id, { [field]: !t[field] });
      await refresh();
    } catch (err) {
      showToast(err.message || "Update failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function removeThread(t) {
    if (!confirm(`Delete the thread "${t.title}" and all its replies?`)) return;
    setBusy(true);
    try {
      await api.deleteForumThread(t.id);
      if (expandedThread === t.id) { setExpandedThread(null); setThreadPosts([]); }
      await refresh();
      showToast("Thread deleted");
    } catch (err) {
      showToast(err.message || "Delete failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function toggleExpand(t) {
    if (expandedThread === t.id) { setExpandedThread(null); setThreadPosts([]); return; }
    setExpandedThread(t.id);
    try {
      const res = await api.listForumThreadPosts(t.id);
      setThreadPosts(Array.isArray(res?.posts) ? res.posts : []);
    } catch (err) {
      showToast(err.message || "Failed to load posts", "err");
    }
  }

  async function removePost(p) {
    if (!confirm("Delete this reply?")) return;
    setBusy(true);
    try {
      await api.deleteForumPost(p.id);
      const res = await api.listForumThreadPosts(expandedThread);
      setThreadPosts(Array.isArray(res?.posts) ? res.posts : []);
      await refresh();
      showToast("Reply deleted");
    } catch (err) {
      showToast(err.message || "Delete failed", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CmsLayout active="forum" title="Community">
      <div className="space-y-8">
        {/* ----- Categories ----- */}
        <section className="space-y-4">
          <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
            <div className="mb-3 font-display text-base font-bold text-slate-900">New category</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.6fr_auto]">
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name — e.g. Grammar questions" className={inputCls} />
              <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Description" className={inputCls} />
              <button type="button" onClick={createCategory} disabled={busy || !draft.name.trim()} className="btn3d btn3d-brand text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-slate-500">Loading…</div>
          ) : (
            <div className="space-y-3">
              {categories.map((c, idx) => {
                const e = edits[c.id] || {};
                return (
                  <div key={c.id} className={cx("rounded-3xl bg-white p-4 ring-1 shadow-sm", c.is_active ? "ring-slate-200" : "ring-slate-200 opacity-70")}>
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col gap-1 pt-1">
                        <button type="button" onClick={() => moveCategory(idx, -1)} disabled={busy || idx === 0} className="grid h-7 w-7 place-items-center rounded-xl text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"><ChevronUp className="h-4 w-4" /></button>
                        <button type="button" onClick={() => moveCategory(idx, 1)} disabled={busy || idx === categories.length - 1} className="grid h-7 w-7 place-items-center rounded-xl text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"><ChevronDown className="h-4 w-4" /></button>
                      </div>
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-feather-50 text-feather-500"><MessagesSquare className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <input value={e.name || ""} onChange={(ev) => patch(c.id, { name: ev.target.value })} placeholder="Name" className={cx(inputCls, "!py-2 font-bold")} />
                          <input value={e.description || ""} onChange={(ev) => patch(c.id, { description: ev.target.value })} placeholder="Description" className={cx(inputCls, "!py-2 text-xs")} />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <span className="text-xs font-semibold text-slate-400">/community/{e.slug || c.slug}</span>
                          <button type="button" onClick={() => toggleCategory(c)} disabled={busy}
                            className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 transition",
                              c.is_active ? "bg-grass-50 text-grass-700 ring-grass-200 hover:bg-grass-100" : "bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200")}>
                            {c.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                            {c.is_active ? "Visible" : "Hidden"}
                          </button>
                          <span className="text-xs font-semibold text-slate-400">{c.thread_count ?? 0} threads</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button type="button" onClick={() => saveCategory(c)} disabled={busy} className="btn3d btn3d-brand text-xs inline-flex items-center gap-1.5"><Save className="h-3.5 w-3.5" /> Save</button>
                        <button type="button" onClick={() => removeCategory(c)} disabled={busy} className="btn3d btn3d-cardinal text-xs inline-flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ----- Thread moderation ----- */}
        <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm">
          <div className="mb-1 font-display text-base font-bold text-slate-900">Recent threads</div>
          <p className="mb-4 text-sm font-semibold text-slate-500">Pin, lock, or remove threads and individual replies.</p>

          {threads.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">No threads yet.</div>
          ) : (
            <div className="space-y-2">
              {threads.map((t) => (
                <div key={t.id} className="rounded-2xl ring-1 ring-slate-100">
                  <div className="flex flex-wrap items-center gap-2 p-3">
                    <button type="button" onClick={() => toggleExpand(t)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
                      <ChevronRight className={cx("h-4 w-4 transition-transform", expandedThread === t.id && "rotate-90")} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-slate-800">{t.title}</div>
                      <div className="text-xs font-semibold text-slate-400">
                        {t.category_name} · by {t.author_name} · {t.reply_count} {t.reply_count === 1 ? "reply" : "replies"}
                      </div>
                    </div>
                    <button type="button" onClick={() => toggleThreadFlag(t, "is_pinned")} disabled={busy}
                      className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 transition",
                        t.is_pinned ? "bg-gold-50 text-gold-700 ring-gold-200" : "bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200")}>
                      <Pin className="h-3.5 w-3.5" /> {t.is_pinned ? "Pinned" : "Pin"}
                    </button>
                    <button type="button" onClick={() => toggleThreadFlag(t, "is_locked")} disabled={busy}
                      className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 transition",
                        t.is_locked ? "bg-cardinal-50 text-cardinal-700 ring-cardinal-200" : "bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200")}>
                      {t.is_locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />} {t.is_locked ? "Locked" : "Lock"}
                    </button>
                    <button type="button" onClick={() => removeThread(t)} disabled={busy} className="grid h-8 w-8 place-items-center rounded-xl text-cardinal-500 ring-1 ring-slate-200 hover:bg-cardinal-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  {expandedThread === t.id && (
                    <div className="space-y-2 border-t border-slate-100 p-3">
                      {threadPosts.length === 0 ? (
                        <div className="text-xs font-semibold text-slate-400">No replies.</div>
                      ) : (
                        threadPosts.map((p, i) => (
                          <div key={p.id} className="flex items-start gap-2 rounded-xl bg-slate-50 p-2.5">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-slate-600">{p.author_name} {i === 0 && <span className="ml-1 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-brand-700">Original post</span>}</div>
                              <div className="mt-0.5 whitespace-pre-wrap text-xs font-semibold text-slate-500">{p.body}</div>
                            </div>
                            {i > 0 && (
                              <button type="button" onClick={() => removePost(p)} disabled={busy} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-cardinal-500 hover:bg-cardinal-50"><Trash2 className="h-3.5 w-3.5" /></button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
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
