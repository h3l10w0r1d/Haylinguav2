// src/screens/BonusesScreen.js — port of src/BonusesPage.jsx: Daily Goal
// (client-only preference, mirrors web's localStorage pattern), Daily
// Quests, a Mistakes shortcut (only when count > 0), Streak + week strip,
// and nav tiles to Practice/Progress/Achievements. Quests and Achievements
// share one backend reward system (POST /me/rewards/claim) — see the
// bonuses+quests research this screen is built from.
import React, { useCallback, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, ActivityIndicator as Spinner } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, Target, Crown, Zap, Flame, Star, CheckCircle2, Dumbbell, TrendingUp, Award, AlertCircle, ChevronRight, Snowflake } from 'lucide-react-native';
import { api } from '../lib/api';
import Pressable3D from '../components/Pressable3D';
import ClaimPulse from '../components/ClaimPulse';
import ScreenFadeIn from '../components/ScreenFadeIn';
import { haptics } from '../lib/haptics';

const GOAL_KEY = 'hay_daily_goal';
const GOAL_OPTIONS = [10, 20, 30, 50];
const ICONS = { target: Target, crown: Crown, zap: Zap, flame: Flame, star: Star, check: CheckCircle2 };

function Card({ children }) {
  return (
    <View className="mb-4 rounded-2xl bg-white p-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }}>
      {children}
    </View>
  );
}

