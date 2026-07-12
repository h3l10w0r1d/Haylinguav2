// src/LandingPage.jsx — Full marketing landing in the Haylingua brand.
// All auth logic preserved: login, signup, 2FA, captcha, email verification.
import Turnstile from "./lib/Turnstile";
import { useState, useEffect, useRef } from "react";
import {
  Lock, Mail, User, ArrowRight, Fingerprint, Sparkles,
  Flame, Trophy, Headphones, Volume2, Users, Heart, Repeat2,
  Check, ChevronDown, Star, Zap, Languages, ShieldCheck, Crown,
  Menu, X, Eye, EyeOff, Play, RotateCw, Loader2,
} from "lucide-react";
import grandma from "./assets/character-grandma.png";
import student from "./assets/character-student.png";
import { ttsFetch } from "./exercises/tts";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "387340156498-udb3h083d3mcnj135kvbfcstsdslbe64.apps.googleusercontent.com";
const TELEGRAM_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "haylinguabot";

const ARMENIAN_WORDS = [
  { arm: "Բարև", rom: "ba·rev", eng: "Hello" },
  { arm: "Շնորհակալություն", rom: "shnor·ha·ka·lu·tyun", eng: "Thank you" },
  { arm: "Հայաստան", rom: "ha·yas·tan", eng: "Armenia" },
  { arm: "Ընկեր", rom: "ən·ker", eng: "Friend" },
  { arm: "Սիրում եմ քեզ", rom: "si·rum em kez", eng: "I love you" },
];

const FEATURES = [
  { icon: Languages, title: "Alphabet from scratch", text: "Master all 39 Armenian letters with bite-sized intro, recognition, and typing drills.", tone: "brand" },
  { icon: Headphones, title: "Listen & speak", text: "Real text-to-speech audio on every prompt so you learn how Armenian actually sounds.", tone: "feather" },
  { icon: Repeat2, title: "Smart review", text: "Spaced repetition brings back what you're about to forget — right when you need it.", tone: "grass" },
  { icon: Flame, title: "Streaks & XP", text: "Earn XP, keep your daily streak alive, and build a habit that sticks.", tone: "brand" },
  { icon: Heart, title: "Hearts", text: "Lose a heart on a wrong answer — a gentle nudge to slow down and get it right.", tone: "cardinal" },
  { icon: Trophy, title: "Leaderboard & friends", text: "Add friends and climb the leaderboard. A little competition goes a long way.", tone: "gold" },
];

const STEPS = [
  { n: 1, title: "Pick a lesson", text: "Start on the path — from your very first letter to full phrases.", icon: Crown },
  { n: 2, title: "Practice & get feedback", text: "Tap, type, listen, and match. Every answer is checked instantly.", icon: Check },
  { n: 3, title: "Keep your streak", text: "Earn XP, unlock the next node, and come back tomorrow.", icon: Flame },
];

const TESTIMONIALS = [
  {
    quote: "I learned the entire Armenian alphabet in under a week. The exercises make it feel like a game, not a chore.",
    name: "Ani M.",
    role: "Armenian diaspora · Los Angeles",
    stars: 5,
  },
  {
    quote: "This feels like Duolingo but made for Armenian. The audio on every word is a total game-changer for pronunciation.",
    name: "James K.",
    role: "Language enthusiast · London",
    stars: 5,
  },
  {
    quote: "As a heritage speaker trying to finally read and write, Haylingua filled the exact gaps I had. Loving the streaks.",
    name: "Narine H.",
    role: "Heritage learner · Yerevan",
    stars: 5,
  },
];

const FAQS = [
  { q: "Is Haylingua free?", a: "Yes — you can create an account and start learning the Armenian alphabet and your first lessons for free." },
  { q: "I don't know the Armenian alphabet at all. Is that okay?", a: "Perfect, that's exactly where we begin. The first lessons introduce each letter with its sound, examples, and typing practice before you ever build a word." },
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

// ── Scroll reveal ─────────────────────────────────────────────────────────────

function useReveal(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function Reveal({ children, delay = 0, className = "" }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(2rem)",
        transition: `opacity 0.65s ease-out ${delay}ms, transform 0.65s ease-out ${delay}ms`,
      }}
      className={className}
    >
      {children}
    </div>
  );
}

// ── Auth popup promo panel ──────────────────────────────────────────────────
// Custom welcome-bonus artwork (2:3 portrait) fills the left panel of the auth
// popup. If it ever fails to load, the on-brand fallback below advertises the
// same 14-day free-trial bonus. Swap the file to change the banner.
const SIGNUP_BANNER_SRC = "/banners/Welcome_banner_5.png";
const LOGIN_BANNER_SRC = "/banners/Login_banner1.png";

