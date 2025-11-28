// src/Dashboard.jsx
import React, { useEffect, useState } from "react";
import "./landing.css";

const API = import.meta.env.VITE_API_URL;

export default function Dashboard() {
  const [levels, setLevels] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadLevels() {
      try {
        const res = await fetch(`${API}/levels`);
        if (!res.ok) throw new Error("Failed to load levels");
        const data = await res.json();
        setLevels(data);
      } catch (err) {
        console.error(err);
        setError("Could not load levels from server.");
      }
    }
    loadLevels();
  }, []);

  // for now: first level = active, the rest = locked
  const getStatus = (index) => {
    if (index === 0) return "active";
    return "locked";
  };

  return (
    <div className="roadmap-page">
      <header className="roadmap-hero">
        <h1>Your Armenian Roadmap</h1>
        <p>
          Progress through bite-sized pronunciation levels. Each level contains
          5–7 voice exercises. Finish a level to unlock the next.
        </p>
      </header>

      <section className="roadmap-section">
        <h2 className="roadmap-section-title">Levels</h2>

        {error && <p className="roadmap-error">{error}</p>}

        {!error && levels.length === 0 && (
          <p className="roadmap-loading">Loading levels…</p>
        )}

        {!error && levels.length > 0 && (
          <div className="roadmap-track">
            {levels.map((level, index) => {
              const status = getStatus(index); // "active" or "locked"
              return (
                <div
                  key={level.id}
                  className={`roadmap-step roadmap-step--${status}`}
                >
                  <div className="roadmap-badge-wrapper">
                    <div className="roadmap-badge">
                      {status === "active" && (
                        <span className="roadmap-badge-label">START</span>
                      )}
                      {status === "locked" && (
                        <span className="roadmap-badge-icon">🔒</span>
                      )}
                      {status === "active" && (
                        <span className="roadmap-badge-icon">★</span>
                      )}
                    </div>
                  </div>

                  <div className="roadmap-info">
                    <h3>{level.name}</h3>
                    <p>{level.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
