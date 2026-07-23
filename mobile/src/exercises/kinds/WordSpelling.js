// src/exercises/kinds/WordSpelling.js — ports ExWordSpelling
// (src/ExerciseRenderer.jsx:718-756). Same shape as LetterTyping plus an
// optional hint line.
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { SpellCheck } from 'lucide-react-native';
import { normalizeText } from '../choiceHelpers';
import ExerciseEyebrow from '../ExerciseEyebrow';
import { haptics } from '../../lib/haptics';

export default function WordSpelling({ exercise, onSubmit, onCheckStateChange }) {
  const cfg = exercise.config || {};
  const answer = String(exercise.expected_answer ?? cfg.answer ?? '').trim();
  const hint = cfg.hint;

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
      <ExerciseEyebrow icon={SpellCheck} label="Spell it out" color="#FF7A1A" tint="#FFF5EC" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'Spell the word'}</Text>
      {!!hint && <Text className="mt-1 text-sm font-semibold text-stone-500">Hint: {hint}</Text>}

      <TextInput
        value={inputValue}
        onChangeText={setInputValue}
        editable={!graded}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        placeholder="Type the word…"
        placeholderTextColor="#a8a29e"
        className="mt-6 rounded-2xl border-2 border-stone-200 bg-white px-4 py-3 text-base font-semibold text-stone-900"
      />
    </View>
  );
}
