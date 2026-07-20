// src/components/ChestReveal.js — a simplified port of the web's
// ChestOpening.jsx (src/lib/ChestOpening.jsx). Tap the chest → shake → lid
// "opens" → reward reveals with a confetti burst tinted by rarity. The web
// version has a much bigger VFX system per rarity tier (escalating
// canvas-confetti bursts, spinning light rays, screen shake for
// golden/legendary) — this mobile v1 keeps the reward logic and rarity
// coloring but simplifies the visual tiering to color-only, flagged as a
// deliberate scope cut, not a silent omission.
import React, { useEffect, useState } from 'react';
import { Modal, View, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, withSpring } from 'react-native-reanimated';
import { Gift, Gem, Zap } from 'lucide-react-native';
import Confetti from './Confetti';
import Pressable3D from './Pressable3D';
import { haptics } from '../lib/haptics';
import { api } from '../lib/api';

const RARITY_COLORS = {
  wooden: { bg: '#B07A45', confetti: ['#B07A45', '#D9A05B', '#FFE08A', '#9C9CA6'] },
  silver: { bg: '#9FB6CC', confetti: ['#EAF0F6', '#9FB6CC', '#1CB0F6', '#FFFFFF'] },
  golden: { bg: '#FFC800', confetti: ['#FFC800', '#FFE44D', '#FF7A1A', '#FFFFFF'] },
  legendary: { bg: '#C36BFF', confetti: ['#C36BFF', '#FFC800', '#FF4081', '#1CB0F6'] },
};

export default function ChestReveal({ visible, onClose, onOpened }) {
  const [phase, setPhase] = useState('idle'); // idle | opening | revealed | error
  const [reward, setReward] = useState(null);
  const shakeRotate = useSharedValue(0);
  const revealPop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setPhase('idle');
      setReward(null);
      shakeRotate.value = 0;
      revealPop.value = 0;
    }
  }, [visible]);

  const chestStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${shakeRotate.value}deg` }],
  }));

  const revealStyle = useAnimatedStyle(() => ({
    opacity: revealPop.value,
    transform: [{ scale: 0.6 + revealPop.value * 0.4 }, { translateY: (1 - revealPop.value) * 20 }],
  }));

  async function open() {
    if (phase !== 'idle') return;
    setPhase('opening');
    shakeRotate.value = withSequence(
      withTiming(-8, { duration: 90 }),
      withTiming(8, { duration: 90 }),
      withTiming(-6, { duration: 90 }),
      withTiming(6, { duration: 90 }),
      withTiming(0, { duration: 90 })
    );

    try {
      const [result] = await Promise.all([
        api.post('/me/chests/open', {}),
        new Promise((r) => setTimeout(r, 480)),
      ]);
      setReward(result);
      setPhase('revealed');
      revealPop.value = withSpring(1, { damping: 11, stiffness: 140 });
      haptics.success();
      onOpened?.(result);
    } catch {
      setPhase('error');
      haptics.error();
    }
  }

  const theme = reward ? RARITY_COLORS[reward.rarity] || RARITY_COLORS.wooden : RARITY_COLORS.wooden;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/60 px-8">
        {phase === 'revealed' && <Confetti colors={theme.confetti} count={48} active />}

        {phase !== 'revealed' && phase !== 'error' && (
          <Pressable3D onPress={open} pressDepth={6}>
            <Animated.View style={chestStyle}>
              <View className="h-32 w-32 items-center justify-center rounded-3xl" style={{ backgroundColor: theme.bg }}>
                <Gift size={56} color="#fff" />
              </View>
            </Animated.View>
            <Text className="mt-4 text-center text-base font-bold text-white">
              {phase === 'opening' ? 'Opening…' : 'Tap to open'}
            </Text>
          </Pressable3D>
        )}

        {phase === 'error' && (
          <View className="items-center">
            <Text className="text-center text-base font-bold text-white">Couldn't open this chest. Try again.</Text>
            <Pressable3D onPress={() => setPhase('idle')} className="mt-4 rounded-xl bg-white/20 px-5 py-3">
              <Text className="font-bold text-white">Retry</Text>
            </Pressable3D>
          </View>
        )}

        {phase === 'revealed' && reward && (
          <Animated.View style={revealStyle} className="items-center">
            <View className="h-24 w-24 items-center justify-center rounded-full bg-white/15">
              {reward.reward_type === 'xp_boost' ? <Zap size={44} color="#FFC800" /> : <Gem size={44} color="#1CB0F6" />}
            </View>
            <Text className="mt-4 text-2xl font-extrabold text-white">
              {reward.reward_type === 'xp_boost' ? 'XP Boost activated!' : `+${reward.reward_gems} gems`}
            </Text>
            <Text className="mt-1 text-sm font-bold uppercase tracking-wide text-white/70">{reward.rarity} chest</Text>
          </Animated.View>
        )}

        {(phase === 'revealed' || phase === 'error') && (
          <Pressable3D onPress={onClose} className="mt-10 items-center rounded-2xl bg-white px-8 py-4">
            <Text className="text-base font-extrabold text-stone-900">Nice!</Text>
          </Pressable3D>
        )}
      </View>
    </Modal>
  );
}
