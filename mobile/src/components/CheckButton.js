// src/components/CheckButton.js — the docked "Check" footer button shared by
// LessonScreen/CheckpointScreen/PracticeScreen. Pill-shaped (rounded-full)
// with a chunky bottom-lip "3D" edge that follows the same curve — matches
// Duolingo's actual CHECK/CONTINUE button shape (see the Figma UI kit),
// not a rounded-rectangle.
import React from 'react';
import { View, Text } from 'react-native';
import Pressable3D from './Pressable3D';

export default function CheckButton({ visible, canCheck, onPress }) {
  if (!visible) return null;
  return (
    <View className="px-4 pb-4">
      <Pressable3D
        onPress={onPress}
        disabled={!canCheck}
        className="items-center rounded-full py-4"
        style={{
          backgroundColor: canCheck ? '#FF7A1A' : '#E5E5E5',
          borderBottomWidth: 4,
          borderBottomColor: canCheck ? '#C2410C' : '#C9C9C9',
        }}
      >
        <Text
          className="text-base font-extrabold uppercase tracking-wide"
          style={{ color: canCheck ? '#ffffff' : '#AFAFAF' }}
        >
          Check
        </Text>
      </Pressable3D>
    </View>
  );
}
