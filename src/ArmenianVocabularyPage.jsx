// src/ArmenianVocabularyPage.jsx — public, unauthenticated SEO landing page:
// core Armenian vocabulary by category, following the same SiteNav/SiteFooter/
// usePageMeta pattern as AboutPage.jsx.
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";

const CATEGORIES = [
  {
    title: "Greetings",
    words: [
      ["Բարև", "ba-rev", "Hello"],
      ["Բարի լույս", "ba-ri luys", "Good morning"],
      ["Բարի երեկո", "ba-ri ye-re-ko", "Good evening"],
      ["Ցտեսություն", "tse-te-su-tyun", "Goodbye"],
      ["Շնորհակալություն", "shnor-ha-ka-lu-tyun", "Thank you"],
      ["Խնդրեմ", "khən-drem", "Please / you're welcome"],
    ],
  },
  {
    title: "Numbers 1–10",
    words: [
      ["մեկ", "mek", "one"],
      ["երկու", "yer-ku", "two"],
      ["երեք", "ye-rek'", "three"],
      ["չորս", "chors", "four"],
      ["հինգ", "hing", "five"],
      ["վեց", "vets'", "six"],
      ["յոթ", "yot'", "seven"],
      ["ութ", "ut'", "eight"],
      ["ինը", "i-nə", "nine"],
      ["տասը", "ta-sə", "ten"],
    ],
  },
  {
    title: "Family",
    words: [
      ["մայր", "mayr", "mother"],
      ["հայր", "hayr", "father"],
      ["քույր", "k'uyr", "sister"],
      ["եղբայր", "yegh-bayr", "brother"],
      ["տատիկ", "ta-tik", "grandmother"],
      ["պապիկ", "pa-pik", "grandfather"],
    ],
  },
  {
    title: "Food & drink",
    words: [
      ["հաց", "hats", "bread"],
      ["ջուր", "jur", "water"],
      ["կաթ", "kat", "milk"],
      ["միս", "mis", "meat"],
      ["պանիր", "pa-nir", "cheese"],
      ["մրգ", "mərg", "fruit"],
    ],
  },
  {
    title: "Colors",
    words: [
      ["կարմիր", "kar-mir", "red"],
      ["կապույտ", "ka-puyt", "blue"],
      ["դեղին", "de-ghin", "yellow"],
      ["կանաչ", "ka-nach", "green"],
      ["սպիտակ", "spi-tak", "white"],
      ["սև", "sev", "black"],
    ],
  },
  {
    title: "Days of the week",
    words: [
      ["երկուշաբթի", "yer-ku-shab-t'i", "Monday"],
      ["երեքշաբթի", "ye-rek'-shab-t'i", "Tuesday"],
      ["չորեքշաբթի", "cho-rek'-shab-t'i", "Wednesday"],
      ["հինգշաբթի", "hing-shab-t'i", "Thursday"],
      ["ուրբաթ", "ur-bat'", "Friday"],
      ["շաբաթ", "sha-bat'", "Saturday"],
      ["կիրակի", "ki-ra-ki", "Sunday"],
    ],
  },
];

export default function ArmenianVocabularyPage() {
  const navigate = useNavigate();

  const structuredData = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://www.haylingua.am/" },
          { "@type": "ListItem", position: 2, name: "Armenian Vocabulary", item: "https://www.haylingua.am/armenian-vocabulary" },
        ],
      },
    ],
    []
  );

  usePageMeta(
    "Armenian Vocabulary — Essential Words by Category",
    "Core Armenian vocabulary organized by category: greetings, numbers, family, food, colors, and days of the week — with pronunciation for every word.",
    { structuredData }
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <SiteNav />

      <main>
        <header className="mx-auto max-w-3xl px-5 pb-8 pt-14 text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-5xl">
            Armenian Vocabulary
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-slate-500 dark:text-stone-400">
            The core words you'll reach for constantly — greetings, numbers, family, food, colors,
            and the days of the week — with transliteration for every word so you can start using
            them before you've mastered reading Armenian script.
          </p>
        </header>

        <section className="mx-auto max-w-4xl px-5 pb-16">
          <div className="grid gap-6 sm:grid-cols-2">
            {CATEGORIES.map((cat) => (
              <div key={cat.title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
                <h2 className="font-display text-lg font-extrabold text-slate-800 dark:text-white">{cat.title}</h2>
                <ul className="mt-3 space-y-2">
                  {cat.words.map(([arm, rom, en]) => (
                    <li key={arm} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-display font-extrabold text-slate-800 dark:text-white">{arm}</span>
                      <span className="flex-1 text-right font-semibold text-slate-400 dark:text-stone-500">{rom}</span>
                      <span className="w-24 shrink-0 text-right font-semibold text-slate-600 dark:text-stone-300">{en}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl bg-brand-50 p-6 text-center dark:bg-brand-500/10">
            <p className="font-semibold text-slate-600 dark:text-stone-300">
              Want to hear every one of these words pronounced? Haylingua's full course puts real
              audio on every word — start with the{" "}
              <Link to="/armenian-alphabet" className="font-extrabold text-brand-700 hover:underline dark:text-brand-400">Armenian alphabet</Link>{" "}
              if you're not reading Armenian script yet.
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
              <Link to="/armenian-pronunciation" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">Armenian Pronunciation</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">The sounds that trip up beginners.</p>
              </Link>
              <Link to="/learn-armenian-online" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">Learn Armenian Online</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">How Haylingua's full course works.</p>
              </Link>
            </div>
          </div>
        </section>

        <section className="px-5 py-16">
          <div className="relative mx-auto flex max-w-5xl flex-col items-center overflow-hidden rounded-[2rem] bg-brand-500 px-6 py-14 text-center text-white shadow-btn-brand">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Build real vocabulary, not just a word list</h2>
            <p className="mt-3 max-w-md text-lg font-semibold text-white/90">
              Haylingua turns words like these into lessons, exercises, and real sentences you'll remember.
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
