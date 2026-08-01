// src/components/ClaimPulse.js — a reusable "reward claimed" payoff: the
// wrapped card pops (scale overshoot) and flashes a gold ring, then settles.
// Used by BonusesScreen's quest rows and AchievementsScreen's cards, which
// previously only fired a haptic on claim — no visual acknowledgment that
// the tap actually landed.
import React, { useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, withSpring, Easing } from 'react-native-reanimated';

export default function ClaimPulse({ pulseKey, style, children }) {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (!pulseKey) return;
    scale.value = withSequence(
      withTiming(1.06, { duration: 140, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 8, stiffness: 200 })
    );
    glow.value = withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 500 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowColor: '#E0A800',
    shadowOpacity: glow.value * 0.6,
    shadowRadius: glow.value * 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: glow.value * 6,
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
