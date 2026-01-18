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

  // ----- Load lesson -----
  useEffect(() => {
    async function loadLesson() {
      try {
        setLoading(true);
        const url = `${API_BASE}/lessons/${slug}`;
        console.log("[LessonPlayer] Fetching lesson:", url);

        const res = await fetch(url);
        const text = await res.text();
        console.log(
          "[LessonPlayer] /lessons response",
          res.status,
          text.slice(0, 200)
        );

        if (!res.ok) {
          alert(`Failed to load lesson (${res.status}). See console for details.`);
          return;
        }

        const data = JSON.parse(text);
        setLesson(data);
        setCurrentIndex(0);
      } catch (err) {
        console.error("[LessonPlayer] Error loading lesson", err);
        alert("Error loading lesson. Open the console for details.");
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      loadLesson();
    }
  }, [slug]);

  // ----- Step navigation -----
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

  // ----- Done button: call backend + debug -----
  const handleDone = async () => {
    if (!lesson) return;

    const email = window.localStorage.getItem("userEmail");
    const token = window.localStorage.getItem("token");

    console.log("[LessonPlayer] Done clicked", {
      slug,
      email,
      hasToken: !!token,
      apiBase: API_BASE,
    });

    const url = `${API_BASE}/lessons/${slug}/complete`;
    const body = JSON.stringify({ email });

    console.log("[LessonPlayer] Calling complete endpoint:", url, "body=", body);

    try {
      setSaving(true);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
      });

      const text = await res.text();
      console.log(
        "[LessonPlayer] /complete response",
        res.status,
        text.slice(0, 300)
      );

      if (res.status === 401) {
        alert("Session expired (401 from backend). Please log in again.");
        navigate("/login");
        return;
      }

      if (!res.ok) {
        alert(
          `Lesson completion failed (${res.status}). Check console/network tab for details.`
        );
        return;
      }

      let stats = null;
      try {
        stats = JSON.parse(text);
      } catch (e) {
        console.warn("[LessonPlayer] Could not parse stats JSON", e);
      }
      console.log("[LessonPlayer] Stats after completion:", stats);

      // Navigate back to dashboard as before
      navigate("/dashboard");
    } catch (err) {
      console.error("[LessonPlayer] Error completing lesson", err);
      alert("Error completing lesson. See console for details.");
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
            onAnswer={(result) => {
              console.log(
                "[LessonPlayer] Answer result for exercise",
                currentExercise.id,
                result
              );
              // You can later use result.xpEarned etc. if you want per-step XP UI.
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
