// src/ProfilePage.jsx
import { useEffect, useMemo, useState } from "react";
import { Trophy, Flame, Star } from "lucide-react";

// Adjust if you already have a centralized api client.
// This works with VITE_API_BASE_URL or defaults to your Render URL.
const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://haylinguav2.onrender.com";

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("hay_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

async function apiGetMe() {
  const token = getToken();
  if (!token) throw new Error("Missing auth token");

  const res = await fetch(`${API_BASE}/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Failed to load profile");
  }
  return await res.json();
}

async function apiUpdateMe({ name, avatar_url }) {
  const token = getToken();
  if (!token) throw new Error("Missing auth token");

  const res = await fetch(`${API_BASE}/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, avatar_url }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Failed to save profile");
  }
  return await res.json();
}

async function apiGetStatsByEmail(email) {
  const token = getToken();
  const res = await fetch(
    `${API_BASE}/me/stats?email=${encodeURIComponent(email || "")}`,
    {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }
  );

  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Failed to load stats");
  }
  return await res.json();
}

export default function ProfilePage({ user, onUpdateUser }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Stats (keep UI, but load from backend)
  const [stats, setStats] = useState({
    total_xp: user?.xp ?? 0,
    lessons_completed: user?.completedLessons?.length ?? 0,
  });

  // initialize form from user prop
  useEffect(() => {
    if (!user) return;
    const nameParts = String(user.name || "").split(" ");
    setFirstName(nameParts[0] || "");
    setLastName(nameParts.slice(1).join(" ") || "");
    setEmail(user.email || "");
    setAvatarUrl(user.avatarUrl || user.avatar_url || "");
  }, [user]);

  // load profile from backend to ensure DB is source-of-truth
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setErrorMsg("");
        setLoadingProfile(true);

        const token = getToken();
        if (!token) return; // not logged in; rely on prop user

        const me = await apiGetMe();

        if (!mounted) return;

        // Update local form fields
        const nameParts = String(me.name || "").split(" ");
        setFirstName(nameParts[0] || "");
        setLastName(nameParts.slice(1).join(" ") || "");
        setEmail(me.email || email);
        setAvatarUrl(me.avatar_url || "");

        // Update parent user state (keep compat keys)
        onUpdateUser?.({
          ...user,
          id: me.id,
          email: me.email,
          name: me.name,
          avatarUrl: me.avatar_url,
          avatar_url: me.avatar_url,
        });

        // Load stats after we know email
        if (me.email) {
          setLoadingStats(true);
          const st = await apiGetStatsByEmail(me.email);
          if (!mounted) return;
          setStats({
            total_xp: Number(st.total_xp || 0),
            lessons_completed: Number(st.lessons_completed || 0),
          });
        }
      } catch (e) {
        if (!mounted) return;
        setErrorMsg(e?.message || "Failed to load profile");
      } finally {
        if (!mounted) return;
        setLoadingProfile(false);
        setLoadingStats(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If not logged in
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
    const composed = [firstName || "", lastName || ""]
      .map((x) => String(x).trim())
      .filter(Boolean)
      .join(" ");
    return composed || user.name || "Haylingua learner";
  }, [firstName, lastName, user.name]);

  const initials = useMemo(() => {
    const c =
      (firstName?.[0] ||
        user.name?.[0] ||
        user.email?.[0] ||
        "U") + "";
    return c.toUpperCase();
  }, [firstName, user.name, user.email]);

  // Derive level from XP (same logic as backend leaderboard: level = xp//500 + 1)
  const xp = Number(stats.total_xp ?? user.xp ?? 0);
  const level = Math.max(1, Math.floor(xp / 500) + 1);
  const streak = user.streak ?? 1;

  // Keep same UI for the chart; if you want it real later, we can compute from lesson_progress
  const weeklyProgress = [
    { day: "M", value: 2 },
    { day: "T", value: 3 },
    { day: "W", value: 1 },
    { day: "T", value: 4 },
    { day: "F", value: 0 },
    { day: "S", value: 5 },
    { day: "S", value: 2 },
  ];
  const maxVal = Math.max(...weeklyProgress.map((d) => d.value), 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");

    try {
      const newName = [firstName.trim(), lastName.trim()]
        .filter(Boolean)
        .join(" ");

      const saved = await apiUpdateMe({
        name: newName || null,
        avatar_url: avatarUrl.trim() || null,
      });

      // Keep local state consistent with backend response
      const savedParts = String(saved.name || "").split(" ");
      setFirstName(savedParts[0] || "");
      setLastName(savedParts.slice(1).join(" ") || "");
      setEmail(saved.email || email);
      setAvatarUrl(saved.avatar_url || "");

      // Update parent
      onUpdateUser?.({
        ...user,
        id: saved.id,
        email: saved.email,
        name: saved.name,
        avatarUrl: saved.avatar_url,
        avatar_url: saved.avatar_url,
      });

      // Reload stats (email should not change here, but keep robust)
      try {
        setLoadingStats(true);
        const st = await apiGetStatsByEmail(saved.email || email);
        setStats({
          total_xp: Number(st.total_xp || 0),
          lessons_completed: Number(st.lessons_completed || 0),
        });
      } finally {
        setLoadingStats(false);
      }
    } catch (e2) {
      setErrorMsg(e2?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Error banner */}
      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl px-4 py-3 text-sm">
          {errorMsg}
        </div>
      ) : null}

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
              {loadingProfile ? (
                <span className="ml-2 text-gray-400">Loading…</span>
              ) : null}
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
            <span className="text-sm font-semibold text-gray-900">
              {loadingStats ? "…" : xp}
            </span>
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
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Email is used to log in. (Changing it needs a dedicated flow.)
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
              {weeklyProgress.map((d) => (
                <div
                  key={d.day}
                  className="flex flex-col items-center justify-end flex-1"
                >
                  <div
                    className="w-6 rounded-full bg-orange-100 overflow-hidden flex items-end"
                    style={{ height: "80px" }}
                  >
                    <div
                      className="w-full bg-gradient-to-t from-orange-600 to-yellow-400"
                      style={{ height: `${(d.value / maxVal) * 100}%` }}
                    />
                  </div>
                  <span className="mt-1 text-[11px] text-gray-500">
                    {d.day}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full md:w-60 space-y-3">
            <div className="flex justify-between items-center bg-orange-50 rounded-xl px-3 py-2.5">
              <span className="text-xs text-gray-600">Lessons completed</span>
              <span className="text-sm font-semibold text-gray-900">
                {loadingStats ? "…" : stats.lessons_completed}
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
              <span className="text-sm font-semibold text-gray-900">
                {loadingStats ? "…" : xp}
              </span>
            </div>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-gray-400">
          Stats are now loaded from the backend (lesson_progress). The 7-day
          chart is still a UI placeholder — we can make it real next.
        </p>
      </section>
    </div>
  );
}
