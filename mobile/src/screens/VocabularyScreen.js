// src/screens/VocabularyScreen.js — port of src/VocabularyPage.jsx: a flat,
// searchable/filterable read-only list of the learner's spaced-repetition
// deck (GET /me/vocabulary). Not a study/flashcard interface — that's what
// ReviewScreen.js already is; this is browsing + progress visibility.
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Search, BookOpen, Sparkles, Circle, Volume2 } from 'lucide-react-native';
import { api } from '../lib/api';
import { playExerciseAudio } from '../lib/playExerciseAudio';
import Pressable3D from '../components/Pressable3D';
import ScreenFadeIn from '../components/ScreenFadeIn';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'mastered', label: 'Mastered' },
  { key: 'learning', label: 'Learning' },
  { key: 'new', label: 'New' },
];

const STATUS_COLOR = { mastered: '#58CC02', learning: '#FFC800', new: '#a8a29e' };

// config is a raw JSON string that may hold {front, back} — falls back to
// prompt/expected_answer when it doesn't parse or lacks those fields,
// mirroring web's same defensive parse.
function frontBack(card) {
  try {
    const cfg = card.config ? JSON.parse(card.config) : null;
    if (cfg?.front || cfg?.back) return { front: cfg.front || card.prompt, back: cfg.back || card.expected_answer };
  } catch {
    // fall through to prompt/expected_answer
  }
  return { front: card.prompt, back: card.expected_answer };
}

function CardRow({ card, playing, onPlay }) {
  const { front, back } = frontBack(card);
  return (
    <View className="mb-2.5 flex-row items-center gap-3 rounded-2xl bg-white px-4 py-3.5" style={{ borderWidth: 1, borderColor: '#f0efec', shadowColor: '#1c1917', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}>
      <View className="rounded-full" style={{ width: 9, height: 9, backgroundColor: STATUS_COLOR[card.status] || '#a8a29e' }} />
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-extrabold text-stone-900" numberOfLines={1}>{front}</Text>
        <Text className="text-xs font-semibold text-stone-400" numberOfLines={1}>{back}</Text>
        {!!card.lesson_title && <Text className="mt-0.5 text-[11px] font-bold text-stone-300" numberOfLines={1}>{card.lesson_title}</Text>}
      </View>
      {card.interval_days > 0 && (
        <Text className="text-[11px] font-bold text-stone-400">{card.interval_days}d</Text>
      )}
      <Pressable3D onPress={() => onPlay(card)} pressDepth={1} className="h-8 w-8 items-center justify-center rounded-full bg-feather-50">
        {playing ? <ActivityIndicator size="small" color="#1CB0F6" /> : <Volume2 size={14} color="#1CB0F6" />}
      </Pressable3D>
    </View>
  );
}

export default function VocabularyScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [playingId, setPlayingId] = useState(null);

  const load = useCallback(async () => {
    const res = await api.get('/me/vocabulary').catch(() => null);
    setData(res);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function play(card) {
    if (playingId) return;
    setPlayingId(card.exercise_id);
    const { front } = frontBack(card);
    await playExerciseAudio(card.exercise_id, { text: front }).catch(() => {});
    setPlayingId(null);
  }

  const cards = Array.isArray(data?.cards) ? data.cards : [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter((c) => {
      if (filter !== 'all' && c.status !== filter) return false;
      if (!q) return true;
      const { front, back } = frontBack(c);
      return (
        (front || '').toLowerCase().includes(q) ||
        (back || '').toLowerCase().includes(q) ||
        (c.lesson_title || '').toLowerCase().includes(q)
      );
    });
  }, [cards, query, filter]);

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top']}>
      <View className="px-4 pb-2 pt-3">
        <View className="flex-row items-center gap-2">
          <Pressable3D onPress={() => navigation.goBack()} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-white">
            <ArrowLeft size={18} color="#57534e" />
          </Pressable3D>
          <View>
            <Text className="text-xl font-extrabold text-stone-900 font-display">Vocabulary</Text>
            {!!data && <Text className="text-xs font-semibold text-stone-400">{data.total} cards tracked</Text>}
          </View>
        </View>

        {!!data && (
          <View className="mt-3 flex-row" style={{ gap: 8 }}>
            <View className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-white py-2" style={{ borderWidth: 1, borderColor: '#f0efec' }}>
              <Sparkles size={13} color="#58CC02" />
              <Text className="text-xs font-extrabold text-stone-700">{data.mastered} mastered</Text>
            </View>
            <View className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-white py-2" style={{ borderWidth: 1, borderColor: '#f0efec' }}>
              <BookOpen size={13} color="#E0A800" />
              <Text className="text-xs font-extrabold text-stone-700">{data.learning} learning</Text>
            </View>
            <View className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-white py-2" style={{ borderWidth: 1, borderColor: '#f0efec' }}>
              <Circle size={11} color="#a8a29e" />
              <Text className="text-xs font-extrabold text-stone-700">{data.new_cards} new</Text>
            </View>
          </View>
        )}

        <View className="mt-3 flex-row items-center gap-2 rounded-2xl bg-white px-3 py-1" style={{ borderWidth: 1, borderColor: '#f0efec' }}>
          <Search size={16} color="#a8a29e" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search vocabulary"
            placeholderTextColor="#a8a29e"
            className="flex-1 py-2.5 text-sm font-semibold text-stone-800"
          />
        </View>

        <View className="mt-3 flex-row" style={{ gap: 6 }}>
          {FILTERS.map((f) => (
            <Pressable3D
              key={f.key}
              onPress={() => setFilter(f.key)}
              pressDepth={1}
              hapticOnPress={false}
              className={'rounded-xl px-3 py-1.5 ' + (filter === f.key ? 'bg-brand-500' : 'bg-white')}
              style={filter === f.key ? undefined : { borderWidth: 1, borderColor: '#f0efec' }}
            >
              <Text className={'text-xs font-extrabold ' + (filter === f.key ? 'text-white' : 'text-stone-500')}>{f.label}</Text>
            </Pressable3D>
          ))}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF7A1A" />
        </View>
      ) : (
        <ScreenFadeIn style={{ flex: 1 }}>
          <FlatList
            data={filtered}
            keyExtractor={(c) => String(c.exercise_id)}
            contentContainerStyle={{ padding: 16, paddingTop: 8 }}
            ListEmptyComponent={
              <View className="items-center py-16">
                <BookOpen size={28} color="#d6d3d1" />
                <Text className="mt-2 text-base font-bold text-stone-400">
                  {cards.length === 0 ? 'No vocabulary tracked yet — keep learning!' : 'No matches.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => <CardRow card={item} playing={playingId === item.exercise_id} onPlay={play} />}
          />
        </ScreenFadeIn>
      )}
    </SafeAreaView>
  );
}
