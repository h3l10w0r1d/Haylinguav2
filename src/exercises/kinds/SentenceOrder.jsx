// src/exercises/kinds/SentenceOrder.jsx
import React, { useEffect, useState } from "react";
import { Card, Title, Muted, PrimaryButton, SecondaryButton, Pill, normalizeText } from "../ui";

export default function SentenceOrder({ exercise, cfg, correct, wrong, onSkip, onAnswer }) {
  const prompt = exercise?.prompt || "Put the sentence in order";
  const expected = exercise?.expected_answer;

  const tokens = cfg.tokens ?? [];
  const solution = cfg.solution ?? null;
  const solutionIndices = cfg.solutionIndices ?? null;

  // SO-1: represent each token as {t: string, k: originalIndex} so duplicate
  // words remain distinguishable and index-based grading works correctly.
  const rawTokens = tokens.map((t, i) => ({ t, k: i }));

  const [picked, setPicked] = useState([]);
  const [available, setAvailable] = useState(rawTokens);

  // SO-2: reset when exercise ID changes OR when tokens change (to avoid stale
  // available state if the same exercise ID is re-used with different tokens).
  useEffect(() => {
    const fresh = (cfg.tokens ?? []).map((t, i) => ({ t, k: i }));
    setPicked([]);
    setAvailable(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id, JSON.stringify(cfg.tokens)]);

  const canCheck = picked.length > 0;

  function removePicked(idx) {
    const token = picked[idx];
    setPicked((p) => p.filter((_, i) => i !== idx));
    setAvailable((a) => [...a, token]);
  }

  function addToken(idx) {
    const token = available[idx];
    setAvailable((a) => a.filter((_, i) => i !== idx));
    setPicked((p) => [...p, token]);
  }

  return (
    <Card>
      <Title>{prompt}</Title>

      <div className="mt-4 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4 min-h-[4.5rem]">
        <div className="flex flex-wrap gap-2">
          {picked.length === 0 ? (
            <Muted>Tap words below to build the sentence…</Muted>
          ) : (
            picked.map((item, i) => (
              <Pill key={`${item.k}-${i}`} onClick={() => removePicked(i)} active>
                {item.t}
              </Pill>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {available.map((item, i) => (
          <Pill key={`${item.k}-${i}`} onClick={() => addToken(i)}>
            {item.t}
          </Pill>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            if (Array.isArray(solution)) {
              // solution is an array of strings — compare text
              const pickedTexts = picked.map((item) => item.t);
              const ok =
                solution.length === pickedTexts.length &&
                solution.every((v, i) => normalizeText(v) === normalizeText(pickedTexts[i]));
              return ok ? correct() : wrong("Word order is incorrect. Try again.");
            }

            if (Array.isArray(solutionIndices)) {
              // SO-1: use the stored original index (.k) instead of indexOf()
              // so duplicate tokens don't collapse to the same index.
              const builtIndices = picked.map((item) => item.k);
              const ok =
                solutionIndices.length === builtIndices.length &&
                solutionIndices.every((v, i) => Number(v) === Number(builtIndices[i]));
              return ok ? correct() : wrong("Word order is incorrect. Try again.");
            }

            const builtSentence = picked.map((item) => item.t).join(" ");
            const answer = expected ?? cfg.answer ?? "";
            if (normalizeText(builtSentence) === normalizeText(answer)) correct();
            else wrong("Word order is incorrect. Try again.");
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
