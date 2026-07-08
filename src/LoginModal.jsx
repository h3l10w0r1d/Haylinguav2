// src/LoginModal.jsx
import { useState, useEffect, useRef } from "react";
import Turnstile from "./lib/Turnstile";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "387340156498-udb3h083d3mcnj135kvbfcstsdslbe64.apps.googleusercontent.com";
const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "haylinguabot";
const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginModal({
  mode,
  onClose,
  onLogin,
  onSignup,
  onSwitchMode,
  onAuthSuccess,
}) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [needs2FA, setNeeds2FA] = useState(false);
  const [needsCaptcha, setNeedsCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const tgContainerRef = useRef(null);

  const isLogin = mode === "login";

  // Telegram widget — inject script once when bot username is configured
  useEffect(() => {
    if (!TELEGRAM_BOT_USERNAME || !tgContainerRef.current) return;
    // Clean up any previous widget
    tgContainerRef.current.innerHTML = "";

    // Register global callback BEFORE script loads
    window.onTelegramAuth = async (tgUser) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/auth/telegram`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tgUser),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d?.detail || "Telegram sign-in failed");
        }
        const data = await res.json();
        if (onAuthSuccess) onAuthSuccess(data);
        onClose();
      } catch (err) {
        setError(err.message || "Telegram sign-in failed");
      } finally {
        setLoading(false);
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", TELEGRAM_BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.async = true;
    tgContainerRef.current.appendChild(script);

    return () => { delete window.onTelegramAuth; };
  }, [TELEGRAM_BOT_USERNAME, onClose, onAuthSuccess]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isLogin) {
        await onLogin(email, password, needs2FA ? otp : null, needsCaptcha ? captchaToken : null);
      } else {
        await onSignup(name, username, email, password);
      }
      onClose();
    } catch (err) {      // 2FA required → keep modal open and show OTP field
      if (isLogin && err?.requires2fa) {
        setNeeds2FA(true);
        setError("2FA is enabled for this account. Enter your authenticator or recovery code.");
        return;
      }

      // CAPTCHA required (after suspicious failures)
      if (isLogin && err?.requiresCaptcha) {
        setNeedsCaptcha(true);
        setCaptchaToken(null);
        setCaptchaKey((k) => k + 1);
        setError("Please complete the security check to continue.");
        return;
      }

      // Temporary lockout
      if (isLogin && err?.locked) {
        setLockedUntil(err?.lockedUntil || null);
        setError(err?.message || "Too many attempts. Try again later.");
        return;
      }

      setError(err?.message || "Something went wrong");
    } finally {
      if (isLogin && needsCaptcha) {
        setCaptchaToken(null);
        setCaptchaKey((k) => k + 1);
      }
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {isLogin ? "Log in to Haylingua" : "Create your Haylingua account"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Social OAuth buttons */}
        {(GOOGLE_CLIENT_ID || TELEGRAM_BOT_USERNAME) && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-2">
              {TELEGRAM_BOT_USERNAME && (
                <div className="relative h-11">
                  <div ref={tgContainerRef} style={{ position: "absolute", inset: 0, opacity: 0, overflow: "hidden" }} />
                  <div style={{ pointerEvents: "none" }} className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="#2AABEE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#2AABEE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Telegram
                  </div>
                </div>
              )}
              {GOOGLE_CLIENT_ID && (
                <a
                  href={`https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent("https://haylingua.am/auth/google/callback")}&response_type=code&scope=openid%20email%20profile&prompt=select_account`}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
                >
                  <GoogleIcon />
                  Google
                </a>
              )}
            </div>
            <div className="relative my-1 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-semibold text-gray-400">or</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin}
              />
            </div>
          )}

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="e.g. armen_23"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isLogin ? "Email or username" : "Email"}
            </label>
            <input
              type={isLogin ? "text" : "email"}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {isLogin && needs2FA && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                2FA code
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit code or recovery"
                required
              />
            </div>
          )}

          

          {isLogin && needsCaptcha && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="text-sm font-medium text-gray-800 mb-2">Security check</div>
              <Turnstile
                key={captchaKey}
                onVerify={(t) => {
                  setCaptchaToken(t);
                  if (t) setError("");
                }}
              />
              <div className="text-xs text-gray-500 mt-2">
                This appears after multiple failed login attempts.
              </div>
            </div>
          )}
{error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 px-4 py-2 rounded-xl bg-orange-600 text-white font-medium hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading
              ? isLogin
                ? "Logging in..."
                : "Creating account..."
              : isLogin
              ? needs2FA
                ? "Verify & Log In"
                : "Log In"
              : "Sign Up"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-600">
          {isLogin ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => onSwitchMode("signup")}
                className="text-orange-600 font-medium hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => onSwitchMode("login")}
                className="text-orange-600 font-medium hover:underline"
              >
                Log in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
