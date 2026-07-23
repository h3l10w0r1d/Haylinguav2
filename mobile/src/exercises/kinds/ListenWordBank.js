// src/exercises/kinds/ListenWordBank.js — ports ExListenWordBank
// (src/ExerciseRenderer.jsx:2019-2092). Autoplays the target sentence, then
// tap word tiles (translation + distractors) to rebuild what was heard.
// Reuses WordBank's tap-to-build tile pattern plus MinimalPairs' autoplay/
// slow-replay audio button pair.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Headphones, Turtle } from 'lucide-react-native';
import { playExerciseAudio } from '../../lib/playExerciseAudio';
import { normalizeText } from '../choiceHelpers';
import Pressable3D from '../../components/Pressable3D';
import ExerciseEyebrow from '../ExerciseEyebrow';
import { haptics } from '../../lib/haptics';

export default function ListenWordBank({ exercise, onSubmit, onCheckStateChange }) {
  const cfg = exercise.config || {};
  const target = String(cfg.ttsText ?? cfg.text ?? exercise.expected_answer ?? '').trim();
  const tiles = Array.isArray(cfg.tiles) ? cfg.tiles : [];
  const solution = Array.isArray(cfg.solution) && cfg.solution.length ? cfg.solution : target ? target.split(/\s+/) : [];

  const [picked, setPicked] = useState([]);
  const [available, setAvailable] = useState([]);
  const [graded, setGraded] = useState(null);
  const [playing, setPlaying] = useState(false);
  const didAutoplay = useRef(false);

  useEffect(() => {
    setPicked([]);
    setAvailable(tiles.map((t, i) => ({ t, key: `${i}-${t}` })));
    setGraded(null);
    didAutoplay.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  useEffect(() => {
    if (didAutoplay.current || !target) return;
    didAutoplay.current = true;
    play(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.id]);

  async function play(speed) {
    setPlaying(true);
    await playExerciseAudio(exercise.id, { text: target, speed });
    setPlaying(false);
  }

  const built = picked.map((p) => p.t).join(' ');
  const canCheck = picked.length > 0 && !graded;

  function add(idx) {
    if (graded) return;
    const item = available[idx];
    if (!item) return;
    haptics.impact();
    setAvailable((a) => a.filter((_, i) => i !== idx));
    setPicked((p) => [...p, item]);
  }
  function remove(idx) {
    if (graded) return;
    const item = picked[idx];
    if (!item) return;
    haptics.impact();
    setPicked((p) => p.filter((_, i) => i !== idx));
    setAvailable((a) => [...a, item]);
  }

  function check() {
    const picks = picked.map((p) => p.t);
    const ok = solution.length === picks.length && solution.every((v, i) => normalizeText(v) === normalizeText(picks[i]));
    const altOk = normalizeText(built) === normalizeText(solution.join(' '));
    const isOk = ok || altOk;
    setGraded({ ok: isOk });
    if (isOk) haptics.success();
    else haptics.error();
    onSubmit({ answerText: built, isCorrect: isOk });
  }

  useEffect(() => {
    onCheckStateChange?.({ canCheck, run: graded ? null : check });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, graded]);

  return (
    <View className="flex-1">
      <ExerciseEyebrow icon={Headphones} label="Tap what you hear" color="#1899D6" tint="#E7F7FF" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'Tap what you hear'}</Text>

      <View className="mt-4 flex-row items-center justify-center" style={{ gap: 16 }}>
        <Pressable3D
          onPress={() => play(1)}
          disabled={playing || !!graded}
          pressDepth={5}
          className={'h-16 w-16 items-center justify-center rounded-full ' + (playing ? 'bg-stone-300' : 'bg-brand-500')}
        >
          {playing ? <ActivityIndicator color="#fff" /> : <Headphones size={26} color="#fff" />}
        </Pressable3D>
        <Pressable3D
          onPress={() => play(0.6)}
          disabled={playing || !!graded}
          pressDepth={3}
          className="h-12 w-12 items-center justify-center rounded-full bg-stone-200"
        >
          <Turtle size={20} color="#57534e" />
        </Pressable3D>
      </View>

      <View className="mt-4 min-h-[56px] rounded-2xl border-b-2 border-dashed border-stone-300 bg-white p-3">
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {picked.length === 0 ? (
            <Text className="text-sm font-semibold text-stone-400">Tap the words you heard…</Text>
          ) : (
            picked.map((p, i) => (
              <Pressable3D key={p.key} onPress={() => remove(i)} hapticOnPress={false} pressDepth={2} className="rounded-xl border-2 border-brand-500 bg-brand-50 px-3 py-2">
                <Text className="text-base font-bold text-brand-700">{p.t}</Text>
              </Pressable3D>
            ))
          )}
        </View>
      </View>

      <View className="mt-4 flex-row flex-wrap" style={{ gap: 8 }}>
        {available.map((p, i) => (
          <Pressable3D key={p.key} onPress={() => add(i)} hapticOnPress={false} pressDepth={2} className="rounded-xl border-2 border-stone-200 bg-white px-3 py-2">
            <Text className="text-base font-semibold text-stone-800">{p.t}</Text>
          </Pressable3D>
        ))}
      </View>
    </View>
  );
}
