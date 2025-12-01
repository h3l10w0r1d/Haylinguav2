// src/LessonPlayer.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API_BASE = 'https://haylinguav2.onrender.com';

export default function LessonPlayer({ token, onLessonComplete }) {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  // Load lesson + exercises
  useEffect(() => {
    async function loadLesson() {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(`${API_BASE}/lessons/${slug}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          console.error('Failed to load lesson', res.status, text);
          setErr('Could not load this lesson from the server.');
          return;
        }

        const data = await res.json();
        setLesson(data);
      } catch (e) {
        console.error('Error loading lesson', e);
        setErr('Network error while loading lesson.');
      } finally {
        setLoading(false);
      }
    }

    loadLesson();
  }, [slug, token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <p className="text-gray-600">Loading lesson…</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-orange-50">
        <p className="text-red-600 mb-4">{err}</p>
        <button
          className="px-4 py-2 bg-orange-600 text-white rounded-xl"
          onClick={() => navigate('/dashboard')}
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  if (!lesson || !Array.isArray(lesson.exercises) || lesson.exercises.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-orange-50">
        <p className="text-gray-600 mb-4">
          This lesson has no exercises yet.
        </p>
        <button
          className="px-4 py-2 bg-orange-600 text-white rounded-xl"
          onClick={() => navigate('/dashboard')}
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const exercises = lesson.exercises;
  const exercise = exercises[currentIndex];
  const total = exercises.length;

  const xpPerExercise = total > 0 ? Math.round((lesson.xp || 0) / total) : 0;

  const toggleOption = (optionId) => {
    setSelectedOptions((prev) =>
      prev.includes(optionId)
        ? prev.filter((id) => id !== optionId)
        : [...prev, optionId]
    );
  };

  const handleSubmit = () => {
    if (!exercise) return;

    let isCorrect = false;

    if (exercise.type === 'type-answer' || exercise.type === 'fill-blank') {
      const expected = (exercise.expected_answer || '').trim();
      const given = (userAnswer || '').trim();
      // can adjust to case-insensitive if you want
      isCorrect = expected !== '' && given === expected;
    } else if (exercise.type === 'multi-select') {
      const correctIds = exercise.options
        .filter((opt) => opt.is_correct)
        .map((opt) => opt.id)
        .sort();
      const chosenIds = [...selectedOptions].sort();

      isCorrect =
        correctIds.length === chosenIds.length &&
        correctIds.every((id, i) => id === chosenIds[i]);
    }

    if (isCorrect) {
      setCorrectCount((c) => c + 1);
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex >= total) {
      // finished all exercises
      setFinished(true);

      const gainedXp = correctCount * xpPerExercise + (isCorrect ? xpPerExercise : 0);

      // notify parent (App) so it can update dashboard stats
      if (onLessonComplete) {
        onLessonComplete(lesson.slug || slug, gainedXp);
      }
    } else {
      // move to next exercise
      setCurrentIndex(nextIndex);
      setUserAnswer('');
      setSelectedOptions([]);
    }
  };

  const handleSkip = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= total) {
      setFinished(true);
      if (onLessonComplete) {
        const gainedXp = correctCount * xpPerExercise;
        onLessonComplete(lesson.slug || slug, gainedXp);
      }
    } else {
      setCurrentIndex(nextIndex);
      setUserAnswer('');
      setSelectedOptions([]);
    }
  };

  // If we rely on parent navigation after onLessonComplete, "finished" is basically instant.
  // But we keep it for potential UI tweaks.

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button
          className="mb-4 text-orange-600 hover:underline"
          onClick={() => navigate('/dashboard')}
        >
          ← Back to dashboard
        </button>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            {lesson.title}
          </h1>
          <p className="text-gray-600 mb-4">{lesson.description}</p>

          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-gray-500">
              Exercise {currentIndex + 1} of {total}
            </span>
            <span className="text-sm text-orange-600">
              {correctCount} correct • {lesson.xp || 0} total XP
            </span>
          </div>

          {/* Exercise UI */}
          <div className="border border-gray-200 rounded-xl p-4 mb-4">
            <p className="text-gray-900 font-medium mb-3">{exercise.prompt}</p>

            {exercise.type === 'type-answer' && (
              <div>
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="Type your answer..."
                />
              </div>
            )}

            {exercise.type === 'fill-blank' && (
              <div className="flex items-center flex-wrap gap-2">
                {exercise.sentence_before && (
                  <span className="text-gray-800">
                    {exercise.sentence_before}
                  </span>
                )}
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="..."
                />
                {exercise.sentence_after && (
                  <span className="text-gray-800">
                    {exercise.sentence_after}
                  </span>
                )}
              </div>
            )}

            {exercise.type === 'multi-select' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {exercise.options.map((opt) => {
                  const isSelected = selectedOptions.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleOption(opt.id)}
                      className={`border rounded-lg px-3 py-2 text-left transition ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-300 hover:border-orange-300'
                      }`}
                    >
                      {opt.text}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button
              onClick={handleSkip}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              Skip
            </button>
            <button
              onClick={handleSubmit}
              className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              {currentIndex + 1 === total ? 'Finish lesson' : 'Check answer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
