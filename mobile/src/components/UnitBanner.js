// src/components/UnitBanner.js — a full-width colored band introducing a
// chapter's stretch of the lesson path, mirroring Duolingo's per-unit
// banner. Color cycles per chapter through the app's own token palette
// (not Duolingo's own hues) via `bannerIndex`.
import React from 'react';
import { View, Text } from 'react-native';
import { BookOpen } from 'lucide-react-native';

const BANNER_COLORS = ['#FF7A1A', '#1CB0F6', '#58CC02', '#FFC800'];

export default function UnitBanner({ title, bannerIndex = 0 }) {
  const color = BANNER_COLORS[bannerIndex % BANNER_COLORS.length];

  return (
    <View
      className="mb-6 flex-row items-center gap-3 rounded-2xl px-5 py-4"
      style={{ backgroundColor: color, shadowColor: color, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-white/20">
        <BookOpen size={18} color="#fff" />
      </View>
      <Text className="flex-1 text-base font-extrabold text-white" numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}
