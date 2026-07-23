// src/exercises/kinds/CharMcqSound.js — ports ExCharMcqSound
// (src/ExerciseRenderer.jsx:394-454). The web version's "Play sound" button
// is a stub that always answers wrong ("Sound playback is not wired for
// this kind") — mobile already has a real audio pipeline (playExerciseAudio,
// used by every other audio kind), so this wires actual playback instead of
// porting that stub, matching MinimalPairs' autoplay-on-mount + tap-to-
// replay pattern rather than the web's half-built placeholder.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Volume2 } from 'lucide-react-native';
import { playExerciseAudio } from '../../lib/playExerciseAudio';
import { getSingleCorrectIndex } from '../choiceHelpers';
import ChoiceGrid from '../ChoiceGrid';
import Pressable3D from '../../components/Pressable3D';
import ExerciseEyebrow from '../ExerciseEyebrow';

export default function CharMcqSound({ exercise, onSubmit, onCheckStateChange }) {
  const cfg = exercise.config || {};
  const choices = Array.isArray(cfg.options) ? cfg.options.map(String) : [];
  const correctIndexFromDb = getSingleCorrectIndex(exercise, cfg, choices);
  const correctIndex = correctIndexFromDb !== null ? correctIndexFromDb : Number(cfg.correctIndex ?? -1);
  const ttsText = String(cfg.ttsText ?? cfg.letter ?? '').trim();

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
    if (didAutoplay.current || !ttsText) return;
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
    onSubmit({ selectedIndices: [selected], answerText: picked, isCorrect: selected === correctIndex });
  }

  useEffect(() => {
    onCheckStateChange?.({ canCheck, run: graded ? null : check });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, graded]);

  return (
    <View className="flex-1">
      <ExerciseEyebrow icon={Volume2} label="Pick the sound" color="#1899D6" tint="#E7F7FF" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'Pick the correct sound'}</Text>
      {!!cfg.letter && (
        <Text className="mt-1 text-sm font-semibold text-stone-500">
          Letter: <Text className="font-extrabold text-stone-800">{cfg.letter}</Text>
        </Text>
      )}

      <Pressable3D
        onPress={play}
        disabled={playing}
        pressDepth={2}
        className={'mt-4 flex-row items-center gap-2 self-start rounded-xl px-4 py-2.5 ' + (playing ? 'bg-stone-200' : 'bg-feather-50')}
      >
        {playing ? <ActivityIndicator size="small" color="#1899D6" /> : <Volume2 size={16} color="#1899D6" />}
        <Text className="text-sm font-bold text-feather-600">{playing ? 'Playing…' : 'Play sound'}</Text>
      </Pressable3D>

      <View className="mt-5">
        <ChoiceGrid choices={choices} selected={selected} onSelect={setSelected} graded={graded} />
      </View>
    </View>
  );
}
