// src/Dashboard.jsx
import { useEffect, useState } from 'react';
import { Lock, Star, Check, Trophy, Flame, Target } from 'lucide-react';
import characterTeacher from './assets/character-teacher.png';

const API_BASE = 'https://haylinguav2.onrender.com';

export default function Dashboard({ user, onStartLesson }) {
  const [lessons, setLessons] = useState([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [error, setError] = useState(null);

  const completedSlugs = Array.isArray(user?.completedLessons)
    ? user.completedLessons
    : [];

  // --- Load lessons from backend ---
  useEffect(() => {
    async function loadLessons() {
      try {
        setLoadingLessons(true);
        setError(null);

        const res = await fetch(`${API_BASE}/lessons`);
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          console.error('Failed to load lessons', res.status, text);
          setError('Could not load lessons from server.');
          return;
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
          console.error('Unexpected /lessons payload', data);
          setError('Unexpected data format from server.');
          return;
        }

        setLessons(data);
      } catch (err) {
        console.error('Error loading lessons', err);
        setError('Network error while loading lessons.');
      } finally {
        setLoadingLessons(false);
      }
    }

    loadLessons();
  }, []);

  // --- Derive progress / locked state from lessons + user.completedLessons ---

  // sort by level, then by id (or slug as fallback)
  const sortedLessons = [...lessons].sort((a, b) => {
    const la = a.level ?? 0;
    const lb = b.level ?? 0;
    if (la !== lb) return la - lb;

    const ka = a.id ?? a.slug ?? '';
    const kb = b.id ?? b.slug ?? '';
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return 0;
  });

  // Sequential unlock logic:
  // - first lesson is unlocked by default
  // - each next lesson is locked unless the previous one is completed
  let previousCompleted = true;
  const lessonsWithStatus = sortedLessons.map((lesson, index) => {
    const slug = lesson.slug || `lesson-${lesson.id}`;
    const isCompleted = completedSlugs.includes(slug);

    const isLocked = !isCompleted && !previousCompleted && index !== 0;

    // update the chain: next lesson is only free if *this* one is completed (or we already had full chain)
    previousCompleted = previousCompleted && isCompleted;

    return {
      ...lesson,
      slug,
      isCompleted,
      isLocked,
    };
  });

  // group by level for the roadmap UI
  const levelGroups = lessonsWithStatus.reduce((acc, lesson) => {
    const lvl = lesson.level ?? 1;
    if (!acc[lvl]) acc[lvl] = [];
    acc[lvl].push(lesson);
    return acc;
  }, {});

  const totalLessons = lessonsWithStatus.length;
  const completedCount = lessonsWithStatus.filter((l) => l.isCompleted).length;
  const progressPct = totalLessons === 0 ? 0 : (completedCount / totalLessons) * 100;

  // --- Render ---

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white pb-20">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="mb-2">
                Welcome back, {user?.name || 'Learner'}! 👋
              </h1>
              <p className="text-orange-100">Continue your Armenian journey</p>
            </div>
            <div className="hidden md:block">
              <img
                src={characterTeacher}
                alt="Teacher Anna"
                className="w-32 h-32 object-contain"
              />
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[rgb(15,204,0)] bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-5 h-5" />
                <span className="text-sm text-orange-100">Level</span>
              </div>
              <div className="text-2xl font-bold">{user?.level ?? 1}</div>
            </div>

            <div className="bg-[rgb(15,204,0)] bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5" />
                <span className="text-sm text-orange-100">Total XP</span>
              </div>
              <div className="text-2xl font-bold">{user?.xp ?? 0}</div>
            </div>

            <div className="bg-[rgb(15,204,0)] bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-5 h-5" />
                <span className="text-sm text-orange-100">Day Streak</span>
              </div>
              <div className="text-2xl font-bold">{user?.streak ?? 0}</div>
            </div>

            <div className="bg-[rgb(15,204,0)] bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5" />
                <span className="text-sm text-orange-100">Completed</span>
              </div>
              <div className="text-2xl font-bold">
                {completedCount}/{totalLessons || 0}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-orange-100">Overall Progress</span>
              <span className="text-sm">{Math.round(progressPct)}%</span>
            </div>
            <div className="h-3 bg-white bg-opacity-20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Learning Path */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-gray-900 mb-6">Your Learning Path</h2>

        {loadingLessons && (
          <div className="text-gray-600">
            Loading your lessons from the server…
          </div>
        )}

        {!loadingLessons && error && (
          <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
            {error}
          </div>
        )}

        {!loadingLessons && !error && totalLessons === 0 && (
          <div className="text-gray-600">
            No lessons found yet. Once we add them in the backend, they’ll appear here automatically.
          </div>
        )}

        {!loadingLessons && !error && totalLessons > 0 && (
          <div className="space-y-12">
            {Object.entries(levelGroups).map(([level, levelLessons]) => (
              <div key={level}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-orange-600 text-white px-4 py-2 rounded-full">
                    Level {level}
                  </div>
                  <div className="flex-1 h-1 bg-gray-200 rounded" />
                </div>

                <div className="grid gap-4">
                  {levelLessons.map((lesson, index) => (
                    <div
                      key={lesson.slug || lesson.id}
                      className={`relative ${
                        index % 2 === 0 ? 'md:mr-auto' : 'md:ml-auto'
                      } w-full md:w-96`}
                    >
                      <button
                        onClick={() => {
                          if (!lesson.isLocked && onStartLesson) {
                            onStartLesson(lesson);
                          }
                        }}
                        disabled={lesson.isLocked}
                        className={`w-full p-6 rounded-2xl border-2 transition-all ${
                          lesson.isCompleted
                            ? 'bg-green-50 border-green-500 hover:shadow-lg'
                            : lesson.isLocked
                            ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
                            : 'bg-white border-orange-300 hover:border-orange-500 hover:shadow-lg'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 ${
                              lesson.isCompleted
                                ? 'bg-green-500'
                                : lesson.isLocked
                                ? 'bg-gray-400'
                                : 'bg-orange-500'
                            }`}
                          >
                            {lesson.isCompleted ? (
                              <Check className="w-8 h-8 text-white" />
                            ) : lesson.isLocked ? (
                              <Lock className="w-8 h-8 text-white" />
                            ) : (
                              <Star className="w-8 h-8 text-white" />
                            )}
                          </div>

                          <div className="flex-1 text-left">
                            <h3 className="text-gray-900 mb-1">
                              {lesson.title}
                            </h3>
                            <p className="text-gray-600 text-sm mb-2">
                              {lesson.description}
                            </p>
                            <div className="flex items-center gap-4">
                              <span className="text-orange-600 text-sm flex items-center gap-1">
                                <Star className="w-4 h-4" />
                                {lesson.xp ?? 0} XP
                              </span>
                              {lesson.isCompleted && (
                                <span className="text-green-600 text-sm">
                                  ✓ Completed
                                </span>
                              )}
                              {lesson.isLocked && (
                                <span className="text-gray-500 text-sm">
                                  Locked
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Connecting line downwards for roadmap feel */}
                      {index < levelLessons.length - 1 && (
                        <div className="hidden md:block absolute top-full left-1/2 w-1 h-8 bg-gray-300 transform -translate-x-1/2" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Motivational Section */}
        <div className="mt-12 bg-gradient-to-r from-orange-100 to-red-100 rounded-2xl p-8 text-center">
          <h3 className="text-gray-900 mb-2">Keep up the great work! 🎉</h3>
          <p className="text-gray-600">
            You’re making excellent progress. Complete daily lessons to maintain your streak!
          </p>
        </div>
      </div>
    </div>
  );
}
