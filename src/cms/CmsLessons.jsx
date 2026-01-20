// src/cms/CmsLessons.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { createCmsApi } from "./api";
import { Loader2, Plus, Search, RefreshCcw } from "lucide-react";

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
    };

    try {
      await api.createLesson(payload);
      await load();
    } catch (e) {
      alert(e.message || "Create failed");
    }
  }

  const base = `/${cmsKey}/cms`;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Lessons</h1>
          <p className="text-sm text-slate-600 mt-1">
            Create and edit lessons stored in SQL.
          </p>
        </div>

        <button
          type="button"
          onClick={createNewLesson}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition"
        >
          <Plus className="w-4 h-4" />
          New lesson
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title / slug / description…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>

        <button
          type="button"
          onClick={load}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold hover:bg-slate-50"
        >
          <RefreshCcw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {err ? (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-sm font-semibold">
          {err}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading lessons…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 text-sm text-slate-600">
              No lessons found.
            </div>
          ) : null}

          {filtered.map((l) => (
            <Link
              key={l.id}
              to={`${base}/lessons/${l.id}`}
              className="group bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">slug</div>
                  <div className="font-semibold text-slate-900 truncate">{l.slug}</div>

                  <div className="mt-3 text-xs text-slate-500">title</div>
                  <div className="text-lg font-semibold text-slate-900 truncate">
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
                  <div className="text-xs text-slate-500">Level</div>
                  <div className="text-sm font-semibold text-slate-900">{l.level ?? 1}</div>
                  <div className="mt-2 text-xs text-slate-500">XP</div>
                  <div className="text-sm font-semibold text-slate-900">{l.xp ?? 0}</div>
                </div>
              </div>

              <div className="mt-4 text-sm font-semibold text-orange-700 opacity-0 group-hover:opacity-100 transition">
                Open editor →
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
