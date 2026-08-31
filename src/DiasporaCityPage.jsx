// src/DiasporaCityPage.jsx — public, unauthenticated SEO landing pages for
// major Armenian diaspora hubs ("Learn Armenian in Los Angeles" etc.). One
// reusable component driven by a `city` key into
// src/i18n/locales/{locale}/diaspora-pages.json — the structure is identical
// across cities, only the content differs, so a single parameterized
// component avoids duplicating the same JSX 7 times. Each city's page is
// registered at its own literal path in App.jsx (not a dynamic :city param)
// so every page gets a clean, static-feeling URL and its own hreflang set.
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, MapPin, Landmark, MessageCircleHeart } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";
import { useLocale, localizedPath, SUPPORTED_LOCALES } from "./i18n";

export default function DiasporaCityPage({ city, path }) {
  const navigate = useNavigate();
  const { t } = useTranslation("diasporaPages");
  const locale = useLocale();
  const lp = (p) => localizedPath(p, locale);

  const c = (key) => `${city}.${key}`;
  const landmarks = t(c("community.landmarks"), { returnObjects: true });
  const FAQ = t(c("faq"), { returnObjects: true });
  const keepGoingCards = t(c("keepGoing.cards"), { returnObjects: true });

  const structuredData = useMemo(
    () => [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t(c("breadcrumb.home")), item: "https://www.haylingua.am/" },
          { "@type": "ListItem", position: 2, name: t(c("breadcrumb.current")), item: `https://www.haylingua.am${path}` },
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
    [locale, city]
  );

  usePageMeta(t(c("meta.title")), t(c("meta.description")), {
    // No `path` option here — canonical must reflect the CURRENT locale-
    // prefixed URL, so it's left to default to window.location.pathname
    // (matching every other translated SEO page's usePageMeta call). `path`
    // (the unprefixed base path) is only used below to build the alternates
    // list, where localizedPath() re-prefixes it per locale internally.
    structuredData,
    alternates: SUPPORTED_LOCALES.map((loc) => ({ locale: loc, path })).concat([{ locale: "", path }]),
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <SiteNav />

      <main>
        <header className="mx-auto max-w-3xl px-5 pb-8 pt-14 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <MapPin className="h-3.5 w-3.5" /> {t(c("hero.eyebrow"))}
          </div>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-5xl">
            {t(c("hero.title"))}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-slate-500 dark:text-stone-400">
            {t(c("hero.subtitle"))}
          </p>
          <button onClick={() => navigate(lp("/"))} className="btn3d btn3d-brand mt-6 text-sm uppercase">
            {t(c("hero.cta"))} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </button>
        </header>

        {/* Community & culture */}
        <section className="mx-auto max-w-4xl px-5 pb-16">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08] sm:p-8">
            <div className="flex items-center gap-2 font-display text-xl font-extrabold text-slate-800 dark:text-white">
              <Landmark className="h-5 w-5 text-brand-500" /> {t(c("community.heading"))}
            </div>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600 dark:text-stone-300">
              {t(c("community.intro"))}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {landmarks.map((l) => (
                <div key={l.title} className="rounded-2xl bg-slate-50 p-4 dark:bg-white/[0.04]">
                  <div className="text-sm font-extrabold text-slate-800 dark:text-white">{l.title}</div>
                  <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{l.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why learn Armenian here */}
        <section className="border-t border-slate-100 bg-slate-50 px-5 py-16 dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
              <MessageCircleHeart className="h-5 w-5" />
            </div>
            <h2 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              {t(c("whyLearn.heading"))}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-slate-600 dark:text-stone-300">
              {t(c("whyLearn.text"))}
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-5 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              {t(c("faqHeading"))}
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

        {/* Keep going */}
        <section className="border-t border-slate-100 bg-slate-50 px-5 py-14 dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              {t(c("keepGoing.heading"))}
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
              <Link to={lp("/learn-armenian-online")} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{keepGoingCards[2].title}</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{keepGoingCards[2].text}</p>
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 py-16">
          <div className="relative mx-auto flex max-w-5xl flex-col items-center overflow-hidden rounded-[2rem] bg-brand-500 px-6 py-14 text-center text-white shadow-btn-brand">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t(c("cta.heading"))}</h2>
            <p className="mt-3 max-w-md text-lg font-semibold text-white/90">{t(c("cta.subtext"))}</p>
            <button onClick={() => navigate(lp("/"))} className="btn3d mt-7 bg-white !text-brand-600 shadow-[0_4px_0_0_#B84B00] text-base uppercase hover:brightness-100">
              {t(c("cta.button"))} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
