// src/ExerciseShell.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Heart, Volume2, Sparkles, HelpCircle, Loader2, History } from "lucide-react";
import { newTrackedAudio } from "./lib/audioRegistry";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("hay_token") || "";
}

async function speakText(text) {
  try {
    const res = await fetch(`${API_BASE}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = newTrackedAudio(url);
    audio.play();
    audio.onended = () => URL.revokeObjectURL(url);
  } catch {}
}
import { StarMotif, CarpetBorder } from "./lib/motifs";
import { readHearts } from "./lib/hearts";
import ReportProblem from "./ReportProblem";
import { ExerciseFooterContext } from "./exercises/FooterSlot";
import { diffAnswer, DIFFABLE_KINDS } from "./lib/textDiff";
import { mascotFaceUrl } from "./lib/mascotFaces";

/** Per-character diff between what the learner typed and the correct
 *  answer — shown instead of the bare correct-answer string whenever both
 *  are available for a free-text exercise kind. */
function AnswerDiff({ typed, correct }) {
  const { typed: typedSegs, correct: correctSegs } = useMemo(
    () => diffAnswer(typed, correct),
    [typed, correct]
  );
  const typedClass = (type) =>
    type === "match"
      ? "text-slate-800 dark:text-white"
      : "text-cardinal-600 line-through decoration-2 dark:text-cardinal-400";
  const correctClass = (type) =>
    type === "missing"
      ? "rounded bg-amber-100 px-0.5 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400"
      : "text-slate-800 dark:text-white";

  return (
    <div className="font-display text-base font-extrabold">
      {typedSegs.length ? (
        <div className="mb-0.5 flex flex-wrap items-baseline gap-x-1">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-stone-500">
            You wrote
          </span>
          <span>
            {typedSegs.map((seg, i) => (
              <span key={i} className={typedClass(seg.type)}>{seg.char}</span>
            ))}
          </span>
        </div>
      ) : null}
      <div className="flex flex-wrap items-baseline gap-x-1">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-stone-500">
          Correct
        </span>
        <span>
          {correctSegs.map((seg, i) => (
            <span key={i} className={correctClass(seg.type)}>{seg.char}</span>
          ))}
        </span>
      </div>
    </div>
  );
}

/** Live hearts badge — reads localStorage and the `hay_hearts` event so it
 *  stays in sync without prop drilling. Shows ∞ for premium users.
 *  Shakes + flashes red whenever a heart is lost. */
function HeartsBadge() {
  const [hearts, setHearts] = useState(readHearts);
  const [shaking, setShaking] = useState(false);
  const prevCount = useRef(null);

  useEffect(() => {
    const onEvt = (e) => {
      if (!e?.detail) return;
      const d = e.detail;
      const next = Number(d.current ?? d.hearts_current ?? Infinity);
      if (prevCount.current !== null && !d.is_premium && next < prevCount.current) {
        setShaking(true);
        setTimeout(() => setShaking(false), 600);
      }
      prevCount.current = next;
      setHearts(d);
    };
    const onStorage = () => setHearts(readHearts());
    window.addEventListener("hay_hearts", onEvt);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("hay_hearts", onEvt);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  if (hearts == null) return null;
  return (
    <div className={"flex items-center gap-1.5 font-display text-lg font-extrabold " + (shaking ? "heart-shake text-red-600" : "text-cardinal-500 dark:text-cardinal-400")}>
      <Heart className={"h-6 w-6 " + (shaking ? "fill-red-600 text-red-600" : "fill-cardinal-500 text-cardinal-500")} />
      {hearts.is_premium ? "∞" : hearts.current}
    </div>
  );
}

/** "Explain my mistake" — fetches a short GPT-4o explanation on demand. */
function ExplainMistake({ exerciseId, userAnswer }) {
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [text, setText] = useState("");

  async function ask() {
    if (state === "loading") return;
    setState("loading");
    try {
      const res = await fetch(`${API_BASE}/me/exercises/${exerciseId}/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ user_answer: userAnswer || "" }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setText((data?.explanation || "").trim() || "Compare your answer with the correct one, letter by letter.");
      setState("done");
    } catch {
      setText("Couldn’t load an explanation right now.");
      setState("error");
    }
  }

  if (state === "idle" || state === "loading") {
    return (
      <button
        type="button"
        onClick={ask}
        disabled={state === "loading"}
        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-extrabold text-cardinal-600 shadow-sm ring-1 ring-cardinal-200 transition hover:bg-white disabled:opacity-60 dark:bg-white/10 dark:text-cardinal-400 dark:ring-cardinal-500/30 dark:hover:bg-white/20"
      >
        {state === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HelpCircle className="h-3.5 w-3.5" />}
        {state === "loading" ? "Thinking…" : "Why was this wrong?"}
      </button>
    );
  }
  return (
    <div className="mt-2 rounded-xl bg-white/70 p-3 text-sm font-semibold leading-snug text-slate-700 shadow-sm ring-1 ring-cardinal-100 dark:bg-white/[0.06] dark:text-stone-200 dark:ring-cardinal-500/30">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-cardinal-500 dark:text-cardinal-400">
        <Sparkles className="h-3.5 w-3.5" /> Explanation
      </div>
      {text}
    </div>
  );
}

