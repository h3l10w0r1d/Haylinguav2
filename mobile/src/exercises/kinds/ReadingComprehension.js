// src/exercises/kinds/ReadingComprehension.js — ports
// ExReadingComprehension (src/ExerciseRenderer.jsx:2238-2264). A passage,
// a question, then a single-column ChoiceGrid.
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { BookOpenText } from 'lucide-react-native';
import { getChoices, getSingleCorrectIndex } from '../choiceHelpers';
import ChoiceGrid from '../ChoiceGrid';
import ExerciseEyebrow from '../ExerciseEyebrow';
import { haptics } from '../../lib/haptics';

export default function ReadingComprehension({ exercise, onSubmit, onCheckStateChange }) {
  const cfg = exercise.config || {};
  const passage = cfg.passage ?? cfg.text ?? '';
  const question = cfg.question ?? '';
  const choices = getChoices(exercise, cfg);
  const correctIndex = getSingleCorrectIndex(exercise, cfg, choices);

  const [sel, setSel] = useState(null);
  const [graded, setGraded] = useState(null);

  useEffect(() => {
    setSel(null);
    setGraded(null);
  }, [exercise.id]);

  const canCheck = sel !== null && !graded;

  function check() {
    const pick = choices[sel] ?? '';
    const ok = correctIndex !== null && sel === correctIndex;
    setGraded({ correct: correctIndex, picked: sel });
    if (ok) haptics.success();
    else haptics.error();
    onSubmit({ selectedIndices: [sel], answerText: pick, isCorrect: ok });
  }

  useEffect(() => {
    onCheckStateChange?.({ canCheck, run: graded ? null : check });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, graded]);

  return (
    <View className="flex-1">
      <ExerciseEyebrow icon={BookOpenText} label="Read and answer" color="#E0A800" tint="#FFF8E1" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'Read and answer'}</Text>

      {!!passage && (
        <View className="mt-4 rounded-2xl bg-stone-100 p-4">
          <Text className="text-base leading-relaxed text-stone-900">{passage}</Text>
        </View>
      )}
      {!!question && <Text className="mt-4 text-lg font-extrabold text-stone-900 font-display">{question}</Text>}

      <View className="mt-3">
        <ChoiceGrid choices={choices} selected={sel} onSelect={setSel} graded={graded} />
      </View>
    </View>
  );
}
