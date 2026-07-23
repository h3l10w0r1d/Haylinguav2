// src/exercises/kinds/LetterTyping.js — ports ExLetterTyping
// (src/ExerciseRenderer.jsx:679-715). Bare single-line TextInput — the web
// version pairs its InlineInput with an on-screen ArmenianKeyboard, which
// mobile has no equivalent of yet; the phone's own system keyboard (with
// an Armenian layout installed) is the input path here, same as every
// other typed-answer kind on mobile (ListenType, WriteTranslate).
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { PenLine } from 'lucide-react-native';
import { normalizeText } from '../choiceHelpers';
import ExerciseEyebrow from '../ExerciseEyebrow';
import { haptics } from '../../lib/haptics';

export default function LetterTyping({ exercise, onSubmit, onCheckStateChange }) {
  const cfg = exercise.config || {};
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
      <ExerciseEyebrow icon={PenLine} label="Type the letter" color="#FF7A1A" tint="#FFF5EC" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'Type the letter'}</Text>

      <TextInput
        value={inputValue}
        onChangeText={setInputValue}
        editable={!graded}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        placeholder="Type here…"
        placeholderTextColor="#a8a29e"
        className="mt-6 rounded-2xl border-2 border-stone-200 bg-white px-4 py-3 text-base font-semibold text-stone-900"
      />
    </View>
  );
}
