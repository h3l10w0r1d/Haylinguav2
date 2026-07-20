// src/exercises/ExerciseEyebrow.js — the small uppercase "what kind of
// exercise is this" instruction line Duolingo shows above every exercise's
// prompt (e.g. "LISTEN & CHOOSE", "TRANSLATE THIS SENTENCE"), each kind
// with its own icon. Purely a label — every kind still owns its own
// `exercise.prompt` text below it.
import React from 'react';
import { View, Text } from 'react-native';

export default function ExerciseEyebrow({ icon: Icon, label, color = '#1899D6', tint = '#E7F7FF' }) {
  return (
    <View className="mb-2 flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1" style={{ backgroundColor: tint }}>
      <Icon size={12} color={color} />
      <Text className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}
