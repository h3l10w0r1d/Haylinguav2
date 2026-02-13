// src/LessonPlayer.jsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";

import ExerciseRenderer from "./ExerciseRenderer";
import LessonCompletionScreen from "./LessonCompletionScreen";
import ExerciseAnalyticsModal from "./ExerciseAnalyticsModal";

// 🔧 Make sure this matches your backend URL
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("hay_token") ||
    ""
  );
}

export default function LessonPlayer() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [lessonXpEarned, setLessonXpEarned] = useState(0);
  // Per-exercise result modal (Duolingo-style)
  const [resultOpen, setResultOpen] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [pendingNext, setPendingNext] = useState(null);
  // True only AFTER the user submits an answer for the LAST exercise.
  // This prevents showing the "Done" state just because we are viewing the last step.
  const [hasFinishedAll, setHasFinishedAll] = useState(false);

  // Lesson analytics (shown after finishing all exercises)
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);

  // Per-exercise analytics modal (opened from completion screen)
  const [exModalOpen, setExModalOpen] = useState(false);
  const [exModalLoading, setExModalLoading] = useState(false);
  const [exModalError, setExModalError] = useState(null);
  const [exModalData, setExModalData] = useState(null);
  const [exModalExerciseId, setExModalExerciseId] = useState(null);

  const currentExercise = useMemo(() => {
    if (!lesson || !lesson.exercises || lesson.exercises.length === 0) return null;
    return lesson.exercises[currentIndex] || null;
  }, [lesson, currentIndex]);

  // ---------- Load lesson ----------

  useEffect(() => {
    if (!slug) return;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      const url = `${API_BASE}/lessons/${slug}`;
      console.log("[LessonPlayer] Loading lesson from:", url);

      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        console.log(
          "[LessonPlayer] Lesson response:",
          res.status,
          Object.fromEntries(res.headers.entries())
        );

        if (!res.ok) {
          const text = await res.text();
          console.error("[LessonPlayer] Failed to load lesson:", res.status, text);
          setLoadError(
            `Failed to load lesson (${res.status}). Check backend logs / URL / CORS.`
          );
          return;
        }

        const data = await res.json();
        console.log("[LessonPlayer] Lesson data:", data);

        setLesson(data);
        setCurrentIndex(0);
        setHasFinishedAll(false);
        setLessonXpEarned(0);
        setAnalyticsLoading(false);
        setAnalyticsError(null);
        setAnalyticsData(null);

        if (!data.exercises || data.exercises.length === 0) {
          console.warn("[LessonPlayer] Lesson has no exercises array or it's empty.");
        } else {
          console.log(
            "[LessonPlayer] Exercise kinds:",
            data.exercises.map((e) => e.kind)
          );
        }
      } catch (err) {
        console.error("[LessonPlayer] Error loading lesson:", err);
        setLoadError("Network error when loading lesson. Check console and backend.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [slug]);

  // ---------- Handling answers from ExerciseRenderer ----------

  const handleStepAnswer = (payload) => {
    const isCorrect = payload?.isCorrect === true;
    const skipped = payload?.skipped === true;
    const xpEarned = Number(payload?.xpEarned ?? 0) || 0;

    console.log("[LessonPlayer] Step answered:", {
      index: currentIndex,
      isCorrect,
      skipped,
      xpEarned,
      payload,
    });

    if (xpEarned > 0) {
      setLessonXpEarned((prev) => prev + xpEarned);
    }

    if (!lesson || !lesson.exercises) return;

    const nextIndex = currentIndex + 1;
    const isLast = nextIndex >= lesson.exercises.length;

    // Show the result overlay first, then proceed on user action.
    setResultData({
      isCorrect,
      skipped,
      xpEarned,
      message: payload?.message,
      hearts: payload?.hearts,
    });
    setPendingNext(isLast ? { type: "finish" } : { type: "next", index: nextIndex });
    setResultOpen(true);
  };

  const proceedAfterResult = () => {
    const pn = pendingNext;
    setResultOpen(false);
    setResultData(null);
    setPendingNext(null);

    if (!pn || !lesson || !lesson.exercises) return;
    if (pn.type === "next") {
      setCurrentIndex(pn.index);
      return;
    }
    // finish
    setHasFinishedAll(true);
  };

  // ---------- Load analytics when finished ----------

  useEffect(() => {
    const loadAnalytics = async () => {
      if (!hasFinishedAll) return;
      if (!lesson?.id) return;

      const token = getToken();
      if (!token) return;

      setAnalyticsLoading(true);
      setAnalyticsError(null);

      const url = `${API_BASE}/me/lessons/${lesson.id}/analytics`;
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("[LessonPlayer] Analytics error:", res.status, text);
          setAnalyticsError(`Failed to load analytics (${res.status}).`);
          return;
        }

        const data = await res.json();
        setAnalyticsData(data);
      } catch (err) {
        console.error("[LessonPlayer] Analytics network error:", err);
        setAnalyticsError("Network error when loading analytics.");
      } finally {
        setAnalyticsLoading(false);
      }
    };

    loadAnalytics();
  }, [hasFinishedAll, lesson?.id]);

  // ---------- Per-exercise analytics modal ----------

  const fetchExerciseAnalytics = async (exerciseId) => {
    if (!exerciseId) return;
    const token = getToken();
    if (!token) {
      setExModalError("You need to be logged in to view analytics.");
      return;
    }

    setExModalLoading(true);
    setExModalError(null);

    const url = `${API_BASE}/me/exercises/${exerciseId}/analytics`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("[LessonPlayer] Exercise analytics error:", res.status, text);
        setExModalError(`Failed to load exercise analytics (${res.status}).`);
        return;
      }
      const data = await res.json();
      setExModalData(data);
    } catch (err) {
      console.error("[LessonPlayer] Exercise analytics network error:", err);
      setExModalError("Network error when loading exercise analytics.");
    } finally {
      setExModalLoading(false);
    }
  };

  const openExerciseAnalytics = (ex) => {
    const id = ex?.exercise_id;
    if (!id) return;
    setExModalExerciseId(id);
    setExModalData(null);
    setExModalError(null);
    setExModalOpen(true);
    fetchExerciseAnalytics(id);
  };

  // ---------- Complete lesson ("Done" button) ----------

  const handleCompleteLesson = async () => {
    if (!lesson || !slug) return;

    const token = getToken();
    if (!token) {
      alert("You need to be logged in. (No token found.)");
      console.warn("[LessonPlayer] No token found when completing lesson.");
      navigate("/");
      return;
    }

    setIsCompleting(true);

    const url = `${API_BASE}/lessons/${slug}/complete`;
    console.log("[LessonPlayer] Completing lesson with:", { url });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        // body not required — backend should infer user from JWT
      });

      console.log(
        "[LessonPlayer] Complete lesson response:",
        res.status,
        Object.fromEntries(res.headers.entries())
      );

      if (!res.ok) {
        const text = await res.text();
        console.error("[LessonPlayer] Error completing lesson:", res.status, text);

        if (res.status === 401 || res.status === 403) {
          alert("Session expired or unauthorized. Please log in again.");
          localStorage.removeItem("access_token");
          localStorage.removeItem("hay_token");
          navigate("/");
        } else {
          alert(`Could not complete lesson (status ${res.status}). Check backend logs.`);
        }
        return;
      }

      const stats = await res.json();
      console.log("[LessonPlayer] Updated stats from backend:", stats);

      // Simple approach: go back to dashboard (Dashboard should refetch /me)
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("[LessonPlayer] Network error completing lesson:", err);
      alert("Network error when completing lesson. Check console / backend.");
    } finally {
      setIsCompleting(false);
    }
  };

  // ---------- Render ----------

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading lesson…</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
        <p className="text-red-600 mb-3 text-center">{loadError}</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 bg-orange-600 text-white rounded-xl text-sm"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
        <p className="text-slate-700 mb-3">
          Lesson data is empty. Check the console and backend logs.
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 bg-orange-600 text-white rounded-xl text-sm"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  // "Done" state should appear only after the last exercise is answered.
  const showDoneFooter = !!hasFinishedAll;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div className="text-sm text-slate-600">
            {lesson.title} · Step {currentIndex + 1} of{" "}
            {lesson.exercises?.length || 1}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Per-exercise result panel (shown after each answer) */}
        {resultOpen && resultData ? (
          <div className="fixed inset-x-0 bottom-0 z-50">
            <div className="max-w-4xl mx-auto px-4 pb-4">
              <div
                className={
                  "rounded-2xl border p-4 shadow-xl " +
                  (resultData.isCorrect
                    ? "border-emerald-200 bg-emerald-50"
                    : resultData.skipped
                    ? "border-slate-200 bg-slate-50"
                    : "border-rose-200 bg-rose-50")
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-base font-extrabold text-slate-900">
                      {resultData.isCorrect
                        ? "Correct!"
                        : resultData.skipped
                        ? "Skipped"
                        : "Not quite"}
                    </div>
                    <div className="text-sm text-slate-600">
                      {resultData.isCorrect
                        ? `+${Number(resultData.xpEarned || 0)} XP`
                        : resultData.skipped
                        ? "No XP gained"
                        : "Try the next one — you can retry later."}
                    </div>
                    {Number.isFinite(resultData.hearts) ? (
                      <div className="text-xs text-slate-500">Hearts left: {resultData.hearts}</div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={proceedAfterResult}
                    className={
                      "rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition " +
                      (pendingNext?.type === "finish"
                        ? "bg-orange-600 hover:bg-orange-700"
                        : "bg-slate-900 hover:bg-slate-950")
                    }
                  >
                    {pendingNext?.type === "finish" ? "Done" : "Continue"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">
            {lesson.title}
          </h1>
          {lesson.description && (
            <p className="text-sm text-slate-600">{lesson.description}</p>
          )}
        </div>

        {/* Progress bar */}
        {lesson.exercises && lesson.exercises.length > 0 && (
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 bg-orange-500 transition-all"
              style={{
                width: `${((currentIndex + 1) / lesson.exercises.length) * 100}%`,
              }}
            />
          </div>
        )}

        {/* Current exercise */}
        {!showDoneFooter && currentExercise ? (
          <ExerciseRenderer
            exercise={currentExercise}
            apiBaseUrl={API_BASE}
            onAnswer={handleStepAnswer}
          />
        ) : null}

        {/* If finished, show a clean completion card (no interactive exercise behind it) */}
        {showDoneFooter ? (
          <LessonCompletionScreen
            lesson={lesson}
            sessionXpEarned={lessonXpEarned}
            analytics={analyticsData}
            analyticsLoading={analyticsLoading}
            analyticsError={analyticsError}
            onOpenExercise={openExerciseAnalytics}
            onRetry={async () => {
              const token = getToken();
              if (!token) {
                // not logged in; just restart locally
                setCurrentIndex(0);
                setHasFinishedAll(false);
                setLessonXpEarned(0);
                return;
              }

              const url = `${API_BASE}/me/lessons/${lesson.id}/reset`;
              const res = await fetch(url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              });

              if (!res.ok) {
                const text = await res.text();
                alert(`Could not reset lesson (${res.status}). ${text}`);
                return;
              }

              // restart
              setCurrentIndex(0);
              setHasFinishedAll(false);
              setLessonXpEarned(0);
              setAnalyticsData(null);
              setAnalyticsError(null);
              setAnalyticsLoading(false);
            }}
            onDone={handleCompleteLesson}
            isSaving={isCompleting}
          />
        ) : null}

        {/* Fallback if something is wrong with the lesson data */}
        {!showDoneFooter && !currentExercise ? (
          <div className="bg-white rounded-3xl shadow-md p-6 sm:p-8">
            <p className="text-slate-700 mb-4">
              No exercise found for index {currentIndex}. Check console logs for
              lesson data and exercise kinds.
            </p>
            <button
              onClick={() => navigate("/dashboard")}
              className="px-4 py-2 bg-orange-600 text-white rounded-xl text-sm"
            >
              Back to dashboard
            </button>
          </div>
        ) : null}

        <ExerciseAnalyticsModal
          open={exModalOpen}
          onClose={() => {
            setExModalOpen(false);
            setExModalExerciseId(null);
          }}
          loading={exModalLoading}
          error={exModalError}
          data={exModalData}
          onRetry={() => fetchExerciseAnalytics(exModalExerciseId)}
        />
      </main>
    </div>
  );
}
