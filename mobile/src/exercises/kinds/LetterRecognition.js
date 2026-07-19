// src/exercises/kinds/LetterRecognition.js — ports ExLetterRecognition
// (single-select path only — multi-select isn't in scope yet).
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Volume2 } from 'lucide-react-native';
import { playExerciseAudio } from '../../lib/playExerciseAudio';
import { getChoices, getSingleCorrectIndex } from '../choiceHelpers';
import ChoiceGrid from '../ChoiceGrid';

export default function LetterRecognition({ exercise, onSubmit, onAdvance }) {
  const cfg = exercise.config || {};
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

  return (
    <View className="flex-1 justify-between">
      <View>
        <Text className="text-lg font-extrabold text-stone-900">{exercise.prompt || 'Choose the correct answer'}</Text>

        <TouchableOpacity
          onPress={() => playExerciseAudio(exercise.id)}
          className="mt-4 flex-row items-center gap-2 self-start rounded-xl bg-feather-50 px-4 py-2.5"
        >
          <Volume2 size={16} color="#1899D6" />
          <Text className="text-sm font-bold text-feather-600">Play sound</Text>
        </TouchableOpacity>

        <View className="mt-5">
          <ChoiceGrid choices={choices} selected={selected} onSelect={setSelected} graded={graded} />
        </View>
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
