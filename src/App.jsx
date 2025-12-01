// src/App.jsx
import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
} from 'react-router-dom';

import LandingPage from './LandingPage';
import Dashboard from './Dashboard';
import LessonPlayer from './LessonPlayer';

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

  // Helper: save everything when auth succeeds
  const handleAuthSuccess = (tokenValue, email) => {
    const baseName = email?.split('@')[0] || 'Learner';

    const newUser = {
      id: 1, // not using real ids yet
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

  // ---- AUTH: LOGIN / SIGNUP ----

  async function handleLogin(email, password) {
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Login failed', res.status, text);
        alert('Login failed. Check your email or password.');
        return;
      }

      const data = await res.json();
      // backend returns: { access_token, token_type, email }
      const tokenValue = data.access_token || data.token;
      if (!tokenValue) {
        console.error('No token in /login response', data);
        alert('Unexpected server response (no token).');
        return;
      }

      handleAuthSuccess(tokenValue, data.email || email);
    } catch (err) {
      console.error('Login error', err);
      alert('Could not reach the server. Please try again.');
    }
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

      // after successful signup, immediately log them in
      await handleLogin(email, password);
    } catch (err) {
      console.error('Signup error', err);
      alert('Could not reach the server. Please try again.');
    }
  };

  // ---- LESSON FLOW ----

  // Called by Dashboard when user clicks a lesson card
  const handleStartLesson = (lesson) => {
    const slug = lesson.slug || `lesson-${lesson.id}`;
    navigate(`/lesson/${slug}`);
  };

  // Called by LessonPlayer when the lesson is fully completed
  const handleLessonComplete = (slug, gainedXp) => {
    setUser((prev) => {
      if (!prev) return prev;

      const prevCompleted = Array.isArray(prev.completedLessons)
        ? prev.completedLessons
        : [];

      const alreadyCompleted = prevCompleted.includes(slug);
      const updatedCompleted = alreadyCompleted
        ? prevCompleted
        : [...prevCompleted, slug];

      const xpGain = gainedXp || 0;
      const newXp = (prev.xp || 0) + xpGain;

      // simple level formula: every 200 XP => new level
      const newLevel = Math.floor(newXp / 200) + 1;

      const updatedUser = {
        ...prev,
        completedLessons: updatedCompleted,
        xp: newXp,
        level: newLevel,
      };

      localStorage.setItem('hay_user', JSON.stringify(updatedUser));
      return updatedUser;
    });

    // Back to roadmap
    navigate('/dashboard');
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

      {/* Roadmap */}
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

      {/* Lesson player: exercises */}
      <Route
        path="/lesson/:slug"
        element={
          user ? (
            <LessonPlayer
              token={token}
              onLessonComplete={handleLessonComplete}
            />
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

// Outer wrapper with BrowserRouter
export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
