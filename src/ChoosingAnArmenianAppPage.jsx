// src/ChoosingAnArmenianAppPage.jsx — public, unauthenticated SEO landing
// page for the "best armenian learning app" commercial-intent cluster.
//
// Deliberately framed as a criteria guide rather than a scored vendor
// comparison table. Two reasons: (1) the seeded blog post
// "best-armenian-learning-apps-2026" already covers the same intent in
// article form, and a near-identical page would cannibalise it — this one
// differentiates by being the structured decision checklist and links to
// the article rather than repeating it; (2) hard claims about competitors'
// current feature sets and pricing go stale fast and we can't verify them
// continuously, so the page argues from criteria the reader can check
// themselves instead of asserting facts about other companies.
//
// The self-disclosure (choosingAnApp.disclosure) is deliberate and should
// stay: this is our own product recommending itself, and saying so plainly
// is both the honest thing and what Google's guidance on such pages expects.
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Info } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";
import RelatedBlogPosts from "./lib/RelatedBlogPosts";
import { PATH_TO_TAGS } from "./lib/blogTopics";
import { useLocale, localizedPath, SUPPORTED_LOCALES } from "./i18n";

export default function ChoosingAnArmenianAppPage() {
  const navigate = useNavigate();
  const { t } = useTranslation("seoPages");
  const locale = useLocale();
  const lp = (path) => localizedPath(path, locale);

  const criteria = t("choosingAnApp.criteria", { returnObjects: true });
  const faq = t("choosingAnApp.faq", { returnObjects: true });
  const keepGoingCards = t("choosingAnApp.keepGoing.cards", { returnObjects: true });

  const structuredData = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("choosingAnApp.breadcrumb.home"), item: "https://www.haylingua.am/" },
          { "@type": "ListItem", position: 2, name: t("choosingAnApp.breadcrumb.current"), item: "https://www.haylingua.am/best-armenian-learning-apps" },
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

  usePageMeta(t("choosingAnApp.meta.title"), t("choosingAnApp.meta.description"), {
    structuredData,
    alternates: SUPPORTED_LOCALES.map((loc) => ({ locale: loc, path: "/best-armenian-learning-apps" })).concat([
      { locale: "", path: "/best-armenian-learning-apps" },
    ]),
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <SiteNav />

      <main id="main-content">
        <header className="mx-auto max-w-3xl px-5 pb-6 pt-14 text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-5xl">
            {t("choosingAnApp.hero.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-slate-500 dark:text-stone-400">
            {t("choosingAnApp.hero.subtitle")}
          </p>
        </header>

        <section className="mx-auto max-w-3xl px-5 pb-10">
          <div className="flex items-start gap-3 rounded-2xl bg-slate-100 p-5 dark:bg-white/[0.06]">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-400 dark:text-stone-500" />
            <p className="text-sm font-semibold leading-relaxed text-slate-600 dark:text-stone-300">
              {t("choosingAnApp.disclosure")}
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 pb-12">
          <h2 className="mb-6 text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
            {t("choosingAnApp.criteriaHeading")}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {(Array.isArray(criteria) ? criteria : []).map((c, i) => (
              <div key={c.title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="mb-3 grid h-8 w-8 place-items-center rounded-xl bg-brand-50 font-display text-sm font-extrabold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                  {i + 1}
                </div>
                <h3 className="font-display text-base font-extrabold text-slate-800 dark:text-white">{c.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500 dark:text-stone-400">{c.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 pb-16">
          <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
            {t("choosingAnApp.faqHeading")}
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
              {t("choosingAnApp.keepGoing.heading")}
            </h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <Link to={lp("/learn-armenian-online")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{keepGoingCards[0].title}</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{keepGoingCards[0].text}</p>
              </Link>
              <Link to={lp("/western-vs-eastern-armenian")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{keepGoingCards[1].title}</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{keepGoingCards[1].text}</p>
              </Link>
              <Link to={lp("/armenian-alphabet")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{keepGoingCards[2].title}</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{keepGoingCards[2].text}</p>
              </Link>
            </div>
          </div>
        </section>

        <section className="px-5 py-16">
          <div className="relative mx-auto flex max-w-5xl flex-col items-center overflow-hidden rounded-[2rem] bg-brand-500 px-6 py-14 text-center text-white shadow-btn-brand">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t("choosingAnApp.cta.heading")}</h2>
            <p className="mt-3 max-w-md text-lg font-semibold text-white/90">{t("choosingAnApp.cta.subtext")}</p>
            <button onClick={() => navigate(lp("/"))} className="btn3d mt-7 bg-white !text-brand-600 shadow-[0_4px_0_0_#B84B00] text-base uppercase hover:brightness-100">
              {t("choosingAnApp.cta.button")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </button>
          </div>
        </section>

        <RelatedBlogPosts tags={PATH_TO_TAGS["/best-armenian-learning-apps"]} />
      </main>

      <SiteFooter />
    </div>
  );
}
