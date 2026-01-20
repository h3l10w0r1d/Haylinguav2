// src/Friends.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Users,
  UserPlus,
  UserCheck,
  Search,
  MessageCircle,
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

// --- Local friends storage (MVP) ---
const LS_KEY = "hay_friends_v1"; // store as array of user_ids (numbers)

function readLocalFriends() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = JSON.parse(raw || "[]");
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => Number(x)).filter((x) => Number.isFinite(x));
  } catch {
    return [];
  }
}

function writeLocalFriends(ids) {
  localStorage.setItem(LS_KEY, JSON.stringify(ids));
}

export default function Friends() {
  const [activeTab, setActiveTab] = useState("friends"); // 'friends' | 'discover'
  const [searchTerm, setSearchTerm] = useState("");

  const [me, setMe] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  const [friendIds, setFriendIds] = useState(() => readLocalFriends());

  // keep localStorage synced
  useEffect(() => {
    writeLocalFriends(friendIds);
  }, [friendIds]);

  // Load ME + leaderboard
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        // who am I
        const meRes = await apiFetch("/me", { token, method: "GET" });
        if (meRes.ok) {
          const meData = await meRes.json();
          setMe(meData);
        }

        // use leaderboard as "discover people" list
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

  // Map leaderboard users -> friend cards
  const allPeople = useMemo(() => {
    const myId = Number(me?.id);

    return (leaderboard || [])
      .map((u) => {
        const id = Number(u.user_id ?? u.id);
        const email = u.email || "";
        const name =
          (u.name && String(u.name).trim()) ||
          (email.includes("@") ? email.split("@")[0] : "User");

        const xp = Number(u.xp ?? u.total_xp ?? 0) || 0;
        const streak = Math.max(1, Number(u.streak ?? 0) || 0); // never 0
        const level = Math.max(1, Number(u.level ?? 1) || 1);

        return {
          id,
          name,
          email,
          xp,
          level,
          streak,
          isFriend: friendIds.includes(id),
        };
      })
      .filter((p) => Number.isFinite(p.id) && p.id !== myId); // exclude myself
  }, [leaderboard, me?.id, friendIds]);

  const friends = useMemo(() => allPeople.filter((p) => p.isFriend), [allPeople]);
  const discover = useMemo(() => allPeople.filter((p) => !p.isFriend), [allPeople]);

  const filteredFriends = useMemo(() => {
    if (!searchTerm.trim()) return friends;
    const q = searchTerm.toLowerCase();
    return friends.filter(
      (p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
    );
  }, [friends, searchTerm]);

  const filteredDiscover = useMemo(() => {
    if (!searchTerm.trim()) return discover;
    const q = searchTerm.toLowerCase();
    return discover.filter(
      (p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
    );
  }, [discover, searchTerm]);

  const handleToggleFriend = (userId) => {
    setFriendIds((prev) => {
      if (prev.includes(userId)) return prev.filter((x) => x !== userId);
      return [...prev, userId];
    });
  };

  // "message" MVP
  const handleMessage = (friend) => {
    // for now just mailto; later connect to real chat/DM
    if (friend?.email) {
      window.location.href = `mailto:${friend.email}?subject=Haylingua`;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Friends</h1>
          <p className="text-gray-600 mt-1">
            Learn together. Compare progress. Stay motivated.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-3 py-2 rounded-xl">
          <Users className="w-4 h-4" />
          <span className="text-sm font-medium">{friends.length} friends</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
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

      {/* Content */}
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
            <p className="text-gray-600">Loading friends…</p>
          </div>
        ) : (
          <>
            {/* Friends list */}
            {activeTab === "friends" && (
              <>
                {filteredFriends.length === 0 ? (
                  <div className="text-center py-10">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No friends yet
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Add people from Discover to start comparing progress.
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
                    {filteredFriends.map((friend) => (
                      <div
                        key={friend.id}
                        className="p-4 border border-gray-100 rounded-2xl hover:border-orange-200 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-semibold">
                              {friend.name?.[0]?.toUpperCase() || "U"}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">
                                {friend.name}
                              </h3>
                              <p className="text-sm text-gray-500">{friend.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleMessage(friend)}
                              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                              title="Message"
                            >
                              <MessageCircle className="w-5 h-5" />
                            </button>

                            <button
                              onClick={() => handleToggleFriend(friend.id)}
                              className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200"
                            >
                              <UserCheck className="w-4 h-4" />
                              <span>Friends</span>
                            </button>
                          </div>
                        </div>

                        {/* Stats row */}
                        <div className="mt-4 flex flex-wrap gap-3">
                          <div className="flex items-center gap-2 bg-orange-50 px-3 py-2 rounded-xl">
                            <Trophy className="w-4 h-4 text-orange-600" />
                            <span className="text-sm font-medium text-gray-900">
                              Lv {friend.level}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 bg-yellow-50 px-3 py-2 rounded-xl">
                            <Star className="w-4 h-4 text-yellow-600" />
                            <span className="text-sm font-medium text-gray-900">
                              {friend.xp} XP
                            </span>
                          </div>
                          <div className="flex items-center gap-2 bg-red-50 px-3 py-2 rounded-xl">
                            <Flame className="w-4 h-4 text-red-600" />
                            <span className="text-sm font-medium text-gray-900">
                              {friend.streak} day streak
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Invite CTA */}
                {friends.length > 0 && (
                  <div className="mt-6 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-2xl p-8 text-center">
                    <h3 className="mb-2 font-semibold">
                      Invite Friends to Haylingua
                    </h3>
                    <p className="text-orange-100 mb-6 text-sm">
                      Learning is better with friends! Share your invite link.
                    </p>
                    <button
                      className="px-6 py-3 bg-white text-orange-600 rounded-xl hover:bg-gray-100 transition-colors font-medium"
                      onClick={() => {
                        const url = window.location.origin;
                        navigator.clipboard?.writeText(url).catch(() => {});
                      }}
                    >
                      Copy site link
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Discover list */}
            {activeTab === "discover" && (
              <>
                {filteredDiscover.length === 0 ? (
                  <div className="text-center py-10">
                    <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No people found
                    </h3>
                    <p className="text-gray-600">
                      Try a different search term.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {filteredDiscover.map((person) => (
                      <div
                        key={person.id}
                        className="p-4 border border-gray-100 rounded-2xl hover:border-orange-200 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-semibold">
                              {person.name?.[0]?.toUpperCase() || "U"}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">
                                {person.name}
                              </h3>
                              <p className="text-sm text-gray-500">{person.email}</p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleToggleFriend(person.id)}
                            className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-orange-600 text-white hover:bg-orange-700"
                          >
                            <UserPlus className="w-4 h-4" />
                            <span>Add</span>
                          </button>
                        </div>

                        {/* Stats row */}
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
                              {person.streak} day streak
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="mt-4 text-[11px] text-gray-400">
                  Note: Friends are stored locally for now (frontend-only). Once
                  you add a real friends table + endpoints, we’ll wire this to
                  the backend.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
