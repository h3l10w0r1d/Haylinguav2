// src/LessonPlayer.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Flame, Star, ArrowLeft } from 'lucide-react';
import ExerciseRenderer from './ExerciseRenderer';

const API_BASE = 'https://haylinguav2.onrender.com';

export default function LessonPlayer() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalXp, setTotalXp] = useState(0);

  useEffect(() => {
    async function fetchLesson() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/lessons/${slug}`);
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(`Failed to load lesson ${slug}: ${res.status} ${body}`);
        }
        const data = await res.json();
        setLesson(data);
        setCurrentIndex(0);
        setTotalXp(0);
        setError(null);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Could not load lesson');
      } finally {
        setLoading(false);
      }
    }

    fetchLesson();
  }, [slug]);

  const handleAnswer = ({ isCorrect, xpEarned }) => {
    if (isCorrect && xpEarned) {
      setTotalXp(prev => prev + xpEarned);
    }

    if (!lesson) return;
    if (currentIndex < lesson.exercises.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      // Later we’ll POST this to backend
      alert(
        `Nice! You finished "${lesson.title}". XP earned: ${
          totalXp + (isCorrect ? xpEarned || 0 : 0)
        }`
      );
      navigate('/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-orange-100">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-8 py-6 shadow-lg flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse" />
          <p className="text-gray-700 font-medium">Loading your lesson…</p>
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-orange-50">
        <p className="text-gray-700 mb-4">
          {error || 'This lesson is not available.'}
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

  const exercises = lesson.exercises || [];
  if (!exercises.length) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-orange-50">
        <p className="text-gray-700 mb-4">This lesson has no exercises yet.</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const exercise = exercises[currentIndex];
  const progress = Math.round(((currentIndex + 1) / exercises.length) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white pb-10">
      <div className="max-w-3xl mx-auto px-4 pt-4">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 text-sm text-orange-700 hover:text-orange-800"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-white/70 px-3 py-1.5 rounded-full shadow-sm">
              <Star className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-medium text-gray-700">
                Lesson XP:&nbsp;
                <span className="text-orange-600">{totalXp}</span>
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1 bg-white/70 px-3 py-1.5 rounded-full shadow-sm">
              <Flame className="w-4 h-4 text-red-500" />
              <span className="text-xs font-medium text-gray-700">
                Streak mode
              </span>
            </div>
          </div>
        </div>

        {/* Lesson header card */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-3xl p-5 text-white shadow-md mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold mb-1">
                {lesson.title}
              </h1>
              {lesson.description && (
                <p className="text-sm text-orange-100 max-w-xl">
                  {lesson.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="bg-white/15 rounded-2xl px-3 py-1.5">
                <span className="text-orange-50">
                  Exercise {currentIndex + 1} of {exercises.length}
                </span>
              </div>
              <div className="bg-white/15 rounded-2xl px-3 py-1.5">
                <span className="text-orange-50">
                  {progress}% complete
                </span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-2 bg-white/25 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Exercise card */}
        <ExerciseRenderer exercise={exercise} onAnswer={handleAnswer} />
      </div>
    </div>
  );
}
