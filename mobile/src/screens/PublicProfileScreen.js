// src/screens/PublicProfileScreen.js — ports the viewing half of
// src/PublicUserPage.jsx: GET /users/{username}, plus contextual friend
// actions (request/accept/remove) exactly like the web. Reached by tapping
// a row in FriendsScreen or LeaderboardScreen.
import React, { useCallback, useState } from 'react';
import { View, Text, Image, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { UserPlus, UserCheck, UserMinus, Award, ChevronLeft } from 'lucide-react-native';
import { api } from '../lib/api';
import Pressable3D from '../components/Pressable3D';
import { haptics } from '../lib/haptics';

export default function PublicProfileScreen({ route, navigation }) {
  const { username } = route.params;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get(`/users/${username}`);
      setProfile(data);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );


  async function addFriend() {
    if (busy) return;
    setBusy(true);
    try {
      await api.post('/friends/request', { query: username });
      haptics.success();
      load();
    } catch {
      haptics.error();
    } finally {
      setBusy(false);
    }
  }

  async function acceptFriend() {
    if (busy || !profile?.friend_request_id) return;
    setBusy(true);
    try {
      await api.post(`/friends/requests/${profile.friend_request_id}/accept`);
      haptics.success();
      load();
    } catch {
      haptics.error();
    } finally {
      setBusy(false);
    }
  }

  async function removeFriend() {
    if (busy || !profile?.user_id) return;
    setBusy(true);
    try {
      await api.post(`/friends/remove/${profile.user_id}`);
      load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1]">
        <ActivityIndicator size="large" color="#FF7A1A" />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1] px-6">
        <Text className="text-center text-base font-bold text-stone-500">Couldn't load this profile.</Text>
      </SafeAreaView>
    );
  }

  const achievements = profile.achievements || [];

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top']}>
      <View className="px-4 pb-1 pt-2">
        <TouchableOpacity onPress={() => navigation.goBack()} className="h-9 w-9 items-center justify-center rounded-full bg-stone-200">
          <ChevronLeft size={20} color="#57534e" />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View className="items-center pt-4">
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} className="h-24 w-24 rounded-full bg-stone-200" />
          ) : (
            <View className="h-24 w-24 items-center justify-center rounded-full bg-brand-100">
              <Text className="text-3xl font-extrabold text-brand-600">{(profile.name || profile.username || '?')[0]?.toUpperCase()}</Text>
            </View>
          )}
          <Text className="mt-3 text-xl font-extrabold text-stone-900">{profile.name || profile.username}</Text>
          <Text className="text-sm font-semibold text-stone-400">@{profile.username}</Text>
          {!!profile.bio && <Text className="mt-2 text-center text-sm font-medium text-stone-500">{profile.bio}</Text>}
        </View>

        <View className="mt-6 flex-row justify-center gap-3">
          <View className="flex-1 items-center rounded-2xl bg-white px-3 py-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
            <Text className="text-xl font-extrabold text-stone-900">{profile.xp ?? 0}</Text>
            <Text className="mt-1 text-[11px] font-bold uppercase tracking-wide text-stone-400">XP</Text>
          </View>
          <View className="flex-1 items-center rounded-2xl bg-white px-3 py-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
            <Text className="text-xl font-extrabold text-stone-900">{profile.streak ?? 0}</Text>
            <Text className="mt-1 text-[11px] font-bold uppercase tracking-wide text-stone-400">Streak</Text>
          </View>
          <View className="flex-1 items-center rounded-2xl bg-white px-3 py-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
            <Text className="text-xl font-extrabold text-stone-900">{profile.friends_count ?? 0}</Text>
            <Text className="mt-1 text-[11px] font-bold uppercase tracking-wide text-stone-400">Friends</Text>
          </View>
        </View>

        {profile.friendship === 'none' && (
          <Pressable3D onPress={addFriend} disabled={busy} className="mt-6 flex-row items-center justify-center gap-2 rounded-2xl bg-brand-500 py-4">
            <UserPlus size={18} color="#fff" />
            <Text className="text-base font-extrabold text-white">Add friend</Text>
          </Pressable3D>
        )}
        {profile.friendship === 'incoming_pending' && (
          <Pressable3D onPress={acceptFriend} disabled={busy} className="mt-6 flex-row items-center justify-center gap-2 rounded-2xl bg-grass-500 py-4">
            <UserCheck size={18} color="#fff" />
            <Text className="text-base font-extrabold text-white">Accept request</Text>
          </Pressable3D>
        )}
        {profile.friendship === 'outgoing_pending' && (
          <View className="mt-6 items-center rounded-2xl bg-stone-200 py-4">
            <Text className="text-sm font-bold text-stone-500">Friend request sent</Text>
          </View>
        )}
        {profile.friendship === 'friends' && (
          <Pressable3D onPress={removeFriend} disabled={busy} className="mt-6 flex-row items-center justify-center gap-2 rounded-2xl bg-white py-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
            <UserMinus size={18} color="#78716c" />
            <Text className="text-base font-extrabold text-stone-600">Remove friend</Text>
          </Pressable3D>
        )}

        <View className="mt-6 rounded-2xl bg-white p-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
          <View className="mb-3 flex-row items-center gap-2">
            <Award size={16} color="#E0A800" />
            <Text className="text-xs font-extrabold uppercase tracking-wide text-stone-400">Achievements</Text>
          </View>
          {achievements.length === 0 ? (
            <Text className="text-sm font-semibold text-stone-400">No achievements yet.</Text>
          ) : (
            achievements.map((a) => (
              <View key={a.id} className="border-b border-stone-100 py-2.5 last:border-b-0">
                <Text className="text-sm font-bold text-stone-800">{a.title}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
