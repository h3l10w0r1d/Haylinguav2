// src/ExerciseRenderer.jsx
import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Volume2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

const XP_VALUES = {
  char_intro: 5,
  char_mcq_sound: 10,
  char_build_word: 15,
  letter_recognition: 10,
  letter_typing: 10,
};

function ResultBanner({ isCorrect, xp, onContinue }) {
  if (isCorrect === null) return null;

  return (
    <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
      <div className="flex items-center gap-2">
        {isCorrect ? (
          <CheckCircle2 className="w-6 h-6 text-green-500" />
        ) : (
          <XCircle className="w-6 h-6 text-red-500" />
        )}
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {isCorrect ? 'Nice job!' : 'Not quite.'}
          </p>
          <p className="text-xs text-gray-500">
            {isCorrect
              ? `You earned ${xp} XP for this step.`
              : 'You’ll get another chance in future exercises.'}
          </p>
        </div>
      </div>
      <button
        onClick={onContinue}
        className="w-full sm:w-auto px-5 py-2 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 transition-colors"
      >
        Continue
      </button>
    </div>
  );
}

/* ------------------------------------------------------
   1) INTRO LETTER – "char_intro"
------------------------------------------------------ */

function CharIntroExercise({ exercise, onAnswer }) {
  const cfg = exercise.config || {};
  const letter = cfg.letter || 'Ա';
  const lower = cfg.lower || 'ա';
  const translit = cfg.transliteration || '';
  const hint = cfg.hint || '';

  const [answered, setAnswered] = useState(false);

  const handleContinue = () => {
    if (answered) return;
    setAnswered(true);
    onAnswer({ isCorrect: true, xpEarned: XP_VALUES.char_intro });
  };

  return (
    <div className="bg-white rounded-3xl shadow-md p-6 sm:p-8 flex flex-col items-center text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-medium mb-4">
        <Sparkles className="w-4 h-4" />
        New letter unlocked
      </div>

      <p className="text-gray-700 mb-6 max-w-xl">{exercise.prompt}</p>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 mb-4">
        <div className="relative">
          <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-3xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg">
            <span className="text-7xl sm:text-8xl font-semibold text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.35)]">
              {letter}
            </span>
          </div>
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white text-orange-700 text-xs shadow-md">
            Uppercase
          </div>
        </div>

        <div className="flex flex-col items-center sm:items-start gap-3">
          <div className="px-4 py-2 rounded-2xl bg-gray-50 border border-gray-200">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Lowercase
            </p>
            <p className="text-4xl font-semibold text-gray-900">{lower}</p>
          </div>

          {translit && (
            <div className="px-4 py-2 rounded-2xl bg-orange-50 border border-orange-100">
              <p className="text-xs text-orange-700 mb-1">Sound</p>
              <p className="text-lg font-semibold text-orange-800">
                {translit}
              </p>
            </div>
          )}

          {hint && (
            <p className="text-xs text-gray-500 max-w-xs">
              {hint}
            </p>
          )}
        </div>
      </div>

      <button
        onClick={handleContinue}
        className="mt-4 px-8 py-3 rounded-2xl bg-orange-600 text-white font-semibold text-sm hover:bg-orange-700 transition-colors shadow-md"
      >
        Got it, continue
      </button>
    </div>
  );
}

/* ------------------------------------------------------
   2) MULTIPLE-CHOICE SOUND – "char_mcq_sound"
------------------------------------------------------ */

function CharMcqSoundExercise({ exercise, onAnswer }) {
  const cfg = exercise.config || {};
  const letter = cfg.letter || '?';
  const options = cfg.options || [];
  const correctIndex =
    typeof cfg.correctIndex === 'number' ? cfg.correctIndex : 0;

  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null); // true | false | null

  const hasAnswered = result !== null;

  const handleOptionClick = (idx) => {
    if (hasAnswered) return;
    const isCorrect = idx === correctIndex;
    setSelected(idx);
    setResult(isCorrect);
  };

  const handleContinue = () => {
    if (!hasAnswered) return;
    const xp = result ? XP_VALUES.char_mcq_sound : 0;
    onAnswer({ isCorrect: !!result, xpEarned: xp });
  };

  return (
    <div className="bg-white rounded-3xl shadow-md p-6 sm:p-8">
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-700 font-medium">{exercise.prompt}</p>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-gray-500 px-3 py-1 rounded-full bg-gray-50 border border-gray-200"
        >
          <Volume2 className="w-4 h-4" />
          <span>Play sound</span>
        </button>
      </div>

      <div className="flex flex-col items-center mb-6">
        <div className="w-32 h-32 rounded-3xl bg-gradient-to-tl from-orange-500 to-red-500 flex items-center justify-center shadow-md mb-3">
          <span className="text-6xl font-semibold text-white">
            {letter}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          Tap the correct pronunciation below
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map((opt, idx) => {
          const isSelected = idx === selected;
          const isCorrect = idx === correctIndex;

          let border = 'border-gray-200';
          let bg = 'bg-white';
          let text = 'text-gray-800';

          if (hasAnswered && isSelected && result) {
            border = 'border-green-500';
            bg = 'bg-green-50';
          } else if (hasAnswered && isSelected && !result) {
            border = 'border-red-500';
            bg = 'bg-red-50';
          } else if (hasAnswered && isCorrect) {
            border = 'border-green-400';
            bg = 'bg-green-50';
          }

          return (
            <button
              key={idx}
              onClick={() => handleOptionClick(idx)}
              className={`relative px-4 py-3 rounded-2xl border ${border} ${bg} ${text} text-base font-medium transition-all hover:shadow-sm ${
                hasAnswered ? 'cursor-default' : 'hover:-translate-y-0.5'
              }`}
            >
              {opt}
              {hasAnswered && isCorrect && (
                <CheckCircle2 className="w-5 h-5 text-green-500 absolute top-2 right-2" />
              )}
            </button>
          );
        })}
      </div>

      <ResultBanner
        isCorrect={result}
        xp={result ? XP_VALUES.char_mcq_sound : 0}
        onContinue={handleContinue}
      />
    </div>
  );
}

