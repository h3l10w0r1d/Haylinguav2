// src/LearnArmenianOnlinePage.jsx — public, unauthenticated SEO landing page:
// the broad "learn Armenian online" intent, explaining how Haylingua's course
// works end to end and funneling into signup.
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Volume2, Flame, Users, CheckCircle2 } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";

const STEPS = [
  {
    icon: BookOpen,
    title: "Start with the alphabet",
    text: "39 letters, each with its own sound, transliteration, and example word — no prior knowledge assumed.",
  },
  {
    icon: Volume2,
    title: "Build words and sentences",
    text: "Real text-to-speech audio on every word, so you're training your ear from the very first lesson, not just memorizing spelling.",
  },
  {
    icon: Flame,
    title: "Practice a little every day",
    text: "Short, bite-sized lessons with streaks and XP make daily practice something you actually want to keep up.",
  },
  {
    icon: Users,
    title: "Add friends, stay motivated",
    text: "A friends leaderboard and light competition go a long way when you're building a new habit.",
  },
];

const WHY = [
  "Audio on every single word — not just a sample lesson",
  "Built specifically for Armenian, not adapted from a generic language-app template",
  "Covers reading, listening, typing, and grammar from your first lesson",
  "Free to start — no credit card required",
];

export default function LearnArmenianOnlinePage() {
  const navigate = useNavigate();

  const structuredData = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://www.haylingua.am/" },
          { "@type": "ListItem", position: 2, name: "Learn Armenian Online", item: "https://www.haylingua.am/learn-armenian-online" },
        ],
      },
    ],
    []
  );

  usePageMeta(
    "Learn Armenian Online — Free Interactive Course",
    "Learn Armenian online with Haylingua: interactive lessons, real audio on every word, pronunciation practice, vocabulary, and gamified exercises. Start free, no card required.",
    { structuredData }
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <SiteNav />

      <main>
        <header className="mx-auto max-w-3xl px-5 pb-8 pt-14 text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-5xl">
            Learn Armenian Online
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-slate-500 dark:text-stone-400">
            Haylingua is a free, interactive course that takes you from your first Armenian letter
            to real conversation — bite-sized lessons, audio on every word, and a habit-building
            structure so learning actually sticks.
          </p>
          <button onClick={() => navigate("/")} className="btn3d btn3d-brand mt-6 text-sm uppercase">
            Start learning free <ArrowRight className="h-4 w-4" />
          </button>
        </header>

        <section className="mx-auto max-w-5xl px-5 pb-16">
          <div className="grid gap-5 sm:grid-cols-2">
            {STEPS.map((s) => (
              <div key={s.title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                  <s.icon className="h-5 w-5" />
                </div>
                <h2 className="mt-3 font-display text-lg font-extrabold text-slate-800 dark:text-white">{s.title}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-slate-100 bg-slate-50 px-5 py-16 dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              Why learn Armenian with Haylingua
            </h2>
            <ul className="mt-6 space-y-3">
              {WHY.map((w) => (
                <li key={w} className="flex items-start gap-3 text-sm font-semibold text-slate-600 dark:text-stone-300">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-grass-500" />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="px-5 py-14">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              Where to start
            </h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <Link to="/armenian-alphabet" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">Armenian Alphabet</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">All 39 letters with audio.</p>
              </Link>
              <Link to="/armenian-pronunciation" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">Armenian Pronunciation</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">The sounds that trip up beginners.</p>
              </Link>
              <Link to="/armenian-vocabulary" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">Armenian Vocabulary</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">Core words by category.</p>
              </Link>
            </div>
          </div>
        </section>

        <section className="px-5 py-16">
          <div className="relative mx-auto flex max-w-5xl flex-col items-center overflow-hidden rounded-[2rem] bg-brand-500 px-6 py-14 text-center text-white shadow-btn-brand">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Your first Armenian lesson is free</h2>
            <p className="mt-3 max-w-md text-lg font-semibold text-white/90">
              Join now and finish your first lesson in minutes — no card required.
            </p>
            <button onClick={() => navigate("/")} className="btn3d mt-7 bg-white !text-brand-600 shadow-[0_4px_0_0_#B84B00] text-base uppercase hover:brightness-100">
              Start learning — free <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
