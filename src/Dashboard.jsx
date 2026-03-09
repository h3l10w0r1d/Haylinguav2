// src/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Trophy, Zap, Loader2, ArrowRight } from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

export default function Dashboard({ user, onLogout }) {
  const navigate = useNavigate();

  const [lessons, setLessons] = useState([]); // LessonProgressOut[]
  const [stats, setStats] = useState({ total_xp: 0, lessons_completed: 0, streak: 0 });

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

  const streak = Number(stats?.streak ?? user?.streak ?? 0) || 0;

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        setLoadingLessons(true);
        const res = await fetch(`${API_BASE_URL}/me/lessons/progress`, {
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

        setLessons(Array.isArray(data) ? data : []);
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
          streak: Number(data?.streak || 0),
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

  const statusBadge = (status) => {
    if (status === "completed") return "bg-emerald-100 text-emerald-700";
    if (status === "current") return "bg-orange-100 text-orange-700";
    return "bg-gray-100 text-gray-600";
  };

  return (
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
          <h2 className="text-lg font-semibold text-gray-900">Lessons</h2>
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
            lessons.map((lesson) => {
              const status = lesson.status || "locked";
              const isCompleted = status === "completed";
              const isCurrent = status === "current";
              const isLocked = status === "locked";

              const cardClass = isCompleted
                ? "bg-emerald-50/70 border-emerald-200"
                : isCurrent
                ? "bg-white border-orange-100"
                : "bg-gray-50 border-gray-200";

              const pct = Number(lesson.completion_pct || 0);

              return (
                <div
                  key={lesson.id}
                  className={`rounded-2xl border shadow-sm p-5 flex flex-col transition ${cardClass}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className={`text-lg font-semibold ${isLocked ? "text-gray-500" : "text-gray-900"}`}>
                        {lesson.title}
                      </h3>
                      {lesson.description && (
                        <p className={`text-sm mt-1 ${isLocked ? "text-gray-400" : "text-gray-600"}`}>
                          {lesson.description}
                        </p>
                      )}
                    </div>

                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusBadge(status)}`}>
                      {isCompleted ? "Completed" : isCurrent ? "Current" : "Locked"}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        XP: <span className="font-medium text-gray-700">{lesson.xp_earned ?? 0}</span>
                        <span className="text-gray-400"> / {lesson.xp_total ?? 0}</span>
                      </span>
                      <span>
                        {lesson.exercises_completed ?? 0}
                        <span className="text-gray-400"> / {lesson.exercises_total ?? 0}</span> exercises
                      </span>
                    </div>

                    <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${isCompleted ? "bg-emerald-500" : isCurrent ? "bg-orange-500" : "bg-gray-400"}`}
                        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">{pct.toFixed(0)}% complete</div>
                  </div>

                  {isCurrent && (
  <button
    type="button"
    onClick={() => handleStartLesson(lesson)}
    className="
      mt-4 w-full
      relative overflow-hidden cta-float
      inline-flex items-center justify-center gap-2
      px-4 py-3 text-sm font-semibold
      rounded-xl
      bg-gradient-to-r from-orange-500 to-pink-500 text-white
      shadow-md
      transition-transform duration-200
      hover:scale-[1.02]
      active:scale-[0.99]
    "
  >
    Continue <ArrowRight className="w-4 h-4" />
  </button>
)}

                  {isCompleted && (
                    <button
                      onClick={() => handleStartLesson(lesson)}
                      className="mt-4 w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold transition transform hover:scale-[1.02] hover:shadow-md active:scale-[0.99]"
                    >
                      Repeat
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}

                  {isLocked && (
                    <div className="mt-4 w-full py-3 rounded-xl bg-gray-200 text-gray-500 text-sm font-semibold text-center">
                      Locked
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
    </div>
  );
}
