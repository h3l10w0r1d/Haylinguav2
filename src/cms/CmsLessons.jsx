// src/cms/CmsLessons.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { createCmsApi } from "./api";
import { Loader2, Plus, Search, RefreshCcw, Eye, EyeOff, ExternalLink } from "lucide-react";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

export default function CmsLessons() {
  const { cmsKey } = useParams();
  const api = useMemo(() => createCmsApi(cmsKey), [cmsKey]);

  const [lessons, setLessons] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const data = await api.listLessons();
      setLessons(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "Failed to load lessons");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmsKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lessons;

    const out = [];
    for (let i = 0; i < lessons.length; i++) {
      const l = lessons[i];
      const hay = `${l.title || ""} ${l.slug || ""} ${l.description || ""}`.toLowerCase();
      if (hay.includes(q)) out.push(l);
    }
    return out;
  }, [lessons, query]);

  async function createNewLesson() {
    const now = Date.now();
    const payload = {
      slug: `new-lesson-${now}`,
      title: "New Lesson",
      description: "",
      level: 1,
      xp: 40,
      xp_reward: 40,
      // Draft by default — build it out in the editor before it's visible
      // to real students. Also enforced server-side.
      is_published: false,
    };

    try {
      await api.createLesson(payload);
      await load();
    } catch (e) {
      alert(e.message || "Create failed");
    }
  }

  async function togglePublished(l) {
    try {
      await api.updateLesson(l.id, { is_published: !l.is_published });
      await load();
    } catch (e) {
      alert(e.message || "Update failed");
    }
  }

  async function preview(l) {
    try {
      const res = await api.getLessonPreviewLink(l.id);
      if (res?.url) window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      alert(e.message || "Failed to create preview link");
    }
  }

  const base = `/${cmsKey}/cms`;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900">Lessons</h1>
          <p className="text-sm text-slate-600 mt-1">
            Create and edit lessons stored in SQL.
          </p>
        </div>

        <button
          type="button"
          onClick={createNewLesson}
          className="btn3d btn3d-brand text-sm"
        >
          <Plus className="w-4 h-4" />
          New lesson
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title / slug / description…"
            className="w-full rounded-2xl bg-slate-50 pl-9 pr-3 py-2.5 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={load}
          className="btn3d btn3d-neutral text-sm"
        >
          <RefreshCcw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {err ? (
        <div className="bg-cardinal-50 ring-1 ring-cardinal-200 text-cardinal-800 rounded-2xl p-4 text-sm font-semibold">
          {err}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
          Loading lessons…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-5 text-sm text-slate-600">
              No lessons found.
            </div>
          ) : null}

          {filtered.map((l) => (
            <Link
              key={l.id}
              to={`${base}/lessons/${l.id}`}
              className="group bg-white rounded-2xl ring-1 ring-slate-200 p-5 hover:ring-brand-300 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-500">slug</div>
                  <div className="font-semibold text-slate-900 truncate">{l.slug}</div>

                  <div className="mt-3 text-xs font-extrabold text-slate-500">title</div>
                  <div className="font-display text-lg font-extrabold text-slate-900 truncate">
                    {l.title || "(untitled)"}
                  </div>

                  {l.description ? (
                    <div className="mt-2 text-sm text-slate-600 line-clamp-2">
                      {l.description}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-slate-400">No description</div>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-xs font-extrabold text-slate-500">Level</div>
                  <div className="text-sm font-extrabold text-slate-900">{l.level ?? 1}</div>
                  <div className="mt-2 text-xs font-extrabold text-slate-500">XP</div>
                  <div className="text-sm font-extrabold text-slate-900">{l.xp ?? 0}</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePublished(l); }}
                    className={cx(
                      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-extrabold transition",
                      l.is_published
                        ? "bg-grass-50 text-grass-700 hover:bg-grass-100"
                        : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    )}
                  >
                    {l.is_published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    {l.is_published ? "Published" : "Draft"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); preview(l); }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600 transition hover:bg-slate-200"
                    title={l.is_published ? "Open this lesson" : "Open a preview link (works even while unpublished)"}
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Preview
                  </button>
                </div>

                <div className="text-sm font-extrabold text-brand-600 opacity-0 group-hover:opacity-100 transition">
                  Open editor →
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
