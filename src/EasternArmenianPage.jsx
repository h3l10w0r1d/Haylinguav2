// src/EasternArmenianPage.jsx — public, unauthenticated SEO landing page
// explaining Eastern vs. Western Armenian and what Haylingua teaches.
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, X } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";

const FAQ = [
  {
    q: "Is Eastern or Western Armenian more useful to learn?",
    a: "It depends on who you'll speak with. Eastern Armenian is the official language of the Republic of Armenia and is spoken by the majority of Armenian speakers worldwide. Western Armenian is more common among diaspora communities with roots in the Ottoman Empire — parts of the U.S., France, and the Middle East.",
  },
  {
    q: "Can an Eastern Armenian speaker understand Western Armenian?",
    a: "Largely yes, with practice — the two are close enough that speakers can often follow each other, similar to the relationship between some closely related Romance languages. Vocabulary, some grammar, and especially pronunciation differ enough to cause real confusion at first.",
  },
  {
    q: "Does Haylingua teach Western Armenian too?",
    a: "Not yet — Haylingua's course teaches Standard Eastern Armenian. It's a natural foundation even if your family speaks Western Armenian, since the alphabet and a large share of vocabulary and grammar overlap.",
  },
];

export default function EasternArmenianPage() {
  const navigate = useNavigate();

  const structuredData = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://www.haylingua.am/" },
          { "@type": "ListItem", position: 2, name: "Eastern Armenian", item: "https://www.haylingua.am/eastern-armenian" },
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
    ],
    []
  );

  usePageMeta(
    "Eastern Armenian — What It Is & How to Learn It",
    "Eastern Armenian is the official language of Armenia, spoken by the majority of Armenian speakers worldwide. Learn what makes it different from Western Armenian and how to start learning it.",
    { structuredData }
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <SiteNav />

      <main>
        <header className="mx-auto max-w-3xl px-5 pb-8 pt-14 text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-5xl">
            Eastern Armenian
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-slate-500 dark:text-stone-400">
            Armenian has two living literary standards — Eastern and Western. Eastern Armenian is
            the official language of the Republic of Armenia today, and it's what Haylingua teaches.
          </p>
        </header>

        <section className="mx-auto max-w-3xl px-5 pb-16">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
            <h2 className="font-display text-xl font-extrabold text-slate-800 dark:text-white">Eastern vs. Western Armenian, at a glance</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-brand-50 p-4 dark:bg-brand-500/10">
                <div className="flex items-center gap-2 font-display font-extrabold text-brand-700 dark:text-brand-400">
                  <Check className="h-4 w-4" /> Eastern Armenian
                </div>
                <ul className="mt-2 space-y-1.5 text-sm font-semibold text-slate-600 dark:text-stone-300">
                  <li>Official language of Armenia</li>
                  <li>Spoken by the majority of Armenian speakers</li>
                  <li>Used in Armenia, and by many diaspora communities with roots in the Russian Empire/Iran</li>
                  <li>What Haylingua teaches</li>
                </ul>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/[0.04]">
                <div className="flex items-center gap-2 font-display font-extrabold text-slate-600 dark:text-stone-300">
                  <X className="h-4 w-4" /> Western Armenian
                </div>
                <ul className="mt-2 space-y-1.5 text-sm font-semibold text-slate-500 dark:text-stone-400">
                  <li>Historically spoken in the Ottoman Empire</li>
                  <li>Common in diaspora communities (U.S., France, Middle East)</li>
                  <li>Different pronunciation of several consonant pairs</li>
                  <li>Not yet covered by Haylingua's course</li>
                </ul>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-stone-400">
              The two share the same 39-letter alphabet and a large amount of vocabulary and grammar
              — the biggest practical difference for a beginner is pronunciation, especially of the
              plain vs. puffed-out consonant pairs (see the{" "}
              <Link to="/armenian-pronunciation" className="font-bold text-brand-600 hover:underline dark:text-brand-400">pronunciation guide</Link>).
            </p>
          </div>
        </section>

        <section className="border-t border-slate-100 bg-slate-50 px-5 py-16 dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              Questions about Eastern Armenian
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

        <section className="px-5 py-14">
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
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Start learning Eastern Armenian today</h2>
            <p className="mt-3 max-w-md text-lg font-semibold text-white/90">
              Free, bite-sized lessons from your first letter to real conversation.
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
