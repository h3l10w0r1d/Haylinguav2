// src/ArmenianPronunciationPage.jsx — public, unauthenticated SEO landing
// page covering how Armenian actually sounds, with real audio via the same
// public TTS pipeline the rest of the site uses (already proven unauthenticated
// on the landing page's own demo — see src/LandingPage.jsx's VoiceChip).
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Volume2, Loader2 } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";
import { ttsFetch } from "./exercises/tts";
import { newTrackedAudio } from "./lib/audioRegistry";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

function AudioChip({ text, label }) {
  const [state, setState] = useState("idle"); // idle | loading | playing

  async function toggle() {
    if (state !== "idle") return;
    setState("loading");
    try {
      const url = await ttsFetch(API_BASE, { text });
      const audio = newTrackedAudio(url);
      audio.onended = () => setState("idle");
      audio.onerror = () => setState("idle");
      setState("playing");
      await audio.play();
    } catch {
      setState("idle");
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-extrabold text-brand-700 ring-2 ring-brand-200 transition hover:bg-brand-50 dark:bg-[#18181b] dark:text-brand-400 dark:ring-brand-500/30 dark:hover:bg-brand-500/10"
    >
      {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className={"h-4 w-4 " + (state === "playing" ? "animate-pulse" : "")} />}
      <span>{text}</span>
      {label && <span className="font-bold text-slate-400 dark:text-stone-500">· {label}</span>}
    </button>
  );
}

const TRICKY_PAIRS = [
  {
    title: "Unaspirated vs. aspirated stops",
    text: "Armenian distinguishes a plain, no-breath consonant from the same consonant said with a burst of air — a contrast English doesn't make. Compare a crisp «տ» (t) with a puffed-out «թ» (t').",
    examples: [
      { arm: "տուն", label: "house — plain t" },
      { arm: "թիվ", label: "number — puffed t" },
    ],
  },
  {
    title: "Two kinds of R",
    text: "Eastern Armenian has a light single tongue-tap «ր» (close to the American 'tt' in 'butter') and a strongly rolled/trilled «ռ» — mixing them up is one of the most common beginner errors.",
    examples: [
      { arm: "արև", label: "sun — light r" },
      { arm: "առյուծ", label: "lion — rolled r" },
    ],
  },
  {
    title: "Sounds with no English equivalent",
    text: "A few Armenian consonants don't map onto anything in English at all — «խ» is a rasping throat sound like the Scottish 'ch' in loch, and «ղ» is a soft, gargled sound close to a French 'r'.",
    examples: [
      { arm: "խոզ", label: "pig — throat rasp" },
      { arm: "աղ", label: "salt — soft gargle" },
    ],
  },
];

export default function ArmenianPronunciationPage() {
  const navigate = useNavigate();

  const structuredData = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://www.haylingua.am/" },
          { "@type": "ListItem", position: 2, name: "Armenian Pronunciation", item: "https://www.haylingua.am/armenian-pronunciation" },
        ],
      },
    ],
    []
  );

  usePageMeta(
    "Armenian Pronunciation — How Armenian Actually Sounds",
    "Learn how to pronounce Armenian correctly with real audio examples — aspirated vs. unaspirated consonants, the two Armenian R sounds, and sounds with no English equivalent.",
    { structuredData }
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <SiteNav />

      <main>
        <header className="mx-auto max-w-3xl px-5 pb-8 pt-14 text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-5xl">
            Armenian Pronunciation
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-slate-500 dark:text-stone-400">
            Armenian is almost entirely phonetic — once you know a letter's sound, it's the same in
            every word. The hard part isn't the rules, it's a handful of sounds English speakers
            haven't trained their mouths to make. Here's what to listen for, with real audio.
          </p>
        </header>

        <section className="mx-auto max-w-3xl px-5 pb-16">
          <div className="space-y-8">
            {TRICKY_PAIRS.map((p) => (
              <div key={p.title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
                <h2 className="font-display text-xl font-extrabold text-slate-800 dark:text-white">{p.title}</h2>
                <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-stone-400">{p.text}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {p.examples.map((e) => (
                    <AudioChip key={e.arm} text={e.arm} label={e.label} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl bg-brand-50 p-6 text-center dark:bg-brand-500/10">
            <p className="font-semibold text-slate-600 dark:text-stone-300">
              Every one of the 39 Armenian letters has its own audio, transliteration, and example word on the{" "}
              <Link to="/armenian-alphabet" className="font-extrabold text-brand-700 hover:underline dark:text-brand-400">Armenian alphabet page</Link>.
            </p>
          </div>
        </section>

        <section className="border-t border-slate-100 bg-slate-50 px-5 py-14 dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              Keep going
            </h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <Link to="/armenian-alphabet" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">Armenian Alphabet</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">All 39 letters with audio.</p>
              </Link>
              <Link to="/armenian-vocabulary" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">Armenian Vocabulary</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">Core words to start speaking.</p>
              </Link>
              <Link to="/eastern-armenian" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">Eastern Armenian</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">The dialect Haylingua teaches.</p>
              </Link>
            </div>
          </div>
        </section>

        <section className="px-5 py-16">
          <div className="relative mx-auto flex max-w-5xl flex-col items-center overflow-hidden rounded-[2rem] bg-brand-500 px-6 py-14 text-center text-white shadow-btn-brand">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Practice pronunciation with instant feedback</h2>
            <p className="mt-3 max-w-md text-lg font-semibold text-white/90">
              Haylingua's lessons put real audio on every word, from your first letter to full sentences.
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
