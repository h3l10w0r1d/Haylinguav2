// src/App.jsx
import { Routes, Route, useNavigate } from "react-router-dom";
import LandingPage from "./LandingPage";
import Dashboard from "./Dashboard"; // whatever your dashboard component file is

const API = import.meta.env.VITE_API_URL; // e.g. "https://haylinguav2.onrender.com"

export default function App() {
  const navigate = useNavigate();

  const handleSignup = async (name, email, password) => {
    const res = await fetch(`${API}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }), // backend doesn’t use name yet
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "Signup failed");
    }

    // optional: auto-login or token handling
    alert("Account created successfully!");
    navigate("/dashboard");
  };

  const handleLogin = async (email, password) => {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "Login failed");
    }

    const data = await res.json();
    if (data.token) {
      localStorage.setItem("token", data.token);
    }
    navigate("/dashboard");
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <LandingPage onLogin={handleLogin} onSignup={handleSignup} />
        }
      />
      <Route path="/dashboard" element={<Dashboard />} />
      {/* keep other routes if you still want /login and /signup pages */}
    </Routes>
  );
}
