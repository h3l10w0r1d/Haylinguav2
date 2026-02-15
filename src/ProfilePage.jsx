// src/ProfilePage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Trophy, Flame, Star } from "lucide-react";

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

/**
 * ✅ FIX #1: Avoid sending "Content-Type: application/json" on GET/HEAD.
 * That header triggers CORS preflight on cross-origin requests and doubles traffic.
 * We only set Content-Type when sending a JSON body (POST/PUT/PATCH).
 */
async function apiFetch(path, { token, ...opts } = {}) {
  const method = String(opts.method || "GET").toUpperCase();
  const hasBody = opts.body != null;

  const headers = {
    ...(opts.headers || {}),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  if (hasBody && method !== "GET" && method !== "HEAD") {
    if (!headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }
  }

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  return res;
}

function safeJsonParse(res) {
  return res.json().catch(() => null);
}

export default function ProfilePage({ user, onUpdateUser }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [saving, setSaving] = useState(false);

  // Guard against repeated network calls if parent state updates recreate the
  // `user` object or if multiple effects race each other.
  const loadOnceRef = useRef({
    profileEmail: null,
    statsEmail: null,
    activityEmail: null,
  });

  // Backend-driven stats (keep UI the same)
  const [stats, setStats] = useState({
    total_xp: null,
    lessons_completed: null,
  });

  // Backend-driven last-7-days activity
  const [weeklyProgress, setWeeklyProgress] = useState([
    { day: "M", value: 0 },
    { day: "T", value: 0 },
    { day: "W", value: 0 },
    { day: "T", value: 0 },
    { day: "F", value: 0 },
    { day: "S", value: 0 },
    { day: "S", value: 0 },
  ]);

  /**
   * ✅ FIX #2: Prevent endless re-fetch loops.
   * This happens when onUpdateUser triggers parent state updates that cause remount/re-render cascades.
   * Guards ensure each fetch group runs once per mount.
   */
  const didLoadProfileRef = useRef(false);
  const didLoadStatsRef = useRef(false);
  const didLoadActivityRef = useRef(false);

  // Initialize from current user (local)
  useEffect(() => {
    if (!user) return;
    setDisplayName(user.name || user.username || "");
    setEmail(user.email || "");
    setAvatarUrl(user.avatarUrl || "");
  }, [user]);

  // Load profile from backend (prefer /me/profile, fallback to /me)
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    if (didLoadProfileRef.current) return;
    didLoadProfileRef.current = true;

    (async () => {
      try {
        // 1) Try /me/profile
        let res = await apiFetch("/me/profile", { token, method: "GET" });

        // 2) Fallback to /me
        if (!res.ok) {
          res = await apiFetch("/me", { token, method: "GET" });
        }

        if (!res.ok) return;

        const data = await safeJsonParse(res);
        if (!data) return;

        // Accept flexible backend shapes:
        // { display_name, email, avatar_url }
        // OR legacy: { first_name, last_name } or { name }
        const dn = data.display_name ?? "";
        const fn = data.first_name ?? "";
        const ln = data.last_name ?? "";
        const av = data.avatar_url ?? data.avatarUrl ?? "";
        const em = data.email ?? user?.email ?? "";

        const computedDisplay =
          String(dn || "").trim() ||
          [String(fn || "").trim(), String(ln || "").trim()].filter(Boolean).join(" ") ||
          String(data.name || "").trim() ||
          user?.name ||
          user?.username ||
          "";
        setDisplayName(computedDisplay);

        if (typeof em === "string" && em) setEmail(em);
        if (typeof av === "string") setAvatarUrl(av);

        const next = {
          name: computedDisplay,
          email: em || user?.email,
          avatarUrl: av || undefined,
        };

        // ✅ Only update parent if something actually changed
        const same =
          String(next.name || "") === String(user?.name || "") &&
          String(next.email || "") === String(user?.email || "") &&
          String(next.avatarUrl || "") === String(user?.avatarUrl || "");

        if (!same) onUpdateUser?.(next);
      } catch (e) {
        console.error("[Profile] load profile failed:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load stats from backend (/me/stats?email=...)
  useEffect(() => {
    if (!user?.email) return;
    if (didLoadStatsRef.current) return;
    didLoadStatsRef.current = true;

    (async () => {
      try {
        const token = getToken();
        const res = await apiFetch(
          `/me/stats?email=${encodeURIComponent(user.email)}`,
          { token, method: "GET" }
        );

        if (!res.ok) {
          const t = await res.text().catch(() => "");
          console.warn("[Profile] /me/stats not ok:", res.status, t);
          return;
        }

        const data = await safeJsonParse(res);
        if (!data) return;

        const totalXp = Number(data.total_xp);
        const lessonsDone = Number(data.lessons_completed);

        const nextStats = {
          total_xp: Number.isFinite(totalXp) ? totalXp : 0,
          lessons_completed: Number.isFinite(lessonsDone) ? lessonsDone : 0,
        };

        setStats(nextStats);

        // ✅ Only update parent if it actually changes
        const nextPatch = {
          xp: nextStats.total_xp,
          completedLessonsCount: nextStats.lessons_completed,
        };

        const same =
          Number(user?.xp ?? 0) === Number(nextPatch.xp ?? 0) &&
          Number(user?.completedLessonsCount ?? 0) ===
            Number(nextPatch.completedLessonsCount ?? 0);

        if (!same) onUpdateUser?.(nextPatch);
      } catch (e) {
        console.error("[Profile] load /me/stats failed:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load real last-7-days activity
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    if (didLoadActivityRef.current) return;
    didLoadActivityRef.current = true;

    (async () => {
      try {
        const res = await apiFetch("/me/activity/last7days", {
          token,
          method: "GET",
        });

        if (!res.ok) {
          const res2 = await apiFetch("/me/activity?days=7", {
            token,
            method: "GET",
          });
          if (!res2.ok) return;

          const data2 = await safeJsonParse(res2);
          if (Array.isArray(data2)) setWeeklyProgress(data2);
          return;
        }

        const data = await safeJsonParse(res);

        // backend may return ARRAY directly
        if (Array.isArray(data)) {
          setWeeklyProgress(
            data.map((x) => ({
              day: String(x?.day ?? ""),
              value: Number(x?.value ?? 0),
            }))
          );
          return;
        }

        // or { days: [...] }
        if (Array.isArray(data?.days)) {
          setWeeklyProgress(
            data.days.map((x) => ({
              day: String(x?.day ?? ""),
              value: Number(x?.value ?? 0),
            }))
          );
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <p className="text-gray-600">
          You need to be logged in to view your profile.
        </p>
      </div>
    );
  }

  const displayNameComputed = useMemo(() => {
    const dn = (displayName || "").trim();
    return dn || user.name || "Haylingua learner";
  }, [displayName, user.name]);

  const initials = useMemo(() => {
    const c = (displayName || "").trim()?.[0] || user?.name?.[0] || user?.email?.[0] || "U";
    return String(c).toUpperCase();
  }, [displayName, user?.name, user?.email]);

  // Use backend stats if available; fallback to local
  const xp = stats.total_xp ?? (user.xp ?? 0);

  const lessonsCompleted =
    stats.lessons_completed ??
    user.completedLessonsCount ??
    (Array.isArray(user.completedLessons) ? user.completedLessons.length : 0);

  // derive level from XP
  const level = Math.max(1, Math.floor((Number(xp) || 0) / 500) + 1);

  // streak should never show 0
  const streak = Math.max(1, Number(user?.streak ?? 1) || 1);

  const maxVal = Math.max(...weeklyProgress.map((d) => Number(d.value) || 0), 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = getToken();

      const dn = (displayName || "").trim();
      const payload = {
        // Backend stores display_name via these compat fields
        first_name: dn || null,
        last_name: dn ? "" : null,
        email: email.trim() || user.email,
        avatar_url: avatarUrl.trim() || null,
      };

      // Persist to backend: prefer /me/profile, fallback to /me
      if (token) {
        let res = await apiFetch("/me/profile", {
          token,
          method: "PUT",
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const mergedName =
            [payload.first_name, payload.last_name].filter(Boolean).join(" ") ||
            user.name;

          res = await apiFetch("/me", {
            token,
            method: "PUT",
            body: JSON.stringify({
              name: mergedName,
              avatar_url: payload.avatar_url,
            }),
          });
        }

        if (!res.ok) {
          const t = await res.text().catch(() => "");
          console.warn("[Profile] profile save failed:", res.status, t);
        }
      }

      const newName =
        [payload.first_name, payload.last_name].filter(Boolean).join(" ") ||
        user.name;

      onUpdateUser?.({
        name: newName,
        email: payload.email,
        avatarUrl: payload.avatar_url || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Top section: avatar + basic stats */}
      <section className="bg-white rounded-2xl shadow-sm p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white text-2xl font-semibold shadow-md overflow-hidden">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayNameComputed}
                  className="w-full h-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-gray-900">
              {displayNameComputed}
            </h1>
            <p className="text-sm text-gray-500">{email}</p>
            <p className="mt-1 text-xs text-orange-600 font-medium">
              Armenian learner • Level {level}
            </p>
          </div>
        </div>

        <div className="flex gap-3 md:gap-4">
          <div className="flex flex-col items-center bg-orange-50 rounded-xl px-3 py-2">
            <Trophy className="w-4 h-4 text-orange-500 mb-1" />
            <span className="text-sm font-semibold text-gray-900">
              Lv {level}
            </span>
            <span className="text-[11px] text-gray-500">Level</span>
          </div>
          <div className="flex flex-col items-center bg-yellow-50 rounded-xl px-3 py-2">
            <Star className="w-4 h-4 text-yellow-500 mb-1" />
            <span className="text-sm font-semibold text-gray-900">{xp}</span>
            <span className="text-[11px] text-gray-500">XP</span>
          </div>
          <div className="flex flex-col items-center bg-red-50 rounded-xl px-3 py-2">
            <Flame className="w-4 h-4 text-red-500 mb-1" />
            <span className="text-sm font-semibold text-gray-900">
              {streak}
            </span>
            <span className="text-[11px] text-gray-500">Day streak</span>
          </div>
        </div>
      </section>

      {/* Profile form */}
      <section className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
        <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">
          Profile details
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="displayName"
              className="block text-xs font-medium text-gray-600 mb-1.5"
            >
              Display name
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Niko"
              autoComplete="nickname"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              This is what others will see on the leaderboard and your public page.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-gray-600 mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Used to log in to Haylingua.
              </p>
            </div>

            <div>
              <label
                htmlFor="avatarUrl"
                className="block text-xs font-medium text-gray-600 mb-1.5"
              >
                Profile picture URL
              </label>
              <input
                id="avatarUrl"
                name="avatarUrl"
                type="url"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…/avatar.png"
                autoComplete="url"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Paste a direct image link. We’ll show it in your avatar.
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm transition-colors"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </section>

      {/* Progress overview */}
      <section className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
        <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">
          Recent learning activity
        </h2>

        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-2">
              Exercises completed in the last 7 days
            </p>

            <div className="flex items-end gap-2 h-28">
              {weeklyProgress.map((d, idx) => (
                <div
                  key={`${d.day}-${idx}`}
                  className="flex flex-col items-center justify-end flex-1"
                >
                  <div
                    className="w-6 rounded-full bg-orange-100 overflow-hidden flex items-end"
                    style={{ height: "80px" }}
                  >
                    <div
                      className="w-full bg-gradient-to-t from-orange-600 to-yellow-400"
                      style={{
                        height: `${((Number(d.value) || 0) / maxVal) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="mt-1 text-[11px] text-gray-500">{d.day}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full md:w-60 space-y-3">
            <div className="flex justify-between items-center bg-orange-50 rounded-xl px-3 py-2.5">
              <span className="text-xs text-gray-600">
                Total lessons completed
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {lessonsCompleted}
              </span>
            </div>

            <div className="flex justify-between items-center bg-green-50 rounded-xl px-3 py-2.5">
              <span className="text-xs text-gray-600">Best streak</span>
              <span className="text-sm font-semibold text-gray-900">
                {streak} days
              </span>
            </div>

            <div className="flex justify-between items-center bg-blue-50 rounded-xl px-3 py-2.5">
              <span className="text-xs text-gray-600">Lifetime XP</span>
              <span className="text-sm font-semibold text-gray-900">{xp}</span>
            </div>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-gray-400">
          Stats are loaded from the backend (<code>/me/stats</code>). The “last 7
          days” chart is loaded from <code>/me/activity/last7days</code> (or falls
          back to <code>/me/activity?days=7</code>).
        </p>
      </section>
    </div>
  );
}
