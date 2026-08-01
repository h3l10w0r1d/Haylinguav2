// src/screens/ProgressScreen.js — port of src/ProgressPage.jsx: streak
// splits, word-mastery bar, and a daily XP bar chart with a 7/30/60 toggle.
// Web has no charting lib either (hand-rolled divs) — same approach here.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Zap, BookOpen, Sparkles, Flame } from 'lucide-react-native';
import { api } from '../lib/api';
import Pressable3D from '../components/Pressable3D';
import ScreenFadeIn from '../components/ScreenFadeIn';

const RANGES = [7, 30, 60];
const CHART_HEIGHT = 120;

function StatCard({ icon: Icon, color, bg, label, value }) {
  return (
    <View className="flex-1 rounded-2xl bg-white p-3.5" style={{ shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }}>
      <View className={`h-9 w-9 items-center justify-center rounded-xl ${bg}`}>
        <Icon size={17} color={color} />
      </View>
      <Text className="mt-2 text-lg font-extrabold text-stone-900 font-display">{value}</Text>
      <Text className="text-[11px] font-bold text-stone-400">{label}</Text>
    </View>
  );
}

export default function ProgressScreen({ navigation }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d) => {
    const res = await api.get(`/me/stats/progress?days=${d}`).catch(() => null);
    setData(res);
    setLoading(false);
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  const srTotal = data?.sr_total || 0;
  const masteredPct = srTotal ? (data.sr_mastered / srTotal) * 100 : 0;
  const learningPct = srTotal ? (data.sr_learning / srTotal) * 100 : 0;
  const newPct = srTotal ? (data.sr_new / srTotal) * 100 : 0;

  const xpByDay = Array.isArray(data?.xp_by_day) ? data.xp_by_day : [];
  const maxXp = Math.max(1, ...xpByDay.map((d) => d.xp || 0));

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top']}>
      <View className="flex-row items-center gap-2 px-4 pb-2 pt-3">
        <Pressable3D onPress={() => navigation.goBack()} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-white">
          <ArrowLeft size={18} color="#57534e" />
        </Pressable3D>
        <Text className="text-xl font-extrabold text-stone-900 font-display">Progress</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF7A1A" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8 }}>
          <ScreenFadeIn>
          <View className="mb-4 flex-row" style={{ gap: 10 }}>
            <StatCard icon={Zap} color="#E0A800" bg="bg-gold-50" label="Total XP" value={data?.total_xp ?? 0} />
            <StatCard icon={BookOpen} color="#58CC02" bg="bg-grass-50" label="Lessons done" value={data?.total_lessons ?? 0} />
          </View>
          <View className="mb-5 flex-row" style={{ gap: 10 }}>
            <StatCard icon={Sparkles} color="#1CB0F6" bg="bg-feather-50" label="Words mastered" value={data?.sr_mastered ?? 0} />
            <StatCard icon={Flame} color="#FF7A1A" bg="bg-brand-50" label="Best streak" value={data?.best_streak ?? 0} />
          </View>

          {/* Streaks block */}
          <View className="mb-5 rounded-2xl bg-white p-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }}>
            <Text className="mb-3 text-xs font-extrabold uppercase tracking-wide text-stone-400">Streaks</Text>
            <View className="flex-row">
              <View className="flex-1 items-center">
                <Text className="text-xl font-extrabold text-stone-900 font-display">{data?.lesson_streak ?? 0}</Text>
                <Text className="text-[11px] font-bold text-stone-400">Lesson streak</Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-xl font-extrabold text-stone-900 font-display">{data?.review_streak ?? 0}</Text>
                <Text className="text-[11px] font-bold text-stone-400">Review streak</Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-xl font-extrabold text-stone-900 font-display">{data?.best_streak ?? 0}</Text>
                <Text className="text-[11px] font-bold text-stone-400">Best ever</Text>
              </View>
            </View>
          </View>

          {/* Word mastery bar */}
          <View className="mb-5 rounded-2xl bg-white p-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }}>
            <Text className="mb-3 text-xs font-extrabold uppercase tracking-wide text-stone-400">Word mastery</Text>
            {srTotal === 0 ? (
              <Text className="text-sm font-semibold text-stone-400">No words tracked yet — keep learning!</Text>
            ) : (
              <>
                <View className="flex-row overflow-hidden rounded-full" style={{ height: 10 }}>
                  <View style={{ width: `${masteredPct}%`, backgroundColor: '#58CC02' }} />
                  <View style={{ width: `${learningPct}%`, backgroundColor: '#FFC800' }} />
                  <View style={{ width: `${newPct}%`, backgroundColor: '#e7e5e4' }} />
                </View>
                <View className="mt-3 flex-row" style={{ gap: 14 }}>
                  <View className="flex-row items-center gap-1.5">
                    <View className="rounded-full bg-grass-500" style={{ width: 8, height: 8 }} />
                    <Text className="text-xs font-bold text-stone-500">Mastered {data.sr_mastered}</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <View className="rounded-full bg-gold-400" style={{ width: 8, height: 8 }} />
                    <Text className="text-xs font-bold text-stone-500">Learning {data.sr_learning}</Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <View className="rounded-full bg-stone-300" style={{ width: 8, height: 8 }} />
                    <Text className="text-xs font-bold text-stone-500">New {data.sr_new}</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* XP history bar chart */}
          <View className="rounded-2xl bg-white p-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-xs font-extrabold uppercase tracking-wide text-stone-400">XP history</Text>
              <View className="flex-row rounded-xl bg-stone-100 p-0.5">
                {RANGES.map((r) => (
                  <Pressable3D
                    key={r}
                    onPress={() => setDays(r)}
                    pressDepth={1}
                    hapticOnPress={false}
                    className={'rounded-lg px-2.5 py-1 ' + (days === r ? 'bg-white' : '')}
                  >
                    <Text className={'text-[11px] font-extrabold ' + (days === r ? 'text-stone-900' : 'text-stone-400')}>{r}d</Text>
                  </Pressable3D>
                ))}
              </View>
            </View>
            {xpByDay.length === 0 ? (
              <Text className="text-sm font-semibold text-stone-400">No activity in this range yet.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row items-end" style={{ height: CHART_HEIGHT, gap: 4 }}>
                  {xpByDay.map((d, i) => {
                    const h = Math.max(3, (d.xp / maxXp) * CHART_HEIGHT);
                    return (
                      <View key={d.date || i} className="items-center" style={{ width: days > 30 ? 6 : 14 }}>
                        <View style={{ height: h, width: '100%', borderRadius: 3, backgroundColor: d.xp > 0 ? '#FF7A1A' : '#e7e5e4' }} />
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>
          </ScreenFadeIn>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
