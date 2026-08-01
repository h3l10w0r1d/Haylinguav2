// src/screens/ForumThreadScreen.js — port of src/ForumThreadPage.jsx: post
// list (root post highlighted) + reply composer + self-delete-own-reply.
import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { ArrowLeft, Pin, Lock, Send, Trash2 } from 'lucide-react-native';
import { api, ApiError, resolveUrl } from '../lib/api';
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

function AvatarBubble({ name, avatarUrl }) {
  const resolved = resolveUrl(avatarUrl);
  if (resolved) {
    return (
      <View style={{ width: 34, height: 34, borderRadius: 11, overflow: 'hidden', backgroundColor: '#f5f5f4' }}>
        <Image source={{ uri: resolved }} style={{ width: 34, height: 34 }} />
      </View>
    );
  }
  return (
    <LinearGradient
      colors={['#FF9342', '#E11D48']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text className="text-sm font-extrabold text-white">{(name || '?')[0]?.toUpperCase()}</Text>
    </LinearGradient>
  );
}

export default function ForumThreadScreen({ navigation, route }) {
  const { threadId } = route.params;
  const [thread, setThread] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [myId, setMyId] = useState(null);

  const load = useCallback(async () => {
    const [res, me] = await Promise.all([
      api.get(`/forum/threads/${threadId}`).catch(() => null),
      api.get('/me/profile').catch(() => null),
    ]);
    if (res) {
      setThread(res.thread);
      setPosts(Array.isArray(res.posts) ? res.posts : []);
    }
    if (me?.id) setMyId(me.id);
    setLoading(false);
  }, [threadId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function sendReply() {
    const body = reply.trim();
    if (!body || sending || thread?.is_locked) return;
    setSending(true);
    try {
      await api.post(`/forum/threads/${threadId}/posts`, { body });
      setReply('');
      load();
    } catch (e) {
      Alert.alert('Could not send', e instanceof ApiError ? e.message : 'Please try again.');
    } finally {
      setSending(false);
    }
  }

  function confirmDelete(postId) {
    Alert.alert('Delete reply?', 'This can\'t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/forum/posts/${postId}`);
            load();
          } catch (e) {
            Alert.alert('Could not delete', e instanceof ApiError ? e.message : 'Please try again.');
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1]">
        <ActivityIndicator size="large" color="#FF7A1A" />
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-[#f5f4f1]">
      <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top']}>
        <View className="flex-row items-center gap-2 px-4 pb-2 pt-3">
          <Pressable3D onPress={() => navigation.goBack()} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-white">
            <ArrowLeft size={18} color="#57534e" />
          </Pressable3D>
          <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
            {thread?.is_pinned && <Pin size={13} color="#FF7A1A" />}
            {thread?.is_locked && <Lock size={13} color="#a8a29e" />}
            <Text className="text-base font-extrabold text-stone-900" numberOfLines={1}>{thread?.title}</Text>
          </View>
        </View>

        <FlatList
          data={posts}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          renderItem={({ item: p, index }) => {
            const isRoot = index === 0;
            return (
              <View
                className={'mb-2.5 flex-row gap-3 rounded-2xl px-4 py-3.5 ' + (isRoot ? 'bg-brand-50' : 'bg-white')}
                style={!isRoot ? { borderWidth: 1, borderColor: '#f0efec' } : undefined}
              >
                <AvatarBubble name={p.author_name} avatarUrl={p.author_avatar} />
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm font-extrabold text-stone-900">{p.author_name}</Text>
                    <Text className="text-xs font-semibold text-stone-400">{timeAgo(p.created_at)}</Text>
                  </View>
                  <Text className="mt-1 text-sm font-medium text-stone-700">{p.body}</Text>
                  {!isRoot && p.author_id === myId && (
                    <Pressable3D onPress={() => confirmDelete(p.id)} pressDepth={2} className="mt-2 flex-row items-center gap-1 self-start">
                      <Trash2 size={12} color="#DC2626" />
                      <Text className="text-xs font-bold text-cardinal-600">Delete</Text>
                    </Pressable3D>
                  )}
                </View>
              </View>
            );
          }}
        />

        {thread?.is_locked ? (
          <View className="border-t border-stone-200 bg-white px-4 py-3">
            <Text className="text-center text-sm font-bold text-stone-400">This thread is locked.</Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-2 border-t border-stone-200 bg-white px-4 py-3">
            <TextInput
              value={reply}
              onChangeText={setReply}
              placeholder="Write a reply…"
              placeholderTextColor="#a8a29e"
              multiline
              className="flex-1 rounded-2xl bg-stone-100 px-3.5 py-2.5 text-sm font-semibold text-stone-800"
              style={{ maxHeight: 100 }}
            />
            <Pressable3D
              onPress={sendReply}
              disabled={!reply.trim() || sending}
              pressDepth={2}
              className={'h-10 w-10 items-center justify-center rounded-full ' + (reply.trim() ? 'bg-brand-500' : 'bg-stone-200')}
            >
              {sending ? <ActivityIndicator size="small" color="#fff" /> : <Send size={16} color={reply.trim() ? '#fff' : '#a8a29e'} />}
            </Pressable3D>
          </View>
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
