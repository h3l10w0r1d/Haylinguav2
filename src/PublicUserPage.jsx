import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

// IMPORTANT:
// Public pages are served from the FE domain, but API lives on the backend.
// If VITE_API_BASE is not set, default to the Render backend so we don't
// accidentally fetch the FE HTML (which then fails JSON parsing).
const API_BASE = import.meta.env.VITE_API_BASE || "https://haylinguav2.onrender.com";

async function fetchJsonOrThrow(url, init) {
  const res = await fetch(url, init);
  const ct = res.headers.get("content-type") || "";
  if (!res.ok) {
    let hint = "";
    try {
      hint = (await res.text()).slice(0, 120);
    } catch {}
    throw new Error(`Request failed (${res.status})${hint ? `: ${hint}` : ""}`);
  }
  if (!ct.includes("application/json")) {
    const txt = await res.text();
    const snippet = txt.slice(0, 120).replace(/\s+/g, " ");
    throw new Error(`Expected JSON but got ${ct || "unknown"}: ${snippet}`);
  }
  return res.json();
}

function resolveUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("data:")) return url;
  return `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

function fmtJoinDate(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur px-5 py-4">
      <div className="text-xs tracking-wide text-white/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

export default function PublicUserPage({ token }) {
  const { username } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [activity, setActivity] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr("");
      try {
        const json = await fetchJsonOrThrow(
          `${API_BASE}/users/${encodeURIComponent(username)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
        );
        if (!cancelled) setData(json);

        // Also load weekly activity for the public profile (same card as private).
        try {
          const a = await fetchJsonOrThrow(
            `${API_BASE}/users/${encodeURIComponent(username)}/activity/last7days`,
            { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
          );
          if (!cancelled) setActivity(a);
        } catch {
          try {
            const a2 = await fetchJsonOrThrow(
              `${API_BASE}/users/${encodeURIComponent(username)}/activity?days=7`,
              { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
            );
            if (!cancelled) setActivity(a2);
          } catch {
            if (!cancelled) setActivity(null);
          }
        }
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [username, token]);

  // Normalize payload shapes (BE has evolved a few times):
  // - sometimes fields are top-level
  // - sometimes nested under { profile, stats, profile_theme }
  const profile = data?.profile || data?.user_profile || data?.user || data;
  const stats = data?.stats || data?.user_stats || data?.public_stats || {};

  const profileTheme = profile?.profile_theme || data?.profile_theme || {};
  const pageBg = profileTheme.background || profile?.bg_color || "#0b1220";
  const headerBg =
    profileTheme.header_background ||
    "linear-gradient(135deg, rgba(255,122,0,.25), rgba(255,122,0,.05))";
  const bannerUrl = resolveUrl(profile?.banner_url || profileTheme.banner_url);
  const avatarUrl = resolveUrl(profile?.avatar_url || profile?.avatar || data?.avatar_url || data?.avatar);

  const totalXp = useMemo(() => {
    const v = stats?.total_xp ?? stats?.xp ?? profile?.total_xp ?? profile?.xp ?? data?.total_xp ?? data?.xp ?? 0;
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  }, [data, profile, stats]);
  const lessonsCompleted = useMemo(() => {
    const v = stats?.lessons_completed ?? stats?.completed_lessons ?? profile?.lessons_completed ?? data?.lessons_completed ?? 0;
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  }, [data, profile, stats]);
  const streak = useMemo(() => {
    const v = stats?.streak ?? profile?.streak ?? data?.streak ?? 0;
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  }, [data, profile, stats]);
  const friendsCount = useMemo(() => {
    const v =
      stats?.friends_count ??
      profile?.friends_count ??
      profile?.friends ??
      data?.friends_count ??
      data?.friends ??
      0;
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  }, [data, profile, stats]);
  const level = useMemo(() => {
    const v = stats?.level ?? profile?.level ?? data?.level;
    if (Number.isFinite(Number(v))) return Number(v);
    // fallback: simple level from XP if backend didn't include it
    return Math.max(1, Math.floor(totalXp / 100) + 1);
  }, [data, profile, stats, totalXp]);

  const joinDate = fmtJoinDate(profile?.created_at || profile?.joined_at || data?.created_at || data?.joined_at || data?.createdAt);
  const bio = profile?.bio || profile?.about || data?.bio || data?.about || "";

  const topFriends = Array.isArray(data?.top_friends)
    ? data.top_friends
    : Array.isArray(profile?.top_friends)
      ? profile.top_friends
      : Array.isArray(data?.friends_preview)
        ? data.friends_preview
        : [];

  const relationship = String(data?.friendship || profile?.friendship || "none").toLowerCase();
  const friendRequestId = data?.friend_request_id ?? profile?.friend_request_id ?? null;
  const friendStatus = relationship;
  const canFriendActions = Boolean(token) && relationship !== "self" && data?.is_self !== true;

  async function friendAction(kind) {
    if (!token) {
      navigate("/login");
      return;
    }
    if (!data?.user_id) return;

    setActionBusy(true);
    try {
      let res;

      if (kind === "request") {
        // Canonical endpoint (matches Friends.jsx)
        res = await fetch(`${API_BASE}/friends/request`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: String(data.username || username || "").trim() }),
        });
      } else if (kind === "accept") {
        if (!friendRequestId) throw new Error("Missing friend request id");
        res = await fetch(`${API_BASE}/friends/requests/${friendRequestId}/accept`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } else if (kind === "remove") {
        // Backend supports this endpoint to unfriend from profile
        res = await fetch(`${API_BASE}/friends/remove/${data.user_id}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (!res) return;
      if (!res.ok) throw new Error(`Friend action failed (${res.status})`);
      // reload
      const refreshed = await fetchJsonOrThrow(
        `${API_BASE}/users/${encodeURIComponent(username)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setData(refreshed);
    } catch (e) {
      setErr(e?.message || "Friend action failed");
    } finally {
      setActionBusy(false);
    }
  }

  const heroCta = useMemo(() => {
    if (!canFriendActions) return null;

    if (friendStatus === "incoming_pending") {
      return (
        <button
          disabled={actionBusy}
          onClick={() => friendAction("accept")}
          className="px-5 py-2 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold disabled:opacity-60"
        >
          Confirm request
        </button>
      );
    }

    if (friendStatus === "outgoing_pending") {
      return (
        <button
          disabled
          className="px-5 py-2 rounded-full bg-white/10 text-white/70 text-sm font-semibold cursor-not-allowed"
        >
          Request sent
        </button>
      );
    }

    if (friendStatus === "friends") {
      return (
        <button
          disabled={actionBusy}
          onClick={() => friendAction("remove")}
          className="px-5 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white text-sm font-semibold disabled:opacity-60"
        >
          Friends ✓
        </button>
      );
    }

    return (
      <button
        disabled={actionBusy}
        onClick={() => friendAction("request")}
        className="px-5 py-2 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold disabled:opacity-60"
      >
        Add friend
      </button>
    );
  }, [canFriendActions, friendStatus, actionBusy, data, token, username]);

  return (
    <div style={{ background: pageBg }}>
      <div
        className="min-h-[calc(100vh-64px)]"
        style={{ background: pageBg }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* inside-page location indicator (header remains global) */}
        <div className="mb-4">
          <div className="text-xs text-white/55">You are here</div>
          <div className="text-2xl font-semibold text-white">Profile</div>
        </div>

        {loading ? (
          <div className="text-white/70">Loading…</div>
        ) : err ? (
          <div className="text-red-200">{err}</div>
        ) : !data ? (
          <div className="text-white/70">User not found.</div>
        ) : (
          <>
            {/* HERO / BANNER */}
            <div
              className="rounded-3xl overflow-hidden border border-white/10 shadow-[0_20px_80px_rgba(0,0,0,.35)]"
              style={{ background: headerBg }}
            >
              {bannerUrl ? (
                <div
                  className="h-36 sm:h-44 md:h-52 bg-center bg-cover"
                  style={{ backgroundImage: `url(${bannerUrl})` }}
                />
              ) : (
                <div className="h-20 sm:h-28" />
              )}

              <div className="px-6 sm:px-8 pb-8">
                <div className="-mt-10 sm:-mt-12 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/10 border border-white/15 overflow-hidden flex items-center justify-center">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-white/60 text-sm">No avatar</div>
                      )}
                    </div>

                    <div>
                      <div className="text-2xl sm:text-3xl font-semibold text-white">{data.name || data.full_name || data.username}</div>
                      <div className="text-white/65">@{data.username}</div>
                      {joinDate ? <div className="text-white/45 text-sm mt-1">Joined {joinDate}</div> : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {heroCta}
                  </div>
                </div>

                {bio ? (
                  <div className="mt-4 text-white/75 max-w-3xl">{bio}</div>
                ) : null}

                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Total XP" value={totalXp} />
                  <StatCard label="Level" value={level} />
                  <StatCard label="Streak" value={streak} />
                  <StatCard label="Friends" value={friendsCount} />
                </div>

                <div className="mt-4 text-white/55 text-sm">
                  Lessons completed: <span className="text-white/80">{lessonsCompleted}</span>
                </div>
              </div>
            </div>

            {/* TOP FRIENDS */}
            <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-white">Top friends</div>
                  <div className="text-white/55 text-sm">Top 3 friends by XP</div>
                </div>
                <button
                  onClick={() => navigate("/friends")}
                  className="text-sm font-semibold text-orange-300 hover:text-orange-200"
                >
                  View all
                </button>
              </div>

              {topFriends.length === 0 ? (
                <div className="mt-4 text-white/60">No friends yet.</div>
              ) : (
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {topFriends.slice(0, 3).map((f) => {
                    const fAvatar = resolveUrl(f.avatar_url || f.avatar);
                    const fXp = f.total_xp ?? f.xp ?? 0;
                    return (
                      <button
                        key={f.username}
                        onClick={() => navigate(`/u/${encodeURIComponent(f.username)}`)}
                        className="text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 overflow-hidden flex items-center justify-center">
                            {fAvatar ? (
                              <img src={fAvatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-white/60 text-xs">—</div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-white font-semibold truncate">{f.name || f.username}</div>
                            <div className="text-white/55 text-sm truncate">@{f.username}</div>
                          </div>
                        </div>
                        <div className="mt-3 text-white/70 text-sm">XP: <span className="text-white">{fXp}</span></div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RECENT LEARNING ACTIVITY (same card as private profile) */}
            <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-white">Recent learning activity</div>
                  <div className="text-white/55 text-sm">Exercises completed in the last 7 days</div>
                </div>
              </div>

              {!activity?.days ? (
                <div className="mt-4 text-white/60">No activity data yet.</div>
              ) : (
                <ActivityBars days={activity.days} />
              )}
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

function ActivityBars({ days }) {
  const max = Math.max(1, ...days.map((d) => Number(d.value || 0)));
  return (
    <div className="mt-6">
      <div className="flex items-end justify-between gap-3">
        {days.map((d) => {
          const v = Number(d.value || 0);
          const w = Math.min(100, (v / max) * 100);
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full rounded-full bg-white/10 overflow-hidden" style={{ height: 10 }}>
                <div className="h-full bg-orange-300/70" style={{ width: `${w}%` }} />
              </div>
              <div className="text-white/55 text-xs">{d.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
