// src/exercises/kinds/DialogueOrder.js — ports ExDialogueOrder
// (src/ExerciseRenderer.jsx:2140-2176). Tap conversation lines below to
// build them in order; tap a placed line to remove it. Same tap-to-build
// mechanic as SentenceOrder, just operating on whole lines instead of words.
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { ListOrdered } from 'lucide-react-native';
import { normalizeText } from '../choiceHelpers';
import Pressable3D from '../../components/Pressable3D';
import ExerciseEyebrow from '../ExerciseEyebrow';
import { haptics } from '../../lib/haptics';

export default function DialogueOrder({ exercise, onSubmit, onCheckStateChange }) {
  const cfg = exercise.config || {};
  const lines = Array.isArray(cfg.lines) ? cfg.lines : [];
  const solution = Array.isArray(cfg.solution) ? cfg.solution : [];

  const [picked, setPicked] = useState([]);
  const [available, setAvailable] = useState([]);
  const [graded, setGraded] = useState(null);

  useEffect(() => {
    setPicked([]);
    setAvailable(lines.map((t, i) => ({ t, key: `${i}-${t}` })));
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
    setGraded({ ok });
    if (ok) haptics.success();
    else haptics.error();
    onSubmit({ answerText: built, isCorrect: ok });
  }

  useEffect(() => {
    onCheckStateChange?.({ canCheck, run: graded ? null : check });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, graded]);

  return (
    <View className="flex-1">
      <ExerciseEyebrow icon={ListOrdered} label="Put in order" color="#58CC02" tint="#EFFCE3" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'Put the conversation in order'}</Text>

      <View className="mt-4 min-h-[48px] rounded-2xl bg-stone-100 p-3" style={{ gap: 8 }}>
        {picked.length === 0 ? (
          <Text className="text-sm font-semibold text-stone-400">Tap the lines below in the right order…</Text>
        ) : (
          picked.map((item, i) => (
            <Pressable3D key={item.key} onPress={() => remove(i)} hapticOnPress={false} pressDepth={2} className="rounded-2xl border-2 border-brand-200 bg-white px-4 py-2.5">
              <Text className="text-sm font-semibold text-stone-800">
                {i + 1}. {item.t}
              </Text>
            </Pressable3D>
          ))
        )}
      </View>

      <View className="mt-4" style={{ gap: 8 }}>
        {available.map((item, i) => (
          <Pressable3D key={item.key} onPress={() => add(i)} hapticOnPress={false} pressDepth={2} className="rounded-2xl border-2 border-stone-200 bg-white px-4 py-2.5">
            <Text className="text-sm font-semibold text-stone-800">{item.t}</Text>
          </Pressable3D>
        ))}
      </View>
    </View>
  );
}
