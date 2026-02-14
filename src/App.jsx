// src/App.jsx - Simplified without separate /verify route
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
import CmsGate from './cms/CmsGate';
import CmsLogin from './cms/CmsLogin';
import CmsInvite from './cms/CmsInvite';
import Cms2FASetup from './cms/Cms2FASetup';
import CmsTeam from './cms/CmsTeam';
import HeaderLayout from './HeaderLayout';

const API_BASE = 'https://haylinguav2.onrender.com';

function AppShell() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const navigate = useNavigate();

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
      id: 1,
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

    if (emailVerified) {
      navigate('/dashboard', { replace: true });
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
        xp: Number(me.total_xp ?? user?.xp ?? 0) || 0,
        streak: Number(me.streak ?? user?.streak ?? 0) || 0,
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

      handleAuthSuccess(tokenValue, data.email ?? email, '', data.email_verified || false);
      await refreshProfile(tokenValue);
    } catch (err) {
      console.error('Login error', err);
      alert(err.message || 'Login failed. Please try again.');
    }
  };

  // SIGNUP - handled by Signup component now
  const handleSignup = async (_name, email, password) => {
    // This is just for LandingPage compatibility
    // The standalone Signup component handles its own flow
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

      handleAuthSuccess(tokenValue, email, _name, false);
    } catch (err) {
      console.error('Signup error', err);
      alert('Could not reach the server. Please try again.');
    }
  };

  useEffect(() => {
    if (!loadingUser && token) {
      refreshProfile(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingUser, token]);

  const RequireVerified = ({ children }) => {
    if (!user) return <Navigate to="/" replace />;
    if (user.email_verified === false) {
      // If user is not verified, show them an alert and keep them on current page
      return (
        <div className="min-h-screen flex items-center justify-center bg-orange-50">
          <div className="max-w-md mx-auto p-8 bg-white rounded-lg shadow-lg text-center">
            <h2 className="text-2xl font-bold mb-4">Email Verification Required</h2>
            <p className="text-gray-600 mb-6">
              Please verify your email address to continue. Check your inbox for the verification code.
            </p>
            <button
              onClick={() => window.location.href = '/'}
              className="bg-orange-600 text-white px-6 py-2 rounded-lg"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }
    return children;
  };

  // Shared layout so the dashboard-style header/nav is visible on all authenticated pages
  function ProtectedLayout() {
    return <HeaderLayout user={user} onLogout={handleLogout} />;
  }

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
          user?.email_verified === true ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LandingPage onLogin={handleLogin} onSignup={handleSignup} />
          )
        }
      />

      {/* Authenticated app routes share the same header/nav (HeaderLayout) */}
      <Route
        element={
          user ? (
            <RequireVerified>
              <ProtectedLayout />
            </RequireVerified>
          ) : (
            <Navigate to="/" replace />
          )
        }
      >
        <Route path="/dashboard" element={<Dashboard user={user} onLogout={handleLogout} />} />
        <Route path="/lesson/:slug" element={<LessonPlayer />} />
        <Route path="/friends" element={<Friends user={user} onUpdateUser={handleUpdateUser} />} />
        <Route path="/leaderboard" element={<Leaderboard user={user} />} />
        <Route path="/profile" element={<ProfilePage user={user} onUpdateUser={handleUpdateUser} />} />
      </Route>
      
      {/* CMS (invite-only) */}
      <Route path="/cms/login" element={<CmsLogin />} />
      <Route path="/cms/invite" element={<CmsInvite />} />
      <Route path="/cms/2fa-setup" element={<Cms2FASetup />} />
      <Route path="/cms/team" element={<CmsTeam />} />
      <Route path="/cms" element={<CmsGate />} />
      <Route path="/cms/*" element={<CmsGate />} />

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
