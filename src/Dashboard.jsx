// src/Dashboard.jsx
import { useEffect, useState } from 'react';
import { BookOpen, Flame, Star, Lock, Volume2, Loader2 } from 'lucide-react';

const API_BASE = 'https://haylinguav2.onrender.com';

export default function Dashboard({ user, onStartLesson }) {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // load lessons from backend
  useEffect(() => {
    let isMounted = true;

    async function fetchLessons() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE}/lessons`);
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Failed to load lessons: ${res.status} ${text}`);
        }
        const data = await res.json();
        if (isMounted) {
          setLessons(data || []);
        }
      } catch (err) {
        console.error('Error loading lessons', err);
        if (isMounted) {
          setError(err.message || 'Could not load lessons');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchLessons();
    return () => {
      isMounted = false;
    };
  }, []);

  const completedSlugs = user?.completedLessons || [];

  // ✅ FIX: compute total XP from completed lessons
  const totalXp = lessons.reduce((sum, lesson) => {
    if (completedSlugs.includes(lesson.slug)) {
      return sum + (lesson.xp || 0);
    }
    return sum;
  }, 0);

  // simple “level” approximation from XP if you want
  const level = user?.level ?? Math.max(1, Math.floor(totalXp / 40));
  const streak = user?.streak ?? 1;

  const getLessonStatus = (lesson, index) => {
    if (completedSlugs.includes(lesson.slug)) return 'completed';
    // unlock the first lesson, or the next one after a completed one
    if (index === 0) return 'unlocked';
    const previous = lessons[index - 1];
    if (previous && completedSlugs.includes(previous.slug)) return 'unlocked';
    return 'locked';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-amber-50 pb-16 pt-20 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top summary card */}
        <div className="bg-white rounded-3xl shadow-md border border-orange-100 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
              Barev, {user?.name || 'learner'} 👋
            </h1>
            <p className="text-sm text-gray-500">
              Keep building your Armenian skills one bite-sized lesson at a time.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4 w-full sm:w-auto">
            <div className="bg-orange-50 rounded-2xl px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-orange-600 mb-1">
                <Star className="w-3 h-3" />
                Level
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {level}
              </div>
            </div>
            <div className="bg-orange-50 rounded-2xl px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-orange-600 mb-1">
                <BookOpen className="w-3 h-3" />
                XP
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {totalXp}
              </div>
            </div>
            <div className="bg-orange-50 rounded-2xl px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-orange-600 mb-1">
                <Flame className="w-3 h-3" />
                Streak
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {streak}d
              </div>
            </div>
          </div>
        </div>

        {/* Error / loading */}
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 rounded-2xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Loading lessons…</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Alphabet path
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              {lessons.map((lesson, idx) => {
                const status = getLessonStatus(lesson, idx);
                const isCompleted = status === 'completed';
                const isLocked = status === 'locked';

                return (
                  <button
                    key={lesson.id}
                    type="button"
                    disabled={isLocked}
                    onClick={() => {
                      if (!isLocked) {
                        onStartLesson(lesson);
                      }
                    }}
                    className={[
                      'relative flex items-center gap-4 w-full text-left rounded-3xl border px-4 py-4 sm:px-5 sm:py-5 transition shadow-sm',
                      isLocked
                        ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-70'
                        : isCompleted
                        ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200 hover:shadow-md'
                        : 'bg-white border-orange-100 hover:shadow-md hover:border-orange-200',
                    ].join(' ')}
                  >
                    {/* Status icon */}
                    <div
                      className={[
                        'w-12 h-12 rounded-2xl flex items-center justify-center',
                        isLocked
                          ? 'bg-gray-200 text-gray-500'
                          : isCompleted
                          ? 'bg-emerald-500 text-white'
                          : 'bg-orange-500 text-white',
                      ].join(' ')}
                    >
                      {isLocked ? (
                        <Lock className="w-6 h-6" />
                      ) : isCompleted ? (
                        <Star className="w-6 h-6" />
                      ) : (
                        <BookOpen className="w-6 h-6" />
                      )}
                    </div>

                    {/* Lesson info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Lesson {idx + 1}
                        </span>
                        {isCompleted && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-medium">
                            Completed
                          </span>
                        )}
                        {!isLocked && !isCompleted && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 text-[11px] font-medium">
                            New
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1">
                        {lesson.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-500 line-clamp-2">
                        {lesson.description}
                      </p>

                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <Star className="w-3 h-3 text-orange-500" />
                          {lesson.xp || 0} XP
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Volume2 className="w-3 h-3 text-orange-500" />
                          Audio alphabet
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
