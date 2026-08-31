// src/PricingPage.jsx — public pricing page. Plans are fetched live from the
// same GET /premium/plans endpoint Premium.jsx uses, so this page can never
// drift from what's actually configured in the CMS (/cms/premium).
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight, Check, X, Star, Infinity as InfinityIcon, Sparkles,
  Heart, Zap, Repeat2, Trophy, ShieldCheck, Loader2,
} from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";
import { useLocale, localizedPath, SUPPORTED_LOCALES, renderTemplate } from "./i18n";

gsap.registerPlugin(ScrollTrigger);

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
const CURRENCY_PREFIX = { AMD: "֏", USD: "$", EUR: "€" };
function formatPrice(price, currency) {
  const prefix = CURRENCY_PREFIX[currency] || (currency ? `${currency} ` : "");
  return `${prefix}${Number(price || 0).toLocaleString()}`;
}

// The feature matrix — a fixed, honest comparison. Premium columns apply to
// every fetched plan (Monthly/Annual/etc. all unlock the same feature set
// today; only price/interval differ), so we render one "Premium" column.
const MATRIX_ICONS = [Heart, Zap, Repeat2, Trophy, ShieldCheck, Sparkles];

// Splits a translated string on the literal "{{link}}" token and inlines a
// real <Link> element in its place — renderTemplate only substitutes plain
// text, so a clickable element needs this instead.
function splitAroundToken(str, linkNode, token = "{{link}}") {
  const [before, after] = str.split(token);
  return (
    <>
      {before}
      {linkNode}
      {after}
    </>
  );
}

function Cell({ v }) {
  if (v === true) return <Check className="mx-auto h-5 w-5 text-grass-500" />;
  if (v === false) return <X className="mx-auto h-5 w-5 text-slate-300 dark:text-stone-700" />;
  return <span className="text-sm font-semibold text-slate-600 dark:text-stone-300">{v}</span>;
}

