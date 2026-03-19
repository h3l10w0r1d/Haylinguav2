// src/LandingPage.jsx — Clean, focused landing page
// All auth logic preserved: login, signup, 2FA, captcha, verification
import Turnstile from "./lib/Turnstile";
import { useState, useEffect, useRef } from "react";
import { Lock, Mail, User, ArrowRight, Fingerprint, Sparkles } from "lucide-react";

const API_BASE = "https://haylinguav2.onrender.com";

const FEATURES = [
  { icon: "🔤", text: "Armenian alphabet from scratch" },
  { icon: "🎧", text: "Listen, repeat, and type exercises" },
  { icon: "🔥", text: "XP streaks that keep you consistent" },
  { icon: "🏆", text: "Leaderboard to compete with friends" },
];

export default function LandingPage({ onLogin, onSignup }) {
  const [mode, setMode] = useState("login"); // login | signup | verify
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [otp, setOtp] = useState("");
  const [needs2FA, setNeeds2FA] = useState(false);
  const [needsCaptcha, setNeedsCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Verification state
  const [token, setToken] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // ── Auth Handlers ──────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (mode === "signup") {
      if (!username.trim()) { setError("Username is required"); return; }
      const u = username.trim();
      if (u.length < 3 || u.length > 20) { setError("Username must be 3–20 characters"); return; }
      for (const ch of u) {
        const ok = /[a-zA-Z0-9_.]/.test(ch);
        if (!ok) { setError("Username can only contain letters, numbers, '_' and '.'"); return; }
      }
      if (!password || password.length < 8) { setError("Password must be at least 8 characters"); return; }
      if (password !== password2) { setError("Passwords do not match"); return; }
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await onLogin(email.trim(), password, needs2FA ? otp : null, needsCaptcha ? captchaToken : null);
      } else {
        await handleSignup();
      }
    } catch (err) {
      if (mode === "login" && err?.requires2fa) {
        setNeeds2FA(true);
        setError("Enter your 2FA or recovery code.");
      } else if (mode === "login" && err?.requiresCaptcha) {
        setNeedsCaptcha(true);
        setCaptchaToken(null);
        setCaptchaKey((k) => k + 1);
        setError("Please complete the security check.");
      } else if (mode === "login" && err?.locked) {
        setError(err?.message || "Too many attempts. Try again later.");
      } else {
        setError(err?.message || "Something went wrong");
      }
    } finally {
      if (mode === "login" && needsCaptcha) {
        setCaptchaToken(null);
        setCaptchaKey((k) => k + 1);
      }
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    const res = await fetch(`${API_BASE}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || null,
        username: username.trim(),
        email: email.trim(),
        password,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data?.detail?.field) throw new Error((data.detail.errors || []).join(". "));
      const msg = data?.detail || data?.message || "Signup failed";
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    const accessToken = data?.access_token;
    if (!accessToken) throw new Error("Signup succeeded but no token returned.");
    setToken(accessToken);
    localStorage.setItem("hay_token", accessToken);
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("user_email", email.trim());
    const newUser = {
      id: 1, email: email.trim(),
      name: name.trim() || email.split("@")[0],
      username: username.trim(),
      firstName: "", lastName: "", avatarUrl: "",
      level: 1, xp: 0, streak: 0, completedLessons: [], email_verified: false,
    };
    localStorage.setItem("hay_user", JSON.stringify(newUser));
    if (data.verification_code) setDevCode(data.verification_code);
    setMode("verify");
    setLoading(false);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6 || !/^\d{6}$/.test(trimmedCode)) {
      setError("Please enter a valid 6-digit code");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: trimmedCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data?.detail || "Verification failed";
        const msgs = { INVALID_CODE: "Invalid code.", CODE_EXPIRED: "Code expired. Request a new one.", NO_CODE: "No code found. Request a new one.", TOO_MANY_ATTEMPTS: "Too many attempts. Request a new code." };
        setError(msgs[detail] || (typeof detail === "string" ? detail : JSON.stringify(detail)));
        setLoading(false);
        return;
      }
      const userStr = localStorage.getItem("hay_user");
      if (userStr) {
        const u = JSON.parse(userStr);
        u.email_verified = true;
        localStorage.setItem("hay_user", JSON.stringify(u));
      }
      window.location.href = "/onboarding";
    } catch (err) {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/resend-verification`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data?.detail;
        if (res.status === 429 && detail?.retry_after_s) {
          setCooldown(Number(detail.retry_after_s) || 60);
          setError(`Wait ${detail.retry_after_s}s before resending.`);
          return;
        }
        if (detail === "ALREADY_VERIFIED") { window.location.href = "/dashboard"; return; }
        setError(typeof detail === "string" ? detail : "Resend failed");
        return;
      }
      if (data.verification_code) setDevCode(data.verification_code);
      setCooldown(Number(data?.retry_after_s) || 60);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  };

  // ── Verification Screen ────────────────────────────────────────────────────

  if (mode === "verify") {
    return (
      <div style={styles.page}>
        <div style={styles.verifyCard}>
          <div style={styles.logo}>Հ</div>
          <h2 style={styles.verifyTitle}>Check your inbox</h2>
          <p style={styles.verifySubtitle}>
            We sent a 6-digit code to <strong>{email}</strong>
          </p>

          {devCode && (
            <div style={styles.devBox}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#92400e" }}>🔧 Dev mode — use this code:</div>
              <div style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 800, letterSpacing: "0.3em", color: "#78350f" }}>{devCode}</div>
              <button style={styles.devBtn} onClick={() => { setCode(devCode); setError(""); }}>Use this code</button>
            </div>
          )}

          <form onSubmit={handleVerify} style={{ width: "100%" }}>
            <input
              value={code}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setCode(v); if (error && v.length === 6) setError(""); }}
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              style={styles.codeInput}
            />
            {error && <div style={styles.errorBox}>{error}</div>}
            <button type="submit" disabled={loading || code.trim().length !== 6} style={{ ...styles.primaryBtn, marginTop: 12 }}>
              {loading ? "Verifying…" : "Verify email"}
            </button>
          </form>

          <button onClick={handleResend} disabled={loading || cooldown > 0} style={styles.ghostBtn}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>Code expires in 10 minutes</p>
        </div>
      </div>
    );
  }

  // ── Main Landing ───────────────────────────────────────────────────────────

  return (
    <div style={styles.page}>
      {/* Background grain */}
      <div style={styles.grain} />
      {/* Accent orb */}
      <div style={styles.orb} />

      <div style={styles.layout}>

        {/* ── LEFT: Value proposition ── */}
        <div style={styles.left}>
          <div style={styles.badge}>
            <Sparkles size={13} style={{ marginRight: 5 }} />
            Armenian made playful
          </div>

          <h1 style={styles.headline}>
            Learn Armenian.<br />
            <span style={styles.headlineAccent}>Actually stick with it.</span>
          </h1>

          <p style={styles.subtext}>
            Bite-sized lessons, instant feedback, and a leaderboard that makes you want to come back tomorrow.
          </p>

          <ul style={styles.featureList}>
            {FEATURES.map((f) => (
              <li key={f.text} style={styles.featureItem}>
                <span style={styles.featureIcon}>{f.icon}</span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        {/* ── RIGHT: Auth form ── */}
        <div style={styles.authCard}>

          {/* Mode switcher */}
          <div style={styles.tabRow}>
            <button
              onClick={() => { setMode("login"); setError(""); }}
              style={{ ...styles.tab, ...(mode === "login" ? styles.tabActive : {}) }}
            >
              Log in
            </button>
            <button
              onClick={() => { setMode("signup"); setError(""); }}
              style={{ ...styles.tab, ...(mode === "signup" ? styles.tabActive : {}) }}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>

            {/* Signup-only fields */}
            {mode === "signup" && (
              <>
                <div style={styles.row2}>
                  <div style={styles.field}>
                    <label style={styles.label}>Name <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional)</span></label>
                    <div style={styles.inputWrap}>
                      <User size={15} style={styles.inputIcon} />
                      <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Armen" autoComplete="name" />
                    </div>
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Username</label>
                    <div style={styles.inputWrap}>
                      <Fingerprint size={15} style={styles.inputIcon} />
                      <input style={styles.input} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="armen_g" autoComplete="username" />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Email */}
            <div style={styles.field}>
              <label style={styles.label}>{mode === "login" ? "Email or username" : "Email"}</label>
              <div style={styles.inputWrap}>
                <Mail size={15} style={styles.inputIcon} />
                <input
                  style={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={mode === "login" ? "you@example.com or username" : "you@example.com"}
                  autoComplete="email"
                  inputMode={mode === "login" ? "text" : "email"}
                />
              </div>
            </div>

            {/* Password */}
            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <div style={styles.inputWrap}>
                <Lock size={15} style={styles.inputIcon} />
                <input
                  style={styles.input}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>
            </div>

            {/* Confirm password */}
            {mode === "signup" && (
              <div style={styles.field}>
                <label style={styles.label}>Confirm password</label>
                <div style={styles.inputWrap}>
                  <Lock size={15} style={styles.inputIcon} />
                  <input
                    style={styles.input}
                    type="password"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}

            {/* 2FA */}
            {mode === "login" && needs2FA && (
              <div style={styles.field}>
                <label style={styles.label}>2FA code</label>
                <div style={styles.inputWrap}>
                  <input
                    style={{ ...styles.input, paddingLeft: 14 }}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="6-digit code or recovery"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </div>
              </div>
            )}

            {/* Captcha */}
            {mode === "login" && needsCaptcha && (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#f9fafb" }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "#374151" }}>Security check</div>
                <Turnstile key={captchaKey} onVerify={(t) => { setCaptchaToken(t); if (t) setError(""); }} />
              </div>
            )}

            {/* Error */}
            {error && <div style={styles.errorBox}>{error}</div>}

            {/* Submit */}
            <button type="submit" disabled={loading} style={styles.primaryBtn}>
              {loading
                ? "Please wait…"
                : mode === "login"
                ? needs2FA ? "Verify & log in" : "Log in"
                : "Create account"}
              {!loading && <ArrowRight size={16} style={{ marginLeft: 6 }} />}
            </button>

            {mode === "signup" && (
              <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 8, lineHeight: 1.5 }}>
                By signing up you agree to our terms and privacy policy.
              </p>
            )}
          </form>
        </div>
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <span>© {new Date().getFullYear()} Haylingua</span>
        <a href="https://blog.haylingua.am" target="_blank" rel="noreferrer" style={styles.footerLink}>Blog</a>
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: "100vh",
    background: "#fafaf9",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    position: "relative",
    overflow: "hidden",
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  grain: {
    pointerEvents: "none",
    position: "absolute",
    inset: 0,
    opacity: 0.045,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")`,
    mixBlendMode: "multiply",
    zIndex: 0,
  },
  orb: {
    position: "absolute",
    top: -180,
    right: -120,
    width: 520,
    height: 520,
    borderRadius: "50%",
    background: "radial-gradient(circle at 40% 40%, rgba(251,146,60,0.18), transparent 70%)",
    pointerEvents: "none",
    zIndex: 0,
  },
  layout: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: 960,
    display: "grid",
    gridTemplateColumns: "1fr 420px",
    gap: 48,
    alignItems: "center",
  },
  // Left column
  left: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 999,
    padding: "5px 13px",
    fontSize: 12,
    fontWeight: 600,
    color: "#c2410c",
    width: "fit-content",
  },
  headline: {
    fontSize: "clamp(2rem, 3.5vw, 2.9rem)",
    fontWeight: 800,
    lineHeight: 1.18,
    color: "#0f172a",
    margin: 0,
    letterSpacing: "-0.02em",
  },
  headlineAccent: {
    background: "linear-gradient(135deg, #f97316, #fb923c)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  subtext: {
    fontSize: 16,
    lineHeight: 1.65,
    color: "#475569",
    margin: 0,
    maxWidth: 420,
  },
  featureList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  featureItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    color: "#334155",
    fontWeight: 500,
  },
  featureIcon: {
    width: 30,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fff",
    borderRadius: 8,
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
    fontSize: 16,
    flexShrink: 0,
  },

  // Auth card
  authCard: {
    background: "#fff",
    borderRadius: 20,
    border: "1px solid #e2e8f0",
    padding: "28px 28px 24px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
  },
  tabRow: {
    display: "flex",
    background: "#f1f5f9",
    borderRadius: 10,
    padding: 3,
    marginBottom: 20,
    gap: 2,
  },
  tab: {
    flex: 1,
    padding: "8px 0",
    border: "none",
    background: "transparent",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    color: "#64748b",
    transition: "all 0.15s",
  },
  tabActive: {
    background: "#fff",
    color: "#0f172a",
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  row2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "#374151",
  },
  inputWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  inputIcon: {
    position: "absolute",
    left: 12,
    color: "#9ca3af",
    pointerEvents: "none",
  },
  input: {
    width: "100%",
    padding: "10px 12px 10px 36px",
    border: "1.5px solid #e2e8f0",
    borderRadius: 10,
    fontSize: 14,
    outline: "none",
    background: "#fafafa",
    color: "#0f172a",
    transition: "border-color 0.15s",
    boxSizing: "border-box",
  },
  primaryBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    padding: "12px 0",
    background: "linear-gradient(135deg, #f97316, #fb923c)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(249,115,22,0.35)",
    transition: "opacity 0.15s, transform 0.1s",
    letterSpacing: "-0.01em",
  },
  ghostBtn: {
    display: "block",
    width: "100%",
    marginTop: 10,
    padding: "10px 0",
    background: "transparent",
    border: "1.5px solid #e2e8f0",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    color: "#64748b",
    cursor: "pointer",
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    color: "#b91c1c",
    lineHeight: 1.5,
  },

  // Footer
  footer: {
    position: "relative",
    zIndex: 1,
    marginTop: 32,
    display: "flex",
    gap: 20,
    fontSize: 12,
    color: "#94a3b8",
    alignItems: "center",
  },
  footerLink: {
    color: "#94a3b8",
    textDecoration: "none",
    fontWeight: 500,
  },

  // Verify screen
  verifyCard: {
    position: "relative",
    zIndex: 1,
    background: "#fff",
    borderRadius: 20,
    border: "1px solid #e2e8f0",
    padding: "36px 32px",
    maxWidth: 420,
    width: "100%",
    textAlign: "center",
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "linear-gradient(135deg, #f97316, #fb923c)",
    color: "#fff",
    fontSize: 22,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    marginBottom: 4,
  },
  verifyTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: "#0f172a",
    margin: 0,
    letterSpacing: "-0.02em",
  },
  verifySubtitle: {
    fontSize: 14,
    color: "#64748b",
    margin: "0 0 8px",
    lineHeight: 1.55,
  },
  codeInput: {
    display: "block",
    width: "100%",
    padding: "14px",
    border: "2px solid #e2e8f0",
    borderRadius: 12,
    fontSize: 26,
    fontFamily: "monospace",
    fontWeight: 700,
    letterSpacing: "0.3em",
    textAlign: "center",
    outline: "none",
    boxSizing: "border-box",
    color: "#0f172a",
    background: "#fafafa",
  },
  devBox: {
    background: "#fffbeb",
    border: "1.5px solid #fde68a",
    borderRadius: 12,
    padding: "14px 16px",
    width: "100%",
    boxSizing: "border-box",
    textAlign: "center",
    marginBottom: 4,
  },
  devBtn: {
    marginTop: 10,
    background: "#92400e",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
  },
};

/* ── Responsive: stack on mobile ── */
const mobileStyle = `
@media (max-width: 768px) {
  .landing-layout { grid-template-columns: 1fr !important; }
  .landing-left { display: none !important; }
}
`;
if (typeof document !== "undefined") {
  const tag = document.createElement("style");
  tag.textContent = mobileStyle;
  document.head.appendChild(tag);
}
