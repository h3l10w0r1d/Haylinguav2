// src/HeaderLayout.jsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, Users, Trophy, User, LogOut } from 'lucide-react';

export default function HeaderLayout({ user, onLogout }) {
  const navigate = useNavigate();

  const linkBase =
    'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors';
  const activeClass = 'bg-orange-600 text-white shadow-sm';
  const inactiveClass =
    'text-gray-600 hover:bg-orange-50 hover:text-orange-700';

  const navLinkClass = ({ isActive }) =>
    `${linkBase} ${isActive ? activeClass : inactiveClass}`;

  const initial = user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <div className="min-h-screen bg-orange-50">
      {/* Top header (desktop & tablet) */}
      <header className="fixed top-0 inset-x-0 z-20 bg-white/90 backdrop-blur shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          {/* Logo / home */}
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-lg">
              Հ
            </div>
            <div className="flex flex-col items-start">
              <span className="font-bold text-lg text-gray-900">
                Haylingua
              </span>
              <span className="text-[11px] text-gray-500 leading-tight">
                Armenian made playful
              </span>
            </div>
          </button>

          {/* Center nav – hidden on mobile */}
          <nav className="hidden md:flex items-center gap-2">
            <NavLink to="/dashboard" className={navLinkClass}>
              <Home className="w-4 h-4" />
              <span>Learn</span>
            </NavLink>
            <NavLink to="/friends" className={navLinkClass}>
              <Users className="w-4 h-4" />
              <span>Friends</span>
            </NavLink>
            <NavLink to="/leaderboard" className={navLinkClass}>
              <Trophy className="w-4 h-4" />
              <span>Leaderboard</span>
            </NavLink>
            <NavLink to="/profile" className={navLinkClass}>
              <User className="w-4 h-4" />
              <span>Profile</span>
            </NavLink>
          </nav>

          {/* Right side: avatar + logout */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/profile')}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white flex items-center justify-center text-sm font-semibold shadow-sm"
              title="Your profile"
            >
              {initial}
            </button>
            <button
              onClick={onLogout}
              className="hidden md:inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-full transition-colors"
            >
              <LogOut className="w-3 h-3" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Bottom nav (mobile only) */}
      <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-orange-100 md:hidden">
        <div className="max-w-md mx-auto flex justify-around py-1.5">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 flex-1 py-1 ${
                isActive ? 'text-orange-600' : 'text-gray-500'
              }`
            }
          >
            <Home className="w-5 h-5" />
            <span className="text-[11px] font-medium">Learn</span>
          </NavLink>

          <NavLink
            to="/friends"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 flex-1 py-1 ${
                isActive ? 'text-orange-600' : 'text-gray-500'
              }`
            }
          >
            <Users className="w-5 h-5" />
            <span className="text-[11px] font-medium">Friends</span>
          </NavLink>

          <NavLink
            to="/leaderboard"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 flex-1 py-1 ${
                isActive ? 'text-orange-600' : 'text-gray-500'
              }`
            }
          >
            <Trophy className="w-5 h-5" />
            <span className="text-[11px] font-medium">Rank</span>
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 flex-1 py-1 ${
                isActive ? 'text-orange-600' : 'text-gray-500'
              }`
            }
          >
            <User className="w-5 h-5" />
            <span className="text-[11px] font-medium">You</span>
          </NavLink>
        </div>
      </nav>

      {/* Main content under header, above mobile nav */}
      <main className="pt-16 pb-14 md:pb-0">
        <Outlet />
      </main>
    </div>
  );
}
