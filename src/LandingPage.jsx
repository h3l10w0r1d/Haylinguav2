// src/LandingPage.jsx - Marketing landing + inline auth + email verification
import { useState, useEffect, useMemo, useRef } from "react";
import { Lock, Mail, User, Sparkles, ArrowRight, LogIn, BookOpen, ShieldCheck, CheckCircle2, Headphones, Keyboard, Flame, Target, Timer, Layers3, GraduationCap, Route, BarChart3, Fingerprint, Wand2, Globe, Twitter, Instagram, Youtube } from "lucide-react";

const API_BASE = "https://haylinguav2.onrender.com";

export default function LandingPage({ onLogin, onSignup }) {
  const [mode, setMode] = useState("login"); // 'login' | 'signup' | 'verify'
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Verification state
  const [token, setToken] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const authRef = useRef(null);
  const howRef = useRef(null);
  const roadmapRef = useRef(null);
  const trustRef = useRef(null);
  const blogRef = useRef(null);

  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  const onMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setMouse({ x, y });
  };

  const orbShift = useMemo(() => {
    // small parallax shift, capped
    const dx = (mouse.x - 0.5) * 22;
    const dy = (mouse.y - 0.5) * 22;
    return { dx, dy };
  }, [mouse]);

  const scrollToAuth = () => {
    try {
      authRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      // ignore
    }
  };

  const scrollToRef = (ref) => {
    try {
      ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      // ignore
    }
  };

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

    if (mode === "signup") {
      if (!username || !username.trim()) {
        setError("Username is required");
        return;
      }
      const u = username.trim();
      if (u.length < 3 || u.length > 20) {
        setError("Username must be 3–20 characters");
        return;
      }
      // allow letters, numbers, underscore, dot
      for (let i = 0; i < u.length; i++) {
        const ch = u[i];
        const ok =
          (ch >= "a" && ch <= "z") ||
          (ch >= "A" && ch <= "Z") ||
          (ch >= "0" && ch <= "9") ||
          ch === "_" ||
          ch === ".";
        if (!ok) {
          setError("Username can include letters, numbers, '_' and '.' only");
          return;
        }
      }
      if (!password || password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }
      if (password !== password2) {
        setError("Passwords do not match");
        return;
      }
    }

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
          username: username.trim(),
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
        username: username.trim(),
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
      // After verification we run onboarding before dashboard.
      window.location.href = "/onboarding";
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
      <div
        className="min-h-screen lp-bg bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50"
        onMouseMove={onMouseMove}
      >
        {/* background */}
        <div className="lp-grain" />
        <style>{`
html{scroll-behavior:smooth;}
.lp-float-wrap{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;}
.lp-float{position:absolute;border-radius:9999px;filter:blur(70px);opacity:.32;mix-blend-mode:multiply;animation:lpFloat 16s ease-in-out infinite;transform:translate3d(0,0,0);}
.lp-float-1{width:520px;height:520px;top:-180px;left:-140px;background:radial-gradient(circle at 30% 30%, rgba(255,159,67,.9), rgba(255,159,67,0));}
.lp-float-2{width:540px;height:540px;bottom:-220px;right:-180px;animation-delay:-5s;background:radial-gradient(circle at 40% 40%, rgba(251,113,133,.85), rgba(251,113,133,0));}
.lp-float-3{width:420px;height:420px;top:35%;left:55%;animation-delay:-9s;background:radial-gradient(circle at 35% 35%, rgba(252,211,77,.85), rgba(252,211,77,0));}
@keyframes lpFloat{0%{transform:translate3d(0,0,0) scale(1);}50%{transform:translate3d(40px,-30px,0) scale(1.05);}100%{transform:translate3d(0,0,0) scale(1);}}
`}</style>
        <div aria-hidden className="lp-float-wrap">
          <div className="lp-float lp-float-1" />
          <div className="lp-float lp-float-2" />
          <div className="lp-float lp-float-3" />
        </div>

        <div
          className="lp-orb bg-orange-300"
          style={{ width: 380, height: 380, top: -120, left: -120, transform: `translate3d(${orbShift.dx}px, ${orbShift.dy}px, 0)` }}
        />
        <div
          className="lp-orb bg-amber-200"
          style={{ width: 340, height: 340, bottom: -140, right: -120, transform: `translate3d(${-orbShift.dx}px, ${-orbShift.dy}px, 0)` }}
        />

        <div className="relative z-10 px-4 sm:px-8 pb-12 pt-10 flex items-center justify-center">
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
	    </div>
    );
  }

  // Render login/signup screen
  return (
    <div
      className="min-h-screen lp-bg bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50"
      onMouseMove={onMouseMove}
    >
      <style>{`
        @keyframes lpFloatSlow { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        @keyframes lpGlowPulse { 0%,100% { opacity: .55 } 50% { opacity: .85 } }
        @keyframes lpShimmer { 0% { background-position: 0% 50% } 100% { background-position: 100% 50% } }

        .lp-float-slow { animation: lpFloatSlow 6s ease-in-out infinite; }
        .lp-glow { animation: lpGlowPulse 5.5s ease-in-out infinite; }
        .lp-shimmer { background-size: 200% 200%; animation: lpShimmer 7s linear infinite; }
      `}</style>

      {/* background */}
      <div className="lp-grain" />
      <div className="absolute inset-0 lp-grid opacity-40" />
      <div
        className="lp-orb bg-orange-300"
        style={{ width: 520, height: 520, top: -220, left: -200, transform: `translate3d(${orbShift.dx}px, ${orbShift.dy}px, 0)` }}
      />
      <div
        className="lp-orb bg-amber-200"
        style={{ width: 420, height: 420, top: 120, right: -180, transform: `translate3d(${-orbShift.dx}px, ${orbShift.dy}px, 0)` }}
      />
      <div
        className="lp-orb bg-rose-200"
        style={{ width: 520, height: 520, bottom: -240, left: 80, transform: `translate3d(${orbShift.dx}px, ${-orbShift.dy}px, 0)` }}
      />


{/* top bar */}
<div className="sticky top-0 z-30 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 backdrop-blur-xl bg-white/60 border-b border-orange-100/60">
  <div className="mx-auto max-w-6xl flex items-center justify-between gap-3">
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="inline-flex items-center gap-2 font-extrabold tracking-tight text-gray-900"
      aria-label="Haylingua home"
    >
      <span className="h-9 w-9 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 shadow-sm grid place-items-center text-white text-sm">
        Հ
      </span>
      <span className="text-base sm:text-lg">Haylingua</span>
      <span className="hidden sm:inline-flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full text-[
              {
                t: "1) Learn the alphabet",
                icon: BookOpen,
                d: "Recognition + sound mapping, so your brain stops guessing and starts reading.",
              },
              {
                t: "2) Build words",
                icon: Keyboard,
                d: "Start combining letters into real words with typing and listening tasks.",
              },
              {
                t: "3) Use it daily",
                icon: Flame,
                d: "Earn XP and streaks, repeat intelligently, and unlock lessons with confidence.",
              },
            ].map((x) => (
              <div
                key={x.t}
                className="group bg-white/70 border border-orange-100 rounded-3xl p-6 shadow-sm hover:bg-white transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-bold text-gray-900">{x.t}</div>
                  {x.icon ? (
                    <div className="h-10 w-10 rounded-2xl bg-white/70 border border-orange-100 shadow-sm grid place-items-center lp-float-slow">
                      <x.icon className="w-5 h-5 text-orange-600" />
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-orange-200 to-rose-200 border border-orange-100 shadow-sm lp-float-slow" />
                  )}
                </div>
                <div className="mt-2 text-sm text-gray-700 leading-relaxed">{x.d}</div>
                <div className="mt-4 h-1.5 w-full rounded-full bg-orange-100 overflow-hidden">
                  <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 group-hover:w-3/5 transition-all duration-500" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* roadmap */}
        <section ref={roadmapRef} className="mt-16 mx-auto max-w-6xl scroll-mt-24">
          <div className="bg-white/70 border border-orange-100 rounded-3xl p-6 sm:p-8 shadow-sm overflow-hidden relative">
            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-orange-200/50 blur-2xl" />
            <div className="absolute -bottom-12 -left-10 h-44 w-44 rounded-full bg-rose-200/50 blur-2xl" />

            <div className="relative">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Progress path</h2>
                  <p className="mt-2 text-gray-700 max-w-3xl">
                    Built like a game — but optimized for real learning outcomes.
                  </p>
                </div>
                <a
                  href="https://blog.haylingua.am"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-2xl text-sm font-semibold text-gray-800 bg-white/80 border border-orange-100 shadow-sm hover:bg-white"
                >
                  See updates on the blog →
                </a>
              </div>

              <div className="mt-8 grid md:grid-cols-6 gap-4">
                {[
  { label: "Alphabet", icon: BookOpen, desc: "Recognize letters + match sounds." },
  { label: "Sounds", icon: Headphones, desc: "Hear, repeat, and pick correctly." },
  { label: "Words", icon: Layers3, desc: "Build and read real words." },
  { label: "Spelling", icon: Keyboard, desc: "Type confidently, fewer mistakes." },
  { label: "Sentences", icon: Route, desc: "Order, translate, and understand." },
  { label: "Mastery", icon: BarChart3, desc: "Reinforce weak points with XP." },
].map((x, i) => (
  <div
    key={x.label}
    className="group rounded-3xl border border-orange-100 bg-white/70 p-4 shadow-sm hover:bg-white transition"
  >
    <div className="flex items-center justify-between">
      <div className="text-xs font-bold text-gray-700">Stage {i + 1}</div>
      <div className="h-8 w-8 rounded-2xl bg-white/70 border border-orange-100 shadow-sm grid place-items-center">
        <x.icon className="w-4 h-4 text-orange-600" />
      </div>
    </div>
    <div className="mt-2 font-extrabold text-gray-900">{x.label}</div>
    <div className="mt-1 text-xs text-gray-600 leading-relaxed">{x.desc}</div>
    <div className="mt-3 h-1.5 w-full rounded-full bg-orange-100 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-rose-500 transition-all duration-500"
        style={{ width: `${Math.min(100, 25 + i * 12)}%` }}
      />
    </div>
    <div className="mt-2 text-[11px] text-gray-500">Completion turns green in-app.</div>
  </div>
))}
              </div>

              <div className="mt-8 grid lg:grid-cols-2 gap-5">
                <div className="rounded-3xl border border-orange-100 bg-white/70 p-6 shadow-sm">
                  <div className="font-extrabold text-gray-900">High-score learning</div>
                  <div className="mt-2 text-sm text-gray-700 leading-relaxed">
                    Exercises are designed so you can improve quickly: clear prompts, instant correction, and repeatable patterns.
                    The result is confidence — and higher accuracy — fast.
                  </div>
                </div>
                <div className="rounded-3xl border border-orange-100 bg-white/70 p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-extrabold text-gray-900">Premium motion, zero distraction</div>
                    <div className="h-10 w-10 rounded-2xl bg-white/70 border border-orange-100 shadow-sm grid place-items-center">
                      <Wand2 className="w-5 h-5 text-orange-600" />
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-700 leading-relaxed">
                    Apple-level polish with a “web3” edge: soft gradients, glassy surfaces, and micro‑interactions that guide your eyes — not steal your attention.
                    Everything stays crisp, readable, and built for trust.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* trust */}
        <section ref={trustRef} className="mt-16 mx-auto max-w-6xl scroll-mt-24">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Built to earn trust</h2>
          <p className="mt-2 text-gray-700 max-w-3xl">
            You’re here to learn — not to get spammed. Haylingua is designed to be safe, fast, and respectful.
          </p>
          <div className="mt-8 grid md:grid-cols-3 gap-5">
            {[
              {
                t: "Email verification",
                icon: Mail,
                d: "We verify accounts to keep the platform clean and your progress secure.",
              },
              {
                t: "Secure data",
                icon: ShieldCheck,
                d: "Your learning data stays yours. We don’t sell it to third parties.",
              },
              {
                t: "Clear progression",
                icon: Sparkles,
                d: "XP-based structure means you always know what you’ve earned and what’s next.",
              },
            ].map((x) => (
              <div key={x.t} className="bg-white/70 border border-orange-100 rounded-3xl p-6 shadow-sm hover:bg-white transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-bold text-gray-900">{x.t}</div>
                  <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-orange-200 to-amber-200 border border-orange-100 shadow-sm grid place-items-center">
                    <x.icon className="h-5 w-5 text-orange-700" />
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-700 leading-relaxed">{x.d}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-3xl border border-orange-100 bg-white/70 p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-gray-900">One clear goal</div>
                <div className="mt-1 text-gray-700">
                  Get you from <span className="font-semibold">zero</span> to reading Armenian confidently — with the fastest path possible.
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError("");
                    scrollToAuth();
                  }}
                  className="px-4 py-2 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-orange-600 to-rose-600 cta-float shadow"
                >
                  Create account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError("");
                    scrollToAuth();
                  }}
                  className="px-4 py-2 rounded-2xl text-sm font-semibold text-gray-900 bg-white/80 border border-orange-100 shadow-sm hover:bg-white"
                >
                  Log in
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* features */}
        <section className="mt-16 mx-auto max-w-6xl">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">What you get</h2>
          <p className="mt-2 text-gray-700 max-w-3xl">
            A clean learning path that starts from the alphabet and builds into real reading and writing — without overwhelming you.
          </p>
          <div className="mt-8 grid md:grid-cols-3 gap-5">
            
