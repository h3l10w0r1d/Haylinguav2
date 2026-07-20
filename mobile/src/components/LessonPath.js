// src/components/LessonPath.js — a winding column of circular lesson nodes,
// Duolingo's actual skill-tree shape, connected by a dotted react-native-svg
// path. Renders one chapter's worth of lessons at a time (the Dashboard
// stacks a UnitBanner + LessonPath per chapter).
import React, { useEffect } from 'react';
import { View, Text, Image } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Check, Lock } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import Pressable3D from './Pressable3D';

const NODE_SIZE = 64;
const V_GAP = 92;
// Short repeating zigzag pattern (px offset from center), same silhouette
// Duolingo's path uses without needing a literal sine curve.
const OFFSETS = [0, 56, 84, 56, 0, -56, -84, -56];
const PATH_WIDTH = 220; // must comfortably fit NODE_SIZE + max |offset|

function offsetFor(i) {
  return OFFSETS[i % OFFSETS.length];
}

function PulseRing({ color }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 })), -1, false);
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - pulse.value,
    transform: [{ scale: 1 + pulse.value * 0.45 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: NODE_SIZE, height: NODE_SIZE, borderRadius: NODE_SIZE / 2, backgroundColor: color }, style]}
    />
  );
}

function MascotBounce({ style }) {
  const bounce = useSharedValue(0);
  useEffect(() => {
    bounce.value = withRepeat(withSequence(withTiming(1, { duration: 550, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 550, easing: Easing.inOut(Easing.quad) })), -1, false);
  }, []);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -bounce.value * 8 }, { rotate: `${(bounce.value - 0.5) * 8}deg` }],
  }));
  return (
    <Animated.View style={[style, animStyle]} pointerEvents="none">
      <Image source={require('../assets/character-owl.png')} style={{ width: 56, height: 56, resizeMode: 'contain' }} />
    </Animated.View>
  );
}

function Node({ lesson, x, y, onPress }) {
  const status = lesson.status || 'locked';
  const locked = status === 'locked';
  const completed = status === 'completed';
  const current = status === 'current';

  const bg = completed ? '#58CC02' : current ? '#FF7A1A' : '#e7e5e4';
  const border = completed ? '#46A302' : current ? '#E85F00' : '#d6d3d1';

  return (
    <View style={{ position: 'absolute', left: x, top: y, width: NODE_SIZE, alignItems: 'center' }}>
      {current && (
        <View className="mb-1.5 rounded-full bg-white px-3 py-1" style={{ shadowColor: '#1c1917', shadowOpacity: 0.15, shadowRadius: 6, elevation: 2 }}>
          <Text className="text-[11px] font-extrabold uppercase tracking-wide text-brand-600">Start</Text>
        </View>
      )}
      <View style={{ width: NODE_SIZE, height: NODE_SIZE, alignItems: 'center', justifyContent: 'center' }}>
        {current && <PulseRing color="#FF7A1A55" />}
        <Pressable3D onPress={locked ? undefined : onPress} disabled={locked} pressDepth={5}>
          <View
            style={{
              width: NODE_SIZE,
              height: NODE_SIZE,
              borderRadius: NODE_SIZE / 2,
              backgroundColor: bg,
              borderBottomWidth: 5,
              borderColor: border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {completed ? <Check size={28} color="#fff" strokeWidth={3} /> : locked ? <Lock size={22} color="#a8a29e" /> : <View className="h-3.5 w-3.5 rounded-full bg-white" />}
          </View>
        </Pressable3D>
        {current && <MascotBounce style={{ position: 'absolute', left: NODE_SIZE + 6, top: -6 }} />}
      </View>
      <Text className="mt-1.5 max-w-[92px] text-center text-[11px] font-bold text-stone-500" numberOfLines={2}>
        {lesson.title}
      </Text>
    </View>
  );
}

export default function LessonPath({ lessons, onPressLesson }) {
  if (!lessons.length) return null;

  const centerX = PATH_WIDTH / 2 - NODE_SIZE / 2;
  const positions = lessons.map((lesson, i) => ({ lesson, x: centerX + offsetFor(i), y: i * V_GAP }));
  const height = (lessons.length - 1) * V_GAP + NODE_SIZE + 56;

  const segments = [];
  for (let i = 0; i < positions.length - 1; i++) {
    const a = positions[i];
    const b = positions[i + 1];
    const ax = a.x + NODE_SIZE / 2;
    const ay = a.y + NODE_SIZE / 2;
    const bx = b.x + NODE_SIZE / 2;
    const by = b.y + NODE_SIZE / 2;
    segments.push(`M ${ax} ${ay} L ${bx} ${by}`);
  }

  return (
    <View style={{ width: '100%', alignItems: 'center', marginBottom: 8 }}>
      <View style={{ width: PATH_WIDTH, height }}>
        {segments.length > 0 && (
          <Svg width={PATH_WIDTH} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            <Path d={segments.join(' ')} stroke="#d6d3d1" strokeWidth={4} strokeDasharray="2,14" strokeLinecap="round" fill="none" />
          </Svg>
        )}
        {positions.map(({ lesson, x, y }) => (
          <Node key={lesson.id} lesson={lesson} x={x} y={y} onPress={() => onPressLesson(lesson)} />
        ))}
      </View>
    </View>
  );
}