export default function BonusesScreen({ navigation }) {
  const [stats, setStats] = useState(null);
  const [quests, setQuests] = useState(null);
  const [streak, setStreak] = useState(null);
  const [week, setWeek] = useState([]);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [goal, setGoal] = useState(20);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);
  const [justClaimedId, setJustClaimedId] = useState(null);
  const [pulseToken, setPulseToken] = useState(0);

  const load = useCallback(async () => {
    const [s, q, st, wk, mc, savedGoal] = await Promise.all([
      api.get('/me/stats').catch(() => null),
      api.get('/me/quests').catch(() => null),
      api.get('/me/streak').catch(() => null),
      api.get('/me/activity/last7days').catch(() => null),
      api.get('/me/mistakes/count').catch(() => null),
      AsyncStorage.getItem(GOAL_KEY),
    ]);
    setStats(s);
    setQuests(q);
    setStreak(st);
    setWeek(Array.isArray(wk?.days) ? wk.days : []);
    setMistakeCount(mc?.count || 0);
    if (savedGoal) setGoal(Number(savedGoal));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function pickGoal(g) {
    setGoal(g);
    await AsyncStorage.setItem(GOAL_KEY, String(g));
  }

  async function claimQuest(q) {
    setClaimingId(q.id);
    try {
      await api.post('/me/rewards/claim', { kind: 'quest', id: q.id });
      haptics.success();
      setJustClaimedId(q.id);
      setPulseToken((t) => t + 1);
      await load();
    } catch {
      haptics.error();
    } finally {
      setClaimingId(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1]">
        <ActivityIndicator size="large" color="#FF7A1A" />
      </SafeAreaView>
    );
  }

  const todayXp = stats?.today_xp ?? 0;
  const goalMet = todayXp >= goal;
  const goalPct = Math.min(100, (todayXp / goal) * 100);
  const questsList = Array.isArray(quests?.quests) ? quests.quests : [];
  const maxWeek = Math.max(1, ...week.map((d) => d.value || 0));

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top']}>
      <View className="flex-row items-center gap-2 px-4 pb-2 pt-3">
        <Pressable3D onPress={() => navigation.goBack()} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-white">
          <ArrowLeft size={18} color="#57534e" />
        </Pressable3D>
        <Text className="text-xl font-extrabold text-stone-900 font-display">Bonuses</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8 }}>
        <ScreenFadeIn>
        {/* Daily Goal */}
        <Card>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-xs font-extrabold uppercase tracking-wide text-stone-400">Daily goal</Text>
            {goalMet && <Text className="text-xs font-extrabold text-grass-600">Goal met! 🎉</Text>}
          </View>
          <Text className="text-lg font-extrabold text-stone-900 font-display">{todayXp} / {goal} XP</Text>
          <View className="mt-2 overflow-hidden rounded-full bg-stone-100" style={{ height: 8 }}>
            <View style={{ width: `${goalPct}%`, height: 8, borderRadius: 4, backgroundColor: goalMet ? '#58CC02' : '#FF7A1A' }} />
          </View>
          <View className="mt-3 flex-row" style={{ gap: 6 }}>
            {GOAL_OPTIONS.map((g) => (
              <Pressable3D
                key={g}
                onPress={() => pickGoal(g)}
                pressDepth={1}
                hapticOnPress={false}
                className={'flex-1 items-center rounded-xl py-1.5 ' + (goal === g ? 'bg-brand-500' : 'bg-stone-100')}
              >
                <Text className={'text-xs font-extrabold ' + (goal === g ? 'text-white' : 'text-stone-500')}>{g}</Text>
              </Pressable3D>
            ))}
          </View>
        </Card>

        {/* Daily Quests */}
        <Card>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-xs font-extrabold uppercase tracking-wide text-stone-400">Daily quests</Text>
            {!!quests && <Text className="text-xs font-bold text-stone-400">{quests.completed}/{quests.total}</Text>}
          </View>
          {questsList.length === 0 ? (
            <Text className="text-sm font-semibold text-stone-400">No quests today.</Text>
          ) : (
            questsList.map((q, i) => {
              const Icon = ICONS[q.icon] || Target;
              const pct = q.target > 0 ? Math.max(4, Math.min(100, (q.progress / q.target) * 100)) : 0;
              return (
                <ClaimPulse
                  key={q.id}
                  pulseKey={justClaimedId === q.id ? pulseToken : 0}
                  style={{ borderRadius: 14 }}
                >
                  <View className={'flex-row items-center gap-3 py-2.5 ' + (i > 0 ? 'border-t border-stone-100' : '')}>
                    <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand-50">
                      <Icon size={16} color="#FF7A1A" />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-bold text-stone-800" numberOfLines={1}>{q.title}</Text>
                      {!q.done ? (
                        <View className="mt-1 overflow-hidden rounded-full bg-stone-100" style={{ height: 5 }}>
                          <View style={{ width: `${pct}%`, height: 5, borderRadius: 2.5, backgroundColor: '#FF7A1A' }} />
                        </View>
                      ) : (
                        <Text className="text-xs font-semibold text-stone-400">{q.progress}/{q.target}</Text>
                      )}
                    </View>
                    {q.claimable ? (
                      <Pressable3D onPress={() => claimQuest(q)} disabled={claimingId === q.id} pressDepth={1} className="rounded-lg bg-gold-500 px-2.5 py-1.5">
                        {claimingId === q.id ? <Spinner size="small" color="#fff" /> : <Text className="text-[11px] font-extrabold text-white">+{q.reward_xp} XP</Text>}
                      </Pressable3D>
                    ) : q.claimed ? (
                      <Text className="text-[11px] font-extrabold text-grass-600">Claimed</Text>
                    ) : null}
                  </View>
                </ClaimPulse>
              );
            })
          )}
        </Card>

        {/* Mistakes shortcut */}
        {mistakeCount > 0 && (
          <Pressable3D
            onPress={() => navigation.navigate('Practice', { source: '/me/mistakes', title: 'Mistakes', emptyHeading: 'No mistakes to review!' })}
            className="mb-4 flex-row items-center gap-3 rounded-2xl bg-white p-4"
            style={{ shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }}
          >
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-cardinal-50">
              <AlertCircle size={18} color="#DC2626" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-extrabold text-stone-900">Review mistakes</Text>
              <Text className="text-xs font-semibold text-stone-400">{mistakeCount} exercise{mistakeCount === 1 ? '' : 's'} to re-master</Text>
            </View>
            <ChevronRight size={16} color="#d6d3d1" />
          </Pressable3D>
        )}

        {/* Streak */}
        <Card>
          <View className="flex-row items-center gap-2">
            <Flame size={16} color="#FF7A1A" />
            <Text className="text-xs font-extrabold uppercase tracking-wide text-stone-400">Streak</Text>
          </View>
          <Text className="mt-1 text-lg font-extrabold text-stone-900 font-display">{streak?.streak ?? 0} days</Text>
          <View className="mt-3 flex-row items-end" style={{ height: 44, gap: 5 }}>
            {week.map((d, i) => (
              <View key={i} className="flex-1 items-center">
                <View style={{ height: Math.max(3, (d.value / maxWeek) * 36), width: '70%', borderRadius: 3, backgroundColor: d.value > 0 ? '#FF7A1A' : '#e7e5e4' }} />
                <Text className="mt-1 text-[9px] font-bold text-stone-400">{d.label}</Text>
              </View>
            ))}
          </View>
          <View className="mt-3 flex-row items-center gap-1.5">
            <Snowflake size={13} color="#1CB0F6" />
            <Text className="text-xs font-semibold text-stone-500">
              {streak?.freezes ?? 0}/{streak?.freeze_cap ?? 2} streak freezes
            </Text>
          </View>
        </Card>

        {/* Nav tiles */}
        <View className="flex-row" style={{ gap: 10 }}>
          <View className="flex-1">
            <Pressable3D onPress={() => navigation.navigate('Practice')} className="items-center rounded-2xl bg-white py-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }}>
              <Dumbbell size={20} color="#58CC02" />
              <Text className="mt-1.5 text-xs font-extrabold text-stone-900">Practice</Text>
            </Pressable3D>
          </View>
          <View className="flex-1">
            <Pressable3D onPress={() => navigation.navigate('Progress')} className="items-center rounded-2xl bg-white py-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }}>
              <TrendingUp size={20} color="#1CB0F6" />
              <Text className="mt-1.5 text-xs font-extrabold text-stone-900">Progress</Text>
            </Pressable3D>
          </View>
          <View className="flex-1">
            <Pressable3D onPress={() => navigation.navigate('Achievements')} className="items-center rounded-2xl bg-white py-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }}>
              <Award size={20} color="#E0A800" />
              <Text className="mt-1.5 text-xs font-extrabold text-stone-900">Achievements</Text>
            </Pressable3D>
          </View>
        </View>
        </ScreenFadeIn>
      </ScrollView>
    </SafeAreaView>
  );
}
