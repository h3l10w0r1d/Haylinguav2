// src/LearnArmenianOnlinePage.jsx — public, unauthenticated SEO landing page:
// the broad "learn Armenian online" intent, explaining how Haylingua's course
// works end to end and funneling into signup.
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, BookOpen, Volume2, Flame, Users, CheckCircle2 } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";
import { useLocale, localizedPath, SUPPORTED_LOCALES } from "./i18n";

const STEP_ICONS = [BookOpen, Volume2, Flame, Users];

export default function LearnArmenianOnlinePage() {
  const navigate = useNavigate();
  const { t } = useTranslation("seoPages");
  const locale = useLocale();
  const lp = (path) => localizedPath(path, locale);

  const STEPS = t("learnArmenianOnline.steps", { returnObjects: true });
  const WHY = t("learnArmenianOnline.why.items", { returnObjects: true });
  const whereToStartCards = t("learnArmenianOnline.whereToStart.cards", { returnObjects: true });

  const structuredData = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("learnArmenianOnline.breadcrumb.home"), item: "https://www.haylingua.am/" },
          { "@type": "ListItem", position: 2, name: t("learnArmenianOnline.breadcrumb.current"), item: "https://www.haylingua.am/learn-armenian-online" },
        ],
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale]
  );

  usePageMeta(
    t("learnArmenianOnline.meta.title"),
    t("learnArmenianOnline.meta.description"),
    {
      structuredData,
      alternates: SUPPORTED_LOCALES.map((loc) => ({ locale: loc, path: "/learn-armenian-online" })).concat([
        { locale: "", path: "/learn-armenian-online" },
      ]),
    }
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <SiteNav />

      <main>
        <header className="mx-auto max-w-3xl px-5 pb-8 pt-14 text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-5xl">
            {t("learnArmenianOnline.hero.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-slate-500 dark:text-stone-400">
            {t("learnArmenianOnline.hero.subtitle")}
          </p>
          <button onClick={() => navigate(lp("/"))} className="btn3d btn3d-brand mt-6 text-sm uppercase">
            {t("learnArmenianOnline.hero.cta")} <ArrowRight className="h-4 w-4" />
          </button>
        </header>

        <section className="mx-auto max-w-5xl px-5 pb-16">
          <div className="grid gap-5 sm:grid-cols-2">
            {STEPS.map((s, i) => {
              const Icon = STEP_ICONS[i];
              return (
                <div key={s.title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-3 font-display text-lg font-extrabold text-slate-800 dark:text-white">{s.title}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{s.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-t border-slate-100 bg-slate-50 px-5 py-16 dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              {t("learnArmenianOnline.why.heading")}
            </h2>
            <ul className="mt-6 space-y-3">
              {WHY.map((w) => (
                <li key={w} className="flex items-start gap-3 text-sm font-semibold text-slate-600 dark:text-stone-300">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-grass-500" />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="px-5 py-14">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              {t("learnArmenianOnline.whereToStart.heading")}
            </h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <Link to={lp("/armenian-alphabet")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{whereToStartCards[0].title}</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{whereToStartCards[0].text}</p>
              </Link>
              <Link to={lp("/armenian-pronunciation")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{whereToStartCards[1].title}</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{whereToStartCards[1].text}</p>
              </Link>
              <Link to={lp("/armenian-vocabulary")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{whereToStartCards[2].title}</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{whereToStartCards[2].text}</p>
              </Link>
            </div>
          </div>
        </section>

        <section className="px-5 py-16">
          <div className="relative mx-auto flex max-w-5xl flex-col items-center overflow-hidden rounded-[2rem] bg-brand-500 px-6 py-14 text-center text-white shadow-btn-brand">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t("learnArmenianOnline.cta.heading")}</h2>
            <p className="mt-3 max-w-md text-lg font-semibold text-white/90">
              {t("learnArmenianOnline.cta.subtext")}
            </p>
            <button onClick={() => navigate(lp("/"))} className="btn3d mt-7 bg-white !text-brand-600 shadow-[0_4px_0_0_#B84B00] text-base uppercase hover:brightness-100">
              {t("learnArmenianOnline.cta.button")} <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
