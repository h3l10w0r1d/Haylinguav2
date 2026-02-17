import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "./api";

export default function PublicUserPage({ token }) {
  const { username } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [busyAction, setBusyAction] = useState(false);

  const isMe = useMemo(() => {
    const me = localStorage.getItem("username") || "";
    return me.toLowerCase() === (username || "").toLowerCase();
  }, [username]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!username) return;
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch(`/users/${encodeURIComponent(username)}`, { token });
        if (!cancelled) setProfile(data);
      } catch (e) {
        if (!cancelled) setError(e?.message || "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token, username]);

  async function doFriendAction(kind) {
    if (!profile || busyAction) return;
    try {
      setBusyAction(true);
      if (kind === "add") {
        await apiFetch("/friends/request", {
          method: "POST",
          token,
          body: { to_username: profile.username },
        });
      } else if (kind === "accept") {
        await apiFetch("/friends/accept", {
          method: "POST",
          token,
          body: { from_username: profile.username },
        });
      } else if (kind === "decline") {
        await apiFetch("/friends/decline", {
          method: "POST",
          token,
          body: { from_username: profile.username },
        });
      }
      const data = await apiFetch(`/users/${encodeURIComponent(username)}`, { token });
      setProfile(data);
    } catch (e) {
      setError(e?.message || "Action failed");
    } finally {
      setBusyAction(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Inside-page indicator (header stays global) */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">You are here</div>
            <div className="text-lg font-semibold">Profile</div>
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse rounded-2xl bg-slate-900 p-6">Loading…</div>
        ) : error ? (
          <div className="rounded-2xl border border-red-800 bg-red-950/40 p-6">
            {String(error)}
          </div>
        ) : !profile ? (
          <div className="rounded-2xl bg-slate-900 p-6">Not found.</div>
        ) : (
          <div className="space-y-6">
            {/* Hero banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-orange-950/40 p-6 shadow">
              <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
              <div className="pointer-events-none absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />

              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <img
                    src={profile.avatar_url || "/avatars/default-1.svg"}
                    alt="avatar"
                    className="h-20 w-20 rounded-2xl bg-slate-800 object-cover ring-1 ring-white/10"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-2xl font-semibold">
                      {profile.name || profile.username}
                    </div>
                    <div className="truncate text-sm text-slate-400">@{profile.username}</div>
                    {profile.joined_at ? (
                      <div className="mt-1 text-xs text-slate-500">
                        Joined {new Date(profile.joined_at).toLocaleDateString()}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Friend actions must live on hero */}
                {!isMe ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {profile.friendship === "friends" ? (
                      <span className="rounded-full bg-emerald-900/40 px-3 py-1 text-sm text-emerald-200 ring-1 ring-emerald-500/20">
                        Friends
                      </span>
                    ) : profile.friendship === "incoming_pending" ? (
                      <>
                        <button
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                          onClick={() => doFriendAction("accept")}
                          disabled={busyAction}
                        >
                          Confirm
                        </button>
                        <button
                          className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold hover:bg-slate-700 disabled:opacity-60"
                          onClick={() => doFriendAction("decline")}
                          disabled={busyAction}
                        >
                          Decline
                        </button>
                      </>
                    ) : profile.friendship === "outgoing_pending" ? (
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-200 ring-1 ring-white/10">
                        Request sent
                      </span>
                    ) : (
                      <button
                        className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-orange-400 disabled:opacity-60"
                        onClick={() => doFriendAction("add")}
                        disabled={busyAction}
                      >
                        Add friend
                      </button>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <HeroStat label="Total XP" value={profile.total_xp ?? 0} />
                <HeroStat label="Lessons" value={profile.lessons_completed ?? 0} />
                <HeroStat label="Streak" value={profile.streak ?? 0} />
                <HeroStat label="Friends" value={profile.friends_count ?? 0} />
              </div>

              {profile.bio ? (
                <div className="relative mt-5 max-w-3xl text-sm text-slate-300">
                  {profile.bio}
                </div>
              ) : null}
            </div>

            {/* Top friends feed */}
            <div className="rounded-3xl bg-slate-900 p-6 shadow">
              <div className="mb-4">
                <div className="text-sm font-semibold">Top friends</div>
                <div className="text-xs text-slate-500">
                  The 3 friends with the highest XP
                </div>
              </div>
              {profile.top_friends?.length ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {profile.top_friends.slice(0, 3).map((f) => (
                    <a
                      key={f.username}
                      href={`/u/${encodeURIComponent(f.username)}`}
                      className="group rounded-2xl bg-slate-950/50 p-4 ring-1 ring-white/10 transition hover:bg-slate-950/70"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={f.avatar_url || "/avatars/default-1.svg"}
                          alt="avatar"
                          className="h-12 w-12 rounded-xl bg-slate-800 object-cover"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold group-hover:text-white">
                            {f.display_name || f.username}
                          </div>
                          <div className="truncate text-xs text-slate-400">@{f.username}</div>
                        </div>
                      </div>
                      <div className="mt-4 flex items-baseline justify-between">
                        <div className="text-xs text-slate-500">XP</div>
                        <div className="text-lg font-semibold">{f.xp ?? 0}</div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-400">No friends yet.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HeroStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-950/40 p-4 ring-1 ring-white/10">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
