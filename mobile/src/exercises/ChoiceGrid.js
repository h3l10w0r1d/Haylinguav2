// src/exercises/ChoiceGrid.js — ports ChoiceGrid from src/exercises/ui.jsx.
// Single-select only for now (multi-select exercises aren't in Phase 0/1
// scope — none of the ported kinds need it).
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export default function ChoiceGrid({ choices, selected, onSelect, graded }) {
  return (
    <View style={{ gap: 10 }}>
      {choices.map((text, i) => {
        const isSelected = selected === i;
        const isRight = graded && i === graded.correct;
        const isWrongPick = graded && isSelected && i !== graded.correct;
        return (
          <TouchableOpacity
            key={i}
            disabled={!!graded}
            onPress={() => onSelect(i)}
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
            <Text className="text-base font-semibold text-stone-800">{text}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
