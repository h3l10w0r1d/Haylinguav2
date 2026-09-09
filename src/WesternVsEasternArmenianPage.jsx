// src/WesternVsEasternArmenianPage.jsx — public, unauthenticated SEO landing
// page: head-to-head comparison of the two standard forms of modern Armenian,
// targeting the "western vs eastern armenian" / "which armenian should I
// learn" query cluster.
//
// Deliberately distinct from EasternArmenianPage.jsx: that page explains what
// Eastern Armenian is (and what we teach); this one is the decision-making
// comparison, and the two cross-link rather than repeat each other.
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

// [written form, Eastern pronunciation, Western pronunciation, English] —
// the same spelling read aloud both ways, which is the clearest way to show
// the consonant correspondence without a phonology lecture.
const SOUND_SHIFT = [
  ["բարև", "ba-rev", "pa-rev", "hello"],
  ["դուռ", "dur", "tur", "door"],
  ["գիրք", "girk'", "kirk'", "book"],
  ["գինի", "gi-ni", "ki-ni", "wine"],
  ["բան", "ban", "pan", "thing"],
  ["Դավիթ", "Da-vit'", "Ta-vit'", "David"],
];

// Renders **bold** spans from a translated string without pulling a markdown
// dependency into this chunk for three list items.
function WithBold({ text }) {
  const parts = String(text).split("**");
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <strong key={i} className="font-extrabold text-slate-800 dark:text-white">{part}</strong> : <span key={i}>{part}</span>))}
    </>
  );
}

