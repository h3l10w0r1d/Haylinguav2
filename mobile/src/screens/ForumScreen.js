// src/screens/ForumScreen.js — port of src/ForumPage.jsx's category list +
// search. Community/Forum has zero mobile presence today; this is the entry
// point (category list) -> ForumCategoryScreen (threads) -> ForumThreadScreen
// (thread + replies), mirroring web's 3-level route structure.
import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Hand, MessageCircle, Lightbulb, Bug, Search, ChevronRight, Users } from 'lucide-react-native';
import { api } from '../lib/api';
import Pressable3D from '../components/Pressable3D';

const CATEGORY_ICONS = { hand: Hand, 'message-circle': MessageCircle, lightbulb: Lightbulb, bug: Bug };

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

function Row({ children, onPress }) {
  return (
    <Pressable3D
      onPress={onPress}
      pressDepth={2}
      className="mb-2.5 flex-row items-center gap-3 rounded-2xl bg-white px-4 py-3.5"
      style={{ borderWidth: 1, borderColor: '#f0efec', shadowColor: '#1c1917', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}
    >
      {children}
    </Pressable3D>
  );
}

export default function ForumScreen({ navigation }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null); // null = not searching
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get('/forum/categories').catch(() => ({ categories: [] }));
    setCategories(Array.isArray(res?.categories) ? res.categories : []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const res = await api.get(`/forum/search?q=${encodeURIComponent(q)}`).catch(() => ({ threads: [] }));
      setSearchResults(Array.isArray(res?.threads) ? res.threads : []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

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
        <Text className="text-xl font-extrabold text-stone-900 font-display">Community</Text>
        <View className="mt-3 flex-row items-center gap-2 rounded-2xl bg-white px-3 py-1" style={{ borderWidth: 1, borderColor: '#f0efec' }}>
          <Search size={16} color="#a8a29e" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search threads"
            placeholderTextColor="#a8a29e"
            className="flex-1 py-2.5 text-sm font-semibold text-stone-800"
          />
          {searching && <ActivityIndicator size="small" color="#FF7A1A" />}
        </View>
      </View>

      {searchResults !== null ? (
        <FlatList
          data={searchResults}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-base font-bold text-stone-400">No threads found.</Text>
            </View>
          }
          renderItem={({ item: t }) => (
            <Row onPress={() => navigation.navigate('ForumThread', { threadId: t.id, title: t.title })}>
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-bold text-stone-800" numberOfLines={1}>{t.title}</Text>
                <Text className="mt-0.5 text-xs font-semibold text-stone-400">
                  {t.category_name} · {t.author_name} · {t.reply_count} {t.reply_count === 1 ? 'reply' : 'replies'}
                </Text>
              </View>
              <ChevronRight size={16} color="#d6d3d1" />
            </Row>
          )}
        />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Users size={28} color="#d6d3d1" />
              <Text className="mt-2 text-base font-bold text-stone-400">No categories yet.</Text>
            </View>
          }
          renderItem={({ item: c }) => {
            const Icon = CATEGORY_ICONS[c.icon] || MessageCircle;
            return (
              <Row onPress={() => navigation.navigate('ForumCategory', { slug: c.slug, name: c.name })}>
                <View className="h-11 w-11 items-center justify-center rounded-xl bg-brand-50">
                  <Icon size={20} color="#FF7A1A" />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-extrabold text-stone-900">{c.name}</Text>
                  {!!c.description && <Text className="text-xs font-semibold text-stone-400" numberOfLines={1}>{c.description}</Text>}
                  <Text className="mt-0.5 text-[11px] font-bold text-stone-400">
                    {c.thread_count} {c.thread_count === 1 ? 'thread' : 'threads'}
                    {c.last_activity_at ? ` · active ${timeAgo(c.last_activity_at)}` : ''}
                  </Text>
                </View>
                <ChevronRight size={16} color="#d6d3d1" />
              </Row>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
