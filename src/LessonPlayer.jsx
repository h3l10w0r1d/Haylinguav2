// src/LessonPlayer.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API_BASE = 'https://haylinguav2.onrender.com';

export default function LessonPlayer() {
  const params = useParams();
  // be tolerant about param naming
  const slug = params.slug ?? params.lessonId ?? params.lessonSlug;
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // for simple step-through of exercises (once you have them)
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!slug) {
      console.error('No slug in route params', params);
      setError('Missing lesson slug in URL.');
      setLoading(false);
      return;
    }

    const loadLesson = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`${API_BASE}/lessons/${slug}`);

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          console.error('Failed to load lesson', res.status, text);
          setError('Lesson not found.');
          setLesson(null);
          return;
        }

        const data = await res.json();
        console.log('Loaded lesson', data);
        setLesson(data);
        setCurrentIndex(0);
      } catch (err) {
        console.error('Error loading lesson', err);
        setError('Could not load lesson. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadLesson();
  }, [slug]);

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  // ---------- RENDER STATES ----------

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="bg-white shadow-lg rounded-2xl px-6 py-4">
          <p className="text-gray-700 font-medium">Loading lesson…</p>
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-orange-50 px-4">
        <p className="text-gray-700 mb-6 text-center">
          {error ?? 'Lesson not found.'}
        </p>
        <button
          onClick={handleBackToDashboard}
          className="px-6 py-3 rounded-full bg-orange-600 text-white font-semibold shadow hover:bg-orange-700 transition"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const exercises = lesson.exercises ?? [];

  if (exercises.length === 0) {
    // Backend returned lesson but no exercises
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-orange-50 px-4">
        <div className="bg-white shadow-md rounded-2xl px-8 py-6 max-w-lg text-center">
          <h1 className="text-xl font-semibold mb-2">{lesson.title}</h1>
          <p className="text-gray-600 mb-4">
            {lesson.description || 'This lesson has no exercises yet.'}
          </p>
          <p className="text-gray-500 mb-6">
            Once we add alphabet exercises in the backend, they’ll appear
            here automatically.
          </p>
          <button
            onClick={handleBackToDashboard}
            className="px-6 py-3 rounded-full bg-orange-600 text-white font-semibold shadow hover:bg-orange-700 transition"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  // ---------- SIMPLE EXERCISE VIEWER ----------
  const currentExercise = exercises[currentIndex];

  const goNext = () => {
    if (currentIndex < exercises.length - 1) {
      setCurrentIndex((idx) => idx + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((idx) => idx - 1);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50">
      <div className="max-w-xl mx-auto px-4 py-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleBackToDashboard}
            className="text-sm text-orange-700 hover:text-orange-900"
          >
            ← Back to dashboard
          </button>
          <span className="text-sm text-gray-500">
            {currentIndex + 1} / {exercises.length}
          </span>
        </div>

        {/* Lesson header */}
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">
            {lesson.title}
          </h1>
          <p className="text-gray-600 mt-1">{lesson.description}</p>
        </div>

        {/* Current exercise card */}
        <div className="bg-white rounded-2xl shadow-md p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-orange-600">
              Exercise {currentIndex + 1}
            </span>
            {currentExercise.kind && (
              <span className="text-xs rounded-full bg-orange-50 px-3 py-1 text-orange-700 font-medium">
                {currentExercise.kind}
              </span>
            )}
          </div>

          <p className="text-lg font-medium text-gray-900 mb-3">
            {currentExercise.prompt}
          </p>

          {/* For now we just show raw config so you can verify alphabet data */}
          {currentExercise.config && (
            <div className="mt-4">
              <p className="text-xs uppercase text-gray-400 mb-1">
                Debug view (config)
              </p>
              <pre className="bg-gray-50 rounded-xl text-xs p-3 overflow-x-auto text-gray-700">
                {JSON.stringify(currentExercise.config, null, 2)}
              </pre>
            </div>
          )}

          {currentExercise.expected_answer && (
            <p className="mt-3 text-sm text-gray-700">
              <span className="font-semibold">Expected answer: </span>
              {currentExercise.expected_answer}
            </p>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
              currentIndex === 0
                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                : 'border-orange-300 text-orange-700 hover:bg-orange-50'
            }`}
          >
            Previous
          </button>
          <button
            onClick={goNext}
            disabled={currentIndex === exercises.length - 1}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              currentIndex === exercises.length - 1
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-orange-600 text-white hover:bg-orange-700 shadow'
            }`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
