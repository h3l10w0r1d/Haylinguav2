// src/App.jsx
import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom';

import LandingPage from './LandingPage';
import Dashboard from './Dashboard';

// Shape we store in localStorage (plain JS, no TS types)
/*
{
  name: string,
  email: string,
  token: string | null,
  level: number,
  xp: number,
  streak: number,
  completedLessons: string[]
}
*/

const API_BASE = 'https://haylinguav2.onrender.com';

function AppInner() {
  const [user, setUser] = useState(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const navigate = useNavigate();

  // --- Load user from localStorage once on mount ---
  useEffect(() => {
    try {
      const raw = localStorage.getItem('haylinguaUser');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.email) {
          // ensure completedLessons is always an array
          parsed.completedLessons = Array.isArray(parsed.completedLessons)
            ? parsed.completedLessons
            : [];
          setUser(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to read user from localStorage', e);
      localStorage.removeItem('haylinguaUser');
    } finally {
      setIsHydrating(false);
    }
  }, []);

  // --- Auth handlers used by LandingPage ---

  const handleLogin = async (email, password) => {
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Login failed');
      }

      const data = await res.json(); // expecting { token: "..." }

      const userData = {
        name: email.split('@')[0],
        email,
        token: data.token || null,
        level: 1,
        xp: 0,
        streak: 0,
        completedLessons: [],
      };

      setUser(userData);
      localStorage.setItem('haylinguaUser', JSON.stringify(userData));
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Login failed');
    }
  };

  const handleSignup = async (name, email, password) => {
    try {
      const res = await fetch(`${API_BASE}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Signup failed');
      }

      // backend returns { message: "User created" }, so we fabricate the user
      const userData = {
        name: name || email.split('@')[0],
        email,
        token: null,
        level: 1,
        xp: 0,
        streak: 0,
        completedLessons: [],
      };

      setUser(userData);
      localStorage.setItem('haylinguaUser', JSON.stringify(userData));
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Signup failed');
    }
  };

  // Called when user clicks "Start" on a lesson
  const handleStartLesson = (lesson) => {
    console.log('Starting lesson:', lesson.id, lesson.title);
    // later you can push to /lesson/:id here
  };

  if (isHydrating) {
    // while we’re reading localStorage, render something simple
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-white">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <LandingPage
            onLogin={handleLogin}
            onSignup={handleSignup}
          />
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

      {/* catch-all → home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AppInner />
    </Router>
  );
}
