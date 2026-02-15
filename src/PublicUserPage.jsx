import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch, getToken } from "./api";

// Public, shareable profile: /u/:username
export default function PublicUserPage() {
  const { username } = useParams();
  const token = useMemo(() => getToken(), []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [friendState, setFriendState] = useState(null); // none | requested | friends
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const u = await apiFetch(`/users/${encodeURIComponent(username)}`);
        if (!alive) return;
        setUser(u);
        // stats endpoint is protected by token; only fetch if logged in
        if (token && u?.email) {
          try {
            const s = await apiFetch(`/me/stats?email=${encodeURIComponent(u.email)}`, { token });
            if (alive) setStats(s);
          } catch {
            // ignore
          }
        }
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load profile");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [username, token]);

  useEffect(() => {
    // Determine friend state (only if logged in)
    if (!token || !user?.id) return;
    let alive = true;
    (async () => {
      try {
        const myFriends = await apiFetch("/friends", { token });
        if (!alive) return;
        const isFriend = Array.isArray(myFriends)
          ? myFriends.some((f) => String(f.id) === String(user.id))
          : false;
        if (isFriend) {
          setFriendState("friends");
          return;
        }
        const sent = await apiFetch("/friends/requests/sent", { token });
        if (!alive) return;
        const requested = Array.isArray(sent)
          ? sent.some((r) => String(r.to_user_id) === String(user.id))
          : false;
        setFriendState(requested ? "requested" : "none");
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, user?.id]);

  async function sendFriendRequest() {
    if (!token || !user?.id) return;
    setBusy(true);
    try {
      await apiFetch("/friends/requests", {
        method: "POST",
        token,
        body: { to_user_id: user.id },
      });
      setFriendState("requested");
    } catch (e) {
      setErr(e?.message || "Failed to send request");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
        <div style={{ opacity: 0.7 }}>Loading profile…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Profile unavailable</div>
        <div style={{ opacity: 0.85, marginBottom: 16 }}>{err}</div>
        <Link to="/" style={{ color: "#6aa6ff" }}>Go home</Link>
      </div>
    );
  }

  const displayName = user?.username || user?.name || "User";

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "rgba(255,255,255,0.08)",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 18,
            }}
            aria-label="Avatar"
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              (displayName || "U").slice(0, 1).toUpperCase()
            )}
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.1 }}>{displayName}</div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>@{user?.username || username}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Link
            to="/leaderboard"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.08)",
              color: "inherit",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Leaderboard
          </Link>
          {token ? (
            friendState === "friends" ? (
              <span
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "rgba(76, 175, 80, 0.2)",
                  border: "1px solid rgba(76, 175, 80, 0.35)",
                  fontWeight: 800,
                }}
              >
                Friends ✓
              </span>
            ) : friendState === "requested" ? (
              <span
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.08)",
                  fontWeight: 800,
                  opacity: 0.9,
                }}
              >
                Request sent
              </span>
            ) : (
              <button
                onClick={sendFriendRequest}
                disabled={busy}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "none",
                  background: "#4e7cff",
                  color: "white",
                  fontWeight: 900,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                Add friend
              </button>
            )
          ) : (
            <Link
              to="/"
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.08)",
                color: "inherit",
                textDecoration: "none",
                fontWeight: 800,
              }}
            >
              Log in
            </Link>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: 16,
        }}
      >
        <div
          style={{
            gridColumn: "span 8",
            padding: 16,
            borderRadius: 16,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Overview</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <StatCard label="XP" value={stats?.xp_total ?? "—"} />
            <StatCard label="Level" value={stats?.level ?? "—"} />
            <StatCard label="Streak" value={stats?.streak_days ?? "—"} />
            <StatCard label="Lessons" value={stats?.lessons_completed ?? "—"} />
          </div>

          <div style={{ marginTop: 14, opacity: 0.75, fontSize: 13 }}>
            This page is public. Your private settings (email, password, 2FA) live in your own Profile
            page after login.
          </div>
        </div>

        <div
          style={{
            gridColumn: "span 4",
            padding: 16,
            borderRadius: 16,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Share</div>
          <div style={{ opacity: 0.8, fontSize: 13, marginBottom: 10 }}>
            Share this profile link:
          </div>
          <div
            style={{
              padding: 10,
              borderRadius: 12,
              background: "rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.10)",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
              fontSize: 12,
              wordBreak: "break-all",
            }}
          >
            {`https://www.haylingua.am/u/${user?.username || username}`}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div
      style={{
        minWidth: 140,
        padding: 12,
        borderRadius: 14,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      <div style={{ opacity: 0.75, fontSize: 12, fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 950, marginTop: 4 }}>{String(value)}</div>
    </div>
  );
}
