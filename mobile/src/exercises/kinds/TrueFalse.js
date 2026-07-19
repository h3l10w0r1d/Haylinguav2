// src/exercises/kinds/TrueFalse.js — ports ExTrueFalse. Two-button choice,
// no options/choices array involved at all — cfg.correct is the boolean.
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export default function TrueFalse({ exercise, onSubmit, onAdvance }) {
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
    onSubmit({ selectedIndices: [selected], answerText: pick ? 'true' : 'false' });
  }

  const canCheck = selected !== null && !graded;

  function optionStyle(isTrue) {
    const isSelected = selected === (isTrue ? 1 : 0);
    if (!graded) return isSelected ? 'border-brand-500 bg-brand-50' : 'border-stone-200 bg-white';
    const isRightAnswer = isTrue === correctBool;
    if (isRightAnswer) return 'border-grass-500 bg-grass-50';
    if (isSelected) return 'border-cardinal-500 bg-cardinal-50';
    return 'border-stone-200 bg-white';
  }

  return (
    <View className="flex-1 justify-between">
      <View>
        <Text className="text-lg font-extrabold text-stone-900">{exercise.prompt || 'True or False?'}</Text>

        {!!statement && (
          <View className="mt-4 rounded-2xl bg-stone-100 p-4">
            <Text className="text-lg font-semibold text-stone-900">{statement}</Text>
          </View>
        )}

        <View className="mt-5 flex-row" style={{ gap: 10 }}>
          <TouchableOpacity
            disabled={!!graded}
            onPress={() => setSelected(0)}
            className={'flex-1 items-center rounded-2xl border-2 py-4 ' + optionStyle(false)}
          >
            <Text className="text-base font-bold text-stone-800">False</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={!!graded}
            onPress={() => setSelected(1)}
            className={'flex-1 items-center rounded-2xl border-2 py-4 ' + optionStyle(true)}
          >
            <Text className="text-base font-bold text-stone-800">True</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        onPress={graded ? onAdvance : check}
        disabled={!canCheck && !graded}
        className={'items-center rounded-2xl py-4 ' + (canCheck || graded ? 'bg-brand-500' : 'bg-stone-300')}
      >
        <Text className="text-base font-extrabold text-white">{graded ? 'Continue' : 'Check'}</Text>
      </TouchableOpacity>
    </View>
  );
}
