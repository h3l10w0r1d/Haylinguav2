// src/exercises/kinds/CharIntro.js — ports ExCharIntro from
// src/ExerciseRenderer.jsx. Always-correct info card: shows a letter +
// transliteration + hint, "Continue" just advances (no grading — char_intro
// is in the backend's _INFO_KINDS, server always marks it correct).
//
// Deliberately keeps its own inline Continue button instead of the shared
// docked-footer/result-banner contract every other kind reports through
// (onCheckStateChange) — there's nothing to grade here, so routing through
// Check→ExerciseResultBanner would flash an unearned "Correct!" banner for
// an info card. Mirrors the web's own ExCharIntro, which submits with
// `autoAdvance: true` to skip its result panel the same way.
import React from 'react';
import { View, Text } from 'react-native';
import { Volume2, BookOpen } from 'lucide-react-native';
import { playExerciseAudio } from '../../lib/playExerciseAudio';
import Pressable3D from '../../components/Pressable3D';
import ExerciseEyebrow from '../ExerciseEyebrow';

export default function CharIntro({ exercise, onSubmit, onAdvance }) {
  const cfg = exercise.config || {};
  const prompt = exercise.prompt || 'New letter';

  return (
    <View className="flex-1 justify-between">
      <View>
        <ExerciseEyebrow icon={BookOpen} label="New letter" color="#E0A800" tint="#FFF8E1" />
        <Text className="text-sm font-bold uppercase tracking-wide text-stone-400">{prompt}</Text>

        <View className="mt-4 flex-row items-center justify-between rounded-2xl bg-white p-6" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
          <Text className="text-6xl font-black text-stone-900 font-display">{cfg.letter ?? ''}</Text>
          <Text className="text-4xl font-extrabold text-stone-600 font-display">{cfg.lower ?? ''}</Text>
        </View>

        <View className="mt-4 rounded-2xl bg-stone-100 p-4">
          {!!cfg.transliteration && (
            <Text className="text-sm font-medium text-stone-500">
              Sounds like: <Text className="font-bold text-stone-800">{cfg.transliteration}</Text>
            </Text>
          )}
          {!!cfg.hint && <Text className="mt-2 text-sm font-medium text-stone-500">{cfg.hint}</Text>}
        </View>

        <Pressable3D
          onPress={() => playExerciseAudio(exercise.id, { text: cfg.ttsText ?? cfg.letter ?? cfg.transliteration ?? '' })}
          pressDepth={2}
          className="mt-4 flex-row items-center gap-2 self-start rounded-xl bg-feather-50 px-4 py-2.5"
        >
          <Volume2 size={16} color="#1899D6" />
          <Text className="text-sm font-bold text-feather-600">Play sound</Text>
        </Pressable3D>
      </View>

      <Pressable3D
        onPress={async () => {
          await onSubmit({});
          onAdvance();
        }}
        className="items-center rounded-2xl bg-brand-500 py-4"
      >
        <Text className="text-base font-extrabold text-white">Continue</Text>
      </Pressable3D>
    </View>
  );
}
