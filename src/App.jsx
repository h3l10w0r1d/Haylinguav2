// src/App.jsx
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import LandingPage from "./LandingPage";
import Dashboard from "./Dashboard";

function AppRoutes() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // 🔁 1) HYDRATE USER FROM LOCALSTORAGE ON APP LOAD
  useEffect(() => {
    const raw = localStorage.getItem("haylinguaUser");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setUser(parsed);
      } catch (e) {
        console.error("Failed to parse stored user", e);
        localStorage.removeItem("haylinguaUser");
      }
    }
  }, []);

  // 2) LOGIN HANDLER (called from LandingPage modal)
  const handleLogin = async (email, password) => {
    const res = await fetch("https://haylinguav2.onrender.com/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "Login failed");
    }

    const data = await res.json(); // { token: "...", maybe more }

    const userData = {
      email,
      name: email.split("@")[0],
      token: data.token,
      level: 1,
      xp: 0,
      streak: 0,
      completedLessons: [],
    };

    setUser(userData);
    localStorage.setItem("haylinguaUser", JSON.stringify(userData));

    // ✅ use SPA navigation, no full reload
    navigate("/dashboard");
  };

  // 3) SIGNUP HANDLER
  const handleSignup = async (name, email, password) => {
    const res = await fetch("https://haylinguav2.onrender.com/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "Signup failed");
    }

    // after signup, treat as logged-in
    const userData = {
      email,
      name: name || email.split("@")[0],
      token: null, // or request a token on signup too
      level: 1,
      xp: 0,
      streak: 0,
      completedLessons: [],
    };

    setUser(userData);
    localStorage.setItem("haylinguaUser", JSON.stringify(userData));
    navigate("/dashboard");
  };

  const handleStartLesson = (lesson) => {
    console.log("Start lesson", lesson.id);
    // later: navigate to /lesson/:id or open exercise view
  };

  return (
    <Routes>
      <Route
        path="/"
        element={<LandingPage onLogin={handleLogin} onSignup={handleSignup} />}
      />
      <Route
        path="/dashboard"
        element={<Dashboard user={user} onStartLesson={handleStartLesson} />}
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
