// src/CheckpointPlayer.jsx — Unit checkpoint test
import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ShieldCheck, RotateCcw, ArrowRight } from "lucide-react";
import ExerciseRenderer from "./ExerciseRenderer";
import ExerciseShell from "./ExerciseShell";
import { sfx } from "./lib/sfx";
import { readHearts, writeHearts } from "./lib/hearts";
import OutOfHearts from "./OutOfHearts";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("hay_token") || "";
}

function deriveCorrectAnswer(exercise) {
  if (!exercise) return null;
  if (exercise.expected_answer) return String(exercise.expected_answer);
  const correct = (exercise.options || []).find((o) => o.is_correct);
  return correct ? correct.text : null;
}

const INSTRUCTIONS = {
  translation: "Translate this sentence",
  multiple_choice: "Choose the correct answer",
  word_bank: "Arrange the words to form the sentence",
  fill_blank: "Fill in the blank",
  listening: "Listen and type what you hear",
  matching: "Match the pairs",
  speaking: "Speak the sentence",
  image_choice: "Choose the image that matches",
  word_image_match: "Match the word to the image",
  sentence_order: "Put the words in the right order",
};

export default function CheckpointPlayer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const unitTitle = searchParams.get("title") || "Unit";
  const lessonIds = searchParams.get("lessons") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exerciseQueue, setExerciseQueue] = useState([]);
  const [originalTotal, setOriginalTotal] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [comboStreak, setComboStreak] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [phase, setPhase] = useState("loading");
  const [renderNonce, setRenderNonce] = useState(0);
  const exerciseStartRef = useRef(Date.now());
  const pendingNextRef = useRef(null);

  const [heartsState, setHeartsState] = useState(readHearts);
  useEffect(() => {
    const onEvt = (e) => { if (e?.detail) setHeartsState(e.detail); };
    const onStorage = () => setHeartsState(readHearts());
    window.addEventListener("hay_hearts", onEvt);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener("hay_hearts", onEvt); window.removeEventListener("storage", onStorage); };
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) { navigate("/login"); return; }
    if (!lessonIds) { setError("No lessons specified."); setLoading(false); return; }

    let cancelled = false;
    const delays = [0, 2000, 5000]; // retry after 2s then 5s on network failure

    async function load() {
      for (let i = 0; i < delays.length; i++) {
        if (cancelled) return;
        if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
        if (cancelled) return;
        try {
          const res = await fetch(
            `${API_BASE}/me/checkpoint?lesson_ids=${encodeURIComponent(lessonIds)}&count=15`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!res.ok) {
            if (res.status === 401) throw new Error("Session expired — please log in again");
            throw new Error(`Failed to load checkpoint (${res.status})`);
          }
          const data = await res.json();
          if (cancelled) return;
          const exs = data.exercises || [];
          if (exs.length === 0) { setError(data.message || "No exercises found for this unit."); setLoading(false); return; }
          setExerciseQueue(exs);
          setOriginalTotal(exs.length);
          setPhase("playing");
          setLoading(false);
          return;
        } catch (e) {
          if (i === delays.length - 1) {
            if (!cancelled) { setError("Could not reach the server. Please check your connection and try again."); setLoading(false); }
          }
          // else retry
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [lessonIds]);

  const outOfHearts = !hasAnswered && !!heartsState && !heartsState.is_premium && Number(heartsState.current) <= 0;
  const currentExercise = exerciseQueue[0] || null;
  const completedSteps = originalTotal - exerciseQueue.length;
  const instruction = currentExercise ? (INSTRUCTIONS[currentExercise.kind] ?? null) : null;

  // Accuracy tracking for pass/fail
  const totalAnswered = useRef(0);
  const totalCorrect = useRef(0);
  // CP-1: first-attempt accuracy (retries don't inflate the score)
  const firstAttemptCorrect = useRef(0);
  const answeredOnce = useRef(new Set());

  // CP-2: exerciseKey to reset hasAnswered even when the same ID is requeued
  const [exerciseKey, setExerciseKey] = useState(0);
  useEffect(() => { setHasAnswered(false); }, [exerciseKey]);

  function gradeAndAdvance(payload) {
    // Guard against a stale async onAnswer (e.g. handleAnswer's server round
    // trip resolving after Skip already advanced synchronously) re-grading an
    // exercise that's already been resolved — mirrors LessonPlayer's
    // handleStepAnswer guard.
    if (hasAnswered) return;
    const isCorrect = payload?.isCorrect === true;
    const autoAdvance = payload?.autoAdvance === true;
    const xp = Number(payload?.xpEarned ?? 0) || 0;

    // char_intro and other always-correct exercises pass autoAdvance=true — skip
    // the result sheet and don't touch attempt/heart state (nothing to grade).
    if (autoAdvance) {
      setExerciseQueue((q) => {
        const next = q.slice(1);
        if (next.length === 0) setPhase("done");
        return next;
      });
      exerciseStartRef.current = Date.now();
      setRenderNonce((n) => n + 1);
      return;
    }

    // ExerciseRenderer's own internal handleAnswer already POSTed this attempt
    // to /me/exercises/{id}/attempt with the real selected_indices and got back
    // the server-authoritative verdict (payload._synced marks this). This used
    // to re-POST a second time here with a different, incomplete shape — no
    // selected_indices at all — which silently overrode a correct answer with
    // an incorrect one for every choice-based exercise kind. Trust the payload.
    const serverCorrect = isCorrect;

    if (payload?.hearts !== undefined && payload.hearts !== null) {
      const h = heartsState || {};
      const next = { ...h, current: payload.hearts, is_premium: h.is_premium };
      writeHearts(next);
      window.dispatchEvent(new CustomEvent("hay_hearts", { detail: next }));
    }

    totalAnswered.current += 1;
    // CP-1: track first-attempt correctness only
    const isFirstAttempt = !answeredOnce.current.has(currentExercise?.id);
    if (isFirstAttempt) {
      answeredOnce.current.add(currentExercise?.id);
      if (serverCorrect) firstAttemptCorrect.current += 1;
    }

    const combo = serverCorrect ? comboStreak + 1 : 0;
    setComboStreak(combo);

    if (!serverCorrect) {
      setMistakes((m) => m + 1);
      sfx.wrong();
      setResultData({
        variant: "wrong",
        xpEarned: 0,
        correctAnswer: payload?.correctAnswer || deriveCorrectAnswer(currentExercise),
        combo,
      });
      pendingNextRef.current = { type: "requeue" };
    } else {
      totalCorrect.current += 1;
      sfx.correct();
      setXpEarned((x) => x + (xp || 0));
      setResultData({ variant: "correct", xpEarned: xp || 0, combo });
      pendingNextRef.current = { type: "advance" };
    }
    setHasAnswered(true);
  }

  function proceedAfterResult() {
    const pn = pendingNextRef.current;
    pendingNextRef.current = null;
    setResultData(null);

    if (pn?.type === "requeue") {
      setExerciseQueue((q) => {
        const rest = q.slice(1);
        const gap = Math.min(2, rest.length);
        return [...rest.slice(0, gap), q[0], ...rest.slice(gap)];
      });
      setExerciseKey((k) => k + 1); // CP-2: reset hasAnswered even for same ID
      exerciseStartRef.current = Date.now();
      setRenderNonce((n) => n + 1);
      return;
    }

    setExerciseQueue((q) => {
      const next = q.slice(1);
      if (next.length === 0) setPhase("done");
      return next;
    });
    setExerciseKey((k) => k + 1); // CP-2: reset hasAnswered for next exercise
    exerciseStartRef.current = Date.now();
    setRenderNonce((n) => n + 1);
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="font-bold text-cardinal-600">{error}</p>
        <button className="btn3d btn3d-brand" onClick={() => navigate("/dashboard")}>Back to Dashboard</button>
      </div>
    );
  }

  if (phase === "done") {
    const accuracy = originalTotal > 0 ? Math.round((firstAttemptCorrect.current / originalTotal) * 100) : 0;
    const passed = accuracy >= 70;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-brand-50 to-white p-8 text-center">
        <div className={`flex h-24 w-24 items-center justify-center rounded-full ${passed ? "bg-grass-100" : "bg-cardinal-50"}`}>
          <ShieldCheck className={`h-12 w-12 ${passed ? "text-grass-600" : "text-cardinal-500"}`} />
        </div>
        <div>
          <div className="font-display text-3xl font-extrabold text-slate-800">
            {passed ? "Checkpoint Passed!" : "Keep Practicing"}
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-500">
            {unitTitle} · {accuracy}% accuracy
          </div>
          {!passed && (
            <div className="mt-1 text-sm text-slate-400">70% needed to pass</div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <div className="font-display text-2xl font-extrabold text-grass-600">{totalCorrect.current}</div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Correct</div>
          </div>
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <div className="font-display text-2xl font-extrabold text-gold-500">+{xpEarned} XP</div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Earned</div>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="btn3d btn3d-neutral" onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4" /> Retry
          </button>
          <button className="btn3d btn3d-brand" onClick={() => navigate("/dashboard")}>
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (outOfHearts) {
    return <OutOfHearts onBack={() => navigate("/dashboard")} />;
  }

  return (
    <ExerciseShell
      title={`${unitTitle} Checkpoint`}
      step={completedSteps}
      total={originalTotal}
      onBack={() => navigate("/dashboard")}
      instruction={instruction}
      result={resultData}
      onResultPrimary={proceedAfterResult}
      exerciseId={currentExercise?.id}
      lessonId={currentExercise?.lesson_id}
    >
      {currentExercise ? (
        <ExerciseRenderer
          key={`${currentExercise.id}-${renderNonce}`}
          exercise={currentExercise}
          lesson={{ id: currentExercise.lesson_id, exercises: exerciseQueue }}
          onSkip={() => {
            // CP-3: skips count as wrong attempts in accuracy
            totalAnswered.current += 1;
            if (!answeredOnce.current.has(currentExercise?.id)) {
              answeredOnce.current.add(currentExercise?.id);
              // not correct, so firstAttemptCorrect stays unchanged
            }
            setResultData({ variant: "skipped", xpEarned: 0, combo: 0 });
            pendingNextRef.current = { type: "advance" };
            setHasAnswered(true);
          }}
          onAnswer={gradeAndAdvance}
          graded={hasAnswered}
        />
      ) : null}
    </ExerciseShell>
  );
}
