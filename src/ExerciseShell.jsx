// src/ExerciseShell.jsx
import React, { useEffect, useState } from "react";
import { X, Heart } from "lucide-react";

/** Live hearts badge — reads localStorage and the `hay_hearts` event that
 *  postAttempt dispatches, so it stays in sync without prop drilling. */
function HeartsBadge() {
  const read = () => {
    try {
      const raw = localStorage.getItem("hay_hearts");
      if (!raw) return null;
      const v = JSON.parse(raw);
      if (Number.isFinite(v?.current)) return Number(v.current);
    } catch {}
    return null;
  };
  const [hearts, setHearts] = useState(read);

  useEffect(() => {
    const onEvt = (e) => {
      const c = e?.detail?.current;
      if (Number.isFinite(c)) setHearts(Number(c));
    };
    const onStorage = () => setHearts(read());
    window.addEventListener("hay_hearts", onEvt);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("hay_hearts", onEvt);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  if (hearts == null) return null;
  return (
    <div className="flex items-center gap-1.5 font-display text-lg font-extrabold text-cardinal-500">
      <Heart className="h-6 w-6 fill-cardinal-500 text-cardinal-500" />
      {hearts}
    </div>
  );
}

/**
 * ExerciseShell — immersive, Duolingo-style frame for ALL exercises:
 *  - Top bar: quit (X) + chunky progress bar + hearts
 *  - Centered content area
 *  - Sticky bottom action bar (Check / Skip)
 *  - Slide-up result sheet (correct / wrong / skipped)
 */
export default function ExerciseShell({
  title,
  step,
  total,
  onBack,
  primaryLabel,
  primaryDisabled,
  onPrimary,
  secondaryLabel,
  secondaryDisabled,
  onSecondary,
  result,
  onResultPrimary,
  children,
}) {
  const pct = total > 0 ? Math.round((step / total) * 100) : 0;

  // When the result sheet is open, Enter triggers the primary action.
  useEffect(() => {
    if (!result) return;
    const onKeyDown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onResultPrimary?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [result, onResultPrimary]);

  const variant = result?.variant;
  const sheetTone =
    variant === "correct"
      ? { wrap: "bg-grass-50 border-grass-100", title: "text-grass-700", btn: "btn3d-grass", icon: "✅" }
      : variant === "skipped"
      ? { wrap: "bg-slate-50 border-slate-100", title: "text-slate-600", btn: "btn3d-neutral", icon: "⏭️" }
      : { wrap: "bg-cardinal-50 border-cardinal-100", title: "text-cardinal-600", btn: "btn3d-cardinal", icon: "❌" };

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Quit lesson"
            className="text-slate-400 transition hover:text-slate-600 active:scale-90"
          >
            <X className="h-7 w-7" strokeWidth={3} />
          </button>

          <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div
              className="relative h-4 rounded-full bg-brand-500 transition-all duration-500"
              style={{ width: `${Math.max(pct, 6)}%` }}
            >
              <span className="absolute left-2 right-2 top-1 h-1.5 rounded-full bg-white/40" />
            </div>
          </div>

          <HeartsBadge />
        </div>
        {title ? (
          <div className="mx-auto max-w-3xl px-4 pb-1">
            <div className="line-clamp-1 text-xs font-bold uppercase tracking-wide text-slate-400">
              {title}
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 pb-36">{children}</main>

      {/* Bottom action bar */}
      {(primaryLabel || secondaryLabel) && !result ? (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t-2 border-slate-100 bg-white">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
            {secondaryLabel ? (
              <button
                type="button"
                disabled={secondaryDisabled}
                onClick={onSecondary}
                className="btn3d btn3d-neutral uppercase"
              >
                {secondaryLabel}
              </button>
            ) : null}

            {primaryLabel ? (
              <button
                type="button"
                disabled={primaryDisabled}
                onClick={onPrimary}
                className="btn3d btn3d-grass ml-auto min-w-[140px] uppercase"
              >
                {primaryLabel}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Result sheet */}
      {result ? (
        <div className="fixed inset-0 z-[60] flex items-end">
          <div className="absolute inset-0 bg-black/10" />
          <div className={"relative w-full border-t-2 animate-pop " + sheetTone.wrap}>
            <div className="mx-auto max-w-3xl px-4 py-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={
                      "grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-2xl shadow-sm"
                    }
                  >
                    {sheetTone.icon}
                  </div>
                  <div>
                    <div className={"font-display text-xl font-extrabold " + sheetTone.title}>
                      {variant === "correct"
                        ? "Շատ լավ! Correct!"
                        : variant === "skipped"
                        ? "Skipped"
                        : "Not quite"}
                    </div>
                    <div className="text-sm font-bold text-slate-500">
                      {variant === "correct"
                        ? `+${Number(result.xpEarned || 0)} XP`
                        : variant === "skipped"
                        ? "No XP gained"
                        : result.detail || "Try again — you’ve got this."}
                    </div>
                    {result.subtext ? (
                      <div className="text-xs font-semibold text-slate-400">{result.subtext}</div>
                    ) : null}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onResultPrimary}
                className={"btn3d mt-4 w-full uppercase " + sheetTone.btn}
              >
                {result.primaryLabel || (variant === "wrong" ? "Try again" : "Continue")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
