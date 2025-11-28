// src/Dashboard.jsx
import React, { useEffect, useState } from "react";

// You can later move this into a config file or env var.
// For now this keeps working in dev + prod.
const API =
  import.meta.env.VITE_API_URL || "https://haylinguav2.onrender.com";

function classNames(...parts) {
  return parts.filter(Boolean).join(" ");
}

export default function Dashboard() {
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Hard-coded progress for now (you can connect this to real user data later)
  const [completedLevels] = useState(0);

  useEffect(() => {
    async function loadLevels() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API}/levels`);
        if (!res.ok) {
          throw new Error(`Server responded with ${res.status}`);
        }

        const data = await res.json();
        setLevels(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load levels", err);
        setError("Could not load levels from server.");
      } finally {
        setLoading(false);
      }
    }

    loadLevels();
  }, []);

  return (
    <div className="roadmap-page">
      <header className="roadmap-hero">
        <h1>Your Armenian Roadmap</h1>
        <p>
          Progress through bite-sized pronunciation levels. Each level contains
          5–7 voice exercises. Finish a level to unlock the next.
        </p>
      </header>

      <main className="roadmap-section">
        {error && <p className="roadmap-error">{error}</p>}
        {loading && <p className="roadmap-loading">Loading levels…</p>}

        <h2 className="roadmap-section-title">Levels</h2>

        <div className="roadmap-track">
          {levels.map((level, index) => {
            const isUnlocked = index <= completedLevels;
            const isActive = index === completedLevels;

            return (
              <div
                key={level.id}
                className={classNames(
                  "roadmap-step",
                  isActive && "roadmap-step--active",
                  !isUnlocked && "roadmap-step--locked"
                )}
              >
                <div className="roadmap-badge-wrapper">
                  <div className="roadmap-badge">
                    {isActive && (
                      <span className="roadmap-badge-label">START</span>
                    )}
                    <span className="roadmap-badge-icon">
                      {isUnlocked ? "⭐" : "🔒"}
                    </span>
                  </div>
                </div>

                <div className="roadmap-info">
                  <h3>{level.name}</h3>
                  <p>{level.description}</p>
                  <p style={{ marginTop: "0.35rem", fontSize: "0.85rem" }}>
                    {level.exercises?.length ?? 0} exercises · pronunciation
                    drills
                  </p>
                </div>
              </div>
            );
          })}

          {!loading && !error && levels.length === 0 && (
            <p className="roadmap-error">
              No levels available yet. Try again later.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
