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
import Friends from './Friends';
import Leaderboard from './Leaderboard';
import ProfilePage from './ProfilePage';
import CmsShell from './cms/CmsShell';

const API_BASE = 'https://haylinguav2.onrender.com';

function AppShell() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const navigate = useNavigate();

  // --- CMS routing helpers ---
  // CMS URLs:
  //   /:cmsKey/cms   (primary)
  //   /cms/:cmsKey   (alias -> redirects to /:cmsKey/cms)
  const ALLOWED_KEYS = new Set([
    'c5fe8f3d5aa14af2b7ddfbd22cc72d94',
    'd7c88020e1ea95dd060d90414b4da77e',
    '07112370d92c4301262c47d0d9f4096d',
    'f63b4c0e48b3abfc4e898de035655bab',
    'e1d7a392d68e2e8290ac3cd06a0884aa',
    '42ddc20c92e70d4398b55e30fe1c765e',
    'b0440e852e0e5455b1917bfcaedf31cf',
    'd207f151bdfdb299700ee3b201b71f1e',
    '387d06eb745fbf1c88d5533dc4aad2f5',
    'aa835a34b64a318f39ce9e34ee374c3b',
  ]);

  function CmsGate() {
    const { cmsKey } = useParams();
    const ok = cmsKey && ALLOWED_KEYS.has(String(cmsKey).trim());
    if (!ok) return <Navigate to="/" replace />;
    // CmsShell reads cmsKey from the URL via useParams()
    return <CmsShell />;
  }

  function CmsRedirect() {
    const { cmsKey } = useParams();
    if (!cmsKey) return <Navigate to="/" replace />;
    return <Navigate to={`/${String(cmsKey).trim()}/cms`} replace />;
  }

  // Load auth state from localStorage
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

  const handleAuthSuccess = (tokenValue, email) => {
    const baseName = email.split('@')[0];

    const newUser = {
      id: 1, // placeholder until backend profile endpoint exists
      email,
      name: baseName,
      firstName: '',
      lastName: '',
      avatarUrl: '',
      level: 1,
      xp: 0,
      streak: 0,
      completedLessons: [],
    };

    setToken(tokenValue);
    setUser(newUser);

    localStorage.setItem('hay_token', tokenValue);
    // compatibility with older components
    localStorage.setItem('access_token', tokenValue);
    localStorage.setItem('hay_user', JSON.stringify(newUser));

    navigate('/dashboard', { replace: true });
  };

  // LOGIN
  const handleLogin = async (email, password) => {
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Login failed', res.status, text);
        throw new Error('Invalid email or password');
      }

      const data = await res.json();
      const tokenValue = data.access_token;

      if (!tokenValue) {
        console.error('No token in /login response', data);
        throw new Error('No token in /login response');
      }

      handleAuthSuccess(tokenValue, data.email ?? email);
    } catch (err) {
      console.error('Login error', err);
      alert(err.message || 'Login failed. Please try again.');
    }
  };

  // SIGNUP
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

      // auto-login after signup
      await handleLogin(email, password);
    } catch (err) {
      console.error('Signup error', err);
      alert('Could not reach the server. Please try again.');
    }
  };

  const handleUpdateUser = (updates) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem('hay_user', JSON.stringify(updated));
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('hay_token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('hay_user');
    navigate('/', { replace: true });
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
            <Dashboard
              user={user}
              onUpdateUser={handleUpdateUser}
              onLogout={handleLogout}
            />
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
        element={user ? <Leaderboard user={user} /> : <Navigate to="/" replace />}
      />

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
      
      {/* CMS (no user auth required; gated by cmsKey) */}
      <Route path="/:cmsKey/cms" element={<CmsGate />} />
      <Route path="/cms/:cmsKey" element={<CmsRedirect />} />
      <Route path="/cms/:cmsKey/*" element={<CmsRedirect />} />

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
