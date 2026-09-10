// src/ArmenianKeyboardPage.jsx — "how do I get an Armenian keyboard on this
// device", the setup guide behind the /armenian-keyboard query cluster.
//
// WHY THIS PAGE IS ORGANISED AROUND LAYOUT CHOICE, NOT STEPS: the OS steps
// are the easy half and every blog already has them. The half people get
// wrong is *which* Armenian layout to enable — the systems don't agree on
// naming, and "phonetic", the thing people actually search for, is not what
// the option is called on any of them. macOS offers only "Armenian — HM
// QWERTY" and "Armenian — Western QWERTY" (verified against
// /System/Library/Keyboard Layouts on a real machine, which ships exactly
// those two); Windows says "Armenian Phonetic" / "Armenian Typewriter";
// iOS just says "Armenian" and gives you one layout with no choice at all.
// Someone who picks Typewriter because it sounds official ends up with a
// layout that shares nothing with the keys our typing trainer teaches.
//
// So: the platform steps are present and precise, but the layout section is
// the one doing the real work, and it's what everything else links back to.
//
// The mini layout diagram reuses LAYOUT from lib/armenianKeyboard.js, the
// same source the typing trainer drills from — so the picture on this page
// cannot drift from the keys the lessons teach. Read the confidence note at
// the top of that file before changing any key.
import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Apple, Monitor, Smartphone, Tablet, Chrome, Terminal } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";
import RelatedBlogPosts from "./lib/RelatedBlogPosts";
import { PATH_TO_TAGS } from "./lib/blogTopics";
import { useLocale, localizedPath, SUPPORTED_LOCALES } from "./i18n";
import { LAYOUT, ROW_ORDER } from "./lib/armenianKeyboard";

const PATH = "/armenian-keyboard";

// Platform order is deliberate: phone first. "How do I type Armenian" is
// most often asked by someone holding the message they can't reply to.
const PLATFORMS = [
  { key: "ios", icon: Smartphone, steps: 5 },
  { key: "android", icon: Tablet, steps: 5 },
  { key: "macos", icon: Apple, steps: 5 },
  { key: "windows", icon: Monitor, steps: 5 },
  { key: "chromeos", icon: Chrome, steps: 4 },
  { key: "linux", icon: Terminal, steps: 4 },
];

