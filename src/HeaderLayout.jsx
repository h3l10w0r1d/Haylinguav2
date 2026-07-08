// src/HeaderLayout.jsx
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, Users, Trophy, User, LogOut, Heart, Flame, Zap, Gem, Store } from "lucide-react";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  "https://haylinguav2.onrender.com";

function resolveUrl(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("data:")) return s;
  if (s.startsWith("blob:")) return s;
  if (s.startsWith("static/")) return `${API_BASE}/${s}`;
  if (s.startsWith("/static/")) return `${API_BASE}${s}`;
  if (s.startsWith("/")) return s;
  return s;
}

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
  const location = useLocation();

  const [hearts, setHearts] = useState(() => {
    try {
      const raw = localStorage.getItem("hay_hearts");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [xp, setXp] = useState(() => Number(user?.xp ?? 0) || 0);
  const [streak, setStreak] = useState(() => Number(user?.streak ?? 0) || 0);

  // Keep xp/streak in sync when user prop updates (login/refresh)
  useEffect(() => { if (user?.xp != null) setXp(Number(user.xp) || 0); }, [user?.xp]);
  useEffect(() => { if (user?.streak != null) setStreak(Number(user.streak) || 0); }, [user?.streak]);

  const [gems, setGems] = useState(null);
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    const load = () => {
      apiFetch("/me/wallet", { token, method: "GET" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d && !cancelled) setGems(Number(d.gems ?? 0)); })
        .catch(() => {});
    };
    load();
    const onWallet = (ev) => {
      const g = ev?.detail?.gems;
      if (Number.isFinite(g)) setGems(Number(g));
      else load();
    };
    window.addEventListener("hay_wallet", onWallet);
    return () => { cancelled = true; window.removeEventListener("hay_wallet", onWallet); };
  }, []);

  // SSE connection for real-time XP/streak/gems/hearts updates
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let es = null;
    let reconnectTimer = null;

    const connect = () => {
      es = new EventSource(`${API_BASE}/me/events?token=${encodeURIComponent(token)}`);

      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.xp != null) setXp(Number(data.xp));
          if (data.streak != null) setStreak(Number(data.streak));
          if (data.gems != null) setGems(Number(data.gems));
          if (data.hearts_current != null) {
            const next = {
              current: Number(data.hearts_current),
              max: Number(data.hearts_max || 5),
              is_premium: Boolean(data.is_premium),
              next_regen_seconds: 0,
            };
            setHearts(next);
            try { localStorage.setItem("hay_hearts", JSON.stringify(next)); } catch {}
          }
        } catch {}
      };

      es.onerror = () => {
        es.close();
        // Reconnect after 5s on error
        reconnectTimer = setTimeout(connect, 5000);
      };
    };

    connect();

    const onXp = (ev) => {
      if (ev?.detail?.xp != null) setXp(Number(ev.detail.xp));
      if (ev?.detail?.streak != null) setStreak(Number(ev.detail.streak));
    };
    window.addEventListener("hay_xp_changed", onXp);

    const onVisible = () => {
      if (document.visibilityState === "visible" && es?.readyState === EventSource.CLOSED) {
        clearTimeout(reconnectTimer);
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      es?.close();
      clearTimeout(reconnectTimer);
      window.removeEventListener("hay_xp_changed", onXp);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let cancelled = false;

    const fetchHearts = async () => {
      try {
        const res = await apiFetch("/me/hearts", { token, method: "GET" });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data || cancelled) return;
        const next = {
          current: Number(data.current ?? data.hearts_current ?? 0),
          max: Number(data.max ?? data.hearts_max ?? 0),
          is_premium: !!(data.is_premium),
          next_regen_seconds: Number(data.next_regen_seconds ?? 0),
        };
        setHearts(next);
        try {
          localStorage.setItem("hay_hearts", JSON.stringify(next));
        } catch {}
      } catch {
        // ignore
      }
    };

    // Initial load + poll so server-side regen shows up without a reload.
    fetchHearts();
    const poll = setInterval(fetchHearts, 60000);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchHearts();
    };
    document.addEventListener("visibilitychange", onVisible);

    const onHearts = (ev) => {
      const detail = ev?.detail;
      if (!detail) return;
      const next = {
        current: Number(detail.current ?? detail.hearts_current ?? 0),
        max: Number(detail.max ?? detail.hearts_max ?? 0),
        is_premium: !!(detail.is_premium),
        next_regen_seconds: Number(detail.next_regen_seconds ?? 0),
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
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
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

  const avatarSrc = resolveUrl(user?.avatar_url || user?.avatarUrl || user?.avatar || "");

  return (
    <div className="min-h-screen bg-orange-50">
      {/* Top header (desktop & tablet) */}
      <header className="fixed top-0 inset-x-0 z-20 bg-white/90 backdrop-blur shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 px-4 py-3">
          {/* Logo / home */}
          <button
            onClick={() => navigate(user ? "/dashboard" : "/leaderboard")}
            className="flex shrink-0 items-center gap-2"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-lg">
              Հ
            </div>
            <div className="hidden flex-col items-start sm:flex">
              <span className="font-bold text-lg leading-tight text-gray-900">Haylingua</span>
              <span className="whitespace-nowrap text-[11px] leading-tight text-gray-500">
                Armenian made playful
              </span>
            </div>
          </button>

          {/* Center nav – hidden on mobile */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
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
            <NavLink to="/shop" className={navLinkClass}>
              <Store className="w-4 h-4" />
              <span>Shop</span>
            </NavLink>
            <NavLink to="/profile" className={navLinkClass}>
              <User className="w-4 h-4" />
              <span>Profile</span>
            </NavLink>
          </nav>

          {/* Right side: avatar + logout */}
          <div className="flex shrink-0 items-center gap-2 lg:gap-3">
            {/* Quick stats */}
            <div className="hidden md:flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => navigate("/premium")}
                title={hearts?.is_premium ? "Premium — unlimited hearts" : "Get unlimited hearts"}
                className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                <Heart className={"w-4 h-4 " + (hearts?.is_premium ? "fill-rose-500" : "")} />
                <span>{hearts ? (hearts.is_premium ? "∞" : `${hearts.current}/${hearts.max}`) : "–"}</span>
              </button>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700">
                <Flame className={"w-4 h-4 fill-orange-500 text-orange-500" + (streak > 0 ? " flame-flicker" : "")} />
                <span>{streak}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-yellow-50 px-3 py-1.5 text-xs font-semibold text-yellow-700">
                <Zap className="w-4 h-4" />
                <span>{xp}</span>
              </div>
              <button
                type="button"
                onClick={() => navigate("/shop")}
                title="Spend your gems in the shop"
                className="inline-flex items-center gap-1.5 rounded-full bg-feather-50 px-3 py-1.5 text-xs font-semibold text-feather-600 transition hover:bg-feather-100"
              >
                <Gem className="w-4 h-4" />
                <span>{gems == null ? "–" : gems}</span>
              </button>
            </div>
            {user ? (
              <>
                <button
                  onClick={() => navigate("/profile")}
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white flex items-center justify-center text-sm font-semibold shadow-sm overflow-hidden"
                  title="Your profile"
                >
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="Your avatar" className="w-full h-full object-cover" />
                  ) : (
                    initial
                  )}
                </button>

                <button
                  onClick={() => onLogout?.()}
                  className="hidden md:inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-gray-500 hover:text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-full transition-colors"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Log out</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600"
              >
                Login
              </button>
            )}
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

      {/* Main content under header, above mobile nav. Keyed by route so each
          page fades/slides in on navigation. */}
      <main className="pt-16 pb-14 md:pb-0">
        <div key={location.pathname} className="page-in">
          {/* ✅ If used as wrapper, render children. Otherwise fallback to Outlet for nested routing. */}
          {children ?? <Outlet />}
        </div>
      </main>
    </div>
  );
}
