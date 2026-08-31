// src/ArmenianVocabularyPage.jsx — public, unauthenticated SEO landing page:
// core Armenian vocabulary by category, following the same SiteNav/SiteFooter/
// usePageMeta pattern as AboutPage.jsx.
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";
import { useLocale, localizedPath, SUPPORTED_LOCALES } from "./i18n";

// Category titles are translated (seo-pages.json's
// armenianVocabulary.categoryTitles); the words themselves — Armenian
// script, romanization, and English gloss — are target-language/reference
// content, not UI copy, so they stay here in code, same treatment as the
// Armenian words on the pronunciation page.
const CATEGORIES = [
  {
    key: "greetings",
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
    key: "numbers",
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
    key: "family",
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
    key: "food",
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
    key: "colors",
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
    key: "days",
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
  const { t } = useTranslation("seoPages");
  const locale = useLocale();
  const lp = (path) => localizedPath(path, locale);

  const categoryTitles = t("armenianVocabulary.categoryTitles", { returnObjects: true });
  const keepGoingCards = t("armenianVocabulary.keepGoing.cards", { returnObjects: true });
  const [alphabetNoteBefore, alphabetNoteAfter] = t("armenianVocabulary.alphabetNote").split("{{link}}");

  const structuredData = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("armenianVocabulary.breadcrumb.home"), item: "https://www.haylingua.am/" },
          { "@type": "ListItem", position: 2, name: t("armenianVocabulary.breadcrumb.current"), item: "https://www.haylingua.am/armenian-vocabulary" },
        ],
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale]
  );

  usePageMeta(
    t("armenianVocabulary.meta.title"),
    t("armenianVocabulary.meta.description"),
    {
      structuredData,
      alternates: SUPPORTED_LOCALES.map((loc) => ({ locale: loc, path: "/armenian-vocabulary" })).concat([
        { locale: "", path: "/armenian-vocabulary" },
      ]),
    }
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <SiteNav />

      <main>
        <header className="mx-auto max-w-3xl px-5 pb-8 pt-14 text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-5xl">
            {t("armenianVocabulary.hero.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-slate-500 dark:text-stone-400">
            {t("armenianVocabulary.hero.subtitle")}
          </p>
        </header>

        <section className="mx-auto max-w-4xl px-5 pb-16">
          <div className="grid gap-6 sm:grid-cols-2">
            {CATEGORIES.map((cat) => (
              <div key={cat.key} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
                <h2 className="font-display text-lg font-extrabold text-slate-800 dark:text-white">{categoryTitles[cat.key]}</h2>
                <ul className="mt-3 space-y-2">
                  {cat.words.map(([arm, rom, en]) => (
                    <li key={arm} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-display font-extrabold text-slate-800 dark:text-white">{arm}</span>
                      <span className="flex-1 text-end font-semibold text-slate-400 dark:text-stone-500">{rom}</span>
                      <span className="w-24 shrink-0 text-end font-semibold text-slate-600 dark:text-stone-300">{en}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl bg-brand-50 p-6 text-center dark:bg-brand-500/10">
            <p className="font-semibold text-slate-600 dark:text-stone-300">
              {alphabetNoteBefore}
              <Link to={lp("/armenian-alphabet")} className="font-extrabold text-brand-700 hover:underline dark:text-brand-400">{t("armenianVocabulary.alphabetNoteLinkText")}</Link>
              {alphabetNoteAfter}
            </p>
          </div>
        </section>

        <section className="border-t border-slate-100 bg-slate-50 px-5 py-14 dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              {t("armenianVocabulary.keepGoing.heading")}
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
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t("armenianVocabulary.cta.heading")}</h2>
            <p className="mt-3 max-w-md text-lg font-semibold text-white/90">
              {t("armenianVocabulary.cta.subtext")}
            </p>
            <button onClick={() => navigate(lp("/"))} className="btn3d mt-7 bg-white !text-brand-600 shadow-[0_4px_0_0_#B84B00] text-base uppercase hover:brightness-100">
              {t("armenianVocabulary.cta.button")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
