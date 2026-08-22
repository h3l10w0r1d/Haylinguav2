// src/ArmenianAlphabetPage.jsx — public, unauthenticated SEO landing page:
// all 39 letters of the Armenian alphabet, built from the real product data
// (the same lessons/exercises the in-app course teaches from — hl-alphabet-1
// through hl-alphabet-11, seeded by backend/seed_alphabet.py) rather than
// hand-typed content, with the same real audio pipeline the lesson player
// uses (GET /audio/exercise, GET /audio/target — both public, no auth).
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Volume2, Loader2 } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";
import { ttsFetch } from "./exercises/tts";
import { newTrackedAudio } from "./lib/audioRegistry";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

// hl-alphabet-1/2 predate seed_alphabet.py (from seed_curriculum.py); 3-10
// add the rest; 11 is a char_build_word-only capstone with no char_intro
// exercises, included for completeness but contributes zero letters.
const LESSON_SLUGS = Array.from({ length: 11 }, (_, i) => `hl-alphabet-${i + 1}`);

const FAQ = [
  {
    q: "Is the Armenian alphabet hard to learn?",
    a: "Not really — it has 39 letters and, unlike English, each letter almost always makes exactly one sound. Once you've drilled the sounds, reading Armenian is far more predictable than reading English.",
  },
  {
    q: "How long does it take to learn the Armenian alphabet?",
    a: "Most learners can recognize and sound out every letter within one to two weeks of short daily practice — Haylingua's own alphabet course is broken into 11 bite-sized lessons for exactly this pace.",
  },
  {
    q: "What's the difference between Eastern and Western Armenian letters?",
    a: "The letterforms and alphabet order are identical — the difference is in pronunciation of certain letter pairs. Haylingua teaches Standard Eastern Armenian, the form used in Armenia today.",
  },
  {
    q: "Do I need to learn cursive Armenian handwriting?",
    a: "Not to read or type Armenian — the printed letterforms shown on this page are what you'll see everywhere online and in most print. Handwriting is a separate, optional skill you can pick up later.",
  },
];

