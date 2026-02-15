// src/LessonPlayer.jsx
import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";

import ExerciseRenderer from "./ExerciseRenderer";
import Phase2Exercise from "./Phase2Exercise";
import LessonCompletionScreen from "./LessonCompletionScreen";
import ExerciseAnalyticsModal from "./ExerciseAnalyticsModal";
import ExerciseShell from "./ExerciseShell";
import { sfx } from "./lib/sfx";

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



function ReadingSectionCard({ section, userLevel, onNext }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const rate = useMemo(() => {
    const lvl = String(userLevel || '').toLowerCase();
    if (lvl.includes('adv')) return Number(section?.rate_advanced ?? 1.05);
    if (lvl.includes('inter')) return Number(section?.rate_intermediate ?? 1.0);
    return Number(section?.rate_beginner ?? 0.9);
  }, [userLevel, section]);

  const play = async () => {
    try {
      setIsPlaying(true);
      const text = section?.text || '';
      if (!text.trim()) return;

      const res = await fetch(`${API_BASE}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        console.warn('TTS failed', res.status);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = url;
        audioRef.current.playbackRate = rate;
        await audioRef.current.play();
      }
    } finally {
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    // Auto-play once when section mounts (Duolingo-like)
    play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reading</div>
            <h2 className="mt-1 text-lg font-bold">{section?.title || 'Read and listen'}</h2>
          </div>
          <button
            type="button"
            onClick={play}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold hover:bg-slate-100"
            disabled={isPlaying}
          >
            {isPlaying ? 'Playing…' : 'Play'}
          </button>
        </div>

        <div className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-slate-800">
          {section?.text || ''}
        </div>

        <audio ref={audioRef} />

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onNext}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
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
  const [renderNonce, setRenderNonce] = useState(0);
  // True only AFTER the user submits an answer for the LAST exercise.
  // This prevents showing the "Done" state just because we are viewing the last step.
  const [hasFinishedAll, setHasFinishedAll] = useState(false);

  // Phase 2: unified bottom bar controls (provided by Phase2Exercise)
  const [phase2Actions, setPhase2Actions] = useState(null);

  const exerciseStartRef = useRef(Date.now());

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

  const PHASE2_KINDS = useMemo(
    () =>
      new Set([
        "translate_mcq",
        "true_false",
        "fill_blank",
        "letter_typing",
        "word_spelling",
        "sentence_order",
        "char_build_word",
        "letter_recognition",
        "char_mcq_sound",
      ]),
    []
  );

  const isPhase2 = !!currentExercise && PHASE2_KINDS.has(String(currentExercise.kind || "").trim());

  useEffect(() => {
    // reset timer + actions on exercise change
    exerciseStartRef.current = Date.now();
    setPhase2Actions(null);
  }, [currentExercise?.id]);

  async function submitPhase2(payload) {
    // payload: { isCorrect, skipped, answerText, selectedIndices }
    if (!currentExercise?.id) return;
    const token = getToken();
    const timeSpentMs = Date.now() - exerciseStartRef.current;
    const isCorrect = payload?.isCorrect === true;
    const skipped = payload?.skipped === true;
    const answerText = payload?.answerText ?? null;
    const selectedIndices = payload?.selectedIndices ?? null;

    let earnedDelta = 0;
    let hearts = undefined;

    if (token) {
      try {
        const res = await fetch(`${API_BASE}/me/exercises/${currentExercise.id}/attempt`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            is_correct: isCorrect,
            skipped,
            answer_text: answerText,
            selected_indices: selectedIndices,
            ms_spent: timeSpentMs,
          }),
        });

        if (res.ok) {
          const attempt = await res.json();
          earnedDelta = Number(attempt?.earned_xp_delta ?? 0) || 0;
          hearts = Number.isFinite(attempt?.hearts_current)
            ? attempt.hearts_current
            : undefined;
        } else {
          // fallback when backend doesn't respond with delta
          earnedDelta = isCorrect && !skipped ? Number(currentExercise?.xp ?? 0) : 0;
        }
      } catch (e) {
        earnedDelta = isCorrect && !skipped ? Number(currentExercise?.xp ?? 0) : 0;
      }
    } else {
      earnedDelta = isCorrect && !skipped ? Number(currentExercise?.xp ?? 0) : 0;
    }

    handleStepAnswer({
      isCorrect,
      skipped,
      xpEarned: Math.max(0, Math.floor(earnedDelta)),
      hearts,
    });
  }

  // isPhase2 decides if we render the Phase2Exercise (unified bottom bar).

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

        const normalized = { ...data, lesson_type: data.lesson_type || "standard", config: data.config || {} };

        if (String(normalized.lesson_type) === "reading") {
          const rebuilt = buildReadingExercises(normalized);
          normalized.exercises = rebuilt;
        }

        setLesson(normalized);
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

    // Play SFX (after user interaction)
    if (!skipped) {
      if (isCorrect) sfx.correct();
      else sfx.wrong();
    }

    // Phase 2.5: unified result sheet
    // - correct: continue/finish
    // - skipped: continue/finish
    // - wrong: retry same exercise
    setResultData({
      isCorrect,
      skipped,
      xpEarned,
      message: payload?.message,
      hearts: payload?.hearts,
    });

    if (!skipped && !isCorrect) {
      setPendingNext({ type: "retry" });
    } else {
      setPendingNext(isLast ? { type: "finish" } : { type: "next", index: nextIndex });
    }
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
    if (pn.type === "retry") {
      // Re-mount the exercise component so local selection/input state resets.
      exerciseStartRef.current = Date.now();
      setPhase2Actions(null);
      setRenderNonce((n) => n + 1);
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
  const totalSteps = lesson.exercises?.length || 1;

  return (
    <ExerciseShell
      title={lesson.title}
      step={Math.min(currentIndex + 1, totalSteps)}
      total={totalSteps}
      onBack={() => navigate("/dashboard")}
      primaryLabel={!showDoneFooter && isPhase2 && !resultOpen ? (phase2Actions?.primaryLabel ?? "Check") : null}
      primaryDisabled={!showDoneFooter && isPhase2 && !resultOpen ? !phase2Actions?.canCheck : null}
      onPrimary={!showDoneFooter && isPhase2 && !resultOpen ? phase2Actions?.onCheck : null}
      secondaryLabel={!showDoneFooter && isPhase2 && !resultOpen ? (phase2Actions?.secondaryLabel ?? "Skip") : null}
      secondaryDisabled={!showDoneFooter && isPhase2 && !resultOpen ? false : null}
      onSecondary={!showDoneFooter && isPhase2 && !resultOpen ? phase2Actions?.onSkip : null}
      result={
        resultOpen && resultData
          ? {
              variant: resultData.isCorrect
                ? "correct"
                : resultData.skipped
                ? "skipped"
                : "wrong",
              xpEarned: resultData.xpEarned,
              subtext:
                Number.isFinite(resultData.hearts)
                  ? `Hearts left: ${resultData.hearts}`
                  : null,
              detail: resultData.message || null,
              primaryLabel:
                pendingNext?.type === "finish"
                  ? "Finish"
                  : pendingNext?.type === "retry"
                  ? "Try again"
                  : "Continue",
            }
          : null
      }
      onResultPrimary={proceedAfterResult}
    >
        {/* Current exercise */}
        {!showDoneFooter && currentExercise ? (
          isPhase2 ? (
            <Phase2Exercise
              key={`${currentExercise.id}:${renderNonce}`}
              exercise={currentExercise}
              registerActions={setPhase2Actions}
              submit={submitPhase2}
            />
          ) : (
            <ExerciseRenderer
              exercise={currentExercise}
              apiBaseUrl={API_BASE}
              onAnswer={handleStepAnswer}
            />
          )
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
    </ExerciseShell>
  );
}
