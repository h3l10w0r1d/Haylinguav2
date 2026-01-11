// src/Dashboard.jsx
import { useEffect, useState } from 'react';
import { Trophy, Flame, Target, Lock, Check } from 'lucide-react';

const API_BASE = 'https://haylinguav2.onrender.com';

export default function Dashboard({ user, onStartLesson }) {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch lessons from backend
  useEffect(() => {
    let cancelled = false;

    async function loadLessons() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/lessons`);
        if (!res.ok) {
          throw new Error(`Failed to load lessons: ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) {
          setLessons(data);
        }
      } catch (err) {
        console.error('Error loading lessons', err);
        if (!cancelled) {
          setError('Could not load lessons. Please try again later.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLessons();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalLessons = lessons.length;
  const completedCount = user?.completedLessons?.length || 0;
  const overallProgress = totalLessons
    ? Math.round((completedCount / totalLessons) * 100)
    : 0;

  const sortedLessons = [...lessons].sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    return a.id - b.id;
  });

  return (
    <div className="min-h-screen bg-[#FFF7ED]">
      {/* Header gradient */}
      <div className="bg-gradient-to-r from-orange-500 via-orange-500 to-red-500 text-white pb-10 pt-8">
        <div className="max-w-5xl mx-auto px-4 flex items-start justify-between gap-6">
          <div>
            <p className="text-sm text-orange-100 mb-1">
              Welcome back, {user?.name || 'learner'}! 👋
            </p>
            <h1 className="text-2xl font-semibold mb-2">
              Continue your Armenian journey
            </h1>

            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <StatCard
                label="Level"
                icon={Trophy}
                value={user?.level ?? 1}
              />
              <StatCard
                label="Total XP"
                icon={Target}
                value={user?.xp ?? 0}
              />
              <StatCard
                label="Day Streak"
                icon={Flame}
                value={user?.streak ?? 1}
              />
              <StatCard
                label="Completed"
                icon={Check}
                value={`${completedCount}/${totalLessons || 0}`}
              />
            </div>

            {/* Progress bar */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-1 text-xs text-orange-100">
                <span>Overall Progress</span>
                <span>{overallProgress}%</span>
              </div>
              <div className="h-2 bg-orange-300/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white/90 rounded-full transition-all duration-500"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Tiny avatar placeholder on desktop */}
          <div className="hidden md:block w-20 h-28 rounded-3xl bg-orange-200/20 border border-orange-200/40" />
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-4 pb-10 -mt-4">
        <div className="bg-white rounded-3xl shadow-sm p-6 md:p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Your Learning Path
          </h2>

          {loading && (
            <div className="py-10 text-center text-gray-500 text-sm">
              Loading lessons…
            </div>
          )}

          {error && !loading && (
            <div className="py-6 text-center text-red-500 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && sortedLessons.length === 0 && (
            <div className="py-10 text-center text-gray-500 text-sm">
              No lessons found yet. Once we add them in the backend,
              they’ll appear here automatically.
            </div>
          )}

          {!loading && !error && sortedLessons.length > 0 && (
            <div className="space-y-6">
              {/* Group by level (for future) – for now we just show Level 1 header */}
              <div>
                <div className="inline-flex items-center px-4 py-1 rounded-full bg-orange-50 border border-orange-200 mb-4">
                  <span className="text-sm font-medium text-orange-700">
                    Level 1
                  </span>
                </div>

                <div className="space-y-4">
                  {sortedLessons.map((lesson) => {
                    const isCompleted =
                      user?.completedLessons?.includes(lesson.slug) || false;

                    // for now, everything is unlocked
                    const isLocked = false;

                    return (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        isCompleted={isCompleted}
                        isLocked={isLocked}
                        onClick={() => {
                          if (!isLocked && onStartLesson) {
                            onStartLesson(lesson);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Encouragement banner */}
        <div className="mt-6 bg-gradient-to-r from-orange-100 to-rose-100 border border-orange-200/50 rounded-3xl px-6 py-4 text-center text-sm text-orange-900">
          Keep up the great work! 🎉 Complete your alphabet lessons to
          unlock more Armenian content.
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, icon: Icon, value }) {
  return (
    <div className="bg-white/10 rounded-2xl px-4 py-3 flex flex-col justify-between min-h-[72px]">
      <div className="flex items-center gap-2 text-xs text-orange-100/90 mb-1">
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function LessonCard({ lesson, isCompleted, isLocked, onClick }) {
  const baseClasses =
    'w-full flex items-center justify-between px-4 py-4 rounded-2xl border transition-all cursor-pointer';

  let colorClasses =
    'bg-orange-50 border-orange-200 hover:border-orange-300 hover:bg-orange-50/80';

  if (isCompleted) {
    colorClasses =
      'bg-emerald-50 border-emerald-200 hover:border-emerald-300';
  } else if (isLocked) {
    colorClasses =
      'bg-gray-50 border-gray-200 cursor-not-allowed opacity-70';
  }

  return (
    <button
      type="button"
      className={`${baseClasses} ${colorClasses}`}
      onClick={onClick}
      disabled={isLocked}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center text-white ${
            isCompleted
              ? 'bg-emerald-500'
              : isLocked
              ? 'bg-gray-300'
              : 'bg-orange-500'
          }`}
        >
          {isLocked ? (
            <Lock className="w-5 h-5" />
          ) : isCompleted ? (
            <Check className="w-5 h-5" />
          ) : (
            <span className="text-sm font-semibold">
              {lesson.slug === 'alphabet-1'
                ? 'Ա'
                : lesson.slug === 'alphabet-2'
                ? 'Բ'
                : 'Լ'}
            </span>
          )}
        </div>

        <div className="text-left">
          <div className="text-sm font-semibold text-gray-900">
            {lesson.title}
          </div>
          <div className="text-xs text-gray-600 mt-0.5">
            {lesson.description}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-orange-700">
            <span>{lesson.xp} XP</span>
            {isCompleted && <span>✓ Completed</span>}
            {isLocked && <span>Locked</span>}
          </div>
        </div>
      </div>
    </button>
  );
}
