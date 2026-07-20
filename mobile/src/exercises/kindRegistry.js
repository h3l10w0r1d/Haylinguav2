// src/exercises/kindRegistry.js — the exercise-kind → component map, shared
// by every screen that plays through a list of exercises (LessonScreen,
// CheckpointScreen, PracticeScreen) so they don't each duplicate 13+ kind
// imports. Also the "unsupported kind" fallback all three render the same way.
import React from 'react';
import { View, Text } from 'react-native';
import CharIntro from './kinds/CharIntro';
import TranslateMcq from './kinds/TranslateMcq';
import LetterRecognition from './kinds/LetterRecognition';
import SelectMissingWord from './kinds/SelectMissingWord';
import MinimalPairs from './kinds/MinimalPairs';
import TrueFalse from './kinds/TrueFalse';
import MatchPairs from './kinds/MatchPairs';
import AudioChoiceTts from './kinds/AudioChoiceTts';
import CharBuildWord from './kinds/CharBuildWord';
import WordBank from './kinds/WordBank';
import SentenceOrder from './kinds/SentenceOrder';
import Speak from './kinds/Speak';
import ListenType from './kinds/ListenType';
import WriteTranslate from './kinds/WriteTranslate';
import Pressable3D from '../components/Pressable3D';

export const SUPPORTED_KINDS = {
  char_intro: CharIntro,
  translate_mcq: TranslateMcq,
  letter_recognition: LetterRecognition,
  select_missing_word: SelectMissingWord,
  minimal_pairs: MinimalPairs,
  true_false: TrueFalse,
  match_pairs: MatchPairs,
  audio_choice_tts: AudioChoiceTts,
  char_build_word: CharBuildWord,
  word_bank: WordBank,
  sentence_order: SentenceOrder,
  speak: Speak,
  listen_type: ListenType,
  write_translate: WriteTranslate,
};

export function UnsupportedKindFallback({ kind, onAdvance }) {
  return (
    <View className="flex-1 justify-between">
      <View className="items-center justify-center pt-16">
        <Text className="text-center text-base font-bold text-stone-600">
          Exercise type "{kind}" isn't supported in this Phase 0 build yet.
        </Text>
      </View>
      <Pressable3D onPress={onAdvance} className="items-center rounded-2xl bg-stone-800 py-4">
        <Text className="text-base font-extrabold text-white">Skip</Text>
      </Pressable3D>
    </View>
  );
}
