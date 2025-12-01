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

const API_BASE = 'https://haylinguav2.onrender.com';

function AppShell() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    try {
      const storedToken =
        localStorage.getItem('hay_token') ||
        localStorage.getItem('haylingua_token');
      const storedUser = localStorage.getItem('hay_user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (err) {
      console.error('Error reading saved auth state', err);
      localStorage.removeItem('hay_token');
      localStorage.removeItem('hay_user');
      localStorage.removeItem('haylingua_token');
    } finally {
      setLoadingUser(false);
    }
  }, []);

  const handleAuthSuccess = (tokenValue, email) => {
    const baseName = email.split('@')[0];

    const newUser = {
      id: 1,
      name: baseName,
      level: 1,
      xp: 0,
      streak: 1,
      completedLessons: [],
      email,
    };

    setToken(tokenValue);
    setUser(newUser);

    localStorage.setItem('hay_token', tokenValue);
    localStorage.setItem('hay_user', JSON.stringify(newUser));

    navigate('/dashboard', { replace: true });
  };

  async function handleLogin(email, password) {
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

    handleAuthSuccess(tokenValue, data.email ?? email);
  }

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

      await handleLogin(email, password);
    } catch (err) {
      console.error('Signup error', err);
      alert('Could not reach the server. Please try again.');
    }
  };

  const handleStartLesson = (lesson) => {
    console.log('Start lesson:', lesson.id);
    // later: navigate to lesson player
  };

  const handleLessonResult = (slug, result) => {
    if (!user) return;

    const updatedUser = {
      ...user,
      xp: result.user_total_xp ?? user.xp,
      level: result.user_level ?? user.level,
      completedLessons: user.completedLessons.includes(slug)
        ? user.completedLessons
        : [...user.completedLessons, slug],
    };

    setUser(updatedUser);
    localStorage.setItem('hay_user', JSON.stringify(updatedUser));
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
            <Dashboard
              user={user}
              onStartLesson={handleStartLesson}
              onLessonResult={handleLessonResult}
            />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
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