function MiniKeyboard() {
  return (
    <div className="overflow-x-auto">
      <div className="mx-auto inline-block min-w-max rounded-2xl bg-slate-900 p-3 dark:bg-black/40">
        {ROW_ORDER.map((row) => (
          <div key={row} className="flex justify-center gap-1.5 py-0.5">
            {LAYOUT[row].map(([latin, arm]) => (
              <div
                key={latin}
                className={`flex h-11 w-11 flex-col items-center justify-center rounded-lg ${
                  arm ? "bg-white/[0.08]" : "bg-white/[0.03]"
                }`}
              >
                <span className="text-[10px] font-bold uppercase text-stone-500">{latin}</span>
                <span className="font-display text-base font-extrabold text-brand-400">{arm || "·"}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ArmenianKeyboardPage() {
  const { t } = useTranslation("seoPages");
  const locale = useLocale();
  const navigate = useNavigate();
  const lp = useCallback((p) => localizedPath(p, locale), [locale]);
  const [platform, setPlatform] = useState("ios");

  const rows = useCallback((key) => {
    const v = t(key, { returnObjects: true });
    return Array.isArray(v) ? v : [];
  }, [t]);

  const faq = useMemo(() => rows("armenianKeyboard.faq"), [rows]);
  const layouts = useMemo(() => rows("armenianKeyboard.layouts.items"), [rows]);
  const active = PLATFORMS.find((p) => p.key === platform) || PLATFORMS[0];
  const steps = useMemo(() => rows(`armenianKeyboard.platforms.${platform}.steps`), [rows, platform]);

  usePageMeta(t("armenianKeyboard.meta.title"), t("armenianKeyboard.meta.description"), {
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: t("armenianKeyboard.breadcrumb.home"), item: "https://www.haylingua.am/" },
          { "@type": "ListItem", position: 2, name: t("armenianKeyboard.breadcrumb.current"), item: `https://www.haylingua.am${PATH}` },
        ],
      },
      // HowTo for the currently selected platform. Emitted per-platform
      // rather than one giant HowTo because they're genuinely different
      // procedures, and a HowTo whose steps span six operating systems
      // describes nothing a user could follow.
      {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: t(`armenianKeyboard.platforms.${platform}.title`),
        step: steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: s })),
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question", name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
    alternates: SUPPORTED_LOCALES.map((loc) => ({ locale: loc, path: PATH })).concat([{ locale: "", path: PATH }]),
  });

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f0f11]">
      <SiteNav />
      <main>
        <section className="px-5 pb-8 pt-12 sm:pt-16">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-4xl">
              {t("armenianKeyboard.hero.heading")}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-base font-semibold text-slate-500 dark:text-stone-400">
              {t("armenianKeyboard.hero.subtext")}
            </p>
            <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-slate-400 dark:text-stone-500">
              {t("armenianKeyboard.hero.note")}
            </p>
          </div>

          {/* Platform picker */}
          <div className="mx-auto mt-8 max-w-3xl">
            <div className="flex flex-wrap justify-center gap-2">
              {PLATFORMS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPlatform(p.key)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-extrabold transition ${
                      platform === p.key
                        ? "bg-brand-500 text-white shadow-btn-brand"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/[0.06] dark:text-stone-300 dark:hover:bg-white/[0.1]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t(`armenianKeyboard.platforms.${p.key}.name`)}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08] sm:p-8">
              <h2 className="font-display text-xl font-extrabold text-slate-800 dark:text-white">
                {t(`armenianKeyboard.platforms.${platform}.title`)}
              </h2>
              <ol className="mt-5 space-y-3.5">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-3.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-extrabold text-white tabular-nums">
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold leading-relaxed text-slate-600 dark:text-stone-300">{s}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-6 rounded-2xl bg-brand-50 px-4 py-3.5 dark:bg-brand-500/10">
                <div className="text-xs font-extrabold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                  {t("armenianKeyboard.switchLabel")}
                </div>
                <p className="mt-1 text-sm font-bold text-brand-700 dark:text-brand-300">
                  {t(`armenianKeyboard.platforms.${platform}.switch`)}
                </p>
              </div>
              <p className="mt-4 text-xs font-semibold text-slate-400 dark:text-stone-500">
                {t(`armenianKeyboard.platforms.${platform}.caveat`)}
              </p>
            </div>
          </div>
        </section>

        {/* ---------- Which layout ---------- */}
        <section className="border-t border-slate-100 bg-slate-50 px-5 py-14 dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              {t("armenianKeyboard.layouts.heading")}
            </h2>
            <p className="mt-4 text-base font-semibold leading-relaxed text-slate-600 dark:text-stone-300">
              {t("armenianKeyboard.layouts.intro")}
            </p>
            <div className="mt-6 space-y-4">
              {layouts.map((l, i) => (
                <div key={i} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-display text-base font-extrabold text-slate-800 dark:text-white">{l.name}</span>
                    <span className="text-xs font-bold uppercase tracking-wide text-brand-600 dark:text-brand-400">{l.aka}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold leading-relaxed text-slate-500 dark:text-stone-400">{l.text}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 rounded-2xl bg-brand-50 px-5 py-4 text-sm font-bold leading-relaxed text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
              {t("armenianKeyboard.layouts.recommendation")}
            </p>
          </div>
        </section>

        {/* ---------- The layout itself ---------- */}
        <section className="border-t border-slate-100 px-5 py-14 dark:border-white/[0.06]">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              {t("armenianKeyboard.map.heading")}
            </h2>
            <p className="mt-3 text-base font-semibold leading-relaxed text-slate-600 dark:text-stone-300">
              {t("armenianKeyboard.map.text")}
            </p>
            <div className="mt-6"><MiniKeyboard /></div>
            <p className="mt-3 text-xs font-semibold text-slate-400 dark:text-stone-500">
              {t("armenianKeyboard.map.caption")}
            </p>
            <Link to={lp("/armenian-typing")} className="btn3d mt-6 bg-brand-500 text-white shadow-btn-brand">
              {t("armenianKeyboard.map.cta")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </Link>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section className="border-t border-slate-100 bg-slate-50 px-5 py-14 dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
              {t("armenianKeyboard.faqHeading")}
            </h2>
            <div className="mt-7 space-y-3">
              {faq.map((f, i) => (
                <details key={i} className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]">
                  <summary className="cursor-pointer list-none font-display text-base font-extrabold text-slate-800 dark:text-white">{f.q}</summary>
                  <p className="mt-2.5 text-sm font-semibold leading-relaxed text-slate-500 dark:text-stone-400">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-14">
          <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
            {[["/armenian-typing", "typing"], ["/armenian-text-to-speech", "reader"], ["/armenian-alphabet", "alphabet"]].map(([to, key]) => (
              <Link key={key} to={lp(to)} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]">
                <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{t(`armenianKeyboard.keepGoing.${key}.title`)}</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">{t(`armenianKeyboard.keepGoing.${key}.text`)}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="px-5 pb-16">
          <div className="relative mx-auto flex max-w-5xl flex-col items-center overflow-hidden rounded-[2rem] bg-brand-500 px-6 py-14 text-center text-white shadow-btn-brand">
            <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t("armenianKeyboard.cta.heading")}</h2>
            <p className="mt-3 max-w-md text-lg font-semibold text-white/90">{t("armenianKeyboard.cta.subtext")}</p>
            <button onClick={() => navigate(lp("/"))} className="btn3d mt-7 bg-white !text-brand-600 shadow-[0_4px_0_0_#B84B00] text-base uppercase hover:brightness-100">
              {t("armenianKeyboard.cta.button")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </button>
          </div>
        </section>

        <RelatedBlogPosts tags={PATH_TO_TAGS["/armenian-alphabet"]} />
      </main>
      <SiteFooter />
    </div>
  );
}
