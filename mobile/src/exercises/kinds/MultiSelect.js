// src/exercises/kinds/MultiSelect.js — ports ExMultiSelect
// (src/ExerciseRenderer.jsx:1359-1447). "Select all that apply" — ChoiceGrid
// is single-select only (by its own header comment), so this owns a small
// dedicated multi-select tile list rather than overloading the shared
// component every other MCQ kind depends on. Tiles reuse the same chunky
// "3D lip" look as ChoiceGrid's ChoiceTile for visual consistency.
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { ListChecks, Check } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, withSpring } from 'react-native-reanimated';
import { getChoices, getCorrectIndices } from '../choiceHelpers';
import Pressable3D from '../../components/Pressable3D';
import ExerciseEyebrow from '../ExerciseEyebrow';
import { haptics } from '../../lib/haptics';

function tileColors(isRight, isWrongPick, isSelected) {
  if (isRight) return { bg: '#EFFCE3', border: '#A5E86B', lip: '#58CC02' };
  if (isWrongPick) return { bg: '#FFECEC', border: '#FF9B9B', lip: '#FF4B4B' };
  if (isSelected) return { bg: '#FFF5EC', border: '#FFC99E', lip: '#FF7A1A' };
  return { bg: '#ffffff', border: '#e7e5e4', lip: '#c7c2bd' };
}

function MultiTile({ text, disabled, onPress, isRight, isWrongPick, isSelected }) {
  const pop = useSharedValue(1);
  const shakeX = useSharedValue(0);

  useEffect(() => {
    if (isRight) pop.value = withSequence(withTiming(1.06, { duration: 120 }), withSpring(1, { damping: 10 }));
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
          className="flex-row items-center gap-2 rounded-2xl px-5 py-4"
          style={{ backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.border, borderBottomWidth: 5, borderBottomColor: colors.lip }}
        >
          <View
            className="h-5 w-5 items-center justify-center rounded-md"
            style={{ borderWidth: 2, borderColor: isSelected || isRight ? colors.lip : '#d6d3d1', backgroundColor: isSelected || isRight ? colors.lip : 'transparent' }}
          >
            {(isSelected || isRight) && <Check size={13} color="#fff" strokeWidth={3} />}
          </View>
          <Text className="flex-1 text-lg font-bold text-stone-800">{text}</Text>
        </View>
      </Pressable3D>
    </Animated.View>
  );
}

export default function MultiSelect({ exercise, onSubmit, onCheckStateChange }) {
  const cfg = exercise.config || {};
  const choices = getChoices(exercise, cfg);
  const correctIdxs = getCorrectIndices(exercise, cfg, choices);
  const minSelect = Number.isFinite(cfg.minSelect) ? Number(cfg.minSelect) : 1;
  const maxSelect = Number.isFinite(cfg.maxSelect) ? Number(cfg.maxSelect) : choices.length;

  const [selectedSet, setSelectedSet] = useState(() => new Set());
  const [graded, setGraded] = useState(null);

  useEffect(() => {
    setSelectedSet(new Set());
    setGraded(null);
  }, [exercise.id]);

  function toggle(i) {
    if (graded) return;
    haptics.impact();
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else {
        if (next.size >= maxSelect) return next;
        next.add(i);
      }
      return next;
    });
  }

  const selectedArray = Array.from(selectedSet).sort((a, b) => a - b);
  const canCheck = selectedArray.length >= minSelect && !graded;

  function isCorrectSelection() {
    const target = [...correctIdxs].sort((a, b) => a - b);
    if (target.length === 0) return false;
    if (target.length !== selectedArray.length) return false;
    return target.every((v, idx) => Number(v) === Number(selectedArray[idx]));
  }

  function check() {
    const ok = isCorrectSelection();
    setGraded({ ok });
    if (ok) haptics.success();
    else haptics.error();
    onSubmit({
      selectedIndices: selectedArray,
      answerText: selectedArray.map((i) => choices[i] ?? '').join(', '),
      isCorrect: ok,
    });
  }

  useEffect(() => {
    onCheckStateChange?.({ canCheck, run: graded ? null : check });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSet, graded]);

  return (
    <View className="flex-1">
      <ExerciseEyebrow icon={ListChecks} label="Select all that apply" color="#FF7A1A" tint="#FFF5EC" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'Select all correct answers'}</Text>
      <Text className="mt-1 text-sm font-semibold text-stone-500">
        Select {minSelect}
        {maxSelect < choices.length ? `–${maxSelect}` : ''} option(s).
      </Text>

      <View className="mt-5" style={{ gap: 10 }}>
        {choices.map((text, i) => {
          const isSelected = selectedSet.has(i);
          const isRight = !!graded && correctIdxs.includes(i);
          const isWrongPick = !!graded && isSelected && !correctIdxs.includes(i);
          return (
            <MultiTile
              key={i}
              text={text}
              disabled={!!graded}
              onPress={() => toggle(i)}
              isRight={isRight}
              isWrongPick={isWrongPick}
              isSelected={isSelected}
            />
          );
        })}
      </View>
    </View>
  );
}
