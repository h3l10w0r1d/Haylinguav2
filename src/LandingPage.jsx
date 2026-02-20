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
<div className="sticky top-0 z-30 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 backdrop-blur-xl bg-white/65 border-b border-orange-100/60">
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
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-orange-600 to-amber-500 cta-float shadow-sm"
      >
        <Sparkles className="w-4 h-4" /> Create account
      </button>
    </div>
  </div>
</div>

{/* hero */}
<section className="mx-auto max-w-6xl pt-12 sm:pt-16">
  <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
    <div>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border border-orange-100 text-xs font-bold text-slate-700">
        <Sparkles className="w-4 h-4 text-orange-600" />
        Armenian learning for beginners
      </div>

      <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
        Learn Armenian online — <span className="bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent">fast, structured, and score‑focused.</span>
      </h1>

      <p className="mt-4 text-base sm:text-lg text-slate-700 max-w-xl leading-relaxed">
        Haylingua is a gamified Armenian language learning app built to help beginners master the alphabet, pronunciation, and spelling —
        with a clear path and measurable progress.
      </p>

      <div className="mt-7 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError("");
            scrollToAuth();
          }}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-orange-600 to-amber-500 cta-float shadow"
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
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-600">
        <div className="inline-flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-orange-600" /> Secure data
        </div>
        <div className="inline-flex items-center gap-2">
          <Target className="w-4 h-4 text-orange-600" /> High‑accuracy exercises
        </div>
        <div className="inline-flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-600" /> XP + streaks
        </div>
      </div>
    </div>

    <div className="relative">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-orange-200/40 via-white/20 to-amber-200/40 blur-2xl lp-glow-pulse" />
      <div className="relative rounded-[2.5rem] border border-orange-100 bg-white/70 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div className="font-extrabold text-slate-900">Your learning path</div>
            <div className="h-10 w-10 rounded-2xl bg-white/80 border border-orange-100 shadow-sm grid place-items-center">
              <Route className="w-5 h-5 text-orange-600" />
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {[
              { t: "Alphabet mastery", d: "Recognize letters and match sounds correctly.", icon: BookOpen },
              { t: "Words & spelling", d: "Build real words with listening + typing drills.", icon: Keyboard },
              { t: "Daily progress", d: "Earn XP, keep streaks, and reinforce weak points.", icon: Flame },
            ].map((x) => (
              <div key={x.t} className="group rounded-3xl border border-orange-100 bg-white/70 p-4 shadow-sm hover:bg-white transition">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-extrabold text-slate-900">{x.t}</div>
                    <div className="mt-1 text-sm text-slate-700">{x.d}</div>
                  </div>
                  <div className="h-10 w-10 rounded-2xl bg-white/80 border border-orange-100 shadow-sm grid place-items-center lp-float-slow">
                    <x.icon className="w-5 h-5 text-orange-600" />
                  </div>
                </div>
                <div className="mt-4 h-1.5 w-full rounded-full bg-orange-100 overflow-hidden">
                  <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 group-hover:w-3/5 transition-all duration-500" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-3xl border border-orange-100 bg-white/70 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-extrabold text-slate-900">Beginner‑friendly. Results‑driven.</div>
              <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-orange-600" /> Clean scoring feedback
              </div>
            </div>
            <div className="mt-2 text-sm text-slate-700 leading-relaxed">
              Short sessions, clear prompts, instant correction — so your accuracy climbs fast and confidence follows.
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-6">
          <div className="h-10 rounded-2xl bg-gradient-to-r from-orange-100 via-white to-amber-100 shimmer" />
        </div>
      </div>
    </div>
  </div>
</section>

{/* how it works */}
<section ref={howRef} className="mt-16 mx-auto max-w-6xl scroll-mt-24">
  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">How it works</h2>
  <p className="mt-2 text-slate-700 max-w-3xl">
    A structured path designed for beginners: learn the Armenian alphabet, build real words, and improve your score with daily practice.
  </p>

  <div className="mt-8 grid md:grid-cols-3 gap-5">
    {[
      { t: "1) Master the alphabet", icon: BookOpen, d: "Recognition + sound mapping, so your brain stops guessing and starts reading." },
      { t: "2) Build real words", icon: Keyboard, d: "Combine letters into words with listening, spelling, and typing practice." },
      { t: "3) Improve daily", icon: Flame, d: "Earn XP and streaks, repeat intelligently, and reinforce weak points." },
    ].map((x) => (
      <div key={x.t} className="group bg-white/70 border border-orange-100 rounded-3xl p-6 shadow-sm hover:bg-white transition">
        <div className="flex items-start justify-between gap-3">
          <div className="font-extrabold text-slate-900">{x.t}</div>
          <div className="h-10 w-10 rounded-2xl bg-white/80 border border-orange-100 shadow-sm grid place-items-center lp-float-slow">
            <x.icon className="w-5 h-5 text-orange-600" />
          </div>
        </div>
        <div className="mt-2 text-sm text-slate-700 leading-relaxed">{x.d}</div>
        <div className="mt-4 h-1.5 w-full rounded-full bg-orange-100 overflow-hidden">
          <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 group-hover:w-3/5 transition-all duration-500" />
        </div>
      </div>
    ))}
  </div>
</section>

        {/* roadmap */}
        <section ref={roadmapRef} className="mt-16 mx-auto max-w-6xl scroll-mt-24">
          <div className="bg-white/70 border border-orange-100 rounded-3xl p-6 sm:p-8 shadow-sm overflow-hidden relative">
            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-orange-200/50 blur-2xl" />
            <div className="absolute -bottom-12 -left-10 h-44 w-44 rounded-full bg-orange-200/60 blur-2xl" />

            <div className="relative">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">A roadmap you can actually follow</h2>
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
        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
        style={{ width: `${Math.min(100, 25 + i * 12)}%` }}
      />
    </div>
    <div className="mt-2 text-[11px] text-gray-500">Completion turns green in-app.</div>
  </div>
))}
              </div>

              <div className="mt-8 grid lg:grid-cols-2 gap-5">
                <div className="rounded-3xl border border-orange-100 bg-white/70 p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3"><div className="font-extrabold text-slate-900">High-score learning</div><div className="h-10 w-10 rounded-2xl bg-white/80 border border-orange-100 shadow-sm grid place-items-center"><Target className="w-5 h-5 text-orange-600" /></div></div>
                  <div className="mt-2 text-sm text-gray-700 leading-relaxed">
                    Exercises are designed so you can improve quickly: clear prompts, instant correction, and repeatable patterns.
                    The result is confidence — and higher accuracy — fast.
                  </div>
                </div>
                <div className="rounded-3xl border border-orange-100 bg-white/70 p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-extrabold text-slate-900">Designed for focus. Engineered for clarity.</div>
                    <div className="h-10 w-10 rounded-2xl bg-white/70 border border-orange-100 shadow-sm grid place-items-center">
                      <Wand2 className="w-5 h-5 text-orange-600" />
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-700 leading-relaxed">
                    Subtle motion helps you understand what just happened, what’s next, and how to improve — without noise. Clean cards, crisp typography, and purposeful micro‑interactions keep the experience premium and trustworthy.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        
        {/* progress path (levels) */}
        <section className="mt-16 mx-auto max-w-6xl scroll-mt-24">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Progress path</h2>
          <p className="mt-2 text-slate-700 max-w-3xl">
            A clear sequence of levels that takes you from Armenian alphabet basics to confident reading and writing.
          </p>

          <div className="mt-8 grid lg:grid-cols-3 gap-5">
            {[
              { t: "Level 1 — Foundations", icon: BookOpen, d: "Alphabet, sounds, and recognition. Build correct habits from day one." },
              { t: "Level 2 — Everyday Armenian", icon: Layers3, d: "Words, spelling, and practical vocabulary with repeatable patterns." },
              { t: "Level 3 — Mastery path", icon: BarChart3, d: "Sentence work, review loops, and targeted reinforcement for weak points." },
            ].map((x) => (
              <div key={x.t} className="group rounded-3xl border border-orange-100 bg-white/70 p-6 shadow-sm hover:bg-white transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-extrabold text-slate-900">{x.t}</div>
                  <div className="h-10 w-10 rounded-2xl bg-white/80 border border-orange-100 shadow-sm grid place-items-center lp-float-slow">
                    <x.icon className="w-5 h-5 text-orange-600" />
                  </div>
                </div>
                <div className="mt-2 text-sm text-slate-700 leading-relaxed">{x.d}</div>
                <div className="mt-4 h-1.5 w-full rounded-full bg-orange-100 overflow-hidden">
                  <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 group-hover:w-3/5 transition-all duration-500" />
                </div>
              </div>
            ))}
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
                  className="px-4 py-2 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-orange-600 to-amber-500 cta-float shadow"
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
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-orange-600 to-amber-500 cta-float shadow-sm"
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
      <div className="absolute -bottom-12 -right-12 h-44 w-44 rounded-full bg-orange-200/60 blur-2xl" />
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
            {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"} <ArrowRight className="w-4 h-4" />
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