function SignupPromoPanel({ mode }) {
  const [imgOk, setImgOk] = useState(true);
  const src = mode === "login" ? LOGIN_BANNER_SRC : SIGNUP_BANNER_SRC;
  // Reset the error flag when the banner swaps (login ↔ signup) so a fresh
  // image gets a chance to load instead of staying on the fallback.
  useEffect(() => {
    setImgOk(true);
  }, [src]);
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-pom-600 md:block">
      <img
        src={src}
        alt=""
        onError={() => setImgOk(false)}
        className={"absolute inset-0 h-full w-full object-cover " + (imgOk ? "" : "hidden")}
      />
      {!imgOk && (
        <div className="relative flex h-full flex-col justify-between p-7 text-white">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold uppercase tracking-wide">
              <Sparkles className="h-3.5 w-3.5" /> Welcome bonus
            </div>
            <h3 className="mt-4 font-display text-3xl font-extrabold leading-tight">
              14 days of Premium — free
            </h3>
            <p className="mt-2 text-sm font-semibold text-white/85">
              Unlimited hearts for your first two weeks. No card, no subscription — it just expires.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm font-bold">
              {["Unlimited hearts", "A wrong answer never stops you", "Nothing to cancel"].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/20"><Check className="h-3.5 w-3.5" /></span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <img src={grandma} alt="" className="mt-6 h-24 w-24 self-start rounded-2xl object-cover ring-4 ring-white/20" />
        </div>
      )}
    </div>
  );
}

// ── Playable exercise demo (product preview section) ───────────────────────────
// Each question carries enough context for the simulated AI tutor to explain a
// wrong answer specifically: the real meaning + romanization of the prompt, and
// for every wrong option, the Armenian word that option actually maps to. This
// is what powers the "why was I wrong" feedback (no real LLM call — the demo is
// on the public landing page — but the explanations are tailored per mistake and
// phrased several different ways so it reads like a live tutor, not a canned line).
const DEMO_QUESTIONS = [
  {
    prompt: "Բարև", rom: "ba-rev", meaning: "Hello", correct: 0,
    options: ["Hello", "Goodbye", "Thank you"],
    hook: "It's the word you lead with when you meet someone.",
    wrong: {
      1: { picked: "Goodbye", arm: "Ցտեսություն", rom: "tse-te-su-tyun" },
      2: { picked: "Thank you", arm: "Շնորհակալություն", rom: "shnor-ha-ka-lu-tyun" },
    },
  },
  {
    prompt: "Ջուր", rom: "jur", meaning: "Water", correct: 1,
    options: ["Bread", "Water", "Milk"],
    hook: "Picture ordering at a café: «մեկ բաժակ ջուր» — one glass of water.",
    wrong: {
      0: { picked: "Bread", arm: "Հաց", rom: "hats" },
      2: { picked: "Milk", arm: "Կաթ", rom: "kat" },
    },
  },
  {
    prompt: "Ընկեր", rom: "ən-ker", meaning: "Friend", correct: 2,
    options: ["Enemy", "Stranger", "Friend"],
    hook: "You'll hear it constantly — Armenians call a close friend ընկեր.",
    wrong: {
      0: { picked: "Enemy", arm: "Թշնամի", rom: "təsh-na-mi" },
      1: { picked: "Stranger", arm: "Անծանոթ", rom: "an-tsa-not" },
    },
  },
  {
    prompt: "Շնորհակալություն", rom: "shnor-ha-ka-lu-tyun", meaning: "Thank you", correct: 2,
    options: ["Please", "Sorry", "Thank you"],
    hook: "It's a long one, but you'll say it every day — it simply means thank you.",
    wrong: {
      0: { picked: "Please", arm: "Խնդրեմ", rom: "khən-drem" },
      1: { picked: "Sorry", arm: "Ներողություն", rom: "ne-ro-ghu-tyun" },
    },
  },
];

// Sentence frames the "AI tutor" composes its explanation from. Each takes the
// question and the specific wrong-option facts, so the reply always names what
// the learner actually picked and what it should have been. Multiple frames +
// the "explain it differently" button let a visitor regenerate the reply and see
// it's genuinely reasoning about their mistake, not replaying one fixed string.
const AI_FRAMES = [
  (q, w) => `Close — but «${q.prompt}» means "${q.meaning}", not "${w.picked}". The word for "${w.picked}" is «${w.arm}» (${w.rom}). ${q.hook}`,
  (q, w) => `I see the mix-up: "${w.picked}" in Armenian is «${w.arm}» (${w.rom}). «${q.prompt}» (${q.rom}) actually means "${q.meaning}". ${q.hook}`,
  (q, w) => `Not this time. «${q.prompt}» = "${q.meaning}". You went with "${w.picked}", which is «${w.arm}» (${w.rom}) — an easy pair to confuse. ${q.hook}`,
  (q, w) => `Almost! "${w.picked}" would be «${w.arm}» (${w.rom}). Here, «${q.prompt}» translates to "${q.meaning}". ${q.hook}`,
];

