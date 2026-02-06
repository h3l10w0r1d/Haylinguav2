// src/HeaderLayout.jsx
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, Users, Trophy, User, LogOut, Heart, Flame, Zap } from "lucide-react";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  "https://haylinguav2.onrender.com";

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("hay_token") ||
    ""
  );
}

async function apiFetch(path, { token, ...opts } = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { ...opts, headers });
}

export default function HeaderLayout({ user, onLogout, children }) {
  const navigate = useNavigate();

  const [hearts, setHearts] = useState(() => {
    try {
      const raw = localStorage.getItem("hay_hearts");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const xp = useMemo(() => Number(user?.xp ?? 0) || 0, [user?.xp]);
  const streak = useMemo(() => Math.max(1, Number(user?.streak ?? 1) || 1), [user?.streak]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await apiFetch("/me/hearts", { token, method: "GET" });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data || cancelled) return;
        const next = {
          current: Number(data.current ?? data.hearts_current ?? 0),
          max: Number(data.max ?? data.hearts_max ?? 0),
        };
        setHearts(next);
        try {
          localStorage.setItem("hay_hearts", JSON.stringify(next));
        } catch {}
      } catch {
        // ignore
      }
    })();

    const onHearts = (ev) => {
      const detail = ev?.detail;
      if (!detail) return;
      const next = {
        current: Number(detail.current ?? detail.hearts_current ?? 0),
        max: Number(detail.max ?? detail.hearts_max ?? 0),
      };
      setHearts(next);
      try {
        localStorage.setItem("hay_hearts", JSON.stringify(next));
      } catch {}
    };
    // Support both event names:
    // - "haylingua:hearts" (older FE)
    // - "hay_hearts" (newer ExerciseRenderer postAttempt)
    window.addEventListener("haylingua:hearts", onHearts);
    window.addEventListener("hay_hearts", onHearts);

    return () => {
      cancelled = true;
      window.removeEventListener("haylingua:hearts", onHearts);
      window.removeEventListener("hay_hearts", onHearts);
    };
  }, []);

  const linkBase =
    "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors";
  const activeClass = "bg-orange-600 text-white shadow-sm";
  const inactiveClass = "text-gray-600 hover:bg-orange-50 hover:text-orange-700";

  const navLinkClass = ({ isActive }) =>
    `${linkBase} ${isActive ? activeClass : inactiveClass}`;

  const initial =
    user?.name?.[0]?.toUpperCase() ??
    user?.email?.[0]?.toUpperCase() ??
    "U";

  return (
    <div className="min-h-screen bg-orange-50">
      {/* Top header (desktop & tablet) */}
      <header className="fixed top-0 inset-x-0 z-20 bg-white/90 backdrop-blur shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          {/* Logo / home */}
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-lg">
              Հ
            </div>
            <div className="flex flex-col items-start">
              <span className="font-bold text-lg text-gray-900">Haylingua</span>
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
            {/* Quick stats */}
            <div className="hidden md:flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">
                <Heart className="w-4 h-4" />
                <span>{hearts ? `${hearts.current}/${hearts.max}` : "–"}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700">
                <Flame className="w-4 h-4" />
                <span>{streak}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-yellow-50 px-3 py-1.5 text-xs font-semibold text-yellow-700">
                <Zap className="w-4 h-4" />
                <span>{xp}</span>
              </div>
            </div>
            <button
              onClick={() => navigate("/profile")}
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
                isActive ? "text-orange-600" : "text-gray-500"
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
                isActive ? "text-orange-600" : "text-gray-500"
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
                isActive ? "text-orange-600" : "text-gray-500"
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
                isActive ? "text-orange-600" : "text-gray-500"
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
        {/* ✅ If used as wrapper, render children. Otherwise fallback to Outlet for nested routing. */}
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
