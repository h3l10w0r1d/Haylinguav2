// src/exercises/kinds/LetterRecognition.js — ports ExLetterRecognition
// (single-select path only — multi-select isn't in scope yet).
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Volume2, Headphones } from 'lucide-react-native';
import { playExerciseAudio } from '../../lib/playExerciseAudio';
import { getChoices, getSingleCorrectIndex } from '../choiceHelpers';
import ChoiceGrid from '../ChoiceGrid';
import Pressable3D from '../../components/Pressable3D';
import ExerciseEyebrow from '../ExerciseEyebrow';

export default function LetterRecognition({ exercise, onSubmit, onCheckStateChange }) {
  const cfg = exercise.config || {};
  const choices = getChoices(exercise, cfg);
  const correctIndex = getSingleCorrectIndex(exercise, cfg, choices);
  const ttsText = String(cfg.ttsText ?? exercise.expected_answer ?? cfg.answer ?? (correctIndex != null ? choices[correctIndex] : '') ?? '').trim();
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
      <ExerciseEyebrow icon={Headphones} label="Listen & choose" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'Choose the correct answer'}</Text>

      <Pressable3D
        onPress={() => playExerciseAudio(exercise.id, { text: ttsText })}
        pressDepth={2}
        className="mt-4 flex-row items-center gap-2 self-start rounded-xl bg-feather-50 px-4 py-2.5"
      >
        <Volume2 size={16} color="#1899D6" />
        <Text className="text-sm font-bold text-feather-600">Play sound</Text>
      </Pressable3D>

      <View className="mt-5">
        <ChoiceGrid choices={choices} selected={selected} onSelect={setSelected} graded={graded} />
      </View>
    </View>
  );
}
