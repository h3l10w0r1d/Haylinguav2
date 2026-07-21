// src/exercises/SpeechBubbleMascot.jsx
// Duolingo-style presentation: a small mascot avatar with a speech bubble
// (pointer tail toward the character) holding the exercise's prompt/target
// text, optionally with inline play/slow buttons when the text is audio.
// Shared across every exercise kind that shows a sentence/word for the
// learner to look at or listen to, so that presentation is consistent
// instead of each kind inventing its own box.
import { mascotFaceUrl } from "../lib/mascotFaces";

export default function SpeechBubbleMascot({
  character = "armen",
  text,
  onPlay,
  onSlow,
  busy = false,
  playDisabled = false,
}) {
  return (
    <div className="flex items-end gap-2.5">
      <img
        src={mascotFaceUrl(character, "neutral")}
        alt=""
        aria-hidden="true"
        className="h-14 w-14 shrink-0 object-contain sm:h-16 sm:w-16"
      />
      <div className="relative min-w-0 flex-1 rounded-2xl rounded-bl-sm bg-slate-50 px-4 py-3 ring-1 ring-slate-200 dark:bg-white/[0.05] dark:ring-white/[0.08]">
        <div className="flex items-center gap-2.5">
          {onPlay ? (
            <button
              type="button"
              onClick={onPlay}
              disabled={playDisabled || busy}
              aria-label="Play audio"
              className={
                "grid h-9 w-9 shrink-0 place-items-center rounded-full text-white transition active:translate-y-0.5 " +
                (busy ? "bg-slate-300" : "bg-brand-500 hover:bg-brand-600")
              }
            >
              🔊
            </button>
          ) : null}
          <div className="min-w-0 flex-1 text-base font-bold leading-snug text-slate-800 dark:text-white">
            {text}
          </div>
        </div>
        {onSlow ? (
          <button
            type="button"
            onClick={onSlow}
            disabled={playDisabled || busy}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-slate-400 transition hover:text-slate-600 disabled:opacity-50 dark:text-stone-500 dark:hover:text-stone-300"
          >
            🐢 Slow
          </button>
        ) : null}
      </div>
    </div>
  );
}
