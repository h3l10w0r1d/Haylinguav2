// src/exercises/kinds/ImageSelect.js — ports ExImageSelect
// (src/ExerciseRenderer.jsx:2179-2235). 2-column grid, pick the correct
// picture (an emoji tile or a real image). Labels are hidden unless a
// choice deliberately carries a caption — showing them for every choice
// would give the picture-matching answer away, same rule as the web.
import React, { useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import { ImageIcon } from 'lucide-react-native';
import Pressable3D from '../../components/Pressable3D';
import ExerciseEyebrow from '../ExerciseEyebrow';
import { haptics } from '../../lib/haptics';
import { API_BASE_URL } from '../../lib/api';

function resolveImageUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s) || s.startsWith('data:')) return s;
  if (s.startsWith('/static/') || s.startsWith('/uploads/')) return `${API_BASE_URL}${s}`;
  return s;
}

export default function ImageSelect({ exercise, onSubmit, onCheckStateChange }) {
  const cfg = exercise.config || {};
  const items = Array.isArray(cfg.choices) ? cfg.choices : [];
  const correctIndex = Number.isFinite(cfg.answerIndex)
    ? Number(cfg.answerIndex)
    : items.findIndex((o) => o?.is_correct) >= 0
    ? items.findIndex((o) => o?.is_correct)
    : (exercise.options || []).findIndex((o) => o?.is_correct);

  const [sel, setSel] = useState(null);
  const [graded, setGraded] = useState(false);

  useEffect(() => {
    setSel(null);
    setGraded(false);
  }, [exercise.id]);

  const canCheck = sel !== null && !graded;

  function check() {
    const it = items[sel] || {};
    const ok = correctIndex >= 0 && sel === correctIndex;
    setGraded(true);
    if (ok) haptics.success();
    else haptics.error();
    onSubmit({ selectedIndices: [sel], answerText: it.label || it.emoji || '', isCorrect: ok });
  }

  useEffect(() => {
    onCheckStateChange?.({ canCheck, run: graded ? null : check });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, graded]);

  return (
    <View className="flex-1">
      <ExerciseEyebrow icon={ImageIcon} label="Which one is it?" color="#FF7A1A" tint="#FFF5EC" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'Which one is it?'}</Text>

      <View className="mt-4 flex-row flex-wrap" style={{ gap: 12 }}>
        {items.map((it, i) => {
          const active = sel === i;
          const isCorrect = graded && i === correctIndex;
          const isWrongPick = graded && active && i !== correctIndex;
          const ringColor = isCorrect ? '#58CC02' : isWrongPick ? '#FF4B4B' : active ? '#FF9342' : '#e7e5e4';
          return (
            <Pressable3D
              key={i}
              disabled={graded}
              onPress={() => setSel(i)}
              hapticOnPress={false}
              pressDepth={2}
              style={{ width: '47%' }}
              className="overflow-hidden rounded-2xl"
            >
              <View style={{ borderWidth: 3, borderColor: ringColor, borderRadius: 16, overflow: 'hidden' }}>
                <View className="aspect-square w-full items-center justify-center bg-stone-100">
                  {it?.emoji ? (
                    <Text style={{ fontSize: 56 }}>{it.emoji}</Text>
                  ) : it?.image ? (
                    <Image source={{ uri: resolveImageUrl(it.image) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <Text className="text-xs font-semibold text-stone-300">no image</Text>
                  )}
                </View>
                {it?.label && !it?.emoji ? (
                  <View className={'py-1.5 ' + (active ? 'bg-brand-50' : 'bg-white')}>
                    <Text className={'text-center text-sm font-bold ' + (active ? 'text-brand-700' : 'text-stone-700')}>{it.label}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable3D>
          );
        })}
      </View>
    </View>
  );
}
