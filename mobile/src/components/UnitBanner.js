// src/components/UnitBanner.js — a full-bleed colored bar introducing a
// chapter's stretch of the lesson path, matching Duolingo's actual unit
// banner: edge-to-edge (not a margined/rounded card), a small uppercase
// "UNIT n" caption above a bold title. Color cycles per chapter through the
// app's own token palette (not Duolingo's own hues) via `bannerIndex`,
// unless the chapter has its own CMS-picked color, which takes priority.
import React from 'react';
import { View, Text } from 'react-native';

const BANNER_COLORS = ['#FF7A1A', '#1CB0F6', '#58CC02', '#FFC800'];

const TONE_BG = {
  brand: '#FF7A1A',
  grass: '#58CC02',
  amber: '#F59E0B',
  feather: '#1CB0F6',
  cardinal: '#FF4B4B',
  pom: '#E11D48',
  gold: '#FFC800',
};

export default function UnitBanner({ title, bannerIndex = 0, iconColor }) {
  const color = iconColor ? TONE_BG[iconColor] || TONE_BG.brand : BANNER_COLORS[bannerIndex % BANNER_COLORS.length];

  return (
    <View
      style={{
        marginHorizontal: -16,
        marginBottom: 20,
        backgroundColor: color,
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 4,
        borderBottomColor: 'rgba(0,0,0,0.15)',
      }}
    >
      <Text className="text-xs font-extrabold uppercase tracking-wide text-white/80">{`Unit ${bannerIndex + 1}`}</Text>
      <Text className="mt-0.5 text-xl font-extrabold text-white font-display" numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}
