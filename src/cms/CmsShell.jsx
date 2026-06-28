// src/cms/CmsShell.jsx
import { useEffect, useMemo, useState } from "react";
import { createCmsApi, getCmsToken, setCmsApiClient } from "./api";
import { BookOpen, Plus, Search, RefreshCw, Settings2, ListChecks, ArrowLeft, FileText, ChevronUp, ChevronDown } from "lucide-react";
import CmsLayout from "./CmsLayout";
import LessonEditor from "./LessonEditor";
import ExerciseEditor from "./ExerciseEditor";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

function LessonRow({ lesson, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "w-full rounded-2xl px-3.5 py-2.5 text-left ring-1 transition",
        active
          ? "bg-brand-50 text-brand-700 ring-brand-200"
          : "bg-white text-slate-900 ring-slate-200 hover:bg-slate-50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold">{lesson.title}</div>
          <div className={cx("mt-0.5 text-xs", active ? "text-brand-600/80" : "text-slate-500")}>
            <span className="font-mono">{lesson.slug}</span> · lvl {lesson.level} · {lesson.xp} xp
          </div>
        </div>
        <BookOpen className={cx("mt-1 h-4 w-4 shrink-0", active ? "text-brand-500" : "text-slate-300")} />
      </div>
    </button>
  );
}