export default function PricingPage() {
  const { t } = useTranslation("sitePages");
  const locale = useLocale();
  const lp = (path) => localizedPath(path, locale);

  const INTERVAL_LABEL = t("pricing.intervalLabels", { returnObjects: true });
  const FREE = t("pricing.free", { returnObjects: true });
  const MATRIX = t("pricing.compare.matrix", { returnObjects: true }).map((row, i) => ({ ...row, icon: MATRIX_ICONS[i] }));
  const FAQ = t("pricing.faq.items", { returnObjects: true });

  usePageMeta(t("pricing.meta.title"), t("pricing.meta.description"), {
    alternates: SUPPORTED_LOCALES.map((loc) => ({ locale: loc, path: "/pricing" })).concat([{ locale: "", path: "/pricing" }]),
  });

  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/premium/plans`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPlans(Array.isArray(d?.plans) ? d.plans : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (reduceMotion) {
        gsap.set("[data-reveal]", { opacity: 1, y: 0 });
        gsap.set("[data-hero-item]", { opacity: 1, y: 0 });
        return;
      }
      gsap.timeline({ defaults: { ease: "power3.out" } })
        .fromTo("[data-hero-item]", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08 });
      gsap.utils.toArray("[data-reveal]").forEach((el) => {
        gsap.fromTo(el, { opacity: 0, y: 28 }, {
          opacity: 1, y: 0, duration: 0.6, ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });
      gsap.utils.toArray("[data-reveal-group]").forEach((group) => {
        const items = group.querySelectorAll("[data-reveal-item]");
        gsap.fromTo(items, { opacity: 0, y: 20 }, {
          opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.08,
          scrollTrigger: { trigger: group, start: "top 85%", once: true },
        });
      });
    }, rootRef);
    return () => ctx.revert();
  }, [loading]);

  const goSignup = () => navigate(lp("/"), { state: { openAuth: "signup" } });

  return (
    <div ref={rootRef} className="min-h-screen bg-white text-slate-800 dark:bg-[#0d0d0f] dark:text-white">
      <SiteNav />

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute -end-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-brand-100/50 blur-3xl dark:bg-brand-500/10" />
        <div className="relative mx-auto max-w-3xl px-5 py-16 text-center sm:py-20">
          <div data-hero-item className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-extrabold text-brand-600 ring-1 ring-brand-100 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/25">
            <Sparkles className="h-3.5 w-3.5" /> {t("pricing.hero.badge")}
          </div>
          <h1 data-hero-item className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-800 dark:text-white sm:text-5xl">
            {t("pricing.hero.titleLine1")}<br /><span className="text-brand-500">{t("pricing.hero.titleHighlight")}</span>
          </h1>
          <p data-hero-item className="mx-auto mt-5 max-w-lg text-lg font-semibold text-slate-500 dark:text-stone-400">
            {t("pricing.hero.subtitle")}
          </p>
        </div>
      </header>

      {/* Plan cards */}
      <section className="mx-auto max-w-5xl px-5 pb-6">
        {loading ? (
          <div className="flex justify-center py-16 text-slate-400 dark:text-stone-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div data-reveal-group className="grid gap-5 sm:grid-cols-[1fr_1fr_1fr] lg:mx-auto">
            {/* Free */}
            <div data-reveal-item className="flex flex-col rounded-3xl border border-slate-200 p-6 dark:border-white/[0.08]">
              <div className="font-display text-lg font-extrabold text-slate-800 dark:text-white">{FREE.title}</div>
              <div className="text-xs font-semibold text-slate-400 dark:text-stone-500">{FREE.subtitle}</div>
              <div className="mt-4 font-display text-3xl font-extrabold text-slate-800 dark:text-white">{FREE.price}</div>
              <button onClick={() => navigate(lp("/"))} className="btn3d btn3d-neutral mt-5 justify-center text-sm">{FREE.cta}</button>
              <ul className="mt-5 space-y-2 text-sm font-semibold text-slate-600 dark:text-stone-300">
                {FREE.perks.map((perk, i) => (
                  <li key={i} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-grass-500" /> {perk}</li>
                ))}
              </ul>
            </div>

            {/* Live premium plans */}
            {plans.map((p) => (
              <div
                key={p.id}
                data-reveal-item
                className={
                  "relative flex flex-col rounded-3xl p-6 ring-2 " +
                  (p.badge_label
                    ? "bg-brand-50 ring-brand-400 dark:bg-brand-500/10 dark:ring-brand-500/40"
                    : "border border-slate-200 ring-transparent dark:border-white/[0.08]")
                }
              >
                {p.badge_label && (
                  <div className="absolute -top-3 start-6 inline-flex items-center gap-1 rounded-full bg-gold-500 px-2.5 py-1 text-xs font-extrabold text-white shadow-[0_2px_0_0_#B45309]">
                    <Star className="h-3 w-3 fill-white" /> {p.badge_label}
                  </div>
                )}
                <div className="font-display text-lg font-extrabold text-slate-800 dark:text-white">{p.title}</div>
                <div className="text-xs font-semibold text-slate-400 dark:text-stone-500">{p.subtitle}</div>
                <div className="mt-4 font-display text-3xl font-extrabold text-slate-800 dark:text-white">
                  {formatPrice(p.price, p.currency)}
                  <span className="ms-1 text-sm font-bold text-slate-400 dark:text-stone-500">/ {INTERVAL_LABEL[p.interval] || p.interval}</span>
                </div>
                <button onClick={goSignup} className="btn3d btn3d-brand mt-5 justify-center text-sm">{t("pricing.premiumCta")}</button>
                <ul className="mt-5 space-y-2 text-sm font-semibold text-slate-600 dark:text-stone-300">
                  {(p.perks || []).map((perk, i) => (
                    <li key={i} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-grass-500" /> {perk}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <p data-reveal className="mt-6 text-center text-xs font-semibold text-slate-400 dark:text-stone-500">
          {splitAroundToken(t("pricing.footnote"), (
            <Link to={lp("/refund-policy")} className="font-bold text-slate-500 underline hover:text-slate-700 dark:text-stone-400 dark:hover:text-stone-200">
              {t("pricing.footnoteLinkText")}
            </Link>
          ))}
        </p>
      </section>

      {/* Sticky comparison: the "which plan" summary pins while the feature
          matrix scrolls past beside it — a real sticky moment, not just CSS
          decoration, since the summary is genuinely still useful the whole
          time you're comparing rows. */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <div data-reveal className="text-center">
          <div className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-500">{t("pricing.compare.eyebrow")}</div>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-4xl">
            {t("pricing.compare.heading")}
          </h2>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[220px_1fr]">
          <div className="hidden lg:block">
            <div className="sticky top-24 rounded-3xl bg-gradient-to-br from-brand-500 to-pom-500 p-5 text-white shadow-btn-brand">
              <InfinityIcon className="h-7 w-7" />
              <div className="mt-3 font-display text-lg font-extrabold leading-snug">{t("pricing.compare.calloutHeading")}</div>
              <p className="mt-2 text-sm font-semibold text-white/85">{t("pricing.compare.calloutText")}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-100 dark:border-white/[0.07]">
            <table className="w-full min-w-[480px] border-collapse text-start">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/[0.07]">
                  <th className="px-5 py-3 text-sm font-extrabold text-slate-700 dark:text-stone-200">{t("pricing.compare.tableHeaders.feature")}</th>
                  <th className="px-5 py-3 text-center text-sm font-extrabold text-slate-700 dark:text-stone-200">{t("pricing.compare.tableHeaders.free")}</th>
                  <th className="px-5 py-3 text-center text-sm font-extrabold text-brand-600 dark:text-brand-400">{t("pricing.compare.tableHeaders.premium")}</th>
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((row) => (
                  <tr key={row.label} className="border-b border-slate-50 last:border-0 dark:border-white/[0.04]">
                    <td className="px-5 py-3.5 text-sm font-semibold text-slate-700 dark:text-stone-200">
                      <span className="inline-flex items-center gap-2"><row.icon className="h-4 w-4 text-slate-400 dark:text-stone-500" /> {row.label}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center"><Cell v={row.free} /></td>
                    <td className="px-5 py-3.5 text-center"><Cell v={row.premium} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ mini-section */}
      <section className="border-t border-slate-100 bg-slate-50 dark:border-white/[0.06] dark:bg-white/[0.04]">
        <div className="mx-auto max-w-3xl px-5 py-16">
          <div data-reveal className="text-center">
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">{t("pricing.faq.heading")}</h2>
          </div>
          <div data-reveal className="mt-8 space-y-5">
            {FAQ.map((f, i) => (
              <div key={i}>
                <div className="text-sm font-extrabold text-slate-800 dark:text-white">{f.q}</div>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-stone-400">
                  {f.a.includes("{{link}}") ? splitAroundToken(f.a, (
                    <Link to={lp("/contact")} className="font-bold text-brand-600 hover:underline dark:text-brand-400">
                      {t("pricing.faqContactLinkText")}
                    </Link>
                  )) : f.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-16">
        <div data-reveal className="relative mx-auto flex max-w-5xl flex-col items-center overflow-hidden rounded-[2rem] bg-brand-500 px-6 py-14 text-center text-white shadow-btn-brand">
          <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t("pricing.cta.heading")}</h2>
          <p className="mt-3 max-w-md text-lg font-semibold text-white/90">{t("pricing.cta.subtext")}</p>
          <button onClick={() => navigate(lp("/"))} className="btn3d mt-7 bg-white !text-brand-600 shadow-[0_4px_0_0_#B84B00] text-base uppercase hover:brightness-100">
            {t("pricing.cta.button")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
          </button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
