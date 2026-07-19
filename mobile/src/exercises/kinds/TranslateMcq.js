// src/exercises/kinds/TranslateMcq.js — ports ExTranslateMcq from
// src/ExerciseRenderer.jsx. Multiple-choice: pick the right translation.
// FIX: real content stores choices in exercise.config.choices +
// config.answerIndex, not exercise.options (which is always [] in
// production data) — the original version of this file read .options
// directly and would have rendered zero choices against real lessons.
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Volume2 } from 'lucide-react-native';
import { playExerciseAudio } from '../../lib/playExerciseAudio';
import { getChoices, getSingleCorrectIndex } from '../choiceHelpers';
import ChoiceGrid from '../ChoiceGrid';
import Pressable3D from '../../components/Pressable3D';

export default function TranslateMcq({ exercise, onSubmit, onAdvance }) {
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
        <Text className="text-lg font-extrabold text-stone-900">{exercise.prompt || 'Choose the correct translation'}</Text>

        {!!cfg.sentence && (
          <View className="mt-4 rounded-2xl bg-stone-100 p-4">
            <Text className="text-lg font-semibold text-stone-900">{cfg.sentence}</Text>
          </View>
        )}

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

      <Pressable3D
        onPress={graded ? onAdvance : check}
        disabled={!canCheck && !graded}
        className={'items-center rounded-2xl py-4 ' + (canCheck || graded ? 'bg-brand-500' : 'bg-stone-300')}
      >
        <Text className="text-base font-extrabold text-white">{graded ? 'Continue' : 'Check'}</Text>
      </Pressable3D>
    </View>
  );
}
