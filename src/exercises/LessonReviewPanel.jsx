// src/exercises/LessonReviewPanel.jsx
// Read-only "step back" view: lets a learner scroll through exercises
// they've already completed earlier in the current lesson (prompt, what
// they answered, right/wrong) without touching grading/XP/hearts state —
// answering again isn't re-scored, this is purely for review.
import { X, Check, XCircle } from "lucide-react";

export default function LessonReviewPanel({ open, history, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="safe-b relative max-h-[80vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-xl ring-1 ring-slate-200 sm:max-w-lg sm:rounded-3xl dark:bg-[#18181b] dark:ring-white/[0.08]">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 dark:border-white/[0.06] dark:bg-[#18181b]">
          <div className="font-display text-lg font-extrabold text-slate-800 dark:text-white">
            This lesson so far
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 transition hover:text-slate-600 dark:text-stone-500 dark:hover:text-stone-300"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>

        {history.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm font-semibold text-slate-400 dark:text-stone-500">
            Nothing completed yet — answer a few exercises to see them here.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {history.map((item, i) => (
              <div key={item.id ?? i} className="flex items-start gap-3 px-5 py-3.5">
                <span
                  className={
                    "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full " +
                    (item.wasWrongFirst
                      ? "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                      : "bg-grass-100 text-grass-600 dark:bg-grass-500/20 dark:text-grass-400")
                  }
                >
                  {item.wasWrongFirst ? <XCircle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-700 dark:text-stone-200">{item.prompt || "—"}</div>
                  {item.userAnswer ? (
                    <div className="mt-0.5 text-xs font-semibold text-slate-400 dark:text-stone-500">
                      You answered: <span className="text-slate-600 dark:text-stone-300">{item.userAnswer}</span>
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 text-xs font-extrabold text-brand-500 dark:text-brand-400">+{item.xpEarned ?? 0} XP</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
