// src/Dashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

const API_BASE = 'https://haylinguav2.onrender.com';

export default function Dashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    total_xp: 0,
    daily_streak: 0,
    lessons_completed: 0,
  });

  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);

  // ----------------------------------------------------
  // Load stats + lessons in one effect
  // ----------------------------------------------------
  useEffect(() => {
    const token = localStorage.getItem('access_token');

    // if not logged in, kick to login
    if (!token) {
      navigate('/login');
      return;
    }

    async function load() {
      try {
        // 1) stats
        const statsRes = await fetch(`${API_BASE}/me/stats`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (statsRes.ok) {
          const s = await statsRes.json();
          setStats({
            total_xp: s.total_xp ?? 0,
            daily_streak: s.daily_streak ?? 0,
            lessons_completed: s.lessons_completed ?? 0,
          });
        } else {
          console.error('Failed to load stats', statsRes.status);
        }

        // 2) lessons
        const lessonsRes = await fetch(`${API_BASE}/lessons`);
        if (lessonsRes.ok) {
          const list = await lessonsRes.json();
          setLessons(Array.isArray(list) ? list : []);
        } else {
          console.error('Failed to load lessons', lessonsRes.status);
        }
      } catch (err) {
        console.error('Dashboard load error', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [navigate]);

  // quick navigation when a lesson card is clicked
  const openLesson = (slug) => {
    navigate(`/lessons/${slug}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <p className="text-gray-600">Loading your progress…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white pb-16">
      <div className="max-w-5xl mx-auto px-4 pt-6">
        {/* Top stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Total XP */}
          <div className="rounded-3xl p-5 bg-gradient-to-r from-orange-500 to-red-400 text-white flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-semibold">Total XP</span>
              <span className="text-2xl">🏆</span>
            </div>
            <div className="text-4xl font-bold">{stats.total_xp}</div>
          </div>

          {/* Daily streak */}
          <div className="rounded-3xl p-5 bg-gradient-to-r from-orange-400 to-orange-500 text-white flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-semibold">Daily streak</span>
              <span className="text-2xl">🔥</span>
            </div>
            <div className="text-4xl font-bold">{stats.daily_streak}</div>
          </div>

          {/* Lessons completed */}
          <div className="rounded-3xl p-5 bg-gradient-to-r from-emerald-400 to-teal-500 text-white flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-semibold">Lessons completed</span>
              <span className="text-2xl">✅</span>
            </div>
            <div className="text-4xl font-bold">{stats.lessons_completed}</div>
          </div>
        </div>

        {/* Alphabet path */}
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Alphabet path
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lessons.map((lesson) => (
            <button
              key={lesson.id}
              type="button"
              onClick={() => openLesson(lesson.slug)}
              className="w-full text-left bg-white rounded-3xl border border-orange-100 px-6 py-5 flex items-start gap-4 hover:shadow-md hover:border-orange-300 transition"
            >
              <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600 flex-shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <div className="text-lg font-semibold text-gray-900 mb-1">
                  {lesson.title}
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  {lesson.description}
                </div>
                <div className="text-xs text-gray-500">
                  Level {lesson.level} · {lesson.xp} XP
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
