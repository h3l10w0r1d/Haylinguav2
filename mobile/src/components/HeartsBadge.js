// src/components/HeartsBadge.js — live hearts counter for the lesson top
// bar, mirrors the web's HeartsBadge (src/ExerciseShell.jsx). Reads
// useStatsStore directly (updated authoritatively from each attempt's
// hearts_current/hearts_max/is_premium via statsStore.applyAttempt) and
// shakes whenever the count drops.
import React, { useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import { Heart } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { useStatsStore } from '../lib/statsStore';

export default function HeartsBadge() {
  const heartsCurrent = useStatsStore((s) => s.heartsCurrent);
  const isPremium = useStatsStore((s) => s.isPremium);
  const shake = useSharedValue(0);
  const prev = useRef(null);

  useEffect(() => {
    if (heartsCurrent == null) return;
    if (prev.current !== null && !isPremium && heartsCurrent < prev.current) {
      shake.value = withSequence(
        withTiming(-6, { duration: 60 }),
        withTiming(6, { duration: 60 }),
        withTiming(-4, { duration: 60 }),
        withTiming(0, { duration: 60 })
      );
    }
    prev.current = heartsCurrent;
  }, [heartsCurrent, isPremium]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  if (heartsCurrent == null) return null;

  return (
    <Animated.View style={style} className="flex-row items-center gap-1">
      <Heart size={22} color="#FF4B4B" fill="#FF4B4B" />
      <Text className="text-lg font-extrabold text-cardinal-500">{isPremium ? '∞' : heartsCurrent}</Text>
    </Animated.View>
  );
}
