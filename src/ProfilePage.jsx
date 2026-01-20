// src/ProfilePage.jsx
import { useEffect, useMemo, useState } from "react";
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

async function apiFetch(path, { token, ...opts } = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  return res;
}

export default function ProfilePage({ user, onUpdateUser }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [saving, setSaving] = useState(false);

  // Backend-driven stats (keep UI the same)
  const [stats, setStats] = useState({
    total_xp: null,
    lessons_completed: null,
  });

  // Optional backend-driven last-7-days activity (UI stays even without endpoint)
  const [weeklyProgress, setWeeklyProgress] = useState([
    { day: "M", value: 0 },
    { day: "T", value: 0 },
    { day: "W", value: 0 },
    { day: "T", value: 0 },
    { day: "F", value: 0 },
    { day: "S", value: 0 },
    { day: "S", value: 0 },
  ]);

  // Initialize from current user (local)
  useEffect(() => {
    if (!user) return;
    const nameParts = (user.name || "").split(" ");
    setFirstName(nameParts[0] || "");
    setLastName(nameParts.slice(1).join(" ") || "");
    setEmail(user.email || "");
    setAvatarUrl(user.avatarUrl || "");
  }, [user]);

  // Load profile from backend (if endpoint exists)
  useEffect(() => {
    if (!user?.email) return;
    const token = getToken();
    if (!token) return;

    (async () => {
      try {
        const res = await apiFetch("/me/profile", { token, method: "GET" });
        if (!res.ok) return; // If you haven't added the endpoint yet, ignore quietly.
        const data = await res.json();

        // Accept flexible backend shapes:
        // { first_name, last_name, email, avatar_url } OR { name, email, avatarUrl }
        const fn = data.first_name ?? "";
        const ln = data.last_name ?? "";
        const av = data.avatar_url ?? data.avatarUrl ?? "";
        const em = data.email ?? user.email;

        if (fn || ln) {
          setFirstName(fn);
          setLastName(ln);
        } else if (data.name) {
          const parts = String(data.name).split(" ");
          setFirstName(parts[0] || "");
          setLastName(parts.slice(1).join(" ") || "");
        }

        if (typeof em === "string") setEmail(em);
        if (typeof av === "string") setAvatarUrl(av);

        // keep app user in sync
        const mergedName =
          [fn?.trim(), ln?.trim()].filter(Boolean).join(" ") ||
          data.name ||
          user.name;

        onUpdateUser?.({
          name: mergedName,
          email: em,
          avatarUrl: av || undefined,
        });
      } catch (e) {
        console.error("[Profile] load /me/profile failed:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  // Load stats from backend (existing endpoint in your backend: /me/stats?email=...)
  useEffect(() => {
    if (!user?.email) return;

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

        const data = await res.json();
        setStats({
          total_xp: Number.isFinite(Number(data.total_xp))
            ? Number(data.total_xp)
            : 0,
          lessons_completed: Number.isFinite(Number(data.lessons_completed))
            ? Number(data.lessons_completed)
            : 0,
        });

        // Keep app user consistent for UI elsewhere
        onUpdateUser?.({
          xp: Number(data.total_xp) || 0,
          completedLessonsCount: Number(data.lessons_completed) || 0,
        });
      } catch (e) {
        console.error("[Profile] load /me/stats failed:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  // Optional: load real last-7-days bars if you add backend endpoint later
  useEffect(() => {
    if (!user?.email) return;

    (async () => {
      try {
        const token = getToken();
        const res = await apiFetch("/me/activity/last7days", {
          token,
          method: "GET",
        });

        if (!res.ok) return; // endpoint not there yet -> keep zeros
        const data = await res.json();

        // Expected shape example:
        // { days: [{ day: "M", value: 2 }, ...] }
        const days = Array.isArray(data?.days) ? data.days : null;
        if (!days) return;

        const normalized = ["M", "T", "W", "T", "F", "S", "S"].map((d, i) => {
          const match = days[i] || days.find((x) => x?.day === d);
          return { day: d, value: Number(match?.value || 0) };
        });

        setWeeklyProgress(normalized);
      } catch (e) {
        // ignore (endpoint optional)
      }
    })();
  }, [user?.email]);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <p className="text-gray-600">
          You need to be logged in to view your profile.
        </p>
      </div>
    );
  }

  const displayName = useMemo(() => {
    const composed = [firstName, lastName].map((s) => s?.trim()).filter(Boolean).join(" ");
    return composed || user.name || "Haylingua learner";
  }, [firstName, lastName, user.name]);

  const initials = useMemo(() => {
    const c =
      firstName?.[0] ||
      user?.name?.[0] ||
      user?.email?.[0] ||
      "U";
    return String(c).toUpperCase();
  }, [firstName, user?.name, user?.email]);

  // Use backend stats if available; fallback to local
  const xp = stats.total_xp ?? (user.xp ?? 0);
  const lessonsCompleted =
    stats.lessons_completed ??
    user.completedLessonsCount ??
    (Array.isArray(user.completedLessons) ? user.completedLessons.length : 0);

  // derive level from XP (same logic as backend leaderboard)
  const level = Math.max(1, Math.floor((Number(xp) || 0) / 500) + 1);

  // streak still local unless you add backend tracking
  const streak = user.streak ?? 0;

  const maxVal = Math.max(...weeklyProgress.map((d) => d.value), 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = getToken();

      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || user.email,
        avatar_url: avatarUrl.trim() || null,
      };

      // If backend exists, this persists to DB.
      // If not yet, it will fail silently but we still update local state.
      if (token) {
        const res = await apiFetch("/me/profile", {
          token,
          method: "PUT",
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const t = await res.text().catch(() => "");
          console.warn("[Profile] PUT /me/profile failed:", res.status, t);
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
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-gray-900">
              {displayName}
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
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                First name
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Armen"
                name="firstName"
                id="firstName"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Last name
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Petrosyan"
                name="lastName"
                id="lastName"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                name="email"
                id="email"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Used to log in to Haylingua.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Profile picture URL
              </label>
              <input
                type="url"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…/avatar.png"
                name="avatarUrl"
                id="avatarUrl"
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
                        height: `${(d.value / maxVal) * 100}%`,
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
          Stats are now loaded from the backend (<code>/me/stats</code>). The
          “last 7 days” chart will become real once you add{" "}
          <code>/me/activity/last7days</code>.
        </p>
      </section>
    </div>
  );
}
