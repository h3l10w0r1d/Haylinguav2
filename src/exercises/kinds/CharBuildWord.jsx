// src/exercises/kinds/CharBuildWord.jsx
import React, { useEffect, useState } from "react";
import { Card, Title, Muted, PrimaryButton, SecondaryButton, Pill } from "../ui";

export default function CharBuildWord({ exercise, cfg, correct, wrong, onSkip, onAnswer }) {
  const prompt = exercise?.prompt || "Build the word";
  const tiles = cfg.tiles ?? [];
  const solution = cfg.solutionIndices ?? [];
  const targetWord = cfg.targetWord;

  const [chosen, setChosen] = useState([]);
  const [used, setUsed] = useState(new Set());

  useEffect(() => {
    setChosen([]);
    setUsed(new Set());
  }, [exercise?.id]);

  const built = chosen.map((i) => tiles[i]).join("");
  const canCheck = chosen.length > 0;

  function reset() {
    setChosen([]);
    setUsed(new Set());
  }

  return (
    <Card>
      <Title>{prompt}</Title>
      {targetWord && (
        <Muted className="mt-2">
          Target: <span className="font-semibold text-slate-800 dark:text-white">{targetWord}</span>
        </Muted>
      )}

      <div className="mt-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4 dark:bg-white/[0.04] dark:ring-white/[0.08]">
        <div className="text-2xl font-extrabold text-slate-900 min-h-[2.5rem] dark:text-white">
          {built || "…"}
        </div>
        <div className="mt-3 flex gap-2">
          <SecondaryButton onClick={reset} disabled={chosen.length === 0}>
            Reset
          </SecondaryButton>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tiles.map((t, idx) => {
          const isUsed = used.has(idx);
          return (
            <Pill
              key={idx}
              disabled={isUsed}
              onClick={() => {
                if (isUsed) return;
                const next = new Set(used);
                next.add(idx);
                setUsed(next);
                setChosen((prev) => [...prev, idx]);
              }}
            >
              {t}
            </Pill>
          );
        })}
      </div>

      <div className="mt-6 space-y-3">
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            // CB-1: primary check — exact tile-index order (as authored in CMS)
            const exactOk =
              solution.length === chosen.length &&
              solution.every((v, i) => Number(v) === Number(chosen[i]));

            // CB-1: fallback — build the word from chosen tile indices and
            // compare to targetWord (handles valid duplicate-char rearrangements
            // that produce the same word via a different index sequence)
            const builtWord = chosen.map((i) => tiles[Number(i)]).join("");
            const computedTarget =
              targetWord ?? solution.map((i) => tiles[Number(i)]).join("");
            const wordOk = computedTarget !== "" && builtWord === computedTarget;

            const ok = exactOk || wordOk;
            ok ? correct() : wrong("The order is off. Try again.");
          }}
        >
          Check
        </PrimaryButton>

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