function LetterCard({ letter }) {
  const [playing, setPlaying] = useState(false);

  async function play() {
    if (playing) return;
    setPlaying(true);
    try {
      const url = await ttsFetch(API_BASE, {
        text: letter.exampleWord || letter.letter,
        exerciseId: letter.exerciseId,
        targetKey: "letter",
      });
      const audio = newTrackedAudio(url);
      audio.onended = () => setPlaying(false);
      audio.onerror = () => setPlaying(false);
      await audio.play();
    } catch {
      setPlaying(false);
    }
  }

  return (
    <button
      type="button"
      onClick={play}
      className="group flex flex-col items-center gap-1.5 rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]"
    >
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-extrabold text-slate-800 dark:text-white">{letter.letter}</span>
        <span className="font-display text-xl font-bold text-slate-500 dark:text-stone-400">{letter.lower}</span>
      </div>
      <div className="text-xs font-bold uppercase tracking-wide text-brand-600 dark:text-brand-400">{letter.transliteration}</div>
      {letter.exampleWord && (
        <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-stone-400">
          {letter.exampleEmoji && <span>{letter.exampleEmoji}</span>}
          <span>{letter.exampleWord}</span>
        </div>
      )}
      <div className="mt-1.5 grid h-7 w-7 place-items-center rounded-full bg-brand-50 text-brand-500 transition group-hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-400 dark:group-hover:bg-brand-500/25">
        {playing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
      </div>
    </button>
  );
}

export default function ArmenianAlphabetPage() {
  const navigate = useNavigate();
  const [letters, setLetters] = useState(null); // null = loading
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      LESSON_SLUGS.map((slug) =>
        fetch(`${API_BASE}/lessons/${slug}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      )
    ).then((lessons) => {
      if (cancelled) return;
      const out = [];
      for (const lesson of lessons) {
        if (!lesson?.exercises) continue;
        const charIntros = lesson.exercises
          .filter((ex) => ex.kind === "char_intro")
          .sort((a, b) => a.order - b.order);
        for (const ex of charIntros) {
          const cfg = ex.config || {};
          if (!cfg.letter) continue;
          out.push({
            exerciseId: ex.id,
            letter: cfg.letter,
            lower: cfg.lower || "",
            transliteration: cfg.transliteration || "",
            hint: cfg.hint || "",
            exampleWord: cfg.exampleWord || "",
            exampleMeaning: cfg.exampleMeaning || "",
            exampleEmoji: cfg.exampleEmoji || "",
          });
        }
      }
      if (out.length === 0) setLoadError(true);
      setLetters(out);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const structuredData = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://www.haylingua.am/" },
          { "@type": "ListItem", position: 2, name: "Armenian Alphabet", item: "https://www.haylingua.am/armenian-alphabet" },
        ],
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@context": "https://schema.org",
        "@type": "LearningResource",
        name: "The Armenian Alphabet",
        description: "All 39 letters of the Armenian alphabet with pronunciation audio, transliteration, and example words.",
        educationalLevel: "Beginner",
        learningResourceType: "Reference",
        inLanguage: "hy",
        url: "https://www.haylingua.am/armenian-alphabet",
      },
    ],
    []
  );

  usePageMeta(
    "Armenian Alphabet — Learn All 39 Letters with Audio",
    "Learn the Armenian alphabet with real pronunciation audio for every letter, transliteration, and example words — all 39 letters, free, no signup needed to browse.",
    { structuredData }
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <SiteNav />

      <main>
        {/* ── Hero ── */}
        <header className="mx-auto max-w-4xl px-5 pb-8 pt-14 text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-5xl">
            The Armenian Alphabet
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-slate-500 dark:text-stone-400">
            All 39 letters of the Armenian alphabet — tap any letter to hear it pronounced, with
            transliteration and a real example word for each. This is the exact same audio and
            content Haylingua's own beginner course teaches from.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => navigate("/")} className="btn3d btn3d-brand text-sm uppercase">
              Start learning free <ArrowRight className="h-4 w-4" />
            </button>
            <Link to="/eastern-armenian" className="text-sm font-bold text-brand-600 hover:underline dark:text-brand-400">
              What's Eastern Armenian? →
            </Link>
          </div>
        </header>

        {/* ── Letter grid ── */}
        <section className="mx-auto max-w-5xl px-5 pb-16">
          {letters == null ? (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-500 dark:text-stone-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-semibold">Loading the alphabet…</span>
            </div>
          ) : loadError ? (
            <div className="rounded-2xl bg-cardinal-50 p-6 text-center text-sm font-bold text-cardinal-600 dark:bg-cardinal-500/15 dark:text-cardinal-400">
              Couldn't load the alphabet right now — please refresh.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {letters.map((letter, i) => (
                <LetterCard key={`${letter.letter}-${i}`} letter={letter} />
              ))}
            </div>
          )}
        </section>

        {/* ── Explore more ── */}
        <section className="border-t border-slate-100 bg-slate-50 px-5 py-14 dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              Keep going
            </h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <Link to="/armenian-pronunciation" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">Armenian Pronunciation</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">Master the sounds that don't exist in English.</p>
              </Link>
              <Link to="/armenian-vocabulary" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">Armenian Vocabulary</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">Core words to start reading and speaking.</p>
              </Link>
              <Link to="/learn-armenian-online" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">Learn Armenian Online</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">How Haylingua's full course works.</p>
              </Link>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="px-5 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              Questions about the Armenian alphabet
            </h2>
            <div className="mt-8 space-y-5">
              {FAQ.map((f) => (
                <div key={f.q}>
                  <div className="text-sm font-extrabold text-slate-800 dark:text-white">{f.q}</div>
                  <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="px-5 py-16">
          <div className="relative mx-auto flex max-w-5xl flex-col items-center overflow-hidden rounded-[2rem] bg-brand-500 px-6 py-14 text-center text-white shadow-btn-brand">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Ready to go beyond the alphabet?</h2>
            <p className="mt-3 max-w-md text-lg font-semibold text-white/90">
              Start Haylingua's free course and build real words, grammar, and conversation on top of what you just learned.
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
