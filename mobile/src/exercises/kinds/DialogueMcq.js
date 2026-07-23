// src/exercises/kinds/DialogueMcq.js — ports ExDialogueMcq
// (src/ExerciseRenderer.jsx:2095-2137). Complete the conversation: chat
// bubbles for each line (right-aligned/brand-colored for "you"/"me"), a
// dashed placeholder bubble showing the current pick, then ChoiceGrid.
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { getChoices, getSingleCorrectIndex, normalizeText } from '../choiceHelpers';
import ChoiceGrid from '../ChoiceGrid';
import ExerciseEyebrow from '../ExerciseEyebrow';

export default function DialogueMcq({ exercise, onSubmit, onCheckStateChange }) {
  const cfg = exercise.config || {};
  const lines = Array.isArray(cfg.lines) ? cfg.lines : [];
  const choices = getChoices(exercise, cfg);
  const correctIndex = getSingleCorrectIndex(exercise, cfg, choices);
  const answerText = exercise.expected_answer ?? cfg.answer ?? null;

  const [sel, setSel] = useState(null);
  const [graded, setGraded] = useState(null);

  useEffect(() => {
    setSel(null);
    setGraded(null);
  }, [exercise.id]);

  const canCheck = sel !== null && !graded;

  function check() {
    const pick = choices[sel] ?? '';
    const ci = correctIndex !== null ? correctIndex : choices.findIndex((c) => normalizeText(c) === normalizeText(answerText));
    const ok = ci !== null && sel === ci;
    setGraded({ correct: ci, picked: sel });
    onSubmit({ selectedIndices: [sel], answerText: pick, isCorrect: ok });
  }

  useEffect(() => {
    onCheckStateChange?.({ canCheck, run: graded ? null : check });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, graded]);

  return (
    <View className="flex-1">
      <ExerciseEyebrow icon={MessageCircle} label="Complete the conversation" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'Complete the conversation'}</Text>

      <View className="mt-4" style={{ gap: 8 }}>
        {lines.map((l, i) => {
          const mine = l?.from === 'you' || l?.from === 'me';
          return (
            <View key={i} className={'flex-row ' + (mine ? 'justify-end' : 'justify-start')}>
              <View
                className="max-w-[80%] rounded-2xl px-4 py-2.5"
                style={{ backgroundColor: mine ? '#FF7A1A' : '#f5f5f4' }}
              >
                <Text className={'text-sm font-semibold ' + (mine ? 'text-white' : 'text-stone-800')}>{l?.text}</Text>
              </View>
            </View>
          );
        })}
        <View className="flex-row justify-end">
          <View className="max-w-[80%] rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50 px-4 py-2.5">
            <Text className="text-sm font-semibold text-brand-700">{sel !== null ? choices[sel] ?? '…' : '…'}</Text>
          </View>
        </View>
      </View>

      <View className="mt-4">
        <ChoiceGrid choices={choices} selected={sel} onSelect={setSel} graded={graded} />
      </View>
    </View>
  );
}
