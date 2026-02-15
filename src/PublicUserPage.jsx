import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch, getToken } from "./api";

export default function PublicUserPage() {
  const { username } = useParams();
  // Public pages should load without auth. If user is logged in,
  // we attach Bearer token to unlock friend actions + extra fields.
  const token = getToken();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [friendState, setFriendState] = useState(null); // none | requested | friends
  const [busy, setBusy] = useState(false);

  const initials = useMemo(() => {
    const name = user?.display_name || user?.username || "?";
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("");
  }, [user]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const u = token
          ? await apiFetch(`/users/${encodeURIComponent(username)}`, { token })
          : await apiFetch(`/users/${encodeURIComponent(username)}`);
        if (!alive) return;
        setUser(u);
        setStats(u?.stats || null);
        setFriendState(u?.friend_state || null);
      } catch (e) {
        if (!alive) return;
        setErr(e?.detail || e?.message || "Failed to load profile");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [username, token]);

  async function sendRequest() {
    if (!token || !user?.id) return;
    try {
      setBusy(true);
      await apiFetch(`/friends/requests`, {
        method: "POST",
        token,
        body: { target_user_id: user.id },
      });
      setFriendState("requested");
    } catch (e) {
      setErr(e?.detail || e?.message || "Failed to send request");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="opacity-80 font-extrabold">Loading…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white p-6">
        <div className="max-w-xl w-full rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-black">Profile unavailable</div>
          <div className="mt-2 text-sm text-white/80">{err}</div>
          <div className="mt-4">
            <Link
              to="/"
              className="inline-flex rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-extrabold hover:bg-white/15"
            >
              Back home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const bg = user?.profile?.bg || "#0b1020";

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: `radial-gradient(1200px 600px at 15% 15%, rgba(125, 211, 252, 0.20), transparent 60%), radial-gradient(900px 500px at 85% 25%, rgba(167, 139, 250, 0.18), transparent 55%), ${bg}`,
      }}
    >
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl border border-white/15 bg-white/10 flex items-center justify-center font-black">
              {initials}
            </div>
            <div>
              <div className="text-2xl font-black leading-tight">
                {user?.display_name || user?.username}
              </div>
              <div className="text-sm text-white/80">
                @{user?.username}
                {typeof user?.rank === "number" ? ` • Rank #${user.rank}` : ""}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {token ? (
              <button
                disabled={busy || !friendState || friendState === "friends"}
                onClick={sendRequest}
                className={`rounded-xl px-4 py-2 text-sm font-extrabold border transition ${
                  friendState === "friends"
                    ? "border-emerald-300/30 bg-emerald-400/15"
                    : friendState === "requested"
                    ? "border-white/15 bg-white/10"
                    : "border-white/15 bg-white/10 hover:bg-white/15"
                } ${busy || !friendState || friendState === "friends" ? "opacity-70" : ""}`}
              >
                {friendState === "friends"
                  ? "Friends"
                  : friendState === "requested"
                  ? "Request sent"
                  : "Add friend"}
              </button>
            ) : null}

            {me ? (
              <Link
                to="/profile"
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-extrabold hover:bg-white/15"
              >
                My profile
              </Link>
            ) : (
              <Link
                to="/login"
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-extrabold hover:bg-white/15"
              >
                Log in
              </Link>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="mb-3 text-base font-black">Overview</div>
            <div className="flex flex-wrap gap-3">
              <StatCard label="XP" value={stats?.xp_total ?? "—"} />
              <StatCard label="Level" value={stats?.level ?? "—"} />
              <StatCard label="Streak" value={stats?.streak_days ?? "—"} />
              <StatCard label="Lessons" value={stats?.lessons_completed ?? "—"} />
            </div>
            <div className="mt-4 text-sm text-white/75">
              Public page. Private settings (email, password, 2FA) are available only on your own Profile page after login.
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="mb-2 text-base font-black">Share</div>
            <div className="mb-3 text-sm text-white/80">Share this profile link:</div>
            <div className="rounded-xl border border-white/10 bg-black/25 p-3 font-mono text-xs break-all">
              {`https://www.haylingua.am/u/${user?.username || username}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="min-w-[140px] rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="text-xs font-extrabold text-white/70">{label}</div>
      <div className="mt-1 text-2xl font-black">{String(value)}</div>
    </div>
  );
}
