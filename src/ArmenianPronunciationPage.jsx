// src/ArmenianPronunciationPage.jsx — public, unauthenticated SEO landing
// page covering how Armenian actually sounds, with real audio via the same
// public TTS pipeline the rest of the site uses (already proven unauthenticated
// on the landing page's own demo — see src/LandingPage.jsx's VoiceChip).
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Volume2, Loader2 } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";
import { ttsFetch } from "./exercises/tts";
import { newTrackedAudio } from "./lib/audioRegistry";
import { useLocale, localizedPath, SUPPORTED_LOCALES } from "./i18n";

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

// The Armenian words themselves are locale-invariant target-language content
// (not UI copy), so they stay here in code; only each example's English
// gloss ("house — plain t") is translated, via seo-pages.json's
// armenianPronunciation.trickyPairs[i].examples[j].label, zipped in below.
const TRICKY_PAIRS_ARM = [
  { examples: ["տուն", "թիվ"] },
  { examples: ["արև", "առյուծ"] },
  { examples: ["խոզ", "աղ"] },
];

export default function ArmenianPronunciationPage() {
  const navigate = useNavigate();
  const { t } = useTranslation("seoPages");
  const locale = useLocale();
  const lp = (path) => localizedPath(path, locale);

  const trickyPairsCopy = t("armenianPronunciation.trickyPairs", { returnObjects: true });
  const TRICKY_PAIRS = trickyPairsCopy.map((p, i) => ({
    title: p.title,
    text: p.text,
    examples: p.examples.map((e, j) => ({ arm: TRICKY_PAIRS_ARM[i].examples[j], label: e.label })),
  }));
  const keepGoingCards = t("armenianPronunciation.keepGoing.cards", { returnObjects: true });
  const [alphabetNoteBefore, alphabetNoteAfter] = t("armenianPronunciation.alphabetNote").split("{{link}}");

  const structuredData = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("armenianPronunciation.breadcrumb.home"), item: "https://www.haylingua.am/" },
          { "@type": "ListItem", position: 2, name: t("armenianPronunciation.breadcrumb.current"), item: "https://www.haylingua.am/armenian-pronunciation" },
        ],
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale]
  );

  usePageMeta(
    t("armenianPronunciation.meta.title"),
    t("armenianPronunciation.meta.description"),
    {
      structuredData,
      alternates: SUPPORTED_LOCALES.map((loc) => ({ locale: loc, path: "/armenian-pronunciation" })).concat([
        { locale: "", path: "/armenian-pronunciation" },
      ]),
    }
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <SiteNav />

      <main>
        <header className="mx-auto max-w-3xl px-5 pb-8 pt-14 text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-5xl">
            {t("armenianPronunciation.hero.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-slate-500 dark:text-stone-400">
            {t("armenianPronunciation.hero.subtitle")}
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
              {alphabetNoteBefore}
              <Link to={lp("/armenian-alphabet")} className="font-extrabold text-brand-700 hover:underline dark:text-brand-400">{t("armenianPronunciation.alphabetNoteLinkText")}</Link>
              {alphabetNoteAfter}
            </p>
          </div>
        </section>

        <section className="border-t border-slate-100 bg-slate-50 px-5 py-14 dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              {t("armenianPronunciation.keepGoing.heading")}
            </h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <Link to={lp("/armenian-alphabet")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{keepGoingCards[0].title}</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{keepGoingCards[0].text}</p>
              </Link>
              <Link to={lp("/armenian-vocabulary")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{keepGoingCards[1].title}</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{keepGoingCards[1].text}</p>
              </Link>
              <Link to={lp("/eastern-armenian")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{keepGoingCards[2].title}</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{keepGoingCards[2].text}</p>
              </Link>
            </div>
          </div>
        </section>

        <section className="px-5 py-16">
          <div className="relative mx-auto flex max-w-5xl flex-col items-center overflow-hidden rounded-[2rem] bg-brand-500 px-6 py-14 text-center text-white shadow-btn-brand">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t("armenianPronunciation.cta.heading")}</h2>
            <p className="mt-3 max-w-md text-lg font-semibold text-white/90">
              {t("armenianPronunciation.cta.subtext")}
            </p>
            <button onClick={() => navigate(lp("/"))} className="btn3d mt-7 bg-white !text-brand-600 shadow-[0_4px_0_0_#B84B00] text-base uppercase hover:brightness-100">
              {t("armenianPronunciation.cta.button")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
