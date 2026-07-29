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
  Eye,
  Camera,
  Pencil,
  Sparkles,
  BookOpen,
  ExternalLink,
  Check,
  Copy,
  Share2,
  Award,
  Crown,
  Wand2,
} from "lucide-react";

import { StarMotif } from "./lib/motifs";
import ActivityChart from "./lib/ActivityChart";
import AccountDangerZone from "./AccountDangerZone";
import AvatarBuilder, { generateRandomAvatarFile } from "./AvatarBuilder";
import BannerBuilder from "./BannerBuilder";
import AvatarFrame from "./lib/avatarFrame";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  "https://haylinguav2.onrender.com";

const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "haylinguabot";
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "387340156498-udb3h083d3mcnj135kvbfcstsdslbe64.apps.googleusercontent.com";
const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID || "";

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

function StatTile({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
      <div className={"grid h-9 w-9 place-items-center rounded-xl " + tone}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-2 font-display text-2xl font-extrabold tabular-nums text-slate-800 dark:text-white">{value}</div>
      <div className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-stone-500">{label}</div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-2 whitespace-nowrap rounded-2xl px-4 py-2.5 font-display text-sm font-extrabold transition " +
        (active
          ? "bg-brand-500 text-white shadow-btn-brand"
          : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-[#18181b] dark:text-stone-400 dark:ring-white/[0.08] dark:hover:bg-white/[0.04]")
      }
    >
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
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
  const [isPremium, setIsPremium] = useState(false);

  const [bannerUrl, setBannerUrl] = useState("");
  const [showBannerPicker, setShowBannerPicker] = useState(false);
  const [showBannerBuilder, setShowBannerBuilder] = useState(false);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(""); // local preview only
  const [avatarPresetUrl, setAvatarPresetUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [showAvatarPresets, setShowAvatarPresets] = useState(false);
  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);

  // Stats
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [last7, setLast7] = useState([]);
  const [summary, setSummary] = useState(null);
  const [lessonsCompleted, setLessonsCompleted] = useState(0);

  // Frames
  const [ownedFrames, setOwnedFrames] = useState([]);
  const [activeFrame, setActiveFrame] = useState(null);
  const [activeFrameStyle, setActiveFrameStyle] = useState(null);
  const [shopItems, setShopItems] = useState([]);
  const [frameEquipping, setFrameEquipping] = useState(null);

  // Share
  const [copied, setCopied] = useState(false);

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

  // Voice preference
  const [voiceRandom, setVoiceRandom] = useState(true);
  const [voiceMale, setVoiceMale] = useState(true);
  const [voiceFemale, setVoiceFemale] = useState(true);

  // Telegram linking
  const [telegramId, setTelegramId] = useState(null);
  const tgLinkContainerRef = useRef(null);

  // Google linking
  const [googleLinked, setGoogleLinked] = useState(false);

  // Facebook linking
  const [facebookLinked, setFacebookLinked] = useState(false);

  // UX state
  const [tab, setTab] = useState("overview"); // overview | edit | appearance | security
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

  const computedVoicePref = voiceRandom || (voiceMale && voiceFemale)
    ? "Random"
    : voiceMale
    ? "Male"
    : voiceFemale
    ? "Female"
    : "Random";

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
          setIsPremium(!!data.is_premium);

          const b = data.banner_url || "";
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

          // First-ever visit to this page: banner AND avatar are both still
          // untouched. Rather than leaving the header blank, randomly assign
          // one of each — gated on BOTH being empty (not just one) so a
          // returning user who already picked, say, a banner but never got
          // to the avatar doesn't get a surprise random avatar on their next
          // visit; that'd only be "first time" for the field they hadn't
          // touched yet, not for the page.
          if (!b && !au) {
            const randomBanner = PRESET_BANNERS[Math.floor(Math.random() * PRESET_BANNERS.length)];
            handleSelectPresetBanner(randomBanner, { silent: true });
            // Presets were removed for avatars — generate a random Duo-style
            // cartoon avatar instead (same builder used by "Build an avatar").
            generateRandomAvatarFile()
              .then((file) => handleAvatarBuilderSave(file, { silent: true }))
              .catch(() => {});
          }

          // Voice preference
          const vp = data.voice_pref || "Random";
          if (vp === "Male") {
            setVoiceRandom(false); setVoiceMale(true); setVoiceFemale(false);
          } else if (vp === "Female") {
            setVoiceRandom(false); setVoiceMale(false); setVoiceFemale(true);
          } else {
            setVoiceRandom(true); setVoiceMale(true); setVoiceFemale(true);
          }

          // Telegram link status
          setTelegramId(data.telegram_id || null);

          // Google link status
          setGoogleLinked(Boolean(data.google_linked));

          // Facebook link status
          setFacebookLinked(Boolean(data.facebook_linked));

          // Stats preview in header (safe fallbacks)
          setLevel(data.level || 1);
          setXp(data.xp || data.total_xp || 0);
          setStreak(data.streak || data.daily_streak || 0);
          setBestStreak(data.best_streak || 0);

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
        const a = await apiFetch("/me/activity?days=30", { token });
        const ad = await safeJsonParse(a);
        if (!cancelled && a.ok && ad?.days) setLast7(ad.days);
      } catch {}

      try {
        const sm = await apiFetch("/me/learning/summary", { token });
        const smd = await safeJsonParse(sm);
        if (!cancelled && sm.ok && smd) setSummary(smd);
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

      try {
        const w = await apiFetch("/me/wallet", { token });
        const wd = await safeJsonParse(w);
        if (!cancelled && w.ok && wd) {
          setOwnedFrames(wd.owned_frames || []);
          setActiveFrame(wd.active_frame || null);
          setActiveFrameStyle(wd.active_frame_style || null);
        }
      } catch {}

      try {
        const sh = await apiFetch("/me/shop", { token });
        const shd = await safeJsonParse(sh);
        if (!cancelled && sh.ok && shd?.items) setShopItems(shd.items);
      } catch {}
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Show a confirmation + land on the Security tab after a Google link redirect.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("linked") === "google") {
      setGoogleLinked(true);
      setTab("security");
      setMessage("Google account linked.");
      // Clean the query param so a refresh doesn't re-trigger the toast.
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("linked") === "facebook") {
      setFacebookLinked(true);
      setTab("security");
      setMessage("Facebook account linked.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

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
        voice_pref: computedVoicePref,
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
      };

      const res = await apiFetch("/me/profile", {
        token,
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        try { localStorage.setItem("hay_voice_pref", computedVoicePref || "Random"); } catch {}
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

  function handleSelectPresetBanner(url, opts = {}) {
    bannerTouchedRef.current = true;
    setBannerUrl(url);
    if (!opts.silent) {
      setShowBannerPicker(false);
      setMessage("Banner selected.");
    }
  }

  async function uploadBannerFile(file, opts = {}) {
    try {
      setBannerBusy(true);
      if (!opts.silent) setMessage("");
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/me/banner", {
        token,
        method: "POST",
        body: fd,
      });
      const data = await safeJsonParse(res);
      if (!res.ok) {
        if (!opts.silent) setMessage(data?.detail || "Banner upload failed.");
        return;
      }
      const url = data?.banner_url || "";
      bannerTouchedRef.current = true;
      setBannerUrl(url);
      setShowBannerPicker(false);
      setShowBannerBuilder(false);
      if (!opts.silent) setMessage(opts.successMessage || "Banner uploaded.");
    } catch {
      if (!opts.silent) setMessage("Banner upload failed.");
    } finally {
      setBannerBusy(false);
    }
  }

  function handleUploadBanner() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      uploadBannerFile(file);
    };
    input.click();
  }

  function handleBannerBuilderSave(file) {
    uploadBannerFile(file, { successMessage: "Banner created." });
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

  function handleAvatarBuilderSave(file, opts = {}) {
    setShowAvatarPresets(false);
    setShowAvatarBuilder(false);
    setAvatarPresetUrl("");
    setAvatarFile(file);
    avatarTouchedRef.current = true;
    const url = URL.createObjectURL(file);
    if (avatarObjectUrlRef.current) {
      try { URL.revokeObjectURL(avatarObjectUrlRef.current); } catch {}
    }
    avatarObjectUrlRef.current = url;
    setAvatarPreview(url);
    if (!opts.silent) setMessage("Avatar created.");
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

  // Telegram link widget — only rendered when not already linked and on security tab
  useEffect(() => {
    if (!TELEGRAM_BOT_USERNAME || !tgLinkContainerRef.current) return;
    if (telegramId) { tgLinkContainerRef.current.innerHTML = ""; return; }

    tgLinkContainerRef.current.innerHTML = "";

    window.onTelegramLink = async (tgUser) => {
      try {
        const res = await apiFetch("/me/link/telegram", {
          token,
          method: "POST",
          body: JSON.stringify(tgUser),
        });
        const d = await safeJsonParse(res);
        if (!res.ok) throw new Error(d?.detail || "Failed to link Telegram");
        setTelegramId(Number(tgUser.id) || d?.telegram_id || 1);
        setMessage("Telegram account linked.");
      } catch (e) {
        setMessage(String(e?.message || "Failed to link Telegram."));
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", TELEGRAM_BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramLink(user)");
    script.setAttribute("data-request-access", "write");
    script.async = true;
    tgLinkContainerRef.current.appendChild(script);

    return () => { delete window.onTelegramLink; };
  }, [TELEGRAM_BOT_USERNAME, token, telegramId, tab]);

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
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:bg-[#0d0d0f] dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
        <div className="max-w-5xl mx-auto px-4 py-10 font-display font-extrabold text-slate-500 dark:text-stone-400">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:bg-[#0d0d0f] dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* ===================== HERO ===================== */}
      <div className="rounded-3xl overflow-hidden shadow-sm ring-1 ring-slate-200 bg-white dark:ring-white/[0.08] dark:bg-[#18181b]">
        {/* Banner */}
        <div
          className={"relative h-40 md:h-48 " + (bannerUrl ? "" : "bg-gradient-to-br from-brand-400 to-brand-600")}
          style={
            bannerUrl
              ? {
                  backgroundImage: `url(${resolveUrl(bannerUrl)})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />

          <div className="absolute right-3 top-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBannerPicker(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/90 px-3 py-1.5 text-xs font-extrabold text-slate-700 shadow-sm ring-1 ring-white/60 backdrop-blur transition hover:bg-white"
            >
              <ImageIcon className="h-4 w-4 text-brand-500" /> Banner
            </button>
            <button
              type="button"
              onClick={() => setIsHidden((v) => !v)}
              title={isHidden ? "Your public profile is hidden" : "Your profile is visible"}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/90 px-3 py-1.5 text-xs font-extrabold text-slate-700 shadow-sm ring-1 ring-white/60 backdrop-blur transition hover:bg-white"
            >
              {isHidden ? <EyeOff className="h-4 w-4 text-cardinal-500" /> : <Eye className="h-4 w-4 text-grass-500" />}
              {isHidden ? "Hidden" : "Public"}
            </button>
          </div>
        </div>

        {/* Identity */}
        <div className="px-5 pb-6 md:px-7">
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="relative shrink-0">
                <AvatarFrame frameStyle={activeFrameStyle} size={96} radius="1.5rem" thickness={3}>
                  <div className={"h-full w-full overflow-hidden rounded-3xl bg-white shadow-md dark:bg-[#18181b] " + (activeFrameStyle ? "" : isPremium ? "ring-4 ring-gold-400" : "ring-4 ring-white")}>
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-brand-50 font-display text-3xl font-extrabold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                        {(firstName || username || "H")[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                </AvatarFrame>
                {isPremium && (
                  <span title="Premium" className="absolute -top-1 -left-1 grid h-7 w-7 place-items-center rounded-full bg-gold-500 text-white shadow-[0_2px_0_0_#B45309] ring-2 ring-white dark:ring-[#18181b]">
                    <Crown className="h-3.5 w-3.5" />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowAvatarPresets((v) => !v)}
                  title="Change avatar"
                  className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-brand-500 text-white shadow-md ring-2 ring-white transition hover:bg-brand-600"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>

              <div className="pb-1">
                <h1 className="font-display text-2xl font-extrabold leading-tight text-slate-800 dark:text-white">
                  {firstName || lastName ? `${firstName} ${lastName}`.trim() : username || "Your profile"}
                </h1>
                <div className="text-sm font-bold text-slate-400 dark:text-stone-500">@{username || "set-a-username"}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {publicProfileHref ? (
                <a href={publicProfileHref} className="btn3d btn3d-neutral text-sm">
                  <ExternalLink className="h-4 w-4 text-brand-500" /> View public profile
                </a>
              ) : (
                <button type="button" onClick={() => setTab("edit")} className="btn3d btn3d-brand text-sm">
                  <Pencil className="h-4 w-4" /> Set a username
                </button>
              )}
            </div>
          </div>

          {/* Avatar picker (toggled) */}
          {showAvatarPresets && (
            <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/[0.08]">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={handleAvatarPick} className="btn3d btn3d-brand text-xs">
                  <ImageIcon className="h-4 w-4" /> Upload
                </button>
                <button type="button" onClick={() => setShowAvatarBuilder(true)} className="btn3d btn3d-neutral text-xs">
                  <Wand2 className="h-4 w-4" /> Build an avatar
                </button>
              </div>
            </div>
          )}

          {bio ? <p className="mt-4 max-w-2xl text-sm font-semibold text-slate-600 dark:text-stone-300">{bio}</p> : null}

          {/* Stat tiles */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile icon={Trophy} tone="bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400" label="Level" value={level} />
            <StatTile icon={StarMotif} tone="bg-gold-100 text-gold-600 dark:bg-gold-500/20 dark:text-gold-400" label="Total XP" value={xp} />
            <StatTile icon={Flame} tone="bg-cardinal-50 text-cardinal-500 dark:bg-cardinal-500/15 dark:text-cardinal-400" label="Day streak" value={streak} />
            <StatTile icon={BookOpen} tone="bg-grass-50 text-grass-600 dark:bg-grass-500/15 dark:text-grass-400" label="Lessons" value={lessonsCompleted} />
          </div>
        </div>
      </div>

      {/* ===================== TABS ===================== */}
      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "overview"} onClick={() => setTab("overview")} icon={Sparkles}>Overview</TabButton>
        <TabButton active={tab === "edit"} onClick={() => setTab("edit")} icon={Pencil}>Edit profile</TabButton>
        <TabButton active={tab === "appearance"} onClick={() => setTab("appearance")} icon={Palette}>Appearance</TabButton>
        <TabButton active={tab === "security"} onClick={() => setTab("security")} icon={ShieldCheck}>Security</TabButton>
      </div>

      {/* Banner picker modal */}
      {showBannerPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => (bannerBusy ? null : setShowBannerPicker(false))}
          />
          <div className="relative w-full max-w-3xl rounded-3xl ring-1 ring-slate-200 bg-white shadow-xl overflow-hidden dark:ring-white/[0.08] dark:bg-[#18181b]">
            <div className="p-5 md:p-6 border-b border-slate-100 flex items-center justify-between dark:border-white/[0.06]">
              <div>
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">Choose a banner</div>
                <div className="text-xs font-semibold text-slate-500 mt-0.5 dark:text-stone-400">Pick a preset or upload your own.</div>
              </div>
              <button
                type="button"
                disabled={bannerBusy}
                onClick={() => setShowBannerPicker(false)}
                className="rounded-xl px-3 py-2 text-sm font-extrabold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-stone-300 dark:hover:bg-white/[0.06]"
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
                          : "ring-slate-200 hover:ring-brand-300 dark:ring-white/[0.08]")
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
                    onClick={() => setShowBannerBuilder(true)}
                    className="btn3d btn3d-neutral text-sm"
                  >
                    <Wand2 className="w-4 h-4" /> Build a banner
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

                <div className="text-xs font-semibold text-slate-500 dark:text-stone-400">
                  Tip: presets are fast; uploads let you personalize fully.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Edit profile tab ===== */}
      {tab === "edit" && (
      <section className="rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
        <h2 className="font-display text-lg font-extrabold text-slate-800 mb-4 dark:text-white">Profile details</h2>

        <form onSubmit={handleSaveCore} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-extrabold text-slate-700 mb-1.5 dark:text-stone-200">First name</label>
              <input
                type="text"
                className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none placeholder:text-slate-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Armen"
                autoComplete="given-name"
              />
            </div>

            <div>
              <label className="block text-sm font-extrabold text-slate-700 mb-1.5 dark:text-stone-200">Last name</label>
              <input
                type="text"
                className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none placeholder:text-slate-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Ghazaryan"
                autoComplete="family-name"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-extrabold text-slate-700 mb-1.5 dark:text-stone-200">Public username</label>
              <input
                type="text"
                className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none placeholder:text-slate-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your-username"
                autoComplete="username"
              />
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-600 ring-2 ring-slate-200 truncate dark:bg-white/[0.04] dark:text-stone-300 dark:ring-white/[0.08]">
                  {publicProfileHref ? `${window.location.origin}${publicProfileHref}` : "—"}
                </div>
                {publicProfileHref ? (
                  <a
                    href={publicProfileHref}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-extrabold bg-brand-50 text-brand-600 ring-2 ring-brand-100 hover:bg-brand-100 transition-colors dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/30 dark:hover:bg-brand-500/20"
                  >
                    <Link2 className="w-4 h-4" />
                    Open
                  </a>
                ) : (
                  <span className="text-xs font-semibold text-slate-400 dark:text-stone-500">Set a username</span>
                )}
              </div>
              <p className="mt-1.5 text-xs font-semibold text-slate-400 dark:text-stone-500">
                If the account is hidden, your public page will show only “This account is hidden”.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-extrabold text-slate-700 mb-1.5 dark:text-stone-200">Bio</label>
              <textarea
                rows={3}
                className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none placeholder:text-slate-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Write something short…"
              />
            </div>

            <div>
              <label className="block text-sm font-extrabold text-slate-700 mb-1.5 dark:text-stone-200">Email address</label>
              <input
                type="email"
                className="w-full rounded-2xl bg-slate-100 px-4 py-3 font-semibold text-slate-500 ring-2 ring-slate-200 cursor-not-allowed dark:bg-white/[0.06] dark:text-stone-400 dark:ring-white/[0.08]"
                value={email}
                readOnly
                disabled
              />
              <p className="mt-1.5 text-xs font-semibold text-slate-400 dark:text-stone-500">
                Email can only be changed via Account security (with confirmation).
              </p>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => setFriendsPublic((v) => !v)}
                className={"w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ring-1 transition " + (friendsPublic ? "bg-grass-50 ring-grass-200 dark:bg-grass-500/15 dark:ring-grass-500/30" : "bg-slate-50 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/[0.08]")}
              >
                <div className="text-left">
                  <p className="text-sm font-extrabold text-slate-700 dark:text-stone-200">Show friends list publicly</p>
                  <p className="text-xs font-semibold text-slate-400 mt-0.5 dark:text-stone-500">
                    {friendsPublic ? "Visible on your public profile" : "Hidden from your public profile"}
                  </p>
                </div>
                <div className={"relative shrink-0 h-6 w-11 rounded-full transition-colors duration-200 " + (friendsPublic ? "bg-grass-500" : "bg-slate-300 dark:bg-white/10")}>
                  <span className={"absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 " + (friendsPublic ? "translate-x-5" : "translate-x-0")} />
                </div>
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="text-sm font-extrabold text-slate-700 mb-2 dark:text-stone-200">Voice preference</div>
            <p className="text-xs font-semibold text-slate-400 mb-3 dark:text-stone-500">
              Choose the voice used when listening to Armenian words and phrases.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  key: "male",
                  label: "Male voice",
                  sub: "Clear pronunciation & lower pitch",
                  active: !voiceRandom && voiceMale && !voiceFemale,
                  onSelect: () => { setVoiceRandom(false); setVoiceMale(true); setVoiceFemale(false); },
                },
                {
                  key: "female",
                  label: "Female voice",
                  sub: "Natural pitch variation & clarity",
                  active: !voiceRandom && voiceFemale && !voiceMale,
                  onSelect: () => { setVoiceRandom(false); setVoiceMale(false); setVoiceFemale(true); },
                },
                {
                  key: "random",
                  label: "Mix both",
                  sub: "Best for real-world listening variety",
                  active: voiceRandom || (voiceMale && voiceFemale),
                  onSelect: () => { setVoiceRandom(true); setVoiceMale(true); setVoiceFemale(true); },
                },
              ].map(({ key, label, sub, active, onSelect }) => (
                <button
                  key={key}
                  type="button"
                  onClick={onSelect}
                  className={
                    "flex flex-col items-start gap-1 rounded-2xl p-3 ring-2 text-left transition " +
                    (active
                      ? "bg-brand-50 ring-brand-400 text-brand-700 dark:bg-brand-500/15 dark:ring-brand-500/30 dark:text-brand-400"
                      : "bg-slate-50 ring-slate-200 text-slate-700 hover:ring-brand-300 dark:bg-white/[0.04] dark:ring-white/[0.08] dark:text-stone-200")
                  }
                >
                  <span className="font-display text-sm font-extrabold">{label}</span>
                  <span className="text-xs font-semibold opacity-70">{sub}</span>
                  {active && <Check className="mt-1 h-4 w-4 text-brand-500" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end md:col-span-2">
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
      )}

      {/* Email change modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setEmailModalOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-xl ring-1 ring-slate-200 overflow-hidden dark:bg-[#18181b] dark:ring-white/[0.08]">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between dark:border-white/[0.06]">
              <div className="font-display font-extrabold text-slate-800 flex items-center gap-2 dark:text-white">
                <Mail className="w-4 h-4 text-brand-500" /> Change email
              </div>
              <button
                type="button"
                className="h-9 w-9 rounded-xl hover:bg-slate-100 grid place-items-center text-slate-500 font-bold dark:hover:bg-white/[0.06] dark:text-stone-400"
                onClick={() => setEmailModalOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              {emailStage === "start" ? (
                <>
                  <p className="text-sm font-semibold text-slate-600 dark:text-stone-300">
                    We’ll send a 6‑digit code to your new email address.
                  </p>
                  <label className="block mt-4 text-sm font-extrabold text-slate-700 mb-1.5 dark:text-stone-200">
                    New email
                  </label>
                  <input
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    type="email"
                    placeholder="name@example.com"
                    className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none placeholder:text-slate-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500"
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
                  <p className="text-sm font-semibold text-slate-600 dark:text-stone-300">
                    Enter the code sent to <span className="font-extrabold text-slate-800 dark:text-white">{newEmail}</span>.
                  </p>
                  {!!emailDevCode && (
                    <div className="mt-3 rounded-2xl ring-1 ring-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 dark:ring-brand-500/30 dark:bg-brand-500/15 dark:text-brand-400">
                      Email delivery is not configured. Use this code: <span className="font-mono font-bold">{emailDevCode}</span>
                    </div>
                  )}
                  <label className="block mt-4 text-sm font-extrabold text-slate-700 mb-1.5 dark:text-stone-200">6‑digit code</label>
                  <input
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value)}
                    inputMode="numeric"
                    placeholder="123456"
                    className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none placeholder:text-slate-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500"
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
          <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-xl ring-1 ring-slate-200 overflow-hidden dark:bg-[#18181b] dark:ring-white/[0.08]">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between dark:border-white/[0.06]">
              <div className="font-display font-extrabold text-slate-800 flex items-center gap-2 dark:text-white">
                <KeyRound className="w-4 h-4 text-brand-500" /> Change password
              </div>
              <button
                type="button"
                className="h-9 w-9 rounded-xl hover:bg-slate-100 grid place-items-center text-slate-500 font-bold dark:hover:bg-white/[0.06] dark:text-stone-400"
                onClick={() => setPwModalOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              <label className="block text-sm font-extrabold text-slate-700 mb-1.5 dark:text-stone-200">Current password</label>
              <input
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                type="password"
                className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none placeholder:text-slate-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500"
              />

              <label className="block mt-4 text-sm font-extrabold text-slate-700 mb-1.5 dark:text-stone-200">New password</label>
              <input
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                type="password"
                className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none placeholder:text-slate-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500"
              />

              <label className="block mt-4 text-sm font-extrabold text-slate-700 mb-1.5 dark:text-stone-200">Repeat new password</label>
              <input
                value={newPw2}
                onChange={(e) => setNewPw2(e.target.value)}
                type="password"
                className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none placeholder:text-slate-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500"
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
          <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-xl ring-1 ring-slate-200 overflow-hidden dark:bg-[#18181b] dark:ring-white/[0.08]">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between dark:border-white/[0.06]">
              <div className="font-display font-extrabold text-slate-800 flex items-center gap-2 dark:text-white">
                <ShieldCheck className="w-4 h-4 text-brand-500" /> Two‑factor authentication
              </div>
              <button
                type="button"
                className="h-9 w-9 rounded-xl hover:bg-slate-100 grid place-items-center text-slate-500 font-bold dark:hover:bg-white/[0.06] dark:text-stone-400"
                onClick={() => setTwoFaOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-bold text-slate-700 dark:text-stone-200">
                  Status: {twoFaEnabled ? (
                    <span className="inline-flex items-center gap-1 font-extrabold text-grass-600 dark:text-grass-400">Enabled</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-extrabold text-slate-500 dark:text-stone-400">Disabled</span>
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
                  <div className="rounded-3xl ring-1 ring-slate-200 p-4 bg-slate-50 dark:ring-white/[0.08] dark:bg-white/[0.04]">
                    <div className="text-xs font-extrabold text-slate-700 dark:text-stone-200">Scan QR</div>
                    <img
                      src={twoFaSetup.qr_png}
                      alt="2FA QR"
                      className="mt-3 w-full rounded-2xl bg-white p-3 ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]"
                    />
                    <div className="mt-3 text-xs font-semibold text-slate-500 dark:text-stone-400">
                      Or enter this secret manually:
                    </div>
                    <div className="mt-1 font-mono text-xs bg-white ring-1 ring-slate-200 rounded-2xl px-3 py-2 text-slate-700 dark:bg-[#18181b] dark:ring-white/[0.08] dark:text-stone-200">
                      {twoFaSetup.secret}
                    </div>
                  </div>

                  <div className="rounded-3xl ring-1 ring-slate-200 p-4 dark:ring-white/[0.08]">
                    <div className="font-display text-sm font-extrabold text-slate-800 dark:text-white">Verify</div>
                    <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-stone-300">
                      After adding Haylingua to your authenticator app, enter the 6‑digit code.
                    </p>
                    <label className="block mt-4 text-sm font-extrabold text-slate-700 mb-1.5 dark:text-stone-200">Code</label>
                    <input
                      value={twoFaCode}
                      onChange={(e) => setTwoFaCode(e.target.value)}
                      inputMode="numeric"
                      placeholder="123456"
                      className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none placeholder:text-slate-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500"
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
                <div className="mt-5 rounded-3xl ring-1 ring-slate-200 p-4 bg-slate-50 dark:ring-white/[0.08] dark:bg-white/[0.04]">
                  <div className="font-display text-sm font-extrabold text-slate-800 dark:text-white">Disable 2FA</div>
                  <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-stone-300">
                    For safety, provide either a current authenticator code or your password.
                  </p>
                  <div className="mt-4 grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-extrabold text-slate-700 mb-1.5 dark:text-stone-200">Authenticator code</label>
                      <input
                        value={twoFaDisableCode}
                        onChange={(e) => setTwoFaDisableCode(e.target.value)}
                        inputMode="numeric"
                        placeholder="123456"
                        className="w-full rounded-2xl bg-white px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:ring-brand-400 focus:outline-none placeholder:text-slate-400 dark:bg-[#18181b] dark:text-white dark:ring-white/[0.08] dark:placeholder:text-stone-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-extrabold text-slate-700 mb-1.5 dark:text-stone-200">Current password</label>
                      <input
                        value={twoFaDisablePw}
                        onChange={(e) => setTwoFaDisablePw(e.target.value)}
                        type="password"
                        className="w-full rounded-2xl bg-white px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 focus:ring-brand-400 focus:outline-none placeholder:text-slate-400 dark:bg-[#18181b] dark:text-white dark:ring-white/[0.08] dark:placeholder:text-stone-500"
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
                    <div className="mt-4 rounded-2xl ring-1 ring-brand-200 bg-brand-50 px-4 py-3 dark:ring-brand-500/30 dark:bg-brand-500/15">
                      <div className="text-xs font-extrabold text-brand-700 dark:text-brand-400">Recovery codes</div>
                      <div className="mt-2 grid sm:grid-cols-2 gap-2 font-mono text-xs text-brand-800 dark:text-brand-400">
                        {twoFaRecovery.map((c) => (
                          <div key={c} className="rounded-xl bg-white/70 ring-1 ring-brand-100 px-3 py-2 dark:bg-white/[0.06] dark:ring-brand-500/30">
                            {c}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-xs font-semibold text-brand-700 dark:text-brand-400">
                        Save these codes somewhere safe. Each code can be used once.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!twoFaEnabled && twoFaRecovery?.length > 0 && (
                <div className="mt-5 rounded-2xl ring-1 ring-brand-200 bg-brand-50 px-4 py-3 dark:ring-brand-500/30 dark:bg-brand-500/15">
                  <div className="text-xs font-extrabold text-brand-700 dark:text-brand-400">Recovery codes</div>
                  <div className="mt-2 grid sm:grid-cols-2 gap-2 font-mono text-xs text-brand-800 dark:text-brand-400">
                    {twoFaRecovery.map((c) => (
                      <div key={c} className="rounded-xl bg-white/70 ring-1 ring-brand-100 px-3 py-2 dark:bg-white/[0.06] dark:ring-brand-500/30">
                        {c}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs font-semibold text-brand-700 dark:text-brand-400">
                    Save these codes somewhere safe. Each code can be used once.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Avatar frames ===== */}
      {tab === "appearance" && (
<section className="rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
  <div className="flex items-center gap-2 mb-1">
    <Award className="w-5 h-5 text-brand-500 shrink-0" />
    <h2 className="font-display text-lg font-extrabold text-slate-800 dark:text-white">Avatar frame</h2>
  </div>
  <p className="text-sm font-semibold text-slate-500 mb-4 dark:text-stone-400">
    Equip a frame you own from the shop to show it on your public profile.
  </p>

  {ownedFrames.length === 0 ? (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <Award className="w-10 h-10 text-slate-300 dark:text-stone-600" />
      <p className="text-sm font-bold text-slate-400 dark:text-stone-500">No frames owned yet.</p>
      <p className="text-xs font-semibold text-slate-400 dark:text-stone-500">Visit the shop to buy avatar frames.</p>
    </div>
  ) : (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {/* No frame option */}
      <button
        type="button"
        onClick={async () => {
          if (activeFrame === null) return;
          setFrameEquipping("none");
          try {
            const r = await apiFetch("/me/active-frame", { token, method: "PUT", body: JSON.stringify({ frame_id: null }) });
            if (r.ok) { setActiveFrame(null); setActiveFrameStyle(null); window.dispatchEvent(new CustomEvent("hay_wallet")); }
          } catch {}
          setFrameEquipping(null);
        }}
        className={"flex flex-col items-center gap-1.5 rounded-2xl p-3 ring-2 transition " + (activeFrame === null ? "ring-brand-500 bg-brand-50 dark:bg-brand-500/15" : "ring-slate-200 hover:ring-brand-300 bg-white dark:ring-white/[0.08] dark:bg-[#18181b]")}
      >
        <div className="w-12 h-12 rounded-full bg-slate-100 ring-2 ring-slate-200 flex items-center justify-center dark:bg-white/[0.06] dark:ring-white/[0.08]">
          <span className="text-xl font-extrabold text-slate-400 dark:text-stone-500">{String(username || "?")[0]?.toUpperCase()}</span>
        </div>
        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide leading-tight dark:text-stone-400">None</span>
        {activeFrame === null && <Check className="h-3.5 w-3.5 text-brand-500" />}
      </button>

      {ownedFrames.map((fid) => {
        const item = shopItems.find((i) => String(i.id) === String(fid));
        const isActive = String(activeFrame) === String(fid);
        const isEquipping = frameEquipping === String(fid);
        const frameTitle = item?.title || `Frame #${fid}`;
        return (
          <button
            key={fid}
            type="button"
            disabled={isActive || isEquipping}
            onClick={async () => {
              setFrameEquipping(String(fid));
              try {
                const r = await apiFetch("/me/active-frame", { token, method: "PUT", body: JSON.stringify({ frame_id: fid }) });
                if (r.ok) { setActiveFrame(String(fid)); setActiveFrameStyle(item?.frame_style || null); window.dispatchEvent(new CustomEvent("hay_wallet")); }
              } catch {}
              setFrameEquipping(null);
            }}
            className={"flex flex-col items-center gap-1.5 rounded-2xl p-3 ring-2 transition " + (isActive ? "ring-brand-500 bg-brand-50 dark:bg-brand-500/15" : "ring-slate-200 hover:ring-brand-300 bg-white dark:ring-white/[0.08] dark:bg-[#18181b]")}
          >
            <AvatarFrame frameStyle={item?.frame_style} size={48} radius="9999px" thickness={2.5}>
              <div className="h-full w-full rounded-full flex items-center justify-center bg-slate-100 dark:bg-white/[0.06]">
                <span className="text-xl font-extrabold text-slate-500 dark:text-stone-300">
                  {String(username || "?")[0]?.toUpperCase()}
                </span>
              </div>
            </AvatarFrame>
            <span className="text-[10px] font-extrabold text-slate-600 leading-tight text-center dark:text-stone-300">{frameTitle}</span>
            {isActive && <Check className="h-3.5 w-3.5 text-brand-500" />}
            {isEquipping && <span className="text-[10px] text-slate-400 font-bold dark:text-stone-500">Saving…</span>}
          </button>
        );
      })}
    </div>
  )}
</section>
      )}

      {/* ===== Security tab ===== */}
      {tab === "security" && (
      <section className="rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
        <h2 className="font-display text-lg font-extrabold text-slate-800 mb-4 dark:text-white">Account security</h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl ring-1 ring-slate-200 p-4 dark:ring-white/[0.08]">
            <div className="flex items-center gap-2 font-display font-extrabold text-slate-800 dark:text-white">
              <Mail className="w-4 h-4 text-brand-500" />
              Change email
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-stone-300">
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

          <div className="rounded-2xl ring-1 ring-slate-200 p-4 dark:ring-white/[0.08]">
            <div className="flex items-center gap-2 font-display font-extrabold text-slate-800 dark:text-white">
              <KeyRound className="w-4 h-4 text-brand-500" />
              Change password
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-stone-300">
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

          <div className="rounded-2xl ring-1 ring-slate-200 p-4 dark:ring-white/[0.08] md:col-span-2">
            <div className="flex items-center gap-2 font-display font-extrabold text-slate-800 dark:text-white">
              <ShieldCheck className="w-4 h-4 text-brand-500" />
              Two-factor authentication (2FA)
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-stone-300">
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

          {/* Telegram account linking */}
          <div className="rounded-2xl ring-1 ring-slate-200 p-4 dark:ring-white/[0.08] md:col-span-2">
            <div className="flex items-center gap-2 font-display font-extrabold text-slate-800 dark:text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0">
                <path d="M22 2L11 13" stroke="#2AABEE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#2AABEE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Telegram
            </div>

            {telegramId ? (
              <>
                <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-stone-300">
                  Your account is linked to Telegram (ID&nbsp;
                  <span className="font-mono font-bold text-slate-800 dark:text-white">{telegramId}</span>).
                  You can sign in with Telegram on any device.
                </p>
                <button
                  type="button"
                  className="btn3d btn3d-neutral text-sm mt-3"
                  onClick={async () => {
                    try {
                      const res = await apiFetch("/me/link/telegram", { token, method: "DELETE" });
                      if (!res.ok) { const d = await safeJsonParse(res); throw new Error(d?.detail || "Failed to unlink"); }
                      setTelegramId(null);
                      setMessage("Telegram account unlinked.");
                    } catch (e) {
                      setMessage(String(e?.message || "Failed to unlink Telegram."));
                    }
                  }}
                >
                  Unlink Telegram
                </button>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-stone-300">
                  Link your Telegram account to sign in with one tap — no password needed.
                </p>
                <div className="relative mt-3 h-11 w-48">
                  <div
                    ref={tgLinkContainerRef}
                    style={{ position: "absolute", inset: 0, opacity: 0, overflow: "hidden" }}
                  />
                  <div
                    style={{ pointerEvents: "none" }}
                    className="absolute inset-0 flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700 shadow-sm dark:border-white/[0.08] dark:bg-[#18181b] dark:text-stone-200"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M22 2L11 13" stroke="#2AABEE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#2AABEE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Link Telegram
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Google account linking */}
          <div className="rounded-2xl ring-1 ring-slate-200 p-4 dark:ring-white/[0.08] md:col-span-2">
            <div className="flex items-center gap-2 font-display font-extrabold text-slate-800 dark:text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"/>
              </svg>
              Google
            </div>

            {googleLinked ? (
              <>
                <button
                  type="button"
                  className="btn3d btn3d-neutral text-sm mt-2"
                  onClick={async () => {
                    try {
                      const res = await apiFetch("/me/link/google", { token, method: "DELETE" });
                      if (!res.ok) { const d = await safeJsonParse(res); throw new Error(d?.detail || "Failed to unlink"); }
                      setGoogleLinked(false);
                      setMessage("Google account unlinked.");
                    } catch (e) {
                      setMessage(String(e?.message || "Failed to unlink Google."));
                    }
                  }}
                >
                  Unlink Google
                </button>
                <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-grass-700 dark:text-grass-400">
                  <Check className="h-4 w-4 shrink-0" />
                  Linked — sign in with Google on any device.
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-stone-300">
                  Link your Google account to sign in with one tap — no password needed.
                </p>
                {GOOGLE_CLIENT_ID ? (
                  <button
                    type="button"
                    className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/[0.08] dark:bg-[#18181b] dark:text-stone-200 dark:hover:bg-white/[0.04]"
                    onClick={() => {
                      const state = "link_" + (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));
                      sessionStorage.setItem("oauth_state", state);
                      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent("https://haylingua.am/auth/google/callback")}&response_type=code&scope=openid%20email%20profile&prompt=select_account&state=${encodeURIComponent(state)}`;
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"/>
                    </svg>
                    Link Google
                  </button>
                ) : (
                  <p className="mt-3 text-xs font-semibold text-slate-400 dark:text-stone-500">
                    Google sign-in isn’t configured on this server.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Facebook account linking */}
          <div className="rounded-2xl ring-1 ring-slate-200 p-4 dark:ring-white/[0.08] md:col-span-2">
            <div className="flex items-center gap-2 font-display font-extrabold text-slate-800 dark:text-white">
              <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0" aria-hidden="true">
                <path fill="#1877F2" d="M18 9a9 9 0 1 0-10.406 8.89v-6.29H5.309V9h2.285V7.017c0-2.256 1.344-3.502 3.4-3.502.985 0 2.015.176 2.015.176v2.215h-1.135c-1.118 0-1.467.694-1.467 1.406V9h2.497l-.4 2.6h-2.097v6.29A9.002 9.002 0 0 0 18 9z"/>
              </svg>
              Facebook
            </div>

            {facebookLinked ? (
              <>
                <button
                  type="button"
                  className="btn3d btn3d-neutral text-sm mt-2"
                  onClick={async () => {
                    try {
                      const res = await apiFetch("/me/link/facebook", { token, method: "DELETE" });
                      if (!res.ok) { const d = await safeJsonParse(res); throw new Error(d?.detail || "Failed to unlink"); }
                      setFacebookLinked(false);
                      setMessage("Facebook account unlinked.");
                    } catch (e) {
                      setMessage(String(e?.message || "Failed to unlink Facebook."));
                    }
                  }}
                >
                  Unlink Facebook
                </button>
                <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-grass-700 dark:text-grass-400">
                  <Check className="h-4 w-4 shrink-0" />
                  Linked — sign in with Facebook on any device.
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-stone-300">
                  Link your Facebook account to sign in with one tap — no password needed.
                </p>
                {FACEBOOK_APP_ID ? (
                  <button
                    type="button"
                    className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/[0.08] dark:bg-[#18181b] dark:text-stone-200 dark:hover:bg-white/[0.04]"
                    onClick={() => {
                      const state = "link_" + (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));
                      sessionStorage.setItem("oauth_state", state);
                      window.location.href = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent("https://haylingua.am/auth/facebook/callback")}&response_type=code&scope=email,public_profile&state=${encodeURIComponent(state)}`;
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                      <path fill="#1877F2" d="M18 9a9 9 0 1 0-10.406 8.89v-6.29H5.309V9h2.285V7.017c0-2.256 1.344-3.502 3.4-3.502.985 0 2.015.176 2.015.176v2.215h-1.135c-1.118 0-1.467.694-1.467 1.406V9h2.497l-.4 2.6h-2.097v6.29A9.002 9.002 0 0 0 18 9z"/>
                    </svg>
                    Link Facebook
                  </button>
                ) : (
                  <p className="mt-3 text-xs font-semibold text-slate-400 dark:text-stone-500">
                    Facebook sign-in isn’t configured on this server.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </section>
      )}

      {/* ===== Overview tab: recent learning activity ===== */}
      {tab === "overview" && (
      <section className="rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
        <h2 className="font-display text-lg font-extrabold text-slate-800 mb-4 dark:text-white">
          Learning activity
        </h2>

        {/* 30-day heatmap */}
        <div className="mb-5">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide dark:text-stone-400">
              Last 30 days
            </div>
            {Array.isArray(last7) && last7.length ? (
              <div className="text-xs font-semibold text-slate-400 dark:text-stone-500">
                <span className="font-extrabold text-slate-600 dark:text-stone-300">{last7.filter((d) => Number(d?.value || 0) > 0).length}</span> active days
                <span className="mx-1.5 text-slate-300 dark:text-stone-600">·</span>
                <span className="font-extrabold text-slate-600 dark:text-stone-300">{last7.reduce((s, d) => s + (Number(d?.value) || 0), 0)}</span> exercises
              </div>
            ) : null}
          </div>
          {Array.isArray(last7) && last7.length ? (
            <div>
              <div className="flex flex-wrap gap-1">
                {last7.map((d) => {
                  const v = Number(d?.value ?? 0);
                  const opacity = v === 0 ? 0 : Math.max(0.2, Math.min(1, v / 3));
                  return (
                    <div
                      key={d?.date || d?.label}
                      title={`${d?.date || d?.label}: ${v} lesson${v !== 1 ? "s" : ""}`}
                      className="rounded-sm"
                      style={{
                        width: 18,
                        height: 18,
                        backgroundColor: v === 0
                          ? "#f1f5f9"
                          : `rgba(234, 88, 12, ${opacity})`,
                        flexShrink: 0,
                      }}
                    />
                  );
                })}
              </div>
              <div className="mt-1 flex justify-between text-[11px] font-semibold text-slate-400 dark:text-stone-500">
                <span>30 days ago</span>
                <span>Today</span>
              </div>
            </div>
          ) : (
            <div className="flex h-14 items-center justify-center text-sm font-semibold text-slate-400 dark:text-stone-500">
              No activity yet — start a lesson to see your progress here.
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="flex flex-col items-center rounded-2xl bg-brand-50 px-3 py-3 dark:bg-brand-500/15">
            <span className="font-display text-2xl font-extrabold text-slate-800 tabular-nums dark:text-white">{lessonsCompleted}</span>
            <span className="mt-0.5 text-center text-xs font-bold text-slate-500 dark:text-stone-400">Lessons<br/>completed</span>
          </div>
          <div className="flex flex-col items-center rounded-2xl bg-grass-50 px-3 py-3 dark:bg-grass-500/15">
            <span className="font-display text-2xl font-extrabold text-slate-800 tabular-nums dark:text-white">{streak}</span>
            <span className="mt-0.5 text-center text-xs font-bold text-slate-500 dark:text-stone-400">Day<br/>streak</span>
            {bestStreak > streak && (
              <span className="mt-1 text-center text-[10px] font-bold text-grass-600 opacity-70 dark:text-grass-400">best {bestStreak}</span>
            )}
          </div>
          <div className="flex flex-col items-center rounded-2xl bg-feather-50 px-3 py-3 dark:bg-feather-500/15">
            <span className="font-display text-2xl font-extrabold text-slate-800 tabular-nums dark:text-white">{Number(xp || 0).toLocaleString()}</span>
            <span className="mt-0.5 text-center text-xs font-bold text-slate-500 dark:text-stone-400">Lifetime<br/>XP</span>
          </div>
          <div className="flex flex-col items-center rounded-2xl bg-gold-50 px-3 py-3 dark:bg-gold-500/15">
            <span className="font-display text-2xl font-extrabold text-slate-800 tabular-nums dark:text-white">
              {summary ? `${Math.round(summary.accuracy)}%` : "–"}
            </span>
            <span className="mt-0.5 text-center text-xs font-bold text-slate-500 dark:text-stone-400">Accuracy<br/>(14 days)</span>
          </div>
          <div className="flex flex-col items-center rounded-2xl bg-pom-50 px-3 py-3 dark:bg-pom-500/15">
            <span className="font-display text-2xl font-extrabold text-slate-800 tabular-nums dark:text-white">
              {summary ? Number(summary.attempts || 0).toLocaleString() : "–"}
            </span>
            <span className="mt-0.5 text-center text-xs font-bold text-slate-500 dark:text-stone-400">Exercises<br/>(14 days)</span>
          </div>
          <div className="flex flex-col items-center rounded-2xl bg-slate-100 px-3 py-3 dark:bg-white/[0.06]">
            <span className="font-display text-2xl font-extrabold text-slate-800 tabular-nums dark:text-white">
              {summary ? Number(summary.correct || 0).toLocaleString() : "–"}
            </span>
            <span className="mt-0.5 text-center text-xs font-bold text-slate-500 dark:text-stone-400">Correct<br/>(14 days)</span>
          </div>
        </div>

        {/* Share profile */}
        {username && (
          <div className="mt-4 rounded-2xl bg-slate-50 ring-1 ring-slate-200 px-4 py-3 flex items-center gap-3 dark:bg-white/[0.04] dark:ring-white/[0.08]">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-0.5 dark:text-stone-400">Your public profile</p>
              <p className="text-sm font-semibold text-slate-700 truncate dark:text-stone-200">
                haylingua.am/u/<span className="text-brand-600 dark:text-brand-400">{username}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                const url = `https://haylingua.am/u/${encodeURIComponent(username)}`;
                try {
                  if (navigator.share) {
                    await navigator.share({ title: `${username} on Haylingua`, url });
                  } else {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                } catch {}
              }}
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-xs font-extrabold text-white hover:bg-brand-600 transition"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : navigator.share ? <Share2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : navigator.share ? "Share" : "Copy link"}
            </button>
          </div>
        )}
      </section>
      )}

      {tab === "security" && <AccountDangerZone />}

      <AvatarBuilder
        open={showAvatarBuilder}
        onClose={() => setShowAvatarBuilder(false)}
        onSave={handleAvatarBuilderSave}
      />

      <BannerBuilder
        open={showBannerBuilder}
        onClose={() => setShowBannerBuilder(false)}
        onSave={handleBannerBuilderSave}
      />

      {!!message && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-lg">
          {message}
        </div>
      )}
    </div>
    </div>
  );
}
