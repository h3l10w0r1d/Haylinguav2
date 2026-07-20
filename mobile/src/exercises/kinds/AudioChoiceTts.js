// src/exercises/kinds/AudioChoiceTts.js — ports ExAudioChoiceTts. "Listen and
// choose" — the web version prefers CMS-recorded audio for the exercise
// before falling back to on-the-fly ElevenLabs TTS, now wired up via
// playExerciseAudio's GET /tts?text=... fallback (GET-only since
// react-native-nitro-sound's player can't send a POST body) — matching the
// web's priority order in src/exercises/tts.jsx.
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Volume2 } from 'lucide-react-native';
import { playExerciseAudio } from '../../lib/playExerciseAudio';
import { getChoices, getSingleCorrectIndex, normalizeText } from '../choiceHelpers';
import ChoiceGrid from '../ChoiceGrid';
import Pressable3D from '../../components/Pressable3D';

export default function AudioChoiceTts({ exercise, onSubmit, onAdvance }) {
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
    onSubmit({ selectedIndices: [selected], answerText: picked });
  }

  return (
    <View className="flex-1 justify-between">
      <View>
        <Text className="text-lg font-extrabold text-stone-900">{promptText}</Text>
        <Text className="mt-1 text-sm font-semibold text-stone-500">Tap play, then choose the correct option.</Text>

        <TouchableOpacity
          onPress={play}
          disabled={playing}
          className={'mt-4 flex-row items-center gap-2 self-start rounded-xl px-4 py-2.5 ' + (playing ? 'bg-stone-200' : 'bg-feather-50')}
        >
          {playing ? <ActivityIndicator size="small" color="#1899D6" /> : <Volume2 size={16} color="#1899D6" />}
          <Text className="text-sm font-bold text-feather-600">{playing ? 'Playing…' : 'Play'}</Text>
        </TouchableOpacity>

        <View className="mt-5">
          <ChoiceGrid choices={choices} selected={selected} onSelect={setSelected} graded={graded} />
        </View>
      </View>

      <Pressable3D
        onPress={graded ? onAdvance : check}
        disabled={!canCheck && !graded}
        className={'items-center rounded-2xl py-4 ' + (canCheck || graded ? 'bg-brand-500' : 'bg-stone-300')}
      >
        <Text className="text-base font-extrabold text-white">{graded ? 'Continue' : 'Check'}</Text>
      </Pressable3D>
    </View>
  );
}
