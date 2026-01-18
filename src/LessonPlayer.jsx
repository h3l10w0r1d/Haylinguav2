// src/LessonPlayer.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ExerciseRenderer from "./ExerciseRenderer";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://YOUR-BACKEND-URL.onrender.com";

export default function LessonPlayer() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadLesson() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/lessons/${slug}`);
        if (!res.ok) {
          alert(`Failed to load lesson (${res.status})`);
          return;
        }
        const data = await res.json();
        setLesson(data);
        setCurrentIndex(0);
      } catch (err) {
        console.error("Error loading lesson", err);
        alert("Error loading lesson");
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      loadLesson();
    }
  }, [slug]);

  const goNext = () => {
    if (!lesson) return;
    setCurrentIndex((idx) =>
      Math.min(idx + 1, (lesson.exercises?.length || 1) - 1)
    );
  };

  const goPrev = () => {
    if (!lesson) return;
    setCurrentIndex((idx) => Math.max(idx - 1, 0));
  };

  const handleDone = async () => {
    if (!lesson) return;

    const email = window.localStorage.getItem("userEmail");
    const token = window.localStorage.getItem("token");

    if (!email) {
      alert("Session expired. Please log in again.");
      navigate("/login");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(`${API_BASE}/lessons/${slug}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email }),
      });

      if (res.status === 401) {
        // generic 'session expired' handling
        alert("Session expired. Please log in again.");
        navigate("/login");
        return;
      }

      if (!res.ok) {
        console.error("Complete lesson failed", res.status);
        alert("Could not complete lesson.");
        return;
      }

      // Optionally read stats:
      // const stats = await res.json();
      // console.log("Updated stats:", stats);

      navigate("/dashboard");
    } catch (err) {
      console.error("Error completing lesson", err);
      alert("Error completing lesson.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="lesson-layout">
        <p>Loading lesson…</p>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="lesson-layout">
        <p>Lesson not found.</p>
      </div>
    );
  }

  const exercises = lesson.exercises || [];
  const currentExercise = exercises[currentIndex];
  const totalExercises = exercises.length || 1;
  const progress = ((currentIndex + 1) / totalExercises) * 100;

  return (
    <div className="lesson-layout">
      <header className="lesson-header">
        <button onClick={() => navigate(-1)} className="back-button">
          ← Back
        </button>
        <div className="lesson-title-block">
          <h1>{lesson.title}</h1>
          <p className="lesson-subtitle">
            Exercise {currentIndex + 1} of {totalExercises}
          </p>
        </div>
        <div className="lesson-spacer" />
      </header>

      <div className="lesson-progress-bar">
        <div
          className="lesson-progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      <main className="lesson-main">
        {currentExercise ? (
          <ExerciseRenderer
            exercise={currentExercise}
            onAnswer={() => {
              // we’re not doing per-step XP here, just showing UI
            }}
          />
        ) : (
          <p>No exercise found.</p>
        )}
      </main>

      <footer className="lesson-footer">
        <button
          type="button"
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="nav-button"
        >
          &lt; Previous
        </button>

        <div className="footer-spacer" />

        <button
          type="button"
          onClick={goNext}
          disabled={currentIndex >= totalExercises - 1}
          className="nav-button secondary"
        >
          Next &gt;
        </button>

        <button
          type="button"
          onClick={handleDone}
          disabled={saving}
          className="nav-button primary"
        >
          {saving ? "Saving…" : "Done"}
        </button>
      </footer>
    </div>
  );
}
