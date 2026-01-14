// src/Dashboard.jsx
import React, { useEffect, useState } from "react";
import HeaderLayout from "./HeaderLayout";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

export default function Dashboard() {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLessons = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem("access_token");
        console.log("[Dashboard] token:", token);

        const url = `${API_BASE_URL}/lessons`;
        console.log("[Dashboard] Fetching lessons from:", url);

        const headers = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch(url, {
          method: "GET",
          headers,
          mode: "cors",
        });

        console.log("[Dashboard] /lessons status:", res.status);

        let data = null;
        try {
          data = await res.json();
        } catch (e) {
          console.warn("[Dashboard] Could not parse JSON:", e);
        }
        console.log("[Dashboard] /lessons body:", data);

        if (!res.ok) {
          throw new Error(
            data?.detail || `Failed to load lessons (status ${res.status})`
          );
        }

        let lessonsArray = [];
        if (Array.isArray(data)) {
          lessonsArray = data;
        } else if (data && Array.isArray(data.lessons)) {
          lessonsArray = data.lessons;
        } else {
          console.warn(
            "[Dashboard] Unexpected lessons response shape, using empty array"
          );
        }

        console.log("[Dashboard] lessons count:", lessonsArray.length);
        setLessons(lessonsArray);
      } catch (err) {
        console.error("[Dashboard] Error loading lessons:", err);
        setError(err.message || "Failed to load lessons");
      } finally {
        setLoading(false);
      }
    };

    fetchLessons();
  }, []);

  const handleStartLesson = (lesson) => {
    // If you have a router, you can use navigate() instead.
    if (lesson.slug) {
      window.location.href = `/lesson/${lesson.slug}`;
    } else {
      console.warn("[Dashboard] Lesson has no slug:", lesson);
    }
  };

  return (
    <div className="app-root">
      <HeaderLayout />

      <main className="dashboard-container" style={{ padding: "24px" }}>
        <h1 style={{ marginBottom: "16px" }}>Exercises</h1>

        {loading && <p>Loading lessons…</p>}

        {error && (
          <p style={{ color: "red", marginBottom: "16px" }}>
            Error: {error}
          </p>
        )}

        {!loading && !error && lessons.length === 0 && (
          <p>No lessons available yet.</p>
        )}

        <div
          className="lessons-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginTop: "16px",
          }}
        >
          {lessons.map((lesson) => (
            <div
              key={lesson.id}
              className="lesson-card"
              style={{
                borderRadius: "12px",
                padding: "16px",
                border: "1px solid #e0e0e0",
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                background: "white",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h2 style={{ fontSize: "18px", marginBottom: "8px" }}>
                  {lesson.title}
                </h2>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#555",
                    marginBottom: "8px",
                  }}
                >
                  {lesson.description}
                </p>
                <p
                  style={{
                    fontSize: "13px",
                    color: "#777",
                  }}
                >
                  Level:{" "}
                  {lesson.level !== undefined && lesson.level !== null
                    ? lesson.level
                    : "–"}{" "}
                  ·{" "}
                  {lesson.xp_reward ??
                    lesson.xp ??
                    0}{" "}
                  XP
                </p>
              </div>

              <button
                onClick={() => handleStartLesson(lesson)}
                style={{
                  marginTop: "12px",
                  padding: "8px 12px",
                  borderRadius: "999px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 500,
                  background:
                    "linear-gradient(135deg, #f97316 0%, #ec4899 100%)",
                  color: "white",
                }}
              >
                Start lesson
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
