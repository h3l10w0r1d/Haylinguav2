// src/exercises/kinds/HighlightGrammar.js — ports ExHighlightGrammar
// (src/ExerciseRenderer.jsx:2434-2478). Tap the word token(s) matching a
// grammar rule; supports one or several correct tokens (a plain toggle Set,
// same as the web).
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Highlighter } from 'lucide-react-native';
import Pressable3D from '../../components/Pressable3D';
import ExerciseEyebrow from '../ExerciseEyebrow';
import { haptics } from '../../lib/haptics';

const TONE = {
  right: { bg: '#EFFCE3', border: '#7CE246', text: '#3A8A00' },
  wrong: { bg: '#FFECEC', border: '#FF6B6B', text: '#C81E1E' },
  active: { bg: '#E7F7FF', border: '#4EC2FF', text: '#147BB0' },
  idle: { bg: '#ffffff', border: '#e7e5e4', text: '#44403c' },
};

export default function HighlightGrammar({ exercise, onSubmit, onCheckStateChange }) {
  const cfg = exercise.config || {};
  const tokens = Array.isArray(cfg.tokens) ? cfg.tokens : [];
  const correctIdx = (Array.isArray(cfg.correctIndices) ? cfg.correctIndices : []).map(Number);

  const [picked, setPicked] = useState(new Set());
  const [graded, setGraded] = useState(false);

  useEffect(() => {
    setPicked(new Set());
    setGraded(false);
  }, [exercise.id]);

  function toggle(i) {
    if (graded) return;
    haptics.impact();
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const canCheck = picked.size > 0 && !graded;

  function check() {
    const sel = Array.from(picked).sort((a, b) => a - b);
    const target = [...correctIdx].sort((a, b) => a - b);
    const ok = sel.length === target.length && sel.every((v, i) => v === target[i]);
    setGraded(true);
    if (ok) haptics.success();
    else haptics.error();
    onSubmit({ selectedIndices: sel, answerText: sel.map((i) => tokens[i]).join(', '), isCorrect: ok });
  }

  useEffect(() => {
    onCheckStateChange?.({ canCheck, run: graded ? null : check });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, graded]);

  return (
    <View className="flex-1">
      <ExerciseEyebrow icon={Highlighter} label="Tap the right word(s)" color="#1899D6" tint="#E7F7FF" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'Tap the right word(s)'}</Text>

      <View className="mt-5 flex-row flex-wrap" style={{ gap: 8 }}>
        {tokens.map((t, i) => {
          const on = picked.has(i);
          const isCorrect = graded && correctIdx.includes(i);
          const isWrong = graded && on && !correctIdx.includes(i);
          const tone = isCorrect ? TONE.right : isWrong ? TONE.wrong : on ? TONE.active : TONE.idle;
          return (
            <Pressable3D
              key={i}
              disabled={graded}
              onPress={() => toggle(i)}
              hapticOnPress={false}
              pressDepth={2}
              className="rounded-2xl px-4 py-2.5"
              style={{ borderWidth: 2, borderColor: tone.border, backgroundColor: tone.bg }}
            >
              <Text className="text-lg font-bold" style={{ color: tone.text }}>
                {t}
              </Text>
            </Pressable3D>
          );
        })}
      </View>
    </View>
  );
}
