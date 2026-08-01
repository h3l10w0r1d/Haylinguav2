// src/screens/AchievementsScreen.js — full port of src/Achievements.jsx:
// flat grid of all achievement defs (earned + locked-with-progress), claim
// flow via the shared POST /me/rewards/claim endpoint. OverviewTab.js's
// inline strip only shows earned ones — this is the "See all" destination.
import React, { useCallback, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, ActivityIndicator as Spinner } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Target, Crown, Zap, Flame, Star, Award, Check } from 'lucide-react-native';
import { api } from '../lib/api';
import Pressable3D from '../components/Pressable3D';
import ClaimPulse from '../components/ClaimPulse';
import ScreenFadeIn from '../components/ScreenFadeIn';
import { haptics } from '../lib/haptics';

const ICONS = { target: Target, crown: Crown, zap: Zap, flame: Flame, star: Star };

function AchievementCard({ a, onClaim, claiming, pulseKey }) {
  const Icon = ICONS[a.icon] || Award;
  const pct = a.target > 0 ? Math.max(4, Math.min(100, (a.progress / a.target) * 100)) : 0;
  return (
    <ClaimPulse
      pulseKey={pulseKey}
      style={{
        marginBottom: 12, borderRadius: 16, backgroundColor: '#fff', padding: 16,
        shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
        opacity: a.earned ? 1 : 0.9,
      }}
    >
      <View className="flex-row items-center gap-3">
        <View
          className="h-11 w-11 items-center justify-center rounded-2xl"
          style={{ backgroundColor: a.earned ? `${a.color}22` : '#f5f5f4' }}
        >
          <Icon size={20} color={a.earned ? a.color : '#a8a29e'} />
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-sm font-extrabold text-stone-900" numberOfLines={1}>{a.title}</Text>
            {a.earned && <Check size={13} color="#58CC02" />}
          </View>
          <Text className="text-xs font-semibold text-stone-400" numberOfLines={2}>{a.desc}</Text>
        </View>
      </View>

      {!a.earned && (
        <View className="mt-3">
          <View className="overflow-hidden rounded-full bg-stone-100" style={{ height: 6 }}>
            <View style={{ width: `${pct}%`, height: 6, borderRadius: 3, backgroundColor: a.color }} />
          </View>
          <Text className="mt-1 text-[11px] font-bold text-stone-400">{a.progress}/{a.target}</Text>
        </View>
      )}

      {a.earned && a.claimable && (
        <Pressable3D
          onPress={() => onClaim(a)}
          disabled={claiming}
          pressDepth={2}
          className="mt-3 items-center rounded-xl bg-gold-500 py-2.5"
        >
          {claiming ? <Spinner size="small" color="#fff" /> : <Text className="text-xs font-extrabold text-white">Claim +{a.reward_xp} XP</Text>}
        </Pressable3D>
      )}
      {a.earned && a.claimed && (
        <Text className="mt-3 text-center text-xs font-extrabold text-grass-600">+{a.reward_xp} XP claimed ✓</Text>
      )}
    </ClaimPulse>
  );
}

export default function AchievementsScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);
  const [justClaimedId, setJustClaimedId] = useState(null);
  const [pulseToken, setPulseToken] = useState(0);

  const load = useCallback(async () => {
    const res = await api.get('/me/achievements').catch(() => null);
    setData(res);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function claim(a) {
    setClaimingId(a.id);
    try {
      await api.post('/me/rewards/claim', { kind: 'achievement', id: a.id });
      haptics.success();
      setJustClaimedId(a.id);
      setPulseToken((t) => t + 1);
      await load();
    } catch {
      haptics.error();
    } finally {
      setClaimingId(null);
    }
  }

  const achievements = Array.isArray(data?.achievements) ? data.achievements : [];

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top']}>
      <View className="flex-row items-center gap-2 px-4 pb-2 pt-3">
        <Pressable3D onPress={() => navigation.goBack()} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-white">
          <ArrowLeft size={18} color="#57534e" />
        </Pressable3D>
        <View>
          <Text className="text-xl font-extrabold text-stone-900 font-display">Achievements</Text>
          {!!data && <Text className="text-xs font-semibold text-stone-400">{data.earned} of {data.total} unlocked</Text>}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF7A1A" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8 }}>
          <ScreenFadeIn>
            {achievements.length === 0 ? (
              <View className="items-center py-16">
                <Award size={28} color="#d6d3d1" />
                <Text className="mt-2 text-base font-bold text-stone-400">Start a lesson to earn your first badge!</Text>
              </View>
            ) : (
              achievements.map((a) => (
                <AchievementCard
                  key={a.id}
                  a={a}
                  onClaim={claim}
                  claiming={claimingId === a.id}
                  pulseKey={justClaimedId === a.id ? pulseToken : 0}
                />
              ))
            )}
          </ScreenFadeIn>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
