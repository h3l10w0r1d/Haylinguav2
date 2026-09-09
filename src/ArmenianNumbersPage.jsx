// src/ArmenianNumbersPage.jsx — public, unauthenticated SEO landing page:
// Armenian numbers 1–100, targeting the "armenian numbers 1 to 100" query
// cluster. Same SiteNav/SiteFooter/usePageMeta pattern as the other SEO
// landing pages (see ArmenianVocabularyPage.jsx).
//
// The number data below deliberately matches backend/seed_blog_posts.py's
// "armenian-numbers-1-to-100" post character-for-character — the two pages
// cover the same ground for different intents (reference page vs article),
// and contradicting ourselves across them would be worse than either.
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";
import RelatedBlogPosts from "./lib/RelatedBlogPosts";
import { PATH_TO_TAGS } from "./lib/blogTopics";
import { useLocale, localizedPath, SUPPORTED_LOCALES } from "./i18n";

// [digit, Armenian, romanization] — Standard Eastern Armenian. Locale-invariant
// reference content, so it lives in code rather than the translation files
// (same treatment as the vocabulary/pronunciation pages' word lists).
const ONES = [
  [1, "մեկ", "mek"],
  [2, "երկու", "yer-ku"],
  [3, "երեք", "ye-rek'"],
  [4, "չորս", "chors"],
  [5, "հինգ", "hing"],
  [6, "վեց", "vets'"],
  [7, "յոթ", "yot'"],
  [8, "ութ", "ut'"],
  [9, "ինը", "i-nə"],
  [10, "տասը", "ta-sə"],
];

const TEENS = [
  [11, "տասնմեկ", "tasn-mek"],
  [12, "տասներկու", "tasn-yerku"],
  [13, "տասներեք", "tasn-yerek'"],
  [14, "տասնչորս", "tasn-chors"],
  [15, "տասնհինգ", "tasn-hing"],
  [16, "տասնվեց", "tasn-vets'"],
  [17, "տասնյոթ", "tasn-yot'"],
  [18, "տասնութ", "tasn-ut'"],
  [19, "տասնինը", "tasn-inə"],
  [20, "քսան", "k'san"],
];

const TENS = [
  [30, "երեսուն", "ye-re-sun"],
  [40, "քառասուն", "k'a-ra-sun"],
  [50, "հիսուն", "hi-sun"],
  [60, "վաթսուն", "vat'-sun"],
  [70, "յոթանասուն", "yot'-a-na-sun"],
  [80, "ութսուն", "ut'-sun"],
  [90, "իննսուն", "inn-sun"],
  [100, "հարյուր", "har-yur"],
];

// Worked compound examples — the pattern is "ten word + digit word", written
// as one word, so a handful of samples teaches the whole 21–99 range.
const COMPOUNDS = [
  [21, "քսանմեկ", "k'san-mek"],
  [25, "քսանհինգ", "k'san-hing"],
  [42, "քառասուներկու", "k'arasun-yerku"],
  [67, "վաթսունյոթ", "vat'sun-yot'"],
  [99, "իննսունինը", "innsun-inə"],
];

const ORDINALS = [
  ["1st", "առաջին", "a-ra-jin"],
  ["2nd", "երկրորդ", "yerk-rord"],
  ["3rd", "երրորդ", "yer-rord"],
  ["4th", "չորրորդ", "chor-rord"],
  ["5th", "հինգերորդ", "hing-e-rord"],
  ["10th", "տասներորդ", "tasn-e-rord"],
];

