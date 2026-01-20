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
import Friends from "./friends";
import Leaderboard from "./Leaderboard";
import HeaderLayout from "./HeaderLayout";
import ProfilePage from "./ProfilePage";
  // CMS Imports 
import CmsShell from "./cms/CmsShell";
import CmsLessons from "./cms/CmsLessons";
import CmsLessonEditor from "./cms/CmsLessonEditor";

//  Always have a working backend URL even if Vercel env vars are missing
const DEFAULT_API_BASE = "https://haylinguav2.onrender.com";
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || "").trim() || DEFAULT_API_BASE;

function AppShell() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const navigate = useNavigate();





  useEffect(() => {
    console.log("[App] API_BASE =", API_BASE);
  }, []);

  // Load auth state from localStorage
  useEffect(() => {
    try {
      const storedToken =
        localStorage.getItem("hay_token") || localStorage.getItem("access_token");
      const storedUser = localStorage.getItem("hay_user");

      if (storedToken) setToken(storedToken);

      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else {
        // If we only have token (older / alternative flow), keep user null
        // so LandingPage shows; it will be re-created after login.
      }
    } catch (err) {
      console.error("Error reading saved auth state", err);
      localStorage.removeItem("hay_token");
      localStorage.removeItem("access_token");
      localStorage.removeItem("hay_user");
    } finally {
      setLoadingUser(false);
    }
  }, []);

  const handleAuthSuccess = (tokenValue, email) => {
    const baseName = (email || "user").split("@")[0];

    const newUser = {
      id: 1, // placeholder until backend profile endpoint exists
      email,
      name: baseName,
      firstName: "",
      lastName: "",
      avatarUrl: "",
      level: 1,
      xp: 0,
      streak: 0,
      completedLessons: [],
    };

    setToken(tokenValue);
    setUser(newUser);

    // ✅ keep both keys for compatibility
    localStorage.setItem("hay_token", tokenValue);
    localStorage.setItem("access_token", tokenValue);
    localStorage.setItem("hay_user", JSON.stringify(newUser));

    navigate("/dashboard", { replace: true });
  };

  // LOGIN
  const handleLogin = async (email, password) => {
    try {
      const url = `${API_BASE}/login`;
      console.log("[App] POST", url);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Login failed", res.status, text);
        throw new Error("Invalid email or password");
      }

      const data = await res.json();
      const tokenValue = data.access_token;

      if (!tokenValue) {
        console.error("No token in /login response", data);
        throw new Error("No token in /login response");
      }

      handleAuthSuccess(tokenValue, data.email ?? email);
    } catch (err) {
      console.error("Login error", err);
      alert(err.message || "Login failed. Please try again.");
    }
  };

  // SIGNUP
  const handleSignup = async (_name, email, password) => {
    try {
      const url = `${API_BASE}/signup`;
      console.log("[App] POST", url);

      const res = await fetch(url, {
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

      // auto-login after signup
      await handleLogin(email, password);
    } catch (err) {
      console.error("Signup error", err);
      alert("Could not reach the server. Please try again.");
    }
  };

  const handleUpdateUser = (updates) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem("hay_user", JSON.stringify(updated));
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("hay_token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("hay_user");
    navigate("/", { replace: true });
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <p className="text-gray-600">Loading your dashboard…</p>
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
            <Dashboard user={user} onUpdateUser={handleUpdateUser} onLogout={handleLogout} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      <Route
        path="/lesson/:slug"
        element={user ? <LessonPlayer /> : <Navigate to="/" replace />}
      />

      <Route
        path="/friends"
        element={
          user ? (
            <Friends user={user} onUpdateUser={handleUpdateUser} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

<Route
  path="/leaderboard"
  element={
    user ? (
      <Leaderboard user={user} onLogout={handleLogout} />
    ) : (
      <Navigate to="/" replace />
    )
  }
/>

      <Route
  path="/profile"
  element={
    <HeaderLayout user={user} onLogout={handleLogout}>
      <ProfilePage user={user} onUserUpdate={setUser} />
    </HeaderLayout>
  }
/>


//CMS Routes
  <Route path="/:cmsKey/cms" element={<CmsShell />}>
  <Route index element={<CmsLessons />} />
  <Route path="lessons" element={<CmsLessons />} />
  <Route path="lessons/:lessonId" element={<CmsLessonEditor />} />
</Route>

      
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
