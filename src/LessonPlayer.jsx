// src/LessonPlayer.jsx
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Volume2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

const API_BASE = 'https://haylinguav2.onrender.com';

export default function LessonPlayer() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(0);

  // interaction state
  const [typedAnswer, setTypedAnswer] = useState('');
  const [selectedIndices, setSelectedIndices] = useState([]); // used for mcq + find-in-grid
  const [builtIndices, setBuiltIndices] = useState([]); // used for build-word / listen-build
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong" | null
  const [isSpeaking, setIsSpeaking] = useState(false);

  // ----------------------------------------------------
  // Fetch lesson
  // ----------------------------------------------------
  useEffect(() => {
    let isCancelled = false;

    async function loadLesson() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`${API_BASE}/lessons/${slug}`);
        if (!res.ok) {
          throw new Error(`Failed to load lesson: ${res.status}`);
        }
        const data = await res.json();
        if (!isCancelled) {
          setLesson(data);
          setCurrentIndex(0);
          resetExerciseState();
        }
      } catch (err) {
        console.error('Error loading lesson', err);
        if (!isCancelled) setLoadError(err.message || 'Failed to load lesson');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadLesson();
    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const resetExerciseState = () => {
    setTypedAnswer('');
    setSelectedIndices([]);
    setBuiltIndices([]);
    setFeedback(null);
  };

  const currentExercise =
    lesson && lesson.exercises && lesson.exercises[currentIndex]
      ? lesson.exercises[currentIndex]
      : null;

  // ----------------------------------------------------
  // TTS logic
  // ----------------------------------------------------
  const speak = useCallback(async (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    try {
      setIsSpeaking(true);
      const res = await fetch(`${API_BASE}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });

      if (!res.ok) {
        console.error('TTS error status', res.status);
        throw new Error(`TTS failed: ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (err) {
      console.error('TTS request failed', err);
    } finally {
      setIsSpeaking(false);
    }
  }, []);

  const getAutoSpeakText = (exercise) => {
    if (!exercise) return '';
    const cfg = exercise.config || {};

    switch (exercise.kind) {
      case 'char_intro':
        return cfg.letter || cfg.targetWord || exercise.prompt;
      case 'char_mcq_sound':
        return cfg.letter || cfg.ttsText || exercise.prompt;
      case 'char_build_word':
      case 'char_listen_build':
        return cfg.targetWord || exercise.prompt;
      case 'char_find_in_word':
        return cfg.word || exercise.prompt;
      case 'char_find_in_grid':
        return cfg.targetLetter || exercise.prompt;
      case 'char_type_translit':
        return cfg.letter || exercise.prompt;
      default:
        return exercise.prompt;
    }
  };

  // auto-play when exercise changes
  useEffect(() => {
    if (!currentExercise) return;
    const text = getAutoSpeakText(currentExercise);
    if (text) {
      speak(text);
    }
  }, [currentExercise, speak]);

  // ----------------------------------------------------
  // Answer logic helpers
  // ----------------------------------------------------

  // multiple choice sound (single correct index)
  const handleSelectOption = (index) => {
    if (!currentExercise || currentExercise.kind !== 'char_mcq_sound') return;
    const cfg = currentExercise.config || {};
    const correctIndex = cfg.correctIndex;

    const isCorrect = index === correctIndex;

    setSelectedIndices([index]);
    setFeedback(isCorrect ? 'correct' : 'wrong');
  };

  // shared toggler for "find" exercises (word/grid)
  const toggleIndexSelection = (idx) => {
    setSelectedIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  // build-word & listen-build tiles
  const handleTapTileForBuild = (tileIndex) => {
    if (!currentExercise) return;
    const cfg = currentExercise.config || {};
    const tiles = cfg.tiles || [];

    if (tileIndex < 0 || tileIndex >= tiles.length) return;
    if (builtIndices.includes(tileIndex)) return;

    setBuiltIndices((prev) => [...prev, tileIndex]);
  };

  const handleResetBuild = () => {
    setBuiltIndices([]);
    setFeedback(null);
  };

  const builtWord = (() => {
    if (!currentExercise) return '';
    const cfg = currentExercise.config || {};
    const tiles = cfg.tiles || [];
    return builtIndices.map((i) => tiles[i]).join('');
  })();

  const checkBuildWord = () => {
    if (!currentExercise) return;
    const cfg = currentExercise.config || {};
    const target = cfg.targetWord || currentExercise.expected_answer || '';
    const isCorrect = builtWord === target;
    setFeedback(isCorrect ? 'correct' : 'wrong');
  };

  const checkTypedAnswer = () => {
    if (!currentExercise) return;
    const expected =
      (currentExercise.expected_answer || '').trim().toLowerCase();
    const user = (typedAnswer || '').trim().toLowerCase();
    if (!expected) return;

    setFeedback(user === expected ? 'correct' : 'wrong');
  };

  // for char_find_in_word / char_find_in_grid
  const checkFindSelection = () => {
    if (!currentExercise) return;
    const cfg = currentExercise.config || {};
    let expected = [];

    if (currentExercise.kind === 'char_find_in_word') {
      const word = cfg.word || '';
      const target = cfg.targetLetter || cfg.letter || '';
      for (let i = 0; i < word.length; i++) {
        if (word[i] === target) expected.push(i);
      }
    } else if (currentExercise.kind === 'char_find_in_grid') {
      const grid = cfg.grid || [];
      const target = cfg.targetLetter || cfg.letter || '';
      grid.forEach((ch, idx) => {
        if (ch === target) expected.push(idx);
      });
    }

    const sortNum = (arr) => [...arr].sort((a, b) => a - b);
    const isCorrect =
      expected.length > 0 &&
      expected.length === selectedIndices.length &&
      JSON.stringify(sortNum(expected)) === JSON.stringify(sortNum(selectedIndices));

    setFeedback(isCorrect ? 'correct' : 'wrong');
  };

  // ----------------------------------------------------
  // Navigation
  // ----------------------------------------------------
  const goPrev = () => {
    if (!lesson) return;
    if (currentIndex <= 0) return;
    setCurrentIndex((i) => i - 1);
    resetExerciseState();
  };

  const goNext = () => {
    if (!lesson) return;
    if (currentIndex >= lesson.exercises.length - 1) return;
    setCurrentIndex((i) => i + 1);
    resetExerciseState();
  };

  // ----------------------------------------------------
  // Render per-kind bodies
  // ----------------------------------------------------
  const renderExerciseBody = () => {
    if (!currentExercise) return null;
    const cfg = currentExercise.config || {};

    const clickableSpeak = (text, extraClass = '') => (
      <button
        type="button"
        className={`inline-flex items-center justify-center rounded-xl border px-4 py-2 hover:bg-orange-50 transition ${extraClass}`}
        onClick={() => speak(text)}
      >
        <Volume2 className="w-4 h-4 mr-2" />
        <span className="text-lg">{text}</span>
      </button>
    );

    switch (currentExercise.kind) {
      // ------------------------------------------------
      // 1) INTRO LETTER
      // ------------------------------------------------
      case 'char_intro': {
        const letter = cfg.letter || '?';
        const lower = cfg.lower || '';
        const translit = cfg.transliteration || '';
        const hint = cfg.hint || '';

        return (
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-4">
              <div
                className="w-28 h-28 rounded-3xl bg-orange-100 flex items-center justify-center text-6xl cursor-pointer hover:bg-orange-200 transition"
                onClick={() => speak(letter)}
              >
                {letter}
              </div>
              {lower && (
                <div
                  className="w-20 h-20 rounded-3xl bg-orange-50 flex items-center justify-center text-4xl cursor-pointer hover:bg-orange-100 transition"
                  onClick={() => speak(lower)}
                >
                  {lower}
                </div>
              )}
            </div>

            {translit && (
              <div className="text-lg text-gray-700">
                Sounds like:&nbsp;
                <span className="font-semibold">{translit}</span>
              </div>
            )}

            {hint && (
              <div className="mt-2 text-sm text-gray-600 bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3">
                {hint}
              </div>
            )}

            <button
              type="button"
              onClick={() => speak(letter)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white hover:bg-orange-700 transition"
            >
              <Volume2 className="w-5 h-5" />
              Hear again
            </button>
          </div>
        );
      }

      // ------------------------------------------------
      // 2) WHICH SOUND? (MCQ)
      // ------------------------------------------------
      case 'char_mcq_sound': {
        const letter = cfg.letter || '?';
        const options = cfg.options || [];
        const correctIndex = cfg.correctIndex;

        return (
          <div className="flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-24 h-24 rounded-3xl bg-orange-100 flex items-center justify-center text-5xl cursor-pointer hover:bg-orange-200 transition"
                onClick={() => speak(letter)}
              >
                {letter}
              </div>
              <button
                type="button"
                onClick={() => speak(letter)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white hover:bg-orange-700 transition"
              >
                <Volume2 className="w-5 h-5" />
                Play sound
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full max-w-md">
              {options.map((opt, idx) => {
                const isSelected = selectedIndices.includes(idx);
                const isCorrect = idx === correctIndex;
                const isWrongSelection =
                  feedback === 'wrong' && isSelected && !isCorrect;
                const isRightSelection =
                  feedback === 'correct' && isSelected && isCorrect;

                let borderColor = 'border-gray-300';
                if (isRightSelection) borderColor = 'border-green-500';
                else if (isWrongSelection) borderColor = 'border-red-500';
                else if (isSelected) borderColor = 'border-orange-500';

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      handleSelectOption(idx);
                      speak(opt);
                    }}
                    className={`flex items-center justify-center rounded-2xl border px-4 py-3 text-lg bg-white hover:bg-orange-50 transition ${borderColor}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      // ------------------------------------------------
      // 3) BUILD WORD (VISUAL TARGET)
      // ------------------------------------------------
      case 'char_build_word': {
        const tiles = cfg.tiles || [];
        const target = cfg.targetWord || currentExercise.expected_answer || '';

        return (
          <div className="flex flex-col items-center gap-6">
            <div
              className="min-h-[60px] px-6 py-3 rounded-2xl bg-orange-50 flex items-center justify-center text-3xl cursor-pointer"
              onClick={() => speak(builtWord || target)}
            >
              {builtWord || target || 'Tap letters below to build the word'}
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              {tiles.map((ch, idx) => {
                const used = builtIndices.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      handleTapTileForBuild(idx);
                      speak(ch);
                    }}
                    className={`w-14 h-14 rounded-2xl border text-2xl flex items-center justify-center transition ${
                      used
                        ? 'bg-gray-200 border-gray-300 text-gray-500'
                        : 'bg-white border-orange-300 hover:bg-orange-50'
                    }`}
                  >
                    {ch}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={checkBuildWord}
                className="px-5 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 transition"
              >
                Check
              </button>
              <button
                type="button"
                onClick={handleResetBuild}
                className="px-5 py-2 rounded-xl bg-gray-100 text-gray-800 hover:bg-gray-200 transition"
              >
                Reset
              </button>
            </div>
          </div>
        );
      }

      // ------------------------------------------------
      // 4) LISTEN & BUILD (NEW)
      // ------------------------------------------------
      case 'char_listen_build': {
        const tiles = cfg.tiles || [];
        const target = cfg.targetWord || currentExercise.expected_answer || '';
        const hint = cfg.hint || 'Listen, then build what you hear.';

        return (
          <div className="flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => speak(target)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-orange-600 text-white hover:bg-orange-700 transition"
              >
                <Volume2 className="w-5 h-5" />
                Listen
              </button>
              <p className="text-sm text-gray-600 text-center max-w-md">
                {hint}
              </p>
            </div>

            <div
              className="min-h-[60px] px-6 py-3 rounded-2xl bg-orange-50 flex items-center justify-center text-3xl cursor-pointer"
              onClick={() => speak(builtWord || target)}
            >
              {builtWord || 'Tap letters below to build the word you hear'}
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              {tiles.map((ch, idx) => {
                const used = builtIndices.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      handleTapTileForBuild(idx);
                      speak(ch);
                    }}
                    className={`w-14 h-14 rounded-2xl border text-2xl flex items-center justify-center transition ${
                      used
                        ? 'bg-gray-200 border-gray-300 text-gray-500'
                        : 'bg-white border-orange-300 hover:bg-orange-50'
                    }`}
                  >
                    {ch}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={checkBuildWord}
                className="px-5 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 transition"
              >
                Check
              </button>
              <button
                type="button"
                onClick={handleResetBuild}
                className="px-5 py-2 rounded-xl bg-gray-100 text-gray-800 hover:bg-gray-200 transition"
              >
                Reset
              </button>
            </div>
          </div>
        );
      }

      // ------------------------------------------------
      // 5) FIND LETTER IN GRID (NEW)
      // ------------------------------------------------
      case 'char_find_in_grid': {
        const grid = cfg.grid || [];
        const targetLetter = cfg.targetLetter || cfg.letter || '?';
        const columns = cfg.columns || 4;

        return (
          <div className="flex flex-col items-center gap-6">
            <p className="text-gray-700">
              Tap every{' '}
              <span className="font-bold text-orange-700">{targetLetter}</span>{' '}
              in the grid.
            </p>

            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-50 text-orange-800 cursor-pointer hover:bg-orange-100"
              onClick={() => speak(targetLetter)}
            >
              <Volume2 className="w-4 h-4" />
              Hear the target letter
            </div>

            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {grid.map((ch, idx) => {
                const selected = selectedIndices.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      toggleIndexSelection(idx);
                      speak(ch);
                    }}
                    className={`w-14 h-14 rounded-2xl border text-2xl flex items-center justify-center transition ${
                      selected
                        ? 'bg-orange-100 border-orange-500'
                        : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {ch}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={checkFindSelection}
              className="mt-2 px-5 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 transition"
            >
              Check
            </button>
          </div>
        );
      }

      // ------------------------------------------------
      // 6) TYPE TRANSLITERATION
      // ------------------------------------------------
      case 'char_type_translit': {
        const letter = cfg.letter || '?';

        return (
          <div className="flex flex-col items-center gap-6">
            <div
              className="w-24 h-24 rounded-3xl bg-orange-100 flex items-center justify-center text-5xl cursor-pointer hover:bg-orange-200 transition"
              onClick={() => speak(letter)}
            >
              {letter}
            </div>

            <input
              type="text"
              value={typedAnswer}
              onChange={(e) => {
                setTypedAnswer(e.target.value);
                setFeedback(null);
              }}
              placeholder="Type the sound using Latin letters..."
              className="w-full max-w-md px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />

            <button
              type="button"
              onClick={checkTypedAnswer}
              className="px-5 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 transition"
            >
              Check
            </button>
          </div>
        );
      }

      // ------------------------------------------------
      // DEFAULT / UNKNOWN TYPES
      // ------------------------------------------------
      default:
        return (
          <div className="flex flex-col items-center gap-4">
            <p className="text-lg text-gray-800 text-center">
              {currentExercise.prompt}
            </p>
            {clickableSpeak(currentExercise.prompt, 'mt-2')}
            <p className="text-sm text-gray-500 mt-4">
              This exercise type (“{currentExercise.kind}”) has no custom UI yet.
            </p>
          </div>
        );
    }
  };

  const renderFeedback = () => {
    if (!feedback) return null;
    if (feedback === 'correct') {
      return (
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 text-green-700 border border-green-200">
          <CheckCircle2 className="w-5 h-5" />
          Nice! That’s correct.
        </div>
      );
    }
    if (feedback === 'wrong') {
      return (
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-700 border border-red-200">
          <XCircle className="w-5 h-5" />
          Not quite. Try again.
        </div>
      );
    }
    return null;
  };

  // ----------------------------------------------------
  // Top-level render
  // ----------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <p className="text-gray-600">Loading lesson…</p>
      </div>
    );
  }

  if (loadError || !lesson) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-orange-50">
        <p className="text-red-600 mb-4">
          {loadError || 'Could not load this lesson.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 rounded-xl bg-orange-600 text-white hover:bg-orange-700"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const progressPercent =
    lesson.exercises && lesson.exercises.length > 0
      ? ((currentIndex + 1) / lesson.exercises.length) * 100
      : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>

          <div className="text-right">
            <div className="text-sm text-gray-500">
              {lesson.title || 'Lesson'}
            </div>
            <div className="text-xs text-gray-400">
              Exercise {currentIndex + 1} of {lesson.exercises.length}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-orange-500 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Exercise card */}
        <div className="bg-white rounded-3xl shadow-sm border border-orange-100 p-6 md:p-8">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-xl font-semibold text-gray-900">
              {currentExercise ? currentExercise.prompt : 'Exercise'}
            </h1>
            <button
              type="button"
              onClick={() =>
                currentExercise && speak(getAutoSpeakText(currentExercise))
              }
              className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-orange-50 text-orange-700 hover:bg-orange-100 transition"
              title="Play again"
            >
              <Volume2 className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 flex flex-col items-center">
            {renderExerciseBody()}
            {renderFeedback()}
          </div>
        </div>

        {/* Bottom navigation */}
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentIndex === 0}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${
              currentIndex === 0
                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <button
            type="button"
            onClick={goNext}
            disabled={currentIndex >= lesson.exercises.length - 1}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ${
              currentIndex >= lesson.exercises.length - 1
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-orange-600 text-white hover:bg-orange-700'
            }`}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {isSpeaking && (
          <div className="mt-3 text-xs text-gray-400 text-right">
            Playing audio…
          </div>
        )}
      </div>
    </div>
  );
}
