// src/exercises/kinds/ListenType.js — ports the web's "listen_type" kind
// (src/ExerciseRenderer.jsx:1621-1708). Target text comes from
// exercise.expected_answer, falling back to cfg.ttsText/text/answer. A "slow"
// button replays the SAME audio at a reduced playback rate (no second fetch).
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import { Volume2, Headphones, Turtle } from 'lucide-react-native';
import { playExerciseAudio } from '../../lib/playExerciseAudio';
import { normalizeText } from '../choiceHelpers';
import Pressable3D from '../../components/Pressable3D';
import ExerciseEyebrow from '../ExerciseEyebrow';
import { haptics } from '../../lib/haptics';

export default function ListenType({ exercise, onSubmit, onCheckStateChange }) {
  const cfg = exercise.config || {};
  const target = String(exercise.expected_answer ?? cfg.ttsText ?? cfg.text ?? cfg.answer ?? '').trim();
  const accepted = [target, ...(Array.isArray(cfg.acceptedAnswers) ? cfg.acceptedAnswers : [])].filter(Boolean);

  const [answer, setAnswer] = useState('');
  const [playing, setPlaying] = useState(false);
  const [graded, setGraded] = useState(null);
  const didAutoplay = useRef(false);

  useEffect(() => {
    setAnswer('');
    setGraded(null);
    didAutoplay.current = false;
  }, [exercise.id]);

  useEffect(() => {
    if (didAutoplay.current) return;
    didAutoplay.current = true;
    play(1.0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  async function play(speed) {
    setPlaying(true);
    await playExerciseAudio(exercise.id, { text: target, speed });
    setPlaying(false);
  }

  const canCheck = answer.trim().length > 0 && !graded;

  function check() {
    const ok = accepted.some((a) => normalizeText(a) === normalizeText(answer));
    setGraded({ ok });
    if (ok) haptics.success();
    else haptics.error();
    onSubmit({ answerText: answer, isCorrect: ok });
  }

  useEffect(() => {
    onCheckStateChange?.({ canCheck, run: graded ? null : check });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer, graded]);

  return (
    <View className="flex-1">
      <ExerciseEyebrow icon={Headphones} label="Listen & type" color="#1899D6" tint="#E7F7FF" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'Type what you hear'}</Text>

      <View className="mt-6 flex-row items-center justify-center" style={{ gap: 16 }}>
        <Pressable3D
          onPress={() => play(1.0)}
          disabled={playing}
          pressDepth={5}
          className={'h-20 w-20 items-center justify-center rounded-3xl ' + (playing ? 'bg-stone-300' : 'bg-brand-500')}
        >
          {playing ? <ActivityIndicator color="#fff" /> : <Volume2 size={32} color="#fff" />}
        </Pressable3D>
        <Pressable3D
          onPress={() => play(0.6)}
          disabled={playing}
          pressDepth={3}
          className="h-14 w-14 items-center justify-center rounded-2xl bg-stone-200"
        >
          <Turtle size={22} color="#57534e" />
        </Pressable3D>
      </View>
      <Text className="mt-2 text-center text-sm font-bold text-stone-500">{playing ? 'Playing…' : 'Tap to listen again'}</Text>

      <TextInput
        value={answer}
        onChangeText={setAnswer}
        editable={!graded}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        placeholder="Type what you heard"
        placeholderTextColor="#a8a29e"
        className="mt-6 rounded-2xl border-2 border-stone-200 bg-white px-4 py-3 text-base font-semibold text-stone-900"
      />
    </View>
  );
}
