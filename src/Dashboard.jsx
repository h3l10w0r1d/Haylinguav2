// src/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Trophy, Zap, Loader2, ArrowRight } from "lucide-react";
import HeaderLayout from "./HeaderLayout";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

export default function Dashboard({ user, onLogout }) {
  const navigate = useNavigate();

  const [lessons, setLessons] = useState([]);
  const [stats, setStats] = useState({ total_xp: 0, lessons_completed: 0 });

  const [loadingLessons, setLoadingLessons] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState("");

  const token = useMemo(() => {
    return (
      localStorage.getItem("hay_token") ||
      localStorage.getItem("access_token") ||
      ""
    );
  }, []);

  const email = user?.email || "";

  // backend doesn't provide streak yet → use the user object (your AppShell stores it)
  const streak = Math.max(1, Number(user?.streak ?? 1) || 1);

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        setLoadingLessons(true);
        const res = await fetch(`${API_BASE_URL}/lessons`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(
            data?.detail || `Failed to load lessons (status ${res.status})`
          );
        }

        const lessonsArray = Array.isArray(data)
          ? data
          : Array.isArray(data?.lessons)
          ? data.lessons
          : [];

        setLessons(lessonsArray);
      } catch (err) {
        console.error("[Dashboard] lessons error:", err);
        setError(err.message || "Failed to load lessons");
      } finally {
        setLoadingLessons(false);
      }
    };

    fetchLessons();
  }, [token]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoadingStats(true);

        if (!email) {
          setStats({ total_xp: 0, lessons_completed: 0 });
          return;
        }

        const res = await fetch(
          `${API_BASE_URL}/me/stats?email=${encodeURIComponent(email)}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(
            data?.detail || `Failed to load stats (status ${res.status})`
          );
        }

        setStats({
          total_xp: Number(data?.total_xp || 0),
          lessons_completed: Number(data?.lessons_completed || 0),
        });
      } catch (err) {
        console.error("[Dashboard] stats error:", err);
        // stats failure shouldn't kill the page; show lessons anyway
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [email, token]);

  const handleStartLesson = (lesson) => {
    if (lesson?.slug) navigate(`/lesson/${lesson.slug}`);
  };

  return (
    <HeaderLayout user={user} onLogout={onLogout}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Top analytics */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Your progress</h1>
          <p className="text-sm text-gray-600">
            Track your streak, XP and completed lessons.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/90 rounded-2xl border border-orange-100 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Your streak</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loadingStats ? "…" : streak}
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/90 rounded-2xl border border-orange-100 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Total XP earned</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loadingStats ? "…" : stats.total_xp}
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center">
                <Zap className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white/90 rounded-2xl border border-orange-100 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Lessons completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loadingStats ? "…" : stats.lessons_completed}
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Lessons list */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Exercises</h2>
          {(loadingLessons || loadingStats) && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {loadingLessons ? (
            <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-5">
              <p className="text-gray-600">Loading lessons…</p>
            </div>
          ) : lessons.length === 0 ? (
            <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-5">
              <p className="text-gray-700">No lessons available yet.</p>
            </div>
          ) : (
            lessons.map((lesson) => (
              <div
                key={lesson.id}
                className="bg-white rounded-2xl border border-orange-100 shadow-sm p-5 flex flex-col"
              >
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {lesson.title}
                  </h3>
                  {lesson.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {lesson.description}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-gray-500">
                    Level: <span className="font-medium">{lesson.level}</span> ·{" "}
                    <span className="font-medium">
                      {lesson.xp_reward ?? lesson.xp ?? 0}
                    </span>{" "}
                    XP
                  </p>
                </div>

                <button
                  onClick={() => handleStartLesson(lesson)}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white text-sm font-semibold hover:opacity-95 transition"
                >
                  Start lesson
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </HeaderLayout>
  );
}
