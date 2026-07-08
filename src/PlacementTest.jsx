// src/PlacementTest.jsx — Adaptive binary-search placement test
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Target, ChevronRight, ArrowRight, CheckCircle } from "lucide-react";
import ExerciseRenderer from "./ExerciseRenderer";
import ExerciseShell from "./ExerciseShell";
import { sfx } from "./lib/sfx";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
const MAX_ROUNDS = 5;
const EXERCISES_PER_ROUND = 3;
const PASS_THRESHOLD = 2; // out of 3

function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("hay_token") || "";
}

function deriveCorrectAnswer(exercise) {
  if (!exercise) return null;
  if (exercise.expected_answer) return String(exercise.expected_answer);
  return (exercise.options || []).find((o) => o.is_correct)?.text ?? null;
}

const INSTRUCTIONS = {
  translation: "Translate this sentence",
  multiple_choice: "Choose the correct answer",
  word_bank: "Arrange the words",
  fill_blank: "Fill in the blank",
  listening: "Listen and type",
  matching: "Match the pairs",
  sentence_order: "Put the words in order",
};

export default function PlacementTest() {
  const navigate = useNavigate();

  // ── Unit list ──────────────────────────────────────────────────────────────
  const [units, setUnits] = useState(null); // null = loading
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { navigate("/login"); return; }
    fetch(`${API_BASE}/me/lessons/progress`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((lessons) => {
        // Group into units (same logic as Dashboard)
        const groups = new Map();
        lessons.forEach((l) => {
          const hasChapter = l.chapter_id != null;
          const key = hasChapter ? `c${l.chapter_id}` : `l${Number(l.level ?? 1)}`;
          if (!groups.has(key)) {
            groups.set(key, {
              key,
              title: hasChapter ? l.chapter_title || "Chapter" : `Chapter ${Number(l.level ?? 1)}`,
              position: hasChapter ? Number(l.chapter_position ?? 9999) : Number(l.level ?? 1),
              items: [],
            });
          }
          groups.get(key).items.push(l);
        });
        const sorted = [...groups.values()].sort((a, b) => a.position - b.position);
        if (sorted.length < 2) {
          // Not enough units to test — send to dashboard
          navigate("/dashboard");
          return;
        }
        setUnits(sorted);
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  // ── Bisect state ───────────────────────────────────────────────────────────
  const [low, setLow] = useState(0);
  const [high, setHigh] = useState(null); // set after units load
  const [round, setRound] = useState(0);
  const [history, setHistory] = useState([]); // [{ unitTitle, passed }]

  // Current mid (unit index being tested this round)
  const mid = high !== null ? Math.floor((low + high) / 2) : null;
  const converged = high !== null && low > high;

  // ── Exercise state ─────────────────────────────────────────────────────────
  const [exercises, setExercises] = useState(null); // null = loading round
  const [queueIdx, setQueueIdx] = useState(0);       // which exercise in the 3
  const [roundCorrect, setRoundCorrect] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [renderNonce, setRenderNonce] = useState(0);
  const exerciseStartRef = useRef(Date.now());

  // ── Init bisect once units are loaded ──────────────────────────────────────
  useEffect(() => {
    if (!units) return;
    setHigh(units.length - 1);
  }, [units]);

  // ── Load exercises for current mid ────────────────────────────────────────
  useEffect(() => {
    if (units === null || mid === null || converged) return;
    setExercises(null);
    setQueueIdx(0);
    setRoundCorrect(0);
    setHasAnswered(false);
    setResultData(null);
    setRenderNonce((n) => n + 1);

    const unit = units[mid];
    const lessonIds = unit.items.map((l) => l.id).filter((id) => id != null).join(",");
    if (!lessonIds) {
      // Unit has no lesson IDs → treat as passed (skip upward)
      advanceBisect(true, unit.title);
      return;
    }

    fetch(`${API_BASE}/me/checkpoint?lesson_ids=${encodeURIComponent(lessonIds)}&count=${EXERCISES_PER_ROUND}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const exs = (data.exercises || []).slice(0, EXERCISES_PER_ROUND);
        if (exs.length === 0) {
          advanceBisect(true, unit.title); // no exercises → treat as passed
          return;
        }
        setExercises(exs);
        exerciseStartRef.current = Date.now();
      })
      .catch(() => advanceBisect(true, unit.title));
  }, [mid, converged, units]);

  function advanceBisect(passed, unitTitle) {
    setHistory((h) => [...h, { unitTitle, passed }]);
    const nextRound = round + 1;
    setRound(nextRound);

    if (passed) {
      setLow(mid + 1);
    } else {
      setHigh(mid - 1);
    }
  }

  // ── Grading ───────────────────────────────────────────────────────────────
  async function gradeAnswer({ isCorrect, answerText }) {
    if (hasAnswered) return;

    const exercise = exercises?.[queueIdx];
    const token = getToken();
    let serverCorrect = isCorrect;

    if (exercise && token) {
      try {
        const res = await fetch(`${API_BASE}/me/exercises/${exercise.id}/attempt`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            answer_text: answerText || "",
            time_spent_ms: Date.now() - exerciseStartRef.current,
          }),
        });
        if (res.ok) {
          const d = await res.json();
          serverCorrect = Boolean(d.is_correct);
        }
      } catch {}
    }

    if (serverCorrect) sfx.correct();
    else sfx.wrong();

    const newCorrect = roundCorrect + (serverCorrect ? 1 : 0);
    setRoundCorrect(newCorrect);
    setHasAnswered(true);
    setResultData({
      variant: serverCorrect ? "correct" : "wrong",
      xpEarned: 0,
      correctAnswer: serverCorrect ? null : deriveCorrectAnswer(exercise),
      combo: 0,
    });
  }

  function proceedAfterResult() {
    setResultData(null);
    setHasAnswered(false);

    const isLastExercise = queueIdx >= (exercises?.length ?? 0) - 1;

    if (isLastExercise) {
      // Round complete — evaluate and advance bisect
      const passed = roundCorrect + (resultData?.variant === "correct" ? 0 : 0) >= PASS_THRESHOLD;
      // roundCorrect already includes this answer (set before proceedAfterResult)
      advanceBisect(roundCorrect >= PASS_THRESHOLD, units[mid].title);
    } else {
      setQueueIdx((i) => i + 1);
      exerciseStartRef.current = Date.now();
      setRenderNonce((n) => n + 1);
    }
  }

  // ── Save placement and go to dashboard ────────────────────────────────────
  const [saving, setSaving] = useState(false);

  async function confirmPlacement() {
    setSaving(true);
    const placementUnitIdx = Math.min(low, units.length - 1);
    // Collect all lesson IDs from units before placement point
    const lessonIds = units.slice(0, placementUnitIdx).flatMap((u) =>
      u.items.map((l) => l.id).filter((id) => id != null)
    );

    if (lessonIds.length > 0) {
      try {
        await fetch(`${API_BASE}/me/placement`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ lesson_ids: lessonIds }),
        });
      } catch {}
    }
    navigate("/dashboard");
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="font-bold text-cardinal-600">{loadError}</p>
        <button className="btn3d btn3d-brand" onClick={() => navigate("/dashboard")}>Skip test</button>
      </div>
    );
  }

  if (!units || high === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  // ── Result / confirmation screen ──────────────────────────────────────────
  if (converged || round >= MAX_ROUNDS) {
    const placementIdx = Math.min(low, units.length - 1);
    const placementUnit = units[placementIdx];
    const isBeginning = placementIdx === 0;
    const isEnd = placementIdx >= units.length - 1 && low >= units.length;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-brand-50 to-white p-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100">
          <Target className="h-10 w-10 text-brand-600" />
        </div>

        <div>
          <div className="font-display text-3xl font-extrabold text-slate-800">Level found!</div>
          <div className="mt-2 text-lg font-semibold text-slate-500">
            {isBeginning
              ? "Start from the very beginning — welcome!"
              : isEnd
              ? "Impressive! You'll start from the most advanced unit."
              : `We'll place you at:`}
          </div>
          {!isBeginning && !isEnd && (
            <div className="mt-3 rounded-2xl bg-white px-6 py-4 ring-1 ring-brand-200 shadow-sm">
              <div className="font-display text-2xl font-extrabold text-brand-700">{placementUnit.title}</div>
              <div className="text-sm font-semibold text-slate-500 mt-1">Unit {placementIdx + 1} of {units.length}</div>
            </div>
          )}
        </div>

        {/* Round history */}
        {history.length > 0 && (
          <div className="w-full max-w-xs space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-white px-4 py-2 ring-1 ring-slate-100 text-sm font-semibold">
                <CheckCircle className={`h-4 w-4 shrink-0 ${h.passed ? "text-grass-500" : "text-slate-300"}`} />
                <span className="truncate text-slate-700">{h.unitTitle}</span>
                <span className={`ml-auto text-xs font-bold ${h.passed ? "text-grass-600" : "text-slate-400"}`}>
                  {h.passed ? "Passed" : "Too hard"}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button className="btn3d btn3d-neutral" onClick={() => navigate("/dashboard")} disabled={saving}>
            Skip
          </button>
          <button className="btn3d btn3d-brand" onClick={confirmPlacement} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Start here <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      </div>
    );
  }

  // ── Loading exercises for next round ──────────────────────────────────────
  if (!exercises) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        <p className="font-semibold text-slate-500">Checking {units[mid]?.title}…</p>
      </div>
    );
  }

  // ── Exercise round ────────────────────────────────────────────────────────
  const currentExercise = exercises[queueIdx];
  const instruction = currentExercise ? (INSTRUCTIONS[currentExercise.kind] ?? null) : null;
  // Progress = fraction of search space eliminated, visualised as rounds / MAX_ROUNDS
  const progressPct = Math.round((round / MAX_ROUNDS) * 100);

  return (
    <ExerciseShell
      title={`Placement · Round ${round + 1} of ${MAX_ROUNDS}`}
      step={round}
      total={MAX_ROUNDS}
      onBack={() => navigate("/dashboard")}
      instruction={instruction}
      result={resultData}
      onResultPrimary={proceedAfterResult}
      exerciseId={currentExercise?.id}
      lessonId={currentExercise?.lesson_id}
    >
      {/* Unit label */}
      <div className="mb-4 flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-2.5 ring-1 ring-brand-100">
        <Target className="h-4 w-4 shrink-0 text-brand-500" />
        <span className="text-sm font-extrabold text-brand-700">Testing: {units[mid]?.title}</span>
        <span className="ml-auto text-xs font-bold text-brand-400">{queueIdx + 1}/{exercises.length}</span>
      </div>

      {currentExercise ? (
        <ExerciseRenderer
          key={`${currentExercise.id}-${renderNonce}`}
          exercise={currentExercise}
          lesson={{ id: currentExercise.lesson_id, exercises }}
          onCorrect={({ answerText }) => gradeAnswer({ isCorrect: true, answerText })}
          onWrong={({ answerText }) => gradeAnswer({ isCorrect: false, answerText })}
          onSkip={() => gradeAnswer({ isCorrect: false, answerText: "" })}
          onAnswer={({ isCorrect, answerText }) => gradeAnswer({ isCorrect, answerText })}
          submit={({ isCorrect, answerText }) => gradeAnswer({ isCorrect, answerText })}
          graded={hasAnswered}
        />
      ) : null}
    </ExerciseShell>
  );
}
