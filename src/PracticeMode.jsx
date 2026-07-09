// src/PracticeMode.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Dumbbell } from "lucide-react";
import ExerciseRenderer from "./ExerciseRenderer";
import ExerciseShell from "./ExerciseShell";
import LessonCompletionScreen from "./LessonCompletionScreen";
import { sfx } from "./lib/sfx";
import { readHearts, writeHearts } from "./lib/hearts";
import OutOfHearts from "./OutOfHearts";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("hay_token") || "";
}

function deriveCorrectAnswer(exercise) {
  if (!exercise) return null;
  const cfg = exercise.config || {};
  const opts = exercise.options || [];
  if (exercise.expected_answer) return String(exercise.expected_answer);
  const correct = opts.find((o) => o.is_correct);
  if (correct) return correct.text;
  return null;
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
};

export default function PracticeMode() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exerciseQueue, setExerciseQueue] = useState([]);
  const [originalTotal, setOriginalTotal] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [comboStreak, setComboStreak] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [phase, setPhase] = useState("loading"); // loading | playing | done | empty
  const [renderNonce, setRenderNonce] = useState(0);
  const exerciseStartRef = useRef(Date.now());
  const pendingNextRef = useRef(null);
  // PM-2: exerciseKey to reset hasAnswered even when same exercise ID is requeued
  const [exerciseKey, setExerciseKey] = useState(0);
  useEffect(() => { setHasAnswered(false); }, [exerciseKey]);

  useEffect(() => {
    const token = getToken();
    if (!token) { navigate("/login"); return; }
    fetch(`${API_BASE}/me/practice`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) {
          if (r.status === 401) throw new Error("Session expired — please log in again");
          throw new Error(`Failed to load practice (${r.status})`);
        }
        return r.json();
      })
      .then((data) => {
        const exs = data.exercises || [];
        if (exs.length === 0) { setPhase("empty"); return; }
        setExerciseQueue(exs);
        setOriginalTotal(exs.length);
        setPhase("playing");
      })
      .catch((e) => { setError(e.message); })
      .finally(() => setLoading(false));
  }, []);

  const [heartsState, setHeartsState] = useState(readHearts);
  useEffect(() => {
    const onEvt = (e) => { if (e?.detail) setHeartsState(e.detail); };
    const onStorage = () => setHeartsState(readHearts());
    window.addEventListener("hay_hearts", onEvt);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener("hay_hearts", onEvt); window.removeEventListener("storage", onStorage); };
  }, []);
  const outOfHearts = !hasAnswered && !!heartsState && !heartsState.is_premium && Number(heartsState.current) <= 0;

  const currentExercise = exerciseQueue[0] || null;
  const completedSteps = originalTotal - exerciseQueue.length;
  const instruction = currentExercise ? (INSTRUCTIONS[currentExercise.kind] ?? null) : null;

  async function gradeAndAdvance({ isCorrect, answerText, xpEarned: xp, autoAdvance, selectedIndices, _synced }) {
    if (hasAnswered) return; // guard against double-fire
    // char_intro and similar always-correct exercises — skip result sheet and API call
    if (autoAdvance) {
      setExerciseQueue((q) => {
        const next = q.slice(1);
        if (next.length === 0) setPhase("done"); // PM-3: detect queue empty
        return next;
      });
      setExerciseKey((k) => k + 1); // PM-2: reset hasAnswered
      exerciseStartRef.current = Date.now();
      setRenderNonce((n) => n + 1);
      return;
    }

    const token = getToken();
    let serverCorrect = isCorrect;
    // Skip re-posting if ExerciseRenderer's handleAnswer already synced this attempt.
    if (!_synced && currentExercise && token) {
      try {
        const res = await fetch(`${API_BASE}/me/exercises/${currentExercise.id}/attempt`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            answer_text: answerText || "",
            selected_indices: selectedIndices ?? null,
            time_spent_ms: Date.now() - exerciseStartRef.current,
          }),
        });
        if (res.ok) {
          const d = await res.json();
          serverCorrect = Boolean(d.is_correct);
          if (d.hearts_current !== undefined) {
            const h = heartsState || {};
            const next = { ...h, current: d.hearts_current, is_premium: d.is_premium ?? h.is_premium };
            writeHearts(next);
            window.dispatchEvent(new CustomEvent("hay_hearts", { detail: next }));
          }
        }
      } catch {}
    }

    const combo = serverCorrect ? comboStreak + 1 : 0;
    setComboStreak(combo);

    if (!serverCorrect) {
      setMistakes((m) => m + 1);
      sfx.wrong();
      setResultData({
        variant: "wrong",
        xpEarned: 0,
        correctAnswer: deriveCorrectAnswer(currentExercise),
        combo,
      });
      pendingNextRef.current = { type: "requeue" };
    } else {
      sfx.correct();
      setXpEarned((x) => x + (xp || 0));
      setResultData({
        variant: "correct",
        xpEarned: xp || 0,
        combo,
      });
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
      setExerciseKey((k) => k + 1); // PM-2: reset hasAnswered even for same ID
      exerciseStartRef.current = Date.now();
      setRenderNonce((n) => n + 1);
      return;
    }

    // advance
    setExerciseQueue((q) => {
      const next = q.slice(1);
      if (next.length === 0) {
        setPhase("done");
      }
      return next;
    });
    setExerciseKey((k) => k + 1); // PM-2: reset hasAnswered for next exercise
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
        <p className="font-bold text-cardinal-600">Failed to load practice: {error}</p>
        <button className="btn3d btn3d-brand" onClick={() => navigate("/dashboard")}>Back to Dashboard</button>
      </div>
    );
  }

  if (phase === "empty") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <Dumbbell className="h-16 w-16 text-slate-300" />
        <h2 className="font-display text-2xl font-extrabold text-slate-700">All caught up!</h2>
        <p className="text-slate-500">You have no exercises due for review. Come back later.</p>
        <button className="btn3d btn3d-brand mt-2" onClick={() => navigate("/dashboard")}>Back to Dashboard</button>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <LessonCompletionScreen
        lesson={{ title: "Practice Session", xp: xpEarned }}
        xpEarned={xpEarned}
        mistakes={mistakes}
        totalExercises={originalTotal}
        onContinue={() => navigate("/dashboard")}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (outOfHearts) {
    return <OutOfHearts onBack={() => navigate("/dashboard")} />;
  }

  return (
    <ExerciseShell
      title="Practice"
      step={completedSteps}
      total={originalTotal}
      onBack={() => navigate("/dashboard")}
      instruction={instruction}
      primaryLabel={hasAnswered ? undefined : undefined}
      primaryDisabled={false}
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
            setResultData({ variant: "skipped", xpEarned: 0, combo: 0 });
            pendingNextRef.current = { type: "advance" };
            setHasAnswered(true);
          }}
          onAnswer={({ isCorrect, answerText, xpEarned: xp, autoAdvance, selectedIndices, _synced } = {}) =>
            gradeAndAdvance({ isCorrect, answerText, xpEarned: xp, autoAdvance, selectedIndices, _synced })
          }
          graded={hasAnswered}
        />
      ) : null}
    </ExerciseShell>
  );
}