function SubTab({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-display text-sm font-extrabold transition",
        active ? "bg-brand-500 text-white shadow-btn-brand" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

export default function CmsShell() {
  const token = getCmsToken();
  const api = useMemo(() => createCmsApi(token), [token]);
  useEffect(() => {
    setCmsApiClient(api);
  }, [api]);

  const [lessons, setLessons] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [creatingLesson, setCreatingLesson] = useState(false);
  const [tab, setTab] = useState("settings"); // "settings" | "exercises"
  const [exEditing, setExEditing] = useState(null); // null (list) | "new" | exerciseId
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
    if (!lessonId) return setExercises([]);
    const data = await api.listExercises(lessonId);
    setExercises(Array.isArray(data) ? data : []);
  }

  async function moveExercise(idx, dir) {
    const arr = sortedExercises.slice();
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    const [it] = arr.splice(idx, 1);
    arr.splice(j, 0, it);
    setExercises(arr.map((e, i) => ({ ...e, order: i + 1 }))); // optimistic
    try {
      await api.reorderExercises(arr.map((e) => e.id));
      await refreshExercises(selectedLessonId);
    } catch (e) {
      showToast(e.message || "Reorder failed", "err");
      await refreshExercises(selectedLessonId);
    }
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
      [l.title, l.slug, l.description].some((x) => String(x || "").toLowerCase().includes(q))
    );
  }, [lessons, query]);

  const selectedLesson = useMemo(
    () => lessons.find((l) => l.id === selectedLessonId) || null,
    [lessons, selectedLessonId]
  );

  const sortedExercises = useMemo(
    () => exercises.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [exercises]
  );

  const selectedExercise = useMemo(
    () => (typeof exEditing === "number" ? exercises.find((e) => e.id === exEditing) || null : null),
    [exercises, exEditing]
  );

  const lessonXpTotal = useMemo(
    () => exercises.reduce((sum, e) => sum + Number(e.xp || 0), 0),
    [exercises]
  );

  // ---- navigation helpers ----
  function openAllLessons() {
    setSelectedLessonId(null);
    setCreatingLesson(false);
    setExEditing(null);
  }
  function selectLesson(id) {
    setSelectedLessonId(id);
    setCreatingLesson(false);
    setTab("settings");
    setExEditing(null);
  }
  function startNewLesson() {
    setSelectedLessonId(null);
    setCreatingLesson(true);
    setExEditing(null);
  }

  // ---- breadcrumb ----
  const breadcrumb = useMemo(() => {
    const crumbs = [{ label: "Lessons", onClick: openAllLessons }];
    if (creatingLesson) {
      crumbs.push({ label: "New lesson" });
    } else if (selectedLesson) {
      crumbs.push({ label: selectedLesson.title, onClick: () => selectLesson(selectedLesson.id) });
      if (tab === "exercises") {
        crumbs.push({ label: "Exercises", onClick: () => setExEditing(null) });
        if (exEditing === "new") crumbs.push({ label: "New exercise" });
        else if (selectedExercise) crumbs.push({ label: `#${selectedExercise.order ?? "?"} · ${selectedExercise.kind}` });
      }
    }
    return crumbs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatingLesson, selectedLesson, tab, exEditing, selectedExercise]);

  const actions = (
    <>
      <button type="button" onClick={startNewLesson} className="btn3d btn3d-brand text-sm !py-2 inline-flex items-center gap-2">
        <Plus className="h-4 w-4" /> New lesson
      </button>
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
        className="btn3d btn3d-neutral text-sm !py-2 inline-flex items-center gap-2"
      >
        <RefreshCw className="h-4 w-4" /> Refresh
      </button>
    </>
  );

  return (
    <CmsLayout active="lessons" title="Lessons" breadcrumb={breadcrumb} actions={actions}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
        {/* ---------- LEFT: lessons list ---------- */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lessons…"
              className="w-full rounded-2xl bg-white py-2.5 pl-10 pr-4 font-semibold ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          <div className="space-y-2 rounded-3xl bg-white p-2 ring-1 ring-slate-200 shadow-sm">
            {loading ? (
              <div className="p-4 text-sm text-slate-500">Loading…</div>
            ) : filteredLessons.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No lessons found.</div>
            ) : (
              filteredLessons.map((l) => (
                <LessonRow key={l.id} lesson={l} active={l.id === selectedLessonId} onClick={() => selectLesson(l.id)} />
              ))
            )}
          </div>
          <div className="px-1 text-xs font-semibold text-slate-400">
            {filteredLessons.length} lesson{filteredLessons.length === 1 ? "" : "s"}
          </div>
        </div>

        {/* ---------- RIGHT: detail ---------- */}
        <div className="min-w-0">
          {/* Empty state */}
          {!selectedLesson && !creatingLesson && (
            <div className="grid place-items-center rounded-3xl bg-white p-12 text-center ring-1 ring-slate-200 shadow-sm">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-500">
                <FileText className="h-7 w-7" />
              </div>
              <div className="mt-3 font-display text-lg font-extrabold text-slate-800">Pick a lesson to edit</div>
              <p className="mt-1 max-w-sm font-semibold text-slate-500">
                Choose a lesson from the list, or create a new one to start building exercises.
              </p>
              <button type="button" onClick={startNewLesson} className="btn3d btn3d-brand mt-5 text-sm inline-flex items-center gap-2">
                <Plus className="h-4 w-4" /> New lesson
              </button>
            </div>
          )}

          {/* Create lesson */}
          {creatingLesson && (
            <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200 shadow-sm md:p-6">
              <div className="mb-4">
                <div className="font-display text-xl font-bold text-slate-900">Create lesson</div>
                <div className="mt-0.5 text-xs text-slate-500">Add lesson metadata; you can add exercises after saving.</div>
              </div>
              <LessonEditor
                lesson={null}
                lessonXpTotal={0}
                onSaved={async (msg) => {
                  await refreshLessons(true);
                  setCreatingLesson(false);
                  showToast(msg || "Saved");
                }}
                onDeleted={async (msg) => {
                  await refreshLessons(false);
                  openAllLessons();
                  showToast(msg || "Deleted");
                }}
              />
            </div>
          )}

          {/* Lesson detail with sub-tabs */}
          {selectedLesson && (
            <div className="space-y-4">
              {/* sub-tab bar */}
              <div className="flex flex-wrap items-center gap-2">
                <SubTab active={tab === "settings"} onClick={() => { setTab("settings"); setExEditing(null); }} icon={Settings2}>
                  Lesson settings
                </SubTab>
                <SubTab active={tab === "exercises"} onClick={() => { setTab("exercises"); setExEditing(null); }} icon={ListChecks}>
                  Exercises · {exercises.length}
                </SubTab>
                <div className="ml-auto rounded-2xl bg-brand-50 px-3 py-1.5 text-xs font-extrabold text-brand-700 ring-1 ring-brand-200">
                  {lessonXpTotal} XP total
                </div>
              </div>

              {/* settings */}
              {tab === "settings" && (
                <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200 shadow-sm md:p-6">
                  <LessonEditor
                    lesson={selectedLesson}
                    lessonXpTotal={lessonXpTotal}
                    onSaved={async (msg) => {
                      await refreshLessons(true);
                      showToast(msg || "Saved");
                    }}
                    onDeleted={async (msg) => {
                      await refreshLessons(false);
                      openAllLessons();
                      showToast(msg || "Deleted");
                    }}
                  />
                </div>
              )}

              {/* exercises */}
              {tab === "exercises" && exEditing === null && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-display text-base font-bold text-slate-900">Exercises</div>
                    <button type="button" onClick={() => setExEditing("new")} className="btn3d btn3d-brand text-sm !py-2 inline-flex items-center gap-2">
                      <Plus className="h-4 w-4" /> New exercise
                    </button>
                  </div>

                  {sortedExercises.length === 0 ? (
                    <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-slate-200 shadow-sm">
                      <div className="font-display font-extrabold text-slate-700">No exercises yet</div>
                      <p className="mt-1 text-sm font-semibold text-slate-500">Add your first exercise to this lesson.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-3xl bg-white p-2 ring-1 ring-slate-200 shadow-sm">
                      {sortedExercises.map((ex, idx) => (
                        <div
                          key={ex.id}
                          className="flex items-center gap-2 rounded-2xl bg-white px-2 py-1.5 ring-1 ring-slate-200 transition hover:ring-brand-200"
                        >
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => moveExercise(idx, -1)}
                              disabled={idx === 0}
                              title="Move up"
                              className="grid h-6 w-6 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 disabled:opacity-30"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveExercise(idx, 1)}
                              disabled={idx === sortedExercises.length - 1}
                              title="Move down"
                              className="grid h-6 w-6 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 disabled:opacity-30"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setExEditing(ex.id)}
                            className="flex min-w-0 flex-1 items-center justify-between gap-3 py-1 text-left"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-100 font-display text-sm font-extrabold text-slate-500">
                                {ex.order ?? "?"}
                              </span>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-bold text-slate-800">{ex.prompt || "(no prompt)"}</div>
                                <div className="mt-0.5 text-xs font-semibold text-slate-400">
                                  <span className="rounded-full bg-brand-50 px-2 py-0.5 font-mono text-brand-700 ring-1 ring-brand-200">{ex.kind}</span>
                                  <span className="ml-2 font-mono">{Number(ex.xp || 0)} xp</span>
                                </div>
                              </div>
                            </div>
                            <span className="shrink-0 font-mono text-xs text-slate-300">id:{ex.id}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* exercise editor */}
              {tab === "exercises" && exEditing !== null && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setExEditing(null)}
                    className="inline-flex items-center gap-1.5 text-sm font-extrabold text-slate-500 transition hover:text-brand-600"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back to exercises
                  </button>
                  <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200 shadow-sm md:p-6">
                    <div className="mb-4 font-display text-lg font-bold text-slate-900">
                      {exEditing === "new" ? "Create exercise" : "Edit exercise"}
                    </div>
                    <ExerciseEditor
                      lessonId={selectedLessonId}
                      exercise={exEditing === "new" ? null : selectedExercise}
                      onSaved={async (msg) => {
                        await refreshExercises(selectedLessonId);
                        setExEditing(null);
                        showToast(msg || "Saved");
                      }}
                      onDeleted={async (msg) => {
                        await refreshExercises(selectedLessonId);
                        setExEditing(null);
                        showToast(msg || "Deleted");
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
          <div
            className={cx(
              "rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg ring-1",
              toast.kind === "err" ? "bg-cardinal-50 text-cardinal-700 ring-cardinal-200" : "bg-grass-50 text-grass-700 ring-grass-200"
            )}
          >
            {toast.msg}
          </div>
        </div>
      )}
    </CmsLayout>
  );
}
