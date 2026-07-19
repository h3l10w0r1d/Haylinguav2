// src/components/Pressable3D.js — the "3D pressable button" pattern from
// the web app's .btn3d/.tile classes (active:translate-y-1 + a shadow that
// flattens on press). Drop-in replacement for TouchableOpacity: same
// className/style/onPress/disabled props, plus a spring-back translateY on
// release and a light haptic tap. Only the translateY animates (the shadow
// itself stays static) — this reads as a solid press effect without the
// complexity of animating shadow blur/offset per frame.
import React from 'react';
import { Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { haptics } from '../lib/haptics';

export default function Pressable3D({ children, onPress, disabled, className, style, hapticOnPress = true, pressDepth = 4 }) {
  const ty = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
  }));

  function onPressIn() {
    if (disabled) return;
    ty.value = withTiming(pressDepth, { duration: 80 });
  }

  function onPressOut() {
    if (disabled) return;
    ty.value = withSpring(0, { damping: 14, stiffness: 260 });
  }

  function handlePress() {
    if (disabled) return;
    if (hapticOnPress) haptics.impact();
    onPress?.();
  }

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        className={className}
        style={style}
        disabled={disabled}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={handlePress}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
