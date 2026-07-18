// src/screens/PlaceholderScreen.js — stub for tabs not yet built (Phase 1+).
import React from 'react';
import { View, Text } from 'react-native';

export default function PlaceholderScreen({ route }) {
  const title = route?.name || 'Coming soon';
  return (
    <View className="flex-1 items-center justify-center bg-[#f5f4f1] px-6">
      <Text className="text-lg font-extrabold text-stone-800">{title}</Text>
      <Text className="mt-2 text-center text-sm font-medium text-stone-400">
        Not built yet — Phase 0 only wires up Learn.
      </Text>
    </View>
  );
}
