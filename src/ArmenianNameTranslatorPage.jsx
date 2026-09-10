// src/ArmenianNameTranslatorPage.jsx — public, unauthenticated SEO tool page:
// type a name, see it transliterated into the Armenian alphabet, hear it
// pronounced via the same public TTS pipeline the rest of the site uses.
// Targets "how do you write my name in Armenian" search intent.
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Volume2, Loader2, Copy, Check } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";
import RelatedBlogPosts from "./lib/RelatedBlogPosts";
import { ttsFetch } from "./exercises/tts";
import { newTrackedAudio } from "./lib/audioRegistry";
import { useLocale, localizedPath, SUPPORTED_LOCALES } from "./i18n";
import { transliterateToArmenian } from "./lib/nameTranslit";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

// Popular first names for the quick-pick chips — locale-invariant Latin
// input, so these stay in code rather than in the translated JSON (like
// TRICKY_PAIRS_ARM in ArmenianPronunciationPage.jsx).
const POPULAR_NAMES = [
  "John", "Emma", "Michael", "Sophia", "David", "Anna",
  "Alexander", "Maria", "Daniel", "Elizabeth", "George", "Sarah",
];

export default function ArmenianNameTranslatorPage() {
  const navigate = useNavigate();
  const { t } = useTranslation("seoPages");
  const locale = useLocale();
  const lp = (path) => localizedPath(path, locale);

  const [name, setName] = useState("");
  const [audioState, setAudioState] = useState("idle"); // idle | loading | playing
  const [copied, setCopied] = useState(false);

  const armenian = useMemo(() => transliterateToArmenian(name.trim()), [name]);

  const faq = t("armenianNameTranslator.faq", { returnObjects: true });
  const keepGoingCards = t("armenianNameTranslator.keepGoing.cards", { returnObjects: true });

  async function playAudio() {
    if (!armenian || audioState !== "idle") return;
    setAudioState("loading");
    try {
      const url = await ttsFetch(API_BASE, { text: armenian });
      const audio = newTrackedAudio(url);
      audio.onended = () => setAudioState("idle");
      audio.onerror = () => setAudioState("idle");
      setAudioState("playing");
      await audio.play();
    } catch {
      setAudioState("idle");
    }
  }

  async function copyResult() {
    if (!armenian) return;
    try {
      await navigator.clipboard.writeText(armenian);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard permission denied — silently no-op, the text is still on screen to select
    }
  }

  const structuredData = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("armenianNameTranslator.breadcrumb.home"), item: "https://www.haylingua.am/" },
          { "@type": "ListItem", position: 2, name: t("armenianNameTranslator.breadcrumb.current"), item: "https://www.haylingua.am/armenian-name-translator" },
        ],
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale]
  );

  usePageMeta(
    t("armenianNameTranslator.meta.title"),
    t("armenianNameTranslator.meta.description"),
    {
      structuredData,
      alternates: SUPPORTED_LOCALES.map((loc) => ({ locale: loc, path: "/armenian-name-translator" })).concat([
        { locale: "", path: "/armenian-name-translator" },
      ]),
    }
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <SiteNav />

      <main id="main-content">
        <header className="mx-auto max-w-3xl px-5 pb-8 pt-14 text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-5xl">
            {t("armenianNameTranslator.hero.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-slate-500 dark:text-stone-400">
            {t("armenianNameTranslator.hero.subtitle")}
          </p>
        </header>

        <section className="mx-auto max-w-2xl px-5 pb-10">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08] sm:p-8">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("armenianNameTranslator.tool.placeholder")}
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-center font-display text-xl font-extrabold text-slate-800 outline-none transition focus:border-brand-400 focus:bg-white dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white dark:focus:border-brand-500/50 dark:focus:bg-white/[0.06]"
            />

            <div className="mt-6 min-h-[7rem] rounded-2xl bg-brand-50 p-6 text-center dark:bg-brand-500/10">
              {armenian ? (
                <>
                  <div className="text-xs font-extrabold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                    {t("armenianNameTranslator.tool.resultLabel")}
                  </div>
                  <div className="mt-2 break-words font-display text-4xl font-extrabold text-slate-800 dark:text-white sm:text-5xl">
                    {armenian}
                  </div>
                  <div className="mt-5 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={playAudio}
                      disabled={audioState !== "idle"}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-brand-700 shadow-sm ring-2 ring-brand-200 transition hover:bg-brand-50 disabled:opacity-70 dark:bg-[#18181b] dark:text-brand-400 dark:ring-brand-500/30 dark:hover:bg-brand-500/10"
                    >
                      {audioState === "loading" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Volume2 className={"h-4 w-4 " + (audioState === "playing" ? "animate-pulse" : "")} />
                      )}
                      {t("armenianNameTranslator.tool.listenLabel")}
                    </button>
                    <button
                      type="button"
                      onClick={copyResult}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-slate-600 shadow-sm ring-2 ring-slate-200 transition hover:bg-slate-50 dark:bg-[#18181b] dark:text-stone-300 dark:ring-white/[0.1] dark:hover:bg-white/[0.06]"
                    >
                      {copied ? <Check className="h-4 w-4 text-grass-500" /> : <Copy className="h-4 w-4" />}
                      {copied ? t("armenianNameTranslator.tool.copied") : t("armenianNameTranslator.tool.copyLabel")}
                    </button>
                  </div>
                </>
              ) : (
                <p className="py-3 font-semibold text-slate-400 dark:text-stone-500">
                  {t("armenianNameTranslator.tool.emptyHint")}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 text-center">
            <div className="text-xs font-extrabold uppercase tracking-wide text-slate-400 dark:text-stone-500">
              {t("armenianNameTranslator.tool.popularHeading")}
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {POPULAR_NAMES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setName(n)}
                  className="rounded-full bg-white px-3.5 py-1.5 text-sm font-bold text-slate-600 ring-1 ring-slate-200 transition hover:border-brand-300 hover:text-brand-700 dark:bg-[#18181b] dark:text-stone-300 dark:ring-white/[0.08] dark:hover:text-brand-400"
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <p className="mx-auto mt-8 max-w-xl text-center text-sm font-semibold text-slate-400 dark:text-stone-500">
            {t("armenianNameTranslator.disclaimer")}
          </p>
        </section>

        <section className="border-t border-slate-100 bg-slate-50 px-5 py-14 dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">FAQ</h2>
            <div className="mt-7 space-y-4">
              {faq.map((f) => (
                <div key={f.q} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
                  <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{f.q}</div>
                  <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-stone-400">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-14">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              {t("armenianNameTranslator.keepGoing.heading")}
            </h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <Link to={lp("/armenian-alphabet")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{keepGoingCards[0].title}</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{keepGoingCards[0].text}</p>
              </Link>
              <Link to={lp("/armenian-pronunciation")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{keepGoingCards[1].title}</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{keepGoingCards[1].text}</p>
              </Link>
              <Link to={lp("/learn-armenian-online")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{keepGoingCards[2].title}</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{keepGoingCards[2].text}</p>
              </Link>
            </div>
          </div>
        </section>

        <section className="px-5 py-16">
          <div className="relative mx-auto flex max-w-5xl flex-col items-center overflow-hidden rounded-[2rem] bg-brand-500 px-6 py-14 text-center text-white shadow-btn-brand">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t("armenianNameTranslator.cta.heading")}</h2>
            <p className="mt-3 max-w-md text-lg font-semibold text-white/90">
              {t("armenianNameTranslator.cta.subtext")}
            </p>
            <button onClick={() => navigate(lp("/"))} className="btn3d mt-7 bg-white !text-brand-600 shadow-[0_4px_0_0_#B84B00] text-base uppercase hover:brightness-100">
              {t("armenianNameTranslator.cta.button")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </button>
          </div>
        </section>

        <RelatedBlogPosts tags={["alphabet", "writing", "beginner"]} />
      </main>

      <SiteFooter />
    </div>
  );
}
