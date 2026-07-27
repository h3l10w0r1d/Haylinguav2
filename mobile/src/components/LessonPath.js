// src/components/LessonPath.js — a winding column of circular lesson nodes,
// Duolingo's actual skill-tree shape. No connecting line between nodes (real
// Duolingo doesn't draw one — the zigzag offsets alone read as a path).
// Chest milestone nodes are interleaved every 2-3 lessons (alternating, not
// a flat modulo — Duolingo's own cadence isn't perfectly uniform either),
// and the current lesson gets a radial progress ring + a speech-bubble
// mascot card with star-rating pips, matching Duolingo's actual home screen.
import React, { useEffect } from 'react';
import { View, Text, Image } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Check, Lock, Star } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import Pressable3D from './Pressable3D';
import ChestIcon from './ChestIcon';

const NODE_SIZE = 64;
// 64px node + ~6px label margin + up to 2 lines of an 11px title can reach
// ~100px before the next row starts — 92 was tight enough to let a 2-line
// title overlap whatever followed it (confirmed with real 2-line Armenian
// titles); 112 gives that safe clearance.
const V_GAP = 112;
const RING_SIZE = NODE_SIZE + 16;
// Alternating 2-then-3 cadence between chest milestones, not a flat modulo.
const CHEST_CADENCE = [2, 3];
// Short repeating zigzag pattern (px offset from center), same silhouette
// Duolingo's path uses without needing a literal sine curve.
const OFFSETS = [0, 56, 84, 56, 0, -56, -84, -56];
const PATH_WIDTH = 220; // must comfortably fit NODE_SIZE + max |offset|

function offsetFor(i) {
  return OFFSETS[i % OFFSETS.length];
}

function MascotBounce({ style }) {
  const bounce = useSharedValue(0);
  useEffect(() => {
    bounce.value = withRepeat(withSequence(withTiming(1, { duration: 550, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 550, easing: Easing.inOut(Easing.quad) })), -1, false);
  }, []);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -bounce.value * 4 }],
  }));
  return (
    <Animated.View style={[style, animStyle]} pointerEvents="none">
      <Image source={require('../assets/character-owl.png')} style={{ width: 40, height: 40, resizeMode: 'contain' }} />
    </Animated.View>
  );
}

// Speech-bubble card next to the current node: mascot + a row of 3 star
// pips previewing the perfect/good/pass score bands for that lesson.
function MascotBubble({ style }) {
  return (
    <View style={[{ width: 92, alignItems: 'center' }, style]} pointerEvents="none">
      <View className="rounded-2xl bg-white px-3 py-2.5" style={{ shadowColor: '#1c1917', shadowOpacity: 0.1, shadowRadius: 6, elevation: 2 }}>
        <MascotBounce />
        <View className="mt-1.5 flex-row items-center justify-center" style={{ gap: 2 }}>
          {[0, 1, 2].map((i) => (
            <Star key={i} size={11} color="#d6d3d1" fill="#d6d3d1" />
          ))}
        </View>
      </View>
    </View>
  );
}

function ProgressRing({ pct }) {
  const r = RING_SIZE / 2 - 3;
  const circumference = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, pct / 100));
  return (
    <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: 'absolute' }} pointerEvents="none">
      <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={r} stroke="#e7e5e4" strokeWidth={3} fill="none" />
      {filled > 0 && (
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={r}
          stroke="#58CC02"
          strokeWidth={3}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - filled)}
          strokeLinecap="round"
          rotation="-90"
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      )}
    </Svg>
  );
}

function Node({ lesson, x, y, onPress }) {
  const status = lesson.status || 'locked';
  const locked = status === 'locked';
  const completed = status === 'completed';
  const current = status === 'current';
  const pct = Number(lesson.completion_pct || 0);

  const bg = completed ? '#58CC02' : current ? '#FF7A1A' : '#e7e5e4';
  const border = completed ? '#46A302' : current ? '#E85F00' : '#d6d3d1';

  return (
    <View style={{ position: 'absolute', left: x, top: y, width: NODE_SIZE, alignItems: 'center' }}>
      <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center', marginLeft: -(RING_SIZE - NODE_SIZE) / 2 }}>
        {current && <ProgressRing pct={pct} />}
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
        {current && <MascotBubble style={{ position: 'absolute', left: NODE_SIZE + 12, top: -8 }} />}
      </View>
      <Text className="mt-1.5 max-w-[92px] text-center text-[11px] font-bold text-stone-500" numberOfLines={2}>
        {lesson.title}
      </Text>
    </View>
  );
}

// Purely decorative milestone marker — brown/open if the lesson just before
// it is already completed, gray/locked otherwise. Not pressable: chests are
// opened from the Dashboard's persistent chest card, not from the path.
// Uses the same RING_SIZE wrapper box (with the same recentering margin) as
// Node's circle, so the chest's center lines up with every lesson circle's
// center — ChestIcon's shape is shorter than it is wide, so without this it
// visually sits noticeably higher than the row it's supposed to share.
function ChestNode({ x, y, unlocked }) {
  return (
    <View style={{ position: 'absolute', left: x, top: y, width: NODE_SIZE, alignItems: 'center' }}>
      <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center', marginLeft: -(RING_SIZE - NODE_SIZE) / 2 }}>
        <ChestIcon size={NODE_SIZE} unlocked={unlocked} />
      </View>
    </View>
  );
}

export default function LessonPath({ lessons, onPressLesson }) {
  if (!lessons.length) return null;

  const centerX = PATH_WIDTH / 2 - NODE_SIZE / 2;

  // Interleave a decorative chest on an alternating 2-3 lesson cadence,
  // using the zigzag's own next offset slot so it sits naturally in the
  // winding path.
  const items = [];
  let sinceLastChest = 0;
  let cadenceIdx = 0;
  lessons.forEach((lesson, i) => {
    items.push({ type: 'lesson', lesson });
    sinceLastChest += 1;
    const target = CHEST_CADENCE[cadenceIdx % CHEST_CADENCE.length];
    if (sinceLastChest >= target && i < lessons.length - 1) {
      items.push({ type: 'chest', unlocked: lesson.status === 'completed' });
      sinceLastChest = 0;
      cadenceIdx += 1;
    }
  });

  const positions = items.map((item, i) => ({ item, x: centerX + offsetFor(i), y: i * V_GAP }));
  const height = (positions.length - 1) * V_GAP + NODE_SIZE + 56;

  return (
    <View style={{ width: '100%', alignItems: 'center', marginBottom: 8 }}>
      <View style={{ width: PATH_WIDTH, height }}>
        {positions.map(({ item, x, y }, i) =>
          item.type === 'chest' ? (
            <ChestNode key={`chest-${i}`} x={x} y={y} unlocked={item.unlocked} />
          ) : (
            <Node key={item.lesson.id} lesson={item.lesson} x={x} y={y} onPress={() => onPressLesson(item.lesson)} />
          )
        )}
      </View>
    </View>
  );
}
