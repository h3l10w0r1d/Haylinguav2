// src/exercises/kinds/AudioChoiceTts.js — ports ExAudioChoiceTts. "Listen and
// choose" — the web version prefers CMS-recorded audio for the exercise
// before falling back to on-the-fly ElevenLabs TTS, now wired up via
// playExerciseAudio's GET /tts?text=... fallback (GET-only since
// react-native-nitro-sound's player can't send a POST body) — matching the
// web's priority order in src/exercises/tts.jsx.
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Volume2, Headphones } from 'lucide-react-native';
import { playExerciseAudio } from '../../lib/playExerciseAudio';
import { getChoices, getSingleCorrectIndex, normalizeText } from '../choiceHelpers';
import ChoiceGrid from '../ChoiceGrid';
import Pressable3D from '../../components/Pressable3D';
import ExerciseEyebrow from '../ExerciseEyebrow';

export default function AudioChoiceTts({ exercise, onSubmit, onCheckStateChange }) {
  const cfg = exercise.config || {};
  const promptText = cfg.promptText ?? exercise.prompt ?? 'Listen and choose';
  const choices = getChoices(exercise, cfg);
  const correctIndex = getSingleCorrectIndex(exercise, cfg, choices);
  const answerText = exercise.expected_answer ?? cfg.answer ?? null;
  const [selected, setSelected] = useState(null);
  const [graded, setGraded] = useState(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setSelected(null);
    setGraded(null);
  }, [exercise.id]);

  async function play() {
    setPlaying(true);
    await playExerciseAudio(exercise.id, { text: cfg.ttsText ?? answerText ?? '' });
    setPlaying(false);
  }

  const canCheck = selected !== null && !graded;

  function check() {
    const picked = choices[selected] ?? '';
    const ci = correctIndex !== null ? correctIndex : choices.findIndex((c) => normalizeText(c) === normalizeText(answerText));
    setGraded({ correct: ci, picked: selected });
    onSubmit({ selectedIndices: [selected], answerText: picked, isCorrect: selected === ci });
  }

  useEffect(() => {
    onCheckStateChange?.({ canCheck, run: graded ? null : check });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, graded]);

  return (
    <View className="flex-1">
      <ExerciseEyebrow icon={Headphones} label="Listen & choose" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{promptText}</Text>
      <Text className="mt-1 text-sm font-semibold text-stone-500">Tap play, then choose the correct option.</Text>

      <View className="mt-6 items-center">
        <Pressable3D
          onPress={play}
          disabled={playing}
          pressDepth={5}
          className={'h-20 w-20 items-center justify-center rounded-3xl ' + (playing ? 'bg-stone-300' : 'bg-brand-500')}
        >
          {playing ? <ActivityIndicator color="#fff" /> : <Volume2 size={32} color="#fff" />}
        </Pressable3D>
        <Text className="mt-2 text-sm font-bold text-stone-500">{playing ? 'Playing…' : 'Tap to listen'}</Text>
      </View>

      <View className="mt-6">
        <ChoiceGrid choices={choices} selected={selected} onSelect={setSelected} graded={graded} />
      </View>
    </View>
  );
}
