// src/screens/DashboardScreen.js — ports the web Dashboard's KPI strip +
// gradient "continue lesson" hero (src/Dashboard.jsx) to RN. Same visual
// language (apricot->pomegranate gradient, tinted stat chips), wired to the
// real backend: GET /me/lessons/progress + the shared statsStore.
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { Heart, Flame, Zap, Gem, Play, ArrowRight } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../lib/api';
import { useStatsStore } from '../lib/statsStore';

const ACCENT = {
  cardinal: { tint: '#FFECEC', icon: '#FF4B4B' },
  brand: { tint: '#FFF5EC', icon: '#FF7A1A' },
  gold: { tint: '#FFF8E1', icon: '#E0A800' },
  feather: { tint: '#E7F7FF', icon: '#1CB0F6' },
};

function KpiTile({ icon: Icon, accent, label, value }) {
  return (
    <View className="w-[47%] flex-row items-center gap-2.5 rounded-2xl bg-white px-3.5 py-3" style={{ shadowColor: '#1c1917', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}>
      <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: accent.tint }}>
        <Icon size={18} color={accent.icon} />
      </View>
      <View>
        <Text className="text-xl font-extrabold text-stone-900">{value}</Text>
        <Text className="text-[11px] font-semibold text-stone-400">{label}</Text>
      </View>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const stats = useStatsStore();
  const [lessons, setLessons] = useState([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
        <KpiTile icon={Heart} accent={ACCENT.cardinal} label="Hearts" value={heartLabel} />
        <KpiTile icon={Flame} accent={ACCENT.brand} label="Streak" value={stats.streak} />
        <KpiTile icon={Zap} accent={ACCENT.gold} label="XP" value={stats.totalXp} />
        <KpiTile icon={Gem} accent={ACCENT.feather} label="Gems" value={stats.gems ?? '–'} />
      </View>

      {/* Hero */}
      <LinearGradient
        colors={allComplete ? ['#7CE246', '#58CC02', '#1CB0F6'] : ['#FF9342', '#FF7A1A', '#E11D48']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 24, padding: 24, marginBottom: 16, overflow: 'hidden' }}
      >
        <Text className="text-sm font-bold text-white/85">Բարև 👋</Text>
        <Text className="mt-1.5 text-2xl font-extrabold text-white">
          {loadingLessons ? 'Loading your journey…' : currentLesson ? "Ready for today's lesson?" : "You've reached the summit!"}
        </Text>

        {loadingLessons ? (
          <View className="mt-6 h-[72px] items-center justify-center rounded-2xl bg-white/20">
            <ActivityIndicator color="#fff" />
          </View>
        ) : currentLesson ? (
          <TouchableOpacity
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
          </TouchableOpacity>
        ) : (
          <View className="mt-6 rounded-2xl bg-white/15 px-5 py-4">
            <Text className="text-sm font-bold text-white">No lessons available yet.</Text>
          </View>
        )}

        {isNewUser && (
          <Text className="mt-4 text-sm font-bold text-white/90">Not a beginner? Take the placement test (coming soon)</Text>
        )}
      </LinearGradient>

      {/* Curriculum outline (read-only in Phase 0 — tapping the current lesson above is the way in) */}
      {lessons.length > 0 && (
        <View className="rounded-2xl bg-white p-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
          <Text className="mb-2 text-xs font-extrabold uppercase tracking-wide text-stone-400">Your lessons</Text>
          {lessons.map((l) => (
            <View key={l.id} className="flex-row items-center justify-between border-b border-stone-100 py-2.5 last:border-b-0">
              <Text className={'flex-1 text-sm font-semibold ' + (l.status === 'locked' ? 'text-stone-300' : 'text-stone-700')} numberOfLines={1}>
                {l.title}
              </Text>
              <Text className="text-xs font-bold text-stone-400">{l.status}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}
