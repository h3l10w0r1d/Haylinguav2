// src/screens/ProfileScreen.js — v1 overview-only port of src/ProfilePage.jsx
// (2186 lines on web — a full settings hub with avatar upload, banner/theme
// customization, email/password change, 2FA, social linking). Deliberately
// NOT porting any of that here; this screen is read-only: avatar, name,
// stats, earned achievements, sign out. Settings/editing is flagged as a
// separate, larger follow-up pass.
import React, { useCallback, useState } from 'react';
import { View, Text, Image, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LogOut, Award } from 'lucide-react-native';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/authStore';
import Pressable3D from '../components/Pressable3D';

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const signOut = useAuthStore((s) => s.signOut);

  const load = useCallback(async () => {
    try {
      const [me, ach] = await Promise.all([
        api.get('/me/profile').catch(() => null),
        api.get('/me/achievements').catch(() => null),
      ]);
      if (me) setProfile(me);
      if (ach?.achievements) setAchievements(ach.achievements.filter((a) => a.earned));
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

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1]">
        <ActivityIndicator size="large" color="#FF7A1A" />
      </SafeAreaView>
    );
  }

  const displayName = profile?.display_name || profile?.username || 'You';

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="items-center pt-4">
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} className="h-24 w-24 rounded-full bg-stone-200" />
          ) : (
            <View className="h-24 w-24 items-center justify-center rounded-full bg-brand-100">
              <Text className="text-3xl font-extrabold text-brand-600">{displayName[0]?.toUpperCase()}</Text>
            </View>
          )}
          <Text className="mt-3 text-xl font-extrabold text-stone-900">{displayName}</Text>
          {!!profile?.username && <Text className="text-sm font-semibold text-stone-400">@{profile.username}</Text>}
          {!!profile?.bio && <Text className="mt-2 text-center text-sm font-medium text-stone-500">{profile.bio}</Text>}
        </View>

        <View className="mt-6 flex-row justify-center gap-3">
          <View className="flex-1 items-center rounded-2xl bg-white px-3 py-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
            <Text className="text-xl font-extrabold text-stone-900">{profile?.total_xp ?? 0}</Text>
            <Text className="mt-1 text-[11px] font-bold uppercase tracking-wide text-stone-400">XP</Text>
          </View>
          <View className="flex-1 items-center rounded-2xl bg-white px-3 py-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
            <Text className="text-xl font-extrabold text-stone-900">{profile?.streak ?? 0}</Text>
            <Text className="mt-1 text-[11px] font-bold uppercase tracking-wide text-stone-400">Streak</Text>
          </View>
          <View className="flex-1 items-center rounded-2xl bg-white px-3 py-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
            <Text className="text-xl font-extrabold text-stone-900">{profile?.best_streak ?? 0}</Text>
            <Text className="mt-1 text-[11px] font-bold uppercase tracking-wide text-stone-400">Best</Text>
          </View>
        </View>

        <View className="mt-6 rounded-2xl bg-white p-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
          <View className="mb-3 flex-row items-center gap-2">
            <Award size={16} color="#E0A800" />
            <Text className="text-xs font-extrabold uppercase tracking-wide text-stone-400">Achievements</Text>
          </View>
          {achievements.length === 0 ? (
            <Text className="text-sm font-semibold text-stone-400">No achievements earned yet.</Text>
          ) : (
            achievements.map((a) => (
              <View key={a.id} className="flex-row items-center gap-3 border-b border-stone-100 py-2.5 last:border-b-0">
                <View className="flex-1">
                  <Text className="text-sm font-bold text-stone-800">{a.title}</Text>
                  {!!a.desc && <Text className="text-xs font-medium text-stone-400">{a.desc}</Text>}
                </View>
              </View>
            ))
          )}
        </View>

        <Pressable3D onPress={signOut} className="mt-6 flex-row items-center justify-center gap-2 rounded-2xl bg-white py-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
          <LogOut size={18} color="#E11D48" />
          <Text className="text-base font-extrabold text-cardinal-600">Sign out</Text>
        </Pressable3D>
      </ScrollView>
    </SafeAreaView>
  );
}
