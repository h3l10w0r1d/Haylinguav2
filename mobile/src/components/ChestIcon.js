// src/components/ChestIcon.js — the same hand-drawn chest shape used in the
// full chest-opening animation (src/lib/ChestOpening.jsx's ChestLidSvg +
// ChestBodySvg on web), ported to react-native-svg and scaled down for use
// as a small static roadmap milestone marker (LessonPath.js's ChestNode) —
// not the generic gift-box icon that was there before. Lid+body path data
// is copied verbatim from the web version so both platforms show the same
// chest.
import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

// Wooden-tier theme only — the roadmap milestone never shows other
// rarities (that's rolled server-side only for the real chest-opening
// reward, not this decorative marker).
const THEME = {
  lid: ['#B07A45', '#7A4E22'],
  lidPanel: '#C08A52',
  body: ['#9A6635', '#663F1A'],
  bodyPanel: '#AE7840',
  trim: ['#9C9CA6', '#5C5C66'],
};

function ChestLid() {
  return (
    <Svg width={240} height={80} viewBox="0 30 240 80">
      <Defs>
        <LinearGradient id="lid-main" x1="120" y1="34" x2="120" y2="110" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={THEME.lid[0]} />
          <Stop offset="1" stopColor={THEME.lid[1]} />
        </LinearGradient>
        <LinearGradient id="lid-trim" x1="120" y1="34" x2="120" y2="112" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={THEME.trim[0]} />
          <Stop offset="1" stopColor={THEME.trim[1]} />
        </LinearGradient>
      </Defs>
      <Path d="M14 110 V80 C14 52 58 34 120 34 C182 34 226 52 226 80 V110 Z" fill="url(#lid-main)" />
      <Path d="M34 106 V82 C34 62 68 48 120 48 C172 48 206 62 206 82 V106 Z" fill={THEME.lidPanel} opacity={0.38} />
      <Rect x={14} y={96} width={212} height={16} rx={4} fill="url(#lid-trim)" />
      <Rect x={14} y={34} width={20} height={76} rx={6} fill="url(#lid-trim)" opacity={0.92} />
      <Rect x={206} y={34} width={20} height={76} rx={6} fill="url(#lid-trim)" opacity={0.92} />
      <Rect x={104} y={90} width={32} height={18} rx={6} fill="url(#lid-trim)" />
      <Path d="M28 80 C38 56 72 44 120 44 C168 44 202 56 212 80" stroke="rgba(255,255,255,0.22)" strokeWidth={3} fill="none" />
    </Svg>
  );
}

function ChestBody() {
  return (
    <Svg width={240} height={102} viewBox="0 98 240 102">
      <Defs>
        <LinearGradient id="body-main" x1="120" y1="100" x2="120" y2="196" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={THEME.body[0]} />
          <Stop offset="1" stopColor={THEME.body[1]} />
        </LinearGradient>
        <LinearGradient id="body-trim" x1="120" y1="100" x2="120" y2="196" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={THEME.trim[0]} />
          <Stop offset="1" stopColor={THEME.trim[1]} />
        </LinearGradient>
      </Defs>
      <Rect x={14} y={100} width={212} height={96} rx={16} fill="url(#body-main)" />
      <Rect x={28} y={113} width={184} height={73} rx={8} fill={THEME.bodyPanel} opacity={0.38} />
      <Rect x={14} y={100} width={20} height={96} rx={6} fill="url(#body-trim)" />
      <Rect x={206} y={100} width={20} height={96} rx={6} fill="url(#body-trim)" />
      <Rect x={14} y={148} width={212} height={20} fill="url(#body-trim)" />
      <Rect x={98} y={120} width={44} height={36} rx={10} fill="url(#body-trim)" />
      <Circle cx={120} cy={140} r={10} fill="rgba(0,0,0,0.35)" />
      <Circle cx={120} cy={140} r={5} fill={THEME.trim[0]} />
    </Svg>
  );
}

export default function ChestIcon({ size = 64, unlocked = true }) {
  const scale = size / 240;
  const height = size * (182 / 240);
  return (
    <View style={{ width: size, height, opacity: unlocked ? 1 : 0.45 }}>
      <View style={{ transform: [{ scale }], transformOrigin: 'top left', width: 240, height: 200 }}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80 }}>
          <ChestLid />
        </View>
        <View style={{ position: 'absolute', top: 80, left: 0, right: 0 }}>
          <ChestBody />
        </View>
      </View>
    </View>
  );
}
