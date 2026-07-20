// src/screens/LeaderboardScreen.js — full port of src/Leaderboard.jsx:
// tier header + progress bar, podium for the top 3, promotion/demotion
// zone dividers (incl. the "everyone advances" special case), a not-joined
// CTA, and a sticky self-rank pill when the player is ranked below the
// visible fold. Single GET /me/league fetch powers both tabs.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Trophy, Crown } from 'lucide-react-native';
import { api, resolveUrl } from '../lib/api';
import Pressable3D from '../components/Pressable3D';

const TIER_COLORS = [
  '#B07A45', // Bronze
  '#9FB6CC', // Silver
  '#FFC800', // Gold
  '#1CB0F6', // Sapphire
  '#FF4B4B', // Ruby
  '#58CC02', // Emerald
  '#C36BFF', // Amethyst
  '#F0E6D2', // Pearl
  '#44403c', // Obsidian
  '#7DD3FC', // Diamond
];

function formatCountdown(seconds) {
  if (seconds == null) return '';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h left`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m left`;
}

function Avatar({ name, avatarUrl, size = 36, isPremium }) {
  const resolved = resolveUrl(avatarUrl);
  const shape = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View>
      {resolved ? (
        <View style={[shape, { overflow: 'hidden', backgroundColor: '#f5f5f4' }]}>
          <Image source={{ uri: resolved }} style={shape} />
        </View>
      ) : (
        <View style={shape} className="items-center justify-center bg-stone-100">
          <Text className="font-extrabold text-stone-500" style={{ fontSize: size * 0.4 }}>{(name || '?')[0]?.toUpperCase()}</Text>
        </View>
      )}
      {isPremium && (
        <View className="absolute -right-1 -top-1 h-4 w-4 items-center justify-center rounded-full bg-gold-500">
          <Crown size={10} color="#fff" />
        </View>
      )}
    </View>
  );
}

