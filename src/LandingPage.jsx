// src/LandingPage.jsx - With inline email verification
import { useState, useEffect } from "react";
import { Lock, Mail, User, Sparkles } from "lucide-react";

const API_BASE = "https://haylinguav2.onrender.com";

export default function LandingPage({ onLogin, onSignup }) {
  const [mode, setMode] = useState("login"); // 'login' | 'signup' | 'verify'
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Verification state
  const [token, setToken] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        await onLogin(email.trim(), password);
      } else if (mode === "signup") {
        // Handle signup ourselves to get verification code
        await handleSignup();
      }
    } catch (err) {
      console.error("Auth error", err);
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    try {
      const res = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data?.detail?.field) {
          const fieldErrors = data.detail.errors || [];
          throw new Error(fieldErrors.join(". "));
        } else {
          const msg = data?.detail || data?.message || "Signup failed";
          throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
        }
      }

      const accessToken = data?.access_token;
      if (!accessToken) {
        throw new Error("Signup succeeded but server returned no token.");
      }

      // Store token
      setToken(accessToken);
      localStorage.setItem("hay_token", accessToken);
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("user_email", email.trim());

      // Store user object
      const baseName = email.split("@")[0];
      const newUser = {
        id: 1,
        email: email.trim(),
        name: name.trim() || baseName,
        firstName: "",
        lastName: "",
        avatarUrl: "",
        level: 1,
        xp: 0,
        streak: 0,
        completedLessons: [],
        email_verified: false,
      };
      localStorage.setItem("hay_user", JSON.stringify(newUser));

      // Check if we got a dev code
      if (data.verification_code) {
        setDevCode(data.verification_code);
        console.warn("🔧 DEV MODE: Verification code:", data.verification_code);
      }

      // Switch to verification mode
      setMode("verify");
      setLoading(false);
    } catch (err) {
      throw err;
    }
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: trimmedCode }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const detail = data?.detail || "Verification failed";

        if (detail === "INVALID_CODE") {
          setError("Invalid code. Please check and try again.");
        } else if (detail === "CODE_EXPIRED") {
          setError("This code has expired. Please request a new one.");
        } else if (detail === "NO_CODE") {
          setError("No verification code found. Please request a new one.");
        } else if (detail === "TOO_MANY_ATTEMPTS") {
          setError("Too many failed attempts. Please request a new code.");
        } else {
          setError(typeof detail === "string" ? detail : JSON.stringify(detail));
        }
        setLoading(false);
        return;
      }

      // Success! Update user object and reload
      const userStr = localStorage.getItem("hay_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        user.email_verified = true;
        localStorage.setItem("hay_user", JSON.stringify(user));
      }

      // Force page reload to ensure App.jsx picks up the verified state
      window.location.href = "/dashboard";
    } catch (err) {
      console.error(err);
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
          const seconds = Number(detail.retry_after_s) || 60;
          setCooldown(seconds);
          setError(`Please wait ${seconds} seconds before requesting another code.`);
          setLoading(false);
          return;
        }

        if (detail === "ALREADY_VERIFIED") {
          window.location.href = "/dashboard";
          return;
        }

        const msg = detail || "Resend failed";
        setError(typeof msg === "string" ? msg : JSON.stringify(msg));
        setLoading(false);
        return;
      }

      // Check if we got a new dev code
      if (data.verification_code) {
        setDevCode(data.verification_code);
        console.warn("🔧 DEV MODE: New verification code:", data.verification_code);
      }

      setError("");
      const seconds = Number(data?.retry_after_s) || 60;
      setCooldown(seconds);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  const useDevCode = () => {
    if (devCode) {
      setCode(devCode);
      setError("");
    }
  };

  // Render verification screen
  if (mode === "verify") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-orange-100 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              Verify your email
            </h2>
            <p className="text-sm text-gray-600 mb-6 text-center">
              We sent a 6-digit code to <strong>{email}</strong>
            </p>

            {/* Dev Mode Alert */}
            {devCode && (
              <div className="mb-6 bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4">
                <div className="font-bold text-yellow-900 mb-2 text-sm">
                  🔧 Development Mode
                </div>
                <p className="text-yellow-800 text-xs mb-3">
                  Email sending is not configured. Use this code:
                </p>
                <div className="bg-white border-2 border-yellow-400 rounded-lg p-3 text-center font-mono text-2xl font-bold tracking-widest mb-3">
                  {devCode}
                </div>
                <button
                  onClick={useDevCode}
                  className="w-full bg-yellow-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-yellow-800 transition"
                >
                  Use this code
                </button>
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setCode(val);
                    if (error && val.length === 6) setError("");
                  }}
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  className="w-full px-4 py-3 text-center text-2xl font-mono font-bold tracking-widest rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || code.trim().length !== 6}
                className="w-full py-3 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Verifying..." : "Verify Email"}
              </button>

              <div className="text-center text-sm text-gray-600">
                Didn't receive the code?
              </div>

              <button
                type="button"
                onClick={handleResend}
                disabled={loading || cooldown > 0}
                className="w-full py-3 rounded-xl bg-white border-2 border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
              </button>

              <p className="text-center text-xs text-gray-500 mt-4">
                Code expires in 10 minutes
              </p>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Render login/signup screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 flex items-center justify-center px-4">
      <div className="max-w-5xl w-full grid lg:grid-cols-2 gap-10 items-center">
        {/* Left: hero */}
        <div className="hidden lg:block">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 bg-white/80 rounded-full shadow-sm border border-orange-100">
            <Sparkles className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-medium text-orange-700">
              Learn Armenian the fun way
            </span>
          </div>

          <h1 className="text-4xl font-extrabold text-gray-900 mb-4 leading-tight">
            Welcome to <span className="text-orange-600">Haylingua</span>
          </h1>
          <p className="text-gray-600 text-lg mb-8">
            Bite-sized lessons, friendly characters, and a touch of Armenian
            culture. Start from the alphabet and build your skills step by step.
          </p>

          <div className="flex items-center gap-6 text-sm text-gray-600">
            <div>
              <div className="text-xl font-bold text-gray-900">5 min / day</div>
              <div className="text-gray-500">Small lessons, big progress</div>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900">Gamified</div>
              <div className="text-gray-500">XP, streaks, and challenges</div>
            </div>
          </div>
        </div>

        {/* Right: auth card */}
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-orange-100 p-6 sm:p-8">
          {/* Tabs */}
          <div className="flex mb-6 bg-orange-50 rounded-xl p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                mode === "login"
                  ? "bg-white shadow text-orange-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError("");
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                mode === "signup"
                  ? "bg-white shadow text-orange-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Create account
            </button>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {mode === "login" ? "Welcome back 👋" : "Get started for free 🎉"}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {mode === "login"
              ? "Log in to continue your Armenian learning journey."
              : "Create an account to save your progress and streaks."}
          </p>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="How should we call you?"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === "login" ? "Your password" : "Min 8 characters"
                  }
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 inline-flex justify-center items-center gap-2 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                  {mode === "login" ? "Logging in…" : "Creating account…"}
                </>
              ) : (
                <>{mode === "login" ? "Log in" : "Create account"}</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