/* ------------------------------------------------------
   3) BUILD WORD – "char_build_word"
------------------------------------------------------ */

function CharBuildWordExercise({ exercise, onAnswer }) {
  const cfg = exercise.config || {};
  const targetWord = cfg.targetWord || '';
  const tiles = cfg.tiles || [];
  const solutionIndices = cfg.solutionIndices || [];

  const [selectedIndices, setSelectedIndices] = useState([]);
  const [result, setResult] = useState(null); // true | false | null

  const currentWord = selectedIndices.map((i) => tiles[i]).join('');
  const hasAnswered = result !== null;

  const handleTileClick = (idx) => {
    if (hasAnswered) return;
    setSelectedIndices((prev) => {
      if (prev.includes(idx)) {
        return prev.filter((i) => i !== idx);
      }
      return [...prev, idx];
    });
  };

  const handleCheck = () => {
    if (!selectedIndices.length || hasAnswered) return;

    const correctWord = solutionIndices.map((i) => tiles[i]).join('');
    const isCorrect = currentWord === correctWord;
    setResult(isCorrect);
  };

  const handleClear = () => {
    if (hasAnswered) return;
    setSelectedIndices([]);
  };

  const handleContinue = () => {
    if (!hasAnswered) return;
    const xp = result ? XP_VALUES.char_build_word : 0;
    onAnswer({ isCorrect: !!result, xpEarned: xp });
  };

  return (
    <div className="bg-white rounded-3xl shadow-md p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <p className="text-gray-700 font-medium">{exercise.prompt}</p>
        {targetWord && (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-100 text-xs text-orange-700">
            <Sparkles className="w-4 h-4" />
            Target: <span className="font-semibold">{targetWord}</span>
          </div>
        )}
      </div>

      <div className="min-h-[4rem] mb-4 flex items-center justify-center border border-dashed border-orange-300 rounded-2xl px-4 py-3 bg-orange-50/60">
        {currentWord ? (
          <span className="text-3xl text-orange-800 tracking-wide">
            {currentWord}
          </span>
        ) : (
          <span className="text-sm text-gray-400">
            Tap letters below to build the word
          </span>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-3 mb-4">
        {tiles.map((tile, idx) => {
          const isSelected = selectedIndices.includes(idx);
          const baseClasses =
            'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-2xl font-semibold border transition-all shadow-sm';

          const selectedClasses =
            'bg-orange-600 border-orange-700 text-white scale-105 shadow-md';
          const unselectedClasses =
            'bg-white border-gray-200 text-gray-900 hover:bg-orange-50 hover:-translate-y-0.5';

          return (
            <button
              key={idx}
              onClick={() => handleTileClick(idx)}
              className={`${baseClasses} ${
                isSelected ? selectedClasses : unselectedClasses
              } ${hasAnswered ? 'cursor-default hover:translate-y-0' : ''}`}
            >
              {tile}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          onClick={handleClear}
          disabled={hasAnswered || !selectedIndices.length}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-default"
        >
          <RefreshCw className="w-4 h-4" />
          Clear
        </button>

        <button
          onClick={handleCheck}
          disabled={hasAnswered || !selectedIndices.length}
          className="px-6 py-2 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-default"
        >
          Check
        </button>
      </div>

      <ResultBanner
        isCorrect={result}
        xp={result ? XP_VALUES.char_build_word : 0}
        onContinue={handleContinue}
      />
    </div>
  );
}

/* ------------------------------------------------------
   4) LETTER RECOGNITION – "letter_recognition"
------------------------------------------------------ */

function LetterRecognitionExercise({ exercise, onAnswer }) {
  const cfg = exercise.config || {};
  const options = cfg.options || cfg.letters || [];
  const expected = (exercise.expected_answer || '').trim();
  let correctIndex = cfg.correctIndex;

  if (typeof correctIndex !== 'number' && expected && options.length) {
    correctIndex = options.findIndex(
      (opt) => (opt || '').trim() === expected
    );
    if (correctIndex === -1) correctIndex = 0;
  }

  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);

  const hasAnswered = result !== null;

  const handleClick = (idx) => {
    if (hasAnswered) return;
    setSelected(idx);
    setResult(idx === correctIndex);
  };

  const handleContinue = () => {
    if (!hasAnswered) return;
    const xp = result ? XP_VALUES.letter_recognition : 0;
    onAnswer({ isCorrect: !!result, xpEarned: xp });
  };

  return (
    <div className="bg-white rounded-3xl shadow-md p-6 sm:p-8">
      <p className="text-gray-700 font-medium mb-6">{exercise.prompt}</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        {options.map((opt, idx) => {
          const isSelected = idx === selected;
          const isCorrect = idx === correctIndex;

          let border = 'border-gray-200';
          let bg = 'bg-white';
          let text = 'text-gray-900';

          if (hasAnswered && isSelected && result) {
            border = 'border-green-500';
            bg = 'bg-green-50';
          } else if (hasAnswered && isSelected && !result) {
            border = 'border-red-500';
            bg = 'bg-red-50';
          } else if (hasAnswered && isCorrect) {
            border = 'border-green-400';
            bg = 'bg-green-50';
          }

          return (
            <button
              key={idx}
              onClick={() => handleClick(idx)}
              className={`w-full h-16 rounded-2xl border ${border} ${bg} ${text} text-2xl font-semibold flex items-center justify-center transition-all ${
                hasAnswered ? 'cursor-default' : 'hover:-translate-y-0.5'
              }`}
            >
              {opt}
              {hasAnswered && isCorrect && (
                <CheckCircle2 className="w-5 h-5 text-green-500 absolute top-2 right-2" />
              )}
            </button>
          );
        })}
      </div>

      <ResultBanner
        isCorrect={result}
        xp={result ? XP_VALUES.letter_recognition : 0}
        onContinue={handleContinue}
      />
    </div>
  );
}

/* ------------------------------------------------------
   5) LETTER TYPING – "letter_typing"
------------------------------------------------------ */

function LetterTypingExercise({ exercise, onAnswer }) {
  const cfg = exercise.config || {};
  const placeholder = cfg.placeholder || 'Type here…';
  const expectedRaw = (exercise.expected_answer || '').trim();

  const [value, setValue] = useState('');
  const [result, setResult] = useState(null); // true | false | null

  const hasAnswered = result !== null;

  const normalise = (s) => s.trim();

  const handleCheck = () => {
    if (!value || hasAnswered) return;
    const isCorrect =
      expectedRaw === '' || normalise(value) === normalise(expectedRaw);
    setResult(isCorrect);
  };

  const handleContinue = () => {
    if (!hasAnswered) return;
    const xp = result ? XP_VALUES.letter_typing : 0;
    onAnswer({ isCorrect: !!result, xpEarned: xp });
  };

  return (
    <div className="bg-white rounded-3xl shadow-md p-6 sm:p-8">
      <p className="text-gray-700 font-medium mb-4">{exercise.prompt}</p>

      <div className="flex flex-col gap-4 mb-2">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (hasAnswered) setResult(null);
          }}
          className="w-full max-w-xs mx-auto px-4 py-3 rounded-2xl border border-gray-300 text-center text-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          placeholder={placeholder}
        />

        <div className="flex justify-center gap-3">
          <button
            onClick={() => setValue('')}
            disabled={!value || hasAnswered}
            className="px-4 py-2 rounded-xl border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-default"
          >
            Clear
          </button>
          <button
            onClick={handleCheck}
            disabled={!value || hasAnswered}
            className="px-6 py-2 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-default"
          >
            Check
          </button>
        </div>
      </div>

      <ResultBanner
        isCorrect={result}
        xp={result ? XP_VALUES.letter_typing : 0}
        onContinue={handleContinue}
      />
    </div>
  );
}

/* ------------------------------------------------------
   MAIN RENDERER
------------------------------------------------------ */

export default function ExerciseRenderer({ exercise, onAnswer }) {
  if (!exercise) return null;

  switch (exercise.kind) {
    case 'char_intro':
      return <CharIntroExercise exercise={exercise} onAnswer={onAnswer} />;
    case 'char_mcq_sound':
      return <CharMcqSoundExercise exercise={exercise} onAnswer={onAnswer} />;
    case 'char_build_word':
      return <CharBuildWordExercise exercise={exercise} onAnswer={onAnswer} />;
    case 'letter_recognition':
      return (
        <LetterRecognitionExercise exercise={exercise} onAnswer={onAnswer} />
      );
    case 'letter_typing':
      return <LetterTypingExercise exercise={exercise} onAnswer={onAnswer} />;
    default:
      return (
        <div className="bg-white rounded-3xl shadow-md p-6 sm:p-8">
          <p className="text-gray-700 mb-4">
            Unknown exercise type:{' '}
            <code className="bg-gray-100 px-1 rounded">{exercise.kind}</code>
          </p>
          <button
            onClick={() => onAnswer({ isCorrect: true, xpEarned: 0 })}
            className="px-4 py-2 bg-orange-600 text-white rounded-xl text-sm"
          >
            Skip this step
          </button>
        </div>
      );
  }
}
