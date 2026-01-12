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
import LessonPlayer from './LessonPlayer';
import Friends from './Friends';
import Leaderboard from './Leaderboard';
import ProfilePage from './ProfilePage';
import HeaderLayout from './HeaderLayout';

const API_BASE = 'https://haylinguav2.onrender.com';

function AppShell() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const navigate = useNavigate();

  // Load user + token from localStorage on first render
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

  // Central helper to set user + token + localStorage
  const applyAuthState = (tokenValue, email) => {
    const baseName = email?.split('@')[0] || 'Learner';

    const newUser = {
      id: 1, // backend doesn’t return id yet, so we fake it
      name: baseName,
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
  };

  const handleLogin = async (email, password) => {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('Login failed', res.status, text);
      throw new Error(`Login failed: ${res.status}`);
    }

    const data = await res.json();
    const tokenValue = data.access_token ?? data.token;

    if (!tokenValue) {
      console.error('No token in /login response', data);
      throw new Error('No token in /login response');
    }

    applyAuthState(tokenValue, data.email ?? email);
    navigate('/dashboard', { replace: true });
  };

  const handleSignup = async (_name, email, password) => {
    try {
      const res = await fetch(`${API_BASE}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Signup failed', res.status, text);
        alert('Signup failed. Maybe this email is already registered.');
        return;
      }

      // After successful signup, log in immediately
      await handleLogin(email, password);
    } catch (err) {
      console.error('Signup error', err);
      alert('Could not reach the server. Please try again.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('hay_token');
    localStorage.removeItem('hay_user');
    navigate('/', { replace: true });
  };

  // Allow profile page (and later dashboard) to update user
  const handleUserUpdate = (patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...patch };
      try {
        localStorage.setItem('hay_user', JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to write hay_user to localStorage', err);
      }
      return updated;
    });
  };

  const handleStartLesson = (lesson) => {
    // Expect lesson.slug from /lessons API
    if (lesson?.slug) {
      navigate(`/lesson/${lesson.slug}`);
    } else if (lesson?.id) {
      navigate(`/lesson/${lesson.id}`);
    } else {
      console.warn('handleStartLesson called without slug or id', lesson);
    }
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <p className="text-gray-600">
          Loading your Haylingua journey…
        </p>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public landing */}
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

      {/* All logged-in pages share the header layout */}
      <Route
        element={
          user ? (
            <HeaderLayout user={user} onLogout={handleLogout} />
          ) : (
            <Navigate to="/" replace />
          )
        }
      >
        <Route
          path="/dashboard"
          element={
            <Dashboard
              user={user}
              token={token}
              onStartLesson={handleStartLesson}
            />
          }
        />
        <Route
          path="/friends"
          element={<Friends user={user} onUpdateUser={handleUserUpdate} />}
        />
        <Route
          path="/leaderboard"
          element={<Leaderboard user={user} />}
        />
        <Route
          path="/profile"
          element={
            <ProfilePage
              user={user}
              onUpdateUser={handleUserUpdate}
            />
          }
        />
        <Route
          path="/lesson/:slug"
          element={<LessonPlayer token={token} />}
        />
      </Route>

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
