// src/cms/CmsChapters.jsx — manage chapters (lesson groups on the learner roadmap).
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { Layers, Plus, Save, Trash2, ChevronUp, ChevronDown, BookOpen, Eye, EyeOff } from "lucide-react";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function TopBar() {
  return (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur ring-1 ring-slate-200/70">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-3 text-slate-900">
          <div className="w-10 h-10 rounded-2xl bg-brand-500 text-white flex items-center justify-center shadow-sm ring-1 ring-brand-600/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-display font-bold leading-tight">Chapters</div>
            <div className="text-xs text-slate-500 -mt-0.5">Group lessons on the roadmap</div>
          </div>
        </div>
        <div className="flex-1" />
        <a
          href="/cms"
          className="shrink-0 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 shadow-sm hover:bg-slate-50 transition inline-flex items-center gap-2"
        >
          <BookOpen className="w-4 h-4" />
          Lessons
        </a>
      </div>
    </div>
  );
}

export default function CmsChapters() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  useEffect(() => {
    setCmsApiClient(api);
  }, [api]);

  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [draft, setDraft] = useState({ title: "", description: "" });
  const [edits, setEdits] = useState({}); // id -> {title, description}

  function showToast(msg, kind = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2400);
  }

  async function refresh() {
    const data = await api.listChapters();
    const list = Array.isArray(data) ? data : [];
    setChapters(list);
    const e = {};
    list.forEach((c) => (e[c.id] = { title: c.title || "", description: c.description || "" }));
    setEdits(e);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await refresh();
      } catch (err) {
        showToast(err.message || "Failed to load chapters", "err");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return <Navigate to="/cms/login" replace />;

  async function create() {
    const title = draft.title.trim();
    if (!title) return;
    setBusy(true);
    try {
      await api.createChapter({ title, description: draft.description.trim() });
      setDraft({ title: "", description: "" });
      await refresh();
      showToast("Chapter created");
    } catch (err) {
      showToast(err.message || "Create failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function saveOne(c) {
    const e = edits[c.id] || {};
    setBusy(true);
    try {
      await api.updateChapter(c.id, { title: (e.title || "").trim(), description: (e.description || "").trim() });
      await refresh();
      showToast("Saved");
    } catch (err) {
      showToast(err.message || "Save failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublished(c) {
    setBusy(true);
    try {
      await api.updateChapter(c.id, { is_published: !c.is_published });
      await refresh();
    } catch (err) {
      showToast(err.message || "Update failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function remove(c) {
    if (!confirm(`Delete "${c.title}"? Its ${c.lesson_count} lesson(s) will be unassigned, not deleted.`)) return;
    setBusy(true);
    try {
      await api.deleteChapter(c.id);
      await refresh();
      showToast("Chapter deleted");
    } catch (err) {
      showToast(err.message || "Delete failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function move(idx, dir) {
    const next = chapters.slice();
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    const [it] = next.splice(idx, 1);
    next.splice(j, 0, it);
    setChapters(next); // optimistic
    setBusy(true);
    try {
      await api.reorderChapters(next.map((c) => c.id));
      await refresh();
    } catch (err) {
      showToast(err.message || "Reorder failed", "err");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Create */}
        <div className="bg-white rounded-3xl ring-1 ring-slate-200 shadow-sm p-5">
          <div className="font-display text-base font-bold text-slate-900 mb-3">New chapter</div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_auto] gap-3 items-start">
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Title — e.g. The Alphabet"
              className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none"
            />
            <input
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Short description (optional)"
              className="w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={create}
              disabled={busy || !draft.title.trim()}
              className="btn3d btn3d-brand text-sm inline-flex items-center gap-2 disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading…</div>
        ) : chapters.length === 0 ? (
          <div className="bg-white rounded-3xl ring-1 ring-slate-200 shadow-sm p-8 text-center text-sm font-semibold text-slate-500">
            No chapters yet. Create your first one above.
          </div>
        ) : (
          <div className="space-y-3">
            {chapters.map((c, idx) => {
              const e = edits[c.id] || { title: "", description: "" };
              return (
                <div key={c.id} className="bg-white rounded-3xl ring-1 ring-slate-200 shadow-sm p-4">
                  <div className="flex items-start gap-3">
                    {/* reorder */}
                    <div className="flex flex-col gap-1 pt-1">
                      <button
                        type="button"
                        onClick={() => move(idx, -1)}
                        disabled={busy || idx === 0}
                        className="grid h-7 w-7 place-items-center rounded-xl ring-1 ring-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                        title="Move up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(idx, 1)}
                        disabled={busy || idx === chapters.length - 1}
                        className="grid h-7 w-7 place-items-center rounded-xl ring-1 ring-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                        title="Move down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-200 font-display font-extrabold text-sm">
                      {idx + 1}
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <input
                        value={e.title}
                        onChange={(ev) => setEdits({ ...edits, [c.id]: { ...e, title: ev.target.value } })}
                        className="w-full rounded-2xl bg-slate-50 px-4 py-2 text-sm font-bold text-slate-900 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none"
                      />
                      <input
                        value={e.description}
                        onChange={(ev) => setEdits({ ...edits, [c.id]: { ...e, description: ev.target.value } })}
                        placeholder="Description (optional)"
                        className="w-full rounded-2xl bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none"
                      />
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                          <BookOpen className="w-3.5 h-3.5" />
                          {c.lesson_count} lesson{c.lesson_count === 1 ? "" : "s"}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePublished(c)}
                          disabled={busy}
                          className={cx(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 transition",
                            c.is_published
                              ? "bg-grass-50 text-grass-700 ring-grass-200 hover:bg-grass-100"
                              : "bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200"
                          )}
                        >
                          {c.is_published ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          {c.is_published ? "Published" : "Hidden"}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => saveOne(c)}
                        disabled={busy}
                        className="btn3d btn3d-brand text-xs inline-flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(c)}
                        disabled={busy}
                        className="btn3d btn3d-cardinal text-xs inline-flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50">
          <div
            className={cx(
              "px-4 py-3 rounded-2xl shadow-lg ring-1 text-sm font-semibold",
              toast.kind === "err"
                ? "bg-cardinal-50 ring-cardinal-200 text-cardinal-700"
                : "bg-grass-50 ring-grass-200 text-grass-700"
            )}
          >
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
