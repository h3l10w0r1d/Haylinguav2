// src/exercises/kinds/Speak.js — ports ExSpeak (src/ExerciseRenderer.jsx
// ~1319-1518). Record → upload to POST /me/exercises/transcribe → score the
// returned transcript client-side (no backend scoring exists, see
// src/lib/similarity.js). Target/expected phrase comes from
// exercise.expected_answer, matching the web exactly.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Mic, Volume2 } from 'lucide-react-native';
import { playExerciseAudio } from '../../lib/playExerciseAudio';
import { startRecording, stopRecording, cancelRecording, transcribe } from '../../lib/transcribeAudio';
import { isSpeechMatch } from '../../lib/similarity';
import { haptics } from '../../lib/haptics';
import Pressable3D from '../../components/Pressable3D';
import ExerciseEyebrow from '../ExerciseEyebrow';

export default function Speak({ exercise, onSubmit, onAdvance, onCheckStateChange }) {
  const cfg = exercise.config || {};
  const target = String(exercise.expected_answer ?? cfg.answer ?? cfg.target ?? cfg.phrase ?? '').trim();
  const languageCode = cfg.language_code || cfg.lang || 'hye';
  const hint = String(cfg.transliteration || cfg.romanization || '').trim();

  const [recording, setRecordingState] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [graded, setGraded] = useState(null);
  const pulse = useSharedValue(0);
  const mounted = useRef(true);

  useEffect(() => {
    setRecordingState(false);
    setBusy(false);
    setTranscript('');
    setError('');
    setGraded(null);
  }, [exercise.id]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelRecording();
    };
  }, []);

  useEffect(() => {
    if (recording) {
      pulse.value = withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(0, { duration: 500 })), -1, false);
    } else {
      pulse.value = withTiming(0, { duration: 150 });
    }
  }, [recording]);

  const micStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.12 }],
    shadowColor: '#E11D48',
    shadowOpacity: pulse.value * 0.5,
    shadowRadius: 4 + pulse.value * 10,
    shadowOffset: { width: 0, height: 0 },
  }));

  async function onMicPress() {
    if (busy) return;
    if (recording) {
      setRecordingState(false);
      setBusy(true);
      try {
        const uri = await stopRecording();
        const text = await transcribe(uri, { languageCode });
        if (!mounted.current) return;
        setTranscript(text);
        setError('');
      } catch {
        if (mounted.current) setError("Couldn't understand that — try again.");
      } finally {
        if (mounted.current) setBusy(false);
      }
    } else {
      setError('');
      setTranscript('');
      setGraded(null);
      try {
        await startRecording();
        setRecordingState(true);
      } catch {
        setError('Could not access the microphone.');
      }
    }
  }

  const canCheck = !!transcript && !busy && !recording && !graded;

  function check() {
    const ok = isSpeechMatch(transcript, target);
    setGraded({ ok });
    if (ok) haptics.success();
    else haptics.error();
    onSubmit({ answerText: transcript });
  }

  function skip() {
    onSubmit({ answerText: '', selectedIndices: [] });
    onAdvance();
  }

  useEffect(() => {
    onCheckStateChange?.({ canCheck, run: graded ? null : check });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, busy, recording, graded]);

  return (
    <View className="flex-1">
      <ExerciseEyebrow icon={Mic} label="Speak" color="#FF7A1A" tint="#FFF5EC" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'Say the phrase out loud'}</Text>

      {!!target && (
        <View className="mt-4 rounded-2xl bg-stone-100 p-4">
          <Text className="text-lg font-semibold text-stone-900">{target}</Text>
          {!!hint && <Text className="mt-1 text-sm font-medium text-stone-500">{hint}</Text>}
        </View>
      )}

      <Pressable3D
        onPress={() => playExerciseAudio(exercise.id, { text: target })}
        pressDepth={2}
        className="mt-4 flex-row items-center gap-2 self-start rounded-xl bg-feather-50 px-4 py-2.5"
      >
        <Volume2 size={16} color="#1899D6" />
        <Text className="text-sm font-bold text-feather-600">Play sound</Text>
      </Pressable3D>

      <View className="mt-8 items-center">
        <Animated.View style={micStyle}>
          <Pressable3D
            onPress={onMicPress}
            disabled={busy}
            pressDepth={5}
            className={'h-20 w-20 items-center justify-center rounded-full ' + (recording ? 'bg-cardinal-500' : busy ? 'bg-stone-300' : 'bg-brand-500')}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Mic size={32} color="#fff" />}
          </Pressable3D>
        </Animated.View>
        <Text className="mt-2 text-sm font-bold text-stone-500">
          {recording ? 'Tap to stop' : busy ? 'Transcribing…' : 'Tap and speak'}
        </Text>
      </View>

      {!!transcript && (
        <View className="mt-6 rounded-2xl bg-white p-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
          <Text className="text-xs font-bold uppercase tracking-wide text-stone-400">We heard</Text>
          <Text className="mt-1 text-base font-semibold text-stone-900">{transcript}</Text>
        </View>
      )}

      {!!error && <Text className="mt-4 text-sm font-bold text-cardinal-600">{error}</Text>}

      {!graded && (
        <Pressable3D onPress={skip} className="mt-4 self-center">
          <Text className="text-sm font-bold text-stone-400 underline">Can't speak right now — skip</Text>
        </Pressable3D>
      )}
    </View>
  );
}
