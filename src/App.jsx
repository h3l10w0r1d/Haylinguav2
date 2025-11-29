// src/App.jsx
import React, { useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import LandingPage from "./LandingPage.jsx";
import Dashboard from "./Dashboard.jsx";

// Backend base URL (from Vite env or fallback)
const API = import.meta.env.VITE_API_URL ?? "https://haylinguav2.onrender.com";

export default function App() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // --- AUTH HANDLERS ---

  async function handleSignup(name, email, password) {
    try {
      const res = await fetch(`${API}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        let msg = "Signup failed";
        try {
          const data = await res.json();
          if (data?.detail) msg = data.detail;
        } catch (_) {}
        throw new Error(msg);
      }

      // For now we fake user profile locally
      setUser({
        name,
        level: 1,
        xp: 0,
        streak: 1,
        completedLessons: [],
      });

      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      alert(err.message || "Signup error");
    }
  }

  async function handleLogin(email, password) {
    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        let msg = "Login failed";
        try {
          const data = await res.json();
          if (data?.detail) msg = data.detail;
        } catch (_) {}
        throw new Error(msg);
      }

      // If backend returns user data, you can use it here
      let data = {};
      try {
        data = await res.json();
      } catch (_) {}

      setUser({
        name: data.name || email.split("@")[0],
        level: data.level ?? 1,
        xp: data.xp ?? 0,
        streak: data.streak ?? 1,
        completedLessons: data.completedLessons ?? [],
      });

      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      alert(err.message || "Login error");
    }
  }

  function handleStartLesson(lesson) {
    console.log("Start lesson:", lesson.id);
    // later: navigate to /lesson/:id or open exercise view
  }

  // --- ROUTES ---

  return (
    <Routes>
      <Route
        path="/"
        element={
          <LandingPage
            onLogin={handleLogin}
            onSignup={handleSignup}
          />
        }
      />
      <Route
        path="/dashboard"
        element={
          user ? (
            <Dashboard user={user} onStartLesson={handleStartLesson} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      {/* Fallback: anything unknown goes to landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
