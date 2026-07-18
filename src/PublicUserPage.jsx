import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Trophy, Flame, BookOpen, Users, Loader2, Lock, UserPlus, Check, Clock, Target, Zap, Crown, Star, Award, Medal, CalendarCheck } from "lucide-react";
import { StarMotif } from "./lib/motifs";
import ActivityChart from "./lib/ActivityChart";

const ACH_ICON = { target: Target, crown: Crown, zap: Zap, flame: Flame, star: Star };

// IMPORTANT:
// Public pages are served from the FE domain, but API lives on the backend.
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  "https://haylinguav2.onrender.com";

function isSafeGradient(v) {
  const s = String(v || "").trim();
  return s.startsWith("linear-gradient(") || s.startsWith("radial-gradient(") || s.startsWith("conic-gradient(");
}

// The hero banner uses the learner's chosen theme (image > gradient > apricot
// default). The page itself stays light & on-brand so it always looks crisp,
// regardless of which theme the learner picked.
function resolveBannerBackground({ themeBg, themeGradient }) {
  const g = String(themeGradient || "").trim();
  if (g && isSafeGradient(g)) return g;
  const bg = String(themeBg || "").trim();
  if (bg) return bg;
  return "linear-gradient(135deg,#FFB066,#E85F00)";
}

function resolveUrl(url) {
  if (!url) return "";
  const s = String(url).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("data:")) return s;
  if (s.startsWith("blob:")) return s;
  if (s.startsWith("/static/")) return `${API_BASE}${s}`;
  if (s.startsWith("static/")) return `${API_BASE}/${s}`;
  if (s.startsWith("/uploads/")) return `${API_BASE}${s}`;
  if (s.startsWith("uploads/")) return `${API_BASE}/${s}`;
  if (s.startsWith("/banners/") || s.startsWith("banners/")) return s.startsWith("/") ? s : `/${s}`;
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
  if (["incoming_pending", "incoming", "pending_in", "request_received", "received"].includes(s)) return "incoming_pending";
  if (["outgoing_pending", "outgoing", "pending_out", "requested", "sent"].includes(s)) return "outgoing_pending";
  return "none";
}

function StatTile({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
      <div className={"grid h-9 w-9 place-items-center rounded-xl " + tone}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-2 font-display text-2xl font-extrabold tabular-nums text-slate-800 dark:text-white">{value}</div>
      <div className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-stone-500">{label}</div>
    </div>
  );
}

function Card({ className = "", children }) {
  return <div className={`rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08] ${className}`}>{children}</div>;
}

