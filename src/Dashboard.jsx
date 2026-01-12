// src/Dashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Trophy,
  Flame,
  CheckCircle2,
  BookOpen,
  LogOut,
  User,
  Users,
  Medal,
} from 'lucide-react';

const API_BASE = 'https://haylinguav2.onrender.com';

export default function Dashboard({ user, onUpdateUser, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [lessons, setLessons] = useState([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const completed = Array.isArray(user.completedLessons)
    ? user.completedLessons
    : [];

  // Fetch lessons
  useEffect(() => {
    let cancelled = false;

    async function loadLessons() {
      setLoadingLessons(true);
      setLoadError(null);
      try {
        const res = await fetch(`${API_BASE}/lessons`);
        if (!res.ok) {
          throw new Error(`Failed to load lessons: ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) setLessons(data);
      } catch (err) {
        console.error('Error loading lessons', err);
        if (!cancelled) setLoadError(err.message || 'Failed to load lessons');
      } finally {
        if (!cancelled) setLoadingLessons(false);
      }
    }

    loadLessons();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalXp =
    typeof user.xp === 'number'
      ? user.xp
      : lessons
          .filter((l) => completed.includes(l.slug))
          .reduce((sum, l) => sum + (l.xp || 0), 0);

  const streak = user.streak || 0;

  // Navigation header
  const navItems = [
    { key: 'dashboard', label: 'Exercises', icon: BookOpen, path: '/dashboard' },
    { key: 'friends', label: 'Friends', icon: Users, path: '/friends' },
    { key: 'leaderboard', label: 'Leaderboard', icon: Medal, path: '/leaderboard' },
    { key: 'profile', label: 'Profile', icon: User, path: '/profile' },
  ];

  const currentPath = location.pathname;

  const isActive = (path) => {
    if (path === '/dashboard') {
      return currentPath === '/dashboard';
    }
    return currentPath.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white pb-24">
      {/* Header */}
      <header className="border-b border-orange-100 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => navigate('/dashboard')}
          >
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white font-bold text-lg">
              Հ
            </div>
            <span className="font-semibold text-gray-800">Haylingua</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition ${
                    active
                      ? 'bg-orange-600 text-white'
                      : 'text-gray-700 hover:bg-orange-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Profile / logout */}
          <div className="flex items-center gap-3">
            <div
              className="hidden sm:flex flex-col items-end text-xs text-gray-600 cursor-pointer"
              onClick={() => navigate('/profile')}
            >
              <span className="font-medium text-gray-800">
                {user.firstName || user.name || user.email}
              </span>
              <span>
                {totalXp} XP · lvl {user.level ?? 1}
              </span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-orange-50 text-orange-700 hover:bg-orange-100"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-orange-100 z-30">
          <div className="max-w-md mx-auto flex justify-around py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className="flex flex-col items-center text-xs"
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center mb-1 ${
                      active
                        ? 'bg-orange-500 text-white'
                        : 'bg-orange-50 text-orange-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={active ? 'text-orange-700' : 'text-gray-500'}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-8">
        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm text-orange-100">Total XP</span>
              <Trophy className="w-5 h-5" />
            </div>
            <div className="mt-2 text-3xl font-semibold">{totalXp}</div>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-orange-500 text-white rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm text-orange-100">Daily streak</span>
              <Flame className="w-5 h-5" />
            </div>
            <div className="mt-2 text-3xl font-semibold">
              {user.streak || 0}
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm text-emerald-100">
                Lessons completed
              </span>
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="mt-2 text-3xl font-semibold">
              {completed.length}
            </div>
          </div>
        </div>

        {/* Lessons */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Alphabet path
          </h2>

          {loadingLessons && (
            <div className="rounded-2xl bg-white border border-orange-100 p-6 text-gray-600">
              Loading lessons…
            </div>
          )}

          {loadError && !loadingLessons && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-red-700">
              {loadError}
            </div>
          )}

          {!loadingLessons && !loadError && (
            <div className="grid md:grid-cols-2 gap-4">
              {lessons.map((lesson) => {
                const isCompleted = completed.includes(lesson.slug);

                return (
                  <button
                    key={lesson.slug}
                    type="button"
                    onClick={() => navigate(`/lesson/${lesson.slug}`)}
                    className="relative text-left rounded-2xl border p-4 bg-white transition hover:shadow-sm border-orange-200 hover:border-orange-400 cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1 w-9 h-9 rounded-xl flex items-center justify-center text-white ${
                          isCompleted ? 'bg-emerald-500' : 'bg-orange-500'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <BookOpen className="w-4 h-4" />
                        )}
                      </div>

                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {lesson.title}
                        </h3>
                        {lesson.description && (
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                            {lesson.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>Level {lesson.level}</span>
                          <span>·</span>
                          <span>{lesson.xp} XP</span>
                          {isCompleted && (
                            <>
                              <span>·</span>
                              <span className="text-emerald-600 font-medium">
                                Completed
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {lessons.length === 0 && (
                <div className="rounded-2xl bg-white border border-orange-100 p-6 text-gray-600">
                  No lessons available yet.
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
