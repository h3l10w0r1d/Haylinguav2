// src/exercises/kinds/WordBank.js — ports ExWordBank. Tap word tiles
// (translation + distractors) to build the answer sentence. The web version
// also offers a "type with keyboard" toggle for a harder mode — omitted here,
// tap-to-build is the primary path and matches every other tap-based kind.
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Languages } from 'lucide-react-native';
import { normalizeText } from '../choiceHelpers';
import Pressable3D from '../../components/Pressable3D';
import ExerciseEyebrow from '../ExerciseEyebrow';
import { haptics } from '../../lib/haptics';

export default function WordBank({ exercise, onSubmit, onCheckStateChange }) {
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
    haptics.impact();
    setAvailable((a) => a.filter((_, i) => i !== idx));
    setPicked((p) => [...p, item]);
  }
  function remove(idx) {
    if (graded) return;
    const item = picked[idx];
    if (!item) return;
    haptics.impact();
    setPicked((p) => p.filter((_, i) => i !== idx));
    setAvailable((a) => [...a, item]);
  }

  function check() {
    const picks = picked.map((p) => p.t);
    const ok = solution.length === picks.length && solution.every((v, i) => normalizeText(v) === normalizeText(picks[i]));
    const altOk = normalizeText(built) === normalizeText(solution.join(' '));
    const isOk = ok || altOk;
    setGraded({ ok: isOk });
    if (isOk) haptics.success();
    else haptics.error();
    onSubmit({ answerText: built, isCorrect: isOk });
  }

  useEffect(() => {
    onCheckStateChange?.({ canCheck, run: graded ? null : check });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, graded]);

  return (
    <View className="flex-1">
      <ExerciseEyebrow icon={Languages} label="Translate" color="#E0A800" tint="#FFF8E1" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'Translate this'}</Text>

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
              <Pressable3D key={p.key} onPress={() => remove(i)} hapticOnPress={false} pressDepth={2} className="rounded-full border border-brand-500 bg-brand-50 px-3 py-2">
                <Text className="text-base font-bold text-brand-700">{p.t}</Text>
              </Pressable3D>
            ))
          )}
        </View>
      </View>

      <View className="mt-4 flex-row flex-wrap" style={{ gap: 8 }}>
        {available.map((p, i) => (
          <Pressable3D key={p.key} onPress={() => add(i)} hapticOnPress={false} pressDepth={2} className="rounded-full border border-stone-300 bg-white px-3 py-2">
            <Text className="text-base font-semibold text-stone-800">{p.t}</Text>
          </Pressable3D>
        ))}
      </View>
    </View>
  );
}
