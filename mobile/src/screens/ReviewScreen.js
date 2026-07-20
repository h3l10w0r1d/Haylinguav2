// src/screens/ReviewScreen.js — ports the web's ReviewMode.jsx. Intentionally
// NOT using useExerciseQueueSession/SUPPORTED_KINDS — a genuinely simpler
// flashcard flow (reveal → 4-quality-buttons → advance), not a full exercise
// player. GET /me/review?limit=20 → SM-2 cards; POST /me/review/submit
// {exercise_id, quality: 1|3|4|5} advances the card's spaced-repetition state.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Volume2, CheckCircle } from 'lucide-react-native';
import Sound from 'react-native-nitro-sound';
import { api } from '../lib/api';
import Pressable3D from '../components/Pressable3D';
import { haptics } from '../lib/haptics';

const QUALITY = [
  { value: 1, label: 'Again', text: 'Forgot it', bg: '#EF4444' },
  { value: 3, label: 'Hard', text: 'Struggled', bg: '#F59E0B' },
  { value: 4, label: 'Good', text: 'Got it', bg: '#10B981' },
  { value: 5, label: 'Easy', text: 'Perfect', bg: '#3B82F6' },
];

function parseConfig(raw) {
  if (raw && typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function AudioButton({ src }) {
  if (!src) return null;
  return (
    <Pressable3D
      onPress={() => {
        try {
          Sound.startPlayer(src).catch(() => {});
        } catch {
          // no-op
        }
      }}
      pressDepth={2}
      className="flex-row items-center gap-1.5 self-center rounded-xl bg-brand-100 px-3 py-1.5"
    >
      <Volume2 size={14} color="#7A4A00" />
      <Text className="text-sm font-semibold text-brand-700">Play audio</Text>
    </Pressable3D>
  );
}

function CardView({ card, revealed }) {
  const cfg = parseConfig(card.config);
  const kind = card.kind;

  if (kind === 'flashcard') {
    return (
      <View className="items-center">
        <Text className="text-xs font-bold uppercase tracking-widest text-stone-400">Flashcard</Text>
        <Text className="mt-3 text-center text-2xl font-extrabold text-stone-900 font-display">{cfg.front || card.prompt}</Text>
        {revealed && (
          <View className="mt-4 rounded-2xl bg-grass-50 px-6 py-4">
            <Text className="text-center text-xl font-bold text-grass-700">{cfg.back || card.expected_answer}</Text>
          </View>
        )}
      </View>
    );
  }

  if (kind === 'translate' || kind === 'listen_type' || kind === 'listen_type_am') {
    const listening = kind.startsWith('listen');
    return (
      <View className="items-center">
        <Text className="text-xs font-bold uppercase tracking-widest text-stone-400">{listening ? 'Listen & translate' : 'Translate'}</Text>
        {!!cfg.audio_url && <View className="mt-3"><AudioButton src={cfg.audio_url} /></View>}
        {!listening && <Text className="mt-3 text-center text-2xl font-extrabold text-stone-900 font-display">{card.prompt}</Text>}
        {revealed && (
          <View className="mt-4 rounded-2xl bg-grass-50 px-6 py-4">
            <Text className="mb-1 text-center text-sm font-semibold text-stone-500">Correct answer</Text>
            <Text className="text-center text-xl font-bold text-grass-700">{card.expected_answer}</Text>
          </View>
        )}
      </View>
    );
  }

  const correctOpt = (card.options || []).find((o) => o.is_correct);
  return (
    <View className="items-center">
      <Text className="text-xs font-bold uppercase tracking-widest text-stone-400">{card.lesson_title || 'Review'}</Text>
      {!!cfg.audio_url && <View className="mt-3"><AudioButton src={cfg.audio_url} /></View>}
      <Text className="mt-3 text-center text-2xl font-extrabold text-stone-900 font-display">{card.prompt}</Text>
      {revealed && correctOpt && (
        <View className="mt-4 rounded-2xl bg-grass-50 px-6 py-4">
          <Text className="mb-1 text-center text-sm font-semibold text-stone-500">Correct answer</Text>
          <Text className="text-center text-xl font-bold text-grass-700">{correctOpt.text}</Text>
        </View>
      )}
    </View>
  );
}

export default function ReviewScreen({ navigation }) {
  const [cards, setCards] = useState(null);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get('/me/review?limit=20');
        const list = Array.isArray(data?.cards) ? data.cards : [];
        setCards(list);
        if (!list.length) setDone(true);
      } catch {
        setError('Could not load your review session.');
      }
    })();
  }, []);

  const handleQuality = useCallback(
    async (quality) => {
      if (submitting || !cards?.[idx]) return;
      setSubmitting(true);
      if (quality >= 4) haptics.success();
      try {
        await api.post('/me/review/submit', { exercise_id: cards[idx].id, quality });
      } catch {
        // swallow — card still advances
      }
      setReviewed((r) => r + 1);
      const nextIdx = idx + 1;
      if (nextIdx >= cards.length) {
        setDone(true);
      } else {
        setIdx(nextIdx);
        setRevealed(false);
      }
      setSubmitting(false);
    },
    [submitting, cards, idx]
  );

  if (error) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1] px-6">
        <Text className="text-base font-semibold text-cardinal-600">{error}</Text>
        <Pressable3D onPress={() => navigation.goBack()} className="mt-4 rounded-xl bg-stone-800 px-5 py-3">
          <Text className="font-bold text-white">Go back</Text>
        </Pressable3D>
      </SafeAreaView>
    );
  }

  if (cards === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1]">
        <ActivityIndicator size="large" color="#FF7A1A" />
      </SafeAreaView>
    );
  }

  if (done) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1] px-8">
        <CheckCircle size={52} color="#58CC02" strokeWidth={1.5} />
        <Text className="mt-4 text-center text-2xl font-extrabold text-stone-900 font-display">Session complete!</Text>
        <Text className="mt-2 text-center text-base font-semibold text-stone-500">
          You reviewed <Text className="font-extrabold text-stone-700">{reviewed}</Text> {reviewed === 1 ? 'card' : 'cards'}.
        </Text>
        <Text className="mt-1 text-center text-sm text-stone-400">Cards will return based on how well you knew them.</Text>
        <Pressable3D onPress={() => navigation.goBack()} className="mt-7 items-center self-stretch rounded-2xl bg-brand-500 py-4">
          <Text className="text-base font-extrabold text-white">Back to dashboard</Text>
        </Pressable3D>
      </SafeAreaView>
    );
  }

  const card = cards[idx];

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <Pressable3D onPress={() => navigation.goBack()} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-stone-200">
          <ChevronLeft size={20} color="#57534e" />
        </Pressable3D>
        <View className="h-3 flex-1 overflow-hidden rounded-full bg-stone-200">
          <View className="h-full rounded-full bg-brand-500" style={{ width: `${(idx / cards.length) * 100}%` }} />
        </View>
        <Text className="text-sm font-bold tabular-nums text-stone-500">{idx + 1} / {cards.length}</Text>
      </View>

      <View className="flex-1 justify-center px-4 pb-8">
        <View className="min-h-[220px] items-center justify-center rounded-3xl bg-white px-6 py-10" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
          <CardView card={card} revealed={revealed} />
        </View>

        <View className="mt-6">
          {!revealed ? (
            <Pressable3D onPress={() => setRevealed(true)} className="items-center rounded-2xl bg-brand-500 py-4">
              <Text className="text-base font-extrabold text-white">Reveal answer</Text>
            </Pressable3D>
          ) : (
            <View className="flex-row flex-wrap justify-between" style={{ gap: 8 }}>
              {QUALITY.map((q) => (
                <View key={q.value} style={{ width: '47%' }}>
                  <Pressable3D
                    onPress={() => handleQuality(q.value)}
                    disabled={submitting}
                    className="items-center rounded-2xl py-3"
                    style={{ backgroundColor: q.bg }}
                  >
                    <Text className="text-sm font-extrabold text-white">{q.label}</Text>
                    <Text className="mt-0.5 text-[10px] font-semibold text-white/80">{q.text}</Text>
                  </Pressable3D>
                </View>
              ))}
            </View>
          )}
        </View>

        {revealed && (
          <Text className="mt-3 text-center text-xs text-stone-400">
            Rate how well you remembered — this adjusts when you'll see it next.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
