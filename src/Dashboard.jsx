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
    console.log("[Dashboard] mounted");

    const token = localStorage.getItem("access_token");
    console.log("[Dashboard] token from localStorage:", token);

    const url = `${API_BASE_URL}/lessons`;
    console.log("[Dashboard] fetching lessons from:", url);

    const headers = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    fetch(url, {
      method: "GET",
      headers,
      // explicit CORS just to be loud
      mode: "cors",
    })
      .then(async (res) => {
        console.log("[Dashboard] response status:", res.status);
        let data = null;
        try {
          data = await res.json();
        } catch (e) {
          console.warn("[Dashboard] could not parse JSON:", e);
        }
        console.log("[Dashboard] response body:", data);

        if (!res.ok) {
          throw new Error(
            data?.detail || `Request failed with status ${res.status}`
          );
        }

        setLessons(data || []);
        setError(null);
      })
      .catch((err) => {
        console.error("[Dashboard] fetch error:", err);
        setError(err.message || "Failed to load lessons");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="app-root">
      <HeaderLayout />
      <main className="dashboard-container">
        <h1>Exercises</h1>

        {loading && <p>Loading lessons…</p>}
        {error && (
          <p style={{ color: "red" }}>
            Error: {error}
          </p>
        )}

        {!loading && !error && lessons.length === 0 && (
          <p>No lessons available.</p>
        )}

        <div className="lessons-grid">
          {lessons.map((lesson) => (
            <div key={lesson.id} className="lesson-card">
              <h2>{lesson.title}</h2>
              <p>{lesson.description}</p>
              <p>
                Level {lesson.level} · {lesson.xp_reward ?? lesson.xp} XP
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
