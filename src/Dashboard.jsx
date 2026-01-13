// src/Dashboard.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Flame, CheckCircle2, BookOpen } from "lucide-react";

const API_BASE = "https://haylinguav2.onrender.com";

export default function Dashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    total_xp: 0,
    daily_streak: 0,
    lessons_completed: 0,
  });

  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // ----------------------------------------------------
  // Load stats + lessons once on mount
  // ----------------------------------------------------
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);

      try {
        // fetch stats
        const statsRes = await fetch(`${API_BASE}/me/stats`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (statsRes.status === 401) {
          // token invalid/expired – kick back to login once
          localStorage.removeItem("token");
          navigate("/login");
          return;
        }

        if (!statsRes.ok) {
          throw new Error(`Failed to load stats: ${statsRes.status}`);
        }

        const statsJson = await statsRes.json();

        // fetch lessons (public)
        const lessonsRes = await fetch(`${API_BASE}/lessons`);
        if (!lessonsRes.ok) {
          throw new Error(`Failed to load lessons: ${lessonsRes.status}`);
        }
        const lessonsJson = await lessonsRes.json();

        if (!cancelled) {
          setStats(statsJson);
          setLessons(lessonsJson);
        }
      } catch (err) {
        console.error("Dashboard load error:", err);
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load dashboard"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // ----------------------------------------------------
  // Simple helpers
  // ----------------------------------------------------
  const userDisplayName = localStorage.getItem("userEmail") || "Armen";

  const handleLessonClick = (slug) => {
    navigate(`/lessons/${slug}`);
  };

  // ----------------------------------------------------
  // Render
  // ----------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <p className="text-gray-600">Loading your dashboard…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-orange-50">
        <p className="text-red-600 mb-4">{loadError}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl bg-orange-600 text-white hover:bg-orange-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF7EE]">
      {/* Top nav */}
      <header className="h-16 flex items-center justify-between px-6 md:px-10 border-b border-orange-100 bg-white/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-orange-600 flex items-center justify-center text-white font-bold">
            H
          </div>
          <span className="font-semibold text-lg text-gray-900">Haylingua</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          <button className="text-orange-600 border-b-2 border-orange-600 pb-1">
            Exercises
          </button>
          <button className="text-gray-400">Friends</button>
          <button className="text-gray-400">Leaderboard</button>
          <button
            className="text-gray-400"
            onClick={() => navigate("/profile")}
          >
            Profile
          </button>
        </nav>

        <div className="flex items-center gap-3 text-sm">
          <div className="text-right">
            <div className="text-xs text-gray-400">{userDisplayName}</div>
            <div className="text-[11px] text-gray-400">
              {stats.total_xp} XP · lvl 1
            </div>
          </div>
          <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 text-xs">
            →
          </div>
        </div>
      </header>

      {/* Main body */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 pt-6 pb-16">
        {/* Stats cards */}
        <section className="grid md:grid-cols-3 gap-4 mb-10">
          {/* Total XP */}
          <div className="rounded-3xl px-6 py-5 bg-gradient-to-r from-orange-400 to-rose-500 text-white flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-semibold">Total XP</span>
              <Trophy className="w-6 h-6" />
            </div>
            <div className="text-4xl font-bold leading-none">
              {stats.total_xp}
            </div>
          </div>

          {/* Daily streak */}
          <div className="rounded-3xl px-6 py-5 bg-gradient-to-r from-orange-400 to-orange-500 text-white flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-semibold">Daily streak</span>
              <Flame className="w-6 h-6" />
            </div>
            <div className="text-4xl font-bold leading-none">
              {stats.daily_streak}
            </div>
          </div>

          {/* Lessons completed */}
          <div className="rounded-3xl px-6 py-5 bg-gradient-to-r from-emerald-400 to-teal-500 text-white flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-semibold">Lessons completed</span>
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="text-4xl font-bold leading-none">
              {stats.lessons_completed}
            </div>
          </div>
        </section>

        {/* Alphabet path */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Alphabet path
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            {lessons.map((lesson) => (
              <button
                key={lesson.id}
                type="button"
                onClick={() => handleLessonClick(lesson.slug)}
                className="w-full text-left bg-white rounded-3xl border border-orange-100 px-5 py-4 shadow-sm hover:shadow-md hover:border-orange-200 transition"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-700">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 mb-1">
                      {lesson.title}
                    </div>
                    {lesson.description && (
                      <div className="text-sm text-gray-600 mb-2">
                        {lesson.description}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>Level {lesson.level}</span>
                      <span>•</span>
                      <span>{lesson.xp} XP</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
