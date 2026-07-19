// src/exercises/kinds/CharBuildWord.js — ports ExCharBuildWord. Tap letter
// tiles in order to build a word — no drag library needed (confirmed by
// reading the web source: tiles are tapped, not dragged).
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export default function CharBuildWord({ exercise, onSubmit, onAdvance }) {
  const cfg = exercise.config || {};
  const tiles = cfg.tiles ?? [];
  const solution = cfg.solutionIndices ?? [];
  const targetWord = cfg.targetWord;

  const [chosen, setChosen] = useState([]);
  const [used, setUsed] = useState(new Set());
  const [graded, setGraded] = useState(null);

  useEffect(() => {
    setChosen([]);
    setUsed(new Set());
    setGraded(null);
  }, [exercise.id]);

  const built = chosen.map((i) => tiles[i]).join('');
  const canCheck = chosen.length > 0 && !graded;

  function reset() {
    setChosen([]);
    setUsed(new Set());
  }

  function pick(idx) {
    if (used.has(idx) || graded) return;
    const next = new Set(used);
    next.add(idx);
    setUsed(next);
    setChosen((prev) => [...prev, idx]);
  }

  function check() {
    const solutionIndices = solution.length > 0 ? solution : null;
    const ok = solutionIndices
      ? solutionIndices.length === chosen.length && solutionIndices.every((v, i) => Number(v) === Number(chosen[i]))
      : built.trim() === (targetWord ?? '').trim();
    setGraded({ ok });
    onSubmit({ selectedIndices: chosen, answerText: built });
  }

  return (
    <View className="flex-1 justify-between">
      <View>
        <Text className="text-lg font-extrabold text-stone-900">{exercise.prompt || 'Build the word'}</Text>
        {!!targetWord && (
          <Text className="mt-1 text-sm font-semibold text-stone-500">
            Target: <Text className="font-bold text-stone-800">{targetWord}</Text>
          </Text>
        )}

        <View className="mt-4 rounded-2xl bg-stone-100 p-4">
          <Text className="min-h-[2.5rem] text-2xl font-extrabold text-stone-900">{built || '…'}</Text>
          <TouchableOpacity
            onPress={reset}
            disabled={chosen.length === 0 || !!graded}
            className="mt-3 self-start rounded-xl bg-white px-4 py-2"
          >
            <Text className="text-sm font-bold text-stone-600">Reset</Text>
          </TouchableOpacity>
        </View>

        <View className="mt-4 flex-row flex-wrap" style={{ gap: 8 }}>
          {tiles.map((t, idx) => {
            const isUsed = used.has(idx);
            return (
              <TouchableOpacity
                key={idx}
                disabled={isUsed || !!graded}
                onPress={() => pick(idx)}
                className={'rounded-xl border-2 px-4 py-2.5 ' + (isUsed ? 'border-stone-200 bg-stone-100' : 'border-stone-200 bg-white')}
              >
                <Text className={'text-lg font-bold ' + (isUsed ? 'text-stone-300' : 'text-stone-800')}>{t}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {graded && (
          <Text className={'mt-4 text-sm font-bold ' + (graded.ok ? 'text-grass-600' : 'text-cardinal-600')}>
            {graded.ok ? 'Correct!' : 'The order is off.'}
          </Text>
        )}
      </View>

      <TouchableOpacity
        onPress={graded ? onAdvance : check}
        disabled={!canCheck && !graded}
        className={'items-center rounded-2xl py-4 ' + (canCheck || graded ? 'bg-brand-500' : 'bg-stone-300')}
      >
        <Text className="text-base font-extrabold text-white">{graded ? 'Continue' : 'Check'}</Text>
      </TouchableOpacity>
    </View>
  );
}
