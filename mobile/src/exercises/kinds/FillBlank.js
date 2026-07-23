// src/exercises/kinds/FillBlank.js — ports ExFillBlank
// (src/ExerciseRenderer.jsx:759-818). The web version wraps the sentence in
// a SpeechBubbleMascot bubble; mobile has no mascot-illustration component
// yet, so this renders the same before/blank/after sentence in a plain
// rounded card instead (matching the "stone-100 box" convention every other
// ported kind already uses for showing a sentence/target, e.g. WordBank).
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { PenLine } from 'lucide-react-native';
import { normalizeText } from '../choiceHelpers';
import ExerciseEyebrow from '../ExerciseEyebrow';
import { haptics } from '../../lib/haptics';

export default function FillBlank({ exercise, onSubmit, onCheckStateChange }) {
  const cfg = exercise.config || {};
  const before = cfg.before ?? exercise.sentence_before ?? '';
  const after = cfg.after ?? exercise.sentence_after ?? '';
  const placeholder = cfg.placeholder ?? '…';
  const answer = String(exercise.expected_answer ?? cfg.answer ?? '').trim();

  const [inputValue, setInputValue] = useState('');
  const [graded, setGraded] = useState(null);

  useEffect(() => {
    setInputValue('');
    setGraded(null);
  }, [exercise.id]);

  const canCheck = normalizeText(inputValue).length > 0 && !graded;

  function check() {
    const ok = normalizeText(inputValue) === normalizeText(answer);
    setGraded({ ok });
    if (ok) haptics.success();
    else haptics.error();
    onSubmit({ answerText: inputValue, isCorrect: ok });
  }

  useEffect(() => {
    onCheckStateChange?.({ canCheck, run: graded ? null : check });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, graded]);

  return (
    <View className="flex-1">
      <ExerciseEyebrow icon={PenLine} label="Fill in the blank" color="#FF7A1A" tint="#FFF5EC" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'Fill in the blank'}</Text>

      <View className="mt-4 rounded-2xl bg-stone-100 p-4">
        <Text className="text-lg font-semibold leading-relaxed text-stone-900">
          {before}{' '}
          <Text className="rounded-lg bg-white px-2 py-1 font-bold text-stone-400">{placeholder}</Text>{' '}
          {after}
        </Text>
      </View>

      <TextInput
        value={inputValue}
        onChangeText={setInputValue}
        editable={!graded}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        placeholder="Type the missing word…"
        placeholderTextColor="#a8a29e"
        className="mt-4 rounded-2xl border-2 border-stone-200 bg-white px-4 py-3 text-base font-semibold text-stone-900"
      />
    </View>
  );
}
