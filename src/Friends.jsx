// src/Friends.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Mail,
  Search,
  MessageCircle,
  Trophy,
  Star,
  Flame,
  Inbox,
  Send,
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

/**
 * Local friend request storage (MVP)
 * Stored PER USER:
 *  - friends: number[]
 *  - sent: number[]       (requests I've sent)
 *
 * Incoming requests are derived by scanning OTHER users' sent[] lists:
 *  - if other.sent includes myId => it's incoming to me
 *
 * That means incoming works if multiple accounts use the same browser/localStorage
 * (useful for testing).
 */
function lsKeyFor(userId) {
  return `hay_friends_state_v1_user_${userId}`;
}

function readState(userId) {
  try {
    const raw = localStorage.getItem(lsKeyFor(userId));
    const obj = JSON.parse(raw || "{}");
    return {
      friends: Array.isArray(obj.friends) ? obj.friends.map(Number) : [],
      sent: Array.isArray(obj.sent) ? obj.sent.map(Number) : [],
    };
  } catch {
    return { friends: [], sent: [] };
  }
}

function writeState(userId, state) {
  localStorage.setItem(
    lsKeyFor(userId),
    JSON.stringify({
      friends: Array.from(new Set((state.friends || []).map(Number))).filter(
        (x) => Number.isFinite(x)
      ),
      sent: Array.from(new Set((state.sent || []).map(Number))).filter((x) =>
        Number.isFinite(x)
      ),
    })
  );
}

function getAllStoredUserIds() {
  const ids = [];
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith("hay_friends_state_v1_user_")) {
      const part = k.replace("hay_friends_state_v1_user_", "");
      const id = Number(part);
      if (Number.isFinite(id)) ids.push(id);
    }
  }
  return ids;
}

