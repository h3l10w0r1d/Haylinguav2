// src/Friends.jsx
import { useEffect, useMemo, useState } from "react";
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
  Star,
  Flame,
} from "lucide-react";

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
  const [activeTab, setActiveTab] = useState("friends"); // friends | pending | discover
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // Discover data (leaderboard)
  const [people, setPeople] = useState([]);

  // Friends from backend
  const [friends, setFriends] = useState([]); // FriendOut: {user_id,username,name,avatar_url,xp,level,streak,global_rank}

  // Incoming requests from backend
  const [incoming, setIncoming] = useState([]); // array of FriendRequestOut

  // Sent requests (best effort)
  const [sent, setSent] = useState([]); // array of {id, email, name?, created_at?}

  const token = getToken();

  // --- load everything ---
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        // 1) Discover list (leaderboard)
        const lbRes = await apiFetch("/leaderboard?limit=200", {
          token,
          method: "GET",
        });
        if (lbRes.ok) {
          const lb = await lbRes.json();
          setPeople(Array.isArray(lb) ? lb : []);
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
                created_at: x.created_at || null,
              }))
            : [];
          setSent(normalized);
        } else {
          setSent(readSentCache());
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

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
        name: f.name || f.username || "User",
        username: f.username || null,
        avatar_url: f.avatar_url || null,
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
      avatar_url: null,
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
        avatar_url: null,
        level: Number(f.level || 1),
        xp: Number(f.xp || 0),
        streak: Number(f.streak || 1),
        global_rank: Number(f.global_rank || 0),
        created_at: x.created_at || null,
      }));
  }, [sent]);

  const discoverList = useMemo(() => {
    const raw = Array.isArray(people) ? people : [];
    return raw
      .map((p) => ({
        id: Number(p.user_id ?? p.id),
        name: p.name || (p.email ? p.email.split("@")[0] : "User"),
        email: p.email || "",
        level: Number(p.level ?? 1) || 1,
        xp: Number(p.xp ?? 0) || 0,
        streak: Math.max(1, Number(p.streak ?? 1) || 1),
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

    if (friendsList.some((f) => f.email.toLowerCase() === cleanEmail)) return;
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

  const acceptRequest = async (requestId) => {
    if (!token) return;
    const res = await apiFetch(`/friends/requests/${requestId}/accept`, {
      token,
      method: "POST",
    });
    if (res.ok) {
      await refreshFriendsData();
      setActiveTab("friends");
    } else {
      const t = await res.text().catch(() => "");
      console.warn("[Friends] accept failed:", res.status, t);
    }
  };

  const rejectRequest = async (requestId) => {
    if (!token) return;
    const res = await apiFetch(`/friends/requests/${requestId}/reject`, {
      token,
      method: "POST",
    });
    if (res.ok) {
      await refreshFriendsData();
    } else {
      const t = await res.text().catch(() => "");
      console.warn("[Friends] reject failed:", res.status, t);
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

  const handleMessage = (friend) => {
    if (friend?.username) {
      window.location.href = `/u/${friend.username}`;
    }
  };

  // ✅ MISSING BEFORE: JSX must be inside a return()
  return (
    <div className="w-full">
      {/* Title */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Friends</h1>
          <p className="text-gray-600 mt-1">
            Send requests, accept incoming, and learn together.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-3 py-2 rounded-xl">
          <Users className="w-4 h-4" />
          <span className="text-sm font-medium">
            {friendsList.length} friends
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveTab("friends")}
          className={`px-4 py-2 rounded-xl font-medium transition-colors ${
            activeTab === "friends"
              ? "bg-orange-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Your friends
        </button>

        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2 rounded-xl font-medium transition-colors ${
            activeTab === "pending"
              ? "bg-orange-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Pending{" "}
          {incomingList.length + sentList.length > 0 ? (
            <span className="ml-2 inline-flex items-center justify-center text-xs font-semibold bg-white/30 px-2 py-0.5 rounded-full">
              {incomingList.length + sentList.length}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setActiveTab("discover")}
          className={`px-4 py-2 rounded-xl font-medium transition-colors ${
            activeTab === "discover"
              ? "bg-orange-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Discover
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search by name or email..."
          className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Main card */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        {!token ? (
          <div className="text-center py-10">
            <p className="text-gray-600 mb-2">
              You need to be logged in to use Friends.
            </p>
          </div>
        ) : loading ? (
          <div className="text-center py-10">
            <div className="animate-spin w-8 h-8 border-4 border-orange-200 border-t-orange-600 rounded-full mx-auto mb-4" />
            <p className="text-gray-600">Loading…</p>
          </div>
        ) : (
          <>
            {/* FRIENDS TAB */}
            {activeTab === "friends" ? (
              <>
                {applySearch(friendsList).length === 0 ? (
                  <div className="text-center py-10">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No friends yet
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Go to Discover and send a friend request.
                    </p>
                    <button
                      onClick={() => setActiveTab("discover")}
                      className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors font-medium"
                    >
                      Discover people
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {applySearch(friendsList).map((p) => (
                      <PersonCard
                        key={p.id}
                        person={p}
                        mode="friend"
                        onMessage={() => handleMessage(p)}
                        onRemove={null}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : null}

            {/* PENDING TAB */}
            {activeTab === "pending" ? (
              <>
                {/* Incoming */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Inbox className="w-4 h-4 text-gray-700" />
                    <h3 className="text-sm font-semibold text-gray-900">
                      Incoming requests
                    </h3>
                    {incomingList.length > 0 ? (
                      <span className="text-xs font-semibold bg-gray-100 px-2 py-0.5 rounded-full">
                        {incomingList.length}
                      </span>
                    ) : null}
                  </div>

                  {applySearch(incomingList).length === 0 ? (
                    <div className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4">
                      No incoming requests.
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {applySearch(incomingList).map((p) => (
                        <PersonCard
                          key={p.request_id}
                          person={p}
                          mode="incoming"
                          onAccept={() => acceptRequest(p.request_id)}
                          onDecline={() => rejectRequest(p.request_id)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Sent */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Send className="w-4 h-4 text-gray-700" />
                    <h3 className="text-sm font-semibold text-gray-900">
                      Sent requests
                    </h3>
                    {sentList.length > 0 ? (
                      <span className="text-xs font-semibold bg-gray-100 px-2 py-0.5 rounded-full">
                        {sentList.length}
                      </span>
                    ) : null}
                  </div>

                  {applySearch(sentList).length === 0 ? (
                    <div className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4">
                      No sent requests.
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {applySearch(sentList).map((p) => (
                        <PersonCard
                          key={`${p.email}-${p.request_id ?? "x"}`}
                          person={p}
                          mode="sent"
                          onCancel={() => cancelSentRequest(p.email)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <p className="mt-5 text-[11px] text-gray-400">
                  Incoming requests are real from the backend. “Sent” requests
                  will become fully real once you add{" "}
                  <code>/friends/requests/sent</code> (optional). Until then, the
                  UI keeps a local cache so you can still see what you requested.
                </p>
              </>
            ) : null}

            {/* DISCOVER TAB */}
            {activeTab === "discover" ? (
              <>
                {applySearch(discoverList).length === 0 ? (
                  <div className="text-center py-10">
                    <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No people found
                    </h3>
                    <p className="text-gray-600">Try a different search term.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {applySearch(discoverList).map((p) => {
                      const isFriend = friendsList.some((f) => f.email === p.email);
                      const isIncoming = incomingList.some((r) => r.email === p.email);
                      const isSent = sentList.some((r) => r.email === p.email);

                      return (
                        <PersonCard
                          key={p.id}
                          person={p}
                          mode="discover"
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
                                  if (req?.request_id) acceptRequest(req.request_id);
                                }
                              : null
                          }
                          onDecline={
                            isIncoming
                              ? () => {
                                  const req = incomingList.find(
                                    (r) => r.email === p.email
                                  );
                                  if (req?.request_id) rejectRequest(req.request_id);
                                }
                              : null
                          }
                          onCancel={isSent ? () => cancelSentRequest(p.email) : null}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- UI Card ---------- */

function PersonCard({
  person,
  mode,
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

  const streak = Math.max(1, Number(person?.streak ?? 1) || 1);

  return (
    <div className="p-4 border border-gray-100 rounded-2xl hover:border-orange-200 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-semibold">
            {initial}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{person.name}</h3>
            <p className="text-sm text-gray-500">{person.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mode === "friend" ? (
            <>
              <button
                onClick={onMessage}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                title="Message"
              >
                <MessageCircle className="w-5 h-5" />
              </button>

              {onRemove ? (
                <button
                  onClick={onRemove}
                  className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  <UserX className="w-4 h-4" />
                  <span>Remove</span>
                </button>
              ) : null}
            </>
          ) : null}

          {mode === "incoming" ? (
            <>
              <button
                onClick={onDecline}
                className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                <UserX className="w-4 h-4" />
                <span>Decline</span>
              </button>
              <button
                onClick={onAccept}
                className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-orange-600 text-white hover:bg-orange-700"
              >
                <UserCheck className="w-4 h-4" />
                <span>Accept</span>
              </button>
            </>
          ) : null}

          {mode === "sent" ? (
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              <Mail className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          ) : null}

          {mode === "discover" ? (
            <>
              {isFriend ? (
                <div className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 inline-flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  <span>Friends</span>
                </div>
              ) : null}

              {!isFriend && isIncoming ? (
                <>
                  <button
                    onClick={onDecline}
                    className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    <UserX className="w-4 h-4" />
                    <span>Decline</span>
                  </button>
                  <button
                    onClick={onAccept}
                    className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-orange-600 text-white hover:bg-orange-700"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Accept</span>
                  </button>
                </>
              ) : null}

              {!isFriend && !isIncoming && isSent ? (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  <Mail className="w-4 h-4" />
                  <span>Requested</span>
                </button>
              ) : null}

              {!isFriend && !isIncoming && !isSent ? (
                <button
                  onClick={onSend}
                  className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-orange-600 text-white hover:bg-orange-700"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Send request</span>
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-orange-50 px-3 py-2 rounded-xl">
          <Trophy className="w-4 h-4 text-orange-600" />
          <span className="text-sm font-medium text-gray-900">
            Lv {Number(person.level ?? 1) || 1}
          </span>
        </div>
        <div className="flex items-center gap-2 bg-yellow-50 px-3 py-2 rounded-xl">
          <Star className="w-4 h-4 text-yellow-600" />
          <span className="text-sm font-medium text-gray-900">
            {Number(person.xp ?? 0) || 0} XP
          </span>
        </div>
        <div className="flex items-center gap-2 bg-red-50 px-3 py-2 rounded-xl">
          <Flame className="w-4 h-4 text-red-600" />
          <span className="text-sm font-medium text-gray-900">
            {streak} day streak
          </span>
        </div>
      </div>
    </div>
  );
}
