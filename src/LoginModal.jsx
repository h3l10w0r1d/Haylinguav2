// src/LoginModal.jsx
import { useState } from "react";
import Turnstile from "./lib/Turnstile";

export default function LoginModal({
  mode,
  onClose,
  onLogin,
  onSignup,
  onSwitchMode,
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

  const isLogin = mode === "login";

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
