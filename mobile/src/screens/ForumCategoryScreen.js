// src/screens/ForumCategoryScreen.js — port of src/ForumCategoryPage.jsx:
// thread list for one category + inline "new thread" composer.
import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Pin, Lock, ChevronRight, Plus } from 'lucide-react-native';
import { api, ApiError } from '../lib/api';
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

export default function ForumCategoryScreen({ navigation, route }) {
  const { slug, name } = route.params;
  const [category, setCategory] = useState(null);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await api.get(`/forum/categories/${slug}/threads`).catch(() => null);
    if (res) {
      setCategory(res.category);
      setThreads(Array.isArray(res.threads) ? res.threads : []);
    }
    setLoading(false);
  }, [slug]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  async function submitThread() {
    if (!title.trim() || !body.trim() || posting) return;
    setPosting(true);
    setError('');
    try {
      const res = await api.post('/forum/threads', { category_id: category.id, title: title.trim(), body: body.trim() });
      setTitle('');
      setBody('');
      setComposerOpen(false);
      navigation.navigate('ForumThread', { threadId: res.id, title: title.trim() });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not post that thread.');
    } finally {
      setPosting(false);
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
      <View className="flex-row items-center gap-2 px-4 pb-2 pt-3">
        <Pressable3D onPress={() => navigation.goBack()} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-white">
          <ArrowLeft size={18} color="#57534e" />
        </Pressable3D>
        <View className="min-w-0 flex-1">
          <Text className="text-lg font-extrabold text-stone-900" numberOfLines={1}>{category?.name || name}</Text>
          {!!category?.description && <Text className="text-xs font-semibold text-stone-400" numberOfLines={1}>{category.description}</Text>}
        </View>
        <Pressable3D onPress={() => setComposerOpen((v) => !v)} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-brand-500">
          <Plus size={18} color="#fff" />
        </Pressable3D>
      </View>

      {composerOpen && (
        <View className="mx-4 mb-3 rounded-2xl bg-white p-4" style={{ borderWidth: 1, borderColor: '#f0efec' }}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Thread title"
            placeholderTextColor="#a8a29e"
            className="mb-2 rounded-xl bg-stone-100 px-3 py-2.5 text-sm font-bold text-stone-800"
          />
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="What's on your mind?"
            placeholderTextColor="#a8a29e"
            multiline
            numberOfLines={4}
            className="rounded-xl bg-stone-100 px-3 py-2.5 text-sm font-semibold text-stone-800"
            style={{ minHeight: 90, textAlignVertical: 'top' }}
          />
          {!!error && <Text className="mt-2 text-xs font-bold text-cardinal-600">{error}</Text>}
          <Pressable3D
            onPress={submitThread}
            disabled={!title.trim() || !body.trim() || posting}
            className={'mt-3 items-center rounded-xl py-3 ' + (title.trim() && body.trim() ? 'bg-brand-500' : 'bg-stone-300')}
          >
            {posting ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-extrabold text-white">Post thread</Text>}
          </Pressable3D>
        </View>
      )}

      <FlatList
        data={threads}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View className="items-center py-16">
            <Text className="text-base font-bold text-stone-400">No threads yet — start the first one!</Text>
          </View>
        }
        renderItem={({ item: t }) => (
          <Pressable3D
            onPress={() => navigation.navigate('ForumThread', { threadId: t.id, title: t.title })}
            pressDepth={2}
            className="mb-2.5 flex-row items-center gap-3 rounded-2xl bg-white px-4 py-3.5"
            style={{ borderWidth: 1, borderColor: '#f0efec', shadowColor: '#1c1917', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}
          >
            <View className="min-w-0 flex-1">
              <View className="flex-row items-center gap-1.5">
                {t.is_pinned && <Pin size={12} color="#FF7A1A" />}
                {t.is_locked && <Lock size={12} color="#a8a29e" />}
                <Text className="text-sm font-bold text-stone-800" numberOfLines={1} style={{ flexShrink: 1 }}>{t.title}</Text>
              </View>
              <Text className="mt-0.5 text-xs font-semibold text-stone-400">
                {t.author_name} · {timeAgo(t.last_reply_at || t.created_at)} · {t.reply_count} {t.reply_count === 1 ? 'reply' : 'replies'}
              </Text>
            </View>
            <ChevronRight size={16} color="#d6d3d1" />
          </Pressable3D>
        )}
      />
    </SafeAreaView>
  );
}
