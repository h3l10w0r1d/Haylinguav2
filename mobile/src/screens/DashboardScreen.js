// src/screens/DashboardScreen.js — ports the web Dashboard's KPI strip +
// gradient "continue lesson" hero (src/Dashboard.jsx) to RN. Same visual
// language (apricot->pomegranate gradient, tinted stat chips), wired to the
// real backend: GET /me/lessons/progress + the shared statsStore.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { Heart, Flame, Zap, Gem, Play, ArrowRight, Gift, BookOpen, Dumbbell, Shield } from 'lucide-react-native';
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
import { initPushNotifications } from '../lib/pushNotifications';

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

// Slim inline "icon + bold number" pair, no card chrome — mirrors Duolingo's
// actual top bar (a single row sitting directly on the background), which
// this dashboard previously rendered instead as a 2x2 grid of white cards.
function StatPip({ icon: Icon, color, value, animateFlame }) {
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = withSpring(1, { damping: 12, stiffness: 140 });
  }, []);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.85 + enter.value * 0.15 }],
  }));

  return (
    <Animated.View style={animatedStyle} className="flex-row items-center gap-1.5">
      {animateFlame ? <FlameIcon color={color} size={20} /> : <Icon size={20} color={color} fill={color} />}
      <Text className="text-base font-extrabold text-stone-800 font-display">{value}</Text>
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
  const [reviewStats, setReviewStats] = useState(null);
  const [levels, setLevels] = useState([]);

  // Ask for notification permission + register the device token once the
  // learner has actually reached the home screen (not on every focus —
  // initPushNotifications is itself idempotent, but there's no reason to
  // re-run the effect body on every tab switch).
  useEffect(() => {
    initPushNotifications();
  }, []);

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

  const loadReviewStats = useCallback(async () => {
    try {
      const data = await api.get('/me/review/stats');
      setReviewStats(data);
    } catch {
      setReviewStats(null);
    }
  }, []);

  const loadLevels = useCallback(async () => {
    try {
      const data = await api.get('/me/levels');
      setLevels(Array.isArray(data?.levels) ? data.levels : []);
    } catch {
      setLevels([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      loadReviewStats();
      loadLevels();
      stats.refresh();
    }, [load, loadReviewStats, loadLevels])
  );

  const readyLevel = useMemo(() => levels.find((l) => l.assessment_ready), [levels]);

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
    return groups.map((g) => ({ ...g, allComplete: g.lessons.length > 0 && g.lessons.every((l) => l.status === 'completed') }));
  }, [lessons]);
  const doneCount = lessons.filter((l) => l.status === 'completed').length;
  const isNewUser = !loadingLessons && doneCount === 0 && lessons.length > 0;
  const allComplete = !loadingLessons && lessons.length > 0 && !currentLesson && doneCount === lessons.length;

  // Duolingo opens straight to wherever you left off, not the top of the
  // whole path — jump the FlatList to the chapter containing the current
  // lesson once, right after the first load (not on every pull-to-refresh).
  const listRef = useRef(null);
  const hasAutoScrolledRef = useRef(false);
  const currentChapterIndex = useMemo(
    () => chapters.findIndex((c) => c.lessons.some((l) => l.status === 'current')),
    [chapters]
  );

  useEffect(() => {
    if (loadingLessons || hasAutoScrolledRef.current || currentChapterIndex <= 0) return;
    hasAutoScrolledRef.current = true;
    // Variable chapter heights mean scrollToIndex can't jump precisely on
    // the first try (no exact getItemLayout) — this is RN's standard
    // fallback: estimate an offset, then correct once nearby cells are
    // measured.
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: currentChapterIndex, animated: false, viewPosition: 0 });
    }, 50);
    return () => clearTimeout(timer);
  }, [loadingLessons, currentChapterIndex]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), stats.refresh()]);
    setRefreshing(false);
  };

  const heartLabel = stats.isPremium ? '∞' : stats.heartsCurrent ?? '–';

  // A course can run hundreds of lessons across dozens of chapters — mounting
  // every chapter's LessonPath (one absolutely-positioned node per lesson,
  // plus an SVG curve) all at once was what made the dashboard slow/crash-
  // prone on long courses, not the API payload (that's small, scalar-only).
  // FlatList's own windowing is RN's equivalent of the web fix's
  // IntersectionObserver-based lazy mount: only a handful of chapters near
  // the viewport are ever mounted, with the rest recycled as the user
  // scrolls, instead of every chapter rendering in the initial frame.
  const renderChapter = useCallback(
    ({ item: chapter, index: idx }) => (
      <View>
        <UnitBanner title={chapter.chapterTitle} bannerIndex={idx} />
        <LessonPath
          lessons={chapter.lessons}
          onPressLesson={(l) => navigation.navigate('Lesson', { slug: l.slug, title: l.title })}
        />
        {chapter.allComplete && (
          <Pressable3D
            onPress={() =>
              navigation.navigate('Checkpoint', {
                lessonIds: chapter.lessons.map((l) => l.id),
                chapterTitle: chapter.chapterTitle,
              })
            }
            className="mb-4 flex-row items-center gap-4 rounded-2xl bg-white p-4"
            style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}
          >
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
              <Shield size={24} color="#FF7A1A" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-extrabold text-stone-900">Take the {chapter.chapterTitle} checkpoint</Text>
              <Text className="text-xs font-semibold text-stone-400">Test out and prove your skills</Text>
            </View>
            <ArrowRight size={18} color="#a8a29e" />
          </Pressable3D>
        )}
      </View>
    ),
    [navigation]
  );

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top']}>
    {/* Static header — Duolingo's top stat bar never scrolls away with the
        page content, it's pinned above the path. Lives outside the
        FlatList (was previously inside ListHeaderComponent, which scrolls
        with everything else). */}
    <View className="flex-row items-center justify-between border-b border-stone-200/80 bg-[#f5f4f1] px-5 py-3">
      <StatPip icon={Flame} color="#FF7A1A" value={stats.streak} animateFlame />
      <Pressable3D onPress={() => navigation.navigate('Shop')} hapticOnPress={false} pressDepth={2}>
        <StatPip icon={Gem} color="#1CB0F6" value={stats.gems ?? '–'} />
      </Pressable3D>
      <StatPip icon={Zap} color="#E0A800" value={stats.totalXp} />
      <StatPip icon={Heart} color="#FF4B4B" value={heartLabel} />
    </View>
    <FlatList
      ref={listRef}
      data={chapters}
      keyExtractor={(chapter, idx) => String(chapter.chapterId ?? idx)}
      renderItem={renderChapter}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      initialNumToRender={3}
      maxToRenderPerBatch={2}
      windowSize={5}
      removeClippedSubviews
      // Chapters have variable height (path length + interleaved chests),
      // so there's no exact getItemLayout — this is RN's documented
      // fallback for scrollToIndex on variable-height lists: estimate an
      // offset from the average measured cell, then retry once nearby
      // cells are actually measured.
      onScrollToIndexFailed={(info) => {
        listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
        setTimeout(() => {
          listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0 });
        }, 100);
      }}
      ListHeaderComponent={
        <>
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
              <Text className="mt-1.5 text-2xl font-extrabold text-white font-display">
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
                <Pressable3D onPress={() => navigation.navigate('Placement')} hapticOnPress={false} className="mt-4 self-start">
                  <Text className="text-sm font-bold text-white/90 underline">Not a beginner? Take the placement test</Text>
                </Pressable3D>
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

          {/* Review + Practice — Review only shown once at least one card is
              due (GET /me/review/stats), Practice is always available since
              /me/practice always has something to serve. */}
          <View className="mb-4 flex-row" style={{ gap: 12 }}>
            {reviewStats && reviewStats.total > 0 && (
              <View className="flex-1">
                <Pressable3D onPress={() => navigation.navigate('Review')} className="rounded-2xl bg-white p-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-feather-50">
                    <BookOpen size={20} color="#1CB0F6" />
                  </View>
                  <Text className="mt-2 text-sm font-extrabold text-stone-900">Review</Text>
                  <Text className="text-xs font-semibold text-stone-400">{reviewStats.due_today ?? reviewStats.total} due</Text>
                </Pressable3D>
              </View>
            )}
            <View className="flex-1">
              <Pressable3D onPress={() => navigation.navigate('Practice')} className="rounded-2xl bg-white p-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-grass-50">
                  <Dumbbell size={20} color="#58CC02" />
                </View>
                <Text className="mt-2 text-sm font-extrabold text-stone-900">Practice</Text>
                <Text className="text-xs font-semibold text-stone-400">Sharpen weak spots</Text>
              </Pressable3D>
            </View>
          </View>

          {/* Level-up test — shown once a CEFR level's lessons are all done
              and its assessment hasn't been passed yet (GET /me/levels). */}
          {!!readyLevel && (
            <Pressable3D
              onPress={() => navigation.navigate('Assessment', { level: readyLevel.level })}
              className="mb-4 flex-row items-center gap-4 rounded-2xl bg-white p-4"
              style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}
            >
              <View className="h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
                <Shield size={24} color="#FF7A1A" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-extrabold text-stone-900">{`Take the ${readyLevel.name} (${readyLevel.level}) test`}</Text>
                <Text className="text-xs font-semibold text-stone-400">Pass to unlock the next level</Text>
              </View>
              <ArrowRight size={18} color="#a8a29e" />
            </Pressable3D>
          )}
        </>
      }
    />
    <ChestReveal
      visible={chestOpen}
      onOpened={(wallet) => useStatsStore.getState().applyWallet(wallet)}
      onClose={() => setChestOpen(false)}
    />
    </SafeAreaView>
  );
}
