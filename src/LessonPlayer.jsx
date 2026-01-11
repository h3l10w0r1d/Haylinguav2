// src/LessonPlayer.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API_BASE = 'https://haylinguav2.onrender.com';

export default function LessonPlayer() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [textAnswer, setTextAnswer] = useState('');
  const [selectedOptions, setSelectedOptions] = useState([]); // JS array, no types
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong" | null

  useEffect(() => {
    let cancelled = false;

    async function fetchLesson() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`${API_BASE}/lessons/${slug}`);
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`HTTP ${res.status}: ${body || 'Failed to load lesson'}`);
        }
        const data = await res.json();
        if (!cancelled) {
          setLesson(data);
          setCurrentIndex(0);
          setTextAnswer('');
          setSelectedOptions([]);
          setFeedback(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load lesson', err);
          setLoadError(err.message || 'Failed to load lesson');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLesson();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <p className="text-gray-600">Loading lesson…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-orange-50 px-4">
        <p className="mb-4 text-red-600 font-medium">
          Could not load lesson: {loadError}
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-orange-50 px-4">
        <p className="mb-4 text-gray-700">Lesson not found.</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const exercises = lesson.exercises || [];

  if (exercises.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-orange-50 px-4">
        <p className="mb-4 text-gray-700 text-lg">
          This lesson has no exercises yet.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const current = exercises[currentIndex];
  const isLastExercise = currentIndex === exercises.length - 1;

  const resetForNext = () => {
    setTextAnswer('');
    setSelectedOptions([]);
    setFeedback(null);
  };

  const handleNext = () => {
    if (!isLastExercise) {
      setCurrentIndex((i) => i + 1);
      resetForNext();
    }
  };

  const handleOptionToggle = (id) => {
    setSelectedOptions((prev) =>
      prev.includes(String(id))
        ? prev.filter((x) => x !== String(id))
        : [...prev, String(id)]
    );
  };

  const checkAnswer = () => {
    if (!current) return;

    if (current.type === 'type-answer' || current.type === 'fill-blank') {
      const user = (textAnswer || '').trim();
      const expected = (current.expected_answer || '').trim();
      if (!expected) return;
      const correct =
        user.localeCompare(expected, undefined, {
          sensitivity: 'accent',
          usage: 'search',
        }) === 0;
      setFeedback(correct ? 'correct' : 'wrong');
    } else if (current.type === 'multi-select') {
      const correctIds = (current.options || [])
        .filter((o) => o.is_correct)
        .map((o) => String(o.id))
        .sort();
      const picked = [...selectedOptions].sort();
      const correct =
        correctIds.length === picked.length &&
        correctIds.every((id, idx) => id === picked[idx]);
      setFeedback(correct ? 'correct' : 'wrong');
    } else {
      console.warn('Unknown exercise type:', current.type);
    }
  };

  const renderExerciseBody = () => {
    if (!current) return null;

    if (current.type === 'type-answer') {
      return (
        <div className="space-y-4">
          <p className="text-gray-800 text-lg">{current.prompt}</p>
          <input
            type="text"
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Type your answer in Armenian…"
          />
        </div>
      );
    }

    if (current.type === 'fill-blank') {
      return (
        <div className="space-y-4">
          <p className="text-gray-800 text-lg">{current.prompt}</p>
          <div className="flex flex-wrap items-center gap-2 text-xl">
            <span>{current.sentence_before || ''}</span>
            <input
              type="text"
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              className="px-3 py-2 border-b border-gray-400 focus:outline-none focus:border-orange-500 bg-transparent"
            />
            <span>{current.sentence_after || ''}</span>
          </div>
        </div>
      );
    }

    if (current.type === 'multi-select') {
      return (
        <div className="space-y-4">
          <p className="text-gray-800 text-lg">{current.prompt}</p>
          <div className="grid md:grid-cols-2 gap-3">
            {(current.options || []).map((opt) => {
              const active = selectedOptions.includes(String(opt.id));
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleOptionToggle(opt.id)}
                  className={`text-left border rounded-xl px-4 py-3 transition-all ${
                    active
                      ? 'bg-orange-100 border-orange-500'
                      : 'bg-white border-gray-300 hover:border-orange-400'
                  }`}
                >
                  {opt.text}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <p className="text-gray-600">
        This exercise type ({current.type}) is not supported yet.
      </p>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white pb-16">
      <div className="max-w-3xl mx-auto px-4 pt-8">
        {/* Lesson header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="mb-4 text-sm text-orange-600 hover:underline"
          >
            ← Back to dashboard
          </button>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">
            {lesson.title}
          </h1>
          {lesson.description && (
            <p className="text-gray-600">{lesson.description}</p>
          )}
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-4 text-sm text-gray-600">
          <span>
            Exercise {currentIndex + 1} of {exercises.length}
          </span>
          <span>{Math.round(((currentIndex + 1) / exercises.length) * 100)}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all"
            style={{
              width: `${((currentIndex + 1) / exercises.length) * 100}%`,
            }}
          />
        </div>

        {/* Exercise card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
          {renderExerciseBody()}

          {/* Feedback */}
          {feedback && (
            <div
              className={`mt-4 px-4 py-2 rounded-xl text-sm ${
                feedback === 'correct'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {feedback === 'correct'
                ? 'Nice! That’s correct.'
                : 'Not quite. Try again or check the pattern.'}
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex justify-between items-center">
            <button
              onClick={checkAnswer}
              className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors"
            >
              Check answer
            </button>

            <button
              onClick={handleNext}
              disabled={!feedback || isLastExercise}
              className={`px-5 py-2 rounded-xl text-sm font-medium border transition-colors ${
                !feedback || isLastExercise
                  ? 'border-gray-300 text-gray-400 cursor-not-allowed'
                  : 'border-orange-500 text-orange-600 hover:bg-orange-50'
              }`}
            >
              {isLastExercise ? 'End of lesson' : 'Next exercise →'}
            </button>
          </div>
        </div>

        {/* Finish CTA */}
        {isLastExercise && feedback === 'correct' && (
          <div className="mt-6 text-center">
            <p className="text-gray-800 mb-3">
              You’ve completed all the exercises in this lesson! 🎉
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors"
            >
              Back to dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
