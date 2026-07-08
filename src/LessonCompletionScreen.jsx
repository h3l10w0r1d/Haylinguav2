// src/LessonCompletionScreen.jsx
import { useMemo, useState } from "react";
import {
  Zap,
  Target,
  CheckCircle2,
  Star,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import grandma from "./assets/character-grandma.png";

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

const CONFETTI_COLORS = ["#FF7A1A", "#58CC02", "#1CB0F6", "#FFC800", "#E11D48"];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }).map((_, i) => ({
        left: Math.round((i * 37) % 100),
        delay: (i % 7) * 0.18,
        dur: 2.4 + (i % 5) * 0.4,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 7 + (i % 3) * 3,
        round: i % 2 === 0,
      })),
    []
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.round ? "9999px" : "2px",
            animation: `confettiFall ${p.dur}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function StarsRow({ percent }) {
  const p = Math.max(0, Math.min(100, Number(percent || 0)));
  const filled = Math.max(0, Math.min(5, Math.round(p / 20)));
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={"h-7 w-7 " + (i <= filled ? "text-gold-500 fill-gold-500" : "text-slate-200 fill-slate-200")}
          />
        ))}
      </div>
      <div className="font-display text-lg font-extrabold text-grass-600">{p}%</div>
    </div>
  );
}

function StatCard({ icon: Icon, value, label, tone = "brand" }) {
  const tones = {
    brand: "text-brand-500 bg-brand-50",
    grass: "text-grass-600 bg-grass-50",
    feather: "text-feather-600 bg-feather-50",
  };
  return (
    <div className="rounded-2xl bg-white px-4 py-4 text-center ring-1 ring-slate-200/80 shadow-sm">
      <div className={`mx-auto grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-2 font-display text-2xl font-extrabold leading-none text-slate-800">{value}</div>
      <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

