// src/PlacementTest.jsx — Adaptive binary-search placement test
import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Target, ArrowRight, CheckCircle } from "lucide-react";
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

// ── Phase machine ─────────────────────────────────────────────────────────────
// "loading-units" → "loading-round" → "testing" → ("result" screen per exercise)
//   → "loading-round" (next round) or "done"

export default function PlacementTest() {
  const navigate = useNavigate();

  // ── Unit list ──────────────────────────────────────────────────────────────
  const [units, setUnits] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // ── Bisect — stored in a ref so closures always read fresh values ──────────
  const bisectRef = useRef({ low: 0, high: 0 });
  // PT-3: track consecutive empty-unit skips to avoid infinite recursion
  const emptySkipCountRef = useRef(0);

  // ── Round state (explicit, not derived) ───────────────────────────────────
  const [phase, setPhase] = useState("loading-units"); // loading-units | loading-round | testing | done
  const [currentUnitIdx, setCurrentUnitIdx] = useState(null);
  const [round, setRound] = useState(0);
  const [history, setHistory] = useState([]);

  // ── Exercise state ─────────────────────────────────────────────────────────
  const [exercises, setExercises] = useState([]);
  const [queueIdx, setQueueIdx] = useState(0);
  const [roundCorrect, setRoundCorrect] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [renderNonce, setRenderNonce] = useState(0);
  const exerciseStartRef = useRef(Date.now());

  // ── Placement result ───────────────────────────────────────────────────────
  const [placementLow, setPlacementLow] = useState(0); // saved when converged

  // ── Load units ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) { navigate("/login"); return; }
    fetch(`${API_BASE}/me/lessons/progress`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((lessons) => {
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
          navigate("/dashboard");
          return;
        }
        bisectRef.current = { low: 0, high: sorted.length - 1 };
        setUnits(sorted);
        // Kick off first round immediately
        startRound(sorted, 0, sorted.length - 1, 0);
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  // ── Core: fetch exercises for a given unit index ───────────────────────────
  function startRound(unitsList, low, high, roundNum) {
    if (roundNum >= MAX_ROUNDS || low > high) {
      // Converged or max rounds hit
      // PT-2: clamp so we never store units.length as a placement index
      setPlacementLow(Math.min(low, unitsList.length - 1));
      setPhase("done");
      return;
    }

    const mid = Math.floor((low + high) / 2);
    bisectRef.current = { low, high };
    setCurrentUnitIdx(mid);
    setPhase("loading-round");
    setQueueIdx(0);
    setRoundCorrect(0);
    setHasAnswered(false);
    setResultData(null);
    setRenderNonce((n) => n + 1);

    const unit = unitsList[mid];
    const lessonIds = unit.items.map((l) => l.id).filter((id) => id != null).join(",");

    if (!lessonIds) {
      // Unit has no lessons — skip it, don't count as pass or fail; shrink search space
      setHistory((h) => [...h, { unitTitle: unit.title, passed: null }]);
      // PT-3: limit consecutive empty-unit skips to avoid burning all rounds
      emptySkipCountRef.current += 1;
      if (emptySkipCountRef.current > 5) {
        // Too many consecutive empty units — converge at current position
        setPlacementLow(Math.min(mid, unitsList.length - 1));
        setPhase("done");
        return;
      }
      // PT-4: pass roundNum (not roundNum+1) for display; the recursion uses
      // roundNum+1 so the next startRound call correctly tracks the round count.
      setRound(roundNum + 1);
      // Treat missing-exercises unit as pass (advance upward) so we don't loop forever
      startRound(unitsList, mid + 1, high, roundNum + 1);
      return;
    }
    // Reset empty-skip counter when we find a unit with exercises
    emptySkipCountRef.current = 0;

    fetch(`${API_BASE}/me/checkpoint?lesson_ids=${encodeURIComponent(lessonIds)}&count=${EXERCISES_PER_ROUND}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const exs = (data.exercises || []).slice(0, EXERCISES_PER_ROUND);
        if (exs.length === 0) {
          // No exercises available for this unit — can't test it, shrink from above
          setHistory((h) => [...h, { unitTitle: unit.title, passed: null }]);
          setRound(roundNum + 1);
          startRound(unitsList, low, mid - 1, roundNum + 1);
          return;
        }
        setExercises(exs);
        setRound(roundNum);
        exerciseStartRef.current = Date.now();
        setPhase("testing");
      })
      .catch(() => {
        setLoadError("Network error loading exercises. Please refresh.");
      });
  }

  // ── PT-1: declare roundCorrectRef BEFORE gradeAnswer so the autoAdvance path
  // can read it without a temporal dead zone / undefined ref issue.
  // roundCorrectRef.current mirrors roundCorrect state and is updated synchronously.
  const roundCorrectRef = useRef(0);
  roundCorrectRef.current = roundCorrect;

  // ── Grade an answer ────────────────────────────────────────────────────────
  async function gradeAnswer({ isCorrect, answerText, autoAdvance }) {
    if (hasAnswered) return;

    // char_intro and similar — just advance, don't grade
    if (autoAdvance) {
      const isLastExercise = queueIdx >= exercises.length - 1;
      if (isLastExercise) {
        // PT-5: compute nextCorrect synchronously so we don't read a stale ref
        // after calling the async state setter.
        const nextCorrect = (roundCorrectRef.current ?? 0) + 1;
        roundCorrectRef.current = nextCorrect; // keep ref in sync immediately
        setRoundCorrect(nextCorrect);
        const { low, high } = bisectRef.current;
        const mid = Math.floor((low + high) / 2);
        const unitTitle = units[mid]?.title ?? "";
        const correct = nextCorrect;
        const passed = correct >= PASS_THRESHOLD;
        setHistory((h) => [...h, { unitTitle, passed }]);
        const nextRound = round + 1;
        startRound(units, passed ? mid + 1 : low, passed ? high : mid - 1, nextRound);
      } else {
        setQueueIdx((i) => i + 1);
        exerciseStartRef.current = Date.now();
        setRenderNonce((n) => n + 1);
      }
      return;
    }

    const exercise = exercises[queueIdx];
    let serverCorrect = isCorrect;

    if (exercise) {
      try {
        const res = await fetch(`${API_BASE}/me/exercises/${exercise.id}/attempt`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
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

    setRoundCorrect((c) => c + (serverCorrect ? 1 : 0));
    setHasAnswered(true);
    setResultData({
      variant: serverCorrect ? "correct" : "wrong",
      xpEarned: 0,
      correctAnswer: serverCorrect ? null : deriveCorrectAnswer(exercise),
      combo: 0,
    });
  }

  // ── Proceed after result panel ─────────────────────────────────────────────
  // (roundCorrectRef is declared above gradeAnswer — see PT-1 fix)

  function proceedAfterResult() {
    const isLastExercise = queueIdx >= exercises.length - 1;

    if (!isLastExercise) {
      setResultData(null);
      setHasAnswered(false);
      setQueueIdx((i) => i + 1);
      exerciseStartRef.current = Date.now();
      setRenderNonce((n) => n + 1);
      return;
    }

    // Last exercise — evaluate round
    // roundCorrect state already includes the last answer (set in gradeAnswer before proceedAfterResult)
    const correct = roundCorrectRef.current;
    const passed = correct >= PASS_THRESHOLD;
    const { low, high } = bisectRef.current;
    const mid = Math.floor((low + high) / 2);
    const unitTitle = units[mid]?.title ?? "";

    setHistory((h) => [...h, { unitTitle, passed }]);

    const nextRound = round + 1;
    const nextLow = passed ? mid + 1 : low;
    const nextHigh = passed ? high : mid - 1;

    setResultData(null);
    setHasAnswered(false);
    startRound(units, nextLow, nextHigh, nextRound);
  }

  // ── Save placement ─────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);

  async function confirmPlacement() {
    setSaving(true);
    const placementIdx = Math.min(placementLow, units.length - 1);
    const lessonIds = units.slice(0, placementIdx).flatMap((u) =>
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

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="font-bold text-cardinal-600">{loadError}</p>
        <button className="btn3d btn3d-brand" onClick={() => navigate("/dashboard")}>Skip test</button>
      </div>
    );
  }

  if (phase === "loading-units") {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  // ── Done / result screen ───────────────────────────────────────────────────
  if (phase === "done") {
    const placementIdx = Math.min(placementLow, units.length - 1);
    const placementUnit = units[placementIdx];
    const isBeginning = placementLow === 0;
    const isEnd = placementLow >= units.length;
    const visibleHistory = history.filter((h) => h.passed !== null);

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
              : "We'll place you at:"}
          </div>
          {!isBeginning && !isEnd && placementUnit && (
            <div className="mt-3 rounded-2xl bg-white px-6 py-4 ring-1 ring-brand-200 shadow-sm">
              <div className="font-display text-2xl font-extrabold text-brand-700">{placementUnit.title}</div>
              <div className="text-sm font-semibold text-slate-500 mt-1">
                Unit {placementIdx + 1} of {units.length}
              </div>
            </div>
          )}
        </div>

        {visibleHistory.length > 0 && (
          <div className="w-full max-w-xs space-y-2">
            {visibleHistory.map((h, i) => (
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

  // ── Loading round ──────────────────────────────────────────────────────────
  if (phase === "loading-round" || currentUnitIdx === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        <p className="font-semibold text-slate-500">
          {units?.[currentUnitIdx] ? `Checking ${units[currentUnitIdx].title}…` : "Preparing next round…"}
        </p>
      </div>
    );
  }

  // ── Exercise round ─────────────────────────────────────────────────────────
  const currentExercise = exercises[queueIdx];
  const instruction = currentExercise ? (INSTRUCTIONS[currentExercise.kind] ?? null) : null;

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
      <div className="mb-4 flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-2.5 ring-1 ring-brand-100">
        <Target className="h-4 w-4 shrink-0 text-brand-500" />
        <span className="text-sm font-extrabold text-brand-700">
          Testing: {units[currentUnitIdx]?.title}
        </span>
        <span className="ml-auto text-xs font-bold text-brand-400">
          {queueIdx + 1}/{exercises.length}
        </span>
      </div>

      {currentExercise ? (
        <ExerciseRenderer
          key={`${currentExercise.id}-${renderNonce}`}
          exercise={currentExercise}
          lesson={{ id: currentExercise.lesson_id, exercises }}
          onCorrect={({ answerText, autoAdvance } = {}) => gradeAnswer({ isCorrect: true, answerText, autoAdvance })}
          onWrong={({ answerText } = {}) => gradeAnswer({ isCorrect: false, answerText })}
          onSkip={() => gradeAnswer({ isCorrect: false, answerText: "" })}
          onAnswer={({ isCorrect, answerText, autoAdvance } = {}) => gradeAnswer({ isCorrect, answerText, autoAdvance })}
          submit={({ isCorrect, answerText, autoAdvance } = {}) => gradeAnswer({ isCorrect, answerText, autoAdvance })}
          graded={hasAnswered}
        />
      ) : null}
    </ExerciseShell>
  );
}
