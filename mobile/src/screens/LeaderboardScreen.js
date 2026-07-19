// src/screens/LeaderboardScreen.js — ports src/Leaderboard.jsx. Single
// GET /me/league fetch powers both tabs (division ranking + friends ranking
// come back in the same response, along with promote_top/demote_bottom for
// the zone bands and seconds_left for the countdown) — genuinely a weekly
// league/cohort system, not a flat all-time list.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Trophy } from 'lucide-react-native';
import { api } from '../lib/api';
import Pressable3D from '../components/Pressable3D';

function formatCountdown(seconds) {
  if (seconds == null) return '';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h left`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m left`;
}

function Row({ entry, onPress }) {
  return (
    <Pressable3D
      onPress={onPress}
      disabled={entry.is_self}
      pressDepth={2}
      className={
        'mb-2 flex-row items-center gap-3 rounded-2xl px-4 py-3 ' +
        (entry.is_self ? 'border-2 border-brand-500 bg-brand-50' : 'bg-white')
      }
      style={!entry.is_self ? { shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 } : undefined}
    >
      <Text className="w-7 text-center text-sm font-extrabold text-stone-400">{entry.rank}</Text>
      <View className="h-9 w-9 items-center justify-center rounded-full bg-stone-100">
        <Text className="text-sm font-extrabold text-stone-500">{(entry.name || entry.username || '?')[0]?.toUpperCase()}</Text>
      </View>
      <Text className="flex-1 text-sm font-bold text-stone-800" numberOfLines={1}>
        {entry.name || entry.username}
      </Text>
      <Text className="text-sm font-extrabold text-stone-900">{entry.weekly_xp} XP</Text>
    </Pressable3D>
  );
}

function ZoneDivider({ label, color }) {
  return (
    <View className="my-2 flex-row items-center gap-2">
      <View className="h-px flex-1" style={{ backgroundColor: color }} />
      <Text className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color }}>
        {label}
      </Text>
      <View className="h-px flex-1" style={{ backgroundColor: color }} />
    </View>
  );
}

export default function LeaderboardScreen({ navigation }) {
  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('league'); // 'league' | 'friends'

  const load = useCallback(async () => {
    try {
      const data = await api.get('/me/league');
      setLeague(data);
    } catch {
      // keep whatever we had; the screen already shows an empty/loading state
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const rows = tab === 'league' ? league?.division ?? [] : league?.friends ?? [];
  const promoteTop = league?.promote_top ?? 0;
  const demoteBottom = league?.demote_bottom ?? 0;
  const total = rows.length;

  const decorated = useMemo(() => {
    return rows.map((r, i) => ({
      entry: r,
      showPromoteDivider: tab === 'league' && i === promoteTop && promoteTop > 0,
      showDemoteDivider: tab === 'league' && demoteBottom > 0 && i === total - demoteBottom && total - demoteBottom > 0,
    }));
  }, [rows, tab, promoteTop, demoteBottom, total]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1]">
        <ActivityIndicator size="large" color="#FF7A1A" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top']}>
      <View className="px-4 pb-2 pt-3">
        <View className="flex-row items-center gap-2">
          <Trophy size={22} color="#FF7A1A" />
          <Text className="text-xl font-extrabold text-stone-900">{league?.tier_name ?? 'League'}</Text>
        </View>
        {league?.seconds_left != null && (
          <Text className="mt-1 text-xs font-bold text-stone-400">{formatCountdown(league.seconds_left)}</Text>
        )}

        {/* Pressable3D's press animation lives on an outer wrapper View, so
            the flex-1 that splits this row evenly has to go on a plain View
            around it — className on Pressable3D itself only sizes its own
            inner Pressable, not the animated wrapper. */}
        <View className="mt-3 flex-row rounded-2xl bg-stone-200 p-1">
          <View className="flex-1">
            <Pressable3D onPress={() => setTab('league')} pressDepth={2} className={'items-center rounded-xl py-2 ' + (tab === 'league' ? 'bg-white' : '')}>
              <Text className={'text-sm font-bold ' + (tab === 'league' ? 'text-stone-900' : 'text-stone-500')}>League</Text>
            </Pressable3D>
          </View>
          <View className="flex-1">
            <Pressable3D onPress={() => setTab('friends')} pressDepth={2} className={'items-center rounded-xl py-2 ' + (tab === 'friends' ? 'bg-white' : '')}>
              <Text className={'text-sm font-bold ' + (tab === 'friends' ? 'text-stone-900' : 'text-stone-500')}>Friends</Text>
            </Pressable3D>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {rows.length === 0 ? (
          <View className="items-center py-16">
            <Text className="text-base font-bold text-stone-400">
              {tab === 'friends' ? "You don't have any friends ranked yet." : 'No one in your division yet.'}
            </Text>
          </View>
        ) : (
          decorated.map(({ entry, showPromoteDivider, showDemoteDivider }) => (
            <React.Fragment key={entry.user_id}>
              <Row entry={entry} onPress={() => entry.username && navigation.navigate('PublicProfile', { username: entry.username })} />
              {showPromoteDivider && <ZoneDivider label="Promotion zone" color="#58CC02" />}
              {showDemoteDivider && <ZoneDivider label="Demotion zone" color="#FF4B4B" />}
            </React.Fragment>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
