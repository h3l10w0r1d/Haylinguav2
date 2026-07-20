// src/exercises/kinds/TrueFalse.js — ports ExTrueFalse. Two-button choice,
// no options/choices array involved at all — cfg.correct is the boolean.
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { ListChecks, Check, X as XIcon } from 'lucide-react-native';
import Pressable3D from '../../components/Pressable3D';
import ExerciseEyebrow from '../ExerciseEyebrow';
import { haptics } from '../../lib/haptics';

export default function TrueFalse({ exercise, onSubmit, onCheckStateChange }) {
  const cfg = exercise.config || {};
  const statement = cfg.statement ?? '';
  const correctBool = cfg.correct === true || cfg.correct === 1 || String(cfg.correct).toLowerCase() === 'true';
  const [selected, setSelected] = useState(null); // 0 = false, 1 = true
  const [graded, setGraded] = useState(null);

  useEffect(() => {
    setSelected(null);
    setGraded(null);
  }, [exercise.id]);

  function check() {
    const pick = selected === 1;
    setGraded({ correct: correctBool });
    if (pick === correctBool) haptics.success();
    else haptics.error();
    onSubmit({ selectedIndices: [selected], answerText: pick ? 'true' : 'false' });
  }

  const canCheck = selected !== null && !graded;

  useEffect(() => {
    onCheckStateChange?.({ canCheck, run: graded ? null : check });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, graded]);

  function optionStyle(isTrue) {
    const isSelected = selected === (isTrue ? 1 : 0);
    if (!graded) return isSelected ? 'border-brand-500 bg-brand-50' : 'border-stone-200 bg-white';
    const isRightAnswer = isTrue === correctBool;
    if (isRightAnswer) return 'border-grass-500 bg-grass-50';
    if (isSelected) return 'border-cardinal-500 bg-cardinal-50';
    return 'border-stone-200 bg-white';
  }

  return (
    <View className="flex-1">
      <ExerciseEyebrow icon={ListChecks} label="True or false" color="#FF4B4B" tint="#FFECEC" />
      <Text className="text-lg font-extrabold text-stone-900 font-display">{exercise.prompt || 'True or False?'}</Text>

      {!!statement && (
        <View className="mt-4 rounded-2xl bg-stone-100 p-4">
          <Text className="text-lg font-semibold text-stone-900">{statement}</Text>
        </View>
      )}

      <View className="mt-5 flex-row" style={{ gap: 10 }}>
        {/* Pressable3D's press animation lives on an outer wrapper View, so
            the flex-1 that splits this row evenly has to go on a plain View
            around it — className on Pressable3D itself only sizes its own
            inner Pressable, not the animated wrapper. */}
        <View className="flex-1">
          <Pressable3D
            disabled={!!graded}
            onPress={() => setSelected(0)}
            className={'flex-row items-center justify-center gap-2 rounded-2xl border-2 py-4 ' + optionStyle(false)}
          >
            <XIcon size={16} color="#57534e" />
            <Text className="text-base font-bold text-stone-800">False</Text>
          </Pressable3D>
        </View>
        <View className="flex-1">
          <Pressable3D
            disabled={!!graded}
            onPress={() => setSelected(1)}
            className={'flex-row items-center justify-center gap-2 rounded-2xl border-2 py-4 ' + optionStyle(true)}
          >
            <Check size={16} color="#57534e" />
            <Text className="text-base font-bold text-stone-800">True</Text>
          </Pressable3D>
        </View>
      </View>
    </View>
  );
}
