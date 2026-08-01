// src/screens/LessonCompleteScreen.js — a focused v1 of the web's
// LessonCompletionScreen: XP count-up, streak, a confetti burst, a chest
// entry point (if this lesson's completion earned one), and (if a streak
// milestone was just crossed) a distinct congratulatory state — all in one
// screen rather than the web's separate StreakCelebration overlay.
//
// Explicitly NOT ported (see the animation-pass plan): the quest/
// achievement/league "RewardReveal" staged reveal (those screens don't
// exist on mobile yet). This screen covers XP + streak + chest, the things
// every lesson completion can have.
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Flame, Zap, Gift } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming, withSpring, Easing } from 'react-native-reanimated';
import Pressable3D from '../components/Pressable3D';
import Confetti from '../components/Confetti';
import ChestReveal from '../components/ChestReveal';
import { haptics } from '../lib/haptics';
import { markStreakMilestoneSeen } from '../lib/streakMilestones';
import { useStatsStore } from '../lib/statsStore';
import { useCountUp } from '../lib/useCountUp';

const CONFETTI_COLORS = ['#FF7A1A', '#58CC02', '#1CB0F6', '#FFC800', '#E11D48'];

function PopIn({ delay = 0, children, style }) {
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 140 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.7 + enter.value * 0.3 }, { translateY: (1 - enter.value) * 16 }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

export default function LessonCompleteScreen({ route, navigation }) {
  const { xpEarned = 0, streak = 0, milestoneHit = null, chestEarned = false } = route.params || {};
  const xpDisplay = useCountUp(xpEarned, { duration: 900, startFromZero: true });
  const [chestOpen, setChestOpen] = useState(false);

  useEffect(() => {
    haptics.success();
    if (milestoneHit) markStreakMilestoneSeen(milestoneHit);
  }, [milestoneHit]);

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]">
      <Confetti colors={CONFETTI_COLORS} count={42} active />

      <View className="flex-1 items-center justify-center px-8">
        {milestoneHit ? (
          <>
            <PopIn>
              <View className="h-24 w-24 items-center justify-center rounded-full bg-brand-50">
                <Flame size={56} color="#FF7A1A" />
              </View>
            </PopIn>
            <PopIn delay={100} style={{ marginTop: 20 }}>
              <Text className="text-center text-2xl font-extrabold text-stone-900 font-display">{milestoneHit}-day streak!</Text>
            </PopIn>
            <PopIn delay={180} style={{ marginTop: 6 }}>
              <Text className="text-center text-base font-semibold text-stone-500">You're on fire. Keep it going.</Text>
            </PopIn>
          </>
        ) : (
          <>
            <PopIn>
              <View className="h-24 w-24 items-center justify-center rounded-full bg-grass-50">
                <Zap size={48} color="#58CC02" />
              </View>
            </PopIn>
            <PopIn delay={100} style={{ marginTop: 20 }}>
              <Text className="text-center text-2xl font-extrabold text-stone-900 font-display">Lesson complete!</Text>
            </PopIn>
          </>
        )}

        <PopIn delay={260} style={{ marginTop: 28, width: '100%' }}>
          <View className="flex-row justify-center gap-4">
            <View className="flex-1 items-center rounded-2xl bg-white px-4 py-5" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
              <Text className="text-2xl font-extrabold text-brand-600 font-display">+{xpDisplay}</Text>
              <Text className="mt-1 text-xs font-bold uppercase tracking-wide text-stone-400">XP earned</Text>
            </View>
            <View className="flex-1 items-center rounded-2xl bg-white px-4 py-5" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
              <Text className="text-2xl font-extrabold text-stone-900 font-display">{streak}</Text>
              <Text className="mt-1 text-xs font-bold uppercase tracking-wide text-stone-400">Day streak</Text>
            </View>
          </View>
        </PopIn>

        {chestEarned && (
          <PopIn delay={340} style={{ marginTop: 16, width: '100%' }}>
            <Pressable3D onPress={() => setChestOpen(true)} className="flex-row items-center gap-3 rounded-2xl bg-gold-50 px-4 py-4">
              <Gift size={22} color="#E0A800" />
              <Text className="flex-1 text-sm font-extrabold text-stone-900">You earned a chest!</Text>
              <Text className="text-xs font-bold uppercase tracking-wide text-gold-600">Open</Text>
            </Pressable3D>
          </PopIn>
        )}
      </View>

      <View className="px-6 pb-6">
        <Pressable3D onPress={() => navigation.popToTop()} className="items-center rounded-2xl bg-brand-500 py-4">
          <Text className="text-base font-extrabold text-white">Continue</Text>
        </Pressable3D>
      </View>

      <ChestReveal
        visible={chestOpen}
        onOpened={(wallet) => useStatsStore.getState().applyWallet(wallet)}
        onClose={() => setChestOpen(false)}
      />
    </SafeAreaView>
  );
}
