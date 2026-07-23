// src/exercises/ChoiceGrid.js — ports ChoiceGrid from src/exercises/ui.jsx.
// Single-select only (multi-select exercises use their own dedicated tile
// list in MultiSelect.js instead of overloading this one).
//
// Tile look matches the actual Duolingo Figma UI kit: a thin, uniform
// 1.5px border (not the earlier bottom-heavy "3D lip" — that treatment is
// reserved for primary CTA buttons like Check/Continue, never individual
// answer tiles, in the reference designs), selected = feather-blue (our
// brand's blue token standing in for Duolingo's own blue-selected state;
// green/red still mean correct/wrong exactly like Duolingo).
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

function tileColors(isRight, isWrongPick, isSelected) {
  if (isRight) return { bg: '#EFFCE3', border: '#58CC02' };
  if (isWrongPick) return { bg: '#FFECEC', border: '#FF4B4B' };
  if (isSelected) return { bg: '#E7F7FF', border: '#1CB0F6' };
  return { bg: '#ffffff', border: '#e7e5e4' };
}

function ChoiceTile({ text, disabled, onPress, isRight, isWrongPick, isSelected, square }) {
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
    <Animated.View style={[animatedStyle, square ? { flex: 1 } : null]}>
      <Pressable3D disabled={disabled} onPress={onPress} hapticOnPress={false}>
        <View
          className={square ? 'aspect-square items-center justify-center rounded-2xl px-4' : 'rounded-2xl px-5 py-4'}
          style={{ backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.border }}
        >
          <Text className={'font-bold text-stone-800 ' + (square ? 'text-xl text-center' : 'text-lg')}>{text}</Text>
        </View>
      </Pressable3D>
    </Animated.View>
  );
}

export default function ChoiceGrid({ choices, selected, onSelect, graded, columns = 1, square = false }) {
  useEffect(() => {
    if (!graded) return;
    if (graded.picked === graded.correct) haptics.success();
    else haptics.error();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graded]);

  const tiles = choices.map((text, i) => {
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
        square={square}
      />
    );
  });

  if (columns === 2) {
    // Pair tiles into rows of two so each row can share flex (equal-width
    // cards), matching the Figma kit's 2x2 minimal-pairs grid.
    const rows = [];
    for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));
    return (
      <View style={{ gap: 10 }}>
        {rows.map((row, r) => (
          <View key={r} className="flex-row" style={{ gap: 10 }}>
            {row}
          </View>
        ))}
      </View>
    );
  }

  return <View style={{ gap: 10 }}>{tiles}</View>;
}
