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
    const newUser = {
      id: 1, // placeholder; we don't get ID yet from backend
      name: email.split('@')[0],
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

  // ---- LOGIN ----
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
        alert('Login failed. Please check your email and password.');
        return;
      }

      const data = await res.json();
      // backend: { access_token, token_type, email }
      const tokenFromApi = data.access_token ?? data.token;

      if (!tokenFromApi) {
        console.error('No token in /login response', data);
        alert('Login failed: invalid server response.');
        return;
      }

      const effectiveEmail = data.email ?? email;
      handleAuthSuccess(tokenFromApi, effectiveEmail);
    } catch (err) {
      console.error('Login error', err);
      alert('Could not reach the server. Please try again.');
    }
  }

  // ---- SIGNUP ----
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

      // backend main.py: { "message": "User created", "access_token": "<token>" }
      const data = await res.json().catch(() => ({}));
      const tokenFromSignup = data.access_token ?? data.token;

      if (tokenFromSignup) {
        // backend already gave us a token
        handleAuthSuccess(tokenFromSignup, email);
      } else {
        // fallback: log in
        await handleLogin(email, password);
      }
    } catch (err) {
      console.error('Signup error', err);
      alert('Could not reach the server. Please try again.');
    }
  };

  // ---- START LESSON (this is the bit that makes the button "do something") ----
  const handleStartLesson = async (lesson) => {
    console.log('Start lesson clicked:', lesson.id);

    try {
      const res = await fetch(`${API_BASE}/lessons/${lesson.id}`, {
        headers: {
          'Content-Type': 'application/json',
          // auth is optional for now; include it if you want later
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Failed to load lesson', res.status, text);
        alert('Could not load this lesson from the server.');
        return;
      }

      const data = await res.json();
      console.log('Loaded lesson data from backend:', data);

      // Temporary UX: just show a simple alert so you SEE it working.
      // Later we’ll route to a dedicated LessonPlayer component.
      alert(`Loaded lesson: ${data.title} (${data.exercises.length} exercises)`);
    } catch (err) {
      console.error('Error calling /lessons endpoint', err);
      alert('Network error while loading the lesson.');
    }
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

      {/* Fallback for any weird URL */}
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