function Podium({ entries, onPress }) {
  const [second, first, third] = [entries[1], entries[0], entries[2]];
  const slots = [
    { entry: second, height: 64, medal: '#C0C0C0', size: 52 },
    { entry: first, height: 88, medal: '#FFC800', size: 64 },
    { entry: third, height: 48, medal: '#CD7F32', size: 48 },
  ];
  return (
    <View className="mb-4 flex-row items-end justify-center" style={{ gap: 10 }}>
      {slots.map((slot, i) =>
        slot.entry ? (
          <Pressable3D key={slot.entry.user_id} onPress={() => onPress(slot.entry)} pressDepth={2} className="items-center" style={{ width: 96 }}>
            <Avatar name={slot.entry.name} avatarUrl={slot.entry.avatar_url} size={slot.size} isPremium={slot.entry.is_premium} />
            <Text className="mt-1.5 text-xs font-extrabold text-stone-800" numberOfLines={1}>{slot.entry.name}</Text>
            <Text className="text-[11px] font-bold text-stone-400">{slot.entry.weekly_xp} XP</Text>
            <View className="mt-2 w-full items-center justify-end rounded-t-xl" style={{ height: slot.height, backgroundColor: slot.medal }}>
              <Text className="mb-1.5 text-base font-extrabold text-white">{i === 1 ? '1' : i === 0 ? '2' : '3'}</Text>
            </View>
          </Pressable3D>
        ) : (
          <View key={i} style={{ width: 96 }} />
        )
      )}
    </View>
  );
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
      <Avatar name={entry.name} avatarUrl={entry.avatar_url} isPremium={entry.is_premium} />
      <Text className="flex-1 text-sm font-bold text-stone-800" numberOfLines={1}>
        {entry.name}{entry.is_self ? ' (You)' : ''}
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
  const notJoined = tab === 'league' && league && !league.joined;
  const everyoneAdvances = tab === 'league' && promoteTop > 0 && total > 0 && total <= promoteTop;

  const topThree = rows.slice(0, 3);
  const rest = rows.length >= 2 ? rows.slice(3) : rows;
  const showPodium = topThree.length >= 2;

  const decorated = useMemo(() => {
    return rest.map((r, i) => {
      const idx = showPodium ? i + 3 : i;
      return {
        entry: r,
        showPromoteDivider: tab === 'league' && !everyoneAdvances && idx === promoteTop && promoteTop > 0,
        showDemoteDivider: tab === 'league' && !everyoneAdvances && demoteBottom > 0 && idx === total - demoteBottom && total - demoteBottom > 0,
      };
    });
  }, [rest, tab, promoteTop, demoteBottom, total, everyoneAdvances, showPodium]);

  const selfEntry = rows.find((r) => r.is_self);
  const showStickyRank = selfEntry && selfEntry.rank > 10;

  function goToProfile(entry) {
    if (entry.is_self) navigation.navigate('Profile');
    else if (entry.username) navigation.navigate('PublicProfile', { username: entry.username });
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1]">
        <ActivityIndicator size="large" color="#FF7A1A" />
      </SafeAreaView>
    );
  }

  const tierColor = TIER_COLORS[league?.tier ?? 0];
  const maxTier = league?.max_tier ?? TIER_COLORS.length - 1;

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top']}>
      <View className="px-4 pb-2 pt-3">
        <View className="flex-row items-center gap-2">
          <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: tierColor }}>
            <Trophy size={16} color="#fff" />
          </View>
          <View>
            <Text className="text-xl font-extrabold text-stone-900 font-display">{league?.tier_name ?? 'League'}</Text>
            {league?.seconds_left != null && (
              <Text className="text-xs font-bold text-stone-400">{formatCountdown(league.seconds_left)}</Text>
            )}
          </View>
        </View>

        {/* Tier progress: one lit segment per tier passed. */}
        <View className="mt-3 flex-row" style={{ gap: 3 }}>
          {TIER_COLORS.map((color, i) => (
            <View
              key={i}
              className="h-1.5 rounded-full"
              style={{ flex: i === (league?.tier ?? 0) ? 2 : 1, backgroundColor: i <= (league?.tier ?? 0) ? color : '#e7e5e4' }}
            />
          ))}
        </View>

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
            <Pressable3D
              onPress={() => league?.has_friends && setTab('friends')}
              disabled={!league?.has_friends}
              pressDepth={2}
              className={'items-center rounded-xl py-2 ' + (tab === 'friends' ? 'bg-white' : '')}
            >
              <Text className={'text-sm font-bold ' + (tab === 'friends' ? 'text-stone-900' : league?.has_friends ? 'text-stone-500' : 'text-stone-300')}>
                Friends
              </Text>
            </Pressable3D>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: showStickyRank ? 80 : 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {notJoined ? (
          <View className="items-center rounded-2xl bg-white p-6" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
            <Trophy size={28} color="#FF7A1A" />
            <Text className="mt-3 text-center text-base font-extrabold text-stone-900">Join this week's league</Text>
            <Text className="mt-1 text-center text-sm font-semibold text-stone-500">Complete a lesson to get started.</Text>
            <Pressable3D onPress={() => navigation.navigate('Learn')} className="mt-4 items-center rounded-2xl bg-brand-500 px-6 py-3">
              <Text className="text-sm font-extrabold text-white">Go to lessons</Text>
            </Pressable3D>
          </View>
        ) : rows.length === 0 ? (
          <View className="items-center py-16">
            <Text className="text-base font-bold text-stone-400">
              {tab === 'friends' ? "You don't have any friends ranked yet." : 'No one in your division yet.'}
            </Text>
          </View>
        ) : (
          <>
            {showPodium && <Podium entries={topThree} onPress={goToProfile} />}
            {everyoneAdvances && (
              <View className="mb-3 items-center rounded-2xl bg-grass-50 py-3">
                <Text className="text-sm font-extrabold text-grass-600">Everyone here advances this week! 🎉</Text>
              </View>
            )}
            {decorated.map(({ entry, showPromoteDivider, showDemoteDivider }) => (
              <React.Fragment key={entry.user_id}>
                <Row entry={entry} onPress={() => goToProfile(entry)} />
                {showPromoteDivider && <ZoneDivider label="Promotion zone" color="#58CC02" />}
                {showDemoteDivider && <ZoneDivider label="Demotion zone" color="#FF4B4B" />}
              </React.Fragment>
            ))}
          </>
        )}
      </ScrollView>

      {showStickyRank && (
        <View className="absolute bottom-4 left-4 right-4">
          <View className="flex-row items-center gap-3 rounded-2xl bg-stone-900 px-4 py-3" style={{ shadowColor: '#1c1917', shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 }}>
            <Text className="w-7 text-center text-sm font-extrabold text-white">{selfEntry.rank}</Text>
            <Avatar name={selfEntry.name} avatarUrl={selfEntry.avatar_url} size={32} isPremium={selfEntry.is_premium} />
            <Text className="flex-1 text-sm font-bold text-white" numberOfLines={1}>You</Text>
            <Text className="text-sm font-extrabold text-white">{selfEntry.weekly_xp} XP</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
