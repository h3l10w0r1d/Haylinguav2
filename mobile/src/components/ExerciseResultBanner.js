// src/components/ExerciseResultBanner.js — the colored bottom-docked
// correct/wrong feedback sheet, replacing each exercise kind's old inline
// "Correct!"/error text. Mirrors the web's result panel
// (src/ExerciseShell.jsx:376-450): mascot + heading + XP + Continue,
// slides up from off-screen.
import React, { useEffect } from 'react';
import { View, Text, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import Pressable3D from './Pressable3D';

export default function ExerciseResultBanner({ visible, correct, xpEarned = 0, onContinue }) {
  const slide = useSharedValue(120);

  useEffect(() => {
    slide.value = withTiming(visible ? 0 : 120, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [visible]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: slide.value }] }));

  if (!visible) return null;

  const bg = correct ? '#D7F5BA' : '#FFD1D1';
  const topBorder = correct ? '#58CC02' : '#FF4B4B';
  const headingColor = correct ? '#3A8A00' : '#C81E1E';
  const buttonBg = correct ? '#58CC02' : '#FF4B4B';

  return (
    <Animated.View
      style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: bg, borderTopWidth: 4, borderTopColor: topBorder }, style]}
    >
      <SafeAreaView edges={['bottom']}>
        <View className="flex-row items-center gap-4 px-4 pt-4 pb-2">
          <Image
            source={require('../assets/character-owl.png')}
            style={{ width: 56, height: 56, borderRadius: 16 }}
            resizeMode="cover"
          />
          <View className="min-w-0 flex-1">
            <Text className="text-lg font-extrabold" style={{ color: headingColor }}>
              {correct ? 'Correct!' : 'Not quite'}
            </Text>
            {correct && xpEarned > 0 && (
              <Text className="text-sm font-bold text-stone-600">{`+${xpEarned} XP earned`}</Text>
            )}
          </View>
        </View>
        <View className="px-4 pb-4 pt-2">
          <Pressable3D onPress={onContinue} className="items-center rounded-2xl py-4" style={{ backgroundColor: buttonBg }}>
            <Text className="text-base font-extrabold text-white">Continue</Text>
          </Pressable3D>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}
