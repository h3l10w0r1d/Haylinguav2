// src/LessonCompletionScreen.jsx
import { useMemo } from "react";
import { CheckCircle2, Star, RotateCcw, BarChart3, AlertTriangle } from "lucide-react";

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function Stars({ value }) {
  const v = Math.max(0, Math.min(3, Number(value || 0)));
  return (
    <div className="inline-flex items-center gap-1" aria-label={`${v} stars`}>
      {[1, 2, 3].map((i) => (
        <Star
          key={i}
          className={
            "w-5 h-5 " + (i <= v ? "text-amber-500 fill-amber-500" : "text-slate-300")
          }
        />
      ))}
    </div>
  );
}

export default function LessonCompletionScreen({
  lesson,
  sessionXpEarned,
  analytics,
  analyticsLoading,
  analyticsError,
  onRetry,
  onDone,
  isSaving,
}) {
  const ratio = useMemo(() => clamp01(analytics?.completion_ratio), [analytics]);
  const percent = Math.round(ratio * 100);
  const earnedXp = Number(analytics?.earned_xp ?? 0) || 0;
  const totalXp = Number(analytics?.lesson_total_xp ?? 0) || 0;

  return (
    <div className="bg-white rounded-3xl shadow-md border border-slate-200 overflow-hidden">
      {/* Banner */}
      <div className="relative p-6 sm:p-8 bg-gradient-to-br from-orange-50 to-slate-50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-6 h-6" />
              <div className="text-lg font-extrabold text-slate-900">Lesson complete</div>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Session XP earned: <span className="font-semibold">{Number(sessionXpEarned || 0)}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {lesson?.title ? lesson.title : ""}
            </p>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-500">Performance</div>
            <div className="mt-1">
              <Stars value={analytics?.stars ?? 0} />
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{percent}% completed</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5">
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div className="h-2 bg-orange-500 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
            <span>
              XP: <span className="font-semibold">{earnedXp}</span>
              {totalXp ? ` / ${totalXp}` : ""}
            </span>
            <span>
              Exercises: <span className="font-semibold">{analytics?.completed_exercises ?? 0}</span>
              {Number.isFinite(analytics?.total_exercises)
                ? ` / ${analytics.total_exercises}`
                : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 sm:p-8 space-y-4">
        {analyticsLoading ? (
          <div className="flex items-center gap-2 text-slate-600">
            <BarChart3 className="w-5 h-5" />
            <span>Loading analytics…</span>
          </div>
        ) : null}

        {analyticsError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 mt-0.5" />
            <div>
              <div className="font-semibold">Couldn’t load analytics</div>
              <div className="text-rose-700/90">{analyticsError}</div>
            </div>
          </div>
        ) : null}

        {analytics?.exercises?.length ? (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-900">Exercise breakdown</div>
            <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 overflow-hidden">
              {analytics.exercises.map((ex) => {
                const completed = !!ex.completed;
                const accuracy = Number(ex.accuracy ?? 0);
                return (
                  <div key={ex.exercise_id} className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {typeof ex.order === "number" ? `#${ex.order + 1} · ` : ""}
                        {ex.kind || "exercise"}
                      </div>
                      <div className="text-xs text-slate-600 truncate">{ex.prompt}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Attempts: {ex.attempts} · Accuracy: {Number.isFinite(accuracy) ? `${accuracy}%` : "—"} · XP: {ex.xp}
                      </div>
                    </div>
                    <div
                      className={
                        "shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold " +
                        (completed
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-50 text-slate-600 border border-slate-200")
                      }
                    >
                      {completed ? "Completed" : "Incomplete"}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-500">
              Rule: lesson is considered completed when at least 70% of exercises have a correct attempt.
            </p>
          </div>
        ) : null}

        {/* Actions */}
        <div className="pt-2 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-semibold hover:bg-slate-50"
          >
            <RotateCcw className="w-4 h-4" />
            Retry lesson
          </button>

          <button
            type="button"
            onClick={onDone}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-60 disabled:cursor-wait"
          >
            {isSaving ? "Saving…" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
