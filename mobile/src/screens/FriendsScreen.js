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
import { View, Text, TextInput, ActivityIndicator, ScrollView, RefreshControl, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserPlus, Check, X as XIcon, Users as UsersIcon } from 'lucide-react-native';
import { api, ApiError, resolveUrl } from '../lib/api';
import { getFriendshipState } from '../lib/friendState';
import Pressable3D from '../components/Pressable3D';
import { haptics } from '../lib/haptics';

const DISMISSED_SENT_KEY = 'hay_friends_dismissed_sent_v1';

function Avatar({ name, avatarUrl, size = 40 }) {
  const resolved = resolveUrl(avatarUrl);
  const shape = { width: size, height: size, borderRadius: size / 2 };
  if (resolved) {
    return (
      <View style={[shape, { overflow: 'hidden', backgroundColor: '#f5f5f4' }]}>
        <Image source={{ uri: resolved }} style={shape} />
      </View>
    );
  }
  return (
    <View style={shape} className="items-center justify-center bg-stone-100">
      <Text className="font-extrabold text-stone-500" style={{ fontSize: size * 0.4 }}>{(name || '?')[0]?.toUpperCase()}</Text>
    </View>
  );
}

function Row({ children, onPress, style }) {
  return (
    <Pressable3D onPress={onPress} disabled={!onPress} pressDepth={2} className="mb-2 flex-row items-center gap-3 rounded-2xl bg-white px-4 py-3" style={{ shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1, ...style }}>
      {children}
    </Pressable3D>
  );
}

function ReasonChips({ reasons }) {
  if (!reasons?.length) return null;
  return (
    <View className="mt-1 flex-row flex-wrap" style={{ gap: 4 }}>
      {reasons.slice(0, 2).map((r, i) => (
        <View key={i} className="rounded-full bg-feather-50 px-2 py-0.5">
          <Text className="text-[10px] font-bold text-feather-600">{r}</Text>
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

  async function sendRequest(target) {
    const q = (target ?? query).trim();
    if (!q || sending) return;
    setSending(true);
    setMessage('');
    try {
      const res = await api.post('/friends/request', { query: q });
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

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {tab === 'friends' && (
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

            {friends.length === 0 ? (
              <View className="items-center py-16">
                <Text className="text-base font-bold text-stone-400">No friends yet — add one above!</Text>
              </View>
            ) : (
              friends.map((f) => (
                <Row key={f.user_id} onPress={() => navigation.navigate('PublicProfile', { username: f.username })}>
                  <Avatar name={f.name || f.username} avatarUrl={f.avatar_url} />
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-stone-800" numberOfLines={1}>{f.name || f.username}</Text>
                    <Text className="text-xs font-semibold text-stone-400">Level {f.level ?? '–'} · {f.streak ?? 0} day streak</Text>
                  </View>
                  <Text className="text-sm font-extrabold text-stone-900">{f.xp} XP</Text>
                  <Pressable3D onPress={() => confirmRemove(f)} pressDepth={2} className="h-8 w-8 items-center justify-center rounded-full bg-stone-100">
                    <XIcon size={14} color="#a8a29e" />
                  </Pressable3D>
                </Row>
              ))
            )}
          </>
        )}

        {tab === 'requests' && (
          <>
            <Text className="mb-2 text-xs font-extrabold uppercase tracking-wide text-stone-400">Incoming</Text>
            {incoming.length === 0 ? (
              <Text className="mb-4 text-sm font-semibold text-stone-400">No incoming requests.</Text>
            ) : (
              incoming.map((r) => (
                <Row key={r.id}>
                  <Avatar name={r.requester_name || r.requester_email} />
                  <Text className="flex-1 text-sm font-bold text-stone-800" numberOfLines={1}>{r.requester_name || r.requester_email}</Text>
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
                  <Avatar name={r.addressee_name || r.addressee_email} />
                  <Text className="flex-1 text-sm font-bold text-stone-800" numberOfLines={1}>{r.addressee_name || r.addressee_email}</Text>
                  <Pressable3D onPress={() => dismissSent(r.id)} pressDepth={2} className="rounded-full bg-stone-100 px-3 py-1.5">
                    <Text className="text-xs font-bold text-stone-500">Cancel</Text>
                  </Pressable3D>
                </Row>
              ))
            )}
          </>
        )}

        {tab === 'discover' && (
          discover === null ? (
            <ActivityIndicator color="#FF7A1A" style={{ marginTop: 24 }} />
          ) : discover.length === 0 ? (
            <View className="items-center py-16">
              <Text className="text-base font-bold text-stone-400">No suggestions right now.</Text>
            </View>
          ) : (
            discover.map((p) => {
              const { state } = getFriendshipState(p.user_id, { friends, incoming, sent: visibleSent });
              return (
                <Row key={p.user_id} onPress={() => p.username && navigation.navigate('PublicProfile', { username: p.username })}>
                  <Avatar name={p.name || p.username} avatarUrl={p.avatar_url} />
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-stone-800" numberOfLines={1}>{p.name || p.username}</Text>
                    <ReasonChips reasons={p.reasons} />
                  </View>
                  {state === 'friends' ? (
                    <View className="rounded-full bg-grass-50 px-3 py-1.5">
                      <Text className="text-xs font-bold text-grass-600">Friends</Text>
                    </View>
                  ) : state === 'outgoing_pending' ? (
                    <View className="rounded-full bg-stone-100 px-3 py-1.5">
                      <Text className="text-xs font-bold text-stone-500">Requested</Text>
                    </View>
                  ) : state === 'incoming_pending' ? (
                    <View className="rounded-full bg-feather-50 px-3 py-1.5">
                      <Text className="text-xs font-bold text-feather-600">Respond</Text>
                    </View>
                  ) : (
                    <Pressable3D onPress={() => sendRequest(p.email || p.username)} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-brand-500">
                      <UserPlus size={16} color="#fff" />
                    </Pressable3D>
                  )}
                </Row>
              );
            })
          )
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
                <Avatar name={a.name} avatarUrl={a.avatar_url} />
                <View className="flex-1">
                  <Text className="text-sm font-bold text-stone-800" numberOfLines={1}>
                    {a.name} finished "{a.lesson_title}"
                  </Text>
                  <Text className="text-xs font-semibold text-stone-400">
                    {a.completed_at ? new Date(a.completed_at).toLocaleDateString() : ''}
                  </Text>
                </View>
                <Text className="text-sm font-extrabold text-gold-600">+{a.xp_earned} XP</Text>
              </Row>
            ))
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
