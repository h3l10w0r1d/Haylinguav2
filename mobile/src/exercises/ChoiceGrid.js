// src/exercises/ChoiceGrid.js — ports ChoiceGrid from src/exercises/ui.jsx.
// Single-select only for now (multi-select exercises aren't in Phase 0/1
// scope — none of the ported kinds need it).
//
// Animation: Pressable3D gives every tile the "3D press-squash" feel; on
// grading, the correct tile pops (scale bounce) and a wrong pick shakes
// (translateX oscillation) — mirrors the web's tile-pop/heart-shake family.
// A haptic buzz fires once per grading event (success/error).
import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, withSpring } from 'react-native-reanimated';
import Pressable3D from '../components/Pressable3D';
import { haptics } from '../lib/haptics';

// Chunkier Duolingo-style "3D" tile: a flat top/side border plus a thicker,
// darker-shade bottom lip (rather than a uniform border) so the tile reads
// as physically raised, consistent with Pressable3D's press-depth affordance
// elsewhere in the app.
function tileColors(isRight, isWrongPick, isSelected) {
  if (isRight) return { bg: '#EFFCE3', border: '#A5E86B', lip: '#58CC02' };
  if (isWrongPick) return { bg: '#FFECEC', border: '#FF9B9B', lip: '#FF4B4B' };
  if (isSelected) return { bg: '#FFF5EC', border: '#FFC99E', lip: '#FF7A1A' };
  return { bg: '#ffffff', border: '#e7e5e4', lip: '#c7c2bd' };
}

function ChoiceTile({ text, disabled, onPress, isRight, isWrongPick, isSelected }) {
  const pop = useSharedValue(1);
  const shakeX = useSharedValue(0);

  useEffect(() => {
    if (isRight) {
      pop.value = withSequence(withTiming(1.06, { duration: 120 }), withSpring(1, { damping: 10 }));
    }
  }, [isRight]);

  useEffect(() => {
    if (isWrongPick) {
      shakeX.value = withSequence(
        withTiming(-6, { duration: 55 }),
        withTiming(6, { duration: 55 }),
        withTiming(-4, { duration: 55 }),
        withTiming(4, { duration: 55 }),
        withTiming(0, { duration: 55 })
      );
    }
  }, [isWrongPick]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }, { translateX: shakeX.value }],
  }));

  const colors = tileColors(isRight, isWrongPick, isSelected);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable3D disabled={disabled} onPress={onPress} hapticOnPress={false}>
        <View
          className="rounded-2xl px-5 py-4"
          style={{
            backgroundColor: colors.bg,
            borderWidth: 2,
            borderColor: colors.border,
            borderBottomWidth: 5,
            borderBottomColor: colors.lip,
          }}
        >
          <Text className="text-lg font-bold text-stone-800">{text}</Text>
        </View>
      </Pressable3D>
    </Animated.View>
  );
}

export default function ChoiceGrid({ choices, selected, onSelect, graded }) {
  useEffect(() => {
    if (!graded) return;
    if (graded.picked === graded.correct) haptics.success();
    else haptics.error();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graded]);

  return (
    <View style={{ gap: 10 }}>
      {choices.map((text, i) => {
        const isSelected = selected === i;
        const isRight = !!graded && i === graded.correct;
        const isWrongPick = !!graded && isSelected && i !== graded.correct;
        return (
          <ChoiceTile
            key={i}
            text={text}
            disabled={!!graded}
            onPress={() => onSelect(i)}
            isRight={isRight}
            isWrongPick={isWrongPick}
            isSelected={isSelected}
          />
        );
      })}
    </View>
  );
}
