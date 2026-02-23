// src/LandingPage.jsx - Marketing landing + inline auth + email verification
import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Lock, Mail, User, Sparkles, ArrowRight, LogIn, BookOpen, ShieldCheck, CheckCircle2, Headphones, Keyboard, Flame, Target, Timer, Layers3, GraduationCap, Route, BarChart3, Fingerprint, Wand2, Globe, Twitter, Instagram, Youtube } from "lucide-react";

const API_BASE = "https://haylinguav2.onrender.com";

const revealContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.08 } },
};

const revealUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

const inViewOnce = { once: true, margin: "-80px" };


export default function LandingPage({ onLogin, onSignup }) {
  const [mode, setMode] = useState("login"); // 'login' | 'signup' | 'verify'
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [otp, setOtp] = useState("");
  const [needs2FA, setNeeds2FA] = useState(false);

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
        await onLogin(email.trim(), password, needs2FA ? otp : null);
      } else if (mode === "signup") {
        // Handle signup ourselves to get verification code
        await handleSignup();
      }
    } catch (err) {
      console.error("Auth error", err);
      if (mode === "login" && err?.requires2fa) {
        setNeeds2FA(true);
        setError("2FA is enabled for this account. Enter your authenticator or recovery code.");
      } else {
        setError(err.message || "Something went wrong");
      }
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
        className="min-h-screen lp-bg bg-gradient-to-br from-orange-50 via-white to-amber-50"
        onMouseMove={onMouseMove}
      >
        {/* background */}
        <div className="lp-grain" />
        <style>{`
html{scroll-behavior:smooth;}
.lp-float-wrap{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;}
.lp-float{position:absolute;border-radius:9999px;filter:blur(70px);opacity:.32;mix-blend-mode:multiply;animation:lpFloat 16s ease-in-out infinite;transform:translate3d(0,0,0);}
.lp-float-1{width:520px;height:520px;top:-180px;left:-140px;background:radial-gradient(circle at 30% 30%, rgba(255,159,67,.9), rgba(255,159,67,0));}
.lp-float-2{width:540px;height:540px;bottom:-220px;right:-180px;animation-delay:-5s;background:radial-gradient(circle at 40% 40%, rgba(99,102,241,.85), rgba(251,113,133,0));}
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
      className="min-h-screen lp-bg bg-gradient-to-br from-orange-50 via-white to-amber-50"
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
      <div className="lp-grain pointer-events-none" />
      <div className="absolute inset-0 lp-grid opacity-40 pointer-events-none" />
      <div
        className="lp-orb bg-orange-300 pointer-events-none"
        style={{ width: 520, height: 520, top: -220, left: -200, transform: `translate3d(${orbShift.dx}px, ${orbShift.dy}px, 0)` }}
      />
      <div
        className="lp-orb bg-amber-200 pointer-events-none"
        style={{ width: 420, height: 420, top: 120, right: -180, transform: `translate3d(${-orbShift.dx}px, ${orbShift.dy}px, 0)` }}
      />
      <div
        className="lp-orb bg-orange-200 pointer-events-none"
        style={{ width: 520, height: 520, bottom: -240, left: 80, transform: `translate3d(${orbShift.dx}px, ${-orbShift.dy}px, 0)` }}
      />


      {/* foreground */}
      <div className="relative z-10 px-4 sm:px-8">


{/* top bar */}
<header className="sticky top-0 z-30 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 backdrop-blur-xl bg-white/65 border-b border-orange-100/60">
  <div className="mx-auto max-w-6xl flex items-center justify-between gap-3">
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="inline-flex items-center gap-2 font-extrabold tracking-tight text-slate-900"
      aria-label="Haylingua home"
    >
      <span className="h-9 w-9 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-sm grid place-items-center text-white text-sm">
        Հ
      </span>
      <span className="text-base sm:text-lg">Haylingua</span>
    </button>

    <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
      <button type="button" onClick={() => scrollToRef(howRef)} className="hover:text-slate-900">How it works</button>
      <button type="button" onClick={() => scrollToRef(roadmapRef)} className="hover:text-slate-900">Features</button>
      <button type="button" onClick={() => scrollToRef(trustRef)} className="hover:text-slate-900">FAQ</button>
    </nav>

    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          setMode("login");
          setError("");
          scrollToAuth();
        }}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-sm font-semibold text-slate-900 bg-white/80 border border-orange-100 shadow-sm hover:bg-white transition"
      >
        <LogIn className="w-4 h-4" /> Log in
      </button>
      <button
        type="button"
        onClick={() => {
          setMode("signup");
          setError("");
          scrollToAuth();
        }}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-orange-600 to-amber-500 shadow-sm hover:opacity-95"
      >
        <Sparkles className="w-4 h-4" /> Sign up
      </button>
    </div>
  </div>
</header>

{/* hero */}
<section className="mx-auto max-w-6xl pt-10 sm:pt-16">
  <motion.div variants={revealContainer} initial="hidden" animate="show" className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
    <div>
      <motion.div variants={revealUp} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border border-orange-100 text-xs font-extrabold text-slate-700">
        <Sparkles className="w-4 h-4 text-orange-600" />
        Armenian-only • Duolingo-style learning
      </motion.div>

      <motion.h1 variants={revealUp} className="mt-4 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
        Learn Armenian with short, addictive lessons —{" "}
        <span className="bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent">
          and real progress.
        </span>
      </motion.h1>

      <motion.p variants={revealUp} className="mt-4 text-base sm:text-lg text-slate-700 max-w-xl leading-relaxed">
        Practice reading, listening, and writing with gamified exercises, XP, streaks, and a clean, focused path for beginners.
      </motion.p>

      <motion.div variants={revealUp} className="mt-7 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError("");
            scrollToAuth();
          }}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-orange-600 to-amber-500 shadow"
        >
          Start free <ArrowRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError("");
            scrollToAuth();
          }}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-slate-900 bg-white/80 border border-orange-100 shadow-sm hover:bg-white transition"
        >
          Log in <LogIn className="w-4 h-4" />
        </button>
      </motion.div>

      <motion.div variants={revealUp} className="mt-8 flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span className="rounded-full border border-orange-100 bg-white/80 px-3 py-1">⚡ 2–4 min lessons</span>
        <span className="rounded-full border border-orange-100 bg-white/80 px-3 py-1">🔥 Streaks & achievements</span>
        <span className="rounded-full border border-orange-100 bg-white/80 px-3 py-1">🔊 Audio drills</span>
        <span className="rounded-full border border-orange-100 bg-white/80 px-3 py-1">⌨️ Typing practice</span>
      </motion.div>
    </div>

    <motion.div variants={revealUp} className="relative">
      <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className="rounded-3xl border border-orange-100 bg-white/80 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm font-extrabold text-slate-900">Today’s lesson</div>
          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">+25 XP</span>
        </div>

        <div className="mt-5 grid gap-3">
          <div className="rounded-2xl border border-orange-100 bg-white p-4">
            <div className="text-xs text-slate-500 font-semibold">Exercise</div>
            <div className="mt-1 text-sm font-extrabold text-slate-900">Match the sound to the letter</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Ա", "Բ", "Գ", "Դ"].map((c) => (
                <button
                  key={c}
                  className="rounded-xl border border-orange-100 bg-white px-4 py-2 text-sm font-extrabold hover:bg-orange-50 transition"
                  type="button"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-orange-100 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-semibold">Streak</div>
                <div className="mt-1 text-sm font-extrabold text-slate-900">10 days</div>
              </div>
              <div className="text-2xl">🔥</div>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-orange-50">
              <div className="h-2 w-2/3 rounded-full bg-gradient-to-r from-orange-600 to-amber-500" />
            </div>
            <div className="mt-2 text-xs text-slate-600">Keep going to unlock more XP boosts.</div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  </motion.div>
</section>

{/* how it works */}
<section ref={howRef} className="mx-auto max-w-6xl mt-14 sm:mt-20 scroll-mt-24">
  <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={inViewOnce} transition={{ duration: 0.5, ease: "easeOut" }}>
    <div className="text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border border-orange-100 text-xs font-extrabold text-slate-700">
        <Route className="w-4 h-4 text-orange-600" /> How it works
      </div>
      <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">A simple loop: learn → practice → improve.</h2>
      <p className="mt-3 text-slate-700 max-w-2xl mx-auto leading-relaxed">
        No clutter. Just clear progression and repeatable wins — optimized for Armenian learners.
      </p>
    </div>

    <div className="mt-8 grid gap-4 md:grid-cols-3">
      {[
        { step: "01", title: "Start with the alphabet", desc: "Recognize letters quickly with visual + sound pairing.", icon: BookOpen },
        { step: "02", title: "Short exercises that stick", desc: "MCQ, typing, matching, and fill-in tasks to build recall.", icon: Layers3 },
        { step: "03", title: "Review mistakes & level up", desc: "See what went wrong, retry, and keep your streak alive.", icon: BarChart3 },
      ].map((s) => (
        <motion.div key={s.step} whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className="rounded-3xl border border-orange-100 bg-white/80 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs font-extrabold text-orange-700">{s.step}</div>
            <div className="h-10 w-10 rounded-2xl bg-white border border-orange-100 shadow-sm grid place-items-center">
              <s.icon className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <div className="mt-3 text-base font-extrabold text-slate-900">{s.title}</div>
          <div className="mt-2 text-sm text-slate-700 leading-relaxed">{s.desc}</div>
        </motion.div>
      ))}
    </div>
  </motion.div>
</section>

{/* features */}
<section ref={roadmapRef} className="mx-auto max-w-6xl mt-14 sm:mt-20 scroll-mt-24">
  <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={inViewOnce} transition={{ duration: 0.5, ease: "easeOut" }}>
    <div className="text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border border-orange-100 text-xs font-extrabold text-slate-700">
        <Wand2 className="w-4 h-4 text-orange-600" /> Features
      </div>
      <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Everything you need to stick with Armenian.</h2>
      <p className="mt-3 text-slate-700 max-w-2xl mx-auto leading-relaxed">
        Gamified progress, clean UX, and exercises that feel rewarding — not overwhelming.
      </p>
    </div>

    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[
        { t: "XP that means something", d: "Earn XP per exercise and see clear totals per lesson.", icon: Sparkles },
        { t: "Streaks & motivation", d: "Build consistency with streaks and achievements.", icon: Flame },
        { t: "Audio-first practice", d: "Train your ear early with sound-based tasks.", icon: Headphones },
        { t: "Typing & spelling", d: "Practice Armenian letters and real words.", icon: Keyboard },
        { t: "Verified accounts", d: "Email verification improves safety and trust.", icon: ShieldCheck },
        { t: "Progress analytics", d: "Review mistakes and retry weak spots.", icon: BarChart3 },
      ].map((x) => (
        <motion.div key={x.t} whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className="rounded-3xl border border-orange-100 bg-white/80 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white border border-orange-100 shadow-sm grid place-items-center">
              <x.icon className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-sm font-extrabold text-slate-900">{x.t}</div>
              <div className="mt-2 text-sm text-slate-700 leading-relaxed">{x.d}</div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  </motion.div>
</section>

{/* FAQ / trust */}
<section ref={trustRef} className="mx-auto max-w-6xl mt-14 sm:mt-20 scroll-mt-24 pb-6">
  <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={inViewOnce} transition={{ duration: 0.5, ease: "easeOut" }}>
    <div className="text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border border-orange-100 text-xs font-extrabold text-slate-700">
        <CheckCircle2 className="w-4 h-4 text-orange-600" /> FAQ
      </div>
      <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Common questions</h2>
      <p className="mt-3 text-slate-700 max-w-2xl mx-auto leading-relaxed">
        Focused product, simple answers.
      </p>
    </div>

    <div className="mt-8 grid gap-3 max-w-3xl mx-auto">
      {[
        { q: "Is this only for Armenian?", a: "Yes. Haylingua is focused entirely on Armenian to keep the path coherent and high quality." },
        { q: "Is it beginner friendly?", a: "Yes. Start from the alphabet and progress with short guided exercises." },
        { q: "Do I need to know Armenian script already?", a: "No — the early lessons teach recognition and sound mapping from zero." },
      ].map((f) => (
        <details key={f.q} className="group rounded-2xl border border-orange-100 bg-white/80 p-5 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="text-sm sm:text-base font-extrabold text-slate-900">{f.q}</span>
            <span className="text-slate-400 transition group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-700">{f.a}</p>
        </details>
      ))}
    </div>

    <div className="mt-8 flex justify-center">
      <button
        type="button"
        onClick={() => {
          setMode("signup");
          setError("");
          scrollToAuth();
        }}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-orange-600 to-amber-500 shadow"
      >
        Create account <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  </motion.div>
</section>


{/* auth */}
<section ref={authRef} className="mt-16 mx-auto max-w-6xl scroll-mt-24">
  <div className="rounded-3xl border border-orange-100 bg-white/70 shadow-sm overflow-hidden">
    <div className="grid lg:grid-cols-2">
      <div className="p-6 sm:p-10 bg-gradient-to-br from-orange-50/70 via-white to-amber-50/70">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-orange-100 text-xs font-bold text-slate-700">
          <ShieldCheck className="w-4 h-4 text-orange-600" /> Secure, fast start
        </div>
        <h2 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          Start learning Armenian in minutes.
        </h2>
        <p className="mt-3 text-slate-700 leading-relaxed max-w-md">
          Create an account to track XP, streaks, and lesson progress — or log in to continue where you left off.
        </p>

        <div className="mt-6 grid sm:grid-cols-2 gap-3 text-sm text-slate-700">
          <div className="lp-card rounded-2xl bg-white/80 border border-orange-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 font-bold"><Target className="w-4 h-4 text-orange-600" /> Score-focused practice</div>
            <div className="mt-1 text-slate-600">Clear exercises that build accuracy fast.</div>
          </div>
          <div className="lp-card rounded-2xl bg-white/80 border border-orange-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 font-bold"><Flame className="w-4 h-4 text-orange-600" /> XP + streaks</div>
            <div className="mt-1 text-slate-600">Motivation that keeps you consistent.</div>
          </div>
          <div className="lp-card rounded-2xl bg-white/80 border border-orange-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 font-bold"><Keyboard className="w-4 h-4 text-orange-600" /> Spelling & typing</div>
            <div className="mt-1 text-slate-600">Train the alphabet and real words.</div>
          </div>
          <div className="lp-card rounded-2xl bg-white/80 border border-orange-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 font-bold"><CheckCircle2 className="w-4 h-4 text-orange-600" /> Verified accounts</div>
            <div className="mt-1 text-slate-600">Email verification improves safety.</div>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-10">
        <div className="flex items-center gap-2 rounded-2xl bg-orange-50 border border-orange-100 p-1 w-fit">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`px-4 py-2 rounded-2xl text-sm font-semibold transition ${mode === "login" ? "bg-white shadow-sm text-slate-900" : "text-slate-700 hover:text-slate-900"}`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError("");
            }}
            className={`px-4 py-2 rounded-2xl text-sm font-semibold transition ${mode === "signup" ? "bg-white shadow-sm text-slate-900" : "text-slate-700 hover:text-slate-900"}`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          {mode === "signup" && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700">Name (optional)</label>
                <div className="mt-1 flex items-center gap-2 px-3 py-2 rounded-2xl bg-white border border-orange-100 shadow-sm">
                  <User className="w-4 h-4 text-orange-600" />
                  <input
                    className="w-full outline-none text-sm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Armen"
                    autoComplete="name"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Username</label>
                <div className="mt-1 flex items-center gap-2 px-3 py-2 rounded-2xl bg-white border border-orange-100 shadow-sm">
                  <Fingerprint className="w-4 h-4 text-orange-600" />
                  <input
                    className="w-full outline-none text-sm"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="armen"
                    autoComplete="username"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700">Email</label>
            <div className="mt-1 flex items-center gap-2 px-3 py-2 rounded-2xl bg-white border border-orange-100 shadow-sm">
              <Mail className="w-4 h-4 text-orange-600" />
              <input
                className="w-full outline-none text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">Password</label>
            <div className="mt-1 flex items-center gap-2 px-3 py-2 rounded-2xl bg-white border border-orange-100 shadow-sm">
              <Lock className="w-4 h-4 text-orange-600" />
              <input
                className="w-full outline-none text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
          </div>

          {mode === "login" && needs2FA && (
            <div>
              <label className="text-xs font-bold text-slate-700">2FA code</label>
              <div className="mt-1 flex items-center gap-2 px-3 py-2 rounded-2xl bg-white border border-orange-100 shadow-sm">
                <ShieldCheck className="w-4 h-4 text-orange-600" />
                <input
                  className="w-full outline-none text-sm"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="6-digit code or recovery"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </div>
            </div>
          )}

          {mode === "signup" && (
            <div>
              <label className="text-xs font-bold text-slate-700">Confirm password</label>
              <div className="mt-1 flex items-center gap-2 px-3 py-2 rounded-2xl bg-white border border-orange-100 shadow-sm">
                <Lock className="w-4 h-4 text-orange-600" />
                <input
                  className="w-full outline-none text-sm"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder="••••••••"
                  type="password"
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-orange-600 to-amber-500 shadow hover:opacity-95 disabled:opacity-60"
          >
            {loading
              ? "Please wait…"
              : mode === "login"
              ? needs2FA
                ? "Verify & log in"
                : "Log in"
              : "Create account"}{" "}
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="text-xs text-slate-600">
            By continuing you agree to our terms and privacy policy.
          </div>
        </form>
      </div>
    </div>
  </div>
</section>

{/* footer */}
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
          <span className="h-9 w-9 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-sm grid place-items-center text-white text-sm">
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
            className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-orange-600 to-amber-500 cta-float shadow-sm"
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
      </div>
    </div>
  );
}
