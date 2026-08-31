// src/CareersPage.jsx — Careers. Honest positioning for a 2-person team (see
// AboutPage's real founder story): no fake job listings, just culture + an
// open invitation. Public, unauthenticated marketing page.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight, Sparkles, Heart, Languages, Rocket, Feather, Mail, Users, MapPin, Briefcase,
} from "lucide-react";
import owl from "./assets/character-owl.png";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";
import { useLocale, localizedPath, SUPPORTED_LOCALES } from "./i18n";

gsap.registerPlugin(ScrollTrigger);

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
const VALUE_ICONS = [Languages, Rocket, Feather, Heart];

export default function CareersPage() {
  const { t } = useTranslation("sitePages");
  const locale = useLocale();
  const lp = (path) => localizedPath(path, locale);

  const EMPLOYMENT_LABELS = t("careers.employmentLabels", { returnObjects: true });
  const VALUES = t("careers.values.cards", { returnObjects: true }).map((v, i) => ({ ...v, icon: VALUE_ICONS[i] }));
  const GLIMPSES = t("careers.glimpses.cards", { returnObjects: true });

  usePageMeta(t("careers.meta.title"), t("careers.meta.description"), {
    alternates: SUPPORTED_LOCALES.map((loc) => ({ locale: loc, path: "/careers" })).concat([{ locale: "", path: "/careers" }]),
  });

  const rootRef = useRef(null);
  const pinRef = useRef(null);
  const trackRef = useRef(null);
  const [vacancies, setVacancies] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/careers/vacancies`)
      .then((r) => (r.ok ? r.json() : { vacancies: [] }))
      .then((d) => setVacancies(Array.isArray(d?.vacancies) ? d.vacancies : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;

    const ctx = gsap.context(() => {
      if (reduceMotion) {
        gsap.set("[data-reveal]", { opacity: 1, y: 0 });
        gsap.set("[data-hero-item]", { opacity: 1, y: 0 });
        gsap.set("[data-icon-pop]", { opacity: 1, scale: 1, rotate: 0 });
        return;
      }

      gsap.timeline({ defaults: { ease: "power3.out" } })
        .fromTo("[data-hero-item]", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08 })
        .fromTo("[data-hero-art]", { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.8, ease: "back.out(1.4)" }, "-=0.4");

      gsap.utils.toArray("[data-reveal]").forEach((el) => {
        gsap.fromTo(el, { opacity: 0, y: 28 }, {
          opacity: 1, y: 0, duration: 0.6, ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });

      gsap.utils.toArray("[data-reveal-group]").forEach((group) => {
        const items = group.querySelectorAll("[data-reveal-item]");
        gsap.fromTo(items, { opacity: 0, y: 24, scale: 0.97 }, {
          opacity: 1, y: 0, scale: 1, duration: 0.55, ease: "power2.out", stagger: 0.1,
          scrollTrigger: { trigger: group, start: "top 85%", once: true },
        });
      });

      gsap.utils.toArray("[data-icon-pop]").forEach((el) => {
        gsap.fromTo(el, { opacity: 0, scale: 0.4, rotate: -18 }, {
          opacity: 1, scale: 1, rotate: 0, duration: 0.5, ease: "back.out(2.4)", delay: 0.1,
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });

      // The signature moment: pin the section and scrub the panel track
      // horizontally as the user scrolls vertically — desktop only (mobile
      // gets a plain swipeable row instead; pinned horizontal scroll on a
      // touch device fights the browser's own scroll gesture).
      if (isDesktop && pinRef.current && trackRef.current) {
        const track = trackRef.current;
        const getScrollAmount = () => Math.max(0, track.scrollWidth - pinRef.current.clientWidth);
        gsap.to(track, {
          x: () => -getScrollAmount(),
          ease: "none",
          scrollTrigger: {
            trigger: pinRef.current,
            start: "top top",
            end: () => "+=" + getScrollAmount(),
            scrub: 0.5,
            pin: true,
            invalidateOnRefresh: true,
          },
        });
      }
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef} className="min-h-screen bg-white text-slate-800 dark:bg-[#0d0d0f] dark:text-white">
      <SiteNav />

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute -end-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-brand-100/50 blur-3xl dark:bg-brand-500/10" />
        <div className="pointer-events-none absolute -start-24 top-40 h-72 w-72 rounded-full bg-feather-100/40 blur-3xl dark:bg-feather-500/10" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 lg:grid-cols-2 lg:py-20">
          <div>
            <div data-hero-item className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-extrabold text-brand-600 ring-1 ring-brand-100 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/25">
              <Sparkles className="h-3.5 w-3.5" /> {t("careers.hero.badge")}
            </div>
            <h1 data-hero-item className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-800 dark:text-white sm:text-5xl">
              {t("careers.hero.titleLine1")}<br /><span className="text-brand-500">{t("careers.hero.titleHighlight")}</span>
            </h1>
            <p data-hero-item className="mt-5 max-w-md text-lg font-semibold text-slate-500 dark:text-stone-400">
              {vacancies.length > 0 ? t("careers.hero.subtitleHiring") : t("careers.hero.subtitleNotHiring")}
            </p>
            <div data-hero-item className="mt-7 flex flex-wrap items-center gap-3">
              {vacancies.length > 0 ? (
                <a href="#open-roles" className="btn3d btn3d-brand text-base">
                  {t("careers.hero.ctaOpenRoles")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
                </a>
              ) : (
                <a href="mailto:info@haylingua.am?subject=Interested%20in%20Haylingua" className="btn3d btn3d-brand text-base">
                  {t("careers.hero.ctaSayHello")} <Mail className="h-5 w-5" />
                </a>
              )}
              <Link to={lp("/about")} className="btn3d btn3d-neutral text-base">{t("careers.hero.ctaMeetTeam")}</Link>
            </div>
          </div>
          <div data-hero-art className="relative flex items-center justify-center">
            <div className="absolute h-72 w-72 rounded-full bg-gradient-to-br from-brand-100 to-feather-100 blur-2xl dark:from-brand-500/15 dark:to-feather-500/10" />
            <img src={owl} alt="Haylingua's mascot owl, holding an Armenian phrasebook" className="relative h-64 w-auto object-contain drop-shadow-2xl sm:h-80" />
          </div>
        </div>
      </header>

      {/* Values */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div data-reveal className="text-center">
          <div className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-500">{t("careers.values.eyebrow")}</div>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-4xl">
            {t("careers.values.heading")}
          </h2>
        </div>
        <div data-reveal-group className="mt-10 grid gap-5 sm:grid-cols-2">
          {VALUES.map((v) => (
            <div key={v.title} data-reveal-item className="rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
              <div data-icon-pop className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                <v.icon className="h-6 w-6" />
              </div>
              <div className="mt-4 font-display text-lg font-extrabold text-slate-800 dark:text-white">{v.title}</div>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500 dark:text-stone-400">{v.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Open roles — the CMS-published vacancy list. This section wrapper is
          ALWAYS mounted (never conditionally added/removed) even though its
          content is empty when there are no vacancies. It sits immediately
          before the GSAP-pinned horizontal-scroll section below, which GSAP
          wraps in its own "pin-spacer" DOM node after mount; if this section
          were conditionally inserted/removed as a sibling *after* that pin
          setup (e.g. once the async vacancies fetch resolves), React would
          try to insertBefore a node whose sibling's parent GSAP had already
          restructured, throwing "insertBefore ... not a child of this node".
          Keeping the wrapper stable and only swapping its inner content
          avoids ever touching that sibling relationship. */}
      <section id="open-roles" className={vacancies.length > 0 ? "mx-auto max-w-4xl px-5 py-16" : "sr-only"}>
        {vacancies.length > 0 && (
          <>
            <div data-reveal className="text-center">
              <div className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-500">{t("careers.openRoles.eyebrow")}</div>
              <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-4xl">
                {t("careers.openRoles.heading")}
              </h2>
            </div>
            <div data-reveal-group className="mt-10 space-y-4">
              {vacancies.map((v) => (
                <div key={v.id} data-reveal-item className="rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="font-display text-xl font-extrabold text-slate-800 dark:text-white">{v.title}</div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs font-bold text-slate-400 dark:text-stone-500">
                        {v.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {v.location}</span>}
                        <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {EMPLOYMENT_LABELS[v.employment_type] || v.employment_type}</span>
                      </div>
                      {v.summary && <p className="mt-3 max-w-xl text-sm font-semibold leading-relaxed text-slate-500 dark:text-stone-400">{v.summary}</p>}
                    </div>
                    <Link to={lp(`/careers/apply/${v.id}`)} className="btn3d btn3d-brand shrink-0 text-sm">
                      {t("careers.openRoles.apply")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                    </Link>
                  </div>
                  {v.description && <p className="mt-4 whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-500 dark:text-stone-400">{v.description}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Pinned horizontal scroll — "what building this looks like" */}
      <section ref={pinRef} className="relative overflow-hidden border-y border-slate-100 bg-slate-50 dark:border-white/[0.06] dark:bg-white/[0.04]">
        <div className="mx-auto max-w-6xl px-5 pt-14">
          <div className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-500">{t("careers.glimpses.eyebrow")}</div>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-4xl">
            {t("careers.glimpses.heading")}
          </h2>
        </div>
        <div className="mt-10 overflow-x-auto pb-14 lg:overflow-visible">
          <div ref={trackRef} className="flex w-max gap-5 px-5 lg:w-max lg:px-5">
            {GLIMPSES.map((g) => (
              <div
                key={g.title}
                className="w-[78vw] shrink-0 rounded-3xl bg-white p-7 ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08] sm:w-[380px]"
              >
                <div className="text-xs font-extrabold uppercase tracking-wide text-brand-500">{g.tag}</div>
                <div className="mt-2 font-display text-xl font-extrabold text-slate-800 dark:text-white">{g.title}</div>
                <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-500 dark:text-stone-400">{g.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open invitation */}
      <section className="mx-auto max-w-3xl px-5 py-16 text-center">
        <div data-reveal>
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
            <Users className="h-7 w-7" />
          </span>
          <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-3xl">
            {vacancies.length > 0 ? t("careers.invitation.headingOpen") : t("careers.invitation.headingClosed")}
          </h2>
          <p className="mt-3 text-base font-semibold leading-relaxed text-slate-500 dark:text-stone-400">
            {t("careers.invitation.text")}
          </p>
          <a href="mailto:info@haylingua.am?subject=Interested%20in%20Haylingua" className="btn3d btn3d-brand mt-7 text-base">
            {t("careers.invitation.cta")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
          </a>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
