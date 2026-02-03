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
import VerifyEmail from './VerifyEmail';

const API_BASE = 'https://haylinguav2.onrender.com';

function AppShell() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const navigate = useNavigate();

  // --- CMS routing helpers ---
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

  const handleAuthSuccess = (tokenValue, email, nameOverride, emailVerified = false) => {
    const baseName = email.split('@')[0];

    const newUser = {
      id: 1, // placeholder; replaced by /me/profile if available
      email,
      name: (nameOverride || '').trim() || baseName,
      firstName: '',
      lastName: '',
      avatarUrl: '',
      level: 1,
      xp: 0,
      streak: 0,
      completedLessons: [],
      email_verified: emailVerified,
    };

    setToken(tokenValue);
    setUser(newUser);

    localStorage.setItem('hay_token', tokenValue);
    localStorage.setItem('access_token', tokenValue);
    localStorage.setItem('hay_user', JSON.stringify(newUser));

    // Navigate based on email verification status
    if (emailVerified) {
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/verify', { replace: true });
    }
  };

  const refreshProfile = async (tokenValue) => {
    const t = tokenValue || token;
    if (!t) return;
    try {
      const meRes = await fetch(`${API_BASE}/me/profile`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!meRes.ok) return;
      const me = await meRes.json().catch(() => null);
      if (!me) return;

      const updated = {
        ...(user || {}),
        id: me.id,
        email: me.email,
        name: me.name || me.email?.split('@')?.[0] || 'User',
        avatarUrl: me.avatar_url || '',
        email_verified: Boolean(me.email_verified),
      };
      setUser(updated);
      localStorage.setItem('hay_user', JSON.stringify(updated));
    } catch (e) {
      // ignore
    }
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

      // Check email_verified status from login response or fetch profile
      handleAuthSuccess(tokenValue, data.email ?? email, '', data.email_verified || false);
      await refreshProfile(tokenValue);
    } catch (err) {
      console.error('Login error', err);
      alert(err.message || 'Login failed. Please try again.');
    }
  };

  // SIGNUP - Updated to handle verification flow properly
  const handleSignup = async (_name, email, password) => {
    try {
      const res = await fetch(`${API_BASE}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: (_name || '').trim() || null, email, password }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Signup failed', res.status, text);
        alert('Signup failed. Maybe this email is already registered.');
        return;
      }

      const data = await res.json();
      const tokenValue = data.access_token;

      if (!tokenValue) {
        console.error('No token in /signup response', data);
        alert('Signup succeeded but server returned no token.');
        return;
      }

      // Store verification code if in dev mode
      if (data.verification_code) {
        sessionStorage.setItem("dev_verification_code", data.verification_code);
        sessionStorage.setItem("email_sent", "false");
      } else {
        sessionStorage.setItem("email_sent", "true");
      }

      // Set user with email_verified = false and navigate to /verify
      handleAuthSuccess(tokenValue, email, _name, false);
    } catch (err) {
      console.error('Signup error', err);
      alert('Could not reach the server. Please try again.');
    }
  };

  // On first load (or token restore), refresh profile so email_verified and name are correct
  useEffect(() => {
    if (!loadingUser && token) {
      refreshProfile(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingUser, token]);

  const RequireVerified = ({ children }) => {
    if (!user) return <Navigate to="/" replace />;
    if (user.email_verified === false) return <Navigate to="/verify" replace />;
    return children;
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
    sessionStorage.removeItem('dev_verification_code');
    sessionStorage.removeItem('email_sent');
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
            user.email_verified === false ? (
              <Navigate to="/verify" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          ) : (
            <LandingPage onLogin={handleLogin} onSignup={handleSignup} />
          )
        }
      />

      <Route
        path="/dashboard"
        element={
          user ? (
            <RequireVerified>
              <Dashboard
                user={user}
                onUpdateUser={handleUpdateUser}
                onLogout={handleLogout}
              />
            </RequireVerified>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      <Route
        path="/lesson/:slug"
        element={user ? <RequireVerified><LessonPlayer /></RequireVerified> : <Navigate to="/" replace />}
      />

      <Route
        path="/friends"
        element={
          user ? (
            <RequireVerified>
              <Friends user={user} onUpdateUser={handleUpdateUser} />
            </RequireVerified>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      <Route
        path="/leaderboard"
        element={user ? <RequireVerified><Leaderboard user={user} /></RequireVerified> : <Navigate to="/" replace />}
      />

      <Route
        path="/profile"
        element={
          user ? (
            <RequireVerified>
              <ProfilePage user={user} onUpdateUser={handleUpdateUser} />
            </RequireVerified>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      <Route
        path="/verify"
        element={
          user ? (
            <VerifyEmail onVerified={() => refreshProfile(token)} />
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
