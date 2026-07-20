// src/exercises/kinds/MinimalPairs.js — ports ExMinimalPairs. "Listen and
// choose what you hear" — autoplays the exercise's audio on mount, plus a
// tap-to-replay button. This is the kind that makes up most of a brand-new
// user's very first real lesson (snd-vowels-1), so it's the highest-value
// addition in this pass.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Volume2, Headphones } from 'lucide-react-native';
import { playExerciseAudio } from '../../lib/playExerciseAudio';
import { getChoices, getSingleCorrectIndex } from '../choiceHelpers';
import ChoiceGrid from '../ChoiceGrid';
import Pressable3D from '../../components/Pressable3D';
import ExerciseEyebrow from '../ExerciseEyebrow';

export default function MinimalPairs({ exercise, onSubmit, onCheckStateChange }) {
  const cfg = exercise.config || {};
  const choices = getChoices(exercise, cfg);
  const correctIndex = getSingleCorrectIndex(exercise, cfg, choices);
  const ttsText = String(cfg.ttsText ?? cfg.text ?? (correctIndex != null ? choices[correctIndex] : '') ?? '').trim();
  const [selected, setSelected] = useState(null);
  const [graded, setGraded] = useState(null);
  const [playing, setPlaying] = useState(false);
  const didAutoplay = useRef(false);

  useEffect(() => {
    setSelected(null);
    setGraded(null);
    didAutoplay.current = false;
  }, [exercise.id]);

  useEffect(() => {
    if (didAutoplay.current) return;
    didAutoplay.current = true;
    play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  async function play() {
    setPlaying(true);
    await playExerciseAudio(exercise.id, { text: ttsText });
    setPlaying(false);
  }

  const canCheck = selected !== null && !graded;

  function check() {
    const picked = choices[selected] ?? '';
    setGraded({ correct: correctIndex, picked: selected });
    onSubmit({ selectedIndices: [selected], answerText: picked });
  }

  useEffect(() => {
    onCheckStateChange?.({ canCheck, run: graded ? null : check });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, graded]);

  return (
    <View className="flex-1">
      <ExerciseEyebrow icon={Headphones} label="Listen & choose" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'Which word did you hear?'}</Text>

      <View className="mt-6 items-center">
        <Pressable3D
          onPress={play}
          disabled={playing}
          pressDepth={5}
          className={'h-20 w-20 items-center justify-center rounded-full ' + (playing ? 'bg-stone-300' : 'bg-brand-500')}
        >
          {playing ? <ActivityIndicator color="#fff" /> : <Volume2 size={32} color="#fff" />}
        </Pressable3D>
        <Text className="mt-2 text-sm font-bold text-stone-500">{playing ? 'Playing…' : 'Tap to listen again'}</Text>
      </View>

      <View className="mt-6">
        <ChoiceGrid choices={choices} selected={selected} onSelect={setSelected} graded={graded} />
      </View>
    </View>
  );
}
