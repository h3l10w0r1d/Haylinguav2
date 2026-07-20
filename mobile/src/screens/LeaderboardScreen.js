// src/screens/LeaderboardScreen.js — full port of src/Leaderboard.jsx:
// tier header + progress bar, a single ranked list (crown/medal icons for
// the top 3 instead of a separate podium widget — matches how the actual
// Duolingo app renders live standings), promotion/demotion zone dividers
// (incl. the "everyone advances" special case), a not-joined CTA, and a
// sticky self-rank pill when the player is ranked below the visible fold.
// Single GET /me/league fetch powers both tabs.
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, RefreshControl, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Trophy, Crown, Award, Users, Zap, Info, ChevronRight, X as XIcon, TrendingDown } from 'lucide-react-native';
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

const RANK_MEDAL = { 1: '#FFC800', 2: '#C0C0C0', 3: '#CD7F32' };

function formatCountdown(seconds) {
  if (seconds == null) return '';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h left`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m left`;
}

function Avatar({ name, avatarUrl, size = 40, isPremium, ringColor }) {
  const resolved = resolveUrl(avatarUrl);
  const shape = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={ringColor ? { borderWidth: 2.5, borderColor: ringColor, borderRadius: size / 2 + 3, padding: 1.5 } : undefined}>
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

// Rank column: top 3 get a colored medal icon (crown for #1) instead of a
// plain number — the single clearest "you're looking at a leaderboard"
// signal Duolingo leans on, and the thing this screen was missing most.
function RankBadge({ rank }) {
  const medal = RANK_MEDAL[rank];
  if (medal) {
    return (
      <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: medal }}>
        {rank === 1 ? <Crown size={15} color="#fff" /> : <Award size={14} color="#fff" />}
      </View>
    );
  }
  return <Text className="w-7 text-center text-sm font-extrabold text-stone-400">{rank}</Text>;
}

