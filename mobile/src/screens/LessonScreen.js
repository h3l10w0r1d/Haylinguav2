// src/screens/LessonScreen.js — a simplified lesson player. Supports the
// exercise kinds ported so far; any other kind shows a "not supported yet"
// placeholder with a Skip button so a real lesson containing mixed kinds
// doesn't hard-crash the demo.
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { X } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence } from 'react-native-reanimated';
import { api } from '../lib/api';
import { useStatsStore } from '../lib/statsStore';
import { checkStreakMilestone } from '../lib/streakMilestones';
import HeartsBadge from '../components/HeartsBadge';
import ExerciseResultBanner from '../components/ExerciseResultBanner';
import Pressable3D from '../components/Pressable3D';
import CharIntro from '../exercises/kinds/CharIntro';
import TranslateMcq from '../exercises/kinds/TranslateMcq';
import LetterRecognition from '../exercises/kinds/LetterRecognition';
import SelectMissingWord from '../exercises/kinds/SelectMissingWord';
import MinimalPairs from '../exercises/kinds/MinimalPairs';
import TrueFalse from '../exercises/kinds/TrueFalse';
import MatchPairs from '../exercises/kinds/MatchPairs';
import AudioChoiceTts from '../exercises/kinds/AudioChoiceTts';
import CharBuildWord from '../exercises/kinds/CharBuildWord';
import WordBank from '../exercises/kinds/WordBank';
import SentenceOrder from '../exercises/kinds/SentenceOrder';
import Speak from '../exercises/kinds/Speak';

const SUPPORTED_KINDS = {
  char_intro: CharIntro,
  translate_mcq: TranslateMcq,
  letter_recognition: LetterRecognition,
  select_missing_word: SelectMissingWord,
  minimal_pairs: MinimalPairs,
  true_false: TrueFalse,
  match_pairs: MatchPairs,
  audio_choice_tts: AudioChoiceTts,
  char_build_word: CharBuildWord,
  word_bank: WordBank,
  sentence_order: SentenceOrder,
  speak: Speak,
};

function UnsupportedKindFallback({ kind, onAdvance }) {
  return (
    <View className="flex-1 justify-between">
      <View className="items-center justify-center pt-16">
        <Text className="text-center text-base font-bold text-stone-600">
          Exercise type "{kind}" isn't supported in this Phase 0 build yet.
        </Text>
      </View>
      <TouchableOpacity onPress={onAdvance} className="items-center rounded-2xl bg-stone-800 py-4">
        <Text className="text-base font-extrabold text-white">Skip</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function LessonScreen({ route, navigation }) {
  const { slug } = route.params;
  const [lesson, setLesson] = useState(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const applyAttempt = useStatsStore((s) => s.applyAttempt);
  const refreshStats = useStatsStore((s) => s.refresh);
  const chestEarnedRef = useRef(false);

  // Docked footer state, reported up by whichever exercise kind is mounted
  // (see onCheckStateChange contract below) — the footer itself is owned by
  // this screen now, not by each kind, so it stays fixed instead of
  // scrolling with content.
  const [checkState, setCheckState] = useState({ canCheck: false, run: null });
  const handleCheckStateChange = useCallback((next) => setCheckState(next), []);

  // The last graded attempt — while set, the docked footer hides and
  // ExerciseResultBanner takes over the bottom of the screen instead.
  const [lastResult, setLastResult] = useState(null);

  // A brief brightness flash on the progress bar each time an exercise
  // advances — mirrors the web's .progress-pulse.
  const progressFlash = useSharedValue(0);
  const pulseProgress = useCallback(() => {
    progressFlash.value = withSequence(withTiming(0.6, { duration: 120 }), withTiming(0, { duration: 300 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const progressFlashStyle = useAnimatedStyle(() => ({ opacity: progressFlash.value }));

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
        if (result?.chest_earned) chestEarnedRef.current = true;
        if (result) setLastResult(result);
        return result;
      } catch {
        return null;
      }
    },
    [current, lesson, applyAttempt]
  );

  const advance = useCallback(async () => {
    setLastResult(null);
    setCheckState({ canCheck: false, run: null });
    if (index + 1 < exercises.length) {
      setIndex(index + 1);
      pulseProgress();
    } else {
      // Lesson complete — mirrors the web's "Done" button (POST .../complete).
      // Snapshot XP/streak before completing so the celebration screen can
      // show what was actually earned this lesson (no per-lesson XP delta
      // field exists server-side — /complete returns cumulative totals only).
      const xpBefore = useStatsStore.getState().totalXp;
      try {
        await api.post(`/lessons/${slug}/complete`, {});
      } catch {
        // non-fatal — attempts already recorded progress server-side
      }
      await refreshStats();
      const after = useStatsStore.getState();
      const xpEarned = Math.max(0, (after.totalXp ?? 0) - (xpBefore ?? 0));
      const milestoneHit = await checkStreakMilestone(after.streak ?? 0);
      navigation.replace('LessonComplete', {
        xpEarned,
        streak: after.streak ?? 0,
        milestoneHit,
        chestEarned: chestEarnedRef.current,
      });
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
        <View className="h-3.5 flex-1 overflow-hidden rounded-full bg-stone-200">
          <View className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(pct, 4)}%` }}>
            <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff' }, progressFlashStyle]} />
          </View>
        </View>
        <HeartsBadge />
      </View>

      <View className="flex-1 px-4 pb-4">
        {!current ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-base font-bold text-stone-600">No exercises in this lesson.</Text>
          </View>
        ) : ExerciseComponent ? (
          <ExerciseComponent
            key={current.id}
            exercise={current}
            onSubmit={submitAttempt}
            onAdvance={advance}
            onCheckStateChange={handleCheckStateChange}
          />
        ) : (
          <UnsupportedKindFallback key={current.id} kind={current.kind} onAdvance={advance} />
        )}
      </View>

      {/* Docked footer — fixed, owned by this screen (not each exercise
          kind) so it never scrolls with content. Hides once an attempt is
          graded, handing off to ExerciseResultBanner below. */}
      {!lastResult && checkState.run ? (
        <View className="px-4 pb-4">
          <Pressable3D
            onPress={checkState.run}
            disabled={!checkState.canCheck}
            className={'items-center rounded-2xl py-4 ' + (checkState.canCheck ? 'bg-brand-500' : 'bg-stone-300')}
          >
            <Text className="text-base font-extrabold text-white">Check</Text>
          </Pressable3D>
        </View>
      ) : null}

      <ExerciseResultBanner
        visible={!!lastResult}
        correct={!!lastResult?.is_correct}
        xpEarned={lastResult?.earned_xp_delta || 0}
        onContinue={advance}
      />
    </SafeAreaView>
  );
}
