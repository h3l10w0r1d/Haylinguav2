// src/HeaderLayout.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, Users, Trophy, User, LogOut, Heart, Flame, Gem, Store, Sun, Moon, Percent, Crown, Volume2, VolumeX, Gift, X } from "lucide-react";
import { CrownBadge } from "./lib/PremiumBadge";
import { getTheme, toggleTheme } from "./lib/theme";
import { isMuted, toggleMuted } from "./lib/muteAudio";
import { identify } from "./lib/analytics";
import AvatarFrame from "./lib/avatarFrame";

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

  // Tag the analytics session with is_premium once we actually know it, so
  // the dashboard can be segmented by user type instead of only aggregate
  // totals. Only re-identifies when the value actually changes (not on
  // every hearts poll tick with the same value).
  const identifiedPremiumRef = useRef(null);
  useEffect(() => {
    if (hearts?.is_premium == null) return;
    if (identifiedPremiumRef.current === hearts.is_premium) return;
    identifiedPremiumRef.current = hearts.is_premium;
    identify({ is_premium: hearts.is_premium });
  }, [hearts?.is_premium]);

  // Light/dark theme — the class is already on <html> (index.html inline
  // script); this just tracks it so the toggle icon reflects current state.
  const [theme, setTheme] = useState(getTheme);
  useEffect(() => {
    const onChange = (e) => e?.detail?.theme && setTheme(e.detail.theme);
    window.addEventListener("hay_theme_changed", onChange);
    return () => window.removeEventListener("hay_theme_changed", onChange);
  }, []);

  // Mute toggle — a safety net so a learner can always kill every sfx/TTS
  // sound themselves, on top of the tab-visibility fixes.
  const [muted, setMutedState] = useState(isMuted);
  useEffect(() => {
    const onChange = (e) => setMutedState(!!e?.detail?.muted);
    window.addEventListener("hay_muted_changed", onChange);
    return () => window.removeEventListener("hay_muted_changed", onChange);
  }, []);

  // Account dropdown — clicking the avatar opens a menu (Profile, mute,
  // theme, log out) instead of every one of those living as its own
  // always-visible header button. Closes on an outside click or Escape.
  // AccountArea renders twice (desktop sidebar + mobile top bar, only one
  // visible at a time via CSS breakpoints) — two separate refs so the
  // outside-click check tracks whichever instance is actually on screen,
  // rather than one shared ref getting clobbered by the other's mount.
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const sidebarAccountMenuRef = useRef(null);
  const mobileAccountMenuRef = useRef(null);
  useEffect(() => {
    if (!accountMenuOpen) return;
    const onPointerDown = (e) => {
      const insideSidebar = sidebarAccountMenuRef.current?.contains(e.target);
      const insideMobile = mobileAccountMenuRef.current?.contains(e.target);
      if (!insideSidebar && !insideMobile) setAccountMenuOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountMenuOpen]);

  // Keep xp/streak in sync when user prop updates (login/refresh)
  useEffect(() => { if (user?.xp != null) setXp(Number(user.xp) || 0); }, [user?.xp]);
  useEffect(() => { if (user?.streak != null) setStreak(Number(user.streak) || 0); }, [user?.streak]);

  const [gems, setGems] = useState(null);
  const [activeFrameStyle, setActiveFrameStyle] = useState(null);
  const [activeFrameRarity, setActiveFrameRarity] = useState(null);
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    const load = () => {
      apiFetch("/me/wallet", { token, method: "GET" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d || cancelled) return;
          setGems(Number(d.gems ?? 0));
          setActiveFrameStyle(d.active_frame_style || null);
          setActiveFrameRarity(d.active_frame_rarity || null);
        })
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

  // CMS-granted bonuses (gems/XP/chests/streak freezes) show as a dismissible
  // banner here — polled once on load rather than per-route, since this
  // layout wraps every authenticated page.
  const [notifications, setNotifications] = useState([]);
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiFetch("/me/notifications", { token, method: "GET" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setNotifications((d?.notifications || []).filter((n) => !n.read_at)))
      .catch(() => {});
  }, []);
  function dismissNotification(id) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const token = getToken();
    if (token) apiFetch(`/me/notifications/${id}/read`, { token, method: "POST" }).catch(() => {});
  }

  // The "Affiliate" nav item should only show for people who've actually
  // applied to the program — GET /affiliate/me 404s for everyone else.
  const [isAffiliate, setIsAffiliate] = useState(false);
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    apiFetch("/affiliate/me", { token, method: "GET" })
      .then((r) => { if (!cancelled) setIsAffiliate(r.ok); })
      .catch(() => {});
    return () => { cancelled = true; };
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

  const initial =
    user?.name?.[0]?.toUpperCase() ??
    user?.email?.[0]?.toUpperCase() ??
    "U";

  const avatarSrc = resolveUrl(user?.avatar_url || user?.avatarUrl || user?.avatar || "");

  // Single source of truth for nav items — the sidebar (desktop, lg+) shows
  // every item; the mobile bottom tab bar shows only `mobile: true` items
  // (space-constrained to ~5 icons, matching Duolingo's mobile convention).
  // Previously desktop and mobile hand-duplicated two different, drifted
  // lists (desktop had Shop but not Bonuses; mobile had Bonuses but not
  // Shop) — this reconciles them to one canonical set.
  const NAV = [
    { key: "learn", label: "Learn", icon: Home, to: "/dashboard", mobile: true },
    { key: "friends", label: "Friends", icon: Users, to: "/friends", mobile: true },
    { key: "leaderboard", label: "Leaderboard", icon: Trophy, to: "/leaderboard", mobile: true },
    { key: "shop", label: "Shop", icon: Store, to: "/shop", mobile: true },
    { key: "bonuses", label: "Bonuses", icon: Gift, to: "/bonuses", mobile: false },
    { key: "profile", label: "Profile", icon: User, to: "/profile", mobile: true },
    ...(isAffiliate ? [{ key: "affiliate", label: "Affiliate", icon: Percent, to: "/affiliate-dashboard", mobile: false }] : []),
  ];
  const mobileNav = NAV.filter((n) => n.mobile);

  function SidebarNavLink({ item }) {
    const Icon = item.icon;
    return (
      <NavLink
        to={item.to}
        className={({ isActive }) =>
          "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition " +
          (isActive
            ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
            : "text-gray-600 hover:bg-orange-50 hover:text-orange-700 dark:text-stone-300 dark:hover:bg-white/[0.06] dark:hover:text-white")
        }
      >
        {({ isActive }) => (
          <>
            <Icon className={"h-5 w-5 " + (isActive ? "text-brand-500 dark:text-brand-400" : "text-gray-400 dark:text-stone-500")} />
            {item.label}
          </>
        )}
      </NavLink>
    );
  }

  // Shared quick-stats (premium/hearts, streak, gems) + account dropdown —
  // rendered once in the desktop sidebar footer and once in the mobile top
  // bar, so the two surfaces can't drift the way the old dual nav lists did.
  function AccountArea({ compact = false }) {
    return (
      <div className={compact ? "flex items-center gap-2" : "space-y-2"}>
        <div className={compact ? "flex items-center gap-1.5" : "flex flex-wrap items-center gap-1.5"}>
          <button
            type="button"
            onClick={() => navigate("/premium")}
            title={hearts?.is_premium ? "Premium — unlimited hearts" : "Get unlimited hearts"}
            className={
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition " +
              (hearts?.is_premium
                ? "bg-gold-100 text-gold-700 hover:bg-gold-100/80 dark:bg-gold-500/15 dark:text-gold-300 dark:hover:bg-gold-500/25"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25")
            }
          >
            {hearts?.is_premium ? <Crown className="w-4 h-4 fill-gold-500" /> : <Heart className="w-4 h-4" />}
            <span>{hearts ? (hearts.is_premium ? "∞" : `${hearts.current}/${hearts.max}`) : "–"}</span>
          </button>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
            <Flame className={"w-4 h-4 fill-orange-500 text-orange-500" + (streak > 0 ? " flame-flicker" : "")} />
            <span>{streak}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate("/shop")}
            title="Spend your gems in the shop"
            className="inline-flex items-center gap-1.5 rounded-full bg-feather-50 px-3 py-1.5 text-xs font-semibold text-feather-600 transition hover:bg-feather-100 dark:bg-feather-500/15 dark:text-feather-300 dark:hover:bg-feather-500/25"
          >
            <Gem className="w-4 h-4" />
            <span>{gems == null ? "–" : gems}</span>
          </button>
        </div>

        {user ? (
          <div className="relative">
            <div className={compact ? "" : "flex items-center gap-2.5"}>
              <div className="relative shrink-0" ref={compact ? mobileAccountMenuRef : sidebarAccountMenuRef}>
                <AvatarFrame frameStyle={activeFrameStyle} rarity={activeFrameRarity} size={36} radius="9999px" thickness={2.5} idle>
                  <button
                    onClick={() => setAccountMenuOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={accountMenuOpen}
                    className={
                      "w-full h-full rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white flex items-center justify-center text-sm font-semibold shadow-sm " +
                      (!activeFrameStyle && hearts?.is_premium ? "ring-2 ring-gold-400" : "")
                    }
                    title="Account menu"
                  >
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="Your avatar" className="w-full h-full object-cover" />
                    ) : (
                      initial
                    )}
                  </button>
                </AvatarFrame>
                {/* Rendered outside AvatarFrame's clipped inner wrapper — the badge
                    deliberately sits half outside the avatar circle (-bottom-1
                    -right-1), which an overflow:hidden ancestor would clip. */}
                {hearts?.is_premium && <CrownBadge size="h-4 w-4" iconSize="h-2.5 w-2.5" />}

                {accountMenuOpen && (
                  <div
                    role="menu"
                    className={
                      "absolute z-30 mt-2 w-52 overflow-hidden rounded-2xl bg-white py-1.5 shadow-lg ring-1 ring-black/5 dark:bg-[#1f1f23] dark:ring-white/10 " +
                      (compact ? "right-0 top-full" : "bottom-full left-0 mb-2")
                    }
                  >
                    <button
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        navigate("/profile");
                      }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:text-stone-200 dark:hover:bg-white/[0.06]"
                    >
                      <User className="h-4 w-4 text-gray-400 dark:text-stone-400" />
                      Profile
                    </button>

                    <button
                      role="menuitem"
                      onClick={() => toggleMuted()}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:text-stone-200 dark:hover:bg-white/[0.06]"
                    >
                      {muted ? (
                        <VolumeX className="h-4 w-4 text-gray-400 dark:text-stone-400" />
                      ) : (
                        <Volume2 className="h-4 w-4 text-gray-400 dark:text-stone-400" />
                      )}
                      {muted ? "Unmute sound" : "Mute sound"}
                    </button>

                    <button
                      role="menuitem"
                      onClick={() => toggleTheme()}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:text-stone-200 dark:hover:bg-white/[0.06]"
                    >
                      {theme === "dark" ? (
                        <Sun className="h-4 w-4 text-gray-400 dark:text-stone-400" />
                      ) : (
                        <Moon className="h-4 w-4 text-gray-400 dark:text-stone-400" />
                      )}
                      {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                    </button>

                    <div className="my-1 h-px bg-gray-100 dark:bg-white/[0.06]" />

                    <button
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onLogout?.();
                      }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/15 dark:text-red-300"
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                )}
              </div>
              {!compact && (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-gray-800 dark:text-white">{user?.name || user?.email || "Account"}</div>
                  <div className="truncate text-xs font-semibold text-gray-400 dark:text-stone-500">View account</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => navigate("/login")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600"
          >
            Login
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-orange-50 dark:bg-[#0d0d0f]">
      <div className="flex">
        {/* ---------- Sidebar (desktop, lg+) ---------- */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-orange-100 bg-white px-3 py-4 lg:flex dark:bg-[#151517] dark:border-white/[0.06]">
          <button
            onClick={() => navigate(user ? "/dashboard" : "/leaderboard")}
            className="flex shrink-0 items-center gap-2 px-2 py-1"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
              Հ
            </div>
            <div className="flex flex-col items-start">
              <span className="font-bold text-base leading-tight text-gray-900 dark:text-white">Haylingua</span>
              <span className="whitespace-nowrap text-[11px] leading-tight text-gray-500 dark:text-stone-400">
                Armenian made playful
              </span>
            </div>
          </button>

          <nav className="mt-6 space-y-1">
            {NAV.map((item) => (
              <SidebarNavLink key={item.key} item={item} />
            ))}
          </nav>

          <div className="flex-1" />

          <div className="border-t border-orange-100 pt-3 dark:border-white/[0.06]">
            <AccountArea />
          </div>
        </aside>

        {/* ---------- Main column ---------- */}
        <div className="min-w-0 flex-1">
          {/* Slim top bar (mobile & tablet only — sidebar covers this on desktop) */}
          <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-orange-100 bg-white/90 px-4 py-3 backdrop-blur lg:hidden dark:bg-[#151517]/90 dark:border-white/[0.06]">
            <button
              onClick={() => navigate(user ? "/dashboard" : "/leaderboard")}
              className="flex shrink-0 items-center gap-2"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-lg">
                Հ
              </div>
              <span className="hidden font-bold text-lg leading-tight text-gray-900 sm:inline dark:text-white">Haylingua</span>
            </button>
            <AccountArea compact />
          </div>

          {/* Bottom nav (mobile & tablet only) */}
          <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-orange-100 lg:hidden dark:bg-[#151517] dark:border-white/[0.06]">
            <div className="max-w-md mx-auto flex justify-around py-1.5">
              {mobileNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.key}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex flex-col items-center justify-center gap-0.5 flex-1 py-1 ${
                        isActive ? "text-orange-600 dark:text-brand-400" : "text-gray-500 dark:text-stone-400"
                      }`
                    }
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[11px] font-medium">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </nav>

          {/* Main content. Keyed by route so each page fades/slides in on
              navigation. No pt- offset needed: the sidebar/top bar above are
              sticky (in-flow), not fixed — only the mobile bottom nav is
              fixed, so pb-14 compensates for that alone. */}
          <main className="pb-14 lg:pb-0">
            {notifications.length > 0 && (
              <div className="mx-auto max-w-2xl space-y-2 px-4 pt-4">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/25"
                  >
                    <Gift className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-sm font-extrabold text-slate-800 dark:text-white">{n.title}</div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-600 dark:text-stone-300">{n.body}</div>
                    </div>
                    <button
                      onClick={() => dismissNotification(n.id)}
                      className="shrink-0 text-slate-400 hover:text-slate-600 dark:text-stone-500 dark:hover:text-stone-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div key={location.pathname} className="page-in">
              {/* ✅ If used as wrapper, render children. Otherwise fallback to Outlet for nested routing. */}
              {children ?? <Outlet />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