export default function WesternVsEasternArmenianPage() {
  const navigate = useNavigate();
  const { t } = useTranslation("seoPages");
  const locale = useLocale();
  const lp = (path) => localizedPath(path, locale);

  const tableHeaders = t("westernVsEastern.tableHeaders", { returnObjects: true });
  const comparisonRows = t("westernVsEastern.comparisonRows", { returnObjects: true });
  const shiftHeaders = t("westernVsEastern.soundShiftTableHeaders", { returnObjects: true });
  const whichPoints = t("westernVsEastern.whichToLearnPoints", { returnObjects: true });
  const faq = t("westernVsEastern.faq", { returnObjects: true });
  const keepGoingCards = t("westernVsEastern.keepGoing.cards", { returnObjects: true });

  const structuredData = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("westernVsEastern.breadcrumb.home"), item: "https://www.haylingua.am/" },
          { "@type": "ListItem", position: 2, name: t("westernVsEastern.breadcrumb.current"), item: "https://www.haylingua.am/western-vs-eastern-armenian" },
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

  usePageMeta(t("westernVsEastern.meta.title"), t("westernVsEastern.meta.description"), {
    structuredData,
    alternates: SUPPORTED_LOCALES.map((loc) => ({ locale: loc, path: "/western-vs-eastern-armenian" })).concat([
      { locale: "", path: "/western-vs-eastern-armenian" },
    ]),
  });

  const cellCls = "px-4 py-3 text-sm font-semibold text-slate-600 dark:text-stone-300";
  const headCls = "px-4 py-3 text-start font-display text-sm font-extrabold text-slate-700 dark:text-stone-200";

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <SiteNav />

      <main id="main-content">
        <header className="mx-auto max-w-3xl px-5 pb-8 pt-14 text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-5xl">
            {t("westernVsEastern.hero.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-slate-500 dark:text-stone-400">
            {t("westernVsEastern.hero.subtitle")}
          </p>
        </header>

        <section className="mx-auto max-w-3xl px-5 pb-10">
          <h2 className="font-display text-2xl font-extrabold text-slate-800 dark:text-white">{t("westernVsEastern.introHeading")}</h2>
          <p className="mt-3 text-base font-semibold leading-relaxed text-slate-600 dark:text-stone-300">
            {t("westernVsEastern.intro")}
          </p>
        </section>

        <section className="mx-auto max-w-4xl px-5 pb-10">
          <h2 className="mb-4 font-display text-2xl font-extrabold text-slate-800 dark:text-white">{t("westernVsEastern.tableHeading")}</h2>
          <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
            <table className="w-full min-w-[36rem] border-collapse">
              <thead className="bg-slate-50 dark:bg-white/[0.04]">
                <tr>
                  <th className={headCls}>{tableHeaders.feature}</th>
                  <th className={headCls}>{tableHeaders.eastern}</th>
                  <th className={headCls}>{tableHeaders.western}</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(comparisonRows) ? comparisonRows : []).map((row) => (
                  <tr key={row.feature} className="border-t border-slate-100 dark:border-white/[0.06]">
                    <td className={headCls}>{row.feature}</td>
                    <td className={cellCls}>{row.eastern}</td>
                    <td className={cellCls}>{row.western}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 pb-10">
          <h2 className="font-display text-2xl font-extrabold text-slate-800 dark:text-white">{t("westernVsEastern.soundShiftHeading")}</h2>
          <p className="mb-4 mt-3 text-base font-semibold leading-relaxed text-slate-600 dark:text-stone-300">
            {t("westernVsEastern.soundShift")}
          </p>
          <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
            <table className="w-full min-w-[32rem] border-collapse">
              <thead className="bg-slate-50 dark:bg-white/[0.04]">
                <tr>
                  <th className={headCls}>{shiftHeaders.written}</th>
                  <th className={headCls}>{shiftHeaders.eastern}</th>
                  <th className={headCls}>{shiftHeaders.western}</th>
                  <th className={headCls}>{shiftHeaders.meaning}</th>
                </tr>
              </thead>
              <tbody>
                {SOUND_SHIFT.map(([written, east, west, meaning]) => (
                  <tr key={written} className="border-t border-slate-100 dark:border-white/[0.06]">
                    <td className="px-4 py-3 font-display text-base font-extrabold text-slate-800 dark:text-white">{written}</td>
                    <td className={cellCls}>{east}</td>
                    <td className={cellCls}>{west}</td>
                    <td className={cellCls}>{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 pb-10">
          <h2 className="font-display text-2xl font-extrabold text-slate-800 dark:text-white">{t("westernVsEastern.whichToLearnHeading")}</h2>
          <p className="mt-3 text-base font-semibold leading-relaxed text-slate-600 dark:text-stone-300">
            {t("westernVsEastern.whichToLearnIntro")}
          </p>
          <ul className="mt-4 space-y-3">
            {(Array.isArray(whichPoints) ? whichPoints : []).map((point, i) => (
              <li key={i} className="rounded-2xl bg-white p-5 text-sm font-semibold leading-relaxed text-slate-600 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:text-stone-300 dark:ring-white/[0.08]">
                <WithBold text={point} />
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-2xl bg-brand-50 p-6 dark:bg-brand-500/10">
            <h3 className="font-display text-lg font-extrabold text-slate-800 dark:text-white">{t("westernVsEastern.whatWeTeachHeading")}</h3>
            <p className="mt-2 font-semibold leading-relaxed text-slate-600 dark:text-stone-300">
              {t("westernVsEastern.whatWeTeach")}
            </p>
            <Link to={lp("/eastern-armenian")} className="mt-3 inline-block font-extrabold text-brand-700 hover:underline dark:text-brand-400">
              {t("westernVsEastern.whatWeTeachLinkText")}
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 pb-16">
          <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
            {t("westernVsEastern.faqHeading")}
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
              {t("westernVsEastern.keepGoing.heading")}
            </h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <Link to={lp("/eastern-armenian")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
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
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t("westernVsEastern.cta.heading")}</h2>
            <p className="mt-3 max-w-md text-lg font-semibold text-white/90">{t("westernVsEastern.cta.subtext")}</p>
            <button onClick={() => navigate(lp("/"))} className="btn3d mt-7 bg-white !text-brand-600 shadow-[0_4px_0_0_#B84B00] text-base uppercase hover:brightness-100">
              {t("westernVsEastern.cta.button")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </button>
          </div>
        </section>

        <RelatedBlogPosts tags={PATH_TO_TAGS["/western-vs-eastern-armenian"]} />
      </main>

      <SiteFooter />
    </div>
  );
}
