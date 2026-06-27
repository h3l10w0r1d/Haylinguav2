// src/cms/CmsShell.jsx
import { useEffect, useMemo, useState } from "react";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { BookOpen, Plus, Search, Settings2 } from "lucide-react";
import LessonEditor from "./LessonEditor";
import ExerciseEditor from "./ExerciseEditor";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function TopBar({ query, setQuery }) {
  return (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur ring-1 ring-slate-200/70">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-3 text-slate-900">
          <div className="w-10 h-10 rounded-2xl bg-brand-500 text-white flex items-center justify-center shadow-sm ring-1 ring-brand-600/20">
            <Settings2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-display font-bold leading-tight">
              Haylingua CMS
            </div>
            <div className="text-xs text-slate-500 -mt-0.5">
              Lessons & exercises
            </div>
          </div>
        </div>

        <div className="flex-1" />

        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lessons…"
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 ring-2 ring-slate-200 font-semibold focus:bg-white focus:ring-brand-400 focus:outline-none"
          />
        </div>

        <a
          href="/cms/support"
          className="shrink-0 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 shadow-sm hover:bg-slate-50 transition"
        >
          Support
        </a>
      </div>
    </div>
  );
}

function LessonRow({ lesson, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "w-full text-left px-3.5 py-2.5 rounded-2xl ring-1 transition",
        active
          ? "bg-brand-50 text-brand-700 ring-brand-200"
          : "bg-white text-slate-900 ring-slate-200 hover:bg-slate-50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{lesson.title}</div>
          <div
            className={cx(
              "text-xs mt-0.5",
              active ? "text-brand-600/80" : "text-slate-500"
            )}
          >
            slug: <span className="font-mono">{lesson.slug}</span> · level{" "}
            {lesson.level} · xp {lesson.xp}
          </div>
        </div>
        <BookOpen
          className={cx(
            "w-4 h-4 mt-1",
            active ? "text-brand-500" : "text-slate-400"
          )}
        />
      </div>
    </button>
  );
}

