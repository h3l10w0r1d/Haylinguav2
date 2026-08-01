// src/Friends.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  UserPlus,
  UserCheck,
  UserX,
  MessageCircle,
  Mail,
  Inbox,
  Send,
  Trophy,
  Flame,
  EyeOff,
  Zap,
  Check,
  AlertCircle,
} from "lucide-react";
import { StarMotif } from "./lib/motifs";
import { CrownBadge } from "./lib/PremiumBadge";
import AvatarFrame from "./lib/avatarFrame";
import grandma from "./assets/character-grandma.png";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  "https://haylinguav2.onrender.com";

// FIX: /static/ paths must be prefixed with API_BASE (backend-hosted)
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

// Fallback cache for SENT requests (only used if backend doesn't provide /friends/requests/sent yet)
const SENT_CACHE_KEY = "hay_friends_sent_cache_v1";
function readSentCache() {
  try {
    const raw = localStorage.getItem(SENT_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writeSentCache(arr) {
  try {
    localStorage.setItem(SENT_CACHE_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

export default function Friends() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("friends"); // friends | activity | pending | discover
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null); // { type: "success" | "error", text }

  // Discover data (leaderboard)
  const [people, setPeople] = useState([]);

  // Friends from backend
  const [friends, setFriends] = useState([]); // FriendOut: {user_id,username,name,avatar_url,xp,level,streak,global_rank}

  // Incoming requests from backend
  const [incoming, setIncoming] = useState([]); // array of FriendRequestOut

  // Sent requests (best effort)
  const [sent, setSent] = useState([]); // array of {id, email, name?, created_at?}

  // Activity feed
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Referral
  const [referral, setReferral] = useState(null); // { code, referred_count }
  const [referralCopied, setReferralCopied] = useState(false);

  const token = getToken();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // --- load everything ---
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        // 1) Discover list — smart, ranked suggestions (league cohort, referral
        // graph, mutual friends, onboarding cohort, shared learning profile,
        // progress proximity) rather than the raw all-time XP leaderboard.
        const suggRes = await apiFetch("/friends/suggestions?limit=50", {
          token,
          method: "GET",
        });
        if (suggRes.ok) {
          const sugg = await suggRes.json();
          setPeople(Array.isArray(sugg) ? sugg : []);
        } else {
          setPeople([]);
        }

        // 2) Friends
        const frRes = await apiFetch("/friends", { token, method: "GET" });
        if (frRes.ok) {
          const fr = await frRes.json();
          setFriends(Array.isArray(fr) ? fr : []);
        } else {
          setFriends([]);
        }

        // 3) Incoming pending requests
        const inRes = await apiFetch("/friends/requests", {
          token,
          method: "GET",
        });
        if (inRes.ok) {
          const inc = await inRes.json();
          setIncoming(Array.isArray(inc) ? inc : []);
        } else {
          setIncoming([]);
        }

        // 4) Sent requests (optional endpoint; fallback to cache if missing)
        const sentRes = await apiFetch("/friends/requests/sent", {
          token,
          method: "GET",
        });
        if (sentRes.ok) {
          const s = await sentRes.json();
          const normalized = Array.isArray(s)
            ? s.map((x) => ({
                id: x.id,
                email: x.addressee_email || x.email || "",
                name: x.addressee_name || x.name || null,
                avatar_url: x.addressee_avatar_url || x.avatar_url || null,
                created_at: x.created_at || null,
              }))
            : [];
          setSent(normalized);
        } else {
          setSent(readSentCache());
        }

        // 5) Referral code
        const refRes = await apiFetch("/me/referral", { token, method: "GET" });
        if (refRes.ok) setReferral(await refRes.json());
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // Load activity feed when that tab is opened (lazy)
  useEffect(() => {
    if (activeTab !== "activity" || !token || activityLoading) return;
    setActivityLoading(true);
    apiFetch("/friends/activity?days=7", { token, method: "GET" })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setActivity(Array.isArray(d) ? d : []))
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false));
  }, [activeTab, token]);

  const refreshFriendsData = async () => {
    if (!token) return;
    try {
      const [frRes, inRes, sentRes] = await Promise.all([
        apiFetch("/friends", { token, method: "GET" }),
        apiFetch("/friends/requests", { token, method: "GET" }),
        apiFetch("/friends/requests/sent", { token, method: "GET" }),
      ]);

      if (frRes.ok) {
        const fr = await frRes.json();
        setFriends(Array.isArray(fr) ? fr : []);
      }

      if (inRes.ok) {
        const inc = await inRes.json();
        setIncoming(Array.isArray(inc) ? inc : []);
      }

      if (sentRes.ok) {
        const s = await sentRes.json();
        const normalized = Array.isArray(s)
          ? s.map((x) => ({
              id: x.id,
              email: x.addressee_email || x.email || "",
              name: x.addressee_name || x.name || null,
              avatar_url: x.addressee_avatar_url || x.avatar_url || null,
              created_at: x.created_at || null,
            }))
          : [];
        setSent(normalized);
      } else {
        setSent(readSentCache());
      }
    } catch {
      // ignore
    }
  };

  // --- derived lists ---

  const friendsList = useMemo(() => {
    return friends
      .map((f) => ({
        id: Number(f.user_id ?? f.id),
        is_hidden: !!f.is_hidden,
        name: f.is_hidden ? "Hidden" : f.name || f.username || "User",
        username: f.is_hidden ? null : (f.username || null),
        avatar_url: f.is_hidden ? null : (f.avatar_url || null),
        is_premium: !!f.is_premium,
        active_frame_style: f.is_hidden ? null : (f.active_frame_style || null),
        // Sent requests don't have stats; keep neutral values.
        level: 1,
        xp: 0,
        streak: 0,
        global_rank: 0,
      }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [friends]);

  const incomingList = useMemo(() => {
    return (incoming || []).map((r) => ({
      request_id: r.id,
      id: Number(r.requester_id),
      name:
        r.requester_name || r.requester_username || (r.requester_email ? r.requester_email.split("@")[0] : "User"),
      email: r.requester_email || "",
      avatar_url: r.avatar_url || null,
      level: 1,
      xp: 0,
      streak: 1,
      created_at: r.created_at,
    }));
  }, [incoming]);

  const sentList = useMemo(() => {
    return (sent || [])
      .filter((x) => x?.email)
      .map((x) => ({
        request_id: x.id || null,
        id: x.email, // stable key if no id
        name: x.name || x.email.split("@")[0],
        email: x.email,
        avatar_url: x.avatar_url || null,
        // Sent requests don't have stats; keep neutral values.
        level: 1,
        xp: 0,
        streak: 0,
        global_rank: 0,
        created_at: x.created_at || null,
      }));
  }, [sent]);

  const discoverList = useMemo(() => {
    const raw = Array.isArray(people) ? people : [];
    // /friends/suggestions already excludes hidden profiles server-side.
    return raw
      .map((p) => ({
        id: Number(p.user_id ?? p.id),
        username: p.username || null,
        avatar_url: p.avatar_url || null,
        name: p.name || (p.email ? p.email.split("@")[0] : "User"),
        email: p.email || "",
        level: Number(p.level ?? 1) || 1,
        xp: Number(p.xp ?? 0) || 0,
        streak: Math.max(1, Number(p.streak ?? 1) || 1),
        score: Number(p.score ?? 0) || 0,
        reasons: Array.isArray(p.reasons) ? p.reasons : [],
      }))
      .filter((p) => Number.isFinite(p.id) && p.email);
  }, [people]);

  const applySearch = (list) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q)
    );
  };

  // --- Actions (backend) ---
  const sendRequestByEmail = async (email) => {
    if (!token) return;

    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail) return;

    // Friends list doesn't include emails; avoid crashing on undefined.
    if (incomingList.some((r) => r.email.toLowerCase() === cleanEmail)) return;
    if (sentList.some((r) => r.email.toLowerCase() === cleanEmail)) return;

    const res = await apiFetch("/friends/request", {
      token,
      method: "POST",
      // Backend expects { query: "<username_or_email>" }
      body: JSON.stringify({ query: cleanEmail }),
    });

    if (res.ok) {
      const cached = readSentCache();
      const next = [
        { id: null, email: cleanEmail, name: null, created_at: new Date().toISOString() },
        ...cached,
      ].slice(0, 100);
      writeSentCache(next);
      setSent(next);
      await refreshFriendsData();
      setActiveTab("pending");
    } else {
      const t = await res.text().catch(() => "");
      console.warn("[Friends] POST /friends/request failed:", res.status, t);
    }
  };

  const acceptRequest = async (requestId, name) => {
    if (!token) return;
    const res = await apiFetch(`/friends/requests/${requestId}/accept`, {
      token,
      method: "POST",
    });
    if (res.ok) {
      await refreshFriendsData();
      setToast({ type: "success", text: name ? `You and ${name} are now friends!` : "Friend request accepted." });
    } else {
      const t = await res.text().catch(() => "");
      console.warn("[Friends] accept failed:", res.status, t);
      setToast({ type: "error", text: "Couldn't accept that request. Try again." });
    }
  };

  const rejectRequest = async (requestId, name) => {
    if (!token) return;
    const res = await apiFetch(`/friends/requests/${requestId}/reject`, {
      token,
      method: "POST",
    });
    if (res.ok) {
      await refreshFriendsData();
      setToast({ type: "success", text: name ? `Declined ${name}'s request.` : "Request declined." });
    } else {
      const t = await res.text().catch(() => "");
      console.warn("[Friends] reject failed:", res.status, t);
      setToast({ type: "error", text: "Couldn't decline that request. Try again." });
    }
  };

  const cancelSentRequest = (email) => {
    const clean = String(email || "").trim().toLowerCase();
    const cached = readSentCache().filter(
      (x) => (x.email || "").toLowerCase() !== clean
    );
    writeSentCache(cached);
    setSent(cached);
  };

  // FIX: only navigate if username exists
  const openPublicProfile = (person) => {
    if (!person || person.is_hidden) return;
    const u = String(person.username || "").trim();
    if (!u) return;
    navigate(`/u/${encodeURIComponent(u)}`);
  };

  const handleMessage = (friend) => openPublicProfile(friend);

  const TABS = [
    { key: "friends", label: "Friends" },
    { key: "activity", label: "Activity" },
    { key: "pending", label: "Pending", badge: incomingList.length + sentList.length },
    { key: "discover", label: "Discover" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-6">
          <div
            className={
              "pointer-events-auto flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-lg " +
              (toast.type === "error" ? "bg-cardinal-500" : "bg-grass-500")
            }
          >
            {toast.type === "error" ? <AlertCircle className="h-4 w-4 shrink-0" /> : <Check className="h-4 w-4 shrink-0" />}
            {toast.text}
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Title */}
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">Friends</h1>
            <p className="mt-1 font-semibold text-slate-500 dark:text-stone-400">
              Send requests, accept incoming, and learn together.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-full bg-brand-50 px-3 py-2 text-brand-600 ring-1 ring-brand-100 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/30">
            <Users className="h-4 w-4" />
            <span className="text-sm font-extrabold">{friendsList.length} friends</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={
                "rounded-2xl px-4 py-2.5 font-display text-sm font-extrabold transition " +
                (activeTab === t.key
                  ? "bg-brand-500 text-white shadow-btn-brand"
                  : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-[#18181b] dark:text-stone-400 dark:ring-white/[0.08] dark:hover:bg-white/[0.04]")
              }
            >
              {t.label}
              {t.badge > 0 ? (
                <span
                  className={
                    "ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs " +
                    (activeTab === t.key ? "bg-white/25" : "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400")
                  }
                >
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-stone-500" />
          <input
            type="text"
            placeholder="Search by name or email…"
            className="w-full rounded-2xl bg-white py-3.5 pl-12 pr-4 font-semibold text-slate-800 ring-2 ring-slate-200 transition focus:outline-none focus:ring-brand-400 placeholder:text-slate-400 dark:bg-[#18181b] dark:text-white dark:ring-white/[0.08] dark:placeholder:text-stone-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Main card */}
        <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm sm:p-6 dark:bg-[#18181b] dark:ring-white/[0.08]">
          {!token ? (
            <EmptyState title="Log in to use Friends" text="You need to be logged in to send and accept friend requests." />
          ) : loading ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-brand-100 border-t-brand-500" />
              <p className="font-semibold text-slate-500 dark:text-stone-400">Loading…</p>
            </div>
          ) : (
            <>
              {/* FRIENDS TAB */}
              {activeTab === "friends" ? (
                <>
                  {/* Referral invite card */}
                  {referral && (
                    <div className="mb-5 flex items-center gap-4 rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-100 dark:bg-brand-500/15 dark:ring-brand-500/30">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500 text-white">
                        <UserPlus className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-sm font-extrabold text-slate-800 dark:text-white">
                          Invite a friend, earn +3 hearts
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <code className="rounded-lg bg-white px-2 py-0.5 text-xs font-bold tracking-widest text-brand-700 ring-1 ring-brand-200 dark:bg-[#18181b] dark:text-brand-400 dark:ring-brand-500/30">
                            {referral.code}
                          </code>
                          <span className="text-xs text-slate-400 dark:text-stone-500">·</span>
                          <span className="text-xs font-semibold text-slate-500 dark:text-stone-400">
                            {referral.referred_count} referred
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          const text = `Join me on Haylingua and learn Armenian! Use my invite code ${referral.code} at haylingua.am 🇦🇲`;
                          if (navigator.share) {
                            try { await navigator.share({ text }); return; } catch {}
                          }
                          await navigator.clipboard.writeText(text).catch(() => {});
                          setReferralCopied(true);
                          setTimeout(() => setReferralCopied(false), 2500);
                        }}
                        className="shrink-0 rounded-xl bg-brand-500 px-3 py-2 text-xs font-extrabold uppercase text-white shadow-[0_3px_0_0_#c2430a] transition active:translate-y-0.5"
                      >
                        {referralCopied ? "Copied!" : "Share"}
                      </button>
                    </div>
                  )}

                  {applySearch(friendsList).length === 0 ? (
                    <EmptyState
                      title="No friends yet"
                      text="Head to Discover and send your first friend request."
                      cta="Discover people"
                      onCta={() => setActiveTab("discover")}
                    />
                  ) : (
                    <div className="grid gap-3">
                      {applySearch(friendsList).map((p) => (
                        <PersonCard
                          key={p.id}
                          person={p}
                          mode="friend"
                          onOpenProfile={() => openPublicProfile(p)}
                          onMessage={() => handleMessage(p)}
                          onRemove={null}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : null}

              {/* ACTIVITY TAB */}
              {activeTab === "activity" ? (
                activityLoading ? (
                  <div className="flex flex-col items-center gap-3 py-16">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-500" />
                    <p className="font-semibold text-slate-400 dark:text-stone-500">Loading activity…</p>
                  </div>
                ) : activity.length === 0 ? (
                  <EmptyState
                    title="No recent activity"
                    text="When your friends complete lessons, you'll see it here."
                    cta="Find friends"
                    onCta={() => setActiveTab("discover")}
                  />
                ) : (
                  <ActivityFeed activity={activity} onOpenProfile={(a) => a.username && navigate(`/u/${encodeURIComponent(a.username)}`)} />
                )
              ) : null}

              {/* PENDING TAB */}
              {activeTab === "pending" ? (
                <>
                  {/* Incoming */}
                  <div className="mb-6">
                    <SectionLabel icon={Inbox} title="Incoming requests" count={incomingList.length} />
                    {applySearch(incomingList).length === 0 ? (
                      <div className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500 dark:bg-white/[0.04] dark:text-stone-400">
                        No incoming requests.
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {applySearch(incomingList).map((p) => (
                          <PersonCard
                            key={p.request_id}
                            person={p}
                            mode="incoming"
                            onOpenProfile={() => openPublicProfile(p)}
                            onAccept={() => acceptRequest(p.request_id, p.name)}
                            onDecline={() => rejectRequest(p.request_id, p.name)}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sent */}
                  <div>
                    <SectionLabel icon={Send} title="Sent requests" count={sentList.length} />
                    {applySearch(sentList).length === 0 ? (
                      <div className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500 dark:bg-white/[0.04] dark:text-stone-400">
                        No sent requests.
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {applySearch(sentList).map((p) => (
                          <PersonCard
                            key={`${p.email}-${p.request_id ?? "x"}`}
                            person={p}
                            mode="sent"
                            onOpenProfile={() => openPublicProfile(p)}
                            onCancel={() => cancelSentRequest(p.email)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}

              {/* DISCOVER TAB */}
              {activeTab === "discover" ? (
                applySearch(discoverList).length === 0 ? (
                  <EmptyState title="No people found" text="Try a different search term." />
                ) : (
                  <div className="grid gap-3">
                    {applySearch(discoverList).map((p) => {
                      const isFriend = friendsList.some((f) => f.email === p.email);
                      const isIncoming = incomingList.some((r) => r.email === p.email);
                      const isSent = sentList.some((r) => r.email === p.email);

                      return (
                        <PersonCard
                          key={p.id}
                          person={p}
                          mode="discover"
                          onOpenProfile={() => openPublicProfile(p)}
                          isFriend={isFriend}
                          isIncoming={isIncoming}
                          isSent={isSent}
                          onSend={
                            !isFriend && !isIncoming && !isSent
                              ? () => sendRequestByEmail(p.email)
                              : null
                          }
                          onAccept={
                            isIncoming
                              ? () => {
                                  const req = incomingList.find(
                                    (r) => r.email === p.email
                                  );
                                  if (req?.request_id) acceptRequest(req.request_id, p.name);
                                }
                              : null
                          }
                          onDecline={
                            isIncoming
                              ? () => {
                                  const req = incomingList.find(
                                    (r) => r.email === p.email
                                  );
                                  if (req?.request_id) rejectRequest(req.request_id, p.name);
                                }
                              : null
                          }
                          onCancel={isSent ? () => cancelSentRequest(p.email) : null}
                        />
                      );
                    })}
                  </div>
                )
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */

// ── Activity feed ─────────────────────────────────────────────────────────────
const XP_COLORS = [
  "from-brand-400 to-brand-600",
  "from-grass-400 to-grass-600",
  "from-feather-400 to-feather-600",
  "from-gold-400 to-gold-500",
];

function timeAgo(isoStr) {
  if (!isoStr) return "";
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function dayLabel(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function Avatar({ name, avatarUrl, size = 12, ring = false, frameStyle = null }) {
  const initials = (name || "?").slice(0, 2).toUpperCase();
  const ringCls = ring && !frameStyle ? " ring-2 ring-white ring-offset-1 ring-offset-brand-500" : "";
  return (
    <AvatarFrame frameStyle={frameStyle} size={size * 4} radius="9999px" thickness={Math.max(2, size / 6)} className="shrink-0">
      {avatarUrl ? (
        <img src={resolveUrl(avatarUrl)} className={"h-full w-full rounded-full object-cover" + ringCls} alt="" />
      ) : (
        <div
          className={"grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-brand-300 to-brand-500 font-extrabold text-white" + ringCls}
          style={{ fontSize: size < 10 ? 11 : 14 }}
        >
          {initials}
        </div>
      )}
    </AvatarFrame>
  );
}

function ActivityFeed({ activity, onOpenProfile }) {
  // Group by day
  const groups = [];
  let lastDay = null;
  activity.forEach((a) => {
    const day = a.completed_at ? new Date(a.completed_at).toDateString() : "Unknown";
    if (day !== lastDay) {
      groups.push({ day, label: dayLabel(a.completed_at), items: [] });
      lastDay = day;
    }
    groups[groups.length - 1].items.push(a);
  });

  return (
    <div className="space-y-6">
      {groups.map((group, gi) => (
        <div key={gi}>
          {/* Day separator */}
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-100 dark:bg-white/[0.06]" />
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400 dark:text-stone-500">{group.label}</span>
            <div className="h-px flex-1 bg-slate-100 dark:bg-white/[0.06]" />
          </div>

          <div className="space-y-2">
            {group.items.map((a, i) => {
              const color = XP_COLORS[(a.friend_id ?? i) % XP_COLORS.length];
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onOpenProfile?.(a)}
                  className="group w-full text-left"
                >
                  <div className="flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-white/[0.04] dark:active:bg-white/[0.06]">
                    {/* Avatar with XP ring */}
                    <div className="relative shrink-0">
                      <div className={`absolute -inset-0.5 rounded-full bg-gradient-to-br ${color} opacity-0 transition group-hover:opacity-100`} />
                      <div className="relative">
                        <Avatar name={a.name} avatarUrl={a.avatar_url} size={12} />
                      </div>
                      {/* Completion badge */}
                      <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-grass-500 ring-2 ring-white text-white">
                        <svg viewBox="0 0 10 10" className="h-3 w-3 fill-white">
                          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    </div>

                    {/* Text */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-slate-700 dark:text-stone-200">
                        <span className="font-extrabold text-slate-900 dark:text-white">{a.name}</span>
                        {" finished "}
                        <span className="font-bold text-brand-600 dark:text-brand-400">"{a.lesson_title}"</span>
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-400 dark:text-stone-500">{timeAgo(a.completed_at)}</p>
                    </div>

                    {/* XP pill */}
                    <div className={`shrink-0 rounded-full bg-gradient-to-r ${color} px-2.5 py-1 text-xs font-extrabold text-white shadow-sm`}>
                      +{a.xp_earned} XP
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ icon: Icon, title, count }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-slate-500 dark:text-stone-400" />
      <h3 className="font-display text-sm font-extrabold text-slate-700 dark:text-stone-200">{title}</h3>
      {count > 0 ? (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-white/[0.06] dark:text-stone-300">{count}</span>
      ) : null}
    </div>
  );
}

function EmptyState({ title, text, cta, onCta }) {
  return (
    <div className="py-10 text-center">
      <img src={grandma} alt="" className="mx-auto mb-4 h-20 w-20 rounded-2xl object-cover" />
      <h3 className="font-display text-lg font-extrabold text-slate-800 dark:text-white">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm font-semibold text-slate-500 dark:text-stone-400">{text}</p>
      {cta ? (
        <button onClick={onCta} className="btn3d btn3d-brand mt-5 uppercase">
          {cta}
        </button>
      ) : null}
    </div>
  );
}

/* ---------- Person card ---------- */

function PersonCard({
  person,
  mode,
  onOpenProfile,
  onSend,
  onAccept,
  onDecline,
  onCancel,
  onMessage,
  onRemove,
  isFriend,
  isSent,
  isIncoming,
}) {
  const initial = (person?.name?.[0] || person?.email?.[0] || "U")
    .toUpperCase()
    .trim();

  const isHidden = !!person?.is_hidden;
  const avatarSrc = !isHidden ? resolveUrl(person?.avatar_url) : "";
  const canNavigate = !isHidden && !!person?.username;
  const streak = Math.max(1, Number(person?.streak ?? 1) || 1);

  return (
    <div
      className={
        "rounded-2xl bg-white p-4 ring-1 ring-slate-200 transition dark:bg-[#18181b] dark:ring-white/[0.08] " +
        (isHidden ? "opacity-80 " : canNavigate ? "cursor-pointer hover:ring-brand-300 hover:shadow-sm dark:hover:ring-brand-500/30 " : "")
      }
      onClick={() => (canNavigate ? onOpenProfile?.() : null)}
      role={canNavigate ? "button" : undefined}
      tabIndex={canNavigate ? 0 : undefined}
      onKeyDown={(e) => {
        if (canNavigate && (e.key === "Enter" || e.key === " ")) onOpenProfile?.();
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="relative flex min-w-0 items-center gap-3">
          <div className="relative shrink-0">
            <AvatarFrame frameStyle={!isHidden ? person?.active_frame_style : null} size={48} radius="1rem" thickness={2.5}>
              <div className={"grid h-full w-full place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-pom-500 font-display font-extrabold text-white " + (!person?.active_frame_style && person?.is_premium ? "ring-2 ring-gold-400" : "")}>
                {isHidden ? (
                  <EyeOff className="h-5 w-5" />
                ) : avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ) : (
                  initial
                )}
              </div>
            </AvatarFrame>
            {!isHidden && person?.is_premium && <CrownBadge size="h-4 w-4" iconSize="h-2.5 w-2.5" />}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-extrabold text-slate-800 dark:text-white">
              {isHidden ? "Hidden" : person.name}
            </h3>
            <p className="truncate text-sm font-semibold text-slate-400 dark:text-stone-500">
              {isHidden ? "This user is hidden" : (person.email || person.username || "")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:w-auto sm:shrink-0">
          {mode === "friend" ? (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onMessage?.(); }}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-white/[0.06] dark:text-stone-300 dark:hover:bg-white/10"
                title="Open profile"
              >
                <MessageCircle className="h-5 w-5" />
              </button>
              {onRemove ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
                  className="btn3d btn3d-neutral flex-1 !py-2 text-sm sm:flex-none"
                >
                  <UserX className="h-4 w-4" /> Remove
                </button>
              ) : null}
            </>
          ) : null}

          {mode === "incoming" ? (
            <>
              <button onClick={(e) => { e.stopPropagation(); onDecline?.(); }} className="btn3d btn3d-neutral flex-1 !py-2 text-sm sm:flex-none">
                <UserX className="h-4 w-4" /> Decline
              </button>
              <button onClick={(e) => { e.stopPropagation(); onAccept?.(); }} className="btn3d btn3d-brand flex-1 !py-2 text-sm sm:flex-none">
                <UserCheck className="h-4 w-4" /> Accept
              </button>
            </>
          ) : null}

          {mode === "sent" ? (
            <button onClick={(e) => { e.stopPropagation(); onCancel?.(); }} className="btn3d btn3d-neutral flex-1 !py-2 text-sm sm:flex-none">
              <Mail className="h-4 w-4" /> Cancel
            </button>
          ) : null}

          {mode === "discover" ? (
            <>
              {isFriend ? (
                <div className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-grass-50 px-4 py-2 text-sm font-extrabold text-grass-700 dark:bg-grass-500/15 dark:text-grass-400 sm:flex-none">
                  <UserCheck className="h-4 w-4" /> Friends
                </div>
              ) : null}

              {!isFriend && isIncoming ? (
                <>
                  <button onClick={(e) => { e.stopPropagation(); onDecline?.(); }} className="btn3d btn3d-neutral flex-1 !py-2 text-sm sm:flex-none">
                    <UserX className="h-4 w-4" /> Decline
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onAccept?.(); }} className="btn3d btn3d-brand flex-1 !py-2 text-sm sm:flex-none">
                    <UserCheck className="h-4 w-4" /> Accept
                  </button>
                </>
              ) : null}

              {!isFriend && !isIncoming && isSent ? (
                <button onClick={(e) => { e.stopPropagation(); onCancel?.(); }} className="btn3d btn3d-neutral flex-1 !py-2 text-sm sm:flex-none">
                  <Mail className="h-4 w-4" /> Requested
                </button>
              ) : null}

              {!isFriend && !isIncoming && !isSent ? (
                <button onClick={(e) => { e.stopPropagation(); onSend?.(); }} className="btn3d btn3d-brand flex-1 !py-2 text-sm sm:flex-none">
                  <UserPlus className="h-4 w-4" /> Add
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {isHidden ? null : (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-brand-50 px-3 py-1.5 text-sm font-bold text-slate-700 dark:bg-brand-500/15 dark:text-stone-200">
            <Trophy className="h-4 w-4 text-brand-500" /> Lv {Number(person.level ?? 1) || 1}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-1.5 text-sm font-bold text-slate-700 dark:bg-amber-500/15 dark:text-stone-200">
            <StarMotif className="h-4 w-4 text-gold-500" /> {Number(person.xp ?? 0) || 0} XP
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-cardinal-50 px-3 py-1.5 text-sm font-bold text-slate-700 dark:bg-cardinal-500/15 dark:text-stone-200">
            <Flame className="h-4 w-4 text-cardinal-500" /> {streak} day streak
          </span>
        </div>
      )}

      {/* Why this suggestion — makes "Discover" feel earned, not random. */}
      {!isHidden && mode === "discover" && Array.isArray(person.reasons) && person.reasons.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {person.reasons.map((reason) => (
            <span
              key={reason}
              className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500 dark:bg-white/[0.06] dark:text-stone-400"
            >
              {reason}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
