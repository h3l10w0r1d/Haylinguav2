// src/cms/CmsLessons.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Plus, Search, Loader2 } from "lucide-react";
import { cmsCreateLesson, cmsListLessons } from "./cmsApi";

function TextInput({ value, onChange, placeholder }) {
  return (
    <div className="flex items-center gap-2 bg-white rounded-2xl ring-1 ring-slate-200 px-3 py-2">
      <Search className="w-4 h-4 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full outline-none text-sm"
      />
    </div>
  );
}

export default function CmsLessons() {
  const { cmsKey } = useParams();
  const base = `/${cmsKey}/cms`;

  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const data = await cmsListLessons();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "Failed to load lessons");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    const out = [];
    for (let i = 0; i < items.length; i++) {
      const x = items[i];
      const hay = `${x.title || ""} ${x.slug || ""} ${x.description || ""}`.toLowerCase();
      if (hay.includes(query)) out.push(x);
    }
    return out;
  }, [items, q]);

  async function createQuickLesson() {
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
      const created = await cmsCreateLesson(payload);
      // reload list
      await load();
      // Optionally navigate after you add routing
      alert(`Created lesson id=${created?.id}`);
    } catch (e) {
      alert(e.message || "Create failed");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Lessons</h1>
          <p className="text-sm text-slate-600 mt-1">
            Create and edit lessons. Each lesson contains exercises.
          </p>
        </div>

        <button
          type="button"
          onClick={createQuickLesson}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition"
        >
          <Plus className="w-4 h-4" />
          New lesson
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <TextInput value={q} onChange={setQ} placeholder="Search by title or slug…" />
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 rounded-2xl bg-white ring-1 ring-slate-200 text-sm font-semibold hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {err ? (
        <div className="bg-red-50 text-red-700 ring-1 ring-red-200 rounded-2xl p-4 text-sm">
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
            <div className="bg-white rounded-2xl ring-1 ring-slate-200 p-5 text-sm text-slate-600">
              No lessons found.
            </div>
          ) : null}

          {filtered.map((l) => (
            <Link
              key={l.id}
              to={`${base}/lessons/${l.id}`}
              className="group bg-white rounded-2xl ring-1 ring-slate-200 p-5 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm text-slate-500">slug</div>
                  <div className="font-semibold text-slate-900 truncate">
                    {l.slug}
                  </div>

                  <div className="mt-3 text-sm text-slate-500">title</div>
                  <div className="text-lg font-semibold text-slate-900 truncate">
                    {l.title || "(untitled)"}
                  </div>

                  {l.description ? (
                    <div className="mt-2 text-sm text-slate-600 line-clamp-2">
                      {l.description}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-slate-400">
                      No description
                    </div>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-xs text-slate-500">Level</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {l.level ?? 1}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">XP</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {l.xp ?? 0}
                  </div>
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
