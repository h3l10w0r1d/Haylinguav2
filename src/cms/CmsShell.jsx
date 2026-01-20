import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { createCmsApi, setCmsApiClient, cmsApi } from "./api";
import { BookOpen, Plus, Search, Settings2 } from "lucide-react";
import LessonEditor from "./LessonEditor";
import ExerciseEditor from "./ExerciseEditor";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function TopBar({ query, setQuery }) {
  return (
    <div className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center">
            <Settings2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm">Haylingua CMS</div>
            <div className="text-xs text-slate-500 -mt-0.5">
              Lessons & exercises
            </div>
          </div>
        </div>

        <div className="flex-1" />

        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lessons…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>
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
        "w-full text-left px-3 py-2 rounded-xl border transition",
        active
          ? "bg-orange-50 border-orange-200"
          : "bg-white border-slate-200 hover:bg-slate-50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-900">{lesson.title}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            slug: <span className="font-mono">{lesson.slug}</span> · level{" "}
            {lesson.level} · xp {lesson.xp}
          </div>
        </div>
        <BookOpen className="w-4 h-4 text-slate-400 mt-1" />
      </div>
    </button>
  );
}

export default function CmsShell() {
  const { cmsKey } = useParams();

  // Create a token-bound api client
  const api = useMemo(() => createCmsApi(cmsKey), [cmsKey]);

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
  }, [cmsKey]);

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
            <div className="text-sm font-semibold text-slate-900">Lessons</div>
            <button
              type="button"
              onClick={() => {
                setSelectedLessonId(null);
                setSelectedExerciseId(null);
                setMode("lesson");
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700"
            >
              <Plus className="w-4 h-4" />
              New
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-2 space-y-2">
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
          <div className="bg-white rounded-2xl border border-slate-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-slate-900">
                Exercises{" "}
                {selectedLesson ? (
                  <span className="text-slate-400">· {selectedLesson.slug}</span>
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
                  "px-3 py-2 rounded-xl text-sm font-semibold",
                  selectedLessonId
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                )}
              >
                + New exercise
              </button>
            </div>

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
                        "w-full text-left px-3 py-2 rounded-xl border transition",
                        ex.id === selectedExerciseId
                          ? "bg-orange-50 border-orange-200"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            #{ex.order ?? "?"} ·{" "}
                            <span className="font-mono">{ex.kind}</span>
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
        <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">
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
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>
          </div>

          {mode === "lesson" ? (
            <LessonEditor
              lesson={selectedLesson}
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
              "px-4 py-3 rounded-2xl shadow-lg border text-sm font-semibold",
              toast.kind === "err"
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
            )}
          >
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
