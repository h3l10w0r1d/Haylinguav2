// src/screens/CheckpointScreen.js — ports the web's CheckpointPlayer.jsx.
// Plays through GET /me/checkpoint's exercise queue for one chapter, then
// shows a pass/fail completion screen based on FIRST-ATTEMPT-ONLY accuracy
// (retries don't inflate the score — mirrors web's firstAttemptCorrect
// tracking), not the generic LessonCompleteScreen.
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Shield } from 'lucide-react-native';
import { api } from '../lib/api';
import { useExerciseQueueSession } from '../lib/useExerciseQueueSession';
import { SUPPORTED_KINDS, UnsupportedKindFallback } from '../exercises/kindRegistry';
import HeartsBadge from '../components/HeartsBadge';
import ExerciseResultBanner from '../components/ExerciseResultBanner';
import CheckButton from '../components/CheckButton';
import Pressable3D from '../components/Pressable3D';

const PASS_THRESHOLD = 0.7;

export default function CheckpointScreen({ route, navigation }) {
  const { lessonIds = [], chapterTitle = 'Checkpoint' } = route.params || {};
  const [exercises, setExercises] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get(`/me/checkpoint?lesson_ids=${lessonIds.join(',')}&count=15`);
        setExercises(Array.isArray(data?.exercises) ? data.exercises : []);
      } catch {
        setError('Could not load the checkpoint.');
      }
    })();
  }, [lessonIds]);

  const session = useExerciseQueueSession(exercises || []);
  const { current, total, index, checkState, onCheckStateChange, submitAttempt, advance, done, lastResult, lastAnswerText, combo, summary } = session;

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

  if (exercises === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1]">
        <ActivityIndicator size="large" color="#FF7A1A" />
      </SafeAreaView>
    );
  }

  if (done) {
    const accuracy = summary.totalOriginal > 0 ? summary.correctFirstAttempt / summary.totalOriginal : 0;
    const passed = accuracy >= PASS_THRESHOLD;
    return (
      <SafeAreaView className="flex-1 bg-[#f5f4f1]">
        <View className="flex-1 items-center justify-center px-8">
          <View className={'h-24 w-24 items-center justify-center rounded-full ' + (passed ? 'bg-grass-50' : 'bg-cardinal-50')}>
            <Shield size={48} color={passed ? '#58CC02' : '#FF4B4B'} />
          </View>
          <Text className="mt-5 text-center text-2xl font-extrabold text-stone-900 font-display">
            {passed ? 'Checkpoint passed!' : 'Keep practicing'}
          </Text>
          <Text className="mt-2 text-center text-base font-semibold text-stone-500">
            {passed ? `You cleared the ${chapterTitle} checkpoint.` : "You're not quite there yet — try again."}
          </Text>
          <View className="mt-8 w-full flex-row gap-4">
            <View className="flex-1 items-center rounded-2xl bg-white px-4 py-5" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
              <Text className="text-2xl font-extrabold text-stone-900 font-display">{Math.round(accuracy * 100)}%</Text>
              <Text className="mt-1 text-xs font-bold uppercase tracking-wide text-stone-400">Correct</Text>
            </View>
            <View className="flex-1 items-center rounded-2xl bg-white px-4 py-5" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
              <Text className="text-2xl font-extrabold text-brand-600 font-display">+{summary.xpEarned}</Text>
              <Text className="mt-1 text-xs font-bold uppercase tracking-wide text-stone-400">XP earned</Text>
            </View>
          </View>
        </View>
        <View className="flex-row gap-3 px-6 pb-6">
          {!passed && (
            <View className="flex-1">
              <Pressable3D onPress={() => navigation.replace('Checkpoint', route.params)} className="items-center rounded-2xl bg-stone-200 py-4">
                <Text className="text-base font-extrabold text-stone-700">Retry</Text>
              </Pressable3D>
            </View>
          )}
          <View className="flex-1">
            <Pressable3D onPress={() => navigation.goBack()} className="items-center rounded-2xl bg-brand-500 py-4">
              <Text className="text-base font-extrabold text-white">Continue</Text>
            </Pressable3D>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const ExerciseComponent = current ? SUPPORTED_KINDS[current.kind] : null;

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <Pressable3D onPress={() => navigation.goBack()} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-stone-200">
          <X size={18} color="#57534e" />
        </Pressable3D>
        <View className="h-3.5 flex-1 flex-row" style={{ gap: 4 }}>
          {Array.from({ length: total }).map((_, i) => (
            <View key={i} className={'h-full flex-1 overflow-hidden rounded-full ' + (i < index ? 'bg-brand-500' : 'bg-stone-200')} />
          ))}
        </View>
        <HeartsBadge />
      </View>

      <View className="flex-1 px-4 pb-4">
        {!current ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-base font-bold text-stone-600">Nothing to check yet — complete this chapter's lessons first.</Text>
          </View>
        ) : ExerciseComponent ? (
          <ExerciseComponent key={current.id} exercise={current} onSubmit={submitAttempt} onAdvance={advance} onCheckStateChange={onCheckStateChange} />
        ) : (
          <UnsupportedKindFallback key={current.id} kind={current.kind} onAdvance={advance} />
        )}
      </View>

      <CheckButton visible={!lastResult && !!checkState.run} canCheck={checkState.canCheck} onPress={checkState.run} />

      <ExerciseResultBanner
        visible={!!lastResult}
        correct={!!lastResult?.is_correct}
        xpEarned={lastResult?.earned_xp_delta || 0}
        combo={combo}
        comboBonusXp={lastResult?.combo_bonus_xp || 0}
        exerciseId={current?.id}
        userAnswer={lastAnswerText}
        correctAnswer={lastResult?.correct_answer}
        onContinue={advance}
      />
    </SafeAreaView>
  );
}
