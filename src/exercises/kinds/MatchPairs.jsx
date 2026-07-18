// src/exercises/kinds/MatchPairs.jsx
import React, { useMemo, useState } from "react";
import { Card, Title, Muted, SecondaryButton, normalizeText, cx } from "../ui";

export default function MatchPairs({ exercise, cfg, correct, wrong, onSkip, onAnswer }) {
  const prompt = exercise?.prompt || "Match the pairs";
  const pairs = Array.isArray(cfg.pairs) ? cfg.pairs : [];

  // MP-3: track items by index so duplicate left values are distinguishable
  const left = pairs.map((p, i) => ({ t: p.left, idx: i }));
  const right = pairs.map((p, i) => ({ t: p.right, idx: i }));

  // MP-1: include pairsKey (content hash) in memo deps so stale shuffles are
  // busted when pairs change even if the exercise ID stays the same.
  const pairsKey = pairs.map((p) => p.left + "\x00" + p.right).join("|");
  const shuffledRight = useMemo(() => {
    const arr = [...right];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [exercise?.id, pairsKey]); // MP-1 fix

  const [selectedLeft, setSelectedLeft] = useState(null);
  const [matchedLeft, setMatchedLeft] = useState(new Set());
  const [matchedRight, setMatchedRight] = useState(new Set());

  const totalMatches = pairs.length;

  function tryMatch(lItemIdx, rShuffledIdx) {
    const lItem = left[lItemIdx];
    const rItem = shuffledRight[rShuffledIdx];

    // MP-3: use index-based lookup instead of text-find so duplicate left
    // values always find their own correct right value.
    const correctPair = pairs[lItem.idx];
    if (correctPair && normalizeText(correctPair.right) === normalizeText(rItem.t)) {
      const nl = new Set(matchedLeft);
      nl.add(lItemIdx);
      setMatchedLeft(nl);

      const nr = new Set(matchedRight);
      nr.add(rShuffledIdx);
      setMatchedRight(nr);

      setSelectedLeft(null);

      if (nl.size === totalMatches) correct();
    } else {
      wrong("Not a match. Try again.");
      setSelectedLeft(null); // MP-2: clear stale selection after wrong answer
    }
  }

  return (
    <Card>
      <Title>{prompt}</Title>
      <Muted className="mt-2">
        Matched:{" "}
        <span className="font-semibold text-slate-800 dark:text-white">{matchedLeft.size}</span> /{" "}
        {totalMatches}
      </Muted>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          {left.map((item, idx) => {
            const done = matchedLeft.has(idx);
            const active = selectedLeft === idx;
            return (
              <button
                key={idx}
                disabled={done}
                onClick={() => setSelectedLeft(idx)}
                className={cx(
                  "w-full rounded-xl px-4 py-3 font-semibold text-left ring-1 transition",
                  done
                    ? "bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed dark:bg-white/[0.06] dark:text-stone-500 dark:ring-white/[0.08]"
                    : active
                    ? "bg-orange-50 text-orange-800 ring-orange-300 dark:bg-orange-500/15 dark:text-orange-400 dark:ring-orange-500/30"
                    : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50 dark:bg-[#18181b] dark:text-white dark:ring-white/[0.08] dark:hover:bg-white/[0.04]"
                )}
              >
                {item.t}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {shuffledRight.map((item, idx) => {
            const done = matchedRight.has(idx);
            const disabled = done || selectedLeft === null;
            return (
              <button
                key={idx}
                disabled={disabled}
                onClick={() => {
                  if (selectedLeft === null) return;
                  tryMatch(selectedLeft, idx);
                }}
                className={cx(
                  "w-full rounded-xl px-4 py-3 font-semibold text-left ring-1 transition",
                  disabled
                    ? "bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed dark:bg-white/[0.06] dark:text-stone-500 dark:ring-white/[0.08]"
                    : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50 dark:bg-[#18181b] dark:text-white dark:ring-white/[0.08] dark:hover:bg-white/[0.04]"
                )}
              >
                {item.t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 space-y-3">
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