export default function LessonCompletionScreen({
  sessionXpEarned,
  mistakes = 0,
  analytics,
  analyticsLoading,
  analyticsError,
  onOpenExercise,
  onRetry,
  onDone,
  isSaving,
}) {
  const perfect = Number(mistakes) === 0;
  // Auto-open the exercise breakdown when the learner made mistakes so they
  // can immediately see which exercises to review.
  const [detailsOpen, setDetailsOpen] = useState(!perfect);

  const ratio = useMemo(() => clamp01(analytics?.completion_ratio), [analytics]);
  const percent = Math.round(ratio * 100);

  const earnedXp = Number(analytics?.earned_xp ?? 0) || 0;
  const totalXp = Number(analytics?.lesson_total_xp ?? 0) || 0;
  const correct = Number(analytics?.correct_exercises ?? analytics?.completed_exercises ?? 0) || 0;
  const total = Number(analytics?.total_exercises ?? 0) || 0;

  const accuracy = useMemo(() => {
    const attempts = Number(analytics?.total_attempts ?? 0) || 0;
    const correctAttempts = Number(analytics?.correct_attempts ?? 0) || 0;
    if (!attempts) return total > 0 ? Math.round((correct / total) * 100) : percent;
    return Math.round((correctAttempts / attempts) * 100);
  }, [analytics, correct, total, percent]);

  const message =
    percent >= 100
      ? "Կեցցե՛ս! You nailed every question!"
      : percent >= 70
      ? "Nice work! You’re above the completion threshold."
      : "Good effort — retry to hit 70% and complete the lesson.";

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-slate-200">
      {percent >= 70 ? <Confetti /> : null}

      <div className="relative px-6 py-10 sm:px-10 sm:py-12">
        <div className="mx-auto max-w-2xl text-center">
          <img
            src={grandma}
            alt="Tatik celebrating"
            className="mx-auto h-28 w-28 animate-bouncey rounded-3xl object-cover"
          />

          <h2 className="mt-5 font-display text-4xl font-extrabold tracking-tight text-brand-500 sm:text-5xl">
            {perfect ? "Perfect Lesson!" : "Lesson Complete!"}
          </h2>
          <p className="mt-2 text-base font-semibold text-slate-500">
            {perfect
              ? "Կեցցե՛ս! Flawless — not a single mistake. 🎉"
              : `Done! ${mistakes} mistake${Number(mistakes) === 1 ? "" : "s"} along the way — review them to master it.`}
          </p>
          {perfect ? (
            <div className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-gold-600">
              ★ No mistakes
            </div>
          ) : null}

          <div className="mt-8 grid grid-cols-3 gap-3">
            <StatCard icon={Zap} value={`+${sessionXpEarned ?? earnedXp}`} label="XP" tone="brand" />
            <StatCard icon={Target} value={`${accuracy}%`} label="Accuracy" tone="feather" />
            <StatCard icon={CheckCircle2} value={total ? `${correct}/${total}` : `${correct}`} label="Correct" tone="grass" />
          </div>

          <div className="mt-6 rounded-2xl bg-brand-50 px-5 py-3 ring-1 ring-brand-100">
            <StarsRow percent={percent} />
          </div>

          <div className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-grass-50 px-5 py-3 font-bold text-grass-700 ring-1 ring-grass-100">
            <span aria-hidden>✨</span>
            <span>{message}</span>
          </div>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onRetry}
              disabled={isSaving}
              className="btn3d btn3d-neutral uppercase"
            >
              <RotateCcw className="h-5 w-5" />
              Retry
            </button>
            <button
              type="button"
              onClick={onDone}
              disabled={isSaving}
              className="btn3d btn3d-brand min-w-[200px] uppercase"
            >
              Continue Learning <span aria-hidden>→</span>
            </button>
          </div>

          {analyticsLoading ? (
            <div className="mt-6 flex items-center justify-center gap-2 font-semibold text-slate-500">
              <BarChart3 className="h-5 w-5" />
              <span>Loading analytics…</span>
            </div>
          ) : null}

          {analyticsError ? (
            <div className="mt-6 mx-auto flex max-w-xl items-start gap-2 rounded-2xl border-2 border-cardinal-100 bg-cardinal-50 p-4 text-sm font-semibold text-cardinal-600">
              <AlertTriangle className="mt-0.5 h-5 w-5" />
              <div>
                <div className="font-bold">Couldn’t load analytics</div>
                <div>{analyticsError}</div>
              </div>
            </div>
          ) : null}

          {analytics?.exercises?.length ? (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setDetailsOpen((v) => !v)}
                className="mx-auto inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700"
              >
                {detailsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                View details
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {detailsOpen && analytics?.exercises?.length ? (
        <div className="px-6 pb-8 sm:px-10 sm:pb-10">
          <div className="font-display text-sm font-extrabold text-slate-800">Exercise breakdown</div>
          <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            {analytics.exercises.map((ex) => {
              const completed = !!ex.completed;
              return (
                <button
                  key={ex.exercise_id}
                  type="button"
                  onClick={() => onOpenExercise?.(ex.exercise_id)}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-slate-50"
                >
                  <div>
                    <div className="text-sm font-bold text-slate-800">
                      #{ex.sort_order}. <span className="font-mono text-slate-500">{ex.kind}</span>
                    </div>
                    {ex.prompt ? (
                      <div className="mt-1 max-h-10 overflow-hidden text-sm text-slate-500">{ex.prompt}</div>
                    ) : null}
                    <div className="mt-2 text-xs font-semibold text-slate-400">
                      Attempts: {ex.attempts ?? 0} · Accuracy: {Math.round((ex.accuracy ?? 0) * 100)}% · XP: {ex.xp ?? 0}
                    </div>
                  </div>
                  <span
                    className={
                      "rounded-full px-3 py-1 text-xs font-bold " +
                      (completed ? "bg-grass-50 text-grass-700" : "bg-slate-100 text-slate-500")
                    }
                  >
                    {completed ? "Done" : "Incomplete"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 text-xs font-semibold text-slate-400">
            Lesson completes at <span className="text-slate-600">70%</span> correct.
            {totalXp ? (
              <> · XP: <span className="text-slate-600">{earnedXp}</span> / {totalXp}</>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