// Rotating praise/encouragement pools so the result sheet doesn't repeat the
// same line every single answer. Combo tier scales enthusiasm on correct.
const PRAISE_NORMAL = ["Ապրե՛ս! · Correct", "Կեցցե՛ս! · Nice one", "Հիանալի՛ · Great job", "Շատ լավ · Well done", "Ճիշտ է · That's right"];
const PRAISE_HOT = ["Հրաշալի՛ · Excellent!", "Փայլուն է · Brilliant!", "Այսպե՛ս պահիր · Keep it up!", "Ուժե՛ղ ես · On fire!"];
const PRAISE_MEGA = ["Անհավատալի՛ · Incredible!", "Անմրցելի՛ · Unstoppable!", "Չեմպիո՛ն ես · Champion streak!"];
const WRONG_ENCOURAGEMENT = [
  "You've got this — give it another go.",
  "So close! Take another look.",
  "Almost there — one more try.",
  "Keep going, you'll get it.",
  "No worries — mistakes help it stick.",
];

function pickFrom(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
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
  exerciseId,
  lessonId,
  instruction,
  // Set when `children` isn't an exercise at all (completion screen, reading
  // passage, out-of-hearts gate, etc.) — those render their own CTA or none,
  // so the shell's Check-button footer (and its FooterSlot portal target)
  // must not appear, or an empty bar would show underneath them.
  hideFooter = false,
  // Read-only "step back" review of exercises already completed this lesson —
  // reviewCount is how many there are; onReview opens the panel. Absent/0
  // means nothing to review yet, so the button doesn't render.
  reviewCount = 0,
  onReview,
  // Which of the two mascot characters (picked once per lesson session in
  // LessonPlayer) shows its positive/neutral/negative face in the result panel.
  mascotCharacter = "armen",
  children,
}) {
  const pct = total > 0 ? Math.round((step / total) * 100) : 0;

  // DOM node for the bottom action bar's inner container — exposed via
  // context so ExerciseRenderer kinds can portal their Check button here,
  // landing in the exact same screen position no matter which kind or how
  // tall its content is. useState (not useRef) so the portal target updates
  // once the node actually mounts.
  const [footerNode, setFooterNode] = useState(null);

  // Progress bar gives a brief pulse/glow whenever it advances — the tile
  // itself (result sheet) already carries the correct/wrong signal, so no
  // full-screen flash is needed on top of it.
  const [justAdvanced, setJustAdvanced] = useState(false);
  const prevPct = useRef(pct);
  useEffect(() => {
    if (pct > prevPct.current) {
      setJustAdvanced(true);
      const t = setTimeout(() => setJustAdvanced(false), 420);
      prevPct.current = pct;
      return () => clearTimeout(t);
    }
    prevPct.current = pct;
  }, [pct]);

  // Rotate the result-sheet message each time a NEW result appears (not on
  // every re-render — `result` is a fresh object per answer, stable between).
  const [praiseIdx, setPraiseIdx] = useState(0);
  useEffect(() => {
    if (result) setPraiseIdx(Math.random());
  }, [result]);

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

  // Before an answer is submitted, Enter also triggers Check — including
  // while typing in a text input (no separate per-kind wiring needed: only
  // this one listener handles Enter, so there's no double-fire to guard
  // against). Works for both the explicit primaryLabel path AND
  // portal-driven kinds (FooterSlot) by clicking whichever enabled button
  // landed in the footer.
  useEffect(() => {
    if (result) return;
    const onKeyDown = (e) => {
      if (e.key !== "Enter") return;
      if (primaryLabel) {
        if (primaryDisabled) return;
        e.preventDefault();
        onPrimary?.();
        return;
      }
      const btn = footerNode?.querySelector("button:not(:disabled)");
      if (btn) {
        e.preventDefault();
        btn.click();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [result, primaryLabel, primaryDisabled, onPrimary, footerNode]);

  // iOS Safari: when the virtual keyboard is open, `fixed` panels anchor to the
  // layout viewport (behind the keyboard). Track visualViewport offset so the
  // result panel stays above the keyboard.
  const [vvOffset, setVvOffset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      // offsetTop = distance keyboard pushed the visual viewport down from layout top
      setVvOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, []);

  const variant = result?.variant;
  // Persistent mascot on the exercise page itself: neutral while unanswered,
  // then reacts once graded. `result` resets to null on the next exercise,
  // so this naturally goes back to neutral without any extra reset logic.
  const mascotFaceState =
    variant === "correct" ? "positive" : variant === "skipped" ? "neutral" : variant === "wrong" ? "negative" : "neutral";
  const tone =
    variant === "correct"
      ? {
          wrap: "bg-gradient-to-br from-grass-50 to-white border-grass-400 dark:from-grass-500/15 dark:to-[#18181b] dark:border-grass-500/30",
          carpet: "rgba(88,204,2,0.28)",
          title: "text-grass-700 dark:text-grass-400",
          heading: pickFrom(
            (result?.combo || 0) >= 6 ? PRAISE_MEGA : (result?.combo || 0) >= 3 ? PRAISE_HOT : PRAISE_NORMAL
          ),
          btn: "btn3d-grass",
          medallion: "bg-grass-500 text-white",
        }
      : variant === "skipped"
      ? {
          wrap: "bg-slate-50 border-slate-200 dark:bg-white/[0.04] dark:border-white/[0.08]",
          carpet: "rgba(100,116,139,0.18)",
          title: "text-slate-600 dark:text-stone-300",
          heading: "Skipped",
          btn: "btn3d-neutral",
          medallion: "bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-stone-400",
        }
      : {
          wrap: "bg-gradient-to-br from-cardinal-50 to-pom-50 border-cardinal-300 dark:from-cardinal-500/15 dark:to-pom-500/15 dark:border-cardinal-500/30",
          carpet: "rgba(225,29,72,0.2)",
          title: "text-cardinal-600 dark:text-cardinal-400",
          heading: "Փորձիր նորից · Not quite",
          btn: "btn3d-cardinal",
          medallion: "bg-cardinal-500 text-white",
        };
  // Freeze the picked praise/encouragement line for the lifetime of this
  // result (re-deriving `tone` on every render would otherwise re-roll it).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const heading = useMemo(() => tone.heading, [variant, praiseIdx]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const wrongEncouragement = useMemo(() => pickFrom(WRONG_ENCOURAGEMENT), [praiseIdx]);

  return (
    <ExerciseFooterContext.Provider value={footerNode}>
    <div className="lesson-shell relative flex flex-col bg-white dark:bg-[#0d0d0f]">
      {/* Top bar */}
      <header className="shrink-0 bg-white dark:bg-[#18181b]">
        <div className="mx-auto flex max-w-2xl items-center gap-4 px-4 py-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Quit lesson"
            className="text-slate-400 transition hover:text-slate-600 active:scale-90 dark:text-stone-500 dark:hover:text-stone-300"
          >
            <X className="h-7 w-7" strokeWidth={3} />
          </button>

          {reviewCount > 0 ? (
            <button
              type="button"
              onClick={onReview}
              aria-label="Review this lesson so far"
              title="Review this lesson so far"
              className="text-slate-400 transition hover:text-slate-600 active:scale-90 dark:text-stone-500 dark:hover:text-stone-300"
            >
              <History className="h-6 w-6" strokeWidth={2.5} />
            </button>
          ) : null}

          <div className={"h-4 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10 transition-shadow duration-300 " + (justAdvanced ? "shadow-[0_0_0_3px_rgba(88,204,2,0.35)]" : "")}>
            <div
              className={"relative h-4 rounded-full bg-brand-500 transition-all duration-500 " + (justAdvanced ? "progress-pulse" : "")}
              style={{ width: `${Math.max(pct, 6)}%` }}
            >
              <span className="absolute left-2 right-2 top-1 h-1.5 rounded-full bg-white/40" />
            </div>
          </div>

          <HeartsBadge />
          <ReportProblem exerciseId={exerciseId} lessonId={lessonId} />
        </div>
        {title ? (
          <div className="mx-auto max-w-2xl px-4 pb-1">
            <div className="line-clamp-1 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-stone-500">
              {title}
            </div>
          </div>
        ) : null}
      </header>

      {instruction ? (
        <div className="shrink-0 border-b border-slate-100 bg-white dark:border-white/[0.06] dark:bg-[#18181b]">
          <div className="mx-auto max-w-2xl px-4 pb-2 pt-1">
            <div className="text-xs font-extrabold uppercase tracking-widest text-slate-400 dark:text-stone-500">{instruction}</div>
          </div>
        </div>
      ) : null}

      {/* Centers short exercise content vertically, same as `justify-center`
          would — but `margin: auto` on the child degrades gracefully instead
          of clipping when content is taller than the viewport (a known
          flexbox trap: `justify-content: center` on an overflowing
          container makes the far edge unreachable even with scroll). */}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 py-6">
        <div className="m-auto w-full">
          {!hideFooter ? (
            <div className="mb-2 flex justify-center">
              <img
                key={mascotFaceState}
                src={mascotFaceUrl(mascotCharacter, mascotFaceState)}
                alt=""
                aria-hidden="true"
                className="animate-pop h-40 w-40 object-contain sm:h-48 sm:w-48"
              />
            </div>
          ) : null}
          {children}
        </div>
      </main>

      {/* Bottom action bar — in-flow so it's always visible on mobile.
          Always rendered (when no result is showing) so its inner container
          can serve as the FooterSlot portal target: every exercise kind's
          Check button lands here, in the exact same screen position,
          whether it's driven by explicit primaryLabel props (Phase2Exercise)
          or portaled in by ExerciseRenderer via FooterSlot. */}
      {!result && !hideFooter ? (
        <div className="safe-b shrink-0 border-t-2 border-slate-100 bg-white dark:border-white/[0.06] dark:bg-[#18181b]">
          <div ref={setFooterNode} className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-5">
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
                className="btn3d btn3d-brand ml-auto min-w-[160px] uppercase"
              >
                {primaryLabel}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Result panel */}
      {result ? (
        <div className="fixed inset-0 z-[60] flex items-end" style={vvOffset ? { bottom: vvOffset } : undefined}>
          <div className="absolute inset-0 bg-black/10" />
          <div className={"relative w-full animate-pop border-t-4 " + tone.wrap}>
            {result.combo >= 3 ? (
              <div className="absolute -top-4 right-4 rounded-full bg-brand-500 px-3 py-1 text-xs font-extrabold text-white shadow-lg">
                {result.combo} in a row! 🔥
              </div>
            ) : null}
            <CarpetBorder color={tone.carpet} />
            <div className="safe-b mx-auto max-w-2xl px-4 py-5">
              <div className="flex items-center gap-4">
                {/* The mascot itself lives on the main exercise page (above the
                    content) and already reacted before this sheet slid up —
                    just a compact status medallion here, no duplicate face. */}
                <span
                  className={
                    "grid h-11 w-11 shrink-0 place-items-center rounded-full ring-2 ring-white shadow-sm " +
                    tone.medallion
                  }
                >
                  {variant === "correct" ? (
                    <StarMotif className="h-5 w-5" />
                  ) : variant === "skipped" ? (
                    <span className="text-base font-black">→</span>
                  ) : (
                    <span className="text-lg font-black">!</span>
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className={"font-display text-xl font-extrabold " + tone.title}>
                    {variant === "correct" && result.typo ? "Correct — mind the spelling" : heading}
                  </div>
                  <div className="text-sm font-bold text-slate-500 dark:text-stone-400">
                    {variant === "correct"
                      ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span>{`+${Number(result.xpEarned || 0)} XP earned`}</span>
                            {Number(result.comboBonusXp) > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-extrabold text-brand-700 dark:bg-brand-500/20 dark:text-brand-400">
                                <Sparkles className="h-3 w-3" /> +{Number(result.comboBonusXp)} combo
                              </span>
                            ) : null}
                          </div>
                          {result.typo && result.correctAnswer ? (
                            <div className="mt-1.5 flex items-start gap-2 text-amber-700 dark:text-amber-400">
                              <div className="min-w-0 flex-1">
                                {result.userAnswer && DIFFABLE_KINDS.has(result.kind) ? (
                                  <AnswerDiff typed={result.userAnswer} correct={result.correctAnswer} />
                                ) : (
                                  <>
                                    <span className="text-xs font-bold">Correct spelling:</span>{" "}
                                    <span className="font-display text-base font-extrabold text-slate-800 dark:text-white">{result.correctAnswer}</span>
                                  </>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => speakText(result.correctAnswer)}
                                className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/70 text-amber-600 shadow-sm ring-1 ring-amber-200 transition hover:bg-white dark:bg-white/10 dark:text-amber-400 dark:ring-amber-500/30 dark:hover:bg-white/20"
                                aria-label="Hear pronunciation"
                              >
                                <Volume2 className="h-3 w-3" />
                              </button>
                            </div>
                          ) : null}
                        </>
                      )
                      : variant === "skipped"
                      ? "No XP gained"
                      : (
                        <>
                          {result.correctAnswer ? (
                            <div className="mb-1 flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                {result.userAnswer && DIFFABLE_KINDS.has(result.kind) ? (
                                  <AnswerDiff typed={result.userAnswer} correct={result.correctAnswer} />
                                ) : (
                                  <div className="font-display text-base font-extrabold text-cardinal-700 dark:text-cardinal-400">
                                    Correct: <span className="text-slate-800 dark:text-white">{result.correctAnswer}</span>
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => speakText(result.correctAnswer)}
                                className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/70 text-cardinal-500 shadow-sm ring-1 ring-cardinal-200 transition hover:bg-white dark:bg-white/10 dark:text-cardinal-400 dark:ring-cardinal-500/30 dark:hover:bg-white/20"
                                aria-label="Hear pronunciation"
                              >
                                <Volume2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : null}
                          <div>{result.detail || wrongEncouragement}</div>
                          {result.exerciseId ? (
                            <ExplainMistake exerciseId={result.exerciseId} userAnswer={result.userAnswer} />
                          ) : null}
                        </>
                      )}
                  </div>
                  {result.subtext ? (
                    <div className="text-xs font-semibold text-slate-400 dark:text-stone-500">{result.subtext}</div>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                onClick={onResultPrimary}
                className={"btn3d mt-4 w-full uppercase " + tone.btn}
              >
                {result.primaryLabel || (variant === "wrong" ? "Got it" : "Continue")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    </ExerciseFooterContext.Provider>
  );
}
