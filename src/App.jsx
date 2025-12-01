// src/App.jsx
import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";

import LandingPage from "./LandingPage";
import Dashboard from "./Dashboard";
import LessonPlayer from "./LessonPlayer";

const API_BASE = "https://haylinguav2.onrender.com";

function AppShell() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const navigate = useNavigate();

  // Load user + token from localStorage on first render
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem("hay_token");
      const storedUser = localStorage.getItem("hay_user");

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (err) {
      console.error("Error reading saved auth state", err);
      localStorage.removeItem("hay_token");
      localStorage.removeItem("hay_user");
    } finally {
      setLoadingUser(false);
    }
  }, []);

  // Save everything when auth succeeds
  const handleAuthSuccess = (tokenValue, email) => {
    const newUser = {
      id: 1, // we’re not using real IDs yet
      name: email.split("@")[0],
      level: 1,
      xp: 0,
      streak: 1,
      completedLessons: [],
    };

    setToken(tokenValue);
    setUser(newUser);

    localStorage.setItem("hay_token", tokenValue);
    localStorage.setItem("hay_user", JSON.stringify(newUser));

    navigate("/dashboard", { replace: true });
  };

  async function handleLogin(email, password) {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("Login failed", res.status, data);
      throw new Error(data.detail || `Login failed: ${res.status}`);
    }

    const data = await res.json();
    const tokenValue = data.access_token ?? data.token;

    if (!tokenValue) {
      console.error("No token in /login response", data);
      throw new Error("No token in /login response");
    }

    handleAuthSuccess(tokenValue, data.email ?? email);
  }

  const handleSignup = async (_name, email, password) => {
    try {
      const res = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Signup failed", res.status, text);
        alert("Signup failed. Maybe this email is already registered.");
        return;
      }

      // After successful signup, log the user in
      await handleLogin(email, password);
    } catch (err) {
      console.error("Signup error", err);
      alert("Could not reach the server. Please try again.");
    }
  };

  const handleStartLesson = (lesson) => {
    // lesson.id is like "lesson-1" in Dashboard
    navigate(`/lesson/${lesson.id}`);
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <p className="text-gray-600">
          Loading your dashboard… If this takes too long, please refresh.
        </p>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LandingPage onLogin={handleLogin} onSignup={handleSignup} />
          )
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

      <Route
        path="/lesson/:slug"
        element={
          user ? (
            <LessonPlayer token={token} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
