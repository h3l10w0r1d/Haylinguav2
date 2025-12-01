// src/LessonPlayer.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, X, Loader2 } from "lucide-react";

const API_BASE = "https://haylinguav2.onrender.com";

export default function LessonPlayer({ token }) {
  const { slug } = useParams();          // e.g. "lesson-1"
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState(null);

  const [index, setIndex] = useState(0); // current exercise index
  const [textAnswer, setTextAnswer] = useState("");
  const [selectedIds, setSelectedIds] = useState([]); // for multi-select
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);

  // Fetch lesson from backend
  useEffect(() => {
    async function loadLesson() {
      try {
        setLoading(true);
        setLoadingError(null);

        const res = await fetch(`${API_BASE}/lessons/${slug}`, {
          headers: token
            ? { Authorization: `Bearer ${token}` }
            : undefined,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.error("Failed to load lesson", res.status, data);
          throw new Error(data.detail || `HTTP ${res.status}`);
        }

        const data = await res.json();
        setLesson(data);
        setIndex(0);
        resetExerciseState();
      } catch (err) {
        console.error("Lesson load error", err);
        setLoadingError(err.message || "Failed to load lesson");
      } finally {
        setLoading(false);
      }
    }

    loadLesson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  function resetExerciseState() {
    setTextAnswer("");
    setSelectedIds([]);
    setSubmitted(false);
    setIsCorrect(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="flex items-center gap-3 text-gray-700">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading lesson…</span>
        </div>
      </div>
    );
  }

  if (loadingError || !lesson) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="max-w-md bg-white rounded-2xl shadow p-6 text-center">
          <p className="text-red-600 mb-4">
            {loadingError || "Lesson not found"}
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white hover:bg-orange-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const exercises = lesson.exercises || [];
  const exercise = exercises[index];

  if (!exercise) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="max-w-md bg-white rounded-2xl shadow p-6 text-center">
          <p className="mb-4">This lesson has no exercises yet.</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white hover:bg-orange-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  // ---------- answer helpers ----------

  function handleOptionToggle(id) {
    if (submitted) return; // lock after submit
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function checkAnswer() {
    let correct = false;

    if (exercise.type === "type-answer" || exercise.type === "fill-blank") {
      const expected = (exercise.expected_answer || "").trim().toLowerCase();
      const user = textAnswer.trim().toLowerCase();
      correct = user === expected;
    } else if (exercise.type === "multi-select") {
      const correctIds = (exercise.options || [])
        .filter((o) => o.is_correct)
        .map((o) => o.id)
        .sort();

      const chosen = [...selectedIds].sort();
      correct =
        correctIds.length === chosen.length &&
        correctIds.every((id, i) => id === chosen[i]);
    }

    setIsCorrect(correct);
    setSubmitted(true);
  }

  function handleNext() {
    const lastIndex = exercises.length - 1;
    if (index < lastIndex) {
      setIndex(index + 1);
      resetExerciseState();
    } else {
      // finished the lesson – back to dashboard for now
      navigate("/dashboard");
    }
  }

  // ---------- TYPE-SPECIFIC RENDERING ----------

  function renderBody() {
    if (exercise.type === "type-answer" || exercise.type === "fill-blank") {
      return (
        <div className="space-y-4">
          {exercise.type === "fill-blank" && (
            <p className="text-gray-700">
              {exercise.sentence_before}
              <span className="inline-block min-w-[4rem] border-b border-dashed border-orange-400 mx-1">
                &nbsp;
              </span>
              {exercise.sentence_after}
            </p>
          )}

          <input
            type="text"
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            disabled={submitted}
            placeholder="Type your answer in Armenian…"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      );
    }

    if (exercise.type === "multi-select") {
      return (
        <div className="grid gap-3 mt-2">
          {(exercise.options || []).map((opt) => {
            const selected = selectedIds.includes(opt.id);
            const base =
              "w-full px-4 py-3 rounded-xl border transition-all text-left";

            let classes = base + " bg-white border-gray-300 hover:border-orange-400";
            if (submitted) {
              if (opt.is_correct && selected) {
                classes = base + " bg-green-50 border-green-500";
              } else if (!opt.is_correct && selected) {
                classes = base + " bg-red-50 border-red-500";
              } else if (opt.is_correct && !selected) {
                classes = base + " bg-yellow-50 border-yellow-500";
              }
            } else if (selected) {
              classes = base + " bg-orange-50 border-orange-500";
            }

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleOptionToggle(opt.id)}
                className={classes}
              >
                {opt.text}
              </button>
            );
          })}
        </div>
      );
    }

    // Fallback for unknown types
    return (
      <p className="text-gray-500">
        This exercise type (&quot;{exercise.type}&quot;) is not implemented yet.
      </p>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white pb-16">
      {/* Top bar */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-1 text-orange-100 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div className="text-sm text-orange-100">
            {index + 1} / {exercises.length} exercises
          </div>
        </div>
      </div>

      {/* Exercise card */}
      <div className="max-w-2xl mx-auto px-4 mt-8">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">
            {lesson.title}
          </h1>
          <p className="text-sm text-gray-500 mb-4">
            Exercise {index + 1} of {exercises.length}
          </p>

          <h2 className="text-lg text-gray-900 mb-4">{exercise.prompt}</h2>

          {renderBody()}

          {/* Feedback */}
          {submitted && (
            <div className="mt-4 flex items-center gap-2">
              {isCorrect ? (
                <>
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="text-green-700 font-medium">
                    Correct! 🎉
                  </span>
                </>
              ) : (
                <>
                  <X className="w-5 h-5 text-red-600" />
                  <span className="text-red-700 font-medium">
                    Not quite. Expected answer:&nbsp;
                    <span className="font-mono">
                      {exercise.expected_answer || "—"}
                    </span>
                  </span>
                </>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="mt-6 flex justify-end gap-3">
            {!submitted && (
              <button
                onClick={checkAnswer}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 text-white hover:bg-orange-700 transition-colors"
              >
                Check answer
                <Check className="w-4 h-4" />
              </button>
            )}

            {submitted && (
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors"
              >
                {index === exercises.length - 1 ? "Finish lesson" : "Next"}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
