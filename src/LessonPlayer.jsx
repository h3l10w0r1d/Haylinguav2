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

  const isLastStep =
    lesson.exercises && currentIndex >= lesson.exercises.length - 1;

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
        {currentExercise ? (
          <ExerciseRenderer
            exercise={currentExercise}
            apiBaseUrl={API_BASE}

            // New-style callback
            onAnswer={handleStepAnswer}

            // Old-style compatibility callbacks
            onCorrect={() => handleStepAnswer({ isCorrect: true, xpEarned: 0 })}
            onWrong={(message) => handleStepAnswer({ isCorrect: false, xpEarned: 0, message })}
            onSkip={() => handleStepAnswer({ skipped: true, isCorrect: true, xpEarned: 0 })}
          />
        ) : (
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
        )}

        {/* Done footer when at last step */}
        {isLastStep && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-emerald-900">
                  You reached the end!
                </p>
                <p className="text-xs text-emerald-700">
                  XP this session (from individual steps): {lessonXpEarned}
                </p>
              </div>
            </div>
            <button
              onClick={handleCompleteLesson}
              disabled={isCompleting}
              className="w-full sm:w-auto px-5 py-2 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-60 disabled:cursor-wait transition-colors"
            >
              {isCompleting ? "Saving…" : "Done"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
