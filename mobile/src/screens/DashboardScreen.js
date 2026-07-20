// src/screens/DashboardScreen.js — ports the web Dashboard's KPI strip +
// gradient "continue lesson" hero (src/Dashboard.jsx) to RN. Same visual
// language (apricot->pomegranate gradient, tinted stat chips), wired to the
// real backend: GET /me/lessons/progress + the shared statsStore.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { Heart, Flame, Zap, Gem, Play, ArrowRight, Gift } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { api } from '../lib/api';
import { useStatsStore } from '../lib/statsStore';
import Pressable3D from '../components/Pressable3D';
import ChestReveal from '../components/ChestReveal';
import UnitBanner from '../components/UnitBanner';
import LessonPath from '../components/LessonPath';

const ACCENT = {
  cardinal: { tint: '#FFECEC', icon: '#FF4B4B' },
  brand: { tint: '#FFF5EC', icon: '#FF7A1A' },
  gold: { tint: '#FFF8E1', icon: '#E0A800' },
  feather: { tint: '#E7F7FF', icon: '#1CB0F6' },
};

// A subtle continuous scale/rotate wobble mirroring the web header's still-
// live .flame-flicker + .flame-glow combo on the streak icon.
function FlameIcon({ color, size }) {
  const wobble = useSharedValue(0);

  useEffect(() => {
    wobble.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 550, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 550, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + wobble.value * 0.08 }, { rotate: `${(wobble.value - 0.5) * 6}deg` }],
    shadowColor: color,
    shadowOpacity: 0.35 + wobble.value * 0.35,
    shadowRadius: 4 + wobble.value * 6,
    shadowOffset: { width: 0, height: 0 },
  }));

  return (
    <Animated.View style={style}>
      <Flame size={size} color={color} />
    </Animated.View>
  );
}

function KpiTile({ icon: Icon, accent, label, value, index, animateFlame }) {
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withDelay(index * 70, withSpring(1, { damping: 12, stiffness: 140 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.85 + enter.value * 0.15 }, { translateY: (1 - enter.value) * 10 }],
  }));

  return (
    <Animated.View style={[animatedStyle, { width: '47%' }]}>
      <View
        className="flex-row items-center gap-2.5 rounded-2xl bg-white px-3.5 py-3"
        style={{ shadowColor: '#1c1917', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}
      >
        <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: accent.tint }}>
          {animateFlame ? <FlameIcon color={accent.icon} size={18} /> : <Icon size={18} color={accent.icon} />}
        </View>
        <View>
          <Text className="text-xl font-extrabold text-stone-900">{value}</Text>
          <Text className="text-[11px] font-semibold text-stone-400">{label}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// Fade + slide-in entrance for the hero card on mount (mirrors the web's
