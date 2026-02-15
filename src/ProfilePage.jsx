import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, getToken } from "./api";

export default function ProfilePage() {
  const token = useMemo(() => getToken(), []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);

  const [tab, setTab] = useState("overview");

  // edit state
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const p = await apiFetch("/me/profile", { token });
        if (!alive) return;
        setProfile(p);
        setName(p?.name || "");
        setAvatarUrl(p?.avatar_url || "");

        if (p?.email) {
          try {
            const s = await apiFetch(`/me/stats?email=${encodeURIComponent(p.email)}`, { token });
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
  }, [token]);

  // Stats field names evolved over time; support multiple variants.
  const totalXp =
    (stats?.total_xp ?? stats?.xp_total ?? stats?.xp ?? stats?.totalXp ?? 0) || 0;
  const streakDays =
    (stats?.streak ?? stats?.streak_days ?? stats?.day_streak ?? stats?.streakDays ?? 0) || 0;
  const lessonsCompleted =
    (stats?.lessons_completed ??
      stats?.lessonsCompleted ??
      stats?.completed_lessons ??
      0) || 0;
  const level =
    (stats?.level ?? stats?.lvl ?? Math.max(1, Math.floor(totalXp / 100) + 1)) || 1;

  async function saveProfile() {
    setSaving(true);
    setSaved(false);
    setErr("");
    try {
      const updated = await apiFetch("/me/profile", {
        method: "PUT",
        token,
        body: { name: name.trim(), avatar_url: avatarUrl.trim() || null },
      });
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e) {
      setErr(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ opacity: 0.75 }}>Loading…</div>
      </div>
    );
  }

  const username = profile?.username || "";
  const displayName = profile?.username || profile?.name || "User";

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "rgba(255,255,255,0.08)",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 950,
            }}
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              (displayName || "U").slice(0, 1).toUpperCase()
            )}
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 950, lineHeight: 1.1 }}>{displayName}</div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>{username ? `@${username}` : profile?.email}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {username ? (
            <Link
              to={`/u/${encodeURIComponent(username)}`}
              style={pillBtn("rgba(255,255,255,0.08)")}
            >
              View public page
            </Link>
          ) : null}
          <Link to="/friends" style={pillBtn("rgba(255,255,255,0.08)")}>Friends</Link>
          <Link to="/leaderboard" style={pillBtn("rgba(255,255,255,0.08)")}>Leaderboard</Link>
        </div>
      </div>

      {err ? (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            background: "rgba(255, 82, 82, 0.12)",
            border: "1px solid rgba(255, 82, 82, 0.25)",
          }}
        >
          {err}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        <TabBtn active={tab === "overview"} onClick={() => setTab("overview")}>Overview</TabBtn>
        <TabBtn active={tab === "account"} onClick={() => setTab("account")}>Account</TabBtn>
        <TabBtn active={tab === "security"} onClick={() => setTab("security")}>Security</TabBtn>
      </div>

      {tab === "overview" ? (
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 16 }}>
          <Card colSpan={8} title="Your progress">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Stat label="XP" value={totalXp || "—"} />
              <Stat label="Level" value={level || "—"} />
              <Stat label="Streak" value={streakDays || "—"} />
              <Stat label="Lessons" value={lessonsCompleted || "—"} />
            </div>
          </Card>

          <Card colSpan={4} title="Public profile">
            <div style={{ opacity: 0.85, fontSize: 13, lineHeight: 1.35 }}>
              Your public page is what other people see on leaderboards and when they open your link.
            </div>
            <div style={{ marginTop: 10 }}>
              {username ? (
                <Link to={`/u/${encodeURIComponent(username)}`} style={pillBtn("#4e7cff")}>Open public page</Link>
              ) : (
                <div style={{ opacity: 0.7, fontSize: 13 }}>No username found.</div>
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "account" ? (
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 16 }}>
          <Card colSpan={7} title="Personal details">
            <Field label="Display name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                style={inputStyle}
              />
            </Field>

            <Field label="Avatar URL">
              <input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…"
                style={inputStyle}
              />
              <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
                Uploading files directly isn’t enabled yet. For now, paste an image URL.
              </div>
            </Field>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                onClick={saveProfile}
                disabled={saving}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: "#4e7cff",
                  color: "white",
                  fontWeight: 950,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              {saved ? <span style={{ opacity: 0.85, fontWeight: 800 }}>Saved ✓</span> : null}
            </div>
          </Card>

          <Card colSpan={5} title="Email">
            <div style={{ opacity: 0.85, fontSize: 13, lineHeight: 1.35 }}>
              Email change (with confirmation) and password recovery will be added in the next step.
            </div>
            <div style={{ marginTop: 10, opacity: 0.75, fontSize: 13 }}>
              Current email: <span style={{ fontWeight: 900 }}>{profile?.email}</span>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "security" ? (
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 16 }}>
          <Card colSpan={6} title="Password">
            <div style={{ opacity: 0.85, fontSize: 13, lineHeight: 1.35 }}>
              Password change with “old password” + “forgot password” will be implemented as a secure flow.
            </div>
          </Card>
          <Card colSpan={6} title="Two‑factor authentication">
            <div style={{ opacity: 0.85, fontSize: 13, lineHeight: 1.35 }}>
              2FA enable/disable (Email or Google Authenticator) will live here.
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function Card({ title, colSpan, children }) {
  return (
    <div
      style={{
        gridColumn: `span ${colSpan}`,
        padding: 16,
        borderRadius: 16,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      <div style={{ fontWeight: 950, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        background: active ? "rgba(78,124,255,0.25)" : "rgba(255,255,255,0.06)",
        color: "inherit",
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }) {
  return (
    <div
      style={{
        minWidth: 150,
        padding: 12,
        borderRadius: 14,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      <div style={{ opacity: 0.75, fontSize: 12, fontWeight: 900 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 950, marginTop: 4 }}>{String(value)}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  outline: "none",
  background: "#fff",
  color: "#111",
};

function pillBtn(bg) {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    background: bg,
    color: bg === "#4e7cff" ? "white" : "inherit",
    textDecoration: "none",
    fontWeight: 900,
    border: bg === "#4e7cff" ? "none" : "1px solid rgba(255,255,255,0.12)",
  };
}