{[
              { t: "Interactive exercises", icon: Target, d: "Listening, typing, and recognition tasks designed for fast retention." },
              { t: "Gamified progress", icon: Flame, d: "Earn XP, keep streaks, and see your improvement clearly." },
              { t: "Smart structure", icon: Route, d: "Lessons are ordered, consistent, and focused — no random jumps." },
              { t: "Audio-first", icon: Headphones, d: "Train pronunciation and ear early, not after you already build bad habits." },
              { t: "Fast onboarding", icon: Timer, d: "Sign up in seconds and start learning immediately." },
              { t: "Blog & updates", icon: BookOpen, d: "Follow new features, study tips, and Armenian language notes." },
            ].map((x) => (              
<div key={x.t} className="group bg-white/70 border border-orange-100 rounded-3xl p-6 shadow-sm hover:bg-white transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-bold text-gray-900">{x.t}</div>
                  <div className="h-10 w-10 rounded-2xl bg-white/70 border border-orange-100 shadow-sm grid place-items-center lp-float-slow">
                    <x.icon className="w-5 h-5 text-orange-600" />
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-700 leading-relaxed">{x.d}</div>
              </div>
            ))}
          </div>
        </section>

        
{/* about */}
<section className="mt-16 mx-auto max-w-6xl">
  <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">About Haylingua</h2>
  <p className="mt-2 text-gray-700 max-w-3xl">
    Haylingua is a premium Armenian language learning app built for beginners who want measurable progress — fast, structured, and enjoyable.
  </p>

  <div className="mt-6 grid lg:grid-cols-2 gap-6">
    <div className="bg-white/70 border border-orange-100 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
      <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-orange-200/50 blur-2xl" />
      <div className="relative">
        <div className="text-sm font-bold text-gray-900">Learn Armenian the right way</div>
        <div className="mt-2 text-sm sm:text-base text-gray-800 leading-relaxed">
          Armenian has a unique alphabet and sound system. Haylingua starts with the fundamentals — letter recognition, sound mapping, and
          pronunciation habits — then builds into real words, spelling, and sentence understanding through short, repeatable exercises.
        </div>

        <div className="mt-5 grid sm:grid-cols-2 gap-3">
          {[
            { t: "Beginner-first path", d: "No random jumps. You always know what comes next.", icon: Route },
            { t: "High-accuracy practice", d: "Instant correction + smart repetition to raise scores.", icon: CheckCircle2 },
            { t: "Daily momentum", d: "XP + streaks that make consistency feel effortless.", icon: Flame },
            { t: "Audio & typing", d: "Train your ear and your hands from day one.", icon: Headphones },
          ].map((x) => (
            <div key={x.t} className="rounded-3xl border border-orange-100 bg-white/70 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-2xl bg-white/70 border border-orange-100 shadow-sm grid place-items-center">
                  <x.icon className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-gray-900">{x.t}</div>
                  <div className="mt-1 text-xs text-gray-700 leading-relaxed">{x.d}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError("");
              scrollToAuth();
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-orange-600 to-rose-600 cta-float shadow-sm"
          >
            Start learning <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href="https://blog.haylingua.am"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold text-gray-900 bg-white/80 border border-orange-100 shadow-sm hover:bg-white"
          >
            Read the blog <BookOpen className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>

    <div className="bg-white/70 border border-orange-100 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
      <div className="absolute -bottom-12 -right-12 h-44 w-44 rounded-full bg-rose-200/50 blur-2xl" />
      <div className="relative">
        <div className="text-sm font-bold text-gray-900">Designed like a product you trust</div>
        <div className="mt-2 text-sm sm:text-base text-gray-800 leading-relaxed">
          Fast pages, clean typography, and motion that feels intentional. We keep it modern and “web3”‑clean — but always readable,
          predictable, and safe.
        </div>

        <div className="mt-5 grid sm:grid-cols-2 gap-3">
          {[
            { t: "Secure data", d: "Your account and progress are protected.", icon: ShieldCheck },
            { t: "Verified accounts", d: "Email verification keeps the platform clean.", icon: Mail },
            { t: "Focused UX", d: "No clutter — just learning and progress.", icon: Target },
            { t: "Built for streaks", d: "Short sessions that fit real life.", icon: Timer },
          ].map((x) => (
            <div key={x.t} className="rounded-3xl border border-orange-100 bg-white/70 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-2xl bg-white/70 border border-orange-100 shadow-sm grid place-items-center">
                  <x.icon className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-gray-900">{x.t}</div>
                  <div className="mt-1 text-xs text-gray-700 leading-relaxed">{x.d}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-3xl border border-orange-100 bg-white/70 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="font-extrabold text-gray-900">SEO note</div>
            <div className="h-10 w-10 rounded-2xl bg-white/70 border border-orange-100 shadow-sm grid place-items-center">
              <GraduationCap className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-700 leading-relaxed">
            Looking for an <span className="font-semibold">Armenian alphabet learning app</span> or a <span className="font-semibold">beginner Armenian course</span>?
            Haylingua is built to take you from letters to real reading — with progress you can see.
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

{/* footer */}}
        <footer ref={blogRef} className="mt-16 mx-auto max-w-6xl pb-10">
  {/* Blog CTA (secondary) */}
  <div className="rounded-3xl border border-orange-100 bg-white/70 p-6 sm:p-8 shadow-sm">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <div className="text-sm font-bold text-gray-900">Blog: short tips that boost your progress</div>
        <div className="mt-1 text-gray-700">
          Pronunciation notes, alphabet breakdowns, and product updates — all at blog.haylingua.am
        </div>
      </div>
      <a
        href="https://blog.haylingua.am"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold text-gray-900 bg-white/80 border border-orange-100 shadow-sm hover:bg-white"
      >
        Open blog <ArrowRight className="w-4 h-4" />
      </a>
    </div>
  </div>

  {/* Footer template */}
  <div className="mt-8 rounded-3xl border border-orange-100 bg-white/70 p-6 sm:p-8 shadow-sm">
    <div className="grid md:grid-cols-5 gap-8">
      <div className="md:col-span-2">
        <div className="flex items-center gap-2 font-extrabold tracking-tight text-gray-900">
          <span className="h-9 w-9 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 shadow-sm grid place-items-center text-white text-sm">
            Հ
          </span>
          <span className="text-lg">Haylingua</span>
        </div>
        <p className="mt-3 text-sm text-gray-700 leading-relaxed">
          A modern Armenian language learning experience for beginners — optimized for confidence, accuracy, and “high-score” progress.
        </p>

        <div className="mt-4 flex items-center gap-2">
          <a
            href="https://blog.haylingua.am"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-semibold text-gray-900 bg-white/80 border border-orange-100 shadow-sm hover:bg-white"
          >
            <BookOpen className="w-4 h-4" />
            Blog
          </a>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError("");
              scrollToAuth();
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-orange-600 to-rose-600 cta-float shadow-sm"
          >
            Create account <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div>
        <div className="text-xs font-bold tracking-wide text-gray-900 uppercase">Product</div>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li><button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-gray-900">Overview</button></li>
          <li><button type="button" onClick={() => howRef.current?.scrollIntoView({ behavior: "smooth" })} className="hover:text-gray-900">Roadmap</button></li>
          <li><button type="button" onClick={() => roadmapRef.current?.scrollIntoView({ behavior: "smooth" })} className="hover:text-gray-900">Progress path</button></li>
          <li><button type="button" onClick={() => trustRef.current?.scrollIntoView({ behavior: "smooth" })} className="hover:text-gray-900">Trust</button></li>
        </ul>
      </div>

      <div>
        <div className="text-xs font-bold tracking-wide text-gray-900 uppercase">Learn</div>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li><a className="hover:text-gray-900" href="https://blog.haylingua.am" target="_blank" rel="noreferrer">Study tips</a></li>
          <li><a className="hover:text-gray-900" href="https://blog.haylingua.am" target="_blank" rel="noreferrer">Alphabet notes</a></li>
          <li><a className="hover:text-gray-900" href="https://blog.haylingua.am" target="_blank" rel="noreferrer">Release updates</a></li>
        </ul>
      </div>

      <div>
        <div className="text-xs font-bold tracking-wide text-gray-900 uppercase">Legal</div>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          <li><span className="text-gray-600">Terms</span></li>
          <li><span className="text-gray-600">Privacy</span></li>
          <li><span className="text-gray-600">Cookies</span></li>
        </ul>
      </div>
    </div>

    <div className="mt-8 pt-6 border-t border-orange-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm text-gray-600">
      <div>© {new Date().getFullYear()} Haylingua. All rights reserved.</div>
      <div className="flex items-center gap-2">
        <a href="https://blog.haylingua.am" target="_blank" rel="noreferrer" className="h-10 w-10 rounded-2xl bg-white/80 border border-orange-100 shadow-sm grid place-items-center hover:bg-white" aria-label="Haylingua Blog">
          <BookOpen className="w-4 h-4 text-gray-700" />
        </a>
        <span className="h-10 w-10 rounded-2xl bg-white/80 border border-orange-100 shadow-sm grid place-items-center" aria-label="Twitter (placeholder)">
          <Twitter className="w-4 h-4 text-gray-700" />
        </span>
        <span className="h-10 w-10 rounded-2xl bg-white/80 border border-orange-100 shadow-sm grid place-items-center" aria-label="Instagram (placeholder)">
          <Instagram className="w-4 h-4 text-gray-700" />
        </span>
        <span className="h-10 w-10 rounded-2xl bg-white/80 border border-orange-100 shadow-sm grid place-items-center" aria-label="YouTube (placeholder)">
          <Youtube className="w-4 h-4 text-gray-700" />
        </span>
      </div>
    </div>
  </div>
</footer>
      </main>
    </div>
  );
}