export default function CmsShell() {
  const token = getCmsToken();

  // Create a token-bound api client
  const api = useMemo(() => createCmsApi(token), [token]);

  // For compatibility with LessonEditor/ExerciseEditor that import { cmsApi } from "./api"
  useEffect(() => {
    setCmsApiClient(api);
  }, [api]);

  const [lessons, setLessons] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState(null);

  const [exercises, setExercises] = useState([]);

  const [mode, setMode] = useState("lesson"); // "lesson" | "exercise"
  const [query, setQuery] = useState("");

  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  function showToast(msg, kind = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2400);
  }

  async function refreshLessons(preserveSelection = true) {
    const data = await api.listLessons();
    setLessons(Array.isArray(data) ? data : []);
    if (!preserveSelection) setSelectedLessonId(null);
  }

  async function refreshExercises(lessonId) {
    if (!lessonId) {
      setExercises([]);
      return;
    }
    const data = await api.listExercises(lessonId);
    setExercises(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await refreshLessons(false);
      } catch (e) {
        showToast(e.message || "Failed to load lessons", "err");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    (async () => {
      try {
        await refreshExercises(selectedLessonId);
      } catch (e) {
        showToast(e.message || "Failed to load exercises", "err");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLessonId]);

  const filteredLessons = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lessons;
    return lessons.filter((l) =>
      [l.title, l.slug, l.description].some((x) =>
        String(x || "").toLowerCase().includes(q)
      )
    );
  }, [lessons, query]);

  const selectedLesson = useMemo(
    () => lessons.find((l) => l.id === selectedLessonId) || null,
    [lessons, selectedLessonId]
  );

  const selectedExercise = useMemo(
    () => exercises.find((e) => e.id === selectedExerciseId) || null,
    [exercises, selectedExerciseId]
  );

  // ✅ NEW: total XP for current lesson, derived from exercises
  const lessonXpTotal = useMemo(() => {
    return exercises.reduce((sum, e) => sum + Number(e.xp || 0), 0);
  }, [exercises]);

  const rightTitle =
    mode === "lesson"
      ? selectedLessonId
        ? "Edit lesson"
        : "Create lesson"
      : selectedExerciseId
      ? "Edit exercise"
      : "Create exercise";

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar query={query} setQuery={setQuery} />

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
        {/* LEFT: lessons list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-base font-display font-bold text-slate-900">
              Lessons
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedLessonId(null);
                setSelectedExerciseId(null);
                setMode("lesson");
              }}
              className="btn3d btn3d-brand text-sm !py-2 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New
            </button>
          </div>

          <div className="bg-white rounded-3xl ring-1 ring-slate-200 shadow-sm p-2 space-y-2">
            {loading ? (
              <div className="p-4 text-sm text-slate-500">Loading…</div>
            ) : filteredLessons.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No lessons found.</div>
            ) : (
              filteredLessons.map((l) => (
                <LessonRow
                  key={l.id}
                  lesson={l}
                  active={l.id === selectedLessonId}
                  onClick={() => {
                    setSelectedLessonId(l.id);
                    setSelectedExerciseId(null);
                    setMode("lesson");
                  }}
                />
              ))
            )}
          </div>

          {/* Exercises list for lesson */}
          <div className="bg-white rounded-3xl ring-1 ring-slate-200 shadow-sm p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-base font-display font-bold text-slate-900">
                Exercises{" "}
                {selectedLesson ? (
                  <span className="font-sans text-sm font-semibold text-slate-400">
                    · {selectedLesson.slug}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!selectedLessonId)
                    return showToast("Select a lesson first", "err");
                  setSelectedExerciseId(null);
                  setMode("exercise");
                }}
                className={cx(
                  "text-sm !py-2",
                  selectedLessonId
                    ? "btn3d btn3d-neutral"
                    : "rounded-2xl bg-slate-100 px-4 py-2 font-semibold text-slate-400 cursor-not-allowed"
                )}
              >
                + New exercise
              </button>
            </div>

            {/* ✅ NEW: lesson XP info */}
            {selectedLessonId ? (
              <div className="mb-3 rounded-2xl ring-1 ring-brand-200 bg-brand-50 px-4 py-2.5">
                <div className="text-xs font-semibold text-brand-600/80">
                  Total lesson XP (auto)
                </div>
                <div className="text-sm font-display font-bold text-brand-700">
                  {lessonXpTotal} XP
                </div>
              </div>
            ) : null}

            {!selectedLessonId ? (
              <div className="text-sm text-slate-500">
                Pick a lesson to view exercises.
              </div>
            ) : exercises.length === 0 ? (
              <div className="text-sm text-slate-500">No exercises yet.</div>
            ) : (
              <div className="space-y-2">
                {exercises
                  .slice()
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((ex) => (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => {
                        setSelectedExerciseId(ex.id);
                        setMode("exercise");
                      }}
                      className={cx(
                        "w-full text-left px-3.5 py-2.5 rounded-2xl ring-1 transition",
                        ex.id === selectedExerciseId
                          ? "bg-brand-50 ring-brand-200"
                          : "bg-white ring-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div
                            className={cx(
                              "text-sm font-semibold",
                              ex.id === selectedExerciseId
                                ? "text-brand-700"
                                : "text-slate-900"
                            )}
                          >
                            #{ex.order ?? "?"} ·{" "}
                            <span className="font-mono">{ex.kind}</span>
                            <span className="ml-2 text-slate-400 font-mono">
                              ({Number(ex.xp || 0)}xp)
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 line-clamp-1">
                            {ex.prompt}
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          id:{ex.id}
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: editor */}
        <div className="bg-white rounded-3xl ring-1 ring-slate-200 shadow-sm p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xl font-display font-bold text-slate-900">
                {rightTitle}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {mode === "lesson"
                  ? "Manage lesson metadata shown in the learning path."
                  : "Manage exercise content stored in SQL."}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await refreshLessons(true);
                    await refreshExercises(selectedLessonId);
                    showToast("Refreshed");
                  } catch (e) {
                    showToast(e.message || "Refresh failed", "err");
                  }
                }}
                className="btn3d btn3d-neutral text-sm !py-2"
              >
                Refresh
              </button>
            </div>
          </div>

          {mode === "lesson" ? (
            <LessonEditor
              lesson={selectedLesson}
              // ✅ NEW: send computed XP into editor so it can show read-only XP
              lessonXpTotal={lessonXpTotal}
              onSaved={async (msg) => {
                await refreshLessons(true);
                showToast(msg || "Saved");
              }}
              onDeleted={async (msg) => {
                await refreshLessons(false);
                setSelectedLessonId(null);
                setSelectedExerciseId(null);
                setMode("lesson");
                showToast(msg || "Deleted");
              }}
            />
          ) : (
            <ExerciseEditor
              lessonId={selectedLessonId}
              exercise={selectedExercise}
              onSaved={async (msg) => {
                await refreshExercises(selectedLessonId);
                showToast(msg || "Saved");
              }}
              onDeleted={async (msg) => {
                await refreshExercises(selectedLessonId);
                setSelectedExerciseId(null);
                showToast(msg || "Deleted");
              }}
            />
          )}
        </div>
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
