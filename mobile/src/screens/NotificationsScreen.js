// src/screens/NotificationsScreen.js — in-app notification history. Web has
// no inbox UI (just dismissible banners on HeaderLayout.jsx) and the backend
// only generates one kind today (admin-granted bonuses via the CMS support
// panel) — plain title/body strings, no type/deep-link field, no mark-all-
// read or unread-count endpoint (see notifications research). This is a
// straightforward list: unread rows are tinted, tapping one marks it read.
import React, { useCallback, useState } from 'react';
import { View, Text, ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Gift, BellOff } from 'lucide-react-native';
import { api } from '../lib/api';
import Pressable3D from '../components/Pressable3D';

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

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get('/me/notifications').catch(() => null);
    setNotifications(Array.isArray(res?.notifications) ? res.notifications : []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  async function markRead(n) {
    if (n.read_at) return;
    setNotifications((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    await api.post(`/me/notifications/${n.id}/read`).catch(() => {});
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top']}>
      <View className="flex-row items-center gap-2 px-4 pb-2 pt-3">
        <Pressable3D onPress={() => navigation.goBack()} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-white">
          <ArrowLeft size={18} color="#57534e" />
        </Pressable3D>
        <Text className="text-xl font-extrabold text-stone-900 font-display">Notifications</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF7A1A" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View className="items-center py-16">
              <BellOff size={28} color="#d6d3d1" />
              <Text className="mt-2 text-base font-bold text-stone-400">No notifications yet.</Text>
            </View>
          }
          renderItem={({ item: n }) => (
            <Pressable3D
              onPress={() => markRead(n)}
              pressDepth={1}
              className={'mb-2.5 flex-row items-start gap-3 rounded-2xl px-4 py-3.5 ' + (n.read_at ? 'bg-white' : 'bg-brand-50')}
              style={!n.read_at ? undefined : { borderWidth: 1, borderColor: '#f0efec' }}
            >
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-gold-50">
                <Gift size={16} color="#E0A800" />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-bold text-stone-800">{n.title}</Text>
                {!!n.body && <Text className="mt-0.5 text-xs font-semibold text-stone-500">{n.body}</Text>}
                <Text className="mt-1 text-[11px] font-bold text-stone-400">{timeAgo(n.created_at)}</Text>
              </View>
              {!n.read_at && <View className="mt-1.5 rounded-full bg-cardinal-500" style={{ width: 7, height: 7 }} />}
            </Pressable3D>
          )}
        />
      )}
    </SafeAreaView>
  );
}
