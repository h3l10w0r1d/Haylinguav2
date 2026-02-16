import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";

/**
 * Public user page
 * - Works without auth
 * - If token exists, we pass it to show friend-status / extra info (backend may use it)
 */

// Keep API base consistent across the app.
// Prefer VITE_API_BASE_URL, fallback to legacy VITE_API_BASE.
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  "https://haylinguav2.onrender.com";

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/70 border border-black/5 px-4 py-3 shadow-sm">
      <div className="text-xs text-black/50">{label}</div>
      <div className="text-xl font-semibold text-black">{value ?? "—"}</div>
    </div>
  );
}

export default function PublicUserPage({ token }) {
  const { username } = useParams();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [data, setData] = useState(null);

  const safeUsername = useMemo(() => (username || "").trim(), [username]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch(`${API_BASE}/users/${encodeURIComponent(safeUsername)}`, {
          headers: {
            "content-type": "application/json",
            ...authHeaders(token),
          },
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.detail || `Failed to load user (${r.status})`);
        if (!cancelled) setData(j);
      } catch (e) {
        if (!cancelled) setErr(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (safeUsername) run();
    return () => {
      cancelled = true;
    };
  }, [safeUsername, token]);

  // Backend returns PublicUserOut:
  // { username, name, bio, avatar_url, profile_theme, xp, level, streak, global_rank, friends_preview[] }
  const displayName = data?.name || data?.username || safeUsername;
  const avatarUrl = data?.avatar_url || null;

  const theme = data?.profile_theme || {};
  const pageBg = theme?.background || "#fff7ef";

  return (
    <div className="min-h-screen" style={{ background: pageBg }}>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <div className="text-sm text-black/50">Public profile</div>
            <div className="text-2xl font-bold text-black">@{safeUsername}</div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/leaderboard"
              className="rounded-xl px-4 py-2 text-sm font-medium bg-white border border-black/10 hover:bg-white/80"
            >
              Leaderboard
            </Link>
            <Link
              to="/profile"
              className="rounded-xl px-4 py-2 text-sm font-medium bg-[#ff6a00] text-white hover:bg-[#ff7a1a]"
            >
              My profile
            </Link>
          </div>
        </div>

        <div className="rounded-3xl bg-white/60 border border-black/5 shadow-sm overflow-hidden">
          <div className="p-6 md:p-8">
            {loading ? (
              <div className="text-black/60">Loading…</div>
            ) : err ? (
              <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-red-700">
                {err}
              </div>
            ) : (
              <>
                <div className="flex items-start gap-5">
                  <div className="h-16 w-16 rounded-2xl bg-[#ff6a00]/15 flex items-center justify-center overflow-hidden border border-black/5">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-[#ff6a00]">
                        {(displayName || "?").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="text-2xl font-bold text-black leading-tight">{displayName}</div>
                    <div className="text-sm text-black/50">@{data?.username || safeUsername}</div>
                    {data?.bio ? (
                      <div className="mt-3 text-sm text-black/70 whitespace-pre-wrap">{data.bio}</div>
                    ) : (
                      <div className="mt-3 text-sm text-black/50">Armenian learner on Haylingua.</div>
                    )}
                  </div>

                  {typeof data?.global_rank === "number" ? (
                    <div className="hidden md:block rounded-2xl bg-white border border-black/10 px-4 py-3 text-center">
                      <div className="text-xs text-black/50">Global rank</div>
                      <div className="text-xl font-semibold">#{data.global_rank}</div>
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Stat label="XP" value={data?.xp} />
                  <Stat label="Level" value={data?.level} />
                  <Stat label="Streak" value={data?.streak} />
                  <Stat label="Friends" value={data?.friends_count} />
                </div>

                {data?.friends_public && Array.isArray(data?.friends_preview) && data.friends_preview.length > 0 ? (
                  <div className="mt-8">
                    <div className="text-sm font-semibold text-black mb-3">Friends</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {data.friends_preview.map((f) => (
                        <div
                          key={f.username}
                          className="rounded-2xl bg-white border border-black/10 px-4 py-3 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold">{f.display_name || f.username}</div>
                            <div className="text-xs text-black/50">@{f.username}</div>
                          </div>
                        <div className="text-sm text-black/70">#{f.global_rank ?? "—"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
  if (data?.is_hidden) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h1 className="text-xl font-semibold text-gray-900">
            {data.username || "User"}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            This account is hidden.
          </p>
        </div>
      </div>
    );
  }


