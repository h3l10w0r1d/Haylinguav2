// src/AboutPage.jsx — "About us": the Haylingua origin story, mission,
// founders, and milestones. Public, unauthenticated marketing page.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight, ArrowLeft, Sparkles, Heart, Flame, Languages, Users,
  MapPin, Calendar, ChevronDown,
} from "lucide-react";
import owl from "./assets/character-owl.png";
import grandma from "./assets/character-grandma.png";
import student from "./assets/character-student.png";
import teacher from "./assets/character-teacher.png";
import armenPhoto from "./assets/team/armen-ghazaryan.jpg";
import lilitPhoto from "./assets/team/lilit-hakobyan.jpg";
import { StarMotif, CarpetBorder } from "./lib/motifs";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";

gsap.registerPlugin(ScrollTrigger);

const FOUNDERS = [
  {
    name: "Armen Ghazaryan",
    role: "Co-founder & Developer",
    photo: armenPhoto,
    bio: "An IB Diploma Programme graduate of Quantum College, Armen built the first version of Haylingua as a school project — and kept building once it was clear how badly diaspora Armenians needed it.",
  },
  {
    name: "Lilit Hakobyan",
    role: "Co-founder & Armenian Language Lead",
    photo: lilitPhoto,
    bio: "An Armenian language teacher across the IB programme and several other institutions, Lilit is the one who set Haylingua in motion — and shapes how the app actually teaches the language.",
  },
];

const TIMELINE = [
  { year: "Oct 2024", title: "The idea", text: "Armen's IB teacher, Lilit Hakobyan, sets him a project: build something that could actually teach Armenian to the diaspora." },
  { year: "Nov 2024", title: "First prototype", text: "A month later, the first working version of Haylingua exists." },
  { year: "Jan 2026", title: "The real build begins", text: "Armen starts rebuilding Haylingua as a full product — real backend, real curriculum — with Lilit shaping how it teaches Armenian." },
  { year: "Aug 2026", title: "Public launch", text: "Haylingua opens up to everyone. Coming soon." },
];

const VALUES = [
  {
    icon: Languages,
    title: "Armenian deserves better tools",
    text: "Most language apps treat Armenian as an afterthought, if they teach it at all. We built Haylingua because a language spoken by millions across a global diaspora deserves the same care as any of the world's biggest languages.",
  },
  {
    icon: Heart,
    title: "Heritage, not just vocabulary",
    text: "For a lot of our learners, this isn't a new hobby — it's reconnecting with a grandparent, a hometown, a part of themselves. We design every lesson with that weight in mind.",
  },
  {
    icon: Flame,
    title: "Built to actually stick",
    text: "Streaks, hearts, instant feedback, spaced repetition — the same habit-forming mechanics that make other language apps work, tuned specifically for how Armenian sounds and reads.",
  },
  {
    icon: Users,
    title: "A community, not just an app",
    text: "Friends, leaderboards, and a growing group of learners going through the exact same alphabet-to-conversation journey together.",
  },
];

// Real product facts — safe to state as-is. `count`/`suffix` on a stat means
// its number counts up on scroll instead of just appearing; omit them for a
// value like "0 → 1" that isn't a number to animate.
const BY_THE_NUMBERS = [
  { value: "39", count: 39, suffix: "", label: "Armenian letters taught from scratch" },
  { value: "100%", count: 100, suffix: "%", label: "Audio on every word, real text-to-speech" },
  { value: "0 → 1", label: "No prior Armenian needed to start" },
];

// Placeholder gallery — swap these for real team/office photos. Using the
// app's existing mascot/character art as stand-ins keeps the page looking
// finished in the meantime, without inventing fake human photos.
const GALLERY = [
  { src: owl, caption: "[Team photo — coming soon]" },
  { src: grandma, caption: "[Behind the scenes — coming soon]" },
  { src: student, caption: "[Our learners — coming soon]" },
  { src: teacher, caption: "[The workshop — coming soon]" },
];


// ── Main page ────────────────────────────────────────────────────────────────

