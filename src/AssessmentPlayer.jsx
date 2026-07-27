// src/AssessmentPlayer.jsx
//
// The level checkpoint test. When a learner has finished every lesson in a
// CEFR level, the roadmap offers "Take the {level} test" — that lands here.
// It samples ~20 exercises from the level (GET /me/assessment/{level}), runs
// them back-to-back like a lesson but WITHOUT hearts or SRS side effects
// (ExerciseRenderer persist={false}; Phase2 grading is handled locally), and
// on completion POSTs the tally to /me/assessment/{level}/submit. Clearing the
// pass mark unlocks the next level's stretch of the roadmap.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, ArrowLeft, ShieldCheck, Trophy, RotateCcw, Lock } from "lucide-react";

import ExerciseRenderer from "./ExerciseRenderer";
import Phase2Exercise from "./Phase2Exercise";
import ExerciseShell from "./ExerciseShell";
import { sfx } from "./lib/sfx";
import { pickMascotCharacter } from "./lib/mascotFaces";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

const PHASE2_KINDS = new Set([
  "translate_mcq",
  "true_false",
  "fill_blank",
  "letter_typing",
  "word_spelling",
  "sentence_order",
  "char_build_word",
  "letter_recognition",
  "char_mcq_sound",
]);

const LEVEL_NAMES = {
  A0: "Foundations",
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper-Intermediate",
};

function getToken() {
  return (
    localStorage.getItem("hay_token") ||
    localStorage.getItem("access_token") ||
    ""
  );
}

