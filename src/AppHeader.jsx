// src/AppHeader.jsx
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  BookOpen,
  Users,
  Trophy,
  UserCircle,
  Flame,
  Star,
} from 'lucide-react';

export default function AppHeader({ user }) {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { key: 'home', label: 'Home', path: '/', icon: Home },
    { key: 'dashboard', label: 'Exercises', path: '/dashboard', icon: BookOpen },
    { key: 'friends', label: 'Friends', path: '/friends', icon: Users },
    { key: 'leaderboard', label: 'Leaderboard', path: '/leaderboard', icon: Trophy },
  ];

  const currentPath = location.pathname;

  const isActive = (path) => {
    if (path === '/') return currentPath === '/';
    return currentPath.startsWith(path);
  };

  const initials =
    user?.name
      ?.split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase() || 'U';

  return (
    <>
      {/* TOP HEADER (desktop + mobile) */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo / brand */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 group"
          >
            <div className="bg-orange-600 text-white p-2 rounded-xl group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="font-semibold text-gray-900">Haylingua</span>
          </button>

          {/* DESKTOP NAV */}
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map(({ key, label, path, icon: Icon }) => (
              <button
                key={key}
                onClick={() => navigate(path)}
                className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                  isActive(path)
                    ? 'text-orange-600'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* User badge (XP + streak + avatar) */}
          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden sm:flex items-center gap-3 text-xs text-gray-700">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span>{user.xp ?? 0} XP</span>
                </div>
                <div className="flex items-center gap-1">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span>{user.streak ?? 0} day</span>
                </div>
              </div>
            )}

            {/* Profile button */}
            <button
              onClick={() => navigate('/profile')}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
              title="Profile"
            >
              <span className="text-xs font-semibold">{initials}</span>
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE BOTTOM NAV (like app tab bar) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg md:hidden">
        <div className="max-w-5xl mx-auto flex justify-around py-1.5">
          {navItems.map(({ key, label, path, icon: Icon }) => {
            const active = isActive(path);
            return (
              <button
                key={key}
                onClick={() => navigate(path)}
                className="flex flex-col items-center gap-0.5 text-[11px]"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    active ? 'bg-orange-100 text-orange-600' : 'text-gray-500'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span
                  className={`${
                    active ? 'text-orange-600' : 'text-gray-500'
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}

          {/* Profile tab */}
          <button
            onClick={() => navigate('/profile')}
            className="flex flex-col items-center gap-0.5 text-[11px]"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white flex items-center justify-center">
              <UserCircle className="w-4 h-4" />
            </div>
            <span className="text-gray-700">Profile</span>
          </button>
        </div>
      </nav>
    </>
  );
}
