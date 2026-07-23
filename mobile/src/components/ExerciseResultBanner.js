// src/components/ExerciseResultBanner.js — the colored bottom-docked
// correct/wrong feedback sheet, replacing each exercise kind's old inline
// "Correct!"/error text. Mirrors the web's result panel
// (src/ExerciseShell.jsx:376-450): mascot + heading + XP + Continue,
// slides up from off-screen.
import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, Easing } from 'react-native-reanimated';
import { Sparkles } from 'lucide-react-native';
import Pressable3D from './Pressable3D';
import ExplainMistake from './ExplainMistake';

export default function ExerciseResultBanner({
  visible,
  correct,
  xpEarned = 0,
  combo = 0,
  comboBonusXp = 0,
  exerciseId,
  userAnswer,
  correctAnswer,
  onContinue,
}) {
  const slide = useSharedValue(120);
  const mascot = useSharedValue(0);

  useEffect(() => {
    slide.value = withTiming(visible ? 0 : 120, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [visible]);

  // Mascot reacts differently to correct vs. wrong — same owl image both
  // ways (mirrors web's Illustration.jsx registry, which only swaps CSS
  // animation class between mascot-cheer/mascot-sad, not the image itself):
  // a cheerful bounce loop on correct, a subtle single head-tilt on wrong.
  useEffect(() => {
    if (!visible) return;
    if (correct) {
      mascot.value = withRepeat(withSequence(withTiming(1, { duration: 260 }), withTiming(0, { duration: 260 })), -1, false);
    } else {
      mascot.value = withSequence(withTiming(1, { duration: 220 }), withTiming(0, { duration: 220 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, correct]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: slide.value }] }));
  const mascotStyle = useAnimatedStyle(() =>
    correct
      ? { transform: [{ scale: 1 + mascot.value * 0.1 }, { translateY: -mascot.value * 4 }] }
      : { transform: [{ rotate: `${-mascot.value * 8}deg` }, { translateY: mascot.value * 2 }] }
  );

  if (!visible) return null;

  const bg = correct ? '#D7F5BA' : '#FFD1D1';
  const topBorder = correct ? '#58CC02' : '#FF4B4B';
  const headingColor = correct ? '#3A8A00' : '#C81E1E';
  const buttonBg = correct ? '#58CC02' : '#FF4B4B';
  const buttonLip = correct ? '#3A8A00' : '#C81E1E';

  return (
    <Animated.View
      style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: bg, borderTopWidth: 4, borderTopColor: topBorder }, style]}
    >
      {correct && combo >= 3 && (
        <View className="absolute right-4 top-[-14px] flex-row items-center gap-1 rounded-full bg-brand-500 px-2.5 py-1">
          <Text className="text-xs font-extrabold text-white">{`\u{1F525} ${combo} in a row!`}</Text>
        </View>
      )}
      <SafeAreaView edges={['bottom']}>
        <View className="flex-row items-end gap-2 px-3 pt-2">
          {/* Full-body mascot, uncropped (contain, no frame) — Duolingo shows
              Duo's whole reaction pose here, not a cropped avatar square. */}
          <Animated.Image
            source={require('../assets/character-owl.png')}
            style={[{ width: 84, height: 84, marginBottom: -6 }, mascotStyle]}
            resizeMode="contain"
          />
          <View className="min-w-0 flex-1 pb-3">
            <Text className="text-xl font-extrabold font-display" style={{ color: headingColor }}>
              {correct ? 'Correct!' : 'Not quite'}
            </Text>
            {correct && xpEarned > 0 && (
              <Text className="text-sm font-bold text-stone-600">{`+${xpEarned} XP earned`}</Text>
            )}
            {correct && comboBonusXp > 0 && (
              <View className="mt-1 flex-row items-center gap-1 self-start rounded-full bg-brand-100 px-2 py-0.5">
                <Sparkles size={11} color="#7A4A00" />
                <Text className="text-xs font-extrabold text-brand-700">{`+${comboBonusXp} combo`}</Text>
              </View>
            )}
            {!correct && !!correctAnswer && (
              <View className="mt-1.5">
                <Text className="text-[11px] font-bold uppercase tracking-wide text-cardinal-700/70">Correct answer</Text>
                <Text className="text-base font-extrabold text-cardinal-800">{correctAnswer}</Text>
              </View>
            )}
            {!correct && <ExplainMistake exerciseId={exerciseId} userAnswer={userAnswer} />}
          </View>
        </View>
        <View className="px-4 pb-4 pt-3">
          <Pressable3D
            onPress={onContinue}
            className="items-center rounded-full py-4"
            style={{ backgroundColor: buttonBg, borderBottomWidth: 4, borderBottomColor: buttonLip }}
          >
            <Text className="text-base font-extrabold uppercase tracking-wide text-white">Continue</Text>
          </Pressable3D>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}
