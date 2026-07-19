// src/exercises/kinds/SentenceOrder.js — ports ExSentenceOrder. Tap tokens
// below to build the sentence in order; tap a picked token to remove it.
// No drag library needed (confirmed by reading the web source). The web
// version also has a per-token "hear" button using on-the-fly TTS for
// arbitrary text (POST /tts) — not wired on mobile yet (see AudioChoiceTts),
// so this version omits per-token audio and keeps only the tap-to-build flow.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { normalizeText } from '../choiceHelpers';
import Pressable3D from '../../components/Pressable3D';
import { haptics } from '../../lib/haptics';

export default function SentenceOrder({ exercise, onSubmit, onAdvance }) {
  const cfg = exercise.config || {};
  const rawTokens = cfg.tokens ?? [];
  const solution = cfg.solution ?? null;
  const solutionIndices = cfg.solutionIndices ?? null;
  const expected = exercise.expected_answer;

  const initialAvailable = useMemo(
    () => rawTokens.map((t, i) => ({ t, k: i, key: `${i}-${t}` })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exercise.id]
  );

  const [picked, setPicked] = useState([]);
  const [available, setAvailable] = useState(initialAvailable);
  const [graded, setGraded] = useState(null);

  useEffect(() => {
    setPicked([]);
    setAvailable(initialAvailable);
    setGraded(null);
  }, [exercise.id, initialAvailable]);

  const canCheck = picked.length > 0 && !graded;

  function removePicked(idx) {
    if (graded) return;
    haptics.impact();
    const item = picked[idx];
    setPicked((p) => p.filter((_, i) => i !== idx));
    setAvailable((a) => [...a, item]);
  }

  function addToken(idx) {
    if (graded) return;
    haptics.impact();
    const item = available[idx];
    setAvailable((a) => a.filter((_, i) => i !== idx));
    setPicked((p) => [...p, item]);
  }

  function check() {
    const pickedTexts = picked.map((it) => it.t);
    let ok;
    if (Array.isArray(solution)) {
      ok = solution.length === pickedTexts.length && solution.every((v, i) => normalizeText(v) === normalizeText(pickedTexts[i]));
    } else if (Array.isArray(solutionIndices)) {
      const builtIndices = picked.map((it) => it.k);
      ok = solutionIndices.length === builtIndices.length && solutionIndices.every((v, i) => Number(v) === Number(builtIndices[i]));
    } else {
      const builtSentence = pickedTexts.join(' ');
      const answer = expected ?? cfg.answer ?? '';
      ok = normalizeText(builtSentence) === normalizeText(answer);
    }
    setGraded({ ok });
    if (ok) haptics.success();
    else haptics.error();
    onSubmit({ answerText: pickedTexts.join(' ') });
  }

  return (
    <View className="flex-1 justify-between">
      <View>
        <Text className="text-lg font-extrabold text-stone-900">{exercise.prompt || 'Put the sentence in order'}</Text>

        <View className="mt-4 min-h-[64px] rounded-2xl bg-stone-100 p-4">
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {picked.length === 0 ? (
              <Text className="text-sm font-semibold text-stone-400">Tap words below to build the sentence…</Text>
            ) : (
              picked.map((item, i) => (
                <Pressable3D key={item.key} onPress={() => removePicked(i)} hapticOnPress={false} pressDepth={2} className="rounded-xl border-2 border-brand-500 bg-brand-50 px-3 py-2">
                  <Text className="text-base font-bold text-brand-700">{item.t}</Text>
                </Pressable3D>
              ))
            )}
          </View>
        </View>

        <View className="mt-4 flex-row flex-wrap" style={{ gap: 8 }}>
          {available.map((item, i) => (
            <Pressable3D key={item.key} onPress={() => addToken(i)} hapticOnPress={false} pressDepth={2} className="rounded-xl border-2 border-stone-200 bg-white px-3 py-2">
              <Text className="text-base font-semibold text-stone-800">{item.t}</Text>
            </Pressable3D>
          ))}
        </View>

        {graded && (
          <Text className={'mt-4 text-sm font-bold ' + (graded.ok ? 'text-grass-600' : 'text-cardinal-600')}>
            {graded.ok ? 'Correct!' : 'Word order is incorrect.'}
          </Text>
        )}
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
