// src/screens/PracticeScreen.js — ports the web's PracticeMode.jsx. GET
// /me/practice already returns a prioritized due-review + weak-exercise
// queue, so unlike Checkpoint this has no lesson picker — a single always-
// available action. No pass/fail concept; completion reuses
// LessonCompleteScreen's visual language (xpEarned tally).
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Dumbbell, Zap } from 'lucide-react-native';
import { api } from '../lib/api';
import { useExerciseQueueSession } from '../lib/useExerciseQueueSession';
import { SUPPORTED_KINDS, UnsupportedKindFallback } from '../exercises/kindRegistry';
import HeartsBadge from '../components/HeartsBadge';
import ExerciseResultBanner from '../components/ExerciseResultBanner';
import Pressable3D from '../components/Pressable3D';

export default function PracticeScreen({ navigation }) {
  const [exercises, setExercises] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get('/me/practice');
        setExercises(Array.isArray(data?.exercises) ? data.exercises : []);
      } catch {
        setError('Could not load practice.');
      }
    })();
  }, []);

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

  if (exercises.length === 0) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1] px-8">
        <View className="h-24 w-24 items-center justify-center rounded-full bg-grass-50">
          <Dumbbell size={48} color="#58CC02" />
        </View>
        <Text className="mt-5 text-center text-2xl font-extrabold text-stone-900 font-display">All caught up!</Text>
        <Text className="mt-2 text-center text-base font-semibold text-stone-500">Nothing to practice right now — come back later.</Text>
        <Pressable3D onPress={() => navigation.goBack()} className="mt-8 items-center self-stretch rounded-2xl bg-brand-500 py-4">
          <Text className="text-base font-extrabold text-white">Back</Text>
        </Pressable3D>
      </SafeAreaView>
    );
  }

  if (done) {
    return (
      <SafeAreaView className="flex-1 bg-[#f5f4f1]">
        <View className="flex-1 items-center justify-center px-8">
          <View className="h-24 w-24 items-center justify-center rounded-full bg-grass-50">
            <Zap size={48} color="#58CC02" />
          </View>
          <Text className="mt-5 text-center text-2xl font-extrabold text-stone-900 font-display">Great practice!</Text>
          <View className="mt-8 w-full flex-row gap-4">
            <View className="flex-1 items-center rounded-2xl bg-white px-4 py-5" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
              <Text className="text-2xl font-extrabold text-brand-600 font-display">+{summary.xpEarned}</Text>
              <Text className="mt-1 text-xs font-bold uppercase tracking-wide text-stone-400">XP earned</Text>
            </View>
            <View className="flex-1 items-center rounded-2xl bg-white px-4 py-5" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
              <Text className="text-2xl font-extrabold text-stone-900 font-display">{summary.correctFirstAttempt}/{summary.totalOriginal}</Text>
              <Text className="mt-1 text-xs font-bold uppercase tracking-wide text-stone-400">Correct</Text>
            </View>
          </View>
        </View>
        <View className="px-6 pb-6">
          <Pressable3D onPress={() => navigation.goBack()} className="items-center rounded-2xl bg-brand-500 py-4">
            <Text className="text-base font-extrabold text-white">Continue</Text>
          </Pressable3D>
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
        {ExerciseComponent ? (
          <ExerciseComponent key={current.id} exercise={current} onSubmit={submitAttempt} onAdvance={advance} onCheckStateChange={onCheckStateChange} />
        ) : (
          <UnsupportedKindFallback key={current.id} kind={current.kind} onAdvance={advance} />
        )}
      </View>

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
        combo={combo}
        comboBonusXp={lastResult?.combo_bonus_xp || 0}
        exerciseId={current?.id}
        userAnswer={lastAnswerText}
        onContinue={advance}
      />
    </SafeAreaView>
  );
}
