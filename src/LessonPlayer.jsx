// src/LessonPlayer.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

const API_BASE = 'https://haylinguav2.onrender.com';

export default function LessonPlayer() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [textAnswer, setTextAnswer] = useState('');
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(null);
  const [builtIndices, setBuiltIndices] = useState([]);
  const [feedback, setFeedback] = useState(null); // 'correct' | 'wrong' | null

  // fetch lesson ----------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadLesson() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/lessons/${slug}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Lesson not found');
          }
          throw new Error(`Failed to load lesson (${res.status})`);
        }
        const data = await res.json();
        if (!cancelled) {
          setLesson(data);
          setCurrentIndex(0);
          resetExerciseState();
          console.log('Loaded lesson', data);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadLesson();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  function resetExerciseState() {
    setTextAnswer('');
    setSelectedOptionIndex(null);
    setBuiltIndices([]);
    setFeedback(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <p className="text-gray-600">Loading lesson…</p>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md text-center">
          <p className="text-gray-800 mb-4">
            {error || 'Lesson not found.'}
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 rounded-full bg-orange-600 text-white hover:bg-orange-700 transition"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const exercises = lesson.exercises ?? [];
  const totalExercises = exercises.length;

  // If there are no exercises at all
  if (totalExercises === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-orange-50">
        <div className="bg-white rounded-2xl shadow p-8 max-w-md text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            {lesson.title}
          </h1>
          <p className="text-gray-600 mb-6">
            {lesson.description ||
              'This lesson has no exercises yet. Once we add them in the backend, they’ll appear here automatically.'}
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 rounded-full bg-orange-600 text-white hover:bg-orange-700 transition"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentExercise = exercises[currentIndex];

  // navigation -------------------------------------------------------------------
  const isLastExercise = currentIndex === totalExercises - 1;

  function handleNext() {
    // Do not allow skipping alphabet-like tasks without *some* interaction
    if (currentExercise.kind === 'char_mcq_sound') {
      if (feedback !== 'correct') return; // must answer correctly
    }

    if (currentExercise.kind === 'char_build_word') {
      const cfg = currentExercise.config || {};
      const solution = cfg.solutionIndices || [];
      if (!arraysEqual(builtIndices, solution)) {
        return; // cannot go next until the word is correct
      }
    }

    if (!isLastExercise) {
      setCurrentIndex((idx) => idx + 1);
      resetExerciseState();
    } else {
      // At the end of the lesson – simple finish behaviour
      navigate('/dashboard');
    }
  }

  function handlePrevious() {
    if (currentIndex === 0) return;
    setCurrentIndex((idx) => idx - 1);
    resetExerciseState();
  }

  // helpers ----------------------------------------------------------------------
  function arraysEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // renderers --------------------------------------------------------------------

  function renderCharIntro(ex) {
    const cfg = ex.config || {};
    const letter = cfg.letter || '?';
    const lower = cfg.lower || '';
    const translit = cfg.transliteration || '';
    const hint = cfg.hint || '';

    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-32 h-32 rounded-3xl bg-orange-100 flex items-center justify-center shadow-inner">
            <span className="text-6xl font-semibold text-orange-800">
              {letter}
            </span>
          </div>
          {lower && (
            <div className="flex items-center gap-2 text-gray-700">
              <span className="px-3 py-1 rounded-full bg-gray-100 text-sm">
                Lowercase: <span className="font-semibold">{lower}</span>
              </span>
            </div>
          )}
          {translit && (
            <div className="px-4 py-2 rounded-full bg-emerald-50 text-emerald-800 text-sm font-medium">
              Pronounced like: <span className="font-semibold">{translit}</span>
            </div>
          )}
        </div>

        {hint && (
          <div className="px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-gray-700 text-sm">
            {hint}
          </div>
        )}
      </div>
    );
  }

  function renderCharMcqSound(ex) {
    const cfg = ex.config || {};
    const letter = cfg.letter || '?';
    const options = cfg.options || [];
    const correctIndex = cfg.correctIndex ?? 0;
    const showTransliteration = cfg.showTransliteration ?? true;

    const isNextDisabled = feedback !== 'correct';

    function handleSelect(idx) {
      setSelectedOptionIndex(idx);
      if (idx === correctIndex) {
        setFeedback('correct');
      } else {
        setFeedback('wrong');
      }
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-28 h-28 rounded-3xl bg-orange-100 flex items-center justify-center shadow-inner">
            <span className="text-5xl font-semibold text-orange-800">
              {letter}
            </span>
          </div>
          {showTransliteration && (
            <p className="text-sm text-gray-500">
              Tap the correct sound for this letter.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {options.map((opt, idx) => {
            const isSelected = idx === selectedOptionIndex;
            const isCorrect = idx === correctIndex;
            let classes =
              'w-full px-4 py-3 rounded-xl border text-center text-sm font-medium transition';

            if (!isSelected) {
              classes +=
                ' border-gray-200 bg-white hover:bg-orange-50 hover:border-orange-300';
            } else if (feedback === 'correct' && isCorrect) {
              classes += ' border-emerald-500 bg-emerald-50 text-emerald-800';
            } else if (feedback === 'wrong' && !isCorrect) {
              classes += ' border-red-400 bg-red-50 text-red-700';
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(idx)}
                className={classes}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {feedback === 'correct' && (
          <p className="text-sm text-emerald-700">
            Nice! That’s the correct sound.
          </p>
        )}
        {feedback === 'wrong' && (
          <p className="text-sm text-red-600">
            Not quite. Try a different option.
          </p>
        )}

        {/* Next button is handled in footer, just make sure we know if disabled */}
        <input
          type="hidden"
          value={isNextDisabled ? '1' : '0'}
          data-next-disabled={String(isNextDisabled)}
        />
      </div>
    );
  }

  function renderCharBuildWord(ex) {
    const cfg = ex.config || {};
    const targetWord = cfg.targetWord || '';
    const tiles = cfg.tiles || [];
    const solutionIndices = cfg.solutionIndices || [];

    const built = builtIndices.map((i) => tiles[i] || '').join('');
    const isCorrect = arraysEqual(builtIndices, solutionIndices);

    function handleTileClick(idx) {
      // toggle index in built array
      setFeedback(null);
      setBuiltIndices((prev) => {
        // if already there, remove it
        const existingIndex = prev.indexOf(idx);
        if (existingIndex !== -1) {
          const copy = [...prev];
          copy.splice(existingIndex, 1);
          return copy;
        }
        // otherwise append
        return [...prev, idx];
      });
    }

    useEffect(() => {
      if (builtIndices.length === solutionIndices.length) {
        if (arraysEqual(builtIndices, solutionIndices)) {
          setFeedback('correct');
        } else {
          setFeedback('wrong');
        }
      } else {
        setFeedback(null);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [builtIndices.join(','), solutionIndices.join(',')]);

    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <p className="text-xs uppercase tracking-wide text-gray-400">
            Target word
          </p>
          <p className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 text-orange-800 font-semibold">
            {targetWord}
          </p>
        </div>

        <div className="min-h-[64px] flex items-center justify-center rounded-2xl bg-gray-50 border border-dashed border-gray-200 px-4">
          <p className="text-2xl tracking-wide text-gray-800">
            {built || 'Tap the letters below to build the word'}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {tiles.map((ch, idx) => {
            const active = builtIndices.includes(idx);
            const classes =
              'w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-semibold border transition ' +
              (active
                ? 'bg-orange-600 text-white border-orange-600 shadow'
                : 'bg-white text-gray-800 border-gray-200 hover:bg-orange-50');
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleTileClick(idx)}
                className={classes}
              >
                {ch}
              </button>
            );
          })}
        </div>

        {feedback === 'correct' && (
          <p className="text-sm text-emerald-700 text-center">
            Perfect spelling!
          </p>
        )}
        {feedback === 'wrong' && (
          <p className="text-sm text-red-600 text-center">
            That doesn’t look right yet. Adjust the letters.
          </p>
        )}
      </div>
    );
  }

  function renderClassicType(ex) {
    // fallback for old plain-text exercises
    if (ex.type === 'fill-blank') {
      return (
        <div className="space-y-4">
          <p className="text-gray-800">
            {ex.sentence_before}
            <span className="inline-block mx-2">
              <input
                type="text"
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                className="border-b border-gray-400 focus:outline-none bg-transparent text-center"
                placeholder="…"
              />
            </span>
            {ex.sentence_after}
          </p>
        </div>
      );
    }

    // default type-answer
    return (
      <div className="space-y-4">
        <p className="text-gray-800">{ex.prompt}</p>
        <input
          type="text"
          value={textAnswer}
          onChange={(e) => setTextAnswer(e.target.value)}
          className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          placeholder="Type your answer…"
        />
      </div>
    );
  }

  function renderExerciseBody(ex) {
    switch (ex.kind) {
      case 'char_intro':
        return renderCharIntro(ex);
      case 'char_mcq_sound':
        return renderCharMcqSound(ex);
      case 'char_build_word':
        return renderCharBuildWord(ex);
      default:
        // fall back to older classic types (type-answer, fill-blank, etc.)
        return renderClassicType(ex);
    }
  }

  // controls: we need to know if Next should be disabled for alphabet types
  let nextDisabled = false;
  if (currentExercise.kind === 'char_mcq_sound') {
    if (feedback !== 'correct') {
      nextDisabled = true;
    }
  } else if (currentExercise.kind === 'char_build_word') {
    const cfg = currentExercise.config || {};
    const solutionIndices = cfg.solutionIndices || [];
    if (!arraysEqual(builtIndices, solutionIndices)) {
      nextDisabled = true;
    }
  }

  const prevDisabled = currentIndex === 0;

  return (
    <div className="min-h-screen bg-orange-50">
      {/* top bar */}
      <header className="max-w-3xl mx-auto px-4 pt-6 pb-4 flex items-center justify-between">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm text-orange-700 hover:text-orange-800 flex items-center gap-2"
        >
          <span aria-hidden="true">←</span>
          Back to dashboard
        </button>
        <div className="text-xs text-gray-500">
          {currentIndex + 1} / {totalExercises}
        </div>
      </header>

      {/* lesson body */}
      <main className="max-w-3xl mx-auto px-4 pb-12">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-1">
            {lesson.title}
          </h1>
          {lesson.description && (
            <p className="text-gray-600 text-sm md:text-base">
              {lesson.description}
            </p>
          )}
        </div>

        <section className="bg-white rounded-3xl shadow-md p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 mb-1">
            <span className="uppercase tracking-wide text-orange-500">
              Exercise {currentIndex + 1}
            </span>
            {currentExercise.kind && (
              <span className="px-3 py-1 rounded-full bg-orange-50 text-orange-700">
                {currentExercise.kind}
              </span>
            )}
          </div>

          <h2 className="text-lg font-semibold text-gray-900">
            {currentExercise.prompt}
          </h2>

          {renderExerciseBody(currentExercise)}
        </section>

        {/* navigation buttons */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={prevDisabled}
            className={
              'px-6 py-3 rounded-full border text-sm font-medium transition ' +
              (prevDisabled
                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50')
            }
          >
            Previous
          </button>

          <button
            onClick={handleNext}
            disabled={nextDisabled}
            className={
              'px-8 py-3 rounded-full text-sm font-semibold transition ' +
              (nextDisabled
                ? 'bg-orange-200 text-white cursor-not-allowed'
                : 'bg-orange-600 text-white hover:bg-orange-700')
            }
          >
            {isLastExercise ? 'Finish lesson' : 'Next'}
          </button>
        </div>
      </main>
    </div>
  );
}
