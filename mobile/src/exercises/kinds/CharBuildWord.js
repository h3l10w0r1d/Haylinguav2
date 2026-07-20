// src/exercises/kinds/CharBuildWord.js — ports ExCharBuildWord. Tap letter
// tiles in order to build a word — no drag library needed (confirmed by
// reading the web source: tiles are tapped, not dragged).
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, withSpring } from 'react-native-reanimated';
import Pressable3D from '../../components/Pressable3D';
import { haptics } from '../../lib/haptics';

function Tile({ text, isUsed, disabled, onPress }) {
  const pop = useSharedValue(1);

  useEffect(() => {
    if (isUsed) pop.value = withSequence(withTiming(0.85, { duration: 90 }), withSpring(1, { damping: 9 }));
  }, [isUsed]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable3D disabled={disabled} onPress={onPress} hapticOnPress={false} pressDepth={2}>
        <View className={'rounded-xl border-2 px-4 py-2.5 ' + (isUsed ? 'border-stone-200 bg-stone-100' : 'border-stone-200 bg-white')}>
          <Text className={'text-lg font-bold ' + (isUsed ? 'text-stone-300' : 'text-stone-800')}>{text}</Text>
        </View>
      </Pressable3D>
    </Animated.View>
  );
}

export default function CharBuildWord({ exercise, onSubmit, onCheckStateChange }) {
  const cfg = exercise.config || {};
  const tiles = cfg.tiles ?? [];
  const solution = cfg.solutionIndices ?? [];
  const targetWord = cfg.targetWord;

  const [chosen, setChosen] = useState([]);
  const [used, setUsed] = useState(new Set());
  const [graded, setGraded] = useState(null);

  useEffect(() => {
    setChosen([]);
    setUsed(new Set());
    setGraded(null);
  }, [exercise.id]);

  const built = chosen.map((i) => tiles[i]).join('');
  const canCheck = chosen.length > 0 && !graded;

  function reset() {
    setChosen([]);
    setUsed(new Set());
  }

  function pick(idx) {
    if (used.has(idx) || graded) return;
    haptics.impact();
    const next = new Set(used);
    next.add(idx);
    setUsed(next);
    setChosen((prev) => [...prev, idx]);
  }

  function check() {
    const solutionIndices = solution.length > 0 ? solution : null;
    const ok = solutionIndices
      ? solutionIndices.length === chosen.length && solutionIndices.every((v, i) => Number(v) === Number(chosen[i]))
      : built.trim() === (targetWord ?? '').trim();
    setGraded({ ok });
    if (ok) haptics.success();
    else haptics.error();
    onSubmit({ selectedIndices: chosen, answerText: built });
  }

  useEffect(() => {
    onCheckStateChange?.({ canCheck, run: graded ? null : check });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen, graded]);

  return (
    <View className="flex-1">
      <Text className="text-lg font-extrabold text-stone-900">{exercise.prompt || 'Build the word'}</Text>
      {!!targetWord && (
        <Text className="mt-1 text-sm font-semibold text-stone-500">
          Target: <Text className="font-bold text-stone-800">{targetWord}</Text>
        </Text>
      )}

      <View className="mt-4 rounded-2xl bg-stone-100 p-4">
        <Text className="min-h-[2.5rem] text-2xl font-extrabold text-stone-900">{built || '…'}</Text>
        <Pressable3D
          onPress={reset}
          disabled={chosen.length === 0 || !!graded}
          pressDepth={2}
          className="mt-3 self-start rounded-xl bg-white px-4 py-2"
        >
          <Text className="text-sm font-bold text-stone-600">Reset</Text>
        </Pressable3D>
      </View>

      <View className="mt-4 flex-row flex-wrap" style={{ gap: 8 }}>
        {tiles.map((t, idx) => (
          <Tile key={idx} text={t} isUsed={used.has(idx)} disabled={used.has(idx) || !!graded} onPress={() => pick(idx)} />
        ))}
      </View>
    </View>
  );
}
