// src/exercises/kinds/Flashcard.js — ports ExFlashcard
// (src/ExerciseRenderer.jsx:2340-2364). Active recall: tap to flip, then
// Continue — always correct, nothing to grade. Deliberately keeps its own
// inline Continue button instead of the shared docked-footer/result-banner
// contract (onCheckStateChange), same reasoning as CharIntro: routing
// through Check→ExerciseResultBanner would flash an unearned "Correct!"
// banner for a card that was never actually checked.
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import Pressable3D from '../../components/Pressable3D';

export default function Flashcard({ exercise, onSubmit, onAdvance }) {
  const cfg = exercise.config || {};
  const front = cfg.front ?? exercise.prompt ?? '';
  const back = cfg.back ?? cfg.translation ?? '';
  const hint = cfg.hint ?? '';

  const [flipped, setFlipped] = useState(false);
  useEffect(() => setFlipped(false), [exercise.id]);

  return (
    <View className="flex-1 justify-between">
      <View>
        <Text className="text-sm font-bold uppercase tracking-wide text-stone-400">
          {exercise.prompt && cfg.front ? exercise.prompt : 'Do you remember this?'}
        </Text>

        <Pressable3D onPress={() => setFlipped((f) => !f)} pressDepth={3} className="mt-5 min-h-[10rem] items-center justify-center rounded-3xl bg-brand-50 px-6 py-8">
          <Text className="text-center text-3xl font-extrabold text-stone-900 font-display">{flipped ? back : front}</Text>
          <Text className="mt-2 text-xs font-bold uppercase tracking-wide text-stone-400">{flipped ? 'answer' : 'tap to flip'}</Text>
          {flipped && !!hint && <Text className="mt-2 text-center text-sm font-semibold text-stone-500">{hint}</Text>}
        </Pressable3D>
      </View>

      <Pressable3D
        onPress={async () => {
          await onSubmit({ isCorrect: true });
          onAdvance();
        }}
        className="items-center rounded-2xl bg-brand-500 py-4"
      >
        <Text className="text-base font-extrabold text-white">Continue</Text>
      </Pressable3D>
    </View>
  );
}
