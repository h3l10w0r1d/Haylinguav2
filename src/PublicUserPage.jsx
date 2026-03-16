import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

// IMPORTANT:
// Public pages are served from the FE domain, but API lives on the backend.
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  "https://haylinguav2.onrender.com";

function isSafeGradient(v) {
  const s = String(v || "").trim();
  return (
    s.startsWith("linear-gradient(") ||
    s.startsWith("radial-gradient(") ||
    s.startsWith("conic-gradient(")
  );
}

function resolveProfileBackground({ themeBg, themeGradient }) {
  const bg = String(themeBg || "").trim() || "#fff7ed";
  const g = String(themeGradient || "").trim();
  if (g && isSafeGradient(g)) return g;
  return bg;
}

function parseHexColor(input) {
  const s = String(input || "").trim();
  const hex = s.startsWith("#") ? s.slice(1) : s;
  if (![3, 6, 8].includes(hex.length)) return null;
  const expand = (h) => (h.length === 1 ? `${h}${h}` : h);
  const r = expand(hex.slice(0, hex.length === 3 ? 1 : 2));
  const g = expand(hex.slice(hex.length === 3 ? 1 : 2, hex.length === 3 ? 2 : 4));
  const b = expand(hex.slice(hex.length === 3 ? 2 : 3, hex.length === 3 ? 3 : 6));
  const rr = parseInt(r, 16);
  const gg = parseInt(g, 16);
  const bb = parseInt(b, 16);
  if ([rr, gg, bb].some((v) => Number.isNaN(v))) return null;
  return { r: rr, g: gg, b: bb };
}

function parseRgbColor(input) {
  const s = String(input || "").trim().toLowerCase();
  const m = s.match(/^rgba?\(([^)]+)\)$/);
  if (!m) return null;
  const parts = m[1]
    .split(",")
    .map((x) => x.trim())
    .slice(0, 3)
    .map((x) => Number(x));
  if (parts.length !== 3 || parts.some((v) => !Number.isFinite(v))) return null;
  return { r: parts[0], g: parts[1], b: parts[2] };
}

function relativeLuminance({ r, g, b }) {
  const srgb = [r, g, b].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function pickThemeVars(pageBg, isGradient) {
  if (isGradient) {
    return {
      "--hl-card-bg": "rgba(255,255,255,0.78)",
      "--hl-card-border": "rgba(15,23,42,0.10)",
      "--hl-text": "#0f172a",
      "--hl-muted": "rgba(15,23,42,0.65)",
      "--hl-soft": "rgba(15,23,42,0.08)",
      "--hl-hero-overlay": "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(255,255,255,0.85) 55%, rgba(255,255,255,1) 100%)",
    };
  }

  const rgb = parseHexColor(pageBg) || parseRgbColor(pageBg);
  const lum = rgb ? relativeLuminance(rgb) : 0.9;
  const isDark = lum < 0.42;

  if (isDark) {
    return {
      "--hl-card-bg": "rgba(15,23,42,0.62)",
      "--hl-card-border": "rgba(248,250,252,0.14)",
      "--hl-text": "#f8fafc",
      "--hl-muted": "rgba(248,250,252,0.72)",
      "--hl-soft": "rgba(248,250,252,0.14)",
      "--hl-hero-overlay": "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(2,6,23,0.65) 55%, rgba(2,6,23,0.88) 100%)",
    };
  }

  return {
    "--hl-card-bg": "rgba(255,255,255,0.78)",
    "--hl-card-border": "rgba(15,23,42,0.10)",
    "--hl-text": "#0f172a",
    "--hl-muted": "rgba(15,23,42,0.65)",
    "--hl-soft": "rgba(15,23,42,0.08)",
    "--hl-hero-overlay": "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(255,255,255,0.85) 55%, rgba(255,255,255,1) 100%)",
  };
}

// FIX: resolveUrl must handle /static/ (backend) vs /banners/ (frontend preset) correctly
function resolveUrl(url) {
  if (!url) return "";
  const s = String(url).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("data:")) return s;
  if (s.startsWith("blob:")) return s;
  // Backend-hosted media — must be absolute
  if (s.startsWith("/static/")) return `${API_BASE}${s}`;
  if (s.startsWith("static/")) return `${API_BASE}/${s}`;
  if (s.startsWith("/uploads/")) return `${API_BASE}${s}`;
  if (s.startsWith("uploads/")) return `${API_BASE}/${s}`;
  // Frontend preset banners served from Vercel — keep relative
  if (s.startsWith("/banners/") || s.startsWith("banners/")) return s.startsWith("/") ? s : `/${s}`;
  // Any other absolute path — relative to current origin
  if (s.startsWith("/")) return s;
  return s;
}

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

