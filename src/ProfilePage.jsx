// src/ProfilePage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Trophy,
  Flame,
  Palette,
  ShieldCheck,
  Mail,
  KeyRound,
  LockKeyhole,
  Link2,
  Image as ImageIcon,
  EyeOff,
} from "lucide-react";

import { StarMotif } from "./lib/motifs";
import AccountDangerZone from "./AccountDangerZone";
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

// Normalize backend-provided media URLs.
// BE typically returns paths like "/static/..."; those must be absolute for the FE domain.
function resolveUrl(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("data:")) return s;
  if (s.startsWith("blob:")) return s;
  // Some BE versions return paths without a leading slash (e.g. "static/banners/..."),
  // which would otherwise resolve against the FE domain and break in production.
  if (s.startsWith("static/")) return `${API_BASE}/${s}`;
  if (s.startsWith("banners/")) return `/${s}`;
  // Backend-hosted media uses /static/* and must be absolute.
  // Frontend preset assets may be stored as /banners/* and should stay relative.
  if (s.startsWith("/static/")) return `${API_BASE}${s}`;
  if (s.startsWith("/")) return s;
  return s;
}

// Preset banners shipped with the frontend (public/banners/*)
const PRESET_BANNERS = Array.from({ length: 8 }).map((_, i) => `/banners/banner-${i + 1}.png`);

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
  const [showBannerPicker, setShowBannerPicker] = useState(false);
  const [bannerBusy, setBannerBusy] = useState(false);
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

  // Account security
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailStage, setEmailStage] = useState("start"); // start | confirm
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailDevCode, setEmailDevCode] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");

  const [twoFaOpen, setTwoFaOpen] = useState(false);
  const [twoFaBusy, setTwoFaBusy] = useState(false);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaSetup, setTwoFaSetup] = useState(null); // {qr_png, secret, otpauth_url}
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaRecovery, setTwoFaRecovery] = useState([]);
  const [twoFaDisableCode, setTwoFaDisableCode] = useState("");
  const [twoFaDisablePw, setTwoFaDisablePw] = useState("");

  // UX state
  const [saving, setSaving] = useState(false);
  const [bgSaving, setBgSaving] = useState(false);
  const [message, setMessage] = useState("");
  const bgSaveTimer = useRef(null);
  const avatarObjectUrlRef = useRef(null);

  // Track whether the user explicitly changed the banner.
  // We may show a random banner as a visual default, but we shouldn't persist it
  // unless the user chose to.
  const bannerTouchedRef = useRef(false);

  // Track whether the user explicitly changed the avatar.
  // Same idea as banner: don't accidentally overwrite avatar_url unless the user picked one.
  const avatarTouchedRef = useRef(false);

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
          setBannerUrl(b || "");
          bannerTouchedRef.current = Boolean(b);

          const au = data.avatar_url || data.avatar || "";
          const resolvedAvatar = resolveUrl(au);
          // If a previous local blob URL was set, revoke it to avoid leaks.
          if (avatarObjectUrlRef.current) {
            try { URL.revokeObjectURL(avatarObjectUrlRef.current); } catch {}
            avatarObjectUrlRef.current = null;
          }
          setAvatarPreview(resolvedAvatar);
          setAvatarPresetUrl(resolvedAvatar);
          setAvatarFile(null);
          avatarTouchedRef.current = Boolean(au);

          // Stats preview in header (safe fallbacks)
          setLevel(data.level || 1);
          setXp(data.xp || data.total_xp || 0);
          setStreak(data.streak || data.daily_streak || 0);

          // 2FA status (best-effort)
          try {
            const r2 = await apiFetch("/me/2fa/status", { token });
            const d2 = await safeJsonParse(r2);
            if (!cancelled && r2.ok && d2) setTwoFaEnabled(!!d2.enabled);
          } catch {}
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

  // Cleanup any object URLs on unmount.
  useEffect(() => {
    return () => {
      if (avatarObjectUrlRef.current) {
        try { URL.revokeObjectURL(avatarObjectUrlRef.current); } catch {}
        avatarObjectUrlRef.current = null;
      }
    };
  }, []);

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
          friends_public: !!friendsPublic,
          is_hidden: !!isHidden,
          // Don't persist a random/default banner unless user explicitly changed it.
          ...(bannerTouchedRef.current ? { banner_url: bannerUrl || null } : {}),
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
        // Only persist banner if the user explicitly touched it.
        ...(bannerTouchedRef.current
          ? { banner_url: bannerUrl || null, banner: bannerUrl || null }
          : {}),
        // Only persist avatar if the user explicitly touched it.
        ...(avatarTouchedRef.current && avatarUrlToSave
          ? { avatar_url: avatarUrlToSave, avatar: avatarUrlToSave }
          : {}),
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
        if (avatarUrlToSave) {
          // Update preview immediately using resolved URL (fixes broken preview after refresh).
          if (avatarObjectUrlRef.current) {
            try { URL.revokeObjectURL(avatarObjectUrlRef.current); } catch {}
            avatarObjectUrlRef.current = null;
          }
          setAvatarPreview(resolveUrl(avatarUrlToSave));
          setAvatarPresetUrl(resolveUrl(avatarUrlToSave));
          setAvatarFile(null);
          avatarTouchedRef.current = true;
        }
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

  function handleSelectPresetBanner(url) {
    bannerTouchedRef.current = true;
    setBannerUrl(url);
    setShowBannerPicker(false);
    setMessage("Banner selected.");
  }

  async function handleUploadBanner() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        setBannerBusy(true);
        setMessage("");
        const fd = new FormData();
        fd.append("file", file);
        const res = await apiFetch("/me/banner", {
          token,
          method: "POST",
          body: fd,
        });
        const data = await safeJsonParse(res);
        if (!res.ok) {
          setMessage(data?.detail || "Banner upload failed.");
          return;
        }
        const url = data?.banner_url || "";
        bannerTouchedRef.current = true;
        setBannerUrl(url);
        setShowBannerPicker(false);
        setMessage("Banner uploaded.");
      } catch {
        setMessage("Banner upload failed.");
      } finally {
        setBannerBusy(false);
      }
    };
    input.click();
  }

  function handleRemoveBanner() {
    bannerTouchedRef.current = true;
    setBannerUrl("");
    setShowBannerPicker(false);
    setMessage("Banner removed.");
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
      avatarTouchedRef.current = true;
      const url = URL.createObjectURL(file);
      if (avatarObjectUrlRef.current) {
        try { URL.revokeObjectURL(avatarObjectUrlRef.current); } catch {}
      }
      avatarObjectUrlRef.current = url;
      setAvatarPreview(url);
      setMessage("Avatar selected.");
    };
    input.click();
  }

  async function handlePresetAvatarPick(url) {
    setShowAvatarPresets(false);
    if (avatarObjectUrlRef.current) {
      try { URL.revokeObjectURL(avatarObjectUrlRef.current); } catch {}
      avatarObjectUrlRef.current = null;
    }
    setAvatarPreview(url);
    avatarTouchedRef.current = true;

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

  // Auto-persist avatar to backend when user picks a file/preset.
  // This fixes the common issue where avatar looks changed but isn't saved after refresh.
  useEffect(() => {
    if (loading) return;
    if (!token) return;
    if (!avatarTouchedRef.current) return;
    if (!avatarFile) return;

    const t = setTimeout(async () => {
      try {
        const fd = new FormData();
        fd.append("file", avatarFile);
        const up = await apiFetch("/me/avatar", {
          token,
          method: "POST",
          body: fd,
        });
        const upd = await safeJsonParse(up);
        if (!up.ok) return;

        const avatarUrlToSave = upd?.url || upd?.avatar_url || upd?.path || "";
        if (!avatarUrlToSave) return;

        if (avatarObjectUrlRef.current) {
          try { URL.revokeObjectURL(avatarObjectUrlRef.current); } catch {}
          avatarObjectUrlRef.current = null;
        }
        setAvatarPreview(resolveUrl(avatarUrlToSave));
        setAvatarPresetUrl(resolveUrl(avatarUrlToSave));
        setAvatarFile(null);
      } catch {
        // Silent: avatar save shouldn't break the whole profile page.
      }
    }, 450);

    return () => clearTimeout(t);
  }, [loading, token, avatarFile]);

  // -------- Account security actions --------
  async function startEmailChange() {
    if (!token) return;
    setEmailBusy(true);
    setMessage("");
    setEmailDevCode("");
    try {
      const res = await apiFetch("/me/change-email/start", {
        token,
        method: "POST",
        body: JSON.stringify({ new_email: newEmail }),
      });
      const data = await safeJsonParse(res);
      if (!res.ok) throw new Error(data?.detail || "Failed to start email change");
      setEmailStage("confirm");
      if (data?.verification_code) setEmailDevCode(String(data.verification_code));
    } catch (e) {
      setMessage(String(e?.message || "Failed to start email change."));
    } finally {
      setEmailBusy(false);
    }
  }

  async function confirmEmailChange() {
    if (!token) return;
    setEmailBusy(true);
    setMessage("");
    try {
      const res = await apiFetch("/me/change-email/confirm", {
        token,
        method: "POST",
        body: JSON.stringify({ code: emailCode }),
      });
      const data = await safeJsonParse(res);
      if (!res.ok) throw new Error(data?.detail || "Failed to confirm email change");
      setEmail(data?.email || newEmail);
      setEmailModalOpen(false);
      setEmailStage("start");
      setNewEmail("");
      setEmailCode("");
      setEmailDevCode("");
      setMessage("Email updated.");
    } catch (e) {
      setMessage(String(e?.message || "Failed to confirm email change."));
    } finally {
      setEmailBusy(false);
    }
  }

  async function changePassword() {
    if (!token) return;
    if (newPw !== newPw2) {
      setMessage("New passwords do not match.");
      return;
    }
    setPwBusy(true);
    setMessage("");
    try {
      const res = await apiFetch("/me/change-password", {
        token,
        method: "POST",
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      const data = await safeJsonParse(res);
      if (!res.ok) throw new Error(data?.detail || "Failed to change password");
      setPwModalOpen(false);
      setCurrentPw("");
      setNewPw("");
      setNewPw2("");
      setMessage("Password updated.");
    } catch (e) {
      setMessage(String(e?.message || "Failed to change password."));
    } finally {
      setPwBusy(false);
    }
  }

  async function open2FA() {
    setTwoFaOpen(true);
    setTwoFaRecovery([]);
    setTwoFaSetup(null);
    setTwoFaCode("");
    setTwoFaDisableCode("");
    setTwoFaDisablePw("");
    setMessage("");
    // refresh status
    try {
      const r = await apiFetch("/me/2fa/status", { token });
      const d = await safeJsonParse(r);
      if (r.ok && d) setTwoFaEnabled(!!d.enabled);
    } catch {}
  }

  async function start2FASetup() {
    if (!token) return;
    setTwoFaBusy(true);
    setMessage("");
    setTwoFaRecovery([]);
    try {
      const r = await apiFetch("/me/2fa/setup", { token, method: "POST" });
      const d = await safeJsonParse(r);
      if (!r.ok) throw new Error(d?.detail || "Failed to start 2FA setup");
      setTwoFaSetup(d);
    } catch (e) {
      setMessage(String(e?.message || "Failed to start 2FA setup."));
    } finally {
      setTwoFaBusy(false);
    }
  }

  async function confirm2FA() {
    if (!token) return;
    setTwoFaBusy(true);
    setMessage("");
    try {
      const r = await apiFetch("/me/2fa/confirm", {
        token,
        method: "POST",
        body: JSON.stringify({ code: twoFaCode }),
      });
      const d = await safeJsonParse(r);
      if (!r.ok) throw new Error(d?.detail || "Invalid code");
      setTwoFaEnabled(true);
      setTwoFaRecovery(Array.isArray(d?.recovery_codes) ? d.recovery_codes : []);
    } catch (e) {
      setMessage(String(e?.message || "Failed to enable 2FA."));
    } finally {
      setTwoFaBusy(false);
    }
  }

  async function disable2FA() {
    if (!token) return;
    setTwoFaBusy(true);
    setMessage("");
    try {
      const r = await apiFetch("/me/2fa/disable", {
        token,
        method: "POST",
        body: JSON.stringify({ code: twoFaDisableCode, current_password: twoFaDisablePw }),
      });
      const d = await safeJsonParse(r);
      if (!r.ok) throw new Error(d?.detail || "Failed to disable 2FA");
      setTwoFaEnabled(false);
      setTwoFaSetup(null);
      setTwoFaRecovery([]);
      setTwoFaDisableCode("");
      setTwoFaDisablePw("");
      setMessage("2FA disabled.");
    } catch (e) {
      setMessage(String(e?.message || "Failed to disable 2FA."));
    } finally {
      setTwoFaBusy(false);
    }
  }

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-10 font-display font-extrabold text-slate-500">Loading…</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header banner */}
      <div className="rounded-3xl overflow-hidden shadow-sm ring-1 ring-slate-200 bg-white">
        <div
          className="relative h-40 md:h-52"
          style={
            bannerUrl
              ? {
                  backgroundImage: `url(${resolveUrl(bannerUrl)})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : { background: headerBackground }
          }
        >
          {bannerUrl ? (
            <div
              className="absolute inset-0 opacity-70"
              style={{ background: headerBackground }}
            />
          ) : null}
          <div className="absolute inset-0 p-4 md:p-6 flex items-end justify-between gap-3">
            <div className="flex items-end gap-4">
              <div className="relative">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/85 backdrop-blur ring-2 ring-white/70 flex items-center justify-center overflow-hidden shadow-md">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-display text-xl md:text-2xl font-extrabold text-brand-600">
                      {(firstName || username || "H")[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAvatarPick}
                    className="btn3d btn3d-neutral text-xs px-2.5 py-1.5"
                  >
                    <ImageIcon className="w-4 h-4 text-brand-500" />
                    Upload
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAvatarPresets((v) => !v)}
                    className="btn3d btn3d-neutral text-xs px-2.5 py-1.5"
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
                        className={`h-10 w-10 rounded-full overflow-hidden ring-2 ${active ? "ring-brand-400" : "ring-white/60"} bg-white/70 backdrop-blur hover:ring-brand-300`}
                        title={`Avatar ${idx + 1}`}
                      >
                        <img src={url} alt={`Avatar ${idx + 1}`} className="h-full w-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="pb-1">
                <div className="font-display text-white drop-shadow text-lg md:text-xl font-extrabold">
                  {firstName || lastName ? `${firstName} ${lastName}`.trim() : username || "Your profile"}
                </div>
                <div className="text-white/90 drop-shadow text-xs md:text-sm font-bold flex items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <Trophy className="w-4 h-4" /> Lv {level}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <StarMotif className="w-4 h-4 text-gold-400" /> {xp} XP
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
                  onClick={() => setShowBannerPicker(true)}
                  className="btn3d btn3d-neutral text-sm"
                >
                  <ImageIcon className="w-4 h-4 text-brand-500" />
                  Banner
                </button>
                <button
                  type="button"
                  onClick={() => setIsHidden((v) => !v)}
                  className="btn3d btn3d-neutral text-sm"
                >
                  <EyeOff className="w-4 h-4 text-brand-500" />
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

      {/* Banner picker modal */}
      {showBannerPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => (bannerBusy ? null : setShowBannerPicker(false))}
          />
          <div className="relative w-full max-w-3xl rounded-3xl ring-1 ring-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="p-5 md:p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="font-display text-base font-extrabold text-slate-800">Choose a banner</div>
                <div className="text-xs font-semibold text-slate-500 mt-0.5">Pick a preset or upload your own.</div>
              </div>
              <button
                type="button"
                disabled={bannerBusy}
                onClick={() => setShowBannerPicker(false)}
                className="rounded-xl px-3 py-2 text-sm font-extrabold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <div className="p-5 md:p-6 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {PRESET_BANNERS.map((url) => {
                  const active = String(bannerUrl || "") === url;
                  return (
                    <button
                      key={url}
                      type="button"
                      onClick={() => handleSelectPresetBanner(url)}
                      className={
                        "group relative h-20 rounded-2xl overflow-hidden ring-2 transition " +
                        (active
                          ? "ring-brand-400"
                          : "ring-slate-200 hover:ring-brand-300")
                      }
                      title="Select banner"
                    >
                      <div
                        className="absolute inset-0 bg-center bg-cover"
                        style={{ backgroundImage: `url(${url})` }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={bannerBusy}
                    onClick={handleUploadBanner}
                    className="btn3d btn3d-brand text-sm"
                  >
                    <ImageIcon className="w-4 h-4" />
                    {bannerBusy ? "Uploading…" : "Upload banner"}
                  </button>

                  <button
                    type="button"
                    disabled={bannerBusy}
                    onClick={handleRemoveBanner}
                    className="btn3d btn3d-neutral text-sm"
                  >
                    Remove
                  </button>
                </div>

                <div className="text-xs font-semibold text-slate-500">
                  Tip: presets are fast; uploads let you personalize fully.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile details (no display name, no avatar url) */}
      <section className="rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm">
        <h2 className="font-display text-lg font-extrabold text-slate-800 mb-4">Profile details</h2>

        <form onSubmit={handleSaveCore} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-extrabold text-slate-700 mb-1.5">First name</label>
              <input
                type="text"
                className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none placeholder:text-slate-400"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Armen"
                autoComplete="given-name"
              />
            </div>

            <div>
              <label className="block text-sm font-extrabold text-slate-700 mb-1.5">Last name</label>
              <input
                type="text"
                className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none placeholder:text-slate-400"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Ghazaryan"
                autoComplete="family-name"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-extrabold text-slate-700 mb-1.5">Public username</label>
              <input
                type="text"
                className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none placeholder:text-slate-400"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your-username"
                autoComplete="username"
              />
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-600 ring-2 ring-slate-200 truncate">
                  {publicProfileHref ? `${window.location.origin}${publicProfileHref}` : "—"}
                </div>
                {publicProfileHref ? (
                  <a
                    href={publicProfileHref}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-extrabold bg-brand-50 text-brand-600 ring-2 ring-brand-100 hover:bg-brand-100 transition-colors"
                  >
                    <Link2 className="w-4 h-4" />
                    Open
                  </a>
                ) : (
                  <span className="text-xs font-semibold text-slate-400">Set a username</span>
                )}
              </div>
              <p className="mt-1.5 text-xs font-semibold text-slate-400">
                If the account is hidden, your public page will show only “This account is hidden”.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-extrabold text-slate-700 mb-1.5">Bio</label>
              <textarea
                rows={3}
                className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none placeholder:text-slate-400"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Write something short…"
              />
            </div>

            <div>
              <label className="block text-sm font-extrabold text-slate-700 mb-1.5">Email address</label>
              <input
                type="email"
                className="w-full rounded-2xl bg-slate-100 px-4 py-3 font-semibold text-slate-500 ring-2 ring-slate-200 cursor-not-allowed"
                value={email}
                readOnly
                disabled
              />
              <p className="mt-1.5 text-xs font-semibold text-slate-400">
                Email can only be changed via Account security (with confirmation).
              </p>
            </div>

            <div className="flex items-center">
              <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 mt-6">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded-md border-slate-300 text-brand-500 focus:ring-brand-400"
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
              className="btn3d btn3d-brand uppercase text-sm"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </section>

      {/* Email change modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setEmailModalOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-xl ring-1 ring-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="font-display font-extrabold text-slate-800 flex items-center gap-2">
                <Mail className="w-4 h-4 text-brand-500" /> Change email
              </div>
              <button
                type="button"
                className="h-9 w-9 rounded-xl hover:bg-slate-100 grid place-items-center text-slate-500 font-bold"
                onClick={() => setEmailModalOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              {emailStage === "start" ? (
                <>
                  <p className="text-sm font-semibold text-slate-600">
                    We’ll send a 6‑digit code to your new email address.
                  </p>
                  <label className="block mt-4 text-sm font-extrabold text-slate-700 mb-1.5">
                    New email
                  </label>
                  <input
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    type="email"
                    placeholder="name@example.com"
                    className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none placeholder:text-slate-400"
                  />
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      className="btn3d btn3d-neutral text-sm"
                      onClick={() => setEmailModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={emailBusy}
                      className="btn3d btn3d-brand text-sm"
                      onClick={startEmailChange}
                    >
                      {emailBusy ? "Sending…" : "Send code"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-600">
                    Enter the code sent to <span className="font-extrabold text-slate-800">{newEmail}</span>.
                  </p>
                  {!!emailDevCode && (
                    <div className="mt-3 rounded-2xl ring-1 ring-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700">
                      Email delivery is not configured. Use this code: <span className="font-mono font-bold">{emailDevCode}</span>
                    </div>
                  )}
                  <label className="block mt-4 text-sm font-extrabold text-slate-700 mb-1.5">6‑digit code</label>
                  <input
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value)}
                    inputMode="numeric"
                    placeholder="123456"
                    className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none placeholder:text-slate-400"
                  />
                  <div className="mt-4 flex justify-between gap-2">
                    <button
                      type="button"
                      className="btn3d btn3d-neutral text-sm"
                      onClick={() => {
                        setEmailStage("start");
                        setEmailCode("");
                        setEmailDevCode("");
                      }}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={emailBusy}
                      className="btn3d btn3d-brand text-sm"
                      onClick={confirmEmailChange}
                    >
                      {emailBusy ? "Confirming…" : "Confirm"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Password modal */}
      {pwModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPwModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-xl ring-1 ring-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="font-display font-extrabold text-slate-800 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-brand-500" /> Change password
              </div>
              <button
                type="button"
                className="h-9 w-9 rounded-xl hover:bg-slate-100 grid place-items-center text-slate-500 font-bold"
                onClick={() => setPwModalOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              <label className="block text-sm font-extrabold text-slate-700 mb-1.5">Current password</label>
              <input
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                type="password"
                className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none placeholder:text-slate-400"
              />

              <label className="block mt-4 text-sm font-extrabold text-slate-700 mb-1.5">New password</label>
              <input
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                type="password"
                className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none placeholder:text-slate-400"
              />

              <label className="block mt-4 text-sm font-extrabold text-slate-700 mb-1.5">Repeat new password</label>
              <input
                value={newPw2}
                onChange={(e) => setNewPw2(e.target.value)}
                type="password"
                className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none placeholder:text-slate-400"
              />

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn3d btn3d-neutral text-sm"
                  onClick={() => setPwModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pwBusy}
                  className="btn3d btn3d-brand text-sm"
                  onClick={changePassword}
                >
                  {pwBusy ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2FA modal */}
      {twoFaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setTwoFaOpen(false)} />
          <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-xl ring-1 ring-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="font-display font-extrabold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand-500" /> Two‑factor authentication
              </div>
              <button
                type="button"
                className="h-9 w-9 rounded-xl hover:bg-slate-100 grid place-items-center text-slate-500 font-bold"
                onClick={() => setTwoFaOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-bold text-slate-700">
                  Status: {twoFaEnabled ? (
                    <span className="inline-flex items-center gap-1 font-extrabold text-grass-600">Enabled</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-extrabold text-slate-500">Disabled</span>
                  )}
                </div>

                {!twoFaEnabled ? (
                  <button
                    type="button"
                    disabled={twoFaBusy}
                    className="btn3d btn3d-brand text-sm"
                    onClick={start2FASetup}
                  >
                    <LockKeyhole className="w-4 h-4" /> {twoFaBusy ? "Preparing…" : "Start setup"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={twoFaBusy}
                    className="btn3d btn3d-neutral text-sm"
                    onClick={disable2FA}
                  >
                    Disable 2FA
                  </button>
                )}
              </div>

              {!twoFaEnabled && twoFaSetup && (
                <div className="mt-5 grid md:grid-cols-[260px,1fr] gap-4">
                  <div className="rounded-3xl ring-1 ring-slate-200 p-4 bg-slate-50">
                    <div className="text-xs font-extrabold text-slate-700">Scan QR</div>
                    <img
                      src={twoFaSetup.qr_png}
                      alt="2FA QR"
                      className="mt-3 w-full rounded-2xl bg-white p-3 ring-1 ring-slate-200"
                    />
                    <div className="mt-3 text-xs font-semibold text-slate-500">
                      Or enter this secret manually:
                    </div>
                    <div className="mt-1 font-mono text-xs bg-white ring-1 ring-slate-200 rounded-2xl px-3 py-2 text-slate-700">
                      {twoFaSetup.secret}
                    </div>
                  </div>

                  <div className="rounded-3xl ring-1 ring-slate-200 p-4">
                    <div className="font-display text-sm font-extrabold text-slate-800">Verify</div>
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      After adding Haylingua to your authenticator app, enter the 6‑digit code.
                    </p>
                    <label className="block mt-4 text-sm font-extrabold text-slate-700 mb-1.5">Code</label>
                    <input
                      value={twoFaCode}
                      onChange={(e) => setTwoFaCode(e.target.value)}
                      inputMode="numeric"
                      placeholder="123456"
                      className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none placeholder:text-slate-400"
                    />
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        disabled={twoFaBusy}
                        className="btn3d btn3d-brand text-sm"
                        onClick={confirm2FA}
                      >
                        {twoFaBusy ? "Enabling…" : "Enable 2FA"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {twoFaEnabled && (
                <div className="mt-5 rounded-3xl ring-1 ring-slate-200 p-4 bg-slate-50">
                  <div className="font-display text-sm font-extrabold text-slate-800">Disable 2FA</div>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    For safety, provide either a current authenticator code or your password.
                  </p>
                  <div className="mt-4 grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-extrabold text-slate-700 mb-1.5">Authenticator code</label>
                      <input
                        value={twoFaDisableCode}
                        onChange={(e) => setTwoFaDisableCode(e.target.value)}
                        inputMode="numeric"
                        placeholder="123456"
                        className="w-full rounded-2xl bg-white px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:ring-brand-400 focus:outline-none placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-extrabold text-slate-700 mb-1.5">Current password</label>
                      <input
                        value={twoFaDisablePw}
                        onChange={(e) => setTwoFaDisablePw(e.target.value)}
                        type="password"
                        className="w-full rounded-2xl bg-white px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:ring-brand-400 focus:outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      disabled={twoFaBusy}
                      className="btn3d btn3d-cardinal text-sm"
                      onClick={disable2FA}
                    >
                      {twoFaBusy ? "Disabling…" : "Disable"}
                    </button>
                  </div>

                  {twoFaRecovery?.length > 0 && (
                    <div className="mt-4 rounded-2xl ring-1 ring-brand-200 bg-brand-50 px-4 py-3">
                      <div className="text-xs font-extrabold text-brand-700">Recovery codes</div>
                      <div className="mt-2 grid sm:grid-cols-2 gap-2 font-mono text-xs text-brand-800">
                        {twoFaRecovery.map((c) => (
                          <div key={c} className="rounded-xl bg-white/70 ring-1 ring-brand-100 px-3 py-2">
                            {c}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-xs font-semibold text-brand-700">
                        Save these codes somewhere safe. Each code can be used once.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!twoFaEnabled && twoFaRecovery?.length > 0 && (
                <div className="mt-5 rounded-2xl ring-1 ring-brand-200 bg-brand-50 px-4 py-3">
                  <div className="text-xs font-extrabold text-brand-700">Recovery codes</div>
                  <div className="mt-2 grid sm:grid-cols-2 gap-2 font-mono text-xs text-brand-800">
                    {twoFaRecovery.map((c) => (
                      <div key={c} className="rounded-xl bg-white/70 ring-1 ring-brand-100 px-3 py-2">
                        {c}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs font-semibold text-brand-700">
                    Save these codes somewhere safe. Each code can be used once.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Background (no submit button; autosaves) */}
<section className="rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm">
  <div className="flex items-center justify-between gap-3 mb-4">
    <h2 className="font-display text-lg font-extrabold text-slate-800">Appearance</h2>
    <div className="text-xs font-bold text-slate-500 flex items-center gap-2">
      <Palette className="w-4 h-4 text-brand-500" />
      {bgSaving ? "Saving…" : "Auto-saved"}
    </div>
  </div>

  <div className="grid md:grid-cols-2 gap-4">
    <div>
      <label className="block text-sm font-extrabold text-slate-700 mb-1.5">
        Background color
      </label>
      <input
        type="color"
        className="w-14 h-10 rounded-xl ring-2 ring-slate-200 p-1 bg-white cursor-pointer"
        value={themeBg}
        onChange={(e) => setThemeBg(e.target.value)}
      />
      <p className="mt-1.5 text-xs font-semibold text-slate-400">Used if gradient is empty/invalid.</p>
    </div>

    <div>
    </div>
  </div>

  <div className="mt-4 rounded-2xl ring-1 ring-slate-200 overflow-hidden">
    <div className="px-4 py-3 text-xs font-extrabold text-slate-700 bg-slate-50 border-b border-slate-200">
      Preview
    </div>
    <div className="h-20" style={{ background: headerBackground }} />
  </div>
</section>

      {/* Account security placeholders */}
      <section className="rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm">
        <h2 className="font-display text-lg font-extrabold text-slate-800 mb-4">Account security</h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl ring-1 ring-slate-200 p-4">
            <div className="flex items-center gap-2 font-display font-extrabold text-slate-800">
              <Mail className="w-4 h-4 text-brand-500" />
              Change email
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              Update your account email with a confirmation code sent to the new address.
            </p>
            <button
              type="button"
              className="btn3d btn3d-neutral text-sm mt-3"
              onClick={() => {
                setEmailModalOpen(true);
                setEmailStage("start");
                setNewEmail("");
                setEmailCode("");
                setEmailDevCode("");
              }}
            >
              <Mail className="w-4 h-4 text-brand-500" /> Start email change
            </button>
          </div>

          <div className="rounded-2xl ring-1 ring-slate-200 p-4">
            <div className="flex items-center gap-2 font-display font-extrabold text-slate-800">
              <KeyRound className="w-4 h-4 text-brand-500" />
              Change password
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              Change your password securely (requires your current password).
            </p>
            <button
              type="button"
              className="btn3d btn3d-neutral text-sm mt-3"
              onClick={() => {
                setPwModalOpen(true);
                setCurrentPw("");
                setNewPw("");
                setNewPw2("");
              }}
            >
              <KeyRound className="w-4 h-4 text-brand-500" /> Change password
            </button>
          </div>

          <div className="rounded-2xl ring-1 ring-slate-200 p-4 md:col-span-2">
            <div className="flex items-center gap-2 font-display font-extrabold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-brand-500" />
              Two-factor authentication (2FA)
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              Add an extra security layer with an authenticator app (TOTP). You’ll receive recovery codes after enabling.
            </p>
            <button
              type="button"
              className="btn3d btn3d-neutral text-sm mt-3"
              onClick={open2FA}
            >
              <LockKeyhole className="w-4 h-4 text-brand-500" /> {twoFaEnabled ? "Manage 2FA" : "Enable 2FA"}
            </button>
          </div>
        </div>
      </section>

      {/* Recent learning activity (kept) */}
      <section className="rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm">
        <h2 className="font-display text-lg font-extrabold text-slate-800 mb-4">
          Recent learning activity
        </h2>

        <div className="grid md:grid-cols-[1fr,240px] gap-4">
          <div className="rounded-2xl ring-1 ring-slate-200 p-4">
            <div className="text-xs font-extrabold text-slate-700 mb-3">
              Exercises completed in the last 7 days
            </div>

            {(() => {
              const items = Array.isArray(last7) && last7.length ? last7 : [];
              const normalized = items.map((d, i) => {
                const v = Number(d?.value ?? 0);
                const label = String(d?.label ?? "").trim();
                const date = String(d?.date ?? "").trim();
                // Fallback label from date (YYYY-MM-DD -> first letter of weekday is unknown w/o tz; keep short).
                const safeLabel = label || (date ? date.slice(5) : String(i + 1));
                return { v: Number.isFinite(v) ? v : 0, label: safeLabel };
              });
              const values = normalized.map((x) => x.v);
              const maxV = Math.max(1, ...values);
              const allZero = values.every((x) => x === 0);

              if (!normalized.length) {
                return (
                  <div className="h-20 flex items-center justify-center text-sm font-semibold text-slate-500">
                    No activity yet — start a lesson to see your progress here.
                  </div>
                );
              }

              return (
                <div className="flex items-end gap-3 h-28">
                  {normalized.map((x, idx) => {
                    const h = Math.round((x.v / maxV) * 88);
                    return (
                      <div key={idx} className="flex flex-col items-center gap-2 flex-1">
                        <div className="w-full max-w-[46px]">
                          <div className="relative h-20 w-full rounded-2xl bg-brand-50 overflow-hidden ring-1 ring-brand-100">
                            <div
                              className="absolute bottom-0 left-0 right-0 rounded-2xl"
                              style={{
                                height: `${allZero ? 8 : Math.max(8, h)}px`,
                                background:
                                  "linear-gradient(180deg, rgba(255,122,26,.95), rgba(232,95,0,.8))",
                              }}
                              title={`${x.label}: ${x.v}`}
                            />
                          </div>
                        </div>
                        <div className="text-[11px] font-bold text-slate-500">{x.label}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center bg-brand-50 rounded-2xl px-3 py-2.5">
              <span className="text-xs font-bold text-slate-600">Total lessons completed</span>
              <span className="font-display text-sm font-extrabold text-slate-800">{lessonsCompleted}</span>
            </div>

            <div className="flex justify-between items-center bg-grass-50 rounded-2xl px-3 py-2.5">
              <span className="text-xs font-bold text-slate-600">Best streak</span>
              <span className="font-display text-sm font-extrabold text-slate-800">{streak} days</span>
            </div>

            <div className="flex justify-between items-center bg-feather-50 rounded-2xl px-3 py-2.5">
              <span className="text-xs font-bold text-slate-600">Lifetime XP</span>
              <span className="font-display text-sm font-extrabold text-slate-800">{xp}</span>
            </div>
          </div>
        </div>

      </section>

      <AccountDangerZone />

      {!!message && (
        <div className="rounded-2xl ring-1 ring-brand-200 bg-brand-50 px-4 py-3 text-sm font-bold text-brand-700">
          {message}
        </div>
      )}
    </div>
  );
}