function NumberTable({ rows, labelKey }) {
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
      <ul className="divide-y divide-slate-100 dark:divide-white/[0.06]">
        {rows.map(([label, arm, rom]) => (
          <li key={String(label)} className="flex items-baseline gap-4 px-5 py-2.5 text-sm">
            <span className="w-10 shrink-0 font-display font-extrabold tabular-nums text-slate-400 dark:text-stone-500">
              {labelKey === "ordinal" ? label : label}
            </span>
            <span className="flex-1 font-display text-base font-extrabold text-slate-800 dark:text-white">{arm}</span>
            <span className="shrink-0 font-semibold text-slate-500 dark:text-stone-400">{rom}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ArmenianNumbersPage() {
  const navigate = useNavigate();
  const { t } = useTranslation("seoPages");
  const locale = useLocale();
  const lp = (path) => localizedPath(path, locale);

  const sectionTitles = t("armenianNumbers.sectionTitles", { returnObjects: true });
  const faq = t("armenianNumbers.faq", { returnObjects: true });
  const keepGoingCards = t("armenianNumbers.keepGoing.cards", { returnObjects: true });

  const structuredData = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("armenianNumbers.breadcrumb.home"), item: "https://www.haylingua.am/" },
          { "@type": "ListItem", position: 2, name: t("armenianNumbers.breadcrumb.current"), item: "https://www.haylingua.am/armenian-numbers" },
        ],
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: (Array.isArray(faq) ? faq : []).map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale]
  );

  usePageMeta(t("armenianNumbers.meta.title"), t("armenianNumbers.meta.description"), {
    structuredData,
    alternates: SUPPORTED_LOCALES.map((loc) => ({ locale: loc, path: "/armenian-numbers" })).concat([
      { locale: "", path: "/armenian-numbers" },
    ]),
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <SiteNav />

      <main id="main-content">
        <header className="mx-auto max-w-3xl px-5 pb-8 pt-14 text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-5xl">
            {t("armenianNumbers.hero.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-slate-500 dark:text-stone-400">
            {t("armenianNumbers.hero.subtitle")}
          </p>
        </header>

        <section className="mx-auto max-w-4xl px-5 pb-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="mb-3 font-display text-lg font-extrabold text-slate-800 dark:text-white">{sectionTitles.ones}</h2>
              <NumberTable rows={ONES} />
            </div>
            <div>
              <h2 className="mb-3 font-display text-lg font-extrabold text-slate-800 dark:text-white">{sectionTitles.teens}</h2>
              <NumberTable rows={TEENS} />
            </div>
          </div>

          <h2 className="mb-3 mt-8 font-display text-lg font-extrabold text-slate-800 dark:text-white">{sectionTitles.tens}</h2>
          <NumberTable rows={TENS} />

          <h2 className="mb-3 mt-8 font-display text-lg font-extrabold text-slate-800 dark:text-white">{sectionTitles.compounds}</h2>
          <p className="mb-4 text-base font-semibold leading-relaxed text-slate-600 dark:text-stone-300">
            {t("armenianNumbers.compoundsNote")}
          </p>
          <NumberTable rows={COMPOUNDS} />

          <h2 className="mb-3 mt-8 font-display text-lg font-extrabold text-slate-800 dark:text-white">{sectionTitles.ordinals}</h2>
          <p className="mb-4 text-base font-semibold leading-relaxed text-slate-600 dark:text-stone-300">
            {t("armenianNumbers.ordinalsNote")}
          </p>
          <NumberTable rows={ORDINALS} labelKey="ordinal" />
        </section>

        <section className="mx-auto max-w-3xl px-5 pb-16">
          <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
            {t("armenianNumbers.faqHeading")}
          </h2>
          <div className="mt-6 space-y-4">
            {(Array.isArray(faq) ? faq : []).map((f) => (
              <div key={f.q} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{f.q}</div>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500 dark:text-stone-400">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-slate-100 bg-slate-50 px-5 py-14 dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              {t("armenianNumbers.keepGoing.heading")}
            </h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <Link to={lp("/armenian-vocabulary")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{keepGoingCards[0].title}</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{keepGoingCards[0].text}</p>
              </Link>
              <Link to={lp("/armenian-alphabet")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{keepGoingCards[1].title}</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{keepGoingCards[1].text}</p>
              </Link>
              <Link to={lp("/armenian-pronunciation")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{keepGoingCards[2].title}</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{keepGoingCards[2].text}</p>
              </Link>
            </div>
          </div>
        </section>

        <section className="px-5 py-16">
          <div className="relative mx-auto flex max-w-5xl flex-col items-center overflow-hidden rounded-[2rem] bg-brand-500 px-6 py-14 text-center text-white shadow-btn-brand">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t("armenianNumbers.cta.heading")}</h2>
            <p className="mt-3 max-w-md text-lg font-semibold text-white/90">{t("armenianNumbers.cta.subtext")}</p>
            <button onClick={() => navigate(lp("/"))} className="btn3d mt-7 bg-white !text-brand-600 shadow-[0_4px_0_0_#B84B00] text-base uppercase hover:brightness-100">
              {t("armenianNumbers.cta.button")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </button>
          </div>
        </section>

        <RelatedBlogPosts tags={PATH_TO_TAGS["/armenian-numbers"]} />
      </main>

      <SiteFooter />
    </div>
  );
}
