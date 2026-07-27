// src/screens/AssessmentScreen.js — ports the web's AssessmentPlayer.jsx: the
// CEFR level-up test. Offered once every lesson in a level is done
// (GET /me/levels' assessment_ready), samples ~20 exercises from across the
// whole level (GET /me/assessment/{level}), and — crucially — does NOT touch
// hearts or spaced-repetition state: grading is purely local (each exercise
// kind already computes isCorrect itself), never POSTed to
// /me/exercises/{id}/attempt. Only the final tally goes to the backend via
// POST /me/assessment/{level}/submit, which unlocks the next level on a pass.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ShieldCheck, Trophy, RotateCcw, Lock } from 'lucide-react-native';
import { api, ApiError } from '../lib/api';
import { SUPPORTED_KINDS, UnsupportedKindFallback } from '../exercises/kindRegistry';
import ExerciseResultBanner from '../components/ExerciseResultBanner';
import CheckButton from '../components/CheckButton';
import Pressable3D from '../components/Pressable3D';

const LEVEL_NAMES = { A0: 'Foundations', A1: 'Beginner', A2: 'Elementary', B1: 'Intermediate', B2: 'Upper-Intermediate' };

function deriveCorrectAnswer(exercise) {
  if (!exercise) return null;
  if (exercise.expected_answer) return String(exercise.expected_answer);
  return (exercise.options || []).find((o) => o.is_correct)?.text ?? null;
}

