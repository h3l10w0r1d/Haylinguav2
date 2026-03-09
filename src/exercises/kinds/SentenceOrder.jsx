// src/exercises/kinds/SentenceOrder.jsx
import React, { useEffect, useState } from "react";
import { Card, Title, Muted, PrimaryButton, SecondaryButton, Pill, normalizeText } from "../ui";

export default function SentenceOrder({ exercise, cfg, correct, wrong, onSkip, onAnswer }) {
  const prompt = exercise?.prompt || "Put the sentence in order";
  const expected = exercise?.expected_answer;

  const tokens = cfg.tokens ?? [];
  const solution = cfg.solution ?? null;
  const solutionIndices = cfg.solutionIndices ?? null;

  const [picked, setPicked] = useState([]);
  const [available, setAvailable] = useState(tokens);

  useEffect(() => {
    setPicked([]);
    setAvailable(tokens);
  }, [exercise?.id]); // important: re-init when exercise changes

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
            picked.map((t, i) => (
              <Pill key={`${t}-${i}`} onClick={() => removePicked(i)} active>
                {t}
              </Pill>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {available.map((t, i) => (
          <Pill key={`${t}-${i}`} onClick={() => addToken(i)}>
            {t}
          </Pill>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            if (Array.isArray(solution)) {
              const ok =
                solution.length === picked.length &&
                solution.every((v, i) => normalizeText(v) === normalizeText(picked[i]));
              return ok ? correct() : wrong("Word order is incorrect. Try again.");
            }

            if (Array.isArray(solutionIndices)) {
              const builtIndices = picked.map((t) => tokens.indexOf(t));
              const ok =
                solutionIndices.length === builtIndices.length &&
                solutionIndices.every((v, i) => Number(v) === Number(builtIndices[i]));
              return ok ? correct() : wrong("Word order is incorrect. Try again.");
            }

            const builtSentence = picked.join(" ");
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
