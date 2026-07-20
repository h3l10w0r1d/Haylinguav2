// src/exercises/kinds/MatchPairs.js — ports ExMatchPairs. Tap-based
// left/right column matching — no drag library needed. Tap a left item to
// select it, then tap a right item to attempt a match; correct matches lock
// in place. Once all pairs are matched, submits the whole mapping at once.
//
// Animation: a locked-in tile pops (scale bounce); a wrong attempt shakes
// both tapped tiles and fires a haptic error buzz; a correct match fires a
// haptic success buzz.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, withSpring } from 'react-native-reanimated';
import { normalizeText } from '../choiceHelpers';
import { Link2, CheckCircle2 } from 'lucide-react-native';
import Pressable3D from '../../components/Pressable3D';
import ExerciseEyebrow from '../ExerciseEyebrow';
import { haptics } from '../../lib/haptics';

function MatchTile({ text, isDone, active, disabled, onPress, wrongKey }) {
  const pop = useSharedValue(1);
  const shakeX = useSharedValue(0);

  useEffect(() => {
    if (isDone) pop.value = withSequence(withTiming(1.08, { duration: 110 }), withSpring(1, { damping: 9 }));
  }, [isDone]);

  useEffect(() => {
    if (!wrongKey) return;
    shakeX.value = withSequence(
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(-4, { duration: 50 }),
      withTiming(4, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrongKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }, { translateX: shakeX.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable3D disabled={disabled} onPress={onPress} hapticOnPress={false} pressDepth={2}>
        <View
          className={
            'rounded-xl border-2 px-3 py-3 ' +
            (isDone ? 'border-stone-200 bg-stone-100' : active ? 'border-brand-500 bg-brand-50' : 'border-stone-200 bg-white')
          }
        >
          <Text className={'text-sm font-semibold ' + (isDone ? 'text-stone-400' : 'text-stone-800')}>{text}</Text>
        </View>
      </Pressable3D>
    </Animated.View>
  );
}

export default function MatchPairs({ exercise, onSubmit }) {
  const cfg = exercise.config || {};
  const pairs = Array.isArray(cfg.pairs) ? cfg.pairs : [];
  const left = pairs.map((p) => p.left);
  const right = pairs.map((p) => p.right);

  const shuffledRight = useMemo(() => {
    const arr = [...right];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  const [selectedLeft, setSelectedLeft] = useState(null);
  const [matchedLeft, setMatchedLeft] = useState(new Set());
  const [matchedRight, setMatchedRight] = useState(new Set());
  const [matchedPairs, setMatchedPairs] = useState([]);
  const [wrongAttempt, setWrongAttempt] = useState({ lIdx: null, rIdx: null, key: 0 });

  useEffect(() => {
    setSelectedLeft(null);
    setMatchedLeft(new Set());
    setMatchedRight(new Set());
    setMatchedPairs([]);
    setWrongAttempt({ lIdx: null, rIdx: null, key: 0 });
  }, [exercise.id]);

  const totalMatches = pairs.length;
  const currentMatches = matchedLeft.size;

  function tryMatch(lIdx, rIdx) {
    const l = left[lIdx];
    const r = shuffledRight[rIdx];

    const correctPair = pairs.find((p) => normalizeText(p.left) === normalizeText(l));
    if (correctPair && normalizeText(correctPair.right) === normalizeText(r)) {
      haptics.success();
      const nl = new Set(matchedLeft);
      nl.add(lIdx);
      setMatchedLeft(nl);

      const nr = new Set(matchedRight);
      nr.add(rIdx);
      setMatchedRight(nr);

      setSelectedLeft(null);

      const nextPairs = [...matchedPairs, { left: l, right: r }];
      setMatchedPairs(nextPairs);

      if (nl.size === totalMatches) {
        onSubmit({ answerText: JSON.stringify(nextPairs) });
      }
    } else {
      haptics.error();
      setWrongAttempt({ lIdx, rIdx, key: wrongAttempt.key + 1 });
      setSelectedLeft(null);
    }
  }

  return (
    <View className="flex-1">
      <ExerciseEyebrow icon={Link2} label="Match the pairs" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'Match the pairs'}</Text>
      <View className="mt-1 flex-row items-center gap-1.5">
        <CheckCircle2 size={13} color={currentMatches === totalMatches ? '#58CC02' : '#a8a29e'} />
        <Text className="text-sm font-semibold text-stone-500">
          Matched: {currentMatches} / {totalMatches}
        </Text>
      </View>

      <View className="mt-4 flex-row" style={{ gap: 12 }}>
        <View className="flex-1" style={{ gap: 8 }}>
          {left.map((t, idx) => (
            <MatchTile
              key={idx}
              text={t}
              isDone={matchedLeft.has(idx)}
              active={selectedLeft === idx}
              disabled={matchedLeft.has(idx)}
              onPress={() => setSelectedLeft(idx)}
              wrongKey={wrongAttempt.lIdx === idx ? wrongAttempt.key : 0}
            />
          ))}
        </View>

        <View className="flex-1" style={{ gap: 8 }}>
          {shuffledRight.map((t, idx) => (
            <MatchTile
              key={idx}
              text={t}
              isDone={matchedRight.has(idx)}
              active={false}
              disabled={matchedRight.has(idx) || selectedLeft === null}
              onPress={() => tryMatch(selectedLeft, idx)}
              wrongKey={wrongAttempt.rIdx === idx ? wrongAttempt.key : 0}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
