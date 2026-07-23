// src/exercises/kinds/Categorize.js — ports ExCategorize
// (src/ExerciseRenderer.jsx:2367-2430). Tap an unsorted chip to select it,
// then tap a bucket to drop it in — no drag library needed, same tap-select-
// then-tap-target mechanic as MatchPairs. Items are tracked by index (not
// text) so duplicate-text items don't collide, matching the web's ER-16 fix.
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { LayoutGrid, X as XIcon } from 'lucide-react-native';
import Pressable3D from '../../components/Pressable3D';
import ExerciseEyebrow from '../ExerciseEyebrow';
import { haptics } from '../../lib/haptics';
import { normalizeText } from '../choiceHelpers';

export default function Categorize({ exercise, onSubmit, onCheckStateChange }) {
  const cfg = exercise.config || {};
  const buckets = Array.isArray(cfg.buckets) ? cfg.buckets : [];
  const items = Array.isArray(cfg.items) ? cfg.items : [];

  const [assign, setAssign] = useState({});
  const [activeIdx, setActiveIdx] = useState(null);
  const [graded, setGraded] = useState(null);

  useEffect(() => {
    setAssign({});
    setActiveIdx(null);
    setGraded(null);
  }, [exercise.id]);

  const unassignedIndices = items.map((_, i) => i).filter((i) => !(String(i) in assign));
  const allDone = items.length > 0 && unassignedIndices.length === 0;
  const canCheck = allDone && !graded;

  function dropInBucket(bucketName) {
    if (activeIdx === null || graded) return;
    haptics.impact();
    setAssign((a) => ({ ...a, [String(activeIdx)]: bucketName }));
    setActiveIdx(null);
  }

  function removeFromBucket(idx) {
    if (graded) return;
    haptics.impact();
    setAssign((a) => {
      const next = { ...a };
      delete next[String(idx)];
      return next;
    });
  }

  function check() {
    const built = items.map((it, i) => ({ text: it.text, bucket: assign[String(i)] }));
    const ok = items.every((it, i) => normalizeText(assign[String(i)]) === normalizeText(it.bucket));
    setGraded({ ok });
    if (ok) haptics.success();
    else haptics.error();
    onSubmit({ answerText: JSON.stringify(built), isCorrect: ok });
  }

  useEffect(() => {
    onCheckStateChange?.({ canCheck, run: graded ? null : check });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assign, graded]);

  return (
    <View className="flex-1">
      <ExerciseEyebrow icon={LayoutGrid} label="Sort into groups" color="#FF7A1A" tint="#FFF5EC" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'Sort each into the right group'}</Text>

      <View className="mt-4 min-h-[48px] flex-row flex-wrap rounded-2xl bg-stone-100 p-3" style={{ gap: 8 }}>
        {unassignedIndices.length === 0 ? (
          <Text className="self-center text-sm font-semibold text-stone-400">All sorted — tap Check.</Text>
        ) : (
          unassignedIndices.map((i) => (
            <Pressable3D
              key={i}
              onPress={() => setActiveIdx(i)}
              hapticOnPress={false}
              pressDepth={2}
              className={'rounded-full px-3.5 py-2 ' + (activeIdx === i ? 'bg-brand-500' : 'bg-white')}
              style={{ borderWidth: activeIdx === i ? 0 : 2, borderColor: '#e7e5e4' }}
            >
              <Text className={'text-sm font-bold ' + (activeIdx === i ? 'text-white' : 'text-stone-700')}>{items[i].text}</Text>
            </Pressable3D>
          ))
        )}
      </View>

      <View className="mt-4 flex-row flex-wrap" style={{ gap: 10 }}>
        {buckets.map((b) => {
          const inBucketIndices = Object.entries(assign)
            .filter(([, v]) => v === b)
            .map(([k]) => Number(k));
          return (
            <Pressable3D
              key={b}
              onPress={() => dropInBucket(b)}
              disabled={activeIdx === null}
              hapticOnPress={false}
              pressDepth={2}
              style={{ width: '47%' }}
              className="rounded-2xl border-2 border-stone-200 bg-white p-3"
            >
              <Text className="font-display text-sm font-extrabold text-stone-900">{b}</Text>
              <View className="mt-2 min-h-[32px] flex-row flex-wrap" style={{ gap: 6 }}>
                {inBucketIndices.length === 0 ? (
                  <Text className="text-xs font-semibold text-stone-300">tap a word, then this group</Text>
                ) : (
                  inBucketIndices.map((i) => (
                    <Pressable3D
                      key={i}
                      onPress={() => removeFromBucket(i)}
                      hapticOnPress={false}
                      pressDepth={1}
                      className="flex-row items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1"
                    >
                      <Text className="text-xs font-bold text-brand-700">{items[i].text}</Text>
                      <XIcon size={11} color="#B84B00" />
                    </Pressable3D>
                  ))
                )}
              </View>
            </Pressable3D>
          );
        })}
      </View>
    </View>
  );
}
