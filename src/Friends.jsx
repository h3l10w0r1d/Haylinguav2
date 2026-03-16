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
  Star,
  Flame,
  EyeOff,
} from "lucide-react";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  "https://haylinguav2.onrender.com";

function resolveUrl(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("data:")) return s;
  if (s.startsWith("blob:")) return s;
  if (s.startsWith("static/")) return `${API_BASE}/${s}`;
  if (s.startsWith("/static/")) return `${API_BASE}${s}`;
  if (s.startsWith("/")) return `${API_BASE}${s}`;
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
  } catch {}
}

export default function Friends() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("friends");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  const [people, setPeople] = useState([]);
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [sent, setSent] = useState([]);

  const token = getToken();

  useEffect(() => {
    if (!token) { setLoading(false); return; }

    (async () => {
      setLoading(true);
      try {
        const lbRes = await apiFetch("/leaderboard?limit=200", { token, method: "GET" });
        if (lbRes.ok) { const lb = await lbRes.json(); setPeople(Array.isArray(lb) ? lb : []); }
        else setPeople([]);

        const frRes = await apiFetch("/friends", { token, method: "GET" });
        if (frRes.ok) { const fr = await frRes.json(); setFriends(Array.isArray(fr) ? fr : []); }
        else setFriends([]);

        const inRes = await apiFetch("/friends/requests", { token, method: "GET" });
        if (inRes.ok) { const inc = await inRes.json(); setIncoming(Array.isArray(inc) ? inc : []); }
        else setIncoming([]);

        const sentRes = await apiFetch("/friends/requests/sent", { token, method: "GET" });
        if (sentRes.ok) {
          const s = await sentRes.json();
          const normalized = Array.isArray(s)
            ? s.map((x) => ({ id: x.id, email: x.addressee_email || x.email || "", name: x.addressee_name || x.name || null, created_at: x.created_at || null }))
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
      if (frRes.ok) { const fr = await frRes.json(); setFriends(Array.isArray(fr) ? fr : []); }
      if (inRes.ok) { const inc = await inRes.json(); setIncoming(Array.isArray(inc) ? inc : []); }
      if (sentRes.ok) {
        const s = await sentRes.json();
        const normalized = Array.isArray(s)
          ? s.map((x) => ({ id: x.id, email: x.addressee_email || x.email || "", name: x.addressee_name || x.name || null, created_at: x.created_at || null }))
          : [];
        setSent(normalized);
      } else {
        setSent(readSentCache());
      }
    } catch {}
  };

  const friendsList = useMemo(() => {
    return friends
      .map((f) => ({
        id: Number(f.user_id ?? f.id),
        is_hidden: !!f.is_hidden,
        name: f.is_hidden ? "Hidden" : f.name || f.username || "User",
        username: f.is_hidden ? null : (f.username || null),
        avatar_url: f.is_hidden ? null : (f.avatar_url || null),
        level: Number(f.level ?? 1) || 1,
        xp: Number(f.xp ?? 0) || 0,
        streak: Math.max(1, Number(f.streak ?? 1) || 1),
        global_rank: Number(f.global_rank ?? 0),
      }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [friends]);

  const incomingList = useMemo(() => {
    return (incoming || []).map((r) => ({
      request_id: r.id,
      id: Number(r.requester_id),
      name: r.requester_name || r.requester_username || (r.requester_email ? r.requester_email.split("@")[0] : "User"),
      email: r.requester_email || "",
      avatar_url: null,
      username: null,
      level: 1, xp: 0, streak: 1,
      created_at: r.created_at,
    }));
  }, [incoming]);

  const sentList = useMemo(() => {
    return (sent || []).filter((x) => x?.email).map((x) => ({
      request_id: x.id || null,
      id: x.email,
      name: x.name || x.email.split("@")[0],
      email: x.email,
      avatar_url: null,
      username: null,
      level: 1, xp: 0, streak: 0, global_rank: 0,
      created_at: x.created_at || null,
    }));
  }, [sent]);

  const discoverList = useMemo(() => {
    const raw = Array.isArray(people) ? people : [];
    return raw.map((p) => ({
      id: Number(p.user_id ?? p.id),
      is_hidden: !!p.is_hidden,
      username: p.is_hidden ? null : (p.username || null),
      avatar_url: p.is_hidden ? null : (p.avatar_url || null),
      name: p.is_hidden ? "Hidden" : (p.name || (p.email ? p.email.split("@")[0] : "User")),
      email: p.email || "",
      level: Number(p.level ?? 1) || 1,
      xp: p.is_hidden ? 0 : (Number(p.xp ?? 0) || 0),
      streak: p.is_hidden ? 0 : Math.max(1, Number(p.streak ?? 1) || 1),
    })).filter((p) => Number.isFinite(p.id) && p.email);
  }, [people]);

  const applySearch = (list) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) => (p.name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q)
    );
  };

  const sendRequestByEmail = async (email) => {
    if (!token) return;
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail) return;
    if (incomingList.some((r) => r.email.toLowerCase() === cleanEmail)) return;
    if (sentList.some((r) => r.email.toLowerCase() === cleanEmail)) return;

    const res = await apiFetch("/friends/request", {
      token, method: "POST",
      body: JSON.stringify({ query: cleanEmail }),
    });
    if (res.ok) {
      const cached = readSentCache();
      const next = [{ id: null, email: cleanEmail, name: null, created_at: new Date().toISOString() }, ...cached].slice(0, 100);
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
    const res = await apiFetch(`/friends/requests/${requestId}/accept`, { token, method: "POST" });
    if (res.ok) { await refreshFriendsData(); setActiveTab("friends"); }
  };

  const rejectRequest = async (requestId) => {
    if (!token) return;
    const res = await apiFetch(`/friends/requests/${requestId}/reject`, { token, method: "POST" });
    if (res.ok) await refreshFriendsData();
  };

  const cancelSentRequest = (email) => {
    const clean = String(email || "").trim().toLowerCase();
    const cached = readSentCache().filter((x) => (x.email || "").toLowerCase() !== clean);
    writeSentCache(cached);
    setSent(cached);
  };

  // Navigate to public profile — only if username is known
  const openPublicProfile = (person) => {
    if (!person || person.is_hidden) return;
    const u = String(person.username || "").trim();
    if (!u) return;
    navigate(`/u/${encodeURIComponent(u)}`);
  };

  const handleMessage = (friend) => openPublicProfile(friend);

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Friends</h1>
          <p className="text-gray-600 mt-1">Send requests, accept incoming, and learn together.</p>
        </div>
        <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-3 py-2 rounded-xl">
          <Users className="w-4 h-4" />
          <span className="text-sm font-medium">{friendsList.length} friends</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {["friends", "pending", "discover"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              activeTab === tab ? "bg-orange-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {tab === "friends" ? "Your friends" : tab === "pending" ? (
              <>Pending {incomingList.length + sentList.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center text-xs font-semibold bg-white/30 px-2 py-0.5 rounded-full">
                  {incomingList.length + sentList.length}
                </span>
              )}</>
            ) : "Discover"}
          </button>
        ))}
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

      <div className="bg-white rounded-2xl shadow-sm p-6">
        {!token ? (
          <div className="text-center py-10"><p className="text-gray-600">You need to be logged in to use Friends.</p></div>
        ) : loading ? (
          <div className="text-center py-10">
            <div className="animate-spin w-8 h-8 border-4 border-orange-200 border-t-orange-600 rounded-full mx-auto mb-4" />
            <p className="text-gray-600">Loading…</p>
          </div>
        ) : (
          <>
            {activeTab === "friends" && (
              <>
                {applySearch(friendsList).length === 0 ? (
                  <div className="text-center py-10">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No friends yet</h3>
                    <p className="text-gray-600 mb-6">Go to Discover and send a friend request.</p>
                    <button onClick={() => setActiveTab("discover")} className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors font-medium">
                      Discover people
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {applySearch(friendsList).map((p) => (
                      <PersonCard key={p.id} person={p} mode="friend"
                        onOpenProfile={() => openPublicProfile(p)}
                        onMessage={() => handleMessage(p)}
                        onRemove={null}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === "pending" && (
              <>
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Inbox className="w-4 h-4 text-gray-700" />
                    <h3 className="text-sm font-semibold text-gray-900">Incoming requests</h3>
                    {incomingList.length > 0 && <span className="text-xs font-semibold bg-gray-100 px-2 py-0.5 rounded-full">{incomingList.length}</span>}
                  </div>
                  {applySearch(incomingList).length === 0 ? (
                    <div className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4">No incoming requests.</div>
                  ) : (
                    <div className="grid gap-4">
                      {applySearch(incomingList).map((p) => (
                        <PersonCard key={p.request_id} person={p} mode="incoming"
                          onOpenProfile={() => openPublicProfile(p)}
                          onAccept={() => acceptRequest(p.request_id)}
                          onDecline={() => rejectRequest(p.request_id)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Send className="w-4 h-4 text-gray-700" />
                    <h3 className="text-sm font-semibold text-gray-900">Sent requests</h3>
                    {sentList.length > 0 && <span className="text-xs font-semibold bg-gray-100 px-2 py-0.5 rounded-full">{sentList.length}</span>}
                  </div>
                  {applySearch(sentList).length === 0 ? (
                    <div className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4">No sent requests.</div>
                  ) : (
                    <div className="grid gap-4">
                      {applySearch(sentList).map((p) => (
                        <PersonCard key={`${p.email}-${p.request_id ?? "x"}`} person={p} mode="sent"
                          onOpenProfile={() => openPublicProfile(p)}
                          onCancel={() => cancelSentRequest(p.email)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === "discover" && (
              <>
                {applySearch(discoverList).length === 0 ? (
                  <div className="text-center py-10">
                    <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No people found</h3>
                    <p className="text-gray-600">Try a different search term.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {applySearch(discoverList).map((p) => {
                      const isFriend = friendsList.some((f) => f.email === p.email);
                      const isIncoming = incomingList.some((r) => r.email === p.email);
                      const isSent = sentList.some((r) => r.email === p.email);
                      return (
                        <PersonCard key={p.id} person={p} mode="discover"
                          onOpenProfile={() => openPublicProfile(p)}
                          isFriend={isFriend} isIncoming={isIncoming} isSent={isSent}
                          onSend={!isFriend && !isIncoming && !isSent ? () => sendRequestByEmail(p.email) : null}
                          onAccept={isIncoming ? () => { const req = incomingList.find((r) => r.email === p.email); if (req?.request_id) acceptRequest(req.request_id); } : null}
                          onDecline={isIncoming ? () => { const req = incomingList.find((r) => r.email === p.email); if (req?.request_id) rejectRequest(req.request_id); } : null}
                          onCancel={isSent ? () => cancelSentRequest(p.email) : null}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PersonCard({ person, mode, onOpenProfile, onSend, onAccept, onDecline, onCancel, onMessage, onRemove, isFriend, isSent, isIncoming }) {
  const initial = (person?.name?.[0] || person?.email?.[0] || "U").toUpperCase().trim();
  const isHidden = !!person?.is_hidden;
  const avatarSrc = !isHidden ? resolveUrl(person?.avatar_url) : "";
  const canNavigate = !isHidden && !!person?.username;
  const streak = Math.max(1, Number(person?.streak ?? 1) || 1);

  return (
    <div
      className={`p-4 border border-gray-100 rounded-2xl transition-colors ${
        isHidden ? "opacity-80" : canNavigate ? "hover:border-orange-200 cursor-pointer" : ""
      }`}
      onClick={() => canNavigate ? onOpenProfile?.() : null}
      role={canNavigate ? "button" : undefined}
      tabIndex={canNavigate ? 0 : undefined}
      onKeyDown={(e) => { if (canNavigate && (e.key === "Enter" || e.key === " ")) onOpenProfile?.(); }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white font-semibold overflow-hidden flex-shrink-0">
            {isHidden ? (
              <EyeOff className="w-5 h-5" />
            ) : avatarSrc ? (
              <img
                src={avatarSrc}
                alt="Avatar"
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            ) : (
              initial
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{isHidden ? "Hidden" : person.name}</h3>
            <p className="text-sm text-gray-500">
              {isHidden ? "This user is hidden" : (person.username ? `@${person.username}` : (person.email || ""))}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mode === "friend" && (
            <>
              <button onClick={(e) => { e.stopPropagation(); onMessage?.(); }} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors" title="Message">
                <MessageCircle className="w-5 h-5" />
              </button>
              {onRemove && (
                <button onClick={(e) => { e.stopPropagation(); onRemove?.(); }} className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200">
                  <UserX className="w-4 h-4" /><span>Remove</span>
                </button>
              )}
            </>
          )}

          {mode === "incoming" && (
            <>
              <button onClick={(e) => { e.stopPropagation(); onDecline?.(); }} className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200">
                <UserX className="w-4 h-4" /><span>Decline</span>
              </button>
              <button onClick={(e) => { e.stopPropagation(); onAccept?.(); }} className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-orange-600 text-white hover:bg-orange-700">
                <UserCheck className="w-4 h-4" /><span>Accept</span>
              </button>
            </>
          )}

          {mode === "sent" && (
            <button onClick={(e) => { e.stopPropagation(); onCancel?.(); }} className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200">
              <Mail className="w-4 h-4" /><span>Cancel</span>
            </button>
          )}

          {mode === "discover" && (
            <>
              {isFriend && <div className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 inline-flex items-center gap-2"><UserCheck className="w-4 h-4" /><span>Friends</span></div>}
              {!isFriend && isIncoming && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); onDecline?.(); }} className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200"><UserX className="w-4 h-4" /><span>Decline</span></button>
                  <button onClick={(e) => { e.stopPropagation(); onAccept?.(); }} className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-orange-600 text-white hover:bg-orange-700"><UserCheck className="w-4 h-4" /><span>Accept</span></button>
                </>
              )}
              {!isFriend && !isIncoming && isSent && (
                <button onClick={(e) => { e.stopPropagation(); onCancel?.(); }} className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200"><Mail className="w-4 h-4" /><span>Requested</span></button>
              )}
              {!isFriend && !isIncoming && !isSent && (
                <button onClick={(e) => { e.stopPropagation(); onSend?.(); }} className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 bg-orange-600 text-white hover:bg-orange-700"><UserPlus className="w-4 h-4" /><span>Send request</span></button>
              )}
            </>
          )}
        </div>
      </div>

      {!isHidden && (
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-orange-50 px-3 py-2 rounded-xl">
            <Trophy className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-medium text-gray-900">Lv {Number(person.level ?? 1) || 1}</span>
          </div>
          <div className="flex items-center gap-2 bg-yellow-50 px-3 py-2 rounded-xl">
            <Star className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium text-gray-900">{Number(person.xp ?? 0) || 0} XP</span>
          </div>
          <div className="flex items-center gap-2 bg-red-50 px-3 py-2 rounded-xl">
            <Flame className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-gray-900">{streak} day streak</span>
          </div>
        </div>
      )}
    </div>
  );
}
