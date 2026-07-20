// src/components/ExplainMistake.js — "Why was this wrong?" GPT-backed hint,
// ported from src/ExerciseShell.jsx's ExplainMistake (~117-162). Only rendered
// on the wrong-answer banner by ExerciseResultBanner.
import React, { useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { HelpCircle, Sparkles } from 'lucide-react-native';
import { api } from '../lib/api';
import Pressable3D from './Pressable3D';

export default function ExplainMistake({ exerciseId, userAnswer }) {
  const [state, setState] = useState('idle'); // idle | loading | done | error
  const [text, setText] = useState('');

  async function ask() {
    if (state === 'loading' || !exerciseId) return;
    setState('loading');
    try {
      const data = await api.post(`/me/exercises/${exerciseId}/explain`, { user_answer: userAnswer || '' });
      setText((data?.explanation || '').trim() || 'Compare your answer with the correct one, letter by letter.');
      setState('done');
    } catch {
      setText("Couldn't load an explanation right now.");
      setState('error');
    }
  }

  if (state === 'idle' || state === 'loading') {
    return (
      <Pressable3D
        onPress={ask}
        disabled={state === 'loading'}
        pressDepth={2}
        className="mt-2 flex-row items-center gap-1.5 self-start rounded-full bg-white/70 px-3 py-1.5"
      >
        {state === 'loading' ? <ActivityIndicator size="small" color="#E11D48" /> : <HelpCircle size={14} color="#E11D48" />}
        <Text className="text-xs font-extrabold text-cardinal-600">
          {state === 'loading' ? 'Thinking…' : 'Why was this wrong?'}
        </Text>
      </Pressable3D>
    );
  }

  return (
    <View className="mt-2 rounded-xl bg-white/70 p-3">
      <View className="mb-1 flex-row items-center gap-1.5">
        <Sparkles size={14} color="#E11D48" />
        <Text className="text-xs font-extrabold uppercase tracking-wide text-cardinal-500">Explanation</Text>
      </View>
      <Text className="text-sm font-semibold leading-snug text-stone-700">{text}</Text>
    </View>
  );
}
