// src/AboutPage.jsx — "About us": the Haylingua origin story, mission,
// founders, and milestones. Public, unauthenticated marketing page.
//
// ⚠️ PLACEHOLDER CONTENT: everything inside FOUNDERS, TIMELINE, and the
// bracketed [Our story] paragraphs below is a structural placeholder, NOT
// real biographical/company fact — it was deliberately written this way
// because those are facts only the Haylingua team can supply. Search this
// file for "[" to find every spot that needs real copy, names, dates, and
// photos before this page ships. Everything about the PRODUCT itself
// (lessons, streaks, hearts, spaced repetition, AI tutor) is accurate and
// pulled from the real app.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight, ArrowLeft, Sparkles, Heart, Flame, Languages, Users,
  Sun, Moon, Menu, X, Quote, MapPin, Calendar, Github, Linkedin, Twitter,
} from "lucide-react";
import owl from "./assets/character-owl.png";
import grandma from "./assets/character-grandma.png";
import student from "./assets/character-student.png";
import teacher from "./assets/character-teacher.png";
import { StarMotif, CarpetBorder } from "./lib/motifs";
import { getTheme, toggleTheme } from "./lib/theme";

gsap.registerPlugin(ScrollTrigger);

// ── Placeholder content — replace before shipping ───────────────────────────

const FOUNDERS = [
  {
    name: "[Founder name]",
    role: "[Co-founder & CEO]",
    photo: null, // drop a real photo path here, e.g. "/team/name.jpg"
    bio: "[A couple of sentences on who they are, why Armenian, why now — their real path to starting Haylingua.]",
    links: { linkedin: "#", twitter: "#" },
  },
  {
    name: "[Founder name]",
    role: "[Co-founder & CTO]",
    photo: null,
    bio: "[A couple of sentences on who they are and what they bring to the team.]",
    links: { linkedin: "#", github: "#" },
  },
];

const TIMELINE = [
  { year: "[20XX]", title: "[The spark]", text: "[What personal moment or frustration started this — a grandmother's letters that couldn't be read, a trip to Armenia, a gap you couldn't find any app to fill.]" },
  { year: "[20XX]", title: "[First prototype]", text: "[The scrappy first version — what it looked like, who tested it first.]" },
  { year: "[20XX]", title: "[Public launch]", text: "[Opening Haylingua up to everyone — what changed, what you learned.]" },
  { year: "Today", title: "Still building", text: "Every lesson, sound, and exercise on Haylingua is shaped by real learners — heritage speakers, complete beginners, and everyone in between." },
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

// Real product facts — safe to state as-is.
const BY_THE_NUMBERS = [
  { value: "39", label: "Armenian letters taught from scratch" },
  { value: "100%", label: "Audio on every word, real text-to-speech" },
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

// ── Small shared nav (this page is public, standalone like LandingPage) ─────

function AboutNav() {
  const [theme, setTheme] = useState(getTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const onChange = (e) => e?.detail?.theme && setTheme(e.detail.theme);
    window.addEventListener("hay_theme_changed", onChange);
    return () => window.removeEventListener("hay_theme_changed", onChange);
  }, []);

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-100 bg-white/85 backdrop-blur dark:border-white/[0.06] dark:bg-[#151517]/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 font-display text-lg font-extrabold text-white shadow-btn-brand">Հ</span>
          <span className="font-display text-xl font-extrabold tracking-tight text-slate-800 dark:text-white">Haylingua</span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          <Link to="/#how" className="text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-stone-400 dark:hover:text-white">How it works</Link>
          <Link to="/#features" className="text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-stone-400 dark:hover:text-white">Features</Link>
          <Link to="/about" className="text-sm font-bold text-brand-600 dark:text-brand-400">About us</Link>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleTheme()}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle theme"
            className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 dark:text-stone-300 dark:hover:bg-white/[0.08]"
          >
            {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
          <Link to="/" className="btn3d btn3d-brand hidden !py-2.5 text-sm sm:inline-flex">
            Start learning <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-stone-300 dark:hover:bg-white/[0.06] md:hidden"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-slate-100 bg-white px-5 pb-4 pt-2 dark:border-white/[0.06] dark:bg-[#18181b] md:hidden">
          <div className="flex flex-col gap-1">
            <Link to="/#how" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:text-stone-200 dark:hover:bg-white/[0.04]">How it works</Link>
            <Link to="/#features" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:text-stone-200 dark:hover:bg-white/[0.04]">Features</Link>
            <Link to="/" onClick={() => setMenuOpen(false)} className="mt-1 btn3d btn3d-brand !py-2.5 text-sm justify-center">Start learning</Link>
          </div>
        </div>
      )}
    </nav>
  );
}

