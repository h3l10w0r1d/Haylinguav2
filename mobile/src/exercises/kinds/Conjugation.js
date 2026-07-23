// src/exercises/kinds/Conjugation.js — ports ExConjugation
// (src/ExerciseRenderer.jsx:2481-2518). A verb paradigm — one labeled
// TextInput per cell (e.g. "I" / "you" / "he/she"), all must be filled and
// correct to pass.
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { BookText } from 'lucide-react-native';
import { normalizeText } from '../choiceHelpers';
import ExerciseEyebrow from '../ExerciseEyebrow';
import { haptics } from '../../lib/haptics';

export default function Conjugation({ exercise, onSubmit, onCheckStateChange }) {
  const cfg = exercise.config || {};
  const verb = cfg.verb ?? '';
  const cells = Array.isArray(cfg.cells) ? cfg.cells : [];

  const [vals, setVals] = useState(() => cells.map(() => ''));
  const [graded, setGraded] = useState(null);

  useEffect(() => {
    setVals(cells.map(() => ''));
    setGraded(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  const canCheck = vals.length === cells.length && vals.every((v) => normalizeText(v).length > 0) && !graded;

  function setVal(i, v) {
    setVals((arr) => arr.map((x, idx) => (idx === i ? v : x)));
  }

  function check() {
    const ok = cells.every((c, i) => normalizeText(vals[i]) === normalizeText(c.answer));
    setGraded({ ok });
    if (ok) haptics.success();
    else haptics.error();
    onSubmit({ answerText: JSON.stringify(vals), isCorrect: ok });
  }

  useEffect(() => {
    onCheckStateChange?.({ canCheck, run: graded ? null : check });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vals, graded]);

  return (
    <View className="flex-1">
      <ExerciseEyebrow icon={BookText} label="Complete the forms" color="#FF7A1A" tint="#FFF5EC" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'Complete the forms'}</Text>
      {!!verb && (
        <Text className="mt-1 text-sm font-semibold text-stone-500">
          Verb: <Text className="font-extrabold text-stone-800">{verb}</Text>
        </Text>
      )}

      <View className="mt-4" style={{ gap: 10 }}>
        {cells.map((c, i) => (
          <View key={i} className="flex-row items-center" style={{ gap: 12 }}>
            <Text className="w-24 shrink-0 text-sm font-extrabold text-stone-600">{c.label}</Text>
            <TextInput
              value={vals[i] ?? ''}
              onChangeText={(v) => setVal(i, v)}
              editable={!graded}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              placeholder="…"
              placeholderTextColor="#a8a29e"
              className="flex-1 rounded-2xl border-2 border-stone-200 bg-white px-4 py-2.5 text-base font-bold text-stone-900"
            />
          </View>
        ))}
      </View>
    </View>
  );
}
