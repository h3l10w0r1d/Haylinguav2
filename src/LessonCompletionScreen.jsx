// src/LessonCompletionScreen.jsx
import { useMemo, useState } from "react";
import {
  Trophy,
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

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function StarsRow({ percent }) {
  const p = Math.max(0, Math.min(100, Number(percent || 0)));
  const filled = Math.max(0, Math.min(5, Math.round(p / 20)));
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="flex items-center gap-1" aria-label={`${filled} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={
              "w-6 h-6 " + (i <= filled ? "text-amber-500 fill-amber-500" : "text-slate-300")
            }
          />
        ))}
      </div>
      <div className="text-lg font-extrabold text-emerald-700">{p}%</div>
    </div>
  );
}

function StatCard({ icon: Icon, value, label }) {
  return (
    <div className="rounded-2xl bg-white/90 border border-white/60 shadow-sm px-5 py-4 text-center">
      <div className="mx-auto w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
        <Icon className="w-5 h-5 text-orange-600" />
      </div>
      <div className="mt-2 text-2xl font-extrabold text-slate-900 leading-none">{value}</div>
      <div className="mt-1 text-sm text-slate-600">{label}</div>
    </div>
  );
}

export default function LessonCompletionScreen({
  lesson,
  sessionXpEarned,
  analytics,
  analyticsLoading,
  analyticsError,
  onOpenExercise,
  onRetry,
  onDone,
  isSaving,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const ratio = useMemo(() => clamp01(analytics?.completion_ratio), [analytics]);
  const percent = Math.round(ratio * 100);

  const earnedXp = Number(analytics?.earned_xp ?? 0) || 0;
  const totalXp = Number(analytics?.lesson_total_xp ?? 0) || 0;

  const correct = Number(analytics?.correct_exercises ?? analytics?.completed_exercises ?? 0) || 0;
  const total = Number(analytics?.total_exercises ?? 0) || 0;

  const accuracy = useMemo(() => {
    const attempts = Number(analytics?.total_attempts ?? 0) || 0;
    const correctAttempts = Number(analytics?.correct_attempts ?? 0) || 0;
    if (!attempts) {
      // fallback: treat each exercise as a single attempt
      if (total > 0) return Math.round((correct / total) * 100);
      return percent;
    }
    return Math.round((correctAttempts / attempts) * 100);
  }, [analytics, correct, total, percent]);

  const message =
    percent >= 100
      ? "Perfect! You nailed every question!"
      : percent >= 70
        ? "Nice work! You’re above the completion threshold."
        : "Good effort — retry to hit 70% and complete the lesson.";

  return (
    <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-md bg-white">
      {/* Celebration hero */}
      <div className="relative px-6 py-10 sm:px-10 sm:py-12 bg-gradient-to-b from-orange-50 via-white to-white">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg flex items-center justify-center">
            <Trophy className="w-11 h-11 text-white" />
          </div>

          <h2 className="mt-6 text-4xl sm:text-5xl font-extrabold tracking-tight text-orange-600">
            Lesson Complete!
          </h2>
          <p className="mt-2 text-base sm:text-lg text-slate-600">
            Great job! You’re making amazing progress.
          </p>

          {/* Stat cards */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={Zap} value={`+${sessionXpEarned ?? earnedXp}`} label="XP Earned" />
            <StatCard icon={Target} value={`${accuracy}%`} label="Accuracy" />
            <StatCard icon={CheckCircle2} value={total ? `${correct}/${total}` : `${correct}`} label="Correct" />
          </div>

          {/* Stars + percent */}
          <div className="mt-6 rounded-2xl bg-orange-50/60 border border-orange-100 px-5 py-3">
            <StarsRow percent={percent} />
          </div>

          <div className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-100 px-5 py-3 text-emerald-700 font-semibold">
            <span aria-hidden>✨</span>
            <span>{message}</span>
          </div>

          {/* Primary actions */}
          <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <button
              type="button"
              onClick={onRetry}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 border border-slate-200 bg-white shadow-sm text-slate-800 font-semibold hover:bg-slate-50 disabled:opacity-60"
            >
              <RotateCcw className="w-5 h-5" />
              Retry Lesson
            </button>

            <button
              type="button"
              onClick={onDone}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 bg-gradient-to-r from-orange-600 to-rose-500 text-white font-extrabold shadow-md hover:opacity-95 disabled:opacity-60"
            >
              Continue Learning <span aria-hidden>→</span>
            </button>
          </div>

          {/* Analytics status */}
          {analyticsLoading ? (
            <div className="mt-6 flex items-center justify-center gap-2 text-slate-600">
              <BarChart3 className="w-5 h-5" />
              <span>Loading analytics…</span>
            </div>
          ) : null}

          {analyticsError ? (
            <div className="mt-6 mx-auto max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 mt-0.5" />
              <div>
                <div className="font-semibold">Couldn’t load analytics</div>
                <div className="text-rose-700/90">{analyticsError}</div>
              </div>
            </div>
          ) : null}

          {/* Details toggle */}
          {analytics?.exercises?.length ? (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setDetailsOpen((v) => !v)}
                className="mx-auto inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
              >
                {detailsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                View details
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Details (breakdown) */}
      {detailsOpen && analytics?.exercises?.length ? (
        <div className="px-6 pb-8 sm:px-10 sm:pb-10">
          <div className="text-sm font-semibold text-slate-900">Exercise breakdown</div>
          <div className="mt-3 divide-y divide-slate-200 rounded-2xl border border-slate-200 overflow-hidden bg-white">
            {analytics.exercises.map((ex) => {
              const completed = !!ex.completed;
              return (
                <button
                  key={ex.exercise_id}
                  type="button"
                  onClick={() => onOpenExercise?.(ex.exercise_id)}
                  className="w-full text-left p-4 hover:bg-slate-50 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      #{ex.sort_order}. <span className="font-mono">{ex.kind}</span>
                    </div>
                    {ex.prompt ? (
                      <div className="mt-1 text-sm text-slate-600 max-h-10 overflow-hidden">{ex.prompt}</div>
                    ) : null}
                    <div className="mt-2 text-xs text-slate-500">
                      Attempts: <span className="font-semibold">{ex.attempts ?? 0}</span> · Accuracy:{" "}
                      <span className="font-semibold">{Math.round((ex.accuracy ?? 0) * 100)}%</span> · XP:{" "}
                      <span className="font-semibold">{ex.xp ?? 0}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={
                        "text-xs font-semibold px-3 py-1 rounded-full border " +
                        (completed
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-50 text-slate-700 border-slate-200")
                      }
                    >
                      {completed ? "Completed" : "Incomplete"}
                    </span>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 text-xs text-slate-500">
            Rule: lesson is considered completed when at least <span className="font-semibold">70%</span> of exercises
            have a correct attempt.
            {totalXp ? (
              <>
                {" "}
                · Lesson XP: <span className="font-semibold">{earnedXp}</span> /{" "}
                <span className="font-semibold">{totalXp}</span>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
