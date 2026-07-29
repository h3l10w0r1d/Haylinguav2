// src/screens/WelcomeScreen.js — branded splash shown once whenever the
// app determines the user is signed out (cold launch, or right after
// logout), before Login/Signup. Mirrors the "mascot on a gradient sky"
// pattern common to onboarding-heavy consumer apps: a full-bleed brand
// gradient, soft cloud shapes, the owl mascot with a gentle idle float,
// and the wordmark — then auto-advances into Login after a beat.
import React, { useEffect } from 'react';
import { View, Text, Image, Dimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_W } = Dimensions.get('window');

function Cloud({ style }) {
  return (
    <View
      style={[
        { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999 },
        style,
      ]}
    />
  );
}

function Sparkle({ style, size = 14 }) {
  return (
    <Text style={[{ position: 'absolute', fontSize: size, color: 'rgba(255,255,255,0.55)' }, style]}>
      ✦
    </Text>
  );
}

export default function WelcomeScreen({ navigation }) {
  const mascotEnter = useSharedValue(0);
  const mascotIdle = useSharedValue(0);
  const wordmarkEnter = useSharedValue(0);

  useEffect(() => {
    mascotEnter.value = withTiming(1, { duration: 550, easing: Easing.out(Easing.back(1.4)) });
    wordmarkEnter.value = withDelay(280, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
    mascotIdle.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );

    const timer = setTimeout(() => {
      navigation.replace('Login');
    }, 1900);
    return () => clearTimeout(timer);
  }, [navigation]);

  const mascotStyle = useAnimatedStyle(() => ({
    opacity: mascotEnter.value,
    transform: [
      { scale: 0.7 + mascotEnter.value * 0.3 },
      { translateY: -mascotIdle.value * 8 },
    ],
  }));

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkEnter.value,
    transform: [{ translateY: (1 - wordmarkEnter.value) * 10 }],
  }));

  return (
    <LinearGradient colors={['#FF9342', '#FF7A1A', '#E11D48']} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} style={{ flex: 1 }}>
      <Cloud style={{ width: 180, height: 60, top: 90, left: -30 }} />
      <Cloud style={{ width: 140, height: 50, top: 130, right: -20 }} />
      <Cloud style={{ width: 110, height: 40, top: 220, left: SCREEN_W * 0.32 }} />
      <Sparkle style={{ top: 100, left: 40 }} size={16} />
      <Sparkle style={{ top: 170, right: 50 }} size={12} />
      <Sparkle style={{ top: 280, left: 70 }} size={10} />
      <Sparkle style={{ top: 240, right: 90 }} size={14} />

      <View className="flex-1 items-center justify-center px-8">
        <Animated.View style={mascotStyle}>
          <Image
            source={require('../assets/character-owl.png')}
            style={{ width: 168, height: 168, resizeMode: 'contain' }}
          />
        </Animated.View>
      </View>

      <Animated.View style={[wordmarkStyle, { alignItems: 'center', paddingBottom: 64 }]}>
        <Text className="text-3xl font-extrabold text-white font-display">Haylingua</Text>
        <Text className="mt-1.5 text-sm font-semibold text-white/80">Learn Armenian, one lesson at a time</Text>
      </Animated.View>
    </LinearGradient>
  );
}