export default function Friends() {
  const location = useLocation();

  const [activeTab, setActiveTab] = useState("friends"); // 'friends' | 'pending' | 'discover'
  const [searchTerm, setSearchTerm] = useState("");

  const [me, setMe] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  // local state derived from storage (once me.id is known)
  const [friends, setFriends] = useState([]);
  const [sent, setSent] = useState([]);

  // derived incoming (computed)
  const [incoming, setIncoming] = useState([]);

  // Load me + leaderboard
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const meRes = await apiFetch("/me", { token, method: "GET" });
        if (meRes.ok) {
          const meData = await meRes.json();
          setMe(meData);
        }

        const lbRes = await apiFetch("/leaderboard?limit=50", {
          token,
          method: "GET",
        });
        if (lbRes.ok) {
          const lb = await lbRes.json();
          setLeaderboard(Array.isArray(lb) ? lb : []);
        } else {
          setLeaderboard([]);
        }
      } catch (e) {
        console.error("[Friends] load failed:", e);
        setLeaderboard([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load local state once we know me.id
  useEffect(() => {
    const myId = Number(me?.id);
    if (!Number.isFinite(myId)) return;

    const s = readState(myId);
    setFriends(s.friends);
    setSent(s.sent);
  }, [me?.id]);

  // Derive incoming by scanning other users’ sent[]
  useEffect(() => {
    const myId = Number(me?.id);
    if (!Number.isFinite(myId)) return;

    const allUserIds = getAllStoredUserIds().filter((id) => id !== myId);

    const incomingFrom = [];
    for (const otherId of allUserIds) {
      const st = readState(otherId);
      if (st.sent.includes(myId)) {
        // if already friends, ignore (accepted)
        if (friends.includes(otherId)) continue;
        incomingFrom.push(otherId);
      }
    }

    setIncoming(Array.from(new Set(incomingFrom)));
  }, [me?.id, friends]);

  // Persist state when friends/sent change
  useEffect(() => {
    const myId = Number(me?.id);
    if (!Number.isFinite(myId)) return;

    writeState(myId, { friends, sent });
  }, [me?.id, friends, sent]);

  const myId = Number(me?.id);

  const people = useMemo(() => {
    return (leaderboard || [])
      .map((u) => {
        const id = Number(u.user_id ?? u.id);
        if (!Number.isFinite(id)) return null;
        if (id === myId) return null;

        const email = u.email || "";
        const name =
          (u.name && String(u.name).trim()) ||
          (email.includes("@") ? email.split("@")[0] : "User");

        const xp = Number(u.xp ?? u.total_xp ?? 0) || 0;
        const level = Math.max(1, Number(u.level ?? 1) || 1);
        const streak = Math.max(1, Number(u.streak ?? 0) || 0); // never 0

        const isFriend = friends.includes(id);
        const isSent = sent.includes(id);
        const isIncoming = incoming.includes(id);

        return {
          id,
          name,
          email,
          xp,
          level,
          streak,
          isFriend,
          isSent,
          isIncoming,
        };
      })
      .filter(Boolean);
  }, [leaderboard, myId, friends, sent, incoming]);

  const byId = useMemo(() => {
    const m = new Map();
    for (const p of people) m.set(p.id, p);
    return m;
  }, [people]);

  const friendsList = useMemo(
    () => people.filter((p) => p.isFriend),
    [people]
  );

  const discoverList = useMemo(() => {
    return people.filter((p) => {
      // show in discover if not friend
      // (even if pending, we can still show but button will be disabled)
      return !p.isFriend;
    });
  }, [people]);

  const incomingList = useMemo(() => {
    // incoming ids might not all be in leaderboard (but likely yes)
    const arr = incoming
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((p) => ({ ...p, isIncoming: true }));
    return arr;
  }, [incoming, byId]);

  const sentList = useMemo(() => {
    const arr = sent
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((p) => ({ ...p, isSent: true }));
    return arr;
  }, [sent, byId]);

  const applySearch = (list) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
    );
  };

  // --- Actions (MVP local) ---
  const sendRequest = (targetId) => {
    if (!Number.isFinite(myId)) return;

    // if already friend -> no
    if (friends.includes(targetId)) return;

    // if incoming from them -> accepting is more logical, but allow send? no.
    if (incoming.includes(targetId)) return;

    // if already sent -> no
    if (sent.includes(targetId)) return;

    setSent((prev) => [...prev, targetId]);
  };

  const cancelRequest = (targetId) => {
    setSent((prev) => prev.filter((x) => x !== targetId));
  };

  const acceptRequest = (fromId) => {
    // accept means: add to friends, and remove their request (incoming)
    // We also should remove from their "sent" if they are in same localStorage world (testing scenario).
    if (!Number.isFinite(myId)) return;

    // add friend
    setFriends((prev) => (prev.includes(fromId) ? prev : [...prev, fromId]));

    // remove any "sent" to them (edge case)
    setSent((prev) => prev.filter((x) => x !== fromId));

    // remove from other user's sent list (so it no longer shows as incoming after refresh)
    const other = readState(fromId);
    const cleaned = { ...other, sent: other.sent.filter((x) => x !== myId) };
    writeState(fromId, cleaned);

    // recompute incoming will happen automatically due to effect
  };

  const declineRequest = (fromId) => {
    // remove their request (incoming) by cleaning their "sent" list (local test mode)
    if (!Number.isFinite(myId)) return;

    const other = readState(fromId);
    const cleaned = { ...other, sent: other.sent.filter((x) => x !== myId) };
    writeState(fromId, cleaned);

    // force refresh incoming
    setIncoming((prev) => prev.filter((x) => x !== fromId));
  };

  const removeFriend = (friendId) => {
    setFriends((prev) => prev.filter((x) => x !== friendId));
  };

  const handleMessage = (friend) => {
    if (friend?.email) {
      window.location.href = `mailto:${friend.email}?subject=Haylingua`;
    }
  };

  // --- Header nav (embedded to fix “no navigation” on this page) ---
  const NavLink = ({ to, children }) => {
    const active = location.pathname === to;
    return (
      <Link
        to={to}
        className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
          active
            ? "bg-orange-600 text-white"
            : "text-gray-700 hover:bg-gray-100"
        }`}
      >
        {children}
      </Link>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Embedded Header / Navigation (so you can navigate even if layout header is missing) */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-semibold">
            H
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Haylingua</div>
            <div className="text-xs text-gray-500">Friends</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NavLink to="/">Lessons</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/profile">Profile</NavLink>
          <NavLink to="/friends">Friends</NavLink>
        </div>
      </div>

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
          <span className="text-sm font-medium">{friendsList.length} friends</span>
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
          {(incomingList.length + sentList.length) > 0 ? (
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
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
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
        {!getToken() ? (
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
                        onRemove={() => removeFriend(p.id)}
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
                          key={p.id}
                          person={p}
                          mode="incoming"
                          onAccept={() => acceptRequest(p.id)}
                          onDecline={() => declineRequest(p.id)}
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
                          key={p.id}
                          person={p}
                          mode="sent"
                          onCancel={() => cancelRequest(p.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <p className="mt-5 text-[11px] text-gray-400">
                  This “requests” system is frontend-only for now. Once you add
                  a DB table + endpoints, we’ll wire it properly.
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
                      // IFs for button state
                      const isFriend = friends.includes(p.id);
                      const isSent = sent.includes(p.id);
                      const isIncoming = incoming.includes(p.id);

                      return (
                        <PersonCard
                          key={p.id}
                          person={p}
                          mode="discover"
                          // If incoming exists -> show Accept/Decline instead of Send
                          onSend={
                            !isFriend && !isSent && !isIncoming
                              ? () => sendRequest(p.id)
                              : null
                          }
                          onAccept={isIncoming ? () => acceptRequest(p.id) : null}
                          onDecline={isIncoming ? () => declineRequest(p.id) : null}
                          onCancel={isSent ? () => cancelRequest(p.id) : null}
                          isFriend={isFriend}
                          isSent={isSent}
                          isIncoming={isIncoming}
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

/* ---------- UI Card (keeps your nice layout) ---------- */

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

        {/* Actions (with IFs) */}
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
              <button
                onClick={onRemove}
                className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                <UserX className="w-4 h-4" />
                <span>Remove</span>
              </button>
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
              {/* If friend */}
              {isFriend ? (
                <div className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 inline-flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  <span>Friends</span>
                </div>
              ) : null}

              {/* If incoming request -> accept/decline */}
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

              {/* If sent already -> cancel */}
              {!isFriend && !isIncoming && isSent ? (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  <Mail className="w-4 h-4" />
                  <span>Requested</span>
                </button>
              ) : null}

              {/* Otherwise -> send request */}
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

      {/* Stats */}
      <div className="mt-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-orange-50 px-3 py-2 rounded-xl">
          <Trophy className="w-4 h-4 text-orange-600" />
          <span className="text-sm font-medium text-gray-900">
            Lv {person.level}
          </span>
        </div>
        <div className="flex items-center gap-2 bg-yellow-50 px-3 py-2 rounded-xl">
          <Star className="w-4 h-4 text-yellow-600" />
          <span className="text-sm font-medium text-gray-900">
            {person.xp} XP
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