// .page-in). style is the caller's outer box style (radius/margin/overflow).
function HeroCard({ style, children }) {
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = withDelay(120, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 16 }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

export default function DashboardScreen({ navigation }) {
  const stats = useStatsStore();
  const [lessons, setLessons] = useState([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chestOpen, setChestOpen] = useState(false);

  const load = useCallback(async () => {
    setLoadingLessons(true);
    try {
      const data = await api.get('/me/lessons/progress');
      setLessons(Array.isArray(data) ? data : []);
    } catch {
      // stats/lesson failures shouldn't crash the dashboard
    } finally {
      setLoadingLessons(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      stats.refresh();
    }, [load])
  );

  const currentLesson = useMemo(() => lessons.find((l) => l.status === 'current') || null, [lessons]);

  // Group into chapters, preserving the backend's own ordering (already
  // sorted by chapter_position/level) — this is the "unit" grouping the
  // skill path renders one banner + node column per.
  const chapters = useMemo(() => {
    const groups = [];
    const byId = new Map();
    for (const l of lessons) {
      const key = l.chapter_id ?? `_${l.id}`;
      let group = byId.get(key);
      if (!group) {
        group = { chapterId: l.chapter_id, chapterTitle: l.chapter_title || 'Lessons', lessons: [] };
        byId.set(key, group);
        groups.push(group);
      }
      group.lessons.push(l);
    }
    return groups;
  }, [lessons]);
  const doneCount = lessons.filter((l) => l.status === 'completed').length;
  const isNewUser = !loadingLessons && doneCount === 0 && lessons.length > 0;
  const allComplete = !loadingLessons && lessons.length > 0 && !currentLesson && doneCount === lessons.length;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), stats.refresh()]);
    setRefreshing(false);
  };

  const heartLabel = stats.isPremium ? '∞' : stats.heartsCurrent ?? '–';

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top']}>
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* KPI strip */}
      <View className="mb-4 flex-row flex-wrap justify-between gap-y-2.5">
        <KpiTile icon={Heart} accent={ACCENT.cardinal} label="Hearts" value={heartLabel} index={0} />
        <KpiTile icon={Flame} accent={ACCENT.brand} label="Streak" value={stats.streak} index={1} animateFlame />
        <KpiTile icon={Zap} accent={ACCENT.gold} label="XP" value={stats.totalXp} index={2} />
        <KpiTile icon={Gem} accent={ACCENT.feather} label="Gems" value={stats.gems ?? '–'} index={3} />
      </View>

      {/* Hero — the gradient is a pure absolute-fill background; the padded
          content View is what actually determines this box's height. Keeping
          the gradient decoupled from content sizing avoids a real layout bug
          where the outer box's auto-computed height came up short by exactly
          one padding unit, clipping the CTA button off (confirmed via onLayout
          measurements: content needed ~214px, box only got ~190px). */}
      <HeroCard style={{ borderRadius: 24, marginBottom: 16, overflow: 'hidden' }}>
        <LinearGradient
          colors={allComplete ? ['#7CE246', '#58CC02', '#1CB0F6'] : ['#FF9342', '#FF7A1A', '#E11D48']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ padding: 24 }}>
          <Text className="text-sm font-bold text-white/85">Բարև 👋</Text>
          <Text className="mt-1.5 text-2xl font-extrabold text-white">
            {loadingLessons ? 'Loading your journey…' : currentLesson ? "Ready for today's lesson?" : "You've reached the summit!"}
          </Text>

          {loadingLessons ? (
            <View className="mt-6 h-[72px] items-center justify-center rounded-2xl bg-white/20">
              <ActivityIndicator color="#fff" />
            </View>
          ) : currentLesson ? (
            <Pressable3D
              onPress={() => navigation.navigate('Lesson', { slug: currentLesson.slug, title: currentLesson.title })}
              className="mt-6 flex-row items-center gap-4 rounded-2xl bg-white px-5 py-4"
            >
              <View className="h-12 w-12 items-center justify-center rounded-xl bg-brand-500">
                <Play size={20} color="#fff" fill="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-[11px] font-extrabold uppercase tracking-wide text-brand-600">
                  {currentLesson.completion_pct > 0 ? 'Continue lesson' : 'Start lesson'}
                </Text>
                <Text className="text-lg font-extrabold text-stone-900" numberOfLines={1}>{currentLesson.title}</Text>
              </View>
              <ArrowRight size={20} color="#FF7A1A" />
            </Pressable3D>
          ) : (
            <View className="mt-6 rounded-2xl bg-white/15 px-5 py-4">
              <Text className="text-sm font-bold text-white">No lessons available yet.</Text>
            </View>
          )}

          {isNewUser && (
            <Text className="mt-4 text-sm font-bold text-white/90">Not a beginner? Take the placement test (coming soon)</Text>
          )}
        </View>
      </HeroCard>

      {/* Chest card — mirrors the web's Dashboard.jsx ChestCard: persistently
          shown whenever the account has an unopened chest, not just right
          after finishing a lesson (chests are earned on first-time lesson
          completion but stay openable any time). */}
      {stats.chests > 0 && (
        <Pressable3D onPress={() => setChestOpen(true)} className="mb-4 flex-row items-center gap-4 rounded-2xl bg-white p-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
          <View className="h-12 w-12 items-center justify-center rounded-xl bg-gold-50">
            <Gift size={24} color="#E0A800" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-extrabold text-stone-900">
              {stats.chests > 1 ? `${stats.chests} chests to open!` : 'A chest is waiting!'}
            </Text>
            <Text className="text-xs font-semibold text-stone-400">Tap to open and claim your reward</Text>
          </View>
          <ArrowRight size={18} color="#a8a29e" />
        </Pressable3D>
      )}

      {/* Skill path — one colored unit banner + zigzag node column per
          chapter, real Duolingo shape instead of a flat lesson list. */}
      {chapters.map((chapter, idx) => (
        <View key={chapter.chapterId ?? idx}>
          <UnitBanner title={chapter.chapterTitle} bannerIndex={idx} />
          <LessonPath
            lessons={chapter.lessons}
            onPressLesson={(l) => navigation.navigate('Lesson', { slug: l.slug, title: l.title })}
          />
        </View>
      ))}
    </ScrollView>
    <ChestReveal
      visible={chestOpen}
      onOpened={(wallet) => useStatsStore.getState().applyWallet(wallet)}
      onClose={() => setChestOpen(false)}
    />
    </SafeAreaView>
  );
}