export default function AssessmentScreen({ route, navigation }) {
  const level = String(route.params?.level || '').toUpperCase();

  const [phase, setPhase] = useState('loading'); // loading | intro | test | submitting | done | error
  const [error, setError] = useState('');
  const [exercises, setExercises] = useState([]);
  const [passMark, setPassMark] = useState(80);
  const [idx, setIdx] = useState(0);
  const [checkState, setCheckState] = useState({ canCheck: false, run: null });
  const [lastResult, setLastResult] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const correctRef = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get(`/me/assessment/${level}`);
        if (!Array.isArray(data?.exercises) || data.exercises.length === 0) {
          setError("This test isn't ready yet — finish the level's lessons first.");
          setPhase('error');
          return;
        }
        setExercises(data.exercises);
        if (Number.isFinite(data.pass_mark)) setPassMark(data.pass_mark);
        setPhase('intro');
      } catch (e) {
        if (e instanceof ApiError && e.status === 403) {
          setError('Verify your email address before taking a level test. Check your inbox for the confirmation link.');
        } else {
          setError("This test isn't ready yet — finish the level's lessons first.");
        }
        setPhase('error');
      }
    })();
  }, [level]);

  const current = exercises[idx];
  const onCheckStateChange = useCallback((next) => setCheckState(next), []);

  const submitTest = useCallback(async () => {
    setPhase('submitting');
    const total = exercises.length;
    const correct = correctRef.current;
    try {
      const data = await api.post(`/me/assessment/${level}/submit`, { correct, total });
      setOutcome(data);
    } catch {
      const score = Math.round((correct * 100) / Math.max(1, total));
      setOutcome({ level, score, best_score: score, passed: score >= passMark, pass_mark: passMark, next_level: null, next_unlocked: false });
    }
    setPhase('done');
  }, [exercises.length, level, passMark]);

  const advance = useCallback(() => {
    setLastResult(null);
    setCheckState({ canCheck: false, run: null });
    if (idx + 1 >= exercises.length) {
      submitTest();
    } else {
      setIdx((i) => i + 1);
    }
  }, [idx, exercises.length, submitTest]);

  const submitAttempt = useCallback(
    (payload) => {
      if (payload.isCorrect) correctRef.current += 1;
      const fake = {
        is_correct: !!payload.isCorrect,
        correct_answer: payload.isCorrect ? null : deriveCorrectAnswer(current),
      };
      setLastResult(fake);
      return fake;
    },
    [current]
  );

  function startTest() {
    correctRef.current = 0;
    setIdx(0);
    setOutcome(null);
    setPhase('test');
  }

  if (phase === 'loading' || phase === 'submitting') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1]">
        <ActivityIndicator size="large" color="#FF7A1A" />
        {phase === 'submitting' && <Text className="mt-3 text-sm font-bold text-stone-400">Scoring your test…</Text>}
      </SafeAreaView>
    );
  }

  if (phase === 'error') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1] px-8">
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-stone-100">
          <Lock size={32} color="#a8a29e" />
        </View>
        <Text className="mt-4 text-center text-xl font-extrabold text-stone-900 font-display">{`${level} test`}</Text>
        <Text className="mt-2 text-center text-sm font-semibold text-stone-500">{error}</Text>
        <Pressable3D
          onPress={() => navigation.goBack()}
          className="mt-6 items-center self-stretch rounded-2xl py-4"
          style={{ backgroundColor: '#FF7A1A', borderBottomWidth: 4, borderBottomColor: '#C2410C' }}
        >
          <Text className="text-base font-extrabold uppercase text-white">Back to lessons</Text>
        </Pressable3D>
      </SafeAreaView>
    );
  }

  if (phase === 'intro') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1] px-8">
        <View className="h-20 w-20 items-center justify-center rounded-3xl bg-brand-500">
          <ShieldCheck size={40} color="#fff" />
        </View>
        <Text className="mt-4 text-xs font-extrabold uppercase tracking-wide text-brand-500">{`${LEVEL_NAMES[level] || level} checkpoint`}</Text>
        <Text className="mt-1 text-center text-2xl font-extrabold text-stone-900 font-display">{`The ${level} test`}</Text>
        <Text className="mt-3 text-center text-sm font-semibold text-stone-500">
          {exercises.length} questions from everything you've learned. Score{' '}
          <Text className="font-extrabold text-stone-700">{passMark}%</Text> or higher to unlock the next level. It
          won't cost you any hearts.
        </Text>
        <Pressable3D
          onPress={startTest}
          className="mt-7 items-center self-stretch rounded-2xl py-4"
          style={{ backgroundColor: '#FF7A1A', borderBottomWidth: 4, borderBottomColor: '#C2410C' }}
        >
          <Text className="text-base font-extrabold uppercase text-white">Start the test</Text>
        </Pressable3D>
        <Pressable3D onPress={() => navigation.goBack()} hapticOnPress={false} className="mt-3 py-2">
          <Text className="text-sm font-extrabold uppercase tracking-wide text-stone-400">Not now</Text>
        </Pressable3D>
      </SafeAreaView>
    );
  }

  if (phase === 'done' && outcome) {
    const passed = !!outcome.passed;
    const score = Number(outcome.score ?? 0);
    const nextLevel = outcome.next_level;
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1] px-8">
        <View className={'h-24 w-24 items-center justify-center rounded-full ' + (passed ? 'bg-grass-500' : 'bg-stone-200')}>
          {passed ? <Trophy size={48} color="#fff" /> : <RotateCcw size={48} color="#a8a29e" />}
        </View>
        <Text className="mt-4 text-center text-2xl font-extrabold text-stone-900 font-display">
          {passed ? 'You passed! 🎉' : 'Almost there'}
        </Text>
        <Text className="mt-2 text-center text-5xl font-extrabold text-brand-500 font-display">{`${score}%`}</Text>
        <Text className="mt-2 text-center text-sm font-semibold text-stone-500">
          {passed
            ? outcome.next_unlocked && nextLevel
              ? `${LEVEL_NAMES[nextLevel] || nextLevel} (${nextLevel}) is now unlocked.`
              : 'Level cleared.'
            : `You need ${outcome.pass_mark ?? passMark}% to pass. Review the lessons and try again.`}
        </Text>

        {passed ? (
          <Pressable3D
            onPress={() => navigation.goBack()}
            className="mt-7 items-center self-stretch rounded-2xl py-4"
            style={{ backgroundColor: '#FF7A1A', borderBottomWidth: 4, borderBottomColor: '#C2410C' }}
          >
            <Text className="text-base font-extrabold uppercase text-white">Continue</Text>
          </Pressable3D>
        ) : (
          <>
            <Pressable3D
              onPress={startTest}
              className="mt-7 items-center self-stretch rounded-2xl py-4"
              style={{ backgroundColor: '#FF7A1A', borderBottomWidth: 4, borderBottomColor: '#C2410C' }}
            >
              <Text className="text-base font-extrabold uppercase text-white">Try again</Text>
            </Pressable3D>
            <Pressable3D onPress={() => navigation.goBack()} hapticOnPress={false} className="mt-3 py-2">
              <Text className="text-sm font-extrabold uppercase tracking-wide text-stone-400">Back to lessons</Text>
            </Pressable3D>
          </>
        )}
      </SafeAreaView>
    );
  }

  // ---- Test ----
  const ExerciseComponent = current ? SUPPORTED_KINDS[current.kind] : null;

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <Pressable3D onPress={() => navigation.goBack()} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-stone-200">
          <X size={18} color="#57534e" />
        </Pressable3D>
        <View className="h-3.5 flex-1 flex-row" style={{ gap: 4 }}>
          {exercises.map((ex, i) => (
            <View key={ex.id ?? i} className={'h-full flex-1 overflow-hidden rounded-full ' + (i < idx ? 'bg-brand-500' : 'bg-stone-200')} />
          ))}
        </View>
      </View>

      <View className="flex-1 px-4 pb-4">
        {ExerciseComponent ? (
          <ExerciseComponent key={current.id} exercise={current} onSubmit={submitAttempt} onAdvance={advance} onCheckStateChange={onCheckStateChange} />
        ) : current ? (
          <UnsupportedKindFallback kind={current.kind} onAdvance={advance} />
        ) : null}
      </View>

      <CheckButton visible={!lastResult && !!checkState.run} canCheck={checkState.canCheck} onPress={checkState.run} />

      <ExerciseResultBanner
        visible={!!lastResult}
        correct={!!lastResult?.is_correct}
        xpEarned={0}
        correctAnswer={lastResult?.correct_answer}
        onContinue={advance}
      />
    </SafeAreaView>
  );
}
