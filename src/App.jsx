// src/App.jsx
import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom';

import LandingPage from './LandingPage';
import Dashboard from './Dashboard';
import Friends from './Friends';
import Leaderboard from './Leaderboard';
import ProfilePage from './ProfilePage';
import LessonPlayer from './LessonPlayer';
import AppHeader from './AppHeader';

const API_BASE = 'https://haylinguav2.onrender.com';

function AppShell() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const navigate = useNavigate();

  // --------------------------------------------------
  // Load auth from localStorage on first render
  // --------------------------------------------------
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('hay_token');
      const storedUser = localStorage.getItem('hay_user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (err) {
      console.error('Error reading saved auth state', err);
      localStorage.removeItem('hay_token');
      localStorage.removeItem('hay_user');
    } finally {
      setLoadingUser(false);
    }
  }, []);

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------

  const handleAuthSuccess = (tokenValue, email) => {
    const newUser = {
      id: 1, // backend user.id is not used yet on FE
      name: email.split('@')[0],
      email,
      level: 1,
      xp: 0,
      streak: 1,
      completedLessons: [],
    };

    setToken(tokenValue);
    setUser(newUser);

    localStorage.setItem('hay_token', tokenValue);
    localStorage.setItem('hay_user', JSON.stringify(newUser));

    navigate('/dashboard', { replace: true });
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('hay_token');
    localStorage.removeItem('hay_user');
    navigate('/', { replace: true });
  };

  // --------------------------------------------------
  // AUTH CALLS
  // --------------------------------------------------

  async function handleLogin(email, password) {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const detail =
        (data && data.detail) ||
        'Login failed. Please check your email and password.';
      console.error('Login failed', res.status, data);
      throw new Error(detail);
    }

    const token = data.access_token;
    if (!token) {
      console.error('No access_token in /login response', data);
      throw new Error('Server did not return an access token');
    }

    handleAuthSuccess(token, data.email || email);
  }

  async function handleSignup(name, email, password) {
    // name is not used on backend yet but kept for future profile
    const res = await fetch(`${API_BASE}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const detail =
        (data && data.detail) ||
        'Signup failed. This email may already be registered.';
      console.error('Signup failed', res.status, data);
      throw new Error(detail);
    }

    // After successful signup, log in immediately
    await handleLogin(email, password);
  }

  // --------------------------------------------------
  // Lesson handlers
  // --------------------------------------------------

  const handleStartLesson = (lesson) => {
    if (!lesson || !lesson.slug) return;
    navigate(`/lesson/${lesson.slug}`);
  };

  const handleUpdateUser = (updates) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      localStorage.setItem('hay_user', JSON.stringify(next));
      return next;
    });
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
    <div className="min-h-screen bg-orange-50">
      {/* Global header on all authenticated pages */}
      {user && (
        <AppHeader
          user={user}
          onLogout={handleLogout}
        />
      )}

      <Routes>
        {/* Landing / Auth */}
        <Route
          path="/"
          element={
            user ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LandingPage
                onLogin={handleLogin}
                onSignup={handleSignup}
              />
            )
          }
        />

        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={
            user ? (
              <Dashboard
                user={user}
                onStartLesson={handleStartLesson}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* Friends */}
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

        {/* Leaderboard */}
        <Route
          path="/leaderboard"
          element={
            user ? (
              <Leaderboard user={user} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* Profile */}
        <Route
          path="/profile"
          element={
            user ? (
              <ProfilePage user={user} onUpdateUser={handleUpdateUser} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* Lesson player */}
        <Route
          path="/lesson/:slug"
          element={
            user ? (
              <LessonPlayer user={user} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
