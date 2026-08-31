// src/EasternArmenianPage.jsx — public, unauthenticated SEO landing page
// explaining Eastern vs. Western Armenian and what Haylingua teaches.
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, X } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";
import { useLocale, localizedPath, SUPPORTED_LOCALES } from "./i18n";

export default function EasternArmenianPage() {
  const navigate = useNavigate();
  const { t } = useTranslation("seoPages");
  const locale = useLocale();
  const lp = (path) => localizedPath(path, locale);

  const FAQ = t("easternArmenian.faq", { returnObjects: true });
  const easternItems = t("easternArmenian.comparison.eastern.items", { returnObjects: true });
  const westernItems = t("easternArmenian.comparison.western.items", { returnObjects: true });
  const keepGoingCards = t("easternArmenian.keepGoing.cards", { returnObjects: true });
  const [noteBefore, noteAfter] = t("easternArmenian.note").split("{{link}}");

  const structuredData = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("easternArmenian.breadcrumb.home"), item: "https://www.haylingua.am/" },
          { "@type": "ListItem", position: 2, name: t("easternArmenian.breadcrumb.current"), item: "https://www.haylingua.am/eastern-armenian" },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale]
  );

  usePageMeta(
    t("easternArmenian.meta.title"),
    t("easternArmenian.meta.description"),
    {
      structuredData,
      alternates: SUPPORTED_LOCALES.map((loc) => ({ locale: loc, path: "/eastern-armenian" })).concat([
        { locale: "", path: "/eastern-armenian" },
      ]),
    }
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <SiteNav />

      <main>
        <header className="mx-auto max-w-3xl px-5 pb-8 pt-14 text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-5xl">
            {t("easternArmenian.hero.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-slate-500 dark:text-stone-400">
            {t("easternArmenian.hero.subtitle")}
          </p>
        </header>

        <section className="mx-auto max-w-3xl px-5 pb-16">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
            <h2 className="font-display text-xl font-extrabold text-slate-800 dark:text-white">{t("easternArmenian.comparison.heading")}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-brand-50 p-4 dark:bg-brand-500/10">
                <div className="flex items-center gap-2 font-display font-extrabold text-brand-700 dark:text-brand-400">
                  <Check className="h-4 w-4" /> {t("easternArmenian.comparison.eastern.label")}
                </div>
                <ul className="mt-2 space-y-1.5 text-sm font-semibold text-slate-600 dark:text-stone-300">
                  {easternItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/[0.04]">
                <div className="flex items-center gap-2 font-display font-extrabold text-slate-600 dark:text-stone-300">
                  <X className="h-4 w-4" /> {t("easternArmenian.comparison.western.label")}
                </div>
                <ul className="mt-2 space-y-1.5 text-sm font-semibold text-slate-500 dark:text-stone-400">
                  {westernItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-stone-400">
              {noteBefore}
              <Link to={lp("/armenian-pronunciation")} className="font-bold text-brand-600 hover:underline dark:text-brand-400">{t("easternArmenian.noteLinkText")}</Link>
              {noteAfter}
            </p>
          </div>
        </section>

        <section className="border-t border-slate-100 bg-slate-50 px-5 py-16 dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              {t("easternArmenian.faqHeading")}
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
              {t("easternArmenian.keepGoing.heading")}
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
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t("easternArmenian.cta.heading")}</h2>
            <p className="mt-3 max-w-md text-lg font-semibold text-white/90">
              {t("easternArmenian.cta.subtext")}
            </p>
            <button onClick={() => navigate(lp("/"))} className="btn3d mt-7 bg-white !text-brand-600 shadow-[0_4px_0_0_#B84B00] text-base uppercase hover:brightness-100">
              {t("easternArmenian.cta.button")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