function Row({ entry, onPress }) {
  const navigable = !entry.is_self && !!entry.username;
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
      <RankBadge rank={entry.rank} />
      <Avatar name={entry.name} avatarUrl={entry.avatar_url} isPremium={entry.is_premium} ringColor={RANK_MEDAL[entry.rank]} />
      <Text className="flex-1 text-sm font-bold text-stone-800" numberOfLines={1}>
        {entry.name}{entry.is_self ? ' (You)' : ''}
      </Text>
      <View className="flex-row items-center gap-1">
        <Zap size={13} color="#E0A800" fill="#E0A800" />
        <Text className="text-sm font-extrabold text-stone-900">{entry.weekly_xp}</Text>
      </View>
      {navigable && <ChevronRight size={16} color="#d6d3d1" />}
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

function ExplainerModal({ visible, onClose, promoteTop, demoteBottom }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/50 px-8">
        <View className="w-full rounded-3xl bg-white p-6">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-extrabold text-stone-900 font-display">How leagues work</Text>
            <Pressable3D onPress={onClose} pressDepth={2} className="h-8 w-8 items-center justify-center rounded-full bg-stone-100">
              <XIcon size={16} color="#57534e" />
            </Pressable3D>
          </View>
          <View className="mt-4 flex-row items-start gap-3">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-grass-50">
              <Award size={16} color="#58CC02" />
            </View>
            <Text className="flex-1 text-sm font-semibold text-stone-600">
              {promoteTop > 0 ? `Finish in the top ${promoteTop} to be promoted to the next league.` : 'Keep earning XP to climb the rankings.'}
            </Text>
          </View>
          <View className="mt-3 flex-row items-start gap-3">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-cardinal-50">
              <TrendingDown size={16} color="#FF4B4B" />
            </View>
            <Text className="flex-1 text-sm font-semibold text-stone-600">
              {demoteBottom > 0 ? `Finish in the bottom ${demoteBottom} and you'll be demoted next week.` : "You're in the lowest league — no demotion here."}
            </Text>
          </View>
          <View className="mt-3 flex-row items-start gap-3">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-feather-50">
              <Trophy size={16} color="#1899D6" />
            </View>
            <Text className="flex-1 text-sm font-semibold text-stone-600">Standings reset every week and are ranked by XP earned that week.</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function LeaderboardScreen({ navigation }) {
  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('league'); // 'league' | 'friends'
  const [showInfo, setShowInfo] = useState(false);

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

  const decorated = useMemo(() => {
    return rows.map((r, i) => ({
      entry: r,
      showPromoteDivider: tab === 'league' && !everyoneAdvances && i === promoteTop && promoteTop > 0,
      showDemoteDivider: tab === 'league' && !everyoneAdvances && demoteBottom > 0 && i === total - demoteBottom && total - demoteBottom > 0,
    }));
  }, [rows, tab, promoteTop, demoteBottom, total, everyoneAdvances]);

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

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top']}>
      <View className="px-4 pb-2 pt-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: tierColor, shadowColor: tierColor, shadowOpacity: 0.4, shadowRadius: 6, elevation: 2 }}>
              <Trophy size={18} color="#fff" />
            </View>
            <View>
              <Text className="text-xl font-extrabold text-stone-900 font-display">{league?.tier_name ?? 'League'}</Text>
              {league?.seconds_left != null && (
                <Text className="text-xs font-bold text-stone-400">{formatCountdown(league.seconds_left)}</Text>
              )}
            </View>
          </View>
          <Pressable3D onPress={() => setShowInfo(true)} pressDepth={2} className="h-8 w-8 items-center justify-center rounded-full bg-white" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 }}>
            <Info size={16} color="#a8a29e" />
          </Pressable3D>
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
            <Pressable3D onPress={() => setTab('league')} pressDepth={2} className={'flex-row items-center justify-center gap-1.5 rounded-xl py-2 ' + (tab === 'league' ? 'bg-white' : '')}>
              <Trophy size={14} color={tab === 'league' ? '#FF7A1A' : '#a8a29e'} />
              <Text className={'text-sm font-bold ' + (tab === 'league' ? 'text-stone-900' : 'text-stone-500')}>League</Text>
            </Pressable3D>
          </View>
          <View className="flex-1">
            <Pressable3D
              onPress={() => league?.has_friends && setTab('friends')}
              disabled={!league?.has_friends}
              pressDepth={2}
              className={'flex-row items-center justify-center gap-1.5 rounded-xl py-2 ' + (tab === 'friends' ? 'bg-white' : '')}
            >
              <Users size={14} color={tab === 'friends' ? '#FF7A1A' : league?.has_friends ? '#a8a29e' : '#d6d3d1'} />
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
            <Text className="mt-3 text-center text-base font-extrabold text-stone-900 font-display">Join this week's league</Text>
            <Text className="mt-1 text-center text-sm font-semibold text-stone-500">Complete a lesson to get started.</Text>
            <Pressable3D onPress={() => navigation.navigate('Learn')} className="mt-4 items-center rounded-2xl bg-brand-500 px-6 py-3">
              <Text className="text-sm font-extrabold text-white">Go to lessons</Text>
            </Pressable3D>
          </View>
        ) : rows.length === 0 ? (
          <View className="items-center py-16">
            <Users size={28} color="#d6d3d1" />
            <Text className="mt-2 text-base font-bold text-stone-400">
              {tab === 'friends' ? "You don't have any friends ranked yet." : 'No one in your division yet.'}
            </Text>
          </View>
        ) : (
          <>
            {everyoneAdvances && (
              <View className="mb-3 flex-row items-center justify-center gap-2 rounded-2xl bg-grass-50 py-3">
                <Award size={16} color="#58CC02" />
                <Text className="text-sm font-extrabold text-grass-600">Everyone here advances this week!</Text>
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
            <View className="flex-row items-center gap-1">
              <Zap size={13} color="#FFC800" fill="#FFC800" />
              <Text className="text-sm font-extrabold text-white">{selfEntry.weekly_xp}</Text>
            </View>
          </View>
        </View>
      )}

      <ExplainerModal visible={showInfo} onClose={() => setShowInfo(false)} promoteTop={promoteTop} demoteBottom={demoteBottom} />
    </SafeAreaView>
  );
}