function fmtJoinDate(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function normalizeFriendshipStatus(raw) {
  const s = String(raw || "none").toLowerCase().trim();
  if (["self", "me"].includes(s)) return "self";
  if (["friends", "friend", "accepted", "connected"].includes(s)) return "friends";
  if (["incoming_pending", "incoming", "pending_in", "request_received", "received"].includes(s))
    return "incoming_pending";
  if (["outgoing_pending", "outgoing", "pending_out", "requested", "sent"].includes(s))
    return "outgoing_pending";
  return "none";
}

function StatCard({ label, value }) {
  return (
    <div
      className="rounded-3xl border px-5 py-4 shadow-sm backdrop-blur"
      style={{ background: "var(--hl-card-bg)", borderColor: "var(--hl-card-border)" }}
    >
      <div className="text-xs tracking-wide" style={{ color: "var(--hl-muted)" }}>
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold" style={{ color: "var(--hl-text)" }}>
        {value}
      </div>
    </div>
  );
}

function Card({ className = "", children }) {
  return (
    <div
      className={`rounded-3xl border shadow-sm backdrop-blur ${className}`}
      style={{ background: "var(--hl-card-bg)", borderColor: "var(--hl-card-border)" }}
    >
      {children}
    </div>
  );
}

function Button({ variant = "primary", disabled, onClick, children }) {
  const base =
    "inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed";
  if (variant === "neutral") {
    return (
      <button
        disabled={disabled}
        onClick={onClick}
        className={base}
        style={{
          color: "var(--hl-text)",
          background: "rgba(255,255,255,0.18)",
          border: `1px solid var(--hl-soft)`,
        }}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`${base} bg-orange-500 hover:bg-orange-600 text-white shadow-sm`}
    >
      {children}
    </button>
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
  const profile = data?.profile || data?.user_profile || data?.user || data;
  const stats = data?.stats || data?.user_stats || data?.public_stats || {};

  const profileTheme = profile?.profile_theme || data?.profile_theme || {};
  const pageBg = resolveProfileBackground({
    themeBg: profileTheme.background || profile?.bg_color || "#fff7ed",
    themeGradient: profileTheme.gradient || "",
  });
  const isGradientBg = isSafeGradient(pageBg);
  const themeVars = useMemo(() => pickThemeVars(pageBg, isGradientBg), [pageBg, isGradientBg]);
  const headerBg =
    profileTheme.header_background ||
    (isSafeGradient(profileTheme.gradient) ? profileTheme.gradient : null) ||
    "linear-gradient(135deg, rgba(255,122,0,.25), rgba(255,122,0,.05))";

  // FIX: banner_url — check every field the backend might return it under
  const bannerUrl = resolveUrl(
    profile?.banner_url ||
      data?.banner_url ||
      profileTheme.banner_url ||
      profileTheme.banner ||
      data?.profile_theme?.banner_url ||
      data?.profile_theme?.banner
  );

  // FIX: avatar_url — check every field
  const avatarUrl = resolveUrl(
    profile?.avatar_url ||
      profile?.avatar ||
      data?.avatar_url ||
      data?.avatar
  );

  const totalXp = useMemo(() => {
    const v = stats?.total_xp ?? stats?.xp ?? profile?.total_xp ?? profile?.xp ?? data?.total_xp ?? data?.xp ?? 0;
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  }, [data, profile, stats]);
  const lessonsCompleted = useMemo(() => {
    const v = stats?.lessons_completed ?? stats?.completed_lessons ?? profile?.lessons_completed ?? data?.lessons_completed ?? 0;
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  }, [data, profile, stats]);
  const streak = useMemo(() => {
    const v = stats?.streak ?? profile?.streak ?? data?.streak ?? 1;
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
  const friendRequestId =
    data?.friend_request_id ??
    profile?.friend_request_id ??
    data?.friendship?.request_id ??
    data?.friendship?.id ??
    null;
  const friendStatus = normalizeFriendshipStatus(relationship);
  const canFriendActions = Boolean(token) && relationship !== "self" && data?.is_self !== true;

  const isHidden = Boolean(profile?.is_hidden ?? data?.is_hidden);
  const isSelf = friendStatus === "self" || data?.is_self === true;
  const isFriend = friendStatus === "friends";
  const isPrivateView = isHidden && !isSelf && !isFriend;

  const friendsPublic =
    typeof profile?.friends_public === "boolean"
      ? profile.friends_public
      : typeof data?.friends_public === "boolean"
        ? data.friends_public
        : true;
  const canSeeFriendsSection = (isSelf || isFriend) ? true : friendsPublic;

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
        <Button disabled={actionBusy} onClick={() => friendAction("accept")}>Confirm request</Button>
      );
    }

    if (friendStatus === "outgoing_pending") {
      return (
        <Button variant="neutral" disabled>Request sent</Button>
      );
    }

    if (friendStatus === "friends") {
      return (
        <Button variant="neutral" disabled={actionBusy} onClick={() => friendAction("remove")}>Friends ✓</Button>
      );
    }

    return (
      <Button disabled={actionBusy} onClick={() => friendAction("request")}>Add friend</Button>
    );
  }, [canFriendActions, friendStatus, actionBusy, data, token, username]);

  const friendsCountDisplay = (!isPrivateView && canSeeFriendsSection) ? friendsCount : "—";

  return (
    <div style={{ background: pageBg, ...themeVars }}>
      <div className="min-h-[calc(100vh-64px)]" style={{ background: pageBg }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {loading ? (
          <div style={{ color: "var(--hl-muted)" }}>Loading…</div>
        ) : err ? (
          <div className="text-red-600">{err}</div>
        ) : !data ? (
          <div style={{ color: "var(--hl-muted)" }}>User not found.</div>
        ) : (
          <>
            {/* HERO */}
            <div className="relative rounded-3xl overflow-hidden" style={{ background: headerBg }}>
              {bannerUrl ? (
                <div className="h-44 sm:h-56 md:h-64 bg-center bg-cover" style={{ backgroundImage: `url(${bannerUrl})` }} />
              ) : (
                <div className="h-32 sm:h-40 md:h-48" />
              )}

              <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--hl-hero-overlay)" }} />

              <div className="relative px-5 sm:px-7 pb-8 pt-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex items-end gap-4">
                    <div
                      className="-mt-16 sm:-mt-20 w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden shadow-sm"
                      style={{ background: "rgba(255,255,255,0.20)", border: `2px solid var(--hl-soft)` }}
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-sm" style={{ color: "var(--hl-muted)" }}>
                          No avatar
                        </div>
                      )}
                    </div>

                    <div className="pb-1">
                      <div className="text-3xl sm:text-4xl font-semibold" style={{ color: "var(--hl-text)" }}>
                        {data.name || data.full_name || data.username}
                      </div>
                      <div className="text-sm" style={{ color: "var(--hl-muted)" }}>
                        @{data.username}
                        {joinDate ? <span className="ml-2">• Joined {joinDate}</span> : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">{heroCta}</div>
                </div>

                {bio ? (
                  <div className="mt-4 max-w-3xl text-sm sm:text-base" style={{ color: "var(--hl-text)" }}>
                    {bio}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {isPrivateView ? (
                  <Card className="p-6">
                    <div className="text-base font-semibold" style={{ color: "var(--hl-text)" }}>
                      This profile is private
                    </div>
                    <div className="mt-2 text-sm" style={{ color: "var(--hl-muted)" }}>
                      Send a friend request to view learning stats and activity.
                    </div>
                  </Card>
                ) : (
                  <Card className="p-6">
                    <div>
                      <div className="text-lg font-semibold" style={{ color: "var(--hl-text)" }}>
                        Recent learning activity
                      </div>
                      <div className="text-sm" style={{ color: "var(--hl-muted)" }}>
                        Exercises completed in the last 7 days
                      </div>
                    </div>

                    {!activity?.days ? (
                      <div className="mt-4 text-sm" style={{ color: "var(--hl-muted)" }}>
                        No activity data yet.
                      </div>
                    ) : (
                      <ActivityBars days={activity.days} />
                    )}
                  </Card>
                )}
              </div>

              <div className="space-y-6">
                <Card className="p-6">
                  <div className="text-lg font-semibold" style={{ color: "var(--hl-text)" }}>
                    Stats
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <StatCard label="Total XP" value={isPrivateView ? "—" : totalXp} />
                    <StatCard label="Level" value={isPrivateView ? "—" : level} />
                    <StatCard label="Streak" value={isPrivateView ? "—" : streak} />
                    <StatCard label="Friends" value={friendsCountDisplay} />
                  </div>
                  {!isPrivateView ? (
                    <div className="mt-4 text-sm" style={{ color: "var(--hl-muted)" }}>
                      Lessons completed: <span style={{ color: "var(--hl-text)" }}>{lessonsCompleted}</span>
                    </div>
                  ) : null}
                </Card>

                {!isPrivateView && canSeeFriendsSection ? (
                  <Card className="p-6">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <div className="text-lg font-semibold" style={{ color: "var(--hl-text)" }}>
                          Friends
                        </div>
                        <div className="text-sm" style={{ color: "var(--hl-muted)" }}>
                          A quick peek at top friends
                        </div>
                      </div>
                      <button
                        onClick={() => navigate("/friends")}
                        className="text-sm font-semibold hover:opacity-90"
                        style={{ color: "var(--hl-text)" }}
                      >
                        View all
                      </button>
                    </div>

                    {topFriends.length === 0 ? (
                      <div className="mt-4 text-sm" style={{ color: "var(--hl-muted)" }}>
                        No friends yet.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {topFriends.slice(0, 3).map((f) => {
                          const fAvatar = resolveUrl(f.avatar_url || f.avatar);
                          const fXp = f.total_xp ?? f.xp ?? 0;
                          return (
                            <button
                              key={f.username}
                              onClick={() => navigate(`/u/${encodeURIComponent(f.username)}`)}
                              className="w-full text-left rounded-2xl border p-3 transition hover:-translate-y-0.5"
                              style={{ background: "rgba(255,255,255,0.08)", borderColor: "var(--hl-soft)" }}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-10 h-10 rounded-xl overflow-hidden grid place-items-center"
                                  style={{ background: "rgba(255,255,255,0.10)", border: `1px solid var(--hl-soft)` }}
                                >
                                  {fAvatar ? (
                                    <img src={fAvatar} alt="" className="w-full h-full object-cover"
                                      onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                  ) : (
                                    <div className="text-xs" style={{ color: "var(--hl-muted)" }}>
                                      —
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold truncate" style={{ color: "var(--hl-text)" }}>
                                    {f.name || f.username}
                                  </div>
                                  <div className="text-sm truncate" style={{ color: "var(--hl-muted)" }}>
                                    @{f.username}
                                  </div>
                                </div>
                                <div className="text-sm" style={{ color: "var(--hl-muted)" }}>
                                  {fXp} XP
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                ) : null}
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

function ActivityBars({ days }) {
  const normalized = (Array.isArray(days) ? days : []).map((d, i) => {
    const v = Number(d?.value ?? 0);
    const label = String(d?.label ?? "").trim();
    const date = String(d?.date ?? "").trim();
    const safeLabel = label || (date ? date.slice(5) : String(i + 1));
    return { key: d?.date || String(i), v: Number.isFinite(v) ? v : 0, label: safeLabel };
  });

  const values = normalized.map((x) => x.v);
  const maxV = Math.max(1, ...values);
  const allZero = values.every((x) => x === 0);

  return (
    <div className="mt-5">
      <div className="flex items-end gap-3 h-28">
        {normalized.map((x) => {
          const h = Math.round((x.v / maxV) * 88);
          return (
            <div key={x.key} className="flex flex-col items-center gap-2 flex-1">
              <div className="w-full max-w-[46px]">
                <div
                  className="relative h-20 w-full rounded-2xl overflow-hidden border"
                  style={{ background: "rgba(255,255,255,0.10)", borderColor: "var(--hl-soft)" }}
                >
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-2xl"
                    style={{
                      height: `${allZero ? 8 : Math.max(8, h)}px`,
                      background:
                        "linear-gradient(180deg, rgba(252,114,41,.95), rgba(252,76,48,.75))",
                    }}
                    title={`${x.label}: ${x.v}`}
                  />
                </div>
              </div>
              <div className="text-[11px]" style={{ color: "var(--hl-muted)" }}>
                {x.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
