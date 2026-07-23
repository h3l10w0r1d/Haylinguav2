// src/AuthModal.jsx — a self-contained login/signup modal for pages outside
// the main app shell (currently: the forum). Unlike the landing page's own
// auth modal (which hands off to App.jsx's handleLogin/handleSignup and then
// navigates into onboarding), this one calls /login and /signup directly and
// just writes the token to localStorage — it never navigates anywhere, so a
// visitor can sign up or log in without losing their place on the page that
// opened it.
import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import Turnstile from "./lib/Turnstile";
import { API_BASE } from "./api";

const fieldCls = "w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400 placeholder:font-semibold placeholder:text-slate-400 dark:bg-white/[0.04] dark:text-stone-200 dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500";
const labelCls = "mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-stone-400";

export default function AuthModal({ mode, onClose, onSwitchMode, onAuthSuccess }) {
  const isLogin = mode === "login";

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [needs2FA, setNeeds2FA] = useState(false);
  const [needsCaptcha, setNeedsCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitLogin() {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        otp: needs2FA ? otp : null,
        turnstile_token: needsCaptcha ? captchaToken : null,
      }),
    });
    if (!res.ok) {
      const dataErr = await res.json().catch(() => null);
      if (res.status === 401 && dataErr?.detail?.requires_2fa && !otp) {
        const e = new Error("2FA code required");
        e.requires2fa = true;
        throw e;
      }
      if (res.status === 403 && dataErr?.detail?.requires_captcha) {
        const e = new Error(dataErr?.detail?.message || "Security check required");
        e.requiresCaptcha = true;
        throw e;
      }
      if (res.status === 429 && dataErr?.detail?.locked) {
        throw new Error(dataErr?.detail?.message || "Too many attempts. Try again later.");
      }
      const msg = (typeof dataErr?.detail === "string" && dataErr.detail) || dataErr?.detail?.message || "Invalid email, password, or 2FA code";
      throw new Error(msg);
    }
    return res.json();
  }

  async function submitSignup() {
    const res = await fetch(`${API_BASE}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || null,
        username: username.trim() || email.split("@")[0],
        email,
        password,
        turnstile_token: captchaToken,
      }),
    });
    if (!res.ok) {
      const dataErr = await res.json().catch(() => null);
      if (dataErr?.detail?.errors) throw new Error(dataErr.detail.errors[0]);
      const msg = (typeof dataErr?.detail === "string" && dataErr.detail) || "Signup failed — maybe this email is already registered.";
      throw new Error(msg);
    }
    return res.json();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = isLogin ? await submitLogin() : await submitSignup();
      if (!data.access_token) throw new Error("No token in response");
      localStorage.setItem("hay_token", data.access_token);
      localStorage.setItem("access_token", data.access_token);
      onAuthSuccess?.(data);
      onClose();
    } catch (err) {
      if (isLogin && err?.requires2fa) {
        setNeeds2FA(true);
        setError("2FA is enabled for this account. Enter your authenticator or recovery code.");
        return;
      }
      if (isLogin && err?.requiresCaptcha) {
        setNeedsCaptcha(true);
        setCaptchaToken(null);
        setCaptchaKey((k) => k + 1);
        setError("Please complete the security check to continue.");
        return;
      }
      setError(err?.message || "Something went wrong");
    } finally {
      if ((isLogin && needsCaptcha) || !isLogin) {
        setCaptchaToken(null);
        setCaptchaKey((k) => k + 1);
      }
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08] sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-slate-800 dark:text-white">
            {isLogin ? "Log in to Haylingua" : "Create your account"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-stone-500 dark:hover:bg-white/[0.06] dark:hover:text-stone-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {!isLogin && (
            <div>
              <label className={labelCls}>Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="e.g. armen_23" className={fieldCls} />
            </div>
          )}

          <div>
            <label className={labelCls}>{isLogin ? "Email or username" : "Email"}</label>
            <input
              type={isLogin ? "text" : "email"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={fieldCls}
            />
          </div>

          <div>
            <label className={labelCls}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={fieldCls} />
          </div>

          {isLogin && needs2FA && (
            <div>
              <label className={labelCls}>2FA code</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit code or recovery"
                required
                className={fieldCls}
              />
            </div>
          )}

          {((isLogin && needsCaptcha) || !isLogin) && (
            <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/[0.08]">
              <div className="mb-2 text-sm font-bold text-slate-700 dark:text-stone-200">Security check</div>
              <Turnstile key={captchaKey} onVerify={(t) => { setCaptchaToken(t); if (t) setError(""); }} />
            </div>
          )}

          {error && (
            <div className="rounded-2xl bg-cardinal-50 px-3 py-2 text-sm font-bold text-cardinal-700 ring-1 ring-cardinal-200 dark:bg-cardinal-500/10 dark:text-cardinal-300 dark:ring-cardinal-500/25">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || (!isLogin && !captchaToken)} className="btn3d btn3d-brand w-full justify-center text-sm disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isLogin ? (needs2FA ? "Verify & log in" : "Log in") : "Create account"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm font-semibold text-slate-500 dark:text-stone-400">
          {isLogin ? (
            <>Don't have an account?{" "}
              <button type="button" onClick={() => onSwitchMode("signup")} className="font-bold text-brand-600 hover:underline dark:text-brand-400">Sign up</button>
            </>
          ) : (
            <>Already have an account?{" "}
              <button type="button" onClick={() => onSwitchMode("login")} className="font-bold text-brand-600 hover:underline dark:text-brand-400">Log in</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
