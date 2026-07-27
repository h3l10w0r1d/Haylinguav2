// src/components/UnitBanner.js — a full-width colored band introducing a
// chapter's stretch of the lesson path, mirroring Duolingo's per-unit
// banner. Color cycles per chapter through the app's own token palette
// (not Duolingo's own hues) via `bannerIndex`, unless the chapter has its
// own CMS-picked icon/color (see the CMS chapter builder's icon picker),
// which takes priority so the banner matches the web dashboard.
import React from 'react';
import { View, Text } from 'react-native';
import { BookOpen } from 'lucide-react-native';
import { LucideGlyph } from '../lib/lucideIcons';

const BANNER_COLORS = ['#FF7A1A', '#1CB0F6', '#58CC02', '#FFC800'];

export default function UnitBanner({ title, bannerIndex = 0, icon, iconColor }) {
  const color = iconColor ? TONE_BG[iconColor] || TONE_BG.brand : BANNER_COLORS[bannerIndex % BANNER_COLORS.length];

  return (
    <View
      className="mb-6 flex-row items-center gap-3 rounded-2xl px-5 py-4"
      style={{ backgroundColor: color, shadowColor: color, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 }}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-white/20">
        {icon ? <LucideGlyph name={icon} size={18} color="#fff" /> : <BookOpen size={18} color="#fff" />}
      </View>
      <Text className="flex-1 text-base font-extrabold text-white" numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

// Same 7 accent tones as everywhere else (web's ACCENT, CMS's ICON_TONES) —
// used as the banner's solid background when a chapter has a chosen color.
const TONE_BG = {
  brand: '#FF7A1A',
  grass: '#58CC02',
  amber: '#F59E0B',
  feather: '#1CB0F6',
  cardinal: '#FF4B4B',
  pom: '#E11D48',
  gold: '#FFC800',
};
