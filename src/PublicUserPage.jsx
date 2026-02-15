import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch, getToken, safeJsonParse } from "./api";
import { Trophy, Star, Flame, Users, UserPlus } from "lucide-react";

export default function PublicUserPage() {
  const { username } = useParams();
  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setErr("Please log in to view profiles.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr("");
      try {
        const res = await apiFetch(`/users/${encodeURIComponent(username)}`, {
          token,
          method: "GET",
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(t || `Failed to load user (${res.status})`);
        }
        const data = await safeJsonParse(res);
        if (cancelled) return;
        setUser(data);

        const fr = await apiFetch(
          `/users/${encodeURIComponent(username)}/friends`,
          { token, method: "GET" }
        );
        if (fr.ok) {
          const fdata = await safeJsonParse(fr);
          if (!cancelled) setFriends(Array.isArray(fdata) ? fdata : []);
        } else {
          // private friends list is fine
          setFriends([]);
        }
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [username]);

  const theme = user?.profile_theme || {};
  const bg = theme?.background || "#0b0b0f";
  const accent = theme?.accent || "#f97316"; // orange

  const level = useMemo(() => Math.max(1, user?.level || 1), [user]);
  const xp = useMemo(() => Number(user?.xp || 0), [user]);
  const streak = useMemo(() => Math.max(1, Number(user?.streak || 1)), [user]);

  const handleAddFriend = async () => {
    const token = getToken();
    if (!token || !user?.username) return;
    setAdding(true);
    try {
      const res = await apiFetch("/friends/requests", {
        token,
        method: "POST",
        body: JSON.stringify({ query: user.username }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || "Failed to send friend request");
      }
      // light UX feedback
      alert("Friend request sent!");
    } catch (e) {
      alert(e?.message || "Failed to send friend request");
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-gray-600">Loading profile…</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-red-600">{err}</p>
        <div className="mt-4">
          <Link to="/" className="text-orange-600 hover:underline">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-[calc(100vh-64px)]">
      <div
        className="w-full"
        style={{
          background: `radial-gradient(1200px 600px at 20% 10%, ${accent}33, transparent 60%), radial-gradient(1000px 500px at 80% 0%, #ffffff22, transparent 55%), ${bg}`,
        }}
      >
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="bg-white/90 backdrop-blur rounded-3xl shadow-sm p-6 md:p-7 border border-white/60">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white text-2xl font-semibold overflow-hidden shadow">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (user.name || "U")[0]?.toUpperCase()
                  )}
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
                    {user.name}
                  </h1>
                  <p className="text-sm text-gray-500">
                    @{user.username || "user"} • Global rank #{user.global_rank}
                  </p>
                  {user.bio ? (
                    <p className="mt-2 text-sm text-gray-700 max-w-2xl">
                      {user.bio}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {!user.is_friend ? (
                  <button
                    onClick={handleAddFriend}
                    disabled={adding || !user.username}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-orange-600 text-white font-semibold text-sm hover:bg-orange-700 disabled:opacity-60"
                  >
                    <UserPlus className="w-4 h-4" />
                    {adding ? "Sending…" : "Add friend"}
                  </button>
                ) : (
                  <Link
                    to="/friends"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-orange-50 text-orange-700 font-semibold text-sm hover:bg-orange-100"
                  >
                    <Users className="w-4 h-4" />
                    Friends
                  </Link>
                )}

                <Link
                  to="/leaderboard"
                  className="px-4 py-2.5 rounded-2xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200"
                >
                  Leaderboard
                </Link>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-orange-50 p-3 text-center">
                <Trophy className="w-4 h-4 text-orange-600 mx-auto mb-1" />
                <div className="text-sm font-semibold text-gray-900">Lv {level}</div>
                <div className="text-[11px] text-gray-500">Level</div>
              </div>
              <div className="rounded-2xl bg-yellow-50 p-3 text-center">
                <Star className="w-4 h-4 text-yellow-600 mx-auto mb-1" />
                <div className="text-sm font-semibold text-gray-900">{xp}</div>
                <div className="text-[11px] text-gray-500">XP</div>
              </div>
              <div className="rounded-2xl bg-red-50 p-3 text-center">
                <Flame className="w-4 h-4 text-red-600 mx-auto mb-1" />
                <div className="text-sm font-semibold text-gray-900">{streak}</div>
                <div className="text-[11px] text-gray-500">Streak</div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white/90 backdrop-blur rounded-3xl shadow-sm p-6 border border-white/60">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Friends</h2>
              <p className="text-sm text-gray-500">{user.friends_count} total</p>
            </div>

            {friends.length ? (
              <div className="mt-4 grid md:grid-cols-2 gap-3">
                {friends.slice(0, 8).map((f) => (
                  <Link
                    key={f.user_id}
                    to={f.username ? `/u/${f.username}` : "#"}
                    className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white flex items-center justify-center font-semibold overflow-hidden">
                        {f.avatar_url ? (
                          <img
                            src={f.avatar_url}
                            alt={f.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (f.name || "U")[0]?.toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {f.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          #{f.global_rank} • Lv {f.level}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">
                        {f.xp} XP
                      </div>
                      <div className="text-xs text-gray-500">{f.streak} day</div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-600">
                Friends list is empty or private.
              </p>
            )}

            {friends.length > 8 ? (
              <div className="mt-4">
                <Link to="/friends" className="text-orange-600 hover:underline">
                  See all friends
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
