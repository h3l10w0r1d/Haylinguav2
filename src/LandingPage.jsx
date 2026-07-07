// src/LandingPage.jsx — Full marketing landing in the Haylingua brand.
// All auth logic preserved: login, signup, 2FA, captcha, email verification.
import Turnstile from "./lib/Turnstile";
import { useState, useEffect, useRef } from "react";
import {
  Lock, Mail, User, ArrowRight, Fingerprint, Sparkles,
  Flame, Trophy, Headphones, Volume2, Users, Heart, Repeat2,
  Check, ChevronDown, Star, Zap, Languages, ShieldCheck, Crown,
} from "lucide-react";
import grandma from "./assets/character-grandma.png";
import student from "./assets/character-student.png";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "387340156498-udb3h083d3mcnj135kvbfcstsdslbe64.apps.googleusercontent.com";
const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "";

const FEATURES = [
  { icon: Languages, title: "Alphabet from scratch", text: "Master all 39 Armenian letters with bite-sized intro, recognition, and typing drills.", tone: "brand" },
  { icon: Headphones, title: "Listen & speak", text: "Real text-to-speech audio on every prompt so you learn how Armenian actually sounds.", tone: "feather" },
  { icon: Repeat2, title: "Smart review", text: "Spaced repetition brings back what you’re about to forget — right when you need it.", tone: "grass" },
  { icon: Flame, title: "Streaks & XP", text: "Earn XP, keep your daily streak alive, and build a habit that sticks.", tone: "brand" },
  { icon: Heart, title: "Hearts", text: "Lose a heart on a wrong answer — a gentle nudge to slow down and get it right.", tone: "cardinal" },
  { icon: Trophy, title: "Leaderboard & friends", text: "Add friends and climb the leaderboard. A little competition goes a long way.", tone: "gold" },
];

const STEPS = [
  { n: 1, title: "Pick a lesson", text: "Start on the path — from your very first letter to full phrases.", icon: Crown },
  { n: 2, title: "Practice & get feedback", text: "Tap, type, listen, and match. Every answer is checked instantly.", icon: Check },
  { n: 3, title: "Keep your streak", text: "Earn XP, unlock the next node, and come back tomorrow.", icon: Flame },
];

const FAQS = [
  { q: "Is Haylingua free?", a: "Yes — you can create an account and start learning the Armenian alphabet and your first lessons for free." },
  { q: "I don’t know the Armenian alphabet at all. Is that okay?", a: "Perfect, that’s exactly where we begin. The first lessons introduce each letter with its sound, examples, and typing practice before you ever build a word." },
  { q: "Do I need a special keyboard?", a: "No. Exercises are tap-and-choose or use on-screen prompts, and typing exercises accept the Armenian letters shown to you." },
  { q: "Does it work on my phone?", a: "Yes. Haylingua is built mobile-first and works in any modern browser on phone, tablet, or desktop." },
  { q: "How do streaks and hearts work?", a: "You earn XP for correct answers and keep a daily streak by practicing each day. Hearts give you a few tries per session so mistakes feel low-stakes." },
];

