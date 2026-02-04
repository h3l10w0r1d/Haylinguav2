// src/LessonPlayer.jsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";

import ExerciseRenderer from "./ExerciseRenderer";

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
  // True only AFTER the user submits an answer for the LAST exercise.
  // This prevents showing the "Done" state just because we are viewing the last step.
  const [hasFinishedAll, setHasFinishedAll] = useState(false);

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
        setHasFinishedAll(false);
        setLessonXpEarned(0);

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

  const handleStepAnswer = ({ isCorrect, xpEarned }) => {
    console.log("[LessonPlayer] Step answered:", {
      index: currentIndex,
      isCorrect,
      xpEarned,
    });

    if (xpEarned && xpEarned > 0) {
      setLessonXpEarned((prev) => prev + xpEarned);
    }

    if (!lesson || !lesson.exercises) return;

    const nextIndex = currentIndex + 1;
    if (nextIndex < lesson.exercises.length) {
      setCurrentIndex(nextIndex);
    } else {
      // The last exercise was just answered.
      setHasFinishedAll(true);
      console.log(
        "[LessonPlayer] Reached last exercise, showing Done state. XP earned in session:",
        lessonXpEarned + (xpEarned || 0)
      );
    }
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

            // New-style callback
            onAnswer={handleStepAnswer}

            // Old-style compatibility callbacks
            onCorrect={() => handleStepAnswer({ isCorrect: true, xpEarned: 0 })}
            onWrong={(message) =>
              handleStepAnswer({ isCorrect: false, xpEarned: 0, message })
            }
            onSkip={() =>
              handleStepAnswer({ skipped: true, isCorrect: true, xpEarned: 0 })
            }
          />
        ) : null}

        {/* If finished, show a clean completion card (no interactive exercise behind it) */}
        {showDoneFooter ? (
          <div className="w-full max-w-3xl mx-auto px-4 py-10">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 text-center">
              <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center text-white shadow-md">
                <span className="text-4xl">🏆</span>
              </div>

              <h1 className="mt-5 text-3xl font-extrabold text-slate-900">Lesson Complete!</h1>
              <p className="mt-1 text-slate-500">Great job! You're making amazing progress.</p>

              <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-2xl font-extrabold text-orange-600">+{lessonXpEarned}</div>
                  <div className="text-xs text-slate-500 mt-1">XP earned</div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-2xl font-extrabold text-slate-900">
                    {attemptedCount ? Math.round((correctCount / attemptedCount) * 100) : 0}%
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Accuracy</div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-2xl font-extrabold text-slate-900">
                    {correctCount}/{attemptedCount || 0}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Correct</div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-emerald-700 text-sm font-semibold">
                ✨ Keep it up — you're getting better every lesson!
              </div>

              <button
                onClick={handleCompleteLesson}
                disabled={isCompleting}
                className="mt-7 w-full sm:w-auto inline-flex items-center justify-center px-10 py-4 rounded-2xl text-sm md:text-base font-extrabold text-white bg-gradient-to-r from-orange-500 to-rose-500 hover:opacity-95 shadow-md disabled:opacity-60 disabled:cursor-wait"
              >
                {isCompleting ? "Saving…" : "Continue Learning →"}
              </button>
            </div>
          </div>
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
      </main>
    </div>
  );
}
