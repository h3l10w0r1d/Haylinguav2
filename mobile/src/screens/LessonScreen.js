// src/screens/LessonScreen.js — a simplified lesson player (Phase 0):
// supports exactly 2 exercise kinds (char_intro, translate_mcq — see plan).
// Any other kind shows a "not supported yet" placeholder with a Skip button
// so a real lesson containing mixed kinds doesn't hard-crash the demo.
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { api } from '../lib/api';
import { useStatsStore } from '../lib/statsStore';
import CharIntro from '../exercises/kinds/CharIntro';
import TranslateMcq from '../exercises/kinds/TranslateMcq';

const SUPPORTED_KINDS = {
  char_intro: CharIntro,
  translate_mcq: TranslateMcq,
};

export default function LessonScreen({ route, navigation }) {
  const { slug } = route.params;
  const [lesson, setLesson] = useState(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const applyAttempt = useStatsStore((s) => s.applyAttempt);
  const refreshStats = useStatsStore((s) => s.refresh);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get(`/lessons/${slug}`);
        setLesson(data);
      } catch (e) {
        setError('Could not load this lesson.');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const exercises = lesson?.exercises || [];
  const current = exercises[index];

  const submitAttempt = useCallback(
    async (payload) => {
      if (!current) return null;
      try {
        const result = await api.post(`/me/exercises/${current.id}/attempt`, {
          lesson_id: lesson.id,
          answer_text: payload.answerText,
          selected_indices: payload.selectedIndices,
        });
        applyAttempt(result);
        return result;
      } catch {
        return null;
      }
    },
    [current, lesson, applyAttempt]
  );

  const advance = useCallback(async () => {
    if (index + 1 < exercises.length) {
      setIndex(index + 1);
    } else {
      // Lesson complete — mirrors the web's "Done" button (POST .../complete),
      // then bounce back to the Dashboard with fresh stats.
      try {
        await api.post(`/lessons/${slug}/complete`, {});
      } catch {
        // non-fatal — attempts already recorded progress server-side
      }
      await refreshStats();
      navigation.goBack();
    }
  }, [index, exercises.length, slug, navigation, refreshStats]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1]">
        <ActivityIndicator size="large" color="#FF7A1A" />
      </SafeAreaView>
    );
  }

  if (error || !lesson) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1] px-6">
        <Text className="text-base font-semibold text-cardinal-600">{error || 'Lesson not found.'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="mt-4 rounded-xl bg-stone-800 px-5 py-3">
          <Text className="font-bold text-white">Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const ExerciseComponent = current ? SUPPORTED_KINDS[current.kind] : null;
  const pct = exercises.length ? Math.round(((index + (ExerciseComponent ? 0 : 1)) / exercises.length) * 100) : 0;

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <TouchableOpacity onPress={() => navigation.goBack()} className="h-9 w-9 items-center justify-center rounded-full bg-stone-200">
          <X size={18} color="#57534e" />
        </TouchableOpacity>
        <View className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200">
          <View className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(pct, 4)}%` }} />
        </View>
      </View>

      <View className="flex-1 px-4 pb-4">
        {!current ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-base font-bold text-stone-600">No exercises in this lesson.</Text>
          </View>
        ) : ExerciseComponent ? (
          <ExerciseComponent key={current.id} exercise={current} onSubmit={submitAttempt} onAdvance={advance} />
        ) : (
          <View className="flex-1 justify-between">
            <View className="items-center justify-center pt-16">
              <Text className="text-center text-base font-bold text-stone-600">
                Exercise type "{current.kind}" isn't supported in this Phase 0 build yet.
              </Text>
            </View>
            <TouchableOpacity onPress={advance} className="items-center rounded-2xl bg-stone-800 py-4">
              <Text className="text-base font-extrabold text-white">Skip</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
