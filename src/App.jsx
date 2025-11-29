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

// Simple JS shapes (no TS needed here)
// user = {
//   name, email, token, level, xp, streak, completedLessons: string[]
// }

function AppInner() {
  const [user, setUser] = useState(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const navigate = useNavigate();

  // --- Hydrate user from localStorage on first load ---
  useEffect(() => {
    try {
      const raw = localStorage.getItem('haylinguaUser');
      if (raw) {
        const parsed = JSON.parse(raw);
        // very loose sanity check
        if (parsed && parsed.email) {
          setUser(parsed);
        }
      }
    } catch (err) {
      console.error('Failed to hydrate user', err);
      localStorage.removeItem('haylinguaUser');
    } finally {
      setIsHydrating(false);
    }
  }, []);

  // --- Auth handlers used by LandingPage ---

  const handleLogin = async (email, password) => {
    try {
      const res = await fetch('https://haylinguav2.onrender.com/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Login failed');
      }

      const data = await res.json();

      const userData = {
        name: email.split('@')[0],
        email,
        token: data.token, // backend returns { token: "..." }
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
      const res = await fetch('https://haylinguav2.onrender.com/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Signup failed');
      }

      // signup endpoint only returns { message }, so we fabricate a user object
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

  // For now we just log when a lesson is started.
  const handleStartLesson = (lesson) => {
    console.log('Start lesson', lesson);
    // later you can navigate to /lesson/:id etc.
  };

  if (isHydrating) {
    // Very simple loading state while we read localStorage
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-white">
        <p className="text-gray-600">Loading...</p>
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

      {/* catch-all */}
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
