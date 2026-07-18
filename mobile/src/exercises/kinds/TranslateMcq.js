// src/exercises/kinds/TranslateMcq.js — ports ExTranslateMcq from
// src/ExerciseRenderer.jsx. Multiple-choice: pick the right translation from
// exercise.options (server-authoritative — `is_correct` there is a client
// hint only, the real grading happens server-side in POST .../attempt).
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Volume2 } from 'lucide-react-native';
import { playExerciseAudio } from '../../lib/playExerciseAudio';

export default function TranslateMcq({ exercise, onSubmit, onAdvance }) {
  const cfg = exercise.config || {};
  const options = exercise.options || [];
  const [selected, setSelected] = useState(null);
  const [graded, setGraded] = useState(null);

  useEffect(() => {
    setSelected(null);
    setGraded(null);
  }, [exercise.id]);

  const canCheck = selected !== null && !graded;

  function check() {
    const picked = options[selected];
    setGraded({ picked: selected });
    onSubmit({
      selectedIndices: [selected],
      answerText: picked?.text ?? '',
    }).then((result) => {
      setGraded({ picked: selected, correct: result?.ok });
    });
  }

  return (
    <View className="flex-1 justify-between">
      <View>
        <Text className="text-lg font-extrabold text-stone-900">{exercise.prompt || 'Choose the correct translation'}</Text>

        {!!cfg.sentence && (
          <View className="mt-4 rounded-2xl bg-stone-100 p-4">
            <Text className="text-lg font-semibold text-stone-900">{cfg.sentence}</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => playExerciseAudio(exercise.id)}
          className="mt-4 flex-row items-center gap-2 self-start rounded-xl bg-feather-50 px-4 py-2.5"
        >
          <Volume2 size={16} color="#1899D6" />
          <Text className="text-sm font-bold text-feather-600">Play sound</Text>
        </TouchableOpacity>

        <View className="mt-5" style={{ gap: 10 }}>
          {options.map((opt, i) => {
            const isSelected = selected === i;
            const showResult = !!graded;
            const isRight = showResult && opt.is_correct;
            const isWrongPick = showResult && isSelected && !opt.is_correct;
            return (
              <TouchableOpacity
                key={opt.id ?? i}
                disabled={!!graded}
                onPress={() => setSelected(i)}
                className={
                  'rounded-2xl border-2 px-4 py-3.5 ' +
                  (isRight
                    ? 'border-grass-500 bg-grass-50'
                    : isWrongPick
                    ? 'border-cardinal-500 bg-cardinal-50'
                    : isSelected
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-stone-200 bg-white')
                }
              >
                <Text className="text-base font-semibold text-stone-800">{opt.text}</Text>
              </TouchableOpacity>
            );
          })}
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