// Small speaker chip that plays real Armenian TTS for a word via the same /audio
// pipeline the learner app uses — so a visitor can actually hear pronunciation.
function VoiceChip({ text, label, tone = "brand" }) {
  const [state, setState] = useState("idle"); // idle | loading | playing
  const audioRef = useRef(null);
  const urlRef = useRef(null);

  useEffect(() => () => {
    if (audioRef.current) audioRef.current.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  async function toggle() {
    if (state === "playing") {
      audioRef.current?.pause();
      setState("idle");
      return;
    }
    if (state === "loading") return;
    try {
      setState("loading");
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
      const url = await ttsFetch(API_BASE, { text });
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setState("idle");
      audio.onerror = () => setState("idle");
      setState("playing");
      await audio.play();
    } catch {
      setState("idle");
    }
  }

  const tones = {
    brand: "bg-white text-brand-700 ring-brand-200 hover:bg-brand-50",
    slate: "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className={"inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-extrabold ring-2 transition-colors " + (tones[tone] || tones.brand)}
    >
      {state === "loading" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Volume2 className={"h-4 w-4 " + (state === "playing" ? "animate-pulse" : "")} />
      )}
      <span>{text}</span>
      {label && <span className="font-bold text-slate-400">· {label}</span>}
    </button>
  );
}

function LandingExerciseDemo() {
  const [qi, setQi] = useState(0);
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(false);
  const [hearts, setHearts] = useState(4);
  const [frameIdx, setFrameIdx] = useState(0);   // which AI phrasing to show
  const [aiPhase, setAiPhase] = useState("thinking"); // thinking | reveal
  const [typed, setTyped] = useState(0);         // typewriter cursor position

  const q = DEMO_QUESTIONS[qi];
  const isCorrect = checked && selected === q.correct;
  const isWrong = checked && selected !== q.correct;
  const wrongInfo = isWrong ? q.wrong[selected] : null;
  const feedbackText = wrongInfo ? AI_FRAMES[frameIdx % AI_FRAMES.length](q, wrongInfo) : "";

  // Wrong answer → the tutor "thinks" briefly, then types its reply. Re-runs when
  // the learner asks for a different phrasing (frameIdx changes).
  useEffect(() => {
    if (!isWrong) return;
    setAiPhase("thinking");
    setTyped(0);
    const t = setTimeout(() => setAiPhase("reveal"), 620);
    return () => clearTimeout(t);
  }, [isWrong, qi, frameIdx]);

  // Typewriter reveal — a couple of characters per tick reads like live generation.
  useEffect(() => {
    if (aiPhase !== "reveal" || !feedbackText || typed >= feedbackText.length) return;
    const t = setTimeout(() => setTyped((n) => Math.min(feedbackText.length, n + 2)), 16);
    return () => clearTimeout(t);
  }, [aiPhase, typed, feedbackText]);

  function pick(i) {
    if (checked) return;
    setSelected(i);
  }

  function onCheck() {
    if (selected == null || checked) return;
    setChecked(true);
    if (selected !== q.correct) setHearts((h) => Math.max(0, h - 1));
  }

  function regenerate() {
    setFrameIdx((n) => n + 1); // effect above restarts thinking→typing with a new frame
  }

  function onContinue() {
    setQi((i) => (i + 1) % DEMO_QUESTIONS.length);
    setSelected(null);
    setChecked(false);
    setAiPhase("thinking");
    setTyped(0);
    if (hearts <= 0) setHearts(4); // demo loops forever — don't hard-lock a visitor out
  }

  const typing = aiPhase === "reveal" && typed < feedbackText.length;

  return (
    <div className="rounded-3xl bg-white p-5 shadow-xl ring-1 ring-slate-200">
      <div className="flex items-center gap-3">
        <span className="text-slate-300">✕</span>
        <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-300"
            style={{ width: `${((qi + (checked ? 1 : 0)) / DEMO_QUESTIONS.length) * 100}%` }}
          />
        </div>
        <span className="flex items-center gap-1 font-display font-extrabold text-cardinal-500">
          <Heart className={"h-5 w-5 " + (hearts > 0 ? "fill-cardinal-500" : "")} />
          {hearts}
        </span>
      </div>

      <div className="mt-5 text-sm font-bold uppercase tracking-wide text-slate-400">Select the correct translation</div>
      <div className="mt-1 flex items-center gap-2">
        <div className="font-display text-2xl font-extrabold text-slate-800">"{q.prompt}" means…</div>
        <VoiceChip text={q.prompt} tone="slate" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        {q.options.map((t, i) => {
          const isSel = selected === i;
          const tone =
            checked && i === q.correct
              ? "tile-correct"
              : checked && isSel && i !== q.correct
              ? "tile-wrong"
              : isSel
              ? "tile-selected"
              : "";
          return (
            <button
              key={t}
              type="button"
              onClick={() => pick(i)}
              disabled={checked}
              className={"tile text-left " + tone}
            >
              <span className="flex items-center gap-3">
                <span
                  className={
                    "grid h-7 w-7 place-items-center rounded-lg text-xs font-extrabold ring-2 " +
                    (checked && i === q.correct
                      ? "bg-grass-500 text-white ring-grass-500"
                      : checked && isSel && i !== q.correct
                      ? "bg-cardinal-500 text-white ring-cardinal-500"
                      : isSel
                      ? "bg-feather-500 text-white ring-feather-500"
                      : "text-slate-400 ring-slate-200")
                  }
                >
                  {i + 1}
                </span>
                {t}
              </span>
            </button>
          );
        })}
      </div>

      {checked ? (
        isCorrect ? (
          <div className="mt-5 -mx-5 -mb-5 rounded-b-3xl bg-grass-50 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-display text-base font-extrabold text-grass-700">Ապրե՛ս! (Nice!)</div>
                <div className="mt-2"><VoiceChip text={q.prompt} label={q.meaning} /></div>
              </div>
              <button type="button" onClick={onContinue} className="btn3d btn3d-grass uppercase">Continue</button>
            </div>
          </div>
        ) : (
          <div className="mt-5 -mx-5 -mb-5 rounded-b-3xl bg-cardinal-50 px-5 py-4">
            {/* Simulated AI tutor: explains the specific mistake instead of just
                flashing the right answer, so a visitor sees why they were wrong. */}
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-cardinal-500/10 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-cardinal-700">
                <Sparkles className="h-3.5 w-3.5" /> Aram · AI tutor
              </div>
              <button
                type="button"
                onClick={regenerate}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-cardinal-600 hover:bg-cardinal-500/10"
                title="See the explanation phrased another way"
              >
                <RotateCw className="h-3.5 w-3.5" /> Explain differently
              </button>
            </div>

            <div className="mt-2 min-h-[3.5rem] text-sm font-semibold leading-relaxed text-slate-700">
              {aiPhase === "thinking" ? (
                <span className="inline-flex items-center gap-2 text-slate-400">
                  <span className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-cardinal-400 [animation-delay:-0.2s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-cardinal-400 [animation-delay:-0.1s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-cardinal-400" />
                  </span>
                  Aram is looking at your answer…
                </span>
              ) : (
                <span>
                  {feedbackText.slice(0, typed)}
                  {typing && <span className="ml-0.5 inline-block h-4 w-0.5 -translate-y-0.5 animate-pulse bg-slate-400 align-middle" />}
                </span>
              )}
            </div>

            {aiPhase === "reveal" && !typing && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <VoiceChip text={q.prompt} label={q.meaning} />
                {wrongInfo && <VoiceChip text={wrongInfo.arm} label={wrongInfo.picked} tone="slate" />}
              </div>
            )}

            <div className="mt-3 flex justify-end">
              <button type="button" onClick={onContinue} className="btn3d btn3d-cardinal uppercase">Continue</button>
            </div>
          </div>
        )
      ) : (
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onCheck}
            disabled={selected == null}
            className="btn3d btn3d-grass uppercase disabled:cursor-not-allowed disabled:opacity-40"
          >
            Check
          </button>
        </div>
      )}
    </div>
  );
}

// ── Learning path preview (product preview section) ─────────────────────────
const PATH_PREVIEW_LESSONS = [
  { title: "Greetings", status: "done" },
  { title: "Numbers 1–10", status: "done" },
  { title: "Family", status: "current" },
  { title: "Food & Drink", status: "locked" },
  { title: "Colors", status: "locked" },
];

function PathPreview() {
  return (
    <div className="relative rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200 sm:p-7">
      <div className="flex items-center justify-between">
        <div className="font-display text-sm font-extrabold uppercase tracking-wide text-slate-400">Your path</div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-extrabold text-brand-600">
          <Flame className="h-3.5 w-3.5 fill-brand-500 text-brand-500" /> 3-day streak
        </div>
      </div>

      <div className="mt-6 space-y-1">
        {PATH_PREVIEW_LESSONS.map((lesson, i) => {
          const isLast = i === PATH_PREVIEW_LESSONS.length - 1;
          const isDone = lesson.status === "done";
          const isCurrent = lesson.status === "current";
          return (
            <div key={lesson.title} className="relative flex items-start gap-4 pb-6">
              {!isLast && (
                <div
                  className={
                    "absolute left-[19px] top-10 h-full w-1 -translate-x-1/2 rounded-full " +
                    (isDone ? "bg-grass-300" : "bg-slate-100")
                  }
                />
              )}
              <div className="relative z-10 shrink-0">
                {isCurrent && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-brand-300 opacity-60" />
                )}
                <div
                  className={
                    "grid h-10 w-10 place-items-center rounded-full text-white " +
                    (isDone ? "bg-grass-500" : isCurrent ? "bg-brand-500" : "bg-slate-200 text-slate-400")
                  }
                >
                  {isDone ? (
                    <Check className="h-5 w-5" strokeWidth={3} />
                  ) : isCurrent ? (
                    <Play className="h-4 w-4 fill-white" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                </div>
              </div>
              <div className="min-w-0 flex-1 pt-1.5">
                <div className={"font-display text-base font-extrabold " + (lesson.status === "locked" ? "text-slate-400" : "text-slate-800")}>
                  {lesson.title}
                </div>
                <div className={"text-xs font-bold " + (isDone ? "text-grass-600" : isCurrent ? "text-brand-500" : "text-slate-300")}>
                  {isDone ? "Completed" : isCurrent ? "You are here" : "Locked"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Live community stats (simulated) ────────────────────────────────────────
// Illustrative counters for social proof — NOT wired to the real backend.
// Every visitor must see the SAME number at the same real moment, and a
// reload must never show a lower number than before. Both of those rule out
// any client-side randomness in the value itself: the number is a pure,
// deterministic function of (config, wall-clock time) — same inputs always
// produce the same output, for every browser, everywhere. "Live ticking" is
// just re-evaluating that function every second or two as time moves on; the
// growth itself comes from the formula, not from random bumps.
//
// Growth rates loosely track Armenia's day/night cycle (faster ~08:00–23:00
// AMT, slower overnight). STATS_EPOCH is a fixed reference point — the
// "base" counts are the totals as of that moment, and every full day past
// it adds one day's worth of growth at the blended average rate, plus a
// smooth partial-day contribution using whichever rate applies right now.
const STATS_EPOCH = new Date("2026-07-12T00:00:00Z").getTime();
const DAY_START_AMT = 8;   // 08:00 Armenia time
const DAY_END_AMT = 23;    // 23:00 Armenia time
const MINUTES_PER_DAY = 24 * 60;
const DAY_MS = 86_400_000;

const STAT_CONFIGS = [
  { key: "exercises", label: "Exercises completed", icon: Zap, base: 118_000, perMinDay: 60, perMinNight: 30, tone: "text-brand-600", bg: "bg-brand-50" },
  { key: "users", label: "Learners joined", icon: Users, base: 6_400, perMinDay: 5, perMinNight: 3, tone: "text-feather-600", bg: "bg-feather-50" },
  { key: "achievements", label: "Achievements unlocked", icon: Trophy, base: 31_500, perMinDay: 15, perMinNight: 8, tone: "text-gold-600", bg: "bg-amber-50" },
  { key: "chapters", label: "Chapters completed", icon: Languages, base: 9_800, perMinDay: 4, perMinNight: 2, tone: "text-grass-600", bg: "bg-grass-50" },
];

// Armenia has used a fixed UTC+4 offset (no DST) since 2012.
function isArmeniaDaytime(date) {
  const amtHour = (date.getUTCHours() + 4) % 24;
  return amtHour >= DAY_START_AMT && amtHour < DAY_END_AMT;
}

function averagePerMinute(cfg) {
  const dayHours = DAY_END_AMT - DAY_START_AMT;
  const nightHours = 24 - dayHours;
  return (cfg.perMinDay * dayHours + cfg.perMinNight * nightHours) / 24;
}

// Pure function: (config, time) → displayed number. No Math.random() here —
// this is the whole fix. Two visitors calling this with clocks a second
// apart get numbers a second apart, never two unrelated random values.
function computeStatValue(cfg, now) {
  const nowMs = now.getTime();
  const daysSinceEpoch = Math.max(0, Math.floor((nowMs - STATS_EPOCH) / DAY_MS));
  const startOfToday = STATS_EPOCH + daysSinceEpoch * DAY_MS;
  const minutesIntoToday = (nowMs - startOfToday) / 60000;

  const wholeDaysGrowth = daysSinceEpoch * averagePerMinute(cfg) * MINUTES_PER_DAY;
  const perMinNow = isArmeniaDaytime(now) ? cfg.perMinDay : cfg.perMinNight;
  const todayGrowth = minutesIntoToday * perMinNow;

  return Math.round(cfg.base + wholeDaysGrowth + todayGrowth);
}

function useLiveStat(cfg) {
  const [value, setValue] = useState(() => computeStatValue(cfg, new Date()));

  useEffect(() => {
    // Randomizing only the poll cadence (not the value) keeps four counters
    // from visibly updating in perfect lockstep, without reintroducing any
    // per-client randomness into the number itself.
    const id = setInterval(() => {
      setValue(computeStatValue(cfg, new Date()));
    }, 1000 + Math.random() * 1200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return value;
}

function StatCard({ cfg, delay }) {
  const value = useLiveStat(cfg);
  const [bump, setBump] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (value !== prevRef.current) {
      prevRef.current = value;
      setBump(true);
      const t = setTimeout(() => setBump(false), 260);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <Reveal delay={delay}>
      <div className="rounded-3xl bg-white p-5 text-center ring-1 ring-slate-200 shadow-sm">
        <div className={"mx-auto grid h-11 w-11 place-items-center rounded-2xl " + cfg.bg}>
          <cfg.icon className={"h-5 w-5 " + cfg.tone} />
        </div>
        <div
          className={
            "mt-3 font-display text-2xl font-extrabold tabular-nums text-slate-800 transition-transform duration-200 sm:text-3xl " +
            (bump ? "scale-110" : "scale-100")
          }
        >
          {value.toLocaleString()}
        </div>
        <div className="mt-1 text-xs font-bold text-slate-500">{cfg.label}</div>
      </div>
    </Reveal>
  );
}

function LiveStatsStrip() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-16">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STAT_CONFIGS.map((cfg, i) => (
          <StatCard key={cfg.key} cfg={cfg} delay={i * 80} />
        ))}
      </div>
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LandingPage({ onLogin, onSignup }) {
  const [mode, setMode] = useState("login"); // login | signup | forgot | verify
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [wordIdx, setWordIdx] = useState(0);
  const [wordFade, setWordFade] = useState(true);
  const authRef = useRef(null);
  const tgRef = useRef(null);

  // Auth modal: lock background scroll, close on Escape.
  useEffect(() => {
    if (!authOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") setAuthOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [authOpen]);

  // Rotating Armenian word with fade transition
  useEffect(() => {
    const t = setInterval(() => {
      setWordFade(false);
      setTimeout(() => {
        setWordIdx((i) => (i + 1) % ARMENIAN_WORDS.length);
        setWordFade(true);
      }, 300);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  // Telegram widget — (re-)inject whenever the auth popup opens. The widget's
  // container only exists in the DOM while the modal is mounted, so a
  // mount-once effect would see tgRef.current === null on page load (modal
  // closed) and never fire again once the popup actually opens.
  useEffect(() => {
    if (!authOpen || !TELEGRAM_BOT_USERNAME || !tgRef.current) return;
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
  }, [authOpen]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const goAuth = (m) => {
    setMode(m);
    setError("");
    setMenuOpen(false);
    setAuthOpen(true);
  };

  // ── Auth Handlers ───────────────────────────────────────────────────────────

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
    }

    setLoading(true);
    try {
      if (mode === "forgot") {
        const res = await fetch(`${API_BASE}/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d?.detail || "Error"); }
        setForgotSent(true);
        setLoading(false);
        return;
      }
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

  // ── Auth card ────────────────────────────────────────────────────────────────
  const authCard = (
    <div ref={authRef} className="relative w-full bg-white px-6 pb-6 pt-12 sm:px-7 sm:pb-7 sm:pt-12">
      <button
        type="button"
        onClick={() => setAuthOpen(false)}
        aria-label="Close"
        className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
        {["login", "signup"].map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(""); setForgotSent(false); }}
            className={
              "rounded-xl py-2.5 font-display text-sm font-extrabold transition " +
              (mode === m ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700")
            }
          >
            {m === "login" ? "Log in" : "Sign up"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Forgot password — sent confirmation */}
        {mode === "forgot" && forgotSent ? (
          <div className="rounded-2xl bg-grass-50 px-4 py-5 text-center">
            <div className="text-2xl mb-1">📬</div>
            <p className="font-bold text-grass-700">Check your inbox</p>
            <p className="mt-1 text-sm text-grass-600">If that email has an account, we sent a reset link. Check spam too.</p>
            <button type="button" onClick={() => { setMode("login"); setForgotSent(false); setEmail(""); setError(""); }} className="mt-4 text-sm font-bold text-brand-500 hover:underline">
              Back to log in
            </button>
          </div>
        ) : mode === "forgot" ? (
          <>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setMode("login"); setError(""); }} className="text-slate-400 hover:text-slate-600 transition">
                ←
              </button>
              <p className="text-sm font-semibold text-slate-600">Enter your email and we'll send a reset link.</p>
            </div>
            <Field label="Email" icon={Mail} value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
            {error && <div className="rounded-xl bg-cardinal-50 px-4 py-2.5 text-sm font-semibold text-cardinal-600">{error}</div>}
            <button type="submit" disabled={loading || !email} className="btn3d btn3d-brand w-full uppercase disabled:opacity-60">
              {loading ? "Sending…" : "Send reset link"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </>
        ) : (
          <>
            {mode === "signup" && (
              // Name is collected during onboarding, not here.
              <Field label="Username" icon={Fingerprint} value={username} onChange={setUsername} placeholder="armen_g" autoComplete="username" />
            )}

            <Field
              label={mode === "login" ? "Email or username" : "Email"}
              icon={Mail}
              value={email}
              onChange={setEmail}
              placeholder={mode === "login" ? "you@example.com or username" : "you@example.com"}
              autoComplete="email"
            />

            <div>
              <Field label="Password" icon={Lock} type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} />
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setError(""); setForgotSent(false); }}
                  className="mt-1.5 block text-xs font-semibold text-brand-500 hover:underline"
                >
                  Forgot password?
                </button>
              )}
            </div>

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
          </>
        )}
      </form>

      {/* Social sign-in — below the form (not shown on the forgot-password step) */}
      {mode !== "forgot" && (GOOGLE_CLIENT_ID || TELEGRAM_BOT_USERNAME) && (
        <div className="mt-5">
          <div className="relative mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-semibold text-slate-400">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {TELEGRAM_BOT_USERNAME && (
              <div className="relative h-11">
                <div ref={tgRef} style={{ position: "absolute", inset: 0, opacity: 0, overflow: "hidden" }} />
                <div style={{ pointerEvents: "none" }} className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="#2AABEE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#2AABEE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Telegram
                </div>
              </div>
            )}
            {GOOGLE_CLIENT_ID && (
              <button
                type="button"
                onClick={() => {
                  const buf = new Uint8Array(16);
                  crypto.getRandomValues(buf);
                  const state = Array.from(buf, b => b.toString(16).padStart(2, "0")).join("");
                  sessionStorage.setItem("oauth_state", state);
                  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent("https://haylingua.am/auth/google/callback")}&response_type=code&scope=openid%20email%20profile&prompt=select_account&state=${encodeURIComponent(state)}`;
                }}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908C16.658 14.015 17.64 11.707 17.64 9.2z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/><path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
                Google
              </button>
            )}
          </div>
        </div>
      )}

      {mode === "signup" && (
        <p className="mt-4 text-center text-xs font-medium text-slate-400">
          By signing up you agree to our terms and privacy policy.
        </p>
      )}
    </div>
  );

  // ── Main Landing ────────────────────────────────────────────────────────────
  const word = ARMENIAN_WORDS[wordIdx];

  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-slate-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <a href="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 font-display text-lg font-extrabold text-white shadow-btn-brand">Հ</span>
            <span className="font-display text-xl font-extrabold tracking-tight text-slate-800">Haylingua</span>
          </a>

          {/* Desktop links */}
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
            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="grid h-9 w-9 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 md:hidden"
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="border-t border-slate-100 bg-white px-5 pb-4 pt-2 md:hidden">
            <div className="flex flex-col gap-1">
              <a href="#how" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">How it works</a>
              <a href="#features" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Features</a>
              <a href="#faq" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">FAQ</a>
              <div className="mt-1 border-t border-slate-100 pt-2 flex gap-2">
                <button onClick={() => goAuth("login")} className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-extrabold text-slate-700">Log in</button>
                <button onClick={() => goAuth("signup")} className="flex-1 btn3d btn3d-brand !py-2.5 text-sm">Sign up free</button>
              </div>
            </div>
          </div>
        )}
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

            {/* Armenian word showcase */}
            <div className="mt-6 inline-flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
              <div
                style={{
                  opacity: wordFade ? 1 : 0,
                  transform: wordFade ? "translateY(0)" : "translateY(-6px)",
                  transition: "opacity 0.3s ease, transform 0.3s ease",
                  minWidth: "6rem",
                }}
              >
                <div className="font-display text-2xl font-extrabold tracking-wide text-brand-600">{word.arm}</div>
                <div className="mt-0.5 text-xs font-bold text-slate-400">{word.rom}</div>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div
                style={{
                  opacity: wordFade ? 1 : 0,
                  transition: "opacity 0.3s ease 0.05s",
                }}
                className="text-base font-bold text-slate-600"
              >
                {word.eng}
              </div>
            </div>

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
            <LandingExerciseDemo />
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

      {/* Live community stats */}
      <div className="pt-10">
        <LiveStatsStrip />
      </div>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-16">
        <Reveal>
          <SectionHeading eyebrow="How it works" title="Three steps to your first Armenian words" />
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 100}>
              <div className="relative rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm h-full">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500 text-white shadow-btn-brand">
                  <s.icon className="h-6 w-6" />
                </div>
                <div className="mt-4 font-display text-xs font-extrabold uppercase tracking-wide text-brand-500">Step {s.n}</div>
                <div className="mt-1 font-display text-xl font-extrabold text-slate-800">{s.title}</div>
                <p className="mt-2 text-sm font-semibold text-slate-500">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Product preview */}
      <section className="bg-gradient-to-b from-brand-50/60 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 lg:grid-cols-2">
          <Reveal>
            <div>
              <SectionHeading align="left" eyebrow="See it in action" title="A path you'll actually want to finish" />
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
          </Reveal>

          {/* Learning path preview */}
          <Reveal delay={120}>
            <PathPreview />
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16">
        <Reveal>
          <SectionHeading eyebrow="Features" title="Everything you need to go from zero to conversation" />
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 80}>
              <div className="rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm transition hover:-translate-y-1 hover:shadow-md h-full">
                <div className={"grid h-12 w-12 place-items-center rounded-2xl " + TONES[f.tone]}>
                  <f.icon className="h-6 w-6" />
                </div>
                <div className="mt-4 font-display text-lg font-extrabold text-slate-800">{f.title}</div>
                <p className="mt-2 text-sm font-semibold text-slate-500">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Reveal>
            <SectionHeading eyebrow="Learners love it" title="Real words from real learners" />
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 100}>
                <div className="flex h-full flex-col rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm">
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: t.stars }).map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="flex-1 text-sm font-semibold leading-relaxed text-slate-600">"{t.quote}"</p>
                  <div className="mt-5 flex items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-100 font-display text-sm font-extrabold text-brand-600">
                      {t.name[0]}
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-slate-800">{t.name}</div>
                      <div className="text-xs font-semibold text-slate-400">{t.role}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-white">
        <div className="mx-auto max-w-3xl px-5 py-16">
          <Reveal>
            <SectionHeading eyebrow="FAQ" title="Questions, answered" />
          </Reveal>
          <div className="mt-8 space-y-3">
            {FAQS.map((f, i) => {
              const open = faqOpen === i;
              return (
                <Reveal key={i} delay={i * 60}>
                  <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                    <button
                      onClick={() => setFaqOpen(open ? -1 : i)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    >
                      <span className="font-display text-base font-extrabold text-slate-800">{f.q}</span>
                      <ChevronDown className={"h-5 w-5 shrink-0 text-slate-400 transition " + (open ? "rotate-180" : "")} />
                    </button>
                    {open && <div className="px-5 pb-5 text-sm font-semibold text-slate-500">{f.a}</div>}
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 py-16">
        <Reveal>
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
        </Reveal>
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

      {/* Auth popup — login/signup, triggered from header, hero, and CTA buttons */}
      {authOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setAuthOpen(false); }}
        >
          <div className="max-h-[92vh] w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl md:max-w-4xl md:grid md:grid-cols-[44%_56%]">
            <SignupPromoPanel mode={mode} />
            <div className="min-w-0 overflow-y-auto">{authCard}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Field({ label, optional, icon: Icon, value, onChange, placeholder, type = "text", autoComplete }) {
  const [showPw, setShowPw] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPw ? "text" : "password") : type;
  return (
    <div>
      <label className="mb-1.5 block text-sm font-extrabold text-slate-700">
        {label} {optional && <span className="font-semibold text-slate-400">(optional)</span>}
      </label>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />}
        <input
          className={"w-full rounded-2xl bg-slate-50 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400 placeholder:text-slate-400 " + (Icon ? "pl-10" : "px-3.5") + (isPassword ? " pr-10" : " pr-3.5")}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
            tabIndex={-1}
            aria-label={showPw ? "Hide password" : "Show password"}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
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
