// src/Dashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'https://haylinguav2.onrender.com';

export default function Dashboard() {
  const navigate = useNavigate();

  const [lessons, setLessons] = useState([]);
  const [stats, setStats] = useState(null);

  const [loadingLessons, setLoadingLessons] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState(null);

  const token = localStorage.getItem('access_token');
  const email = localStorage.getItem('user_email');

  // Redirect to login if no auth
  useEffect(() => {
    if (!token || !email) {
      navigate('/login');
    }
  }, [token, email, navigate]);

  // Load lessons
  useEffect(() => {
    let cancelled = false;

    async function fetchLessons() {
      try {
        setLoadingLessons(true);
        const res = await fetch(`${API_BASE}/lessons`);
        if (!res.ok) {
          throw new Error(`Failed to load lessons: ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) {
          setLessons(data || []);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError('Failed to load lessons.');
        }
      } finally {
        if (!cancelled) setLoadingLessons(false);
      }
    }

    fetchLessons();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load stats for this user
  useEffect(() => {
    if (!email) return;
    let cancelled = false;

    async function fetchStats() {
      try {
        setLoadingStats(true);
        const res = await fetch(
          `${API_BASE}/me/stats?email=${encodeURIComponent(email)}`
        );
        if (!res.ok) {
          throw new Error(`Failed to load stats: ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) {
          setStats(data);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError('Failed to load stats.');
        }
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    }

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, [email]);

  const handleStartLesson = (slug) => {
    navigate(`/lessons/${slug}`);
  };

  const totalXp = stats?.total_xp ?? 0;
  const lessonsCompleted = stats?.lessons_completed ?? 0;
  const streakDays = stats?.streak_days ?? 0;
  const xpSeries = stats?.xp_last_30_days ?? [];

  // Simple bar graph height scaling
  const maxXp =
    xpSeries.length > 0
      ? Math.max(...xpSeries.map((d) => d.xp || 0), 1)
      : 1;

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Barev{email ? `, ${email.split('@')[0]}` : ''}! 👋
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Keep going – one Armenian letter at a time.
            </p>
          </div>
          <button
            type="button"
            className="text-xs text-gray-500 underline"
            onClick={() => {
              localStorage.removeItem('access_token');
              localStorage.removeItem('user_email');
              navigate('/login');
            }}
          >
            Log out
          </button>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Stats row */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl bg-white border border-orange-100 p-4 shadow-sm flex flex-col">
            <div className="text-xs font-semibold text-orange-500 uppercase tracking-wide">
              Total XP
            </div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {loadingStats ? '…' : totalXp}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Earn XP by finishing lessons.
            </p>
          </div>

          <div className="rounded-2xl bg-white border border-orange-100 p-4 shadow-sm flex flex-col">
            <div className="text-xs font-semibold text-orange-500 uppercase tracking-wide">
              Lessons Completed
            </div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {loadingStats ? '…' : lessonsCompleted}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Finish alphabet lessons to grow this.
            </p>
          </div>

          <div className="rounded-2xl bg-white border border-orange-100 p-4 shadow-sm flex flex-col">
            <div className="text-xs font-semibold text-orange-500 uppercase tracking-wide">
              Streak
            </div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {loadingStats ? '…' : streakDays} <span className="text-base">🔥</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Consecutive days with at least one completed lesson.
            </p>
          </div>
        </section>

        {/* XP graph */}
        <section className="mb-8 rounded-2xl bg-white border border-orange-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                XP in the last 30 days
              </h2>
              <p className="text-xs text-gray-500">
                Each bar is total XP earned that day.
              </p>
            </div>
          </div>

          {loadingStats ? (
            <div className="h-24 flex items-center justify-center text-xs text-gray-400">
              Loading graph…
            </div>
          ) : xpSeries.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-xs text-gray-400">
              Complete a lesson to see your XP history here.
            </div>
          ) : (
            <div className="h-32 flex items-end gap-1">
              {xpSeries.map((day) => {
                const h = (day.xp / maxXp) * 100;
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center justify-end"
                  >
                    <div
                      className="w-full rounded-full bg-orange-500"
                      style={{ height: `${h || 2}%` }}
                      title={`${day.date}: ${day.xp} XP`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Lessons list */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">
              Alphabet lessons
            </h2>
          </div>

          {loadingLessons ? (
            <div className="text-sm text-gray-500">Loading lessons…</div>
          ) : lessons.length === 0 ? (
            <div className="text-sm text-gray-500">
              No lessons found. Check your backend /lessons endpoint.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lessons.map((lesson) => (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => handleStartLesson(lesson.slug)}
                  className="text-left rounded-2xl bg-white border border-orange-100 p-4 shadow-sm hover:border-orange-300 hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-gray-900">
                        {lesson.title}
                      </h3>
                      <span className="text-xs px-2 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-100">
                        {lesson.xp} XP
                      </span>
                    </div>
                    {lesson.description && (
                      <p className="mt-2 text-xs text-gray-600">
                        {lesson.description}
                      </p>
                    )}
                  </div>
                  <div className="mt-3 text-xs text-orange-700 font-medium">
                    Start →
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