export default function PublicUserPage({ token }) {
  const { username } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [activity, setActivity] = useState(null);
  const [avatarBroken, setAvatarBroken] = useState(false);

  useEffect(() => {
    setAvatarBroken(false); // reset when navigating to a different profile
  }, [username]);

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
  const bannerUrl = resolveUrl(
    profile?.banner_url ||
      data?.banner_url ||
      profileTheme.banner_url ||
      profileTheme.banner ||
      data?.profile_theme?.banner_url ||
      data?.profile_theme?.banner
  );
  const bannerBg = resolveBannerBackground({
    themeBg: profileTheme.background || profile?.bg_color || "",
    themeGradient: profileTheme.header_background || profileTheme.gradient || "",
  });

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
    const v = stats?.friends_count ?? profile?.friends_count ?? profile?.friends ?? data?.friends_count ?? data?.friends ?? 0;
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  }, [data, profile, stats]);
  const level = useMemo(() => {
    const v = stats?.level ?? profile?.level ?? data?.level;
    if (Number.isFinite(Number(v))) return Number(v);
    return Math.max(1, Math.floor(totalXp / 100) + 1);
  }, [data, profile, stats, totalXp]);
  const globalRank = useMemo(() => {
    const v = stats?.global_rank ?? profile?.global_rank ?? data?.global_rank ?? 0;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [data, profile, stats]);

  // This-week engagement, derived from the 7-day activity series (each day's
  // `value` is exercises completed that day).
  const weekDays = Array.isArray(activity?.days) ? activity.days : [];
  const weekExercises = weekDays.reduce((s, d) => s + (Number(d?.value) || 0), 0);
  const activeDays = weekDays.filter((d) => (Number(d?.value) || 0) > 0).length;

  const joinDate = fmtJoinDate(profile?.created_at || profile?.joined_at || data?.created_at || data?.joined_at || data?.createdAt);
  const bio = profile?.bio || profile?.about || data?.bio || data?.about || "";
  const displayName = data?.name || data?.full_name || data?.username || username;
  const achievements = Array.isArray(data?.achievements) ? data.achievements : [];

  const topFriends = Array.isArray(data?.top_friends)
    ? data.top_friends
    : Array.isArray(profile?.top_friends)
      ? profile.top_friends
      : Array.isArray(data?.friends_preview)
        ? data.friends_preview
        : [];

  const relationship = String(data?.friendship || profile?.friendship || "none").toLowerCase();
  const friendRequestId =
    data?.friend_request_id ?? profile?.friend_request_id ?? data?.friendship?.request_id ?? data?.friendship?.id ?? null;
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
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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
        <button disabled={actionBusy} onClick={() => friendAction("accept")} className="btn3d btn3d-brand text-sm uppercase inline-flex items-center gap-2">
          <Check className="h-4 w-4" /> Confirm request
        </button>
      );
    }
    if (friendStatus === "outgoing_pending") {
      return (
        <button disabled className="btn3d btn3d-neutral text-sm uppercase inline-flex items-center gap-2">
          <Clock className="h-4 w-4" /> Request sent
        </button>
      );
    }
    if (friendStatus === "friends") {
      return (
        <button disabled={actionBusy} onClick={() => friendAction("remove")} className="btn3d btn3d-neutral text-sm uppercase inline-flex items-center gap-2">
          <Check className="h-4 w-4 text-grass-500" /> Friends
        </button>
      );
    }
    return (
      <button disabled={actionBusy} onClick={() => friendAction("request")} className="btn3d btn3d-brand text-sm uppercase inline-flex items-center gap-2">
        <UserPlus className="h-4 w-4" /> Add friend
      </button>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFriendActions, friendStatus, actionBusy, data, token, username]);

  const friendsCountDisplay = (!isPrivateView && canSeeFriendsSection) ? friendsCount : "—";

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-slate-500 dark:text-stone-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-semibold">Loading profile…</span>
          </div>
        ) : err ? (
          <div className="rounded-2xl bg-cardinal-50 px-4 py-3 font-semibold text-cardinal-600 ring-1 ring-cardinal-100 dark:bg-cardinal-500/15 dark:text-cardinal-400 dark:ring-cardinal-500/30">{err}</div>
        ) : !data ? (
          <div className="rounded-3xl bg-white p-12 text-center font-semibold text-slate-500 ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:text-stone-400 dark:ring-white/[0.08]">User not found.</div>
        ) : (
          <>
            {/* ============ HERO ============ */}
            <div className="rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
              <div
                className="relative h-40 overflow-hidden rounded-t-3xl md:h-52 bg-cover bg-center"
                style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : { background: bannerBg }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
              </div>

              <div className="px-5 pb-6 md:px-8">
                {/* Avatar — pulled up to overlap the banner */}
                <div className="-mt-12 mb-3 flex items-end justify-between">
                  <div className="relative z-10 h-24 w-24 shrink-0 overflow-hidden rounded-3xl bg-brand-50 ring-4 ring-white shadow-md dark:bg-brand-500/15 dark:ring-[#18181b]">
                    {avatarUrl && !avatarBroken ? (
                      <img
                        src={avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={() => setAvatarBroken(true)}
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-brand-50 font-display text-3xl font-extrabold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                        {String(displayName || "H")[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  {heroCta ? <div className="flex items-center gap-2">{heroCta}</div> : null}
                </div>
                {/* Name + username — always in white area below banner */}
                <div>
                  <h1 className="font-display text-2xl font-extrabold leading-tight text-slate-800 sm:text-3xl dark:text-white">{displayName}</h1>
                  <div className="text-sm font-bold text-slate-400 dark:text-stone-500">
                    @{data.username}
                    {joinDate ? <span className="ml-1.5">· Joined {joinDate}</span> : null}
                  </div>
                </div>

                {bio ? <p className="mt-4 max-w-2xl text-sm font-semibold text-slate-600 dark:text-stone-300">{bio}</p> : null}

                {!isPrivateView && (
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <StatTile icon={Trophy} tone="bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400" label="Level" value={level} />
                    {globalRank > 0 && (
                      <StatTile icon={Medal} tone="bg-gold-100 text-gold-600 dark:bg-gold-500/20 dark:text-gold-400" label="Global rank" value={`#${globalRank.toLocaleString()}`} />
                    )}
                    <StatTile icon={StarMotif} tone="bg-gold-100 text-gold-600 dark:bg-gold-500/20 dark:text-gold-400" label="Total XP" value={totalXp.toLocaleString()} />
                    <StatTile icon={Flame} tone="bg-cardinal-50 text-cardinal-500 dark:bg-cardinal-500/15 dark:text-cardinal-400" label="Day streak" value={streak} />
                    <StatTile icon={BookOpen} tone="bg-grass-50 text-grass-600 dark:bg-grass-500/15 dark:text-grass-400" label="Lessons" value={lessonsCompleted} />
                    <StatTile icon={Users} tone="bg-feather-50 text-feather-600 dark:bg-feather-500/15 dark:text-feather-400" label="Friends" value={friendsCountDisplay} />
                  </div>
                )}
              </div>
            </div>

            {/* ============ BODY ============ */}
            {isPrivateView ? (
              <div className="mt-6 grid place-items-center rounded-3xl bg-white p-12 text-center ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/[0.06] dark:text-stone-500">
                  <Lock className="h-7 w-7" />
                </div>
                <div className="mt-3 font-display text-lg font-extrabold text-slate-800 dark:text-white">This profile is private</div>
                <p className="mt-1 max-w-sm font-semibold text-slate-500 dark:text-stone-400">Send a friend request to see {displayName}'s learning stats and activity.</p>
                {heroCta ? <div className="mt-5">{heroCta}</div> : null}
              </div>
            ) : (
              <>
              {/* achievements */}
              {achievements.length > 0 && (
                <Card className="mt-6 p-6">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-gold-500" />
                    <div className="font-display text-lg font-extrabold text-slate-800 dark:text-white">Achievements</div>
                    <span className="ml-1 rounded-full bg-gold-100 px-2 py-0.5 text-xs font-extrabold text-gold-600 dark:bg-gold-500/20 dark:text-gold-400">{achievements.length}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {achievements.map((a) => {
                      const Icon = ACH_ICON[a.icon] || Star;
                      return (
                        <div key={a.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-gold-200 dark:bg-[#18181b] dark:ring-gold-500/30">
                          <div
                            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white"
                            style={{ background: a.color || "#F59E0B", boxShadow: "0 3px 0 0 rgba(0,0,0,0.22)" }}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-display text-sm font-extrabold text-slate-800 dark:text-white">{a.title}</div>
                            <div className="truncate text-xs font-semibold text-slate-500 dark:text-stone-400">{a.desc}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* activity */}
                <div className="lg:col-span-2">
                  <Card className="p-6">
                    <div className="font-display text-lg font-extrabold text-slate-800 dark:text-white">Recent learning activity</div>
                    <div className="text-sm font-semibold text-slate-500 dark:text-stone-400">Exercises completed in the last 7 days</div>
                    {!activity?.days ? (
                      <div className="mt-6 grid place-items-center rounded-2xl bg-slate-50 py-10 text-sm font-semibold text-slate-400 ring-1 ring-slate-100 dark:bg-white/[0.04] dark:text-stone-500 dark:ring-white/[0.06]">
                        No activity to show yet.
                      </div>
                    ) : (
                      <>
                        <ActivityChart days={activity.days} />
                        <div className="mt-5 grid grid-cols-2 gap-3">
                          <div className="rounded-2xl bg-brand-50 px-4 py-3 ring-1 ring-brand-100 dark:bg-brand-500/15 dark:ring-brand-500/30">
                            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-stone-500">
                              <Zap className="h-3.5 w-3.5 text-brand-500" /> Exercises this week
                            </div>
                            <div className="mt-0.5 font-display text-xl font-extrabold tabular-nums text-slate-800 dark:text-white">{weekExercises}</div>
                          </div>
                          <div className="rounded-2xl bg-grass-50 px-4 py-3 ring-1 ring-grass-100 dark:bg-grass-500/15 dark:ring-grass-500/30">
                            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-stone-500">
                              <CalendarCheck className="h-3.5 w-3.5 text-grass-600" /> Active days
                            </div>
                            <div className="mt-0.5 font-display text-xl font-extrabold tabular-nums text-slate-800 dark:text-white">
                              {activeDays}<span className="text-sm font-bold text-slate-400 dark:text-stone-500">/7</span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </Card>
                </div>

                {/* friends */}
                <div className="space-y-6">
                  {canSeeFriendsSection ? (
                    <Card className="p-6">
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <div className="font-display text-lg font-extrabold text-slate-800 dark:text-white">Friends</div>
                          <div className="text-sm font-semibold text-slate-500 dark:text-stone-400">A peek at top friends</div>
                        </div>
                        {isSelf ? (
                          <button onClick={() => navigate("/friends")} className="text-sm font-extrabold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
                            View all
                          </button>
                        ) : null}
                      </div>

                      {topFriends.length === 0 ? (
                        <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-400 ring-1 ring-slate-100 dark:bg-white/[0.04] dark:text-stone-500 dark:ring-white/[0.06]">
                          No friends to show yet.
                        </div>
                      ) : (
                        <div className="mt-4 space-y-2">
                          {topFriends.slice(0, 5).map((f, idx) => {
                            const fAvatar = resolveUrl(f.avatar_url || f.avatar);
                            const fXp = f.total_xp ?? f.xp ?? 0;
                            const fName = f.display_name || f.name || f.username || "Learner";
                            const fHandle = String(f.username || "").trim();
                            const clickable = !!fHandle;
                            const Tag = clickable ? "button" : "div";
                            return (
                              <Tag
                                key={fHandle || idx}
                                {...(clickable ? { onClick: () => navigate(`/u/${encodeURIComponent(fHandle)}`) } : {})}
                                className={
                                  "flex w-full items-center gap-3 rounded-2xl bg-white p-2.5 text-left ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08] " +
                                  (clickable ? "transition hover:bg-slate-50 hover:ring-brand-200 dark:hover:bg-white/[0.04] dark:hover:ring-brand-500/30" : "")
                                }
                              >
                                <div className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-50 font-display text-sm font-extrabold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                                  <span>{String(fName)[0]?.toUpperCase()}</span>
                                  {fAvatar ? (
                                    <img
                                      src={fAvatar}
                                      alt=""
                                      className="absolute inset-0 h-full w-full object-cover"
                                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                                    />
                                  ) : null}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-extrabold text-slate-800 dark:text-white">{fName}</div>
                                  {fHandle ? <div className="truncate text-xs font-semibold text-slate-400 dark:text-stone-500">@{fHandle}</div> : null}
                                </div>
                                <div className="shrink-0 font-display text-xs font-extrabold text-slate-400 dark:text-stone-500">{fXp} XP</div>
                              </Tag>
                            );
                          })}
                        </div>
                      )}
                    </Card>
                  ) : (
                    <Card className="p-6 text-center">
                      <div className="font-display font-extrabold text-slate-800 dark:text-white">Friends are private</div>
                      <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{displayName} keeps their friends list private.</p>
                    </Card>
                  )}
                </div>
              </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

