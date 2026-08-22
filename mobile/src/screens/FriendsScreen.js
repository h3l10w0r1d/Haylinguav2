// src/screens/FriendsScreen.js — full port of src/Friends.jsx's 4 tabs:
// Friends, Requests (incoming + sent), Discover (suggestions), Activity.
//
// Two deliberate departures from the web app, not oversights:
//  - "Remove friend" is wired here (POST /friends/remove/{id}) even though
//    the web's own button for it is dead code — the backend endpoint works,
//    and "same functionality as the browser" should mean "actually works."
//  - "Cancel sent request" has no real backend endpoint on either platform.
//    Mobile fakes it the same way web does: locally hiding the request from
//    view (AsyncStorage-backed dismissed-id set) rather than a real cancel.
import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, ScrollView, FlatList, RefreshControl, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import { UserPlus, Check, X as XIcon, Users as UsersIcon, Trophy, Star, Flame, Crown } from 'lucide-react-native';
import { api, ApiError, resolveUrl } from '../lib/api';
import { getFriendshipState } from '../lib/friendState';
import Pressable3D from '../components/Pressable3D';
import { haptics } from '../lib/haptics';

const DISMISSED_SENT_KEY = 'hay_friends_dismissed_sent_v1';

// "3h ago" / "2d ago" / "Just now" — reads better in a scanned list than a
// bare locale date string, and matches the terse register the rest of the
// app's timestamps use (streak counters, activity feeds).
function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Small gold badge overlay for premium accounts, mirroring web's CrownBadge —
// a friend/suggestion who's paid for the app deserves to look like it.
function CrownBadge() {
  return (
    <View
      className="absolute items-center justify-center rounded-full bg-gold-400"
      style={{ bottom: -3, right: -3, width: 18, height: 18, borderWidth: 2, borderColor: '#fff' }}
    >
      <Crown size={9} color="#fff" fill="#fff" />
    </View>
  );
}

// Squircle + gradient-fallback avatar, matching the web PersonCard's look
// (rounded-2xl, brand->pom gradient behind the initial) instead of a flat
// gray circle — the same fallback everyone without a photo shares looks
// considered rather than like a missing-image placeholder.
function Avatar({ name, avatarUrl, size = 40, isPremium = false }) {
  const resolved = resolveUrl(avatarUrl);
  const shape = { width: size, height: size, borderRadius: size * 0.32 };
  return (
    <View style={{ width: size, height: size }}>
      {resolved ? (
        <View style={[shape, { overflow: 'hidden', backgroundColor: '#f5f5f4' }, isPremium && { borderWidth: 2, borderColor: '#E0A800' }]}>
          <Image source={{ uri: resolved }} style={shape} />
        </View>
      ) : (
        <LinearGradient
          colors={['#FF9342', '#E11D48']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[shape, { alignItems: 'center', justifyContent: 'center' }, isPremium && { borderWidth: 2, borderColor: '#E0A800' }]}
        >
          <Text className="font-extrabold text-white" style={{ fontSize: size * 0.4 }}>{(name || '?')[0]?.toUpperCase()}</Text>
        </LinearGradient>
      )}
      {isPremium && <CrownBadge />}
    </View>
  );
}

function Row({ children, onPress, style }) {
  return (
    <Pressable3D
      onPress={onPress}
      disabled={!onPress}
      pressDepth={2}
      className="mb-2.5 flex-row items-center gap-3 rounded-2xl bg-white px-4 py-3"
      style={{ borderWidth: 1, borderColor: '#f0efec', shadowColor: '#1c1917', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1, ...style }}
    >
      {children}
    </Pressable3D>
  );
}

// Stat chips (level/XP/streak), matching web's PersonCard — gives a
// suggestion real substance instead of just a name and a guess-why reason.
function StatChips({ level, xp, streak }) {
  return (
    <View className="mt-2 flex-row flex-wrap" style={{ gap: 6 }}>
      <View className="flex-row items-center gap-1 rounded-lg bg-brand-50 px-2 py-1">
        <Trophy size={11} color="#FF7A1A" />
        <Text className="text-[10px] font-bold text-stone-600">Lv {Math.max(1, Number(level) || 1)}</Text>
      </View>
      <View className="flex-row items-center gap-1 rounded-lg bg-gold-50 px-2 py-1">
        <Star size={11} color="#E0A800" />
        <Text className="text-[10px] font-bold text-stone-600">{Number(xp) || 0} XP</Text>
      </View>
      <View className="flex-row items-center gap-1 rounded-lg bg-cardinal-50 px-2 py-1">
        <Flame size={11} color="#FF4B4B" />
        <Text className="text-[10px] font-bold text-stone-600">{Math.max(1, Number(streak) || 1)}d streak</Text>
      </View>
    </View>
  );
}

