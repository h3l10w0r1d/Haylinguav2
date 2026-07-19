// src/screens/FriendsScreen.js — ports the core loop of src/Friends.jsx.
// v1 scope: Friends (list + add-by-username/email) and Requests (incoming,
// accept/reject) tabs. Deferring the web's Discover/Suggestions
// (GET /friends/suggestions) and Activity feed (GET /friends/activity) tabs
// to a follow-up pass — flagged, not silently dropped.
import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { UserPlus, Check, X as XIcon } from 'lucide-react-native';
import { api, ApiError } from '../lib/api';
import Pressable3D from '../components/Pressable3D';
import { haptics } from '../lib/haptics';

function FriendRow({ friend, onPress }) {
  return (
    <Pressable3D onPress={onPress} pressDepth={2} className="mb-2 flex-row items-center gap-3 rounded-2xl bg-white px-4 py-3" style={{ shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }}>
      <View className="h-10 w-10 items-center justify-center rounded-full bg-stone-100">
        <Text className="text-base font-extrabold text-stone-500">{(friend.name || friend.username || '?')[0]?.toUpperCase()}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-bold text-stone-800" numberOfLines={1}>{friend.name || friend.username}</Text>
        <Text className="text-xs font-semibold text-stone-400">Level {friend.level ?? '–'} · {friend.streak ?? 0} day streak</Text>
      </View>
      <Text className="text-sm font-extrabold text-stone-900">{friend.xp} XP</Text>
    </Pressable3D>
  );
}

export default function FriendsScreen({ navigation }) {
  const [tab, setTab] = useState('friends'); // 'friends' | 'requests'
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([
        api.get('/friends').catch(() => []),
        api.get('/friends/requests').catch(() => []),
      ]);
      setFriends(Array.isArray(f) ? f : []);
      setRequests(Array.isArray(r) ? r : []);
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

  async function sendRequest() {
    const q = query.trim();
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
      load();
    } catch {
      haptics.error();
    }
  }

  async function reject(id) {
    try {
      await api.post(`/friends/requests/${id}/reject`);
      load();
    } catch {
      // non-fatal
    }
  }

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
        <Text className="text-xl font-extrabold text-stone-900">Friends</Text>

        {/* Pressable3D's press animation lives on an outer wrapper View, so
            the flex-1 that splits this row evenly has to go on a plain View
            around it — className on Pressable3D itself only sizes its own
            inner Pressable, not the animated wrapper. */}
        <View className="mt-3 flex-row rounded-2xl bg-stone-200 p-1">
          <View className="flex-1">
            <Pressable3D onPress={() => setTab('friends')} pressDepth={2} className={'items-center rounded-xl py-2 ' + (tab === 'friends' ? 'bg-white' : '')}>
              <Text className={'text-sm font-bold ' + (tab === 'friends' ? 'text-stone-900' : 'text-stone-500')}>Friends</Text>
            </Pressable3D>
          </View>
          <View className="flex-1">
            <Pressable3D onPress={() => setTab('requests')} pressDepth={2} className={'items-center rounded-xl py-2 ' + (tab === 'requests' ? 'bg-white' : '')}>
              <Text className={'text-sm font-bold ' + (tab === 'requests' ? 'text-stone-900' : 'text-stone-500')}>
                Requests{requests.length > 0 ? ` (${requests.length})` : ''}
              </Text>
            </Pressable3D>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {tab === 'friends' ? (
          <>
            <View className="mb-4 flex-row items-center gap-2 rounded-2xl bg-white px-3 py-1" style={{ shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Add by username or email"
                placeholderTextColor="#a8a29e"
                autoCapitalize="none"
                className="flex-1 py-2.5 text-sm font-semibold text-stone-800"
                onSubmitEditing={sendRequest}
              />
              <Pressable3D onPress={sendRequest} disabled={!query.trim() || sending} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-brand-500">
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
                <FriendRow key={f.user_id} friend={f} onPress={() => navigation.navigate('PublicProfile', { username: f.username })} />
              ))
            )}
          </>
        ) : requests.length === 0 ? (
          <View className="items-center py-16">
            <Text className="text-base font-bold text-stone-400">No pending requests.</Text>
          </View>
        ) : (
          requests.map((r) => (
            <View key={r.id} className="mb-2 flex-row items-center gap-3 rounded-2xl bg-white px-4 py-3" style={{ shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }}>
              <View className="h-10 w-10 items-center justify-center rounded-full bg-stone-100">
                <Text className="text-base font-extrabold text-stone-500">{(r.requester_name || r.requester_email || '?')[0]?.toUpperCase()}</Text>
              </View>
              <Text className="flex-1 text-sm font-bold text-stone-800" numberOfLines={1}>{r.requester_name || r.requester_email}</Text>
              <Pressable3D onPress={() => accept(r.id)} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-grass-500">
                <Check size={16} color="#fff" />
              </Pressable3D>
              <Pressable3D onPress={() => reject(r.id)} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-stone-200">
                <XIcon size={16} color="#57534e" />
              </Pressable3D>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
