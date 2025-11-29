// src/App.jsx
import { useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom';

import LandingPage from './LandingPage';
import Dashboard from './Dashboard';

// You can later move this to env: VITE_API_BASE_URL
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://haylinguav2.onrender.com';

function AppInner() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  // -------- AUTH --------

  const handleLogin = async (email, password) => {
    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Login failed');
      }

      const data = await res.json();
      console.log('Login OK:', data);

      // Minimal fake user object for the dashboard
      setUser({
        name: email.split('@')[0],
        email,
        level: 1,
        xp: 0,
        streak: 1,
        completedLessons: [],
      });

      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      alert(err.message || 'Could not log in');
    }
  };

  const handleSignup = async (name, email, password) => {
    try {
      const res = await fetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Signup failed');
      }

      const data = await res.json();
      console.log('Signup OK:', data);

      setUser({
        name: name || email.split('@')[0],
        email,
        level: 1,
        xp: 0,
        streak: 1,
        completedLessons: [],
      });

      navigate('/dashboard');
    } catch (err) {
      console.error('Signup error:', err);
      alert(err.message || 'Could not sign up');
    }
  };

  // -------- START LESSON (THIS IS THE IMPORTANT PART) --------

  const handleStartLesson = async (lesson) => {
    console.log('Start lesson:', lesson.id);

    try {
      const res = await fetch(`${API_BASE_URL}/lessons/${lesson.id}`, {
        method: 'GET',
      });

      if (!res.ok) {
        throw new Error(`API error ${res.status}`);
      }

      const data = await res.json();
      console.log('Lesson data from API:', data);

      // For now we just log + alert.
      // Later you’ll navigate to a real LessonPlayer screen.
      alert(`Loaded lesson "${data.title}" with ${data.exercises.length} exercises`);
    } catch (err) {
      console.error('Failed to load lesson data:', err);
      alert('Could not load this lesson yet. Backend may not be ready.');
    }
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <LandingPage onLogin={handleLogin} onSignup={handleSignup} />
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
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
