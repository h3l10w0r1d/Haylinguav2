// src/ExerciseShell.jsx
import React, { useEffect, useRef, useState } from "react";
import { X, Heart, Volume2, Sparkles, HelpCircle, Loader2 } from "lucide-react";

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
    const audio = new Audio(url);
    audio.play();
    audio.onended = () => URL.revokeObjectURL(url);
  } catch {}
}
import { StarMotif, CarpetBorder } from "./lib/motifs";
import { readHearts } from "./lib/hearts";
import ReportProblem from "./ReportProblem";
import Illustration from "./lib/Illustration";

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
    <div className={"flex items-center gap-1.5 font-display text-lg font-extrabold " + (shaking ? "heart-shake text-red-600" : "text-cardinal-500")}>
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
        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-extrabold text-cardinal-600 shadow-sm ring-1 ring-cardinal-200 transition hover:bg-white disabled:opacity-60"
      >
        {state === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HelpCircle className="h-3.5 w-3.5" />}
        {state === "loading" ? "Thinking…" : "Why was this wrong?"}
      </button>
    );
  }
  return (
    <div className="mt-2 rounded-xl bg-white/70 p-3 text-sm font-semibold leading-snug text-slate-700 shadow-sm ring-1 ring-cardinal-100">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-cardinal-500">
        <Sparkles className="h-3.5 w-3.5" /> Explanation
      </div>
      {text}
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
  exerciseId,
  lessonId,
  instruction,
  children,
}) {
  const pct = total > 0 ? Math.round((step / total) * 100) : 0;

  // Brief full-screen flash when an answer is submitted (green correct, red wrong).
  const [flashClass, setFlashClass] = useState(null);
  const [flashKey, setFlashKey] = useState(0);
  useEffect(() => {
    if (!result) return;
    const cls = result.variant === "correct" ? "answer-flash-correct" : result.variant === "wrong" ? "answer-flash-wrong" : null;
    if (!cls) return;
    setFlashKey((k) => k + 1);
    setFlashClass(cls);
    const t = setTimeout(() => setFlashClass(null), 520);
    return () => clearTimeout(t);
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const tone =
    variant === "correct"
      ? {
          wrap: "bg-gradient-to-br from-amber-50 to-brand-50 border-gold-400",
          carpet: "rgba(255,200,0,0.35)",
          title: "text-brand-700",
          heading: "Ապրե՛ս! · Correct",
          btn: "btn3d-brand",
          medallion: "bg-gold-500 text-white",
        }
      : variant === "skipped"
      ? {
          wrap: "bg-slate-50 border-slate-200",
          carpet: "rgba(100,116,139,0.18)",
          title: "text-slate-600",
          heading: "Skipped",
          btn: "btn3d-neutral",
          medallion: "bg-slate-200 text-slate-500",
        }
      : {
          wrap: "bg-gradient-to-br from-cardinal-50 to-pom-50 border-cardinal-300",
          carpet: "rgba(225,29,72,0.2)",
          title: "text-cardinal-600",
          heading: "Փորձիր նորից · Not quite",
          btn: "btn3d-cardinal",
          medallion: "bg-cardinal-500 text-white",
        };

  return (
    <div className="lesson-shell relative flex flex-col bg-white">
      {/* Full-screen answer flash */}
      {flashClass ? (
        <div
          key={flashKey}
          className={"pointer-events-none absolute inset-0 z-50 " + flashClass}
          aria-hidden
        />
      ) : null}

      {/* Top bar */}
      <header className="shrink-0 bg-white">
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
          <ReportProblem exerciseId={exerciseId} lessonId={lessonId} />
        </div>
        {title ? (
          <div className="mx-auto max-w-3xl px-4 pb-1">
            <div className="line-clamp-1 text-xs font-bold uppercase tracking-wide text-slate-400">
              {title}
            </div>
          </div>
        ) : null}
      </header>

      {instruction ? (
        <div className="shrink-0 border-b border-slate-100 bg-white">
          <div className="mx-auto max-w-3xl px-4 pb-2 pt-1">
            <div className="text-xs font-extrabold uppercase tracking-widest text-slate-400">{instruction}</div>
          </div>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6">{children}</main>

      {/* Bottom action bar — in-flow so it's always visible on mobile */}
      {(primaryLabel || secondaryLabel) && !result ? (
        <div className="safe-b shrink-0 border-t-2 border-slate-100 bg-white">
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
                className="btn3d btn3d-brand ml-auto min-w-[140px] uppercase"
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
            <div className="safe-b mx-auto max-w-3xl px-4 py-5">
              <div className="flex items-center gap-4">
                {/* Tatik reacts */}
                <div className="relative shrink-0">
                  <Illustration
                    name={variant === "correct" ? "mascot-cheer" : "mascot-sad"}
                    className="block h-16 w-16 rounded-2xl object-cover shadow-sm"
                  />
                  <span
                    className={
                      "absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full ring-2 ring-white " +
                      tone.medallion
                    }
                  >
                    {variant === "correct" ? (
                      <StarMotif className="h-4 w-4" />
                    ) : variant === "skipped" ? (
                      <span className="text-xs font-black">→</span>
                    ) : (
                      <span className="text-sm font-black">!</span>
                    )}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className={"font-display text-xl font-extrabold " + tone.title}>
                    {variant === "correct" && result.typo ? "Correct — mind the spelling" : tone.heading}
                  </div>
                  <div className="text-sm font-bold text-slate-500">
                    {variant === "correct"
                      ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span>{`+${Number(result.xpEarned || 0)} XP earned`}</span>
                            {Number(result.comboBonusXp) > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-extrabold text-brand-700">
                                <Sparkles className="h-3 w-3" /> +{Number(result.comboBonusXp)} combo
                              </span>
                            ) : null}
                          </div>
                          {result.typo && result.correctAnswer ? (
                            <div className="mt-1 flex items-center gap-2 text-amber-700">
                              <span className="text-xs font-bold">Correct spelling:</span>
                              <span className="font-display text-base font-extrabold text-slate-800">{result.correctAnswer}</span>
                              <button
                                type="button"
                                onClick={() => speakText(result.correctAnswer)}
                                className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/70 text-amber-600 shadow-sm ring-1 ring-amber-200 transition hover:bg-white"
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
                            <div className="mb-1 flex items-center gap-2">
                              <div className="font-display text-base font-extrabold text-cardinal-700">
                                Correct: <span className="text-slate-800">{result.correctAnswer}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => speakText(result.correctAnswer)}
                                className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/70 text-cardinal-500 shadow-sm ring-1 ring-cardinal-200 transition hover:bg-white"
                                aria-label="Hear pronunciation"
                              >
                                <Volume2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : null}
                          <div>{result.detail || "You’ve got this — give it another go."}</div>
                          {result.exerciseId ? (
                            <ExplainMistake exerciseId={result.exerciseId} userAnswer={result.userAnswer} />
                          ) : null}
                        </>
                      )}
                  </div>
                  {result.subtext ? (
                    <div className="text-xs font-semibold text-slate-400">{result.subtext}</div>
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
  );
}
