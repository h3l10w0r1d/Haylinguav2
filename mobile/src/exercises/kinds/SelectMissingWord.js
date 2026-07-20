// src/exercises/kinds/SelectMissingWord.js — ports ExSelectMissingWord.
// Fill-in-the-blank: pick the choice that completes the sentence.
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { PenLine } from 'lucide-react-native';
import { getChoices, getSingleCorrectIndex } from '../choiceHelpers';
import ChoiceGrid from '../ChoiceGrid';
import ExerciseEyebrow from '../ExerciseEyebrow';

export default function SelectMissingWord({ exercise, onSubmit, onCheckStateChange }) {
  const cfg = exercise.config || {};
  const before = cfg.before ?? exercise.sentence_before ?? '';
  const after = cfg.after ?? exercise.sentence_after ?? '';
  const choices = getChoices(exercise, cfg);
  const correctIndex = getSingleCorrectIndex(exercise, cfg, choices);
  const [selected, setSelected] = useState(null);
  const [graded, setGraded] = useState(null);

  useEffect(() => {
    setSelected(null);
    setGraded(null);
  }, [exercise.id]);

  const canCheck = selected !== null && !graded;

  function check() {
    const picked = choices[selected] ?? '';
    setGraded({ correct: correctIndex, picked: selected });
    onSubmit({ selectedIndices: [selected], answerText: picked });
  }

  useEffect(() => {
    onCheckStateChange?.({ canCheck, run: graded ? null : check });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, graded]);

  return (
    <View className="flex-1">
      <ExerciseEyebrow icon={PenLine} label="Fill in the blank" color="#58CC02" tint="#EFFCE3" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'Complete the sentence'}</Text>

      <View className="mt-4 flex-row flex-wrap items-center rounded-2xl bg-stone-100 p-4">
        {!!before && <Text className="text-lg font-semibold text-stone-900">{before} </Text>}
        <View className={'rounded-lg border px-2.5 py-1 ' + (selected !== null ? 'border-brand-300 bg-brand-50' : 'border-stone-300 bg-white')}>
          <Text className={'text-lg font-bold ' + (selected !== null ? 'text-brand-700' : 'text-stone-300')}>
            {selected !== null ? choices[selected] ?? '…' : '…'}
          </Text>
        </View>
        {!!after && <Text className="text-lg font-semibold text-stone-900"> {after}</Text>}
      </View>

      <View className="mt-5">
        <ChoiceGrid choices={choices} selected={selected} onSelect={setSelected} graded={graded} />
      </View>
    </View>
  );
}
