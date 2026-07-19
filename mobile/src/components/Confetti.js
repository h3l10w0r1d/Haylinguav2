// src/components/Confetti.js — a custom Reanimated confetti burst. Mirrors
// the web app's own hand-rolled CSS confetti (StreakCelebration.jsx /
// LessonCompletionScreen.jsx both build their own falling-piece confetti
// rather than using canvas-confetti) — same approach, no extra dependency
// beyond the Reanimated engine this app already needs for everything else.
import React, { useMemo } from 'react';
import { View, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming, Easing, interpolate } from 'react-native-reanimated';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');

function ConfettiPiece({ color, left, drift, size, duration, delay, square }) {
  const p = useSharedValue(0);

  React.useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration, easing: Easing.linear }));
  }, []);

  const style = useAnimatedStyle(() => {
    const translateY = interpolate(p.value, [0, 1], [-20, SCREEN_H + 20]);
    const translateX = interpolate(p.value, [0, 1], [0, drift]);
    const rotate = interpolate(p.value, [0, 1], [0, 720]);
    const opacity = interpolate(p.value, [0, 0.85, 1], [1, 1, 0]);
    return {
      transform: [{ translateY }, { translateX }, { rotate: `${rotate}deg` }],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left,
          top: 0,
          width: size,
          height: size,
          backgroundColor: color,
          borderRadius: square ? 2 : size / 2,
        },
        style,
      ]}
    />
  );
}

export default function Confetti({ colors, count = 36, active = true }) {
  const pieces = useMemo(() => {
    if (!active) return [];
    return Array.from({ length: count }, (_, i) => ({
      key: i,
      color: colors[i % colors.length],
      left: Math.random() * SCREEN_W,
      drift: (Math.random() - 0.5) * 140,
      size: 6 + Math.random() * 7,
      duration: 2200 + Math.random() * 1400,
      delay: Math.random() * 900,
      square: Math.random() > 0.5,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) return null;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      {pieces.map(({ key, ...p }) => (
        <ConfettiPiece key={key} {...p} />
      ))}
    </View>
  );
}