export default function AboutPage() {
  const rootRef = useRef(null);
  const heroRef = useRef(null);
  const timelineLineRef = useRef(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (reduceMotion) {
        // Snap everything to its resting state — no motion, still fully visible.
        gsap.set("[data-reveal]", { opacity: 1, y: 0, scale: 1 });
        gsap.set("[data-hero-item]", { opacity: 1, y: 0 });
        gsap.set("[data-icon-pop]", { opacity: 1, scale: 1, rotate: 0 });
        // Only opacity — leaving scale untouched keeps the CSS hover-zoom free.
        gsap.set("[data-gallery-img]", { opacity: 1 });
        if (timelineLineRef.current) gsap.set(timelineLineRef.current, { scaleY: 1 });
        // Numbers still need their final text — there's no tween to snap.
        document.querySelectorAll("[data-count-target]").forEach((el) => {
          el.textContent = el.getAttribute("data-count-target") + (el.getAttribute("data-count-suffix") || "");
        });
        return;
      }

      // Hero entrance — a confident, staggered wipe-up on mount.
      gsap.timeline({ defaults: { ease: "power3.out" } })
        .fromTo("[data-hero-item]", { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.1 })
        .fromTo(
          "[data-hero-art]",
          { opacity: 0, scale: 0.92, rotate: -2 },
          { opacity: 1, scale: 1, rotate: 0, duration: 0.9, ease: "back.out(1.4)" },
          "-=0.5"
        );

      // Generic scroll reveal for every section marked data-reveal.
      gsap.utils.toArray("[data-reveal]").forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 32 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 85%", once: true },
          }
        );
      });

      // Staggered groups (founder cards, value cards, gallery tiles).
      gsap.utils.toArray("[data-reveal-group]").forEach((group) => {
        const items = group.querySelectorAll("[data-reveal-item]");
        gsap.fromTo(
          items,
          { opacity: 0, y: 26, scale: 0.97 },
          {
            opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "power2.out", stagger: 0.12,
            scrollTrigger: { trigger: group, start: "top 82%", once: true },
          }
        );
      });

      // "By the numbers" — counts up from 0 to its real value once it scrolls
      // into view, instead of just appearing (the row itself still fades in
      // via its own [data-reveal] above; this animates the number inside it).
      gsap.utils.toArray("[data-count-target]").forEach((el) => {
        const target = parseFloat(el.getAttribute("data-count-target"));
        const suffix = el.getAttribute("data-count-suffix") || "";
        if (Number.isNaN(target)) return;
        const counter = { val: 0 };
        gsap.to(counter, {
          val: target,
          duration: 1.3,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
          onUpdate: () => { el.textContent = Math.round(counter.val) + suffix; },
        });
      });

      // Value-card icons pop in with a little overshoot, layered slightly
      // after the card's own fade so the icon reads as its own beat.
      gsap.utils.toArray("[data-icon-pop]").forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, scale: 0.4, rotate: -18 },
          {
            opacity: 1, scale: 1, rotate: 0, duration: 0.55, ease: "back.out(2.4)", delay: 0.1,
            scrollTrigger: { trigger: el, start: "top 85%", once: true },
          }
        );
      });

      // Gallery photos settle in from a slight zoom instead of a plain fade —
      // gives the "behind the scenes" tiles a bit more life than the generic
      // card reveal their container already gets.
      gsap.utils.toArray("[data-gallery-img]").forEach((img) => {
        gsap.fromTo(
          img,
          { opacity: 0, scale: 1.2 },
          {
            opacity: 1, scale: 1, duration: 0.9, ease: "power3.out",
            scrollTrigger: { trigger: img, start: "top 88%", once: true },
            // Drop the inline transform/opacity once settled so the existing
            // CSS `group-hover:scale-105` (a class-driven transform) can still
            // take over on hover — an inline style left behind would win over it.
            onComplete: () => gsap.set(img, { clearProps: "transform,opacity" }),
          }
        );
      });

      // Timeline: the connecting line draws in as you scroll through it; each
      // milestone node pops in when it reaches the line.
      if (timelineLineRef.current) {
        gsap.fromTo(
          timelineLineRef.current,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            transformOrigin: "top",
            scrollTrigger: {
              trigger: timelineLineRef.current.closest("[data-timeline]"),
              start: "top 70%",
              end: "bottom 60%",
              scrub: 0.6,
            },
          }
        );
      }
      gsap.utils.toArray("[data-timeline-node]").forEach((node) => {
        gsap.fromTo(
          node,
          { opacity: 0, scale: 0.6 },
          {
            opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)",
            scrollTrigger: { trigger: node, start: "top 80%", once: true },
          }
        );
      });

      // Gentle parallax on the hero mascot as the page scrolls past it.
      if (heroRef.current) {
        gsap.to("[data-parallax]", {
          yPercent: 18,
          ease: "none",
          scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: true },
        });
      }
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef} className="min-h-screen bg-white text-slate-800 dark:bg-[#0d0d0f] dark:text-white">
      <SiteNav />

      <main>
        {/* ── Hero ── */}
        <header ref={heroRef} className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-brand-100/50 blur-3xl dark:bg-brand-500/10" />
          <div className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full bg-feather-100/40 blur-3xl dark:bg-feather-500/10" />

          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 lg:grid-cols-2 lg:py-20">
            <div>
              <div data-hero-item className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-extrabold text-brand-600 ring-1 ring-brand-100 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/25">
                <Sparkles className="h-3.5 w-3.5" /> Our story
              </div>
              <h1 data-hero-item className="mt-5 font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-slate-800 dark:text-white sm:text-6xl">
                We built Haylingua so
                <br />
                <span className="text-brand-500">Armenian isn't left behind.</span>
              </h1>
              <p data-hero-item className="mt-5 max-w-lg text-lg font-semibold text-slate-500 dark:text-stone-400">
                A language spoken by millions across a worldwide diaspora, with almost
                nowhere good to learn it. This is why — and how — we're changing that.
              </p>
              <div data-hero-item className="mt-7 flex flex-wrap items-center gap-3">
                <Link to="/" className="btn3d btn3d-brand text-base">
                  Start learning — free <ArrowRight className="h-5 w-5" />
                </Link>
                <a href="#story" className="btn3d btn3d-neutral text-base">Read our story</a>
              </div>
            </div>

            <div data-hero-art className="relative flex items-center justify-center">
              <div className="absolute h-72 w-72 rounded-full bg-gradient-to-br from-brand-100 to-feather-100 blur-2xl dark:from-brand-500/15 dark:to-feather-500/10" />
              <img
                data-parallax
                src={owl}
                alt="Haylingua's mascot owl, holding an Armenian phrasebook"
                className="relative h-64 w-auto object-contain drop-shadow-2xl sm:h-80"
              />
              <StarMotif className="absolute -right-2 top-4 h-8 w-8 text-gold-400 dark:text-gold-400/80" />
              <StarMotif className="absolute -left-4 bottom-8 h-6 w-6 text-feather-400 dark:text-feather-400/80" />
            </div>
          </div>

          {/* A small nudge that there's more below — bounces in place via the
              existing Tailwind `animate-bouncey` keyframe (no GSAP needed). */}
          <a
            href="#story"
            aria-label="Scroll to read our story"
            className="relative mx-auto hidden w-fit animate-bouncey items-center justify-center pb-6 text-slate-300 transition hover:text-brand-400 dark:text-white/15 dark:hover:text-brand-400 sm:flex"
          >
            <ChevronDown className="h-6 w-6" />
          </a>
        </header>

        {/* ── The story ── */}
        <section id="story" className="mx-auto max-w-3xl px-5 py-16">
          <div data-reveal>
            <div className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-500">How it started</div>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-4xl">
              It started as a school assignment
            </h2>
          </div>

          <div data-reveal className="prose prose-slate mt-6 max-w-none text-base font-semibold leading-relaxed text-slate-600 dark:text-stone-300">
            <p>
              In October 2024, Armen's IB teacher — Lilit Hakobyan, who has taught
              Armenian across the IB Diploma Programme and several other institutions —
              set him a project: build something that could actually teach Armenian to
              the diaspora, to the people growing up without easy access to the
              language of their grandparents. A month later, the first version of
              Haylingua existed.
            </p>
            <p className="mt-4">
              That prototype sat for over a year while Armen finished the rest of the
              IB Diploma. In January 2026, with the idea still nagging at him, he
              started rebuilding Haylingua from scratch — a real backend, a real
              curriculum, real lesson content — with Lilit shaping how the app
              actually teaches the language. Haylingua is set to launch publicly in
              August 2026.
            </p>
          </div>
        </section>

        {/* ── By the numbers (real product facts) ── */}
        <section className="border-y border-slate-100 bg-slate-50 dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-5 py-12 sm:grid-cols-3">
            {BY_THE_NUMBERS.map((s) => (
              <div key={s.label} data-reveal className="text-center">
                <div
                  className="font-display text-4xl font-extrabold tabular-nums text-brand-500"
                  {...(s.count != null ? { "data-count-target": s.count, "data-count-suffix": s.suffix || "" } : {})}
                >
                  {s.count != null ? `0${s.suffix || ""}` : s.value}
                </div>
                <div className="mt-1 text-sm font-bold text-slate-600 dark:text-stone-300">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Values / mission ── */}
        <section id="values" className="mx-auto max-w-6xl px-5 py-16">
          <div data-reveal className="text-center">
            <div className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-500">What we believe</div>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-4xl">
              Why we do it this way
            </h2>
          </div>

          <div data-reveal-group className="mt-10 grid gap-5 sm:grid-cols-2">
            {VALUES.map((v) => (
              <div
                key={v.title}
                data-reveal-item
                className="rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]"
              >
                <div data-icon-pop className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                  <v.icon className="h-6 w-6" />
                </div>
                <div className="mt-4 font-display text-lg font-extrabold text-slate-800 dark:text-white">{v.title}</div>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500 dark:text-stone-400">{v.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Timeline ── */}
        <section className="bg-slate-50 dark:bg-white/[0.04]">
          <div className="mx-auto max-w-3xl px-5 py-16">
            <div data-reveal className="text-center">
              <div className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-500">Milestones</div>
              <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-4xl">
                The road so far
              </h2>
            </div>

            <div data-timeline className="relative mt-12">
              <div className="absolute left-[19px] top-0 h-full w-0.5 bg-slate-200 dark:bg-white/10" />
              <div ref={timelineLineRef} className="absolute left-[19px] top-0 h-full w-0.5 origin-top bg-brand-500" />

              <div className="space-y-10">
                {TIMELINE.map((t) => (
                  <div key={t.title} className="relative flex gap-5 pl-0">
                    <div
                      data-timeline-node
                      className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-500 text-white shadow-btn-brand"
                    >
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="text-xs font-extrabold uppercase tracking-wide text-brand-500">{t.year}</div>
                      <div className="mt-0.5 font-display text-lg font-extrabold text-slate-800 dark:text-white">{t.title}</div>
                      <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-500 dark:text-stone-400">{t.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Founders ── */}
        <section id="team" className="mx-auto max-w-6xl px-5 py-16">
          <div data-reveal className="text-center">
            <div className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-500">Who's behind it</div>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-4xl">
              Meet the team
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm font-semibold text-slate-500 dark:text-stone-400">
              A student developer and the teacher who started it all — building Haylingua one lesson at a time.
            </p>
          </div>

          <div data-reveal-group className="mt-10 grid gap-6 sm:grid-cols-2 lg:mx-auto lg:max-w-3xl">
            {FOUNDERS.map((f, i) => (
              <div
                key={f.role + i}
                data-reveal-item
                className="rounded-3xl bg-white p-6 text-center ring-1 ring-slate-200 shadow-sm dark:bg-[#18181b] dark:ring-white/[0.08]"
              >
                <div className="mx-auto grid h-24 w-24 place-items-center overflow-hidden rounded-3xl bg-brand-50 ring-4 ring-white shadow-md dark:bg-brand-500/15 dark:ring-[#18181b]">
                  {f.photo ? (
                    <img src={f.photo} alt={f.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-display text-3xl font-extrabold text-brand-500">
                      {f.name[0] || "?"}
                    </span>
                  )}
                </div>
                <div className="mt-4 font-display text-lg font-extrabold text-slate-800 dark:text-white">{f.name}</div>
                <div className="text-sm font-bold text-brand-500">{f.role}</div>
                <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-500 dark:text-stone-400">{f.bio}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Gallery ── */}
        <section className="bg-slate-50 dark:bg-white/[0.04]">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div data-reveal className="text-center">
              <div className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-500">Behind the scenes</div>
              <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-4xl">
                A few glimpses
              </h2>
            </div>

            <div data-reveal-group className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
              {GALLERY.map((g, i) => (
                <div
                  key={i}
                  data-reveal-item
                  className="group relative aspect-square overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 dark:bg-[#18181b] dark:ring-white/[0.08]"
                >
                  <img data-gallery-img src={g.src} alt="" className="h-full w-full object-contain p-6 transition duration-300 group-hover:scale-105" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
                    <span className="text-xs font-bold text-white">{g.caption}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="px-5 py-16">
          <div data-reveal className="relative mx-auto flex max-w-5xl flex-col items-center overflow-hidden rounded-[2rem] bg-brand-500 px-6 py-14 text-center text-white shadow-btn-brand">
            <CarpetBorder className="absolute inset-x-0 top-0 h-2 opacity-60" />
            <MapPin className="h-6 w-6 opacity-80" />
            <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Come learn Armenian with us</h2>
            <p className="mt-3 max-w-md text-lg font-semibold text-white/90">
              Free to start, no card required — pick up your first Armenian words in minutes.
            </p>
            <Link to="/" className="btn3d mt-7 bg-white !text-brand-600 shadow-[0_4px_0_0_#B84B00] text-base uppercase hover:brightness-100">
              Start learning free <ArrowRight className="h-5 w-5" />
            </Link>
            <Link to="/" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-white/80 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