function AboutFooter() {
  return (
    <footer className="border-t border-slate-100 dark:border-white/[0.06]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500 font-display font-extrabold text-white">Հ</span>
          <span className="font-display font-extrabold text-slate-700 dark:text-stone-200">Haylingua</span>
        </div>
        <div className="flex items-center gap-6 text-sm font-bold text-slate-500 dark:text-stone-400">
          <Link to="/" className="hover:text-slate-800 dark:hover:text-white">Home</Link>
          <a href="/#faq" className="hover:text-slate-800 dark:hover:text-white">FAQ</a>
          <a href="https://blog.haylingua.am" target="_blank" rel="noreferrer" className="hover:text-slate-800 dark:hover:text-white">Blog</a>
        </div>
        <div className="text-sm font-semibold text-slate-600 dark:text-stone-300">© {new Date().getFullYear()} Haylingua</div>
      </div>
    </footer>
  );
}

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
        if (timelineLineRef.current) gsap.set(timelineLineRef.current, { scaleY: 1 });
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
      <AboutNav />

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
        </header>

        {/* ── The story ── */}
        <section id="story" className="mx-auto max-w-3xl px-5 py-16">
          <div data-reveal>
            <div className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-500">How it started</div>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-4xl">
              [The real story goes here]
            </h2>
          </div>

          <div data-reveal className="prose prose-slate mt-6 max-w-none text-base font-semibold leading-relaxed text-slate-600 dark:text-stone-300">
            <p>
              [This paragraph should tell the actual, true origin story of Haylingua —
              who started it, what problem they personally ran into, and why an
              Armenian-learning app specifically. Was it a grandmother whose letters
              nobody in the family could read anymore? A trip to Yerevan that made the
              gap obvious? A search for "learn Armenian" that came up nearly empty next
              to dozens of options for Spanish or French? Replace this bracket with
              that real story.]
            </p>
            <p className="mt-4">
              [A second paragraph on what happened next — building the first version,
              who the first learners were, what surprised the team, what changed along
              the way to the app as it exists today.]
            </p>
          </div>

          <div data-reveal className="mt-8 flex items-center gap-3 rounded-2xl bg-brand-50 px-5 py-4 ring-1 ring-brand-100 dark:bg-brand-500/10 dark:ring-brand-500/20">
            <Quote className="h-6 w-6 shrink-0 text-brand-500" />
            <p className="text-sm font-bold text-brand-800 dark:text-brand-300">
              "[A short, real quote from a founder — the sentence that captures why this
              exists, in their own words.]"
            </p>
          </div>
        </section>

        {/* ── By the numbers (real product facts) ── */}
        <section className="border-y border-slate-100 bg-slate-50 dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-5 py-12 sm:grid-cols-3">
            {BY_THE_NUMBERS.map((s) => (
              <div key={s.label} data-reveal className="text-center">
                <div className="font-display text-4xl font-extrabold tabular-nums text-brand-500">{s.value}</div>
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
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
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
              [One line on the team as a whole — where you're based, what unites you.]
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
                      {f.name.replace(/[\[\]]/g, "")[0] || "?"}
                    </span>
                  )}
                </div>
                <div className="mt-4 font-display text-lg font-extrabold text-slate-800 dark:text-white">{f.name}</div>
                <div className="text-sm font-bold text-brand-500">{f.role}</div>
                <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-500 dark:text-stone-400">{f.bio}</p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  {f.links?.linkedin && (
                    <a href={f.links.linkedin} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-white/[0.06] dark:text-stone-400 dark:hover:bg-white/10" aria-label="LinkedIn">
                      <Linkedin className="h-4 w-4" />
                    </a>
                  )}
                  {f.links?.twitter && (
                    <a href={f.links.twitter} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-white/[0.06] dark:text-stone-400 dark:hover:bg-white/10" aria-label="Twitter / X">
                      <Twitter className="h-4 w-4" />
                    </a>
                  )}
                  {f.links?.github && (
                    <a href={f.links.github} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 dark:bg-white/[0.06] dark:text-stone-400 dark:hover:bg-white/10" aria-label="GitHub">
                      <Github className="h-4 w-4" />
                    </a>
                  )}
                </div>
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
                  <img src={g.src} alt="" className="h-full w-full object-contain p-6 transition duration-300 group-hover:scale-105" />
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
            <img src={teacher} alt="" className="pointer-events-none absolute -bottom-4 -left-2 hidden h-40 w-40 -rotate-6 rounded-3xl object-cover opacity-90 sm:block" />
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

      <AboutFooter />
    </div>
  );
}
