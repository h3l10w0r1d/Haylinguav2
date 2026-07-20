// src/exercises/kinds/WriteTranslate.js — ports the web's "write_translate"
// kind (src/ExerciseRenderer.jsx:2515-2555). Free-text translation, bare
// multiline input (no autoCapitalize/autoCorrect restrictions, unlike
// ListenType) since translated text needs normal capitalization/typing.
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Languages } from 'lucide-react-native';
import { normalizeText } from '../choiceHelpers';
import ExerciseEyebrow from '../ExerciseEyebrow';
import { haptics } from '../../lib/haptics';

export default function WriteTranslate({ exercise, onSubmit, onCheckStateChange }) {
  const cfg = exercise.config || {};
  const source = cfg.source ?? cfg.sentence ?? '';
  const accepted = [
    exercise.expected_answer,
    ...(Array.isArray(cfg.acceptedAnswers) ? cfg.acceptedAnswers : []),
    ...(Array.isArray(cfg.answers) ? cfg.answers : []),
  ].filter(Boolean);

  const [answer, setAnswer] = useState('');
  const [graded, setGraded] = useState(null);

  useEffect(() => {
    setAnswer('');
    setGraded(null);
  }, [exercise.id]);

  const canCheck = answer.trim().length > 0 && !graded;

  function check() {
    const ok = accepted.some((a) => normalizeText(a) === normalizeText(answer));
    setGraded({ ok });
    if (ok) haptics.success();
    else haptics.error();
    onSubmit({ answerText: answer, isCorrect: ok });
  }

  useEffect(() => {
    onCheckStateChange?.({ canCheck, run: graded ? null : check });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer, graded]);

  return (
    <View className="flex-1">
      <ExerciseEyebrow icon={Languages} label="Translate" color="#E0A800" tint="#FFF8E1" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'Translate this'}</Text>

      {!!source && (
        <View className="mt-4 rounded-2xl bg-stone-100 p-4">
          <Text className="text-lg font-semibold text-stone-900">{source}</Text>
        </View>
      )}

      <TextInput
        value={answer}
        onChangeText={setAnswer}
        editable={!graded}
        multiline
        placeholder="Write your translation"
        placeholderTextColor="#a8a29e"
        className="mt-6 min-h-[96px] rounded-2xl border-2 border-stone-200 bg-white px-4 py-3 text-base font-semibold text-stone-900"
        textAlignVertical="top"
      />
    </View>
  );
}
