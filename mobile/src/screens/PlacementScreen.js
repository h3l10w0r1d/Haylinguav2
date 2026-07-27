// src/screens/PlacementScreen.js — ports the web's PlacementTest.jsx: an
// adaptive binary-search placement test. Groups lessons into "units"
// (chapters, or bare levels for chapterless lessons), then bisects across
// them — each round samples 3 exercises from GET /me/checkpoint for the
// midpoint unit; passing >=2/3 moves the search up, failing moves it down.
// Converges within 5 rounds (or when the range collapses) to a placement
// index, then POSTs /me/placement to mark everything before it as done
// (0 XP, no hearts lost) so the learner starts at the right spot.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Target, ArrowRight, CheckCircle } from 'lucide-react-native';
import { api } from '../lib/api';
import { SUPPORTED_KINDS, UnsupportedKindFallback } from '../exercises/kindRegistry';
import HeartsBadge from '../components/HeartsBadge';
import ExerciseResultBanner from '../components/ExerciseResultBanner';
import CheckButton from '../components/CheckButton';
import Pressable3D from '../components/Pressable3D';

const MAX_ROUNDS = 5;
const EXERCISES_PER_ROUND = 3;
const PASS_THRESHOLD = 2; // out of 3

export default function PlacementScreen({ navigation }) {
  const [phase, setPhase] = useState('loading-units'); // loading-units | loading-round | testing | done
  const [loadError, setLoadError] = useState('');
  const [units, setUnits] = useState(null);
  const [currentUnitIdx, setCurrentUnitIdx] = useState(null);
  const [round, setRound] = useState(0);
  const [history, setHistory] = useState([]);
  const [placementLow, setPlacementLow] = useState(0);
  const [saving, setSaving] = useState(false);

  const [exercises, setExercises] = useState([]);
  const [queueIdx, setQueueIdx] = useState(0);
  const [checkState, setCheckState] = useState({ canCheck: false, run: null });
  const [lastResult, setLastResult] = useState(null);
  const [lastAnswerText, setLastAnswerText] = useState('');

  const bisectRef = useRef({ low: 0, high: 0 });
  const emptySkipCountRef = useRef(0);
  const roundCorrectRef = useRef(0);

  const startRound = useCallback(async (unitsList, low, high, roundNum) => {
    if (roundNum >= MAX_ROUNDS || low > high) {
      setPlacementLow(Math.min(low, unitsList.length - 1));
      setPhase('done');
      return;
    }

    const mid = Math.floor((low + high) / 2);
    bisectRef.current = { low, high };
    roundCorrectRef.current = 0;
    setCurrentUnitIdx(mid);
    setPhase('loading-round');
    setQueueIdx(0);
    setLastResult(null);
    setCheckState({ canCheck: false, run: null });

    const unit = unitsList[mid];
    const lessonIds = unit.items.map((l) => l.id).filter((id) => id != null).join(',');

    if (!lessonIds) {
      setHistory((h) => [...h, { unitTitle: unit.title, passed: null }]);
      emptySkipCountRef.current += 1;
      if (emptySkipCountRef.current > 5) {
        setPlacementLow(Math.min(mid, unitsList.length - 1));
        setPhase('done');
        return;
      }
      setRound(roundNum + 1);
      startRound(unitsList, mid + 1, high, roundNum + 1);
      return;
    }
    emptySkipCountRef.current = 0;

    try {
      const data = await api.get(`/me/checkpoint?lesson_ids=${encodeURIComponent(lessonIds)}&count=${EXERCISES_PER_ROUND}`);
      const exs = (data?.exercises || []).slice(0, EXERCISES_PER_ROUND);
      if (exs.length === 0) {
        setHistory((h) => [...h, { unitTitle: unit.title, passed: null }]);
        setRound(roundNum + 1);
        startRound(unitsList, low, mid - 1, roundNum + 1);
        return;
      }
      setExercises(exs);
      setRound(roundNum);
      setPhase('testing');
    } catch {
      setLoadError('Network error loading exercises. Please try again.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const lessons = await api.get('/me/lessons/progress');
        const groups = new Map();
        (Array.isArray(lessons) ? lessons : []).forEach((l) => {
          const hasChapter = l.chapter_id != null;
          const key = hasChapter ? `c${l.chapter_id}` : `l${Number(l.level ?? 1)}`;
          if (!groups.has(key)) {
            groups.set(key, {
              key,
              title: hasChapter ? l.chapter_title || 'Chapter' : `Chapter ${Number(l.level ?? 1)}`,
              position: hasChapter ? Number(l.chapter_position ?? 9999) : Number(l.level ?? 1),
              items: [],
            });
          }
          groups.get(key).items.push(l);
        });
        const sorted = [...groups.values()].sort((a, b) => a.position - b.position);
        if (sorted.length < 2) {
          navigation.goBack();
          return;
        }
        bisectRef.current = { low: 0, high: sorted.length - 1 };
        setUnits(sorted);
        startRound(sorted, 0, sorted.length - 1, 0);
      } catch (e) {
        setLoadError('Could not load your lessons.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = exercises[queueIdx];
  const onCheckStateChange = useCallback((next) => setCheckState(next), []);

  const proceedAfterResult = useCallback(() => {
    const isLastExercise = queueIdx >= exercises.length - 1;
    setLastResult(null);
    setCheckState({ canCheck: false, run: null });

    if (!isLastExercise) {
      setQueueIdx((i) => i + 1);
      return;
    }

    const correct = roundCorrectRef.current;
    const passed = correct >= PASS_THRESHOLD;
    const { low, high } = bisectRef.current;
    const mid = Math.floor((low + high) / 2);
    const unitTitle = units[mid]?.title ?? '';
    setHistory((h) => [...h, { unitTitle, passed }]);

    const nextRound = round + 1;
    startRound(units, passed ? mid + 1 : low, passed ? high : mid - 1, nextRound);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueIdx, exercises.length, round, units, startRound]);

  const submitAttempt = useCallback(
    async (payload) => {
      if (!current) return null;
      if (payload.isCorrect) roundCorrectRef.current += 1;
      setLastAnswerText(payload.answerText ?? '');
      try {
        const result = await api.post(`/me/exercises/${current.id}/attempt`, {
          lesson_id: current.lesson_id,
          answer_text: payload.answerText,
          selected_indices: payload.selectedIndices,
        });
        setLastResult(result || { is_correct: !!payload.isCorrect });
        return result;
      } catch {
        setLastResult({ is_correct: !!payload.isCorrect });
        return null;
      }
    },
    [current]
  );

  async function confirmPlacement() {
    setSaving(true);
    const placementIdx = Math.min(placementLow, units.length - 1);
    const lessonIds = units.slice(0, placementIdx).flatMap((u) => u.items.map((l) => l.id).filter((id) => id != null));
    if (lessonIds.length > 0) {
      try {
        await api.post('/me/placement', { lesson_ids: lessonIds });
      } catch {
        // non-fatal — worst case the learner just sees the full path
      }
    }
    navigation.goBack();
  }

  if (loadError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1] px-6">
        <Text className="text-center text-base font-semibold text-cardinal-600">{loadError}</Text>
        <Pressable3D onPress={() => navigation.goBack()} className="mt-4 rounded-xl bg-stone-800 px-5 py-3">
          <Text className="font-bold text-white">Skip test</Text>
        </Pressable3D>
      </SafeAreaView>
    );
  }

  if (phase === 'loading-units' || phase === 'loading-round') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1] px-8">
        <ActivityIndicator size="large" color="#FF7A1A" />
        {phase === 'loading-round' && units?.[currentUnitIdx] && (
          <Text className="mt-4 text-center text-sm font-bold text-stone-500">{`Checking ${units[currentUnitIdx].title}…`}</Text>
        )}
      </SafeAreaView>
    );
  }

  if (phase === 'done') {
    const placementIdx = Math.min(placementLow, units.length - 1);
    const placementUnit = units[placementIdx];
    const isBeginning = placementLow === 0;
    const isEnd = placementLow >= units.length;
    const visibleHistory = history.filter((h) => h.passed !== null);

    return (
      <SafeAreaView className="flex-1 bg-[#f5f4f1]">
        <View className="flex-1 items-center justify-center px-8">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-brand-100">
            <Target size={40} color="#C2410C" />
          </View>
          <Text className="mt-5 text-center text-2xl font-extrabold text-stone-900 font-display">Level found!</Text>
          <Text className="mt-2 text-center text-base font-semibold text-stone-500">
            {isBeginning
              ? 'Start from the very beginning — welcome!'
              : isEnd
              ? "Impressive! You'll start from the most advanced unit."
              : "We'll place you at:"}
          </Text>

          {!isBeginning && !isEnd && placementUnit && (
            <View className="mt-3 items-center rounded-2xl bg-white px-6 py-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
              <Text className="text-xl font-extrabold text-brand-700 font-display">{placementUnit.title}</Text>
              <Text className="mt-1 text-sm font-semibold text-stone-500">{`Unit ${placementIdx + 1} of ${units.length}`}</Text>
            </View>
          )}

          {visibleHistory.length > 0 && (
            <View className="mt-6 w-full" style={{ gap: 8 }}>
              {visibleHistory.map((h, i) => (
                <View key={i} className="flex-row items-center gap-3 rounded-xl bg-white px-4 py-2.5">
                  <CheckCircle size={16} color={h.passed ? '#58CC02' : '#d6d3d1'} />
                  <Text className="flex-1 text-sm font-semibold text-stone-700" numberOfLines={1}>{h.unitTitle}</Text>
                  <Text className={'text-xs font-bold ' + (h.passed ? 'text-grass-600' : 'text-stone-400')}>
                    {h.passed ? 'Passed' : 'Too hard'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View className="flex-row gap-3 px-6 pb-6">
          <View className="flex-1">
            <Pressable3D onPress={() => navigation.goBack()} disabled={saving} className="items-center rounded-2xl bg-stone-200 py-4">
              <Text className="text-base font-extrabold text-stone-700">Skip</Text>
            </Pressable3D>
          </View>
          <View className="flex-1">
            <Pressable3D
              onPress={confirmPlacement}
              disabled={saving}
              className="flex-row items-center justify-center gap-2 rounded-2xl py-4"
              style={{ backgroundColor: '#FF7A1A', borderBottomWidth: 4, borderBottomColor: '#C2410C' }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text className="text-base font-extrabold text-white">Start here</Text>
                  <ArrowRight size={16} color="#fff" />
                </>
              )}
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
        <Text className="flex-1 text-sm font-extrabold text-stone-500">{`Placement · Round ${round + 1} of ${MAX_ROUNDS}`}</Text>
        <HeartsBadge />
      </View>

      <View className="flex-1 px-4 pb-4">
        <View className="mb-4 flex-row items-center gap-2 rounded-xl bg-brand-50 px-4 py-2.5">
          <Target size={16} color="#FF7A1A" />
          <Text className="flex-1 text-sm font-extrabold text-brand-700" numberOfLines={1}>{`Testing: ${units[currentUnitIdx]?.title ?? ''}`}</Text>
          <Text className="text-xs font-bold text-brand-400">{`${queueIdx + 1}/${exercises.length}`}</Text>
        </View>

        {ExerciseComponent ? (
          <ExerciseComponent key={current.id} exercise={current} onSubmit={submitAttempt} onAdvance={proceedAfterResult} onCheckStateChange={onCheckStateChange} />
        ) : current ? (
          <UnsupportedKindFallback kind={current.kind} onAdvance={proceedAfterResult} />
        ) : null}
      </View>

      <CheckButton visible={!lastResult && !!checkState.run} canCheck={checkState.canCheck} onPress={checkState.run} />

      <ExerciseResultBanner
        visible={!!lastResult}
        correct={!!lastResult?.is_correct}
        xpEarned={0}
        exerciseId={current?.id}
        userAnswer={lastAnswerText}
        correctAnswer={lastResult?.correct_answer}
        onContinue={proceedAfterResult}
      />
    </SafeAreaView>
  );
}