const TONES = {
  brand: "bg-brand-50 text-brand-500",
  feather: "bg-feather-50 text-feather-600",
  grass: "bg-grass-50 text-grass-600",
  cardinal: "bg-cardinal-50 text-cardinal-500",
  gold: "bg-amber-50 text-gold-600",
};

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

  // UI-only state
  const [faqOpen, setFaqOpen] = useState(0);
  const authRef = useRef(null);
  const tgRef = useRef(null);

  // Telegram widget — inject once when bot username is set
  useEffect(() => {
    if (!TELEGRAM_BOT_USERNAME || !tgRef.current) return;
    tgRef.current.innerHTML = "";
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
        const t = data.access_token;
        localStorage.setItem("hay_token", t);
        localStorage.setItem("access_token", t);
        const u = { id: 1, email: data.email, name: data.email.split("@")[0], email_verified: true };
        localStorage.setItem("hay_user", JSON.stringify(u));
        window.location.href = data.needs_onboarding ? "/onboarding" : "/dashboard";
      } catch (err) {
        setError(err.message || "Telegram sign-in failed");
        setLoading(false);
      }
    };
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.setAttribute("data-telegram-login", TELEGRAM_BOT_USERNAME);
    s.setAttribute("data-size", "large");
    s.setAttribute("data-onauth", "onTelegramAuth(user)");
    s.setAttribute("data-request-access", "write");
    s.async = true;
    tgRef.current.appendChild(s);
    return () => { delete window.onTelegramAuth; };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const goAuth = (m) => {
    setMode(m);
    setError("");
    authRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // ── Auth Handlers (unchanged) ───────────────────────────────────────────────

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

  // ── Verification Screen ─────────────────────────────────────────────────────

  if (mode === "verify") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50/60 to-white px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl ring-1 ring-slate-200">
          <img src={grandma} alt="" className="mx-auto h-20 w-20 animate-floaty rounded-2xl object-cover" />
          <h2 className="mt-4 font-display text-2xl font-extrabold text-slate-800">Check your inbox</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            We sent a 6-digit code to <span className="text-slate-700">{email}</span>
          </p>

          {devCode && (
            <div className="mt-5 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-bold uppercase text-amber-700">🔧 Dev mode — use this code</div>
              <div className="mt-1 font-mono text-3xl font-extrabold tracking-[0.3em] text-amber-900">{devCode}</div>
              <button onClick={() => { setCode(devCode); setError(""); }} className="mt-2 text-sm font-bold text-amber-700 underline">
                Use this code
              </button>
            </div>
          )}

          <form onSubmit={handleVerify} className="mt-5">
            <input
              value={code}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setCode(v); if (error && v.length === 6) setError(""); }}
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              className="w-full rounded-2xl bg-slate-50 px-4 py-4 text-center font-mono text-3xl font-extrabold tracking-[0.4em] text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:outline-none focus:ring-brand-400"
            />
            {error && <div className="mt-3 rounded-xl bg-cardinal-50 px-4 py-2.5 text-sm font-semibold text-cardinal-600">{error}</div>}
            <button type="submit" disabled={loading || code.trim().length !== 6} className="btn3d btn3d-grass mt-4 w-full uppercase">
              {loading ? "Verifying…" : "Verify email"}
            </button>
          </form>

          <button onClick={handleResend} disabled={loading || cooldown > 0} className="mt-4 text-sm font-bold text-slate-500 hover:text-slate-700 disabled:opacity-50">
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
          <p className="mt-2 text-xs font-semibold text-slate-400">Code expires in 10 minutes</p>
        </div>
      </div>
    );
  }

  // ── Auth card (used in the hero) ────────────────────────────────────────────
  const authCard = (
    <div ref={authRef} className="w-full rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200 sm:p-7">
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
        {["login", "signup"].map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(""); }}
            className={
              "rounded-xl py-2.5 font-display text-sm font-extrabold transition " +
              (mode === m ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700")
            }
          >
            {m === "login" ? "Log in" : "Sign up"}
          </button>
        ))}
      </div>

      {/* Social sign-in */}
      {(GOOGLE_CLIENT_ID || TELEGRAM_BOT_USERNAME) && (
        <div className="mb-4 space-y-2">
          {GOOGLE_CLIENT_ID && (
            <a
              href={`https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(window.location.origin + "/auth/google/callback")}&response_type=code&scope=openid%20email%20profile&prompt=select_account`}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C16.658 14.015 17.64 11.707 17.64 9.2z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/><path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
              Continue with Google
            </a>
          )}
          {TELEGRAM_BOT_USERNAME && (
            <div className="flex w-full justify-center" ref={tgRef} />
          )}
          <div className="relative flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-semibold text-slate-400">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" optional icon={User} value={name} onChange={setName} placeholder="Armen" autoComplete="name" />
            <Field label="Username" icon={Fingerprint} value={username} onChange={setUsername} placeholder="armen_g" autoComplete="username" />
          </div>
        )}

        <Field
          label={mode === "login" ? "Email or username" : "Email"}
          icon={Mail}
          value={email}
          onChange={setEmail}
          placeholder={mode === "login" ? "you@example.com or username" : "you@example.com"}
          autoComplete="email"
        />

        <Field label="Password" icon={Lock} type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} />

        {mode === "signup" && (
          <Field label="Confirm password" icon={Lock} type="password" value={password2} onChange={setPassword2} placeholder="••••••••" autoComplete="new-password" />
        )}

        {mode === "login" && needs2FA && (
          <Field label="2FA code" value={otp} onChange={setOtp} placeholder="6-digit code or recovery" autoComplete="one-time-code" />
        )}

        {mode === "login" && needsCaptcha && (
          <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <div className="mb-2 text-xs font-bold text-slate-600">Security check</div>
            <Turnstile key={captchaKey} onVerify={(t) => { setCaptchaToken(t); if (t) setError(""); }} />
          </div>
        )}

        {error && <div className="rounded-xl bg-cardinal-50 px-4 py-2.5 text-sm font-semibold text-cardinal-600">{error}</div>}

        <button type="submit" disabled={loading} className="btn3d btn3d-brand w-full uppercase">
          {loading ? "Please wait…" : mode === "login" ? (needs2FA ? "Verify & log in" : "Log in") : "Create account"}
          {!loading && <ArrowRight className="h-4 w-4" />}
        </button>

        {mode === "signup" && (
          <p className="text-center text-xs font-medium text-slate-400">
            By signing up you agree to our terms and privacy policy.
          </p>
        )}
      </form>
    </div>
  );

  // ── Main Landing ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-slate-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <a href="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 font-display text-lg font-extrabold text-white shadow-btn-brand">Հ</span>
            <span className="font-display text-xl font-extrabold tracking-tight text-slate-800">Haylingua</span>
          </a>
          <div className="hidden items-center gap-7 md:flex">
            <a href="#how" className="text-sm font-bold text-slate-500 hover:text-slate-800">How it works</a>
            <a href="#features" className="text-sm font-bold text-slate-500 hover:text-slate-800">Features</a>
            <a href="#faq" className="text-sm font-bold text-slate-500 hover:text-slate-800">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => goAuth("login")} className="hidden rounded-xl px-4 py-2 text-sm font-extrabold text-slate-600 hover:bg-slate-100 sm:block">
              Log in
            </button>
            <button onClick={() => goAuth("signup")} className="btn3d btn3d-brand !py-2.5 text-sm">Get started</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-brand-100/50 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full bg-feather-100/40 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 lg:grid-cols-2 lg:py-20">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-extrabold text-brand-600 ring-1 ring-brand-100">
              <Sparkles className="h-3.5 w-3.5" /> Armenian made playful
            </div>
            <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-slate-800 sm:text-6xl">
              Learn Armenian.
              <br />
              <span className="text-brand-500">Actually stick with it.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg font-semibold text-slate-500">
              Bite-sized lessons, instant feedback, audio on every word, and streaks that make you want to come back tomorrow.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button onClick={() => goAuth("signup")} className="btn3d btn3d-brand text-base">
                Start learning — free <ArrowRight className="h-5 w-5" />
              </button>
              <button onClick={() => goAuth("login")} className="btn3d btn3d-neutral text-base">I have an account</button>
            </div>
            <div className="mt-5 flex items-center gap-4 text-sm font-bold text-slate-400">
              <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-grass-500" /> Free to start</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-grass-500" /> No card needed</span>
            </div>
          </div>

          <div className="relative">
            {authCard}
          </div>
        </div>
      </header>

      {/* Value band */}
      <section className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-5 py-8 md:grid-cols-4">
          {[
            { icon: Languages, label: "39 letters", sub: "Full alphabet" },
            { icon: Volume2, label: "Real audio", sub: "On every prompt" },
            { icon: Zap, label: "XP & streaks", sub: "Stay consistent" },
            { icon: ShieldCheck, label: "Secure", sub: "2FA & verified email" },
          ].map((v) => (
            <div key={v.label} className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-brand-500 ring-1 ring-slate-200">
                <v.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display text-base font-extrabold text-slate-800">{v.label}</div>
                <div className="text-xs font-bold text-slate-400">{v.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-16">
        <SectionHeading eyebrow="How it works" title="Three steps to your first Armenian words" />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="relative rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500 text-white shadow-btn-brand">
                <s.icon className="h-6 w-6" />
              </div>
              <div className="mt-4 font-display text-xs font-extrabold uppercase tracking-wide text-brand-500">Step {s.n}</div>
              <div className="mt-1 font-display text-xl font-extrabold text-slate-800">{s.title}</div>
              <p className="mt-2 text-sm font-semibold text-slate-500">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Product preview */}
      <section className="bg-gradient-to-b from-brand-50/60 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 lg:grid-cols-2">
          <div>
            <SectionHeading align="left" eyebrow="See it in action" title="A path you’ll actually want to finish" />
            <p className="mt-4 max-w-md text-base font-semibold text-slate-500">
              Follow a winding path of lessons — tap through letters, listen and repeat, build words, and watch your streak grow. Just like the apps you already love, but for Armenian.
            </p>
            <ul className="mt-6 space-y-3">
              {["Instant right/wrong feedback", "Audio you can replay any time", "Hearts keep mistakes low-stakes", "XP, streaks, and a friends leaderboard"].map((t) => (
                <li key={t} className="flex items-center gap-3 font-bold text-slate-700">
                  <span className="grid h-6 w-6 place-items-center rounded-lg bg-grass-100 text-grass-600"><Check className="h-4 w-4" /></span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Mock exercise card */}
          <div className="rounded-3xl bg-white p-5 shadow-xl ring-1 ring-slate-200">
            <div className="flex items-center gap-3">
              <span className="text-slate-300">✕</span>
              <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-2/3 rounded-full bg-brand-500" />
              </div>
              <span className="flex items-center gap-1 font-display font-extrabold text-cardinal-500">
                <Heart className="h-5 w-5 fill-cardinal-500" />4
              </span>
            </div>
            <div className="mt-5 text-sm font-bold uppercase tracking-wide text-slate-400">Select the correct translation</div>
            <div className="mt-1 font-display text-2xl font-extrabold text-slate-800">“Barev” means…</div>
            <div className="mt-4 grid grid-cols-1 gap-3">
              {[["1", "Hello", true], ["2", "Goodbye", false], ["3", "Thank you", false]].map(([n, t, sel]) => (
                <div key={n} className={"tile " + (sel ? "tile-selected" : "")}>
                  <span className="flex items-center gap-3">
                    <span className={"grid h-7 w-7 place-items-center rounded-lg text-xs font-extrabold ring-2 " + (sel ? "bg-feather-500 text-white ring-feather-500" : "text-slate-400 ring-slate-200")}>{n}</span>
                    {t}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <span className="btn3d btn3d-grass uppercase">Check</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16">
        <SectionHeading eyebrow="Features" title="Everything you need to go from zero to conversation" />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className={"grid h-12 w-12 place-items-center rounded-2xl " + TONES[f.tone]}>
                <f.icon className="h-6 w-6" />
              </div>
              <div className="mt-4 font-display text-lg font-extrabold text-slate-800">{f.title}</div>
              <p className="mt-2 text-sm font-semibold text-slate-500">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-slate-50">
        <div className="mx-auto max-w-3xl px-5 py-16">
          <SectionHeading eyebrow="FAQ" title="Questions, answered" />
          <div className="mt-8 space-y-3">
            {FAQS.map((f, i) => {
              const open = faqOpen === i;
              return (
                <div key={i} className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                  <button
                    onClick={() => setFaqOpen(open ? -1 : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="font-display text-base font-extrabold text-slate-800">{f.q}</span>
                    <ChevronDown className={"h-5 w-5 shrink-0 text-slate-400 transition " + (open ? "rotate-180" : "")} />
                  </button>
                  {open && <div className="px-5 pb-5 text-sm font-semibold text-slate-500">{f.a}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 py-16">
        <div className="relative mx-auto flex max-w-5xl flex-col items-center overflow-hidden rounded-[2rem] bg-brand-500 px-6 py-14 text-center text-white shadow-btn-brand">
          <img src={student} alt="" className="pointer-events-none absolute -bottom-6 -right-2 hidden h-44 w-44 rotate-6 rounded-3xl object-cover opacity-90 sm:block" />
          <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Ready to learn Armenian?</h2>
          <p className="mt-3 max-w-md text-lg font-semibold text-white/90">
            Join now and finish your first lesson in minutes. Բարի՜ ճանապարհ — good luck!
          </p>
          <button onClick={() => goAuth("signup")} className="btn3d mt-7 bg-white !text-brand-600 shadow-[0_4px_0_0_#B84B00] text-base uppercase hover:brightness-100">
            Create your free account <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 font-display font-extrabold text-white">Հ</span>
            <span className="font-display font-extrabold text-slate-700">Haylingua</span>
          </div>
          <div className="flex items-center gap-6 text-sm font-bold text-slate-500">
            <a href="#how" className="hover:text-slate-800">How it works</a>
            <a href="#features" className="hover:text-slate-800">Features</a>
            <a href="https://blog.haylingua.am" target="_blank" rel="noreferrer" className="hover:text-slate-800">Blog</a>
          </div>
          <div className="text-sm font-semibold text-slate-400">© {new Date().getFullYear()} Haylingua</div>
        </div>
      </footer>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Field({ label, optional, icon: Icon, value, onChange, placeholder, type = "text", autoComplete }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-extrabold text-slate-700">
        {label} {optional && <span className="font-semibold text-slate-400">(optional)</span>}
      </label>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />}
        <input
          className={"w-full rounded-2xl bg-slate-50 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400 placeholder:text-slate-400 " + (Icon ? "pl-10 pr-3.5" : "px-3.5")}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, align = "center" }) {
  return (
    <div className={align === "center" ? "text-center" : "text-left"}>
      <div className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-500">{eyebrow}</div>
      <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-800 sm:text-4xl">{title}</h2>
    </div>
  );
}
