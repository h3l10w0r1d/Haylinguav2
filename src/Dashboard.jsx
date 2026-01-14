import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import HeaderLayout from "./HeaderLayout";

// You can later move this to .env as REACT_APP_API_BASE_URL
const API_BASE_URL = "https://haylinguav2.onrender.com";

function Dashboard() {
  const navigate = useNavigate();

  // lessons state
  const [lessons, setLessons] = useState([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [lessonsError, setLessonsError] = useState("");

  // summary state (xp, streak, etc.)
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  // ─────────────────────────────
  //  Fetch lessons + user summary
  // ─────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("token");

    // If no token, send user to login ONCE
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    const controller = new AbortController();

    async function fetchLessons() {
      try {
        setLoadingLessons(true);
        setLessonsError("");

        const res = await fetch(`${API_BASE_URL}/lessons`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Failed to load lessons (${res.status})`);
        }

        const data = await res.json();
        setLessons(data);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("Failed to fetch lessons:", err);
        setLessonsError("Could not load lessons. Please refresh.");
      } finally {
        setLoadingLessons(false);
      }
    }

    async function fetchSummary() {
      try {
        setLoadingSummary(true);
        setSummaryError("");

        const res = await fetch(`${API_BASE_URL}/users/me/summary`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Failed to load summary (${res.status})`);
        }

        const data = await res.json();
        setSummary(data);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("Failed to fetch summary:", err);
        setSummaryError("Could not load your progress.");
      } finally {
        setLoadingSummary(false);
      }
    }

    fetchLessons();
    fetchSummary();

    // cleanup if component unmounts
    return () => controller.abort();
  }, [navigate]);

  // ─────────────────────────────
  //  Handlers
  // ─────────────────────────────
  const handleOpenLesson = (slug) => {
    navigate(`/lesson/${slug}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    navigate("/login", { replace: true });
  };

  // ─────────────────────────────
  //  Render
  // ─────────────────────────────
  return (
    <div className="dashboard-root">
      <HeaderLayout onLogout={handleLogout} />

      <main className="dashboard-main">
        {/* Top summary cards */}
        <section className="dashboard-summary">
          <div className="dashboard-card">
            <h2>Total XP</h2>
            <p className="big-number">
              {loadingSummary
                ? "…"
                : summary?.total_xp != null
                ? summary.total_xp
                : 0}
            </p>
          </div>

          <div className="dashboard-card">
            <h2>Daily streak</h2>
            <p className="big-number">
              {loadingSummary
                ? "…"
                : `${summary?.streak_days ?? 0} days`}
            </p>
          </div>

          <div className="dashboard-card">
            <h2>Lessons completed</h2>
            <p className="big-number">
              {loadingSummary
                ? "…"
                : `${summary?.completed_lessons ?? 0} / ${
                    summary?.total_lessons ?? lessons.length
                  }`}
            </p>
          </div>
        </section>

        {/* Error for summary */}
        {summaryError && (
          <div className="dashboard-error">{summaryError}</div>
        )}

        {/* Alphabet path / lessons list */}
        <section className="dashboard-lessons">
          <h2>Alphabet path</h2>

          {lessonsError && (
            <div className="dashboard-error">{lessonsError}</div>
          )}

          {loadingLessons ? (
            <p className="dashboard-loading">Loading lessons…</p>
          ) : lessons.length === 0 ? (
            <p className="dashboard-empty">No lessons yet.</p>
          ) : (
            <div className="lesson-grid">
              {lessons.map((lesson) => (
                <button
                  key={lesson.id}
                  className="lesson-card"
                  onClick={() => handleOpenLesson(lesson.slug)}
                >
                  <div className="lesson-card-header">
                    <div>
                      <h3>{lesson.title}</h3>
                      {lesson.description && (
                        <p className="lesson-desc">
                          {lesson.description}
                        </p>
                      )}
                    </div>
                    <span className="lesson-xp">
                      {lesson.xp ?? lesson.xp_reward ?? 20} XP
                    </span>
                  </div>
                  <p className="lesson-cta">Continue lesson</p>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
