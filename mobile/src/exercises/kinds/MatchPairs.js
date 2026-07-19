// src/exercises/kinds/MatchPairs.js — ports ExMatchPairs. Tap-based
// left/right column matching — no drag library needed. Tap a left item to
// select it, then tap a right item to attempt a match; correct matches lock
// in place. Once all pairs are matched, submits the whole mapping at once.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { normalizeText } from '../choiceHelpers';

export default function MatchPairs({ exercise, onSubmit, onAdvance }) {
  const cfg = exercise.config || {};
  const pairs = Array.isArray(cfg.pairs) ? cfg.pairs : [];
  const left = pairs.map((p) => p.left);
  const right = pairs.map((p) => p.right);

  const shuffledRight = useMemo(() => {
    const arr = [...right];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  const [selectedLeft, setSelectedLeft] = useState(null);
  const [matchedLeft, setMatchedLeft] = useState(new Set());
  const [matchedRight, setMatchedRight] = useState(new Set());
  const [matchedPairs, setMatchedPairs] = useState([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setSelectedLeft(null);
    setMatchedLeft(new Set());
    setMatchedRight(new Set());
    setMatchedPairs([]);
    setDone(false);
  }, [exercise.id]);

  const totalMatches = pairs.length;
  const currentMatches = matchedLeft.size;

  function tryMatch(lIdx, rIdx) {
    const l = left[lIdx];
    const r = shuffledRight[rIdx];

    const correctPair = pairs.find((p) => normalizeText(p.left) === normalizeText(l));
    if (correctPair && normalizeText(correctPair.right) === normalizeText(r)) {
      const nl = new Set(matchedLeft);
      nl.add(lIdx);
      setMatchedLeft(nl);

      const nr = new Set(matchedRight);
      nr.add(rIdx);
      setMatchedRight(nr);

      setSelectedLeft(null);

      const nextPairs = [...matchedPairs, { left: l, right: r }];
      setMatchedPairs(nextPairs);

      if (nl.size === totalMatches) {
        setDone(true);
        onSubmit({ answerText: JSON.stringify(nextPairs) });
      }
    } else {
      setSelectedLeft(null);
    }
  }

  return (
    <View className="flex-1 justify-between">
      <View className="flex-1">
        <Text className="text-lg font-extrabold text-stone-900">{exercise.prompt || 'Match the pairs'}</Text>
        <Text className="mt-1 text-sm font-semibold text-stone-500">
          Matched: {currentMatches} / {totalMatches}
        </Text>

        <View className="mt-4 flex-row" style={{ gap: 12 }}>
          <View className="flex-1" style={{ gap: 8 }}>
            {left.map((t, idx) => {
              const isDone = matchedLeft.has(idx);
              const active = selectedLeft === idx;
              return (
                <TouchableOpacity
                  key={idx}
                  disabled={isDone}
                  onPress={() => setSelectedLeft(idx)}
                  className={
                    'rounded-xl border-2 px-3 py-3 ' +
                    (isDone
                      ? 'border-stone-200 bg-stone-100'
                      : active
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-stone-200 bg-white')
                  }
                >
                  <Text className={'text-sm font-semibold ' + (isDone ? 'text-stone-400' : 'text-stone-800')}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View className="flex-1" style={{ gap: 8 }}>
            {shuffledRight.map((t, idx) => {
              const isDone = matchedRight.has(idx);
              return (
                <TouchableOpacity
                  key={idx}
                  disabled={isDone || selectedLeft === null}
                  onPress={() => tryMatch(selectedLeft, idx)}
                  className={
                    'rounded-xl border-2 px-3 py-3 ' +
                    (isDone ? 'border-stone-200 bg-stone-100' : 'border-stone-200 bg-white')
                  }
                >
                  <Text className={'text-sm font-semibold ' + (isDone ? 'text-stone-400' : 'text-stone-800')}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <TouchableOpacity
        onPress={onAdvance}
        disabled={!done}
        className={'items-center rounded-2xl py-4 ' + (done ? 'bg-brand-500' : 'bg-stone-300')}
      >
        <Text className="text-base font-extrabold text-white">Continue</Text>
      </TouchableOpacity>
    </View>
  );
}