function ReasonChips({ reasons }) {
  if (!reasons?.length) return null;
  return (
    <View className="mt-1.5 flex-row flex-wrap" style={{ gap: 4 }}>
      {reasons.slice(0, 2).map((r, i) => (
        <View key={i} className="rounded-lg bg-stone-100 px-2 py-1">
          <Text className="text-[10px] font-bold text-stone-500">{r}</Text>
        </View>
      ))}
    </View>
  );
}

const TABS = [
  { key: 'friends', label: 'Friends' },
  { key: 'requests', label: 'Requests' },
  { key: 'discover', label: 'Discover' },
  { key: 'activity', label: 'Activity' },
];

export default function FriendsScreen({ navigation }) {
  const [tab, setTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [sent, setSent] = useState([]);
  const [dismissedSent, setDismissedSent] = useState([]);
  const [discover, setDiscover] = useState(null); // null = not loaded yet
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  const loadCore = useCallback(async () => {
    const [f, inc, snt, dismissed] = await Promise.all([
      api.get('/friends').catch(() => []),
      api.get('/friends/requests').catch(() => []),
      api.get('/friends/requests/sent').catch(() => []),
      AsyncStorage.getItem(DISMISSED_SENT_KEY).then((v) => (v ? JSON.parse(v) : [])).catch(() => []),
    ]);
    setFriends(Array.isArray(f) ? f : []);
    setIncoming(Array.isArray(inc) ? inc : []);
    setSent(Array.isArray(snt) ? snt : []);
    setDismissedSent(dismissed);
    setLoading(false);
  }, []);

  const loadDiscover = useCallback(async () => {
    const list = await api.get('/friends/suggestions?limit=50').catch(() => []);
    setDiscover(Array.isArray(list) ? list : []);
  }, []);

  const loadActivity = useCallback(async () => {
    const list = await api.get('/friends/activity?days=7').catch(() => []);
    setActivity(Array.isArray(list) ? list : []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCore();
    }, [loadCore])
  );

  React.useEffect(() => {
    if (tab === 'discover' && discover === null) loadDiscover();
    if (tab === 'activity' && activity === null) loadActivity();
  }, [tab, discover, activity, loadDiscover, loadActivity]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadCore(),
      tab === 'discover' ? loadDiscover() : null,
      tab === 'activity' ? loadActivity() : null,
    ]);
    setRefreshing(false);
  };

  const visibleSent = sent.filter((r) => !dismissedSent.includes(r.id));

  async function dismissSent(id) {
    const next = [...dismissedSent, id];
    setDismissedSent(next);
    await AsyncStorage.setItem(DISMISSED_SENT_KEY, JSON.stringify(next)).catch(() => {});
  }

  async function sendRequest(target, userId) {
    const q = (target ?? query).trim();
    if ((!q && !userId) || sending) return;
    setSending(true);
    setMessage('');
    try {
      const res = await api.post('/friends/request', userId ? { user_id: userId } : { query: q });
      if (res.status === 'already_friends') setMessage("You're already friends.");
      else if (res.status === 'request_exists') setMessage('A request already exists.');
      else setMessage('Friend request sent!');
      haptics.success();
      setQuery('');
      loadCore();
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : 'Could not send that request.');
      haptics.error();
    } finally {
      setSending(false);
    }
  }

  async function accept(id) {
    try {
      await api.post(`/friends/requests/${id}/accept`);
      haptics.success();
      loadCore();
    } catch {
      haptics.error();
    }
  }

  async function reject(id) {
    try {
      await api.post(`/friends/requests/${id}/reject`);
      loadCore();
    } catch {
      // non-fatal
    }
  }

  function confirmRemove(friend) {
    Alert.alert(
      'Remove friend?',
      `${friend.name || friend.username} will be removed from your friends list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/friends/remove/${friend.user_id}`);
              haptics.impact();
              loadCore();
            } catch {
              haptics.error();
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1]">
        <ActivityIndicator size="large" color="#FF7A1A" />
      </SafeAreaView>
    );
  }

  const requestsBadge = incoming.length + visibleSent.length;

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top']}>
      <View className="px-4 pb-2 pt-3">
        <Text className="text-xl font-extrabold text-stone-900 font-display">Friends</Text>

        {/* Pressable3D's press animation lives on an outer wrapper View, so
            the flex-1 that splits this row evenly has to go on a plain View
            around it — className on Pressable3D itself only sizes its own
            inner Pressable, not the animated wrapper. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
          <View className="flex-row rounded-2xl bg-stone-200 p-1" style={{ gap: 2 }}>
            {TABS.map((t) => (
              <Pressable3D
                key={t.key}
                onPress={() => setTab(t.key)}
                pressDepth={2}
                className={'items-center rounded-xl px-4 py-2 ' + (tab === t.key ? 'bg-white' : '')}
              >
                <Text className={'text-sm font-bold ' + (tab === t.key ? 'text-stone-900' : 'text-stone-500')}>
                  {t.label}
                  {t.key === 'requests' && requestsBadge > 0 ? ` (${requestsBadge})` : ''}
                </Text>
              </Pressable3D>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Friends and Discover are FlatLists — both can genuinely grow large
          (an active user's friend count, or the 50-item discover feed), so
          windowing keeps off-screen rows (and their avatar image requests)
          from ever mounting. Requests and Activity stay a plain ScrollView:
          both are naturally small (a handful of pending requests, 7 days of
          activity), so windowing them buys nothing but adds real complexity
          (Requests in particular has two sub-lists with section labels). */}
      {tab === 'friends' ? (
        <FlatList
          data={friends}
          keyExtractor={(f) => String(f.user_id)}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <>
              <View className="mb-4 flex-row items-center gap-2 rounded-2xl bg-white px-3 py-1" style={{ shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Add by username or email"
                  placeholderTextColor="#a8a29e"
                  autoCapitalize="none"
                  className="flex-1 py-2.5 text-sm font-semibold text-stone-800"
                  onSubmitEditing={() => sendRequest()}
                />
                <Pressable3D onPress={() => sendRequest()} disabled={!query.trim() || sending} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-brand-500">
                  {sending ? <ActivityIndicator size="small" color="#fff" /> : <UserPlus size={16} color="#fff" />}
                </Pressable3D>
              </View>
              {!!message && <Text className="mb-3 text-sm font-semibold text-stone-500">{message}</Text>}
            </>
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-base font-bold text-stone-400">No friends yet — add one above!</Text>
            </View>
          }
          renderItem={({ item: f }) => (
            <Row onPress={() => navigation.navigate('PublicProfile', { username: f.username })} style={{ alignItems: 'flex-start' }}>
              <Avatar name={f.name || f.username} avatarUrl={f.avatar_url} size={48} isPremium={f.is_premium} />
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-bold text-stone-800" numberOfLines={1}>{f.name || f.username}</Text>
                <StatChips level={f.level} xp={f.xp} streak={f.streak} />
              </View>
              <Pressable3D onPress={() => confirmRemove(f)} pressDepth={2} className="h-8 w-8 items-center justify-center rounded-full bg-stone-100">
                <XIcon size={14} color="#a8a29e" />
              </Pressable3D>
            </Row>
          )}
        />
      ) : tab === 'discover' ? (
        discover === null ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#FF7A1A" />
          </View>
        ) : (
          <FlatList
            data={discover}
            keyExtractor={(p) => String(p.user_id)}
            contentContainerStyle={{ padding: 16, paddingTop: 8 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View className="items-center py-16">
                <Text className="text-base font-bold text-stone-400">No suggestions right now.</Text>
              </View>
            }
            renderItem={({ item: p }) => {
              const { state } = getFriendshipState(p.user_id, { friends, incoming, sent: visibleSent });
              return (
                <Row onPress={() => p.username && navigation.navigate('PublicProfile', { username: p.username })} style={{ alignItems: 'flex-start' }}>
                  <Avatar name={p.name || p.username} avatarUrl={p.avatar_url} size={48} isPremium={p.is_premium} />
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-bold text-stone-800" numberOfLines={1}>{p.name || p.username}</Text>
                    <StatChips level={p.level} xp={p.xp} streak={p.streak} />
                    <ReasonChips reasons={p.reasons} />
                  </View>
                  {state === 'friends' ? (
                    <View className="rounded-xl bg-grass-50 px-3 py-1.5">
                      <Text className="text-xs font-bold text-grass-600">Friends</Text>
                    </View>
                  ) : state === 'outgoing_pending' ? (
                    <View className="rounded-xl bg-stone-100 px-3 py-1.5">
                      <Text className="text-xs font-bold text-stone-500">Requested</Text>
                    </View>
                  ) : state === 'incoming_pending' ? (
                    <View className="rounded-xl bg-feather-50 px-3 py-1.5">
                      <Text className="text-xs font-bold text-feather-600">Respond</Text>
                    </View>
                  ) : (
                    <Pressable3D
                      onPress={() => sendRequest(null, p.user_id)}
                      pressDepth={2}
                      className="flex-row items-center gap-1 rounded-xl bg-brand-500 px-3 py-1.5"
                      style={{ borderBottomWidth: 2, borderBottomColor: '#E85F00' }}
                    >
                      <UserPlus size={13} color="#fff" />
                      <Text className="text-xs font-extrabold text-white">Add</Text>
                    </Pressable3D>
                  )}
                </Row>
              );
            }}
          />
        )
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {tab === 'requests' && (
            <>
              <Text className="mb-2 text-xs font-extrabold uppercase tracking-wide text-stone-400">Incoming</Text>
              {incoming.length === 0 ? (
                <Text className="mb-4 text-sm font-semibold text-stone-400">No incoming requests.</Text>
              ) : (
                incoming.map((r) => (
                  <Row key={r.id}>
                    <Avatar name={r.requester_name} avatarUrl={r.avatar_url} size={48} isPremium={r.is_premium} />
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-bold text-stone-800" numberOfLines={1}>{r.requester_name}</Text>
                      <Text className="text-xs font-semibold text-stone-400">Wants to be friends · {timeAgo(r.created_at)}</Text>
                    </View>
                    <Pressable3D onPress={() => accept(r.id)} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-grass-500">
                      <Check size={16} color="#fff" />
                    </Pressable3D>
                    <Pressable3D onPress={() => reject(r.id)} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-stone-200">
                      <XIcon size={16} color="#57534e" />
                    </Pressable3D>
                  </Row>
                ))
              )}

              <Text className="mb-2 mt-4 text-xs font-extrabold uppercase tracking-wide text-stone-400">Sent</Text>
              {visibleSent.length === 0 ? (
                <Text className="text-sm font-semibold text-stone-400">No pending sent requests.</Text>
              ) : (
                visibleSent.map((r) => (
                  <Row key={r.id}>
                    <Avatar name={r.addressee_name} avatarUrl={r.addressee_avatar_url} size={48} isPremium={r.addressee_is_premium} />
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-bold text-stone-800" numberOfLines={1}>{r.addressee_name}</Text>
                      <Text className="text-xs font-semibold text-stone-400">Requested · {timeAgo(r.created_at)}</Text>
                    </View>
                    <Pressable3D onPress={() => dismissSent(r.id)} pressDepth={2} className="rounded-full bg-stone-100 px-3 py-1.5">
                      <Text className="text-xs font-bold text-stone-500">Cancel</Text>
                    </Pressable3D>
                  </Row>
                ))
              )}
            </>
          )}

          {tab === 'activity' && (
            activity === null ? (
              <ActivityIndicator color="#FF7A1A" style={{ marginTop: 24 }} />
            ) : activity.length === 0 ? (
              <View className="items-center py-16">
                <UsersIcon size={28} color="#d6d3d1" />
                <Text className="mt-2 text-base font-bold text-stone-400">No recent activity from friends.</Text>
              </View>
            ) : (
              activity.map((a, i) => (
                <Row key={`${a.friend_id}-${a.completed_at}-${i}`} onPress={() => a.username && navigation.navigate('PublicProfile', { username: a.username })}>
                  <Avatar name={a.name} avatarUrl={a.avatar_url} size={48} isPremium={a.is_premium} />
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-bold text-stone-800" numberOfLines={1}>
                      {a.name} finished "{a.lesson_title}"
                    </Text>
                    <Text className="text-xs font-semibold text-stone-400">{timeAgo(a.completed_at)}</Text>
                  </View>
                  <View className="flex-row items-center gap-1 rounded-lg bg-gold-50 px-2.5 py-1.5">
                    <Star size={12} color="#E0A800" />
                    <Text className="text-xs font-extrabold text-gold-700">+{a.xp_earned}</Text>
                  </View>
                </Row>
              ))
            )
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
