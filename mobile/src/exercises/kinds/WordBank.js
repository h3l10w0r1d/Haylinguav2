// src/exercises/kinds/WordBank.js — ports ExWordBank. Tap word tiles
// (translation + distractors) to build the answer sentence. The web version
// also offers a "type with keyboard" toggle for a harder mode — omitted here,
// tap-to-build is the primary path and matches every other tap-based kind.
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { normalizeText } from '../choiceHelpers';

export default function WordBank({ exercise, onSubmit, onAdvance }) {
  const cfg = exercise.config || {};
  const source = cfg.sentence ?? cfg.prompt ?? '';
  const tiles = Array.isArray(cfg.tiles) ? cfg.tiles : [];
  const solution = Array.isArray(cfg.solution) ? cfg.solution : [];

  const [picked, setPicked] = useState([]);
  const [available, setAvailable] = useState([]);
  const [graded, setGraded] = useState(null);

  useEffect(() => {
    setPicked([]);
    setAvailable(tiles.map((t, i) => ({ t, key: `${i}-${t}` })));
    setGraded(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  const built = picked.map((p) => p.t).join(' ');
  const canCheck = picked.length > 0 && !graded;

  function add(idx) {
    if (graded) return;
    const item = available[idx];
    if (!item) return;
    setAvailable((a) => a.filter((_, i) => i !== idx));
    setPicked((p) => [...p, item]);
  }
  function remove(idx) {
    if (graded) return;
    const item = picked[idx];
    if (!item) return;
    setPicked((p) => p.filter((_, i) => i !== idx));
    setAvailable((a) => [...a, item]);
  }

  function check() {
    const picks = picked.map((p) => p.t);
    const ok = solution.length === picks.length && solution.every((v, i) => normalizeText(v) === normalizeText(picks[i]));
    const altOk = normalizeText(built) === normalizeText(solution.join(' '));
    setGraded({ ok: ok || altOk });
    onSubmit({ answerText: built });
  }

  return (
    <View className="flex-1 justify-between">
      <View>
        <Text className="text-lg font-extrabold text-stone-900">{exercise.prompt || 'Translate this'}</Text>

        {!!source && (
          <View className="mt-4 rounded-2xl bg-stone-100 p-4">
            <Text className="text-lg font-semibold text-stone-900">{source}</Text>
          </View>
        )}

        <View className="mt-4 min-h-[56px] rounded-2xl border-b-2 border-dashed border-stone-300 bg-white p-3">
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {picked.length === 0 ? (
              <Text className="text-sm font-semibold text-stone-400">Tap words to build your answer…</Text>
            ) : (
              picked.map((p, i) => (
                <TouchableOpacity key={p.key} onPress={() => remove(i)} className="rounded-xl border-2 border-brand-500 bg-brand-50 px-3 py-2">
                  <Text className="text-base font-bold text-brand-700">{p.t}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>

        <View className="mt-4 flex-row flex-wrap" style={{ gap: 8 }}>
          {available.map((p, i) => (
            <TouchableOpacity key={p.key} onPress={() => add(i)} className="rounded-xl border-2 border-stone-200 bg-white px-3 py-2">
              <Text className="text-base font-semibold text-stone-800">{p.t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {graded && (
          <Text className={'mt-4 text-sm font-bold ' + (graded.ok ? 'text-grass-600' : 'text-cardinal-600')}>
            {graded.ok ? 'Correct!' : 'Not quite — check the word order.'}
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
