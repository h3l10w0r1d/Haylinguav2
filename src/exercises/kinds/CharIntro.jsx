// src/exercises/kinds/CharIntro.jsx
import React from "react";
import { Card, Title, Muted, PrimaryButton, SecondaryButton } from "../ui";

export default function CharIntro({ exercise, cfg, correct, onSkip, onAnswer }) {
  const prompt = exercise?.prompt || "New letter";
  const letter = cfg.letter ?? "";
  const lower = cfg.lower ?? "";
  const transliteration = cfg.transliteration ?? "";
  const hint = cfg.hint ?? "";

  return (
    <Card>
      <Title>{prompt}</Title>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white">
          {letter}
        </div>
        <div className="text-3xl md:text-4xl font-extrabold text-slate-700 dark:text-stone-200">
          {lower}
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4 dark:bg-white/[0.04] dark:ring-white/[0.08]">
        {transliteration && (
          <Muted>
            Sounds like:{" "}
            <span className="font-semibold text-slate-800 dark:text-white">
              {transliteration}
            </span>
          </Muted>
        )}
        {hint && <Muted className="mt-2">{hint}</Muted>}
      </div>

      <div className="mt-6 space-y-3">
        <PrimaryButton onClick={() => correct(0)}>Continue</PrimaryButton>
        <SecondaryButton
          onClick={() => {
            onSkip?.();
            onAnswer?.({ skipped: true, isCorrect: true, xpEarned: 0 });
          }}
        >
          Skip
        </SecondaryButton>
      </div>
    </Card>
  );
}
