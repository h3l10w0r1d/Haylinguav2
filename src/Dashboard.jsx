// src/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Trophy, Zap, Loader2, ArrowRight } from "lucide-react";

import HeaderLayout from "./HeaderLayout";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

export default function Dashboard() {
  const navigate = useNavigate();

  const [lessons, setLessons] = useState([]);
  const [stats, setStats] = useState({ total_xp: 0, lessons_completed: 0 });

  const [loadingLessons, setLoadingLessons] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [errorLessons, setErrorLessons] = useState("");
  const [errorStats, setErrorStats] = useState("");

  const token = useMemo(() => {
    return (
      localStorage.getItem("hay_token") ||
      localStorage.getItem("access_token") ||
      ""
    );
  }, []);

  const email = useMemo(() => {
    const storedEmail = localStorage.getItem("user_email");
    if (storedEmail) return storedEmail;

    try {
      const raw = localStorage.getItem("hay_user");
      if (!raw) return "";
      const u = JSON.parse(raw);
      return u?.email || "";
    } catch {
      return "";
    }
  }, []);

  const streak = useMemo(() => {
    // backend doesn't provide streak yet -> show from stored user if present
    try {
      const raw = localStorage.getItem("hay_user");
      if (!raw) return 0;
      const u = JSON.parse(raw);
      return Number(u?.streak || 0);
    } catch {
      return 0;
    }
  }, []);

  // --------------------
  // Load lessons
  // --------------------
  useEffect(() => {
    let cancelled = false;

    async function loadLessons() {
      setLoadingLessons(true);
      setErrorLessons("");

      try {
        const res = await fetch(`${API_BASE}/lessons`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Failed to load lessons (${res.status})`);
        }

        const data = await res.json();
        if (!cancelled) setLessons(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("[Dashboard] Error loading lessons:", err);
        if (!cancelled) setErrorLessons("Failed to load lessons.");
      } finally {
        if (!cancelled) setLoadingLessons(false);
      }
    }

    loadLessons();
    return () => {
      cancelled = true;
    };
  }, []);

  // --------------------
  // Load stats
  // --------------------
  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      setLoadingStats(true);
      setErrorStats("");

      if (!email) {
        setLoadingStats(false);
        setStats({ total_xp: 0, lessons_completed: 0 });
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE}/me/stats?email=${encodeURIComponent(email)}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Failed to load stats (${res.status})`);
        }

        const data = await res.json();
        if (!cancelled) {
          setStats({
            total_xp: Number(data?.total_xp || 0),
            lessons_completed: Number(data?.lessons_completed || 0),
          });
        }
      } catch (err) {
        console.error("[Dashboard] Error loading stats:", err);
        if (!cancelled) setErrorStats("Failed to load stats.");
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, [email, token]);

  const isLoadingTop = loadingLessons || loadingStats;

  return (
    <HeaderLayout>
      <div className="min-h-[calc(100vh-72px)] bg-orange-50">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* Top header */}
          <div className="mb-5">
            <h1 className="text-2xl font-bold text-gray-900">Your learning</h1>
            <p className="text-sm text-gray-600">
              Track your progress and start the next lesson.
            </p>
          </div>

          {/* Analytics cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white/90 backdrop-blur rounded-2xl border border-orange-100 shadow-sm p-4">
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
              <p className="text-xs text-gray-500 mt-2">
                Keep a daily streak to build momentum.
              </p>
            </div>

            <div className="bg-white/90 backdrop-blur rounded-2xl border border-orange-100 shadow-sm p-4">
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
              <p className="text-xs text-gray-500 mt-2">
                XP comes from completing lessons.
              </p>
            </div>

            <div className="bg-white/90 backdrop-blur rounded-2xl border border-orange-100 shadow-sm p-4">
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
              <p className="text-xs text-gray-500 mt-2">
                Finish lessons to unlock more content.
              </p>
            </div>
          </div>

          {(errorStats || errorLessons) && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorStats || errorLessons}
            </div>
          )}

          {/* Exercises / Lessons */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Exercises</h2>
            {isLoadingTop && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {loadingLessons ? (
              <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-5">
                <p className="text-gray-600">Loading lessons…</p>
              </div>
            ) : lessons.length === 0 ? (
              <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-5">
                <p className="text-gray-700">No lessons found.</p>
                <p className="text-sm text-gray-500">
                  Check seeding logs and the `/lessons` endpoint.
                </p>
              </div>
            ) : (
              lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="bg-white/95 backdrop-blur rounded-2xl border border-orange-100 shadow-sm p-5 flex flex-col"
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

                    <div className="mt-3 text-xs text-gray-500">
                      Level: <span className="font-medium">{lesson.level}</span>{" "}
                      · <span className="font-medium">{lesson.xp}</span> XP
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/lesson/${lesson.slug}`)}
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
      </div>
    </HeaderLayout>
  );
}
