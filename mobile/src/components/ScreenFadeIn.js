// src/components/ScreenFadeIn.js — shared fade+slide-up mount entrance,
// extracted from DashboardScreen.js's HeroCard recipe. The screens built
// this session (Achievements/Progress/Bonuses/Notifications/Forum) render
// their content instantly on load, unlike the dashboard's hero card — this
// gives them the same "arrived with polish" feel instead of a flat cut-in.
import React, { useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming, Easing } from 'react-native-reanimated';

export default function ScreenFadeIn({ delay = 0, style, children }) {
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withDelay(delay, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 14 }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