export default function AssessmentPlayer() {
  const { level: rawLevel } = useParams();
  const level = String(rawLevel || "").toUpperCase();
  const navigate = useNavigate();
  const token = useMemo(() => getToken(), []);
  const [mascotCharacter] = useState(pickMascotCharacter);

  // phase: loading -> intro -> test -> submitting -> done  (or error)
  const [phase, setPhase] = useState("loading");
  const [error, setError] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [passMark, setPassMark] = useState(80);
  const [idx, setIdx] = useState(0);
  const [phase2Actions, setPhase2Actions] = useState(null);
  const [outcome, setOutcome] = useState(null);

  // Tally lives in a ref so the final submit reads the true count even when it
  // fires from within the same tick that recorded the last answer.
  const correctRef = useRef(0);

  useEffect(() => {
    if (!token) {
      setError({ kind: "auth", message: "Please log in to take the test." });
      setPhase("error");
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/me/assessment/${level}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (res.status === 403) {
          setError({
            kind: "verify",
            message:
              "Verify your email address before taking a level test. Check your inbox for the confirmation link.",
          });
          setPhase("error");
          return;
        }
        if (!res.ok || !data || !Array.isArray(data.exercises) || data.exercises.length === 0) {
          setError({
            kind: "content",
            message:
              (data && data.detail) ||
              "This test isn't ready yet — finish the level's lessons first.",
          });
          setPhase("error");
          return;
        }
        setExercises(data.exercises);
        if (Number.isFinite(data.pass_mark)) setPassMark(data.pass_mark);
        setPhase("intro");
      } catch {
        if (!alive) return;
        setError({ kind: "network", message: "Couldn't load the test. Check your connection and try again." });
        setPhase("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [level, token]);

  const currentExercise = exercises[idx] || null;
  const kind = String(currentExercise?.kind || "").trim();
  const isPhase2 = !!currentExercise && PHASE2_KINDS.has(kind);

  async function submitTest() {
    setPhase("submitting");
    const total = exercises.length;
    const correct = correctRef.current;
    try {
      const res = await fetch(`${API_BASE}/me/assessment/${level}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ correct, total }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setOutcome(data);
      } else {
        // Fall back to a client-side verdict so the learner still sees a result.
        const score = Math.round((correct * 100) / Math.max(1, total));
        setOutcome({ level, score, best_score: score, passed: score >= passMark, pass_mark: passMark, next_level: null, next_unlocked: false });
      }
    } catch {
      const score = Math.round((correct * 100) / Math.max(1, total));
      setOutcome({ level, score, best_score: score, passed: score >= passMark, pass_mark: passMark, next_level: null, next_unlocked: false });
    }
    setPhase("done");
  }

  function onGraded(payload) {
    const ok = payload?.isCorrect === true;
    if (ok) correctRef.current += 1;
    if (idx + 1 >= exercises.length) {
      submitTest();
    } else {
      setIdx((i) => i + 1);
    }
  }

  // ---- Loading ----
  if (phase === "loading") {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-stone-50 dark:bg-stone-950">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  // ---- Error / unavailable ----
  if (phase === "error") {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-stone-50 px-6 dark:bg-stone-950">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-stone-100 dark:bg-white/[0.06]">
            <Lock className="h-8 w-8 text-stone-400" />
          </div>
          <h1 className="font-display text-xl font-extrabold text-stone-800 dark:text-white">
            {level} test
          </h1>
          <p className="mt-2 text-sm font-semibold text-stone-500 dark:text-stone-400">
            {error?.message}
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="btn3d btn3d-brand mt-6 w-full uppercase"
          >
            Back to lessons
          </button>
        </div>
      </div>
    );
  }

  // ---- Intro ----
  if (phase === "intro") {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-stone-50 px-6 dark:bg-stone-950">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-brand-500 shadow-lg shadow-brand-500/30">
            <ShieldCheck className="h-10 w-10 text-white" />
          </div>
          <div className="text-xs font-extrabold uppercase tracking-wide text-brand-500">
            {LEVEL_NAMES[level] || level} checkpoint
          </div>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-stone-800 dark:text-white">
            The {level} test
          </h1>
          <p className="mt-3 text-sm font-semibold text-stone-500 dark:text-stone-400">
            {exercises.length} questions from everything you've learned. Score{" "}
            <span className="font-extrabold text-stone-700 dark:text-stone-200">{passMark}%</span> or
            higher to unlock the next level. It won't cost you any hearts.
          </p>
          <button
            onClick={() => {
              correctRef.current = 0;
              setIdx(0);
              setPhase("test");
            }}
            className="btn3d btn3d-brand mt-7 w-full uppercase"
          >
            Start the test
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="mt-3 w-full py-2 text-sm font-extrabold uppercase tracking-wide text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
          >
            Not now
          </button>
        </div>
      </div>
    );
  }

  // ---- Submitting ----
  if (phase === "submitting") {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-stone-50 dark:bg-stone-950">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-500" />
          <p className="mt-3 text-sm font-bold text-stone-400">Scoring your test…</p>
        </div>
      </div>
    );
  }

  // ---- Result ----
  if (phase === "done" && outcome) {
    const passed = !!outcome.passed;
    const score = Number(outcome.score ?? 0);
    const nextLevel = outcome.next_level;
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-stone-50 px-6 dark:bg-stone-950">
        <div className="w-full max-w-sm text-center">
          <div
            className={
              "mx-auto mb-5 grid h-24 w-24 place-items-center rounded-full shadow-lg " +
              (passed
                ? "bg-grass-500 shadow-grass-500/30"
                : "bg-stone-200 dark:bg-white/[0.08]")
            }
          >
            {passed ? (
              <Trophy className="h-12 w-12 text-white" />
            ) : (
              <RotateCcw className="h-12 w-12 text-stone-400" />
            )}
          </div>
          <h1 className="font-display text-2xl font-extrabold text-stone-800 dark:text-white">
            {passed ? "You passed! 🎉" : "Almost there"}
          </h1>
          <div className="mt-2 font-display text-5xl font-black text-brand-500">{score}%</div>
          <p className="mt-2 text-sm font-semibold text-stone-500 dark:text-stone-400">
            {passed
              ? outcome.next_unlocked && nextLevel
                ? `${LEVEL_NAMES[nextLevel] || nextLevel} (${nextLevel}) is now unlocked.`
                : "Level cleared."
              : `You need ${outcome.pass_mark ?? passMark}% to pass. Review the lessons and try again.`}
          </p>

          {passed ? (
            <button
              onClick={() => navigate("/dashboard")}
              className="btn3d btn3d-brand mt-7 w-full uppercase"
            >
              Continue
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  correctRef.current = 0;
                  setIdx(0);
                  setOutcome(null);
                  setPhase("test");
                }}
                className="btn3d btn3d-brand mt-7 w-full uppercase"
              >
                Try again
              </button>
              <button
                onClick={() => navigate("/dashboard")}
                className="mt-3 w-full py-2 text-sm font-extrabold uppercase tracking-wide text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                Back to lessons
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---- Test ----
  return (
    <ExerciseShell
      title={`${level} test`}
      step={idx}
      total={exercises.length}
      onBack={() => navigate("/dashboard")}
      primaryLabel={isPhase2 ? phase2Actions?.primaryLabel ?? "Check" : null}
      primaryDisabled={isPhase2 ? !phase2Actions?.canCheck : null}
      onPrimary={isPhase2 ? phase2Actions?.onCheck : null}
      hideFooter={false}
      reviewCount={0}
      mascotCharacter={mascotCharacter}
      hideMascot
      result={null}
      exerciseId={currentExercise?.id}
    >
      {currentExercise ? (
        isPhase2 ? (
          <Phase2Exercise
            key={currentExercise.id}
            exercise={currentExercise}
            registerActions={setPhase2Actions}
            submit={(payload) => {
              const ok = payload?.isCorrect === true;
              if (ok) sfx.correct(0);
              else sfx.wrong?.();
              onGraded(payload);
            }}
            mascotCharacter={mascotCharacter}
          />
        ) : (
          <ExerciseRenderer
            key={currentExercise.id}
            exercise={currentExercise}
            apiBaseUrl={API_BASE}
            persist={false}
            onAnswer={(payload) => {
              const ok = payload?.isCorrect === true;
              if (ok) sfx.correct(0);
              else sfx.wrong?.();
              onGraded(payload);
            }}
            combo={0}
            mascotCharacter={mascotCharacter}
          />
        )
      ) : null}
    </ExerciseShell>
  );
}
