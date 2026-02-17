// src/ProfilePage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Trophy,
  Flame,
  Star,
  Palette,
  ShieldCheck,
  Mail,
  KeyRound,
  LockKeyhole,
  Link2,
  Image as ImageIcon,
  Shuffle,
  EyeOff,
} from "lucide-react";

import av1 from "./assets/avatars/av1.png";
import av2 from "./assets/avatars/av2.png";
import av3 from "./assets/avatars/av3.png";
import av4 from "./assets/avatars/av4.png";
import av5 from "./assets/avatars/av5.png";
import av6 from "./assets/avatars/av6.png";

const PRESET_AVATARS = [av1, av2, av3, av4, av5, av6];

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  "https://haylinguav2.onrender.com";

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("hay_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

/**
 * Avoid sending "Content-Type: application/json" on GET/HEAD.
 * That header triggers CORS preflight on cross-origin requests and doubles traffic.
 * We only set Content-Type when sending a JSON body (POST/PUT/PATCH).
 */
async function apiFetch(path, { token, ...opts } = {}) {
  const method = String(opts.method || "GET").toUpperCase();
  const hasBody = opts.body != null;
  const isFormData = typeof FormData !== "undefined" && opts.body instanceof FormData;

  const headers = { ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  // For JSON bodies we set Content-Type automatically.
  // For FormData (file uploads), the browser will set the proper multipart boundary.
  if (hasBody && method !== "GET" && method !== "HEAD" && !isFormData) {
    if (!headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }
  }

  return fetch(`${API_BASE}${path}`, { ...opts, headers });
}

function safeJsonParse(res) {
  return res.json().catch(() => null);
}

function isSafeGradient(v) {
  const s = String(v || "").trim();
  return (
    s.startsWith("linear-gradient(") ||
    s.startsWith("radial-gradient(") ||
    s.startsWith("conic-gradient(")
  );
}

function resolveProfileBackground({ themeBg, themeGradient }) {
  const bg = String(themeBg || "").trim() || "#fff7ed";
  const g = String(themeGradient || "").trim();
  if (g && isSafeGradient(g)) return g;
  return bg;
}

// A small, safe default banner pool (open source / hotlink-friendly).
// You can swap this to your own CDN later.
const DEFAULT_BANNERS = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1520975682031-a17461b66b47?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1500534314209-a26db0f5c1f2?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=80",
];

function pickRandomBanner() {
  return DEFAULT_BANNERS[Math.floor(Math.random() * DEFAULT_BANNERS.length)];
}

export default function ProfilePage() {
  const token = useMemo(() => getToken(), []);
  const [loading, setLoading] = useState(true);

  // Core profile
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(""); // read-only
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");

  // Public controls
  const [friendsPublic, setFriendsPublic] = useState(true);
  const [isHidden, setIsHidden] = useState(false);

  // Theme / visuals
  const [themeBg, setThemeBg] = useState("#fff7ed");
  const [themeGradient, setThemeGradient] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState(""); // local preview only
  const [avatarPresetUrl, setAvatarPresetUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [showAvatarPresets, setShowAvatarPresets] = useState(false);

  // Stats
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [last7, setLast7] = useState([]);
  const [lessonsCompleted, setLessonsCompleted] = useState(0);

  // UX state
  const [saving, setSaving] = useState(false);
  const [bgSaving, setBgSaving] = useState(false);
  const [message, setMessage] = useState("");
  const bgSaveTimer = useRef(null);

  const publicProfileHref = useMemo(() => {
    const u = String(username || "").trim();
    if (!u) return "";
    // keep consistent with current router in your app (you can adjust)
    return `/u/${encodeURIComponent(u)}`;
  }, [username]);

  const headerBackground = useMemo(
    () => resolveProfileBackground({ themeBg, themeGradient }),
    [themeBg, themeGradient]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setMessage("");
      try {
        const res = await apiFetch("/me/profile", { token });
        const data = await safeJsonParse(res);

        if (!cancelled && res.ok && data) {
          setUsername(data.username || "");
          setEmail(data.email || "");

          // Your backend may store name fields as first_name/last_name (recommended).
          // Fall back to display_name split if those don't exist.
          setFirstName(data.first_name || "");
          setLastName(data.last_name || "");

          setBio(data.bio || "");

          setFriendsPublic(
            typeof data.friends_public === "boolean" ? data.friends_public : true
          );
          setIsHidden(typeof data.is_hidden === "boolean" ? data.is_hidden : false);

          const theme = data.profile_theme || {};
          setThemeBg(theme.background || "#fff7ed");
          setThemeGradient(theme.gradient || "");

          const b = data.banner_url || theme.banner || "";
          const picked = b || pickRandomBanner();
          setBannerUrl(picked);

          const au = data.avatar_url || data.avatar || "";
          setAvatarPreview(au);
          setAvatarPresetUrl(au);
          setAvatarFile(null);

          // Stats preview in header (safe fallbacks)
          setLevel(data.level || 1);
          setXp(data.xp || data.total_xp || 0);
          setStreak(data.streak || data.daily_streak || 0);
        }
      } catch {
        if (!cancelled) setMessage("Failed to load profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Load activity/stats (best-effort; do not block page)
      try {
        const a = await apiFetch("/me/activity/last7days", { token });
        const ad = await safeJsonParse(a);
        if (!cancelled && a.ok && ad?.days) setLast7(ad.days);
      } catch {}

      try {
        // Stats are tied to the authenticated user; email query is optional/legacy.
        const s = await apiFetch(`/me/stats`, { token });
        const sd = await safeJsonParse(s);
        if (!cancelled && s.ok && sd) {
          // Backwards/forwards compatible mapping (older BE used different keys).
          setLessonsCompleted(sd.lessons_completed ?? sd.total_lessons_completed ?? lessonsCompleted);
          setStreak(sd.streak ?? sd.best_streak_days ?? streak);
          setXp(sd.total_xp ?? sd.lifetime_xp ?? xp);
        }
      } catch {}
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Auto-save: background + banner + public toggles (no submit button)
  useEffect(() => {
    if (loading) return;
    if (!token) return;

    if (bgSaveTimer.current) clearTimeout(bgSaveTimer.current);
    bgSaveTimer.current = setTimeout(async () => {
      setBgSaving(true);
      setMessage("");

      try {
        const payload = {
          username: String(username || "").trim() || null,
          first_name: String(firstName || "").trim() || null,
          last_name: String(lastName || "").trim() || null,
          bio: String(bio || "").trim() || null,
          friends_public: !!friendsPublic,
          is_hidden: !!isHidden,
          banner_url: bannerUrl || null,
          profile_theme: {
            background: themeBg || "#fff7ed",
            gradient: themeGradient || "",
          },
        };

        const res = await apiFetch("/me/profile", {
          token,
          method: "PUT",
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await safeJsonParse(res);
          setMessage(err?.detail || "Failed to save profile settings.");
        }
      } catch {
        setMessage("Failed to save profile settings.");
      } finally {
        setBgSaving(false);
      }
    }, 650);

    return () => {
      if (bgSaveTimer.current) clearTimeout(bgSaveTimer.current);
    };
  }, [
    loading,
    token,
    themeBg,
    themeGradient,
    bannerUrl,
    friendsPublic,
    isHidden,
    username,
    firstName,
    lastName,
    bio,
  ]);

  // Manual save for core profile (optional; keeps existing UX expectation)
  async function handleSaveCore(e) {
    e?.preventDefault?.();
    if (!token) return;

    setSaving(true);
    setMessage("");
    try {
      // If a custom avatar file is selected, upload it first (same pattern as exercise recordings).
      // Expected BE endpoint: POST /me/avatar (multipart form-data "file").
      let avatarUrlToSave = avatarPresetUrl || "";
      if (avatarFile) {
        const fd = new FormData();
        fd.append("file", avatarFile);
        const up = await apiFetch("/me/avatar", {
          token,
          method: "POST",
          body: fd,
        });
        const upd = await safeJsonParse(up);
        if (!up.ok) {
          throw new Error(upd?.detail || "Avatar upload failed.");
        }
        avatarUrlToSave = upd?.url || upd?.avatar_url || upd?.path || "";
      }

      const payload = {
        username: String(username || "").trim() || null,
        first_name: String(firstName || "").trim() || null,
        last_name: String(lastName || "").trim() || null,
        bio: String(bio || "").trim() || null,
        // keep these so core-save doesn't overwrite autosaved settings unexpectedly
        friends_public: !!friendsPublic,
        is_hidden: !!isHidden,
        banner_url: bannerUrl || null,
        ...(avatarUrlToSave ? { avatar_url: avatarUrlToSave } : {}),
        profile_theme: {
          background: themeBg || "#fff7ed",
          gradient: themeGradient || "",
        },
      };

      const res = await apiFetch("/me/profile", {
        token,
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setMessage("Saved.");
      } else {
        const err = await safeJsonParse(res);
        setMessage(err?.detail || "Save failed.");
      }
    } catch {
      setMessage("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function handlePickBanner() {
    setBannerUrl(pickRandomBanner());
  }

  function handleAvatarPick() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      setShowAvatarPresets(false);
      setAvatarPresetUrl("");
      setAvatarFile(file);
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
      setMessage("Avatar selected.");
    };
    input.click();
  }

  async function handlePresetAvatarPick(url) {
    setShowAvatarPresets(false);
    setAvatarPreview(url);

    // Prefer storing presets in a stable way: upload the chosen preset to BE and save returned /static/avatars/*.
    // This avoids Vite-hashed asset URLs changing across deployments.
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      const mime = blob?.type || "image/png";
      const ext = mime.includes("/") ? mime.split("/")[1] : "png";
      const file = new File([blob], `preset-avatar.${ext}`, { type: mime });

      setAvatarPresetUrl("");
      setAvatarFile(file);
      setMessage("Avatar selected.");
    } catch {
      // Fallback: keep the local preset URL (works in dev, but is less stable).
      setAvatarFile(null);
      setAvatarPresetUrl(url);
      setMessage("Avatar selected.");
    }
  }

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-10 text-gray-700">Loading…</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header banner */}
      <div className="rounded-3xl overflow-hidden shadow-sm border border-orange-100 bg-white">
        <div
          className="relative h-40 md:h-52"
          style={{
            backgroundImage: `url(${bannerUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div
            className="absolute inset-0 opacity-70"
            style={{
              background: headerBackground,
            }}
          />
          <div className="absolute inset-0 p-4 md:p-6 flex items-end justify-between gap-3">
            <div className="flex items-end gap-4">
              <div className="relative">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/80 backdrop-blur border border-white/60 flex items-center justify-center overflow-hidden shadow">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl md:text-2xl font-extrabold text-orange-700">
                      {(firstName || username || "H")[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAvatarPick}
                    className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/90 hover:bg-white border border-orange-100 shadow-sm"
                  >
                    <ImageIcon className="w-4 h-4 text-orange-700" />
                    Upload
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAvatarPresets((v) => !v)}
                    className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/90 hover:bg-white border border-orange-100 shadow-sm"
                  >
                    Presets
                  </button>
                </div>
              </div>

              {showAvatarPresets && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {PRESET_AVATARS.map((url, idx) => {
                    const active = avatarPreview === url || avatarPresetUrl === url;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handlePresetAvatarPick(url)}
                        className={`h-10 w-10 rounded-full overflow-hidden border ${active ? "border-orange-400" : "border-white/60"} bg-white/70 backdrop-blur hover:border-orange-300`}
                        title={`Avatar ${idx + 1}`}
                      >
                        <img src={url} alt={`Avatar ${idx + 1}`} className="h-full w-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="pb-1">
                <div className="text-white drop-shadow text-lg md:text-xl font-bold">
                  {firstName || lastName ? `${firstName} ${lastName}`.trim() : username || "Your profile"}
                </div>
                <div className="text-white/90 drop-shadow text-xs md:text-sm flex items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <Trophy className="w-4 h-4" /> Lv {level}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Star className="w-4 h-4" /> {xp} XP
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Flame className="w-4 h-4" /> {streak} day streak
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePickBanner}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs md:text-sm font-semibold bg-white/90 hover:bg-white border border-orange-100 shadow-sm"
                >
                  <Shuffle className="w-4 h-4 text-orange-700" />
                  Random banner
                </button>
                <button
                  type="button"
                  onClick={() => setIsHidden((v) => !v)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs md:text-sm font-semibold bg-white/90 hover:bg-white border border-orange-100 shadow-sm"
                >
                  <EyeOff className="w-4 h-4 text-orange-700" />
                  {isHidden ? "Hidden" : "Public"}
                </button>
              </div>

              <div className="text-[11px] text-white/90 drop-shadow">
                {bgSaving ? "Saving…" : " "}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile details (no display name, no avatar url) */}
      <section className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
        <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Profile details</h2>

        <form onSubmit={handleSaveCore} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">First name</label>
              <input
                type="text"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Armen"
                autoComplete="given-name"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Last name</label>
              <input
                type="text"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Ghazaryan"
                autoComplete="family-name"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Public username</label>
              <input
                type="text"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your-username"
                autoComplete="username"
              />
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-gray-50 text-gray-700 truncate">
                  {publicProfileHref ? `${window.location.origin}${publicProfileHref}` : "—"}
                </div>
                {publicProfileHref ? (
                  <a
                    href={publicProfileHref}
                    className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
                  >
                    <Link2 className="w-4 h-4" />
                    Open
                  </a>
                ) : (
                  <span className="text-xs text-gray-400">Set a username</span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-gray-400">
                If the account is hidden, your public page will show only “This account is hidden”.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Bio</label>
              <textarea
                rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Write something short…"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Email address</label>
              <input
                type="email"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-gray-50 text-gray-600 cursor-not-allowed"
                value={email}
                readOnly
                disabled
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Email can only be changed via Account security (with confirmation).
              </p>
            </div>

            <div className="flex items-center">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 mt-6">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={friendsPublic}
                  onChange={(e) => setFriendsPublic(e.target.checked)}
                />
                Show friends list publicly
              </label>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm transition-colors"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </section>

      {/* Background (no submit button; autosaves) */}
      <section className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-base md:text-lg font-semibold text-gray-900">Appearance</h2>
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <Palette className="w-4 h-4" />
            {bgSaving ? "Saving…" : "Auto-saved"}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Background color</label>
            <input
              type="color"
              className="w-14 h-10 rounded-xl border border-gray-200 p-1 bg-white"
              value={themeBg}
              onChange={(e) => setThemeBg(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-gray-400">Used if gradient is empty/invalid.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Background gradient (CSS)</label>
            <input
              type="text"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              value={themeGradient}
              onChange={(e) => setThemeGradient(e.target.value)}
              placeholder="linear-gradient(...)"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Only accepts linear/radial/conic-gradient. Otherwise we fall back to the color.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 text-xs font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">
            Preview
          </div>
          <div className="h-20" style={{ background: headerBackground }} />
        </div>
      </section>

      {/* Account security placeholders */}
      <section className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
        <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Account security</h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 font-semibold text-gray-900">
              <Mail className="w-4 h-4 text-orange-700" />
              Change email
            </div>
            <p className="mt-2 text-sm text-gray-600">
              This flow requires email confirmation. The UI is ready; backend endpoints can be wired next.
            </p>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              onClick={() => setMessage("Email change flow is not wired yet.")}
            >
              <Mail className="w-4 h-4" /> Start email change
            </button>
          </div>

          <div className="rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 font-semibold text-gray-900">
              <KeyRound className="w-4 h-4 text-orange-700" />
              Change password
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Requires current password + new password. Can be wired to <code>/me/change-password</code>.
            </p>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              onClick={() => setMessage("Password change flow is not wired yet.")}
            >
              <KeyRound className="w-4 h-4" /> Change password
            </button>
          </div>

          <div className="rounded-2xl border border-gray-200 p-4 md:col-span-2">
            <div className="flex items-center gap-2 font-semibold text-gray-900">
              <ShieldCheck className="w-4 h-4 text-orange-700" />
              Two-factor authentication (2FA)
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Yes: enabling 2FA should open a popup/modal with a QR code, secret, and a code verification field.
              Once you confirm the code, show recovery codes.
            </p>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              onClick={() => setMessage("2FA popup UI can be added after backend endpoints exist.")}
            >
              <LockKeyhole className="w-4 h-4" /> Manage 2FA
            </button>
          </div>
        </div>
      </section>

      {/* Recent learning activity (kept) */}
      <section className="bg-white rounded-2xl shadow-sm p-5 md:p-6">
        <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">
          Recent learning activity
        </h2>

        <div className="grid md:grid-cols-[1fr,240px] gap-4">
          <div className="rounded-2xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-700 mb-3">
              Exercises completed in the last 7 days
            </div>

            {(() => {
              const items = last7?.length ? last7 : ["T", "W", "T", "F", "S", "S", "M"];
              const values = items.map((d) => (typeof d === "object" ? Number(d.value ?? 0) : 0));
              const maxV = Math.max(1, ...values);
              return (
                <div className="flex items-end gap-3 h-28">
                  {items.map((d, idx) => {
                    const v = typeof d === "object" ? Number(d.value ?? 0) : 0;
                    const label = typeof d === "object" ? String(d.label ?? "") : String(d);
                    const h = Math.round((v / maxV) * 88);
                    return (
                      <div key={idx} className="flex flex-col items-center gap-2 flex-1">
                        <div className="w-full max-w-[44px]">
                          <div className="relative h-20 w-full rounded-xl bg-orange-50 overflow-hidden">
                            <div
                              className="absolute bottom-0 left-0 right-0 bg-orange-200 rounded-xl"
                              style={{ height: `${Math.max(3, h)}px` }}
                              title={`${label}: ${v}`}
                            />
                          </div>
                        </div>
                        <div className="text-[11px] text-gray-500">{label}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center bg-orange-50 rounded-xl px-3 py-2.5">
              <span className="text-xs text-gray-600">Total lessons completed</span>
              <span className="text-sm font-semibold text-gray-900">{lessonsCompleted}</span>
            </div>

            <div className="flex justify-between items-center bg-green-50 rounded-xl px-3 py-2.5">
              <span className="text-xs text-gray-600">Best streak</span>
              <span className="text-sm font-semibold text-gray-900">{streak} days</span>
            </div>

            <div className="flex justify-between items-center bg-blue-50 rounded-xl px-3 py-2.5">
              <span className="text-xs text-gray-600">Lifetime XP</span>
              <span className="text-sm font-semibold text-gray-900">{xp}</span>
            </div>
          </div>
        </div>

      </section>

      {!!message && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          {message}
        </div>
      )}
    </div>
  );
}
