// src/AffiliatesPage.jsx — affiliate/partner program: pitch + a real,
// working application form (POST /affiliate-apply, Turnstile-protected,
// emailed to support with reply-to set to the applicant). Applications are
// reviewed and approved manually in the CMS (src/cms/CmsAffiliates.jsx),
// which mints a referral link, tracks clicks/signups/conversions, and
// computes commission automatically — see src/AffiliateDashboardPage.jsx
// for the affiliate's own view of that data. Public, unauthenticated
// marketing page.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight, Sparkles, Link2, Wallet, Send, CheckCircle2, Loader2,
  AlertTriangle, TrendingUp, Users2, Percent,
} from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";
import Turnstile from "./lib/Turnstile";
import { track } from "./lib/analytics";

gsap.registerPlugin(ScrollTrigger);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

const STEPS = [
  { icon: Send, title: "Apply", text: "Tell us where you talk to Armenian learners — a channel, a blog, a classroom, a community. Takes two minutes." },
  { icon: Link2, title: "Get your link", text: "Once approved, you get a personal referral link and a dashboard-ready code tied to your account." },
  { icon: Wallet, title: "Earn on every subscriber", text: "Every Premium subscription that starts through your link earns you a commission — paid out monthly." },
];

const STATS = [
  { icon: Percent, count: 20, suffix: "%", label: "Commission per paid referral" },
  { icon: TrendingUp, count: 30, suffix: "-day", label: "Cookie window on your link" },
  { icon: Users2, count: 0, suffix: "", label: "Minimum audience size — none" },
];

const inputCls =
  "w-full rounded-2xl bg-slate-50 px-3.5 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 transition " +
  "focus:bg-white focus:outline-none focus:ring-brand-400 placeholder:text-slate-400 " +
  "dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-extrabold text-slate-700 dark:text-stone-200">{label}</span>
      {children}
    </label>
  );
}

export default function AffiliatesPage() {
  usePageMeta("Affiliates", "Earn commission recommending Haylingua — join the affiliate program and start sharing your link.");

  const rootRef = useRef(null);
  const pinRef = useRef(null);
  const panel1Ref = useRef(null);
  const panel2Ref = useRef(null);
  const panel3Ref = useRef(null);
  const [activeStep, setActiveStep] = useState(0);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [platform, setPlatform] = useState("");
  const [audience, setAudience] = useState("");
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;

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

      // Stat count-ups
      gsap.utils.toArray("[data-count-target]").forEach((el) => {
        const target = parseFloat(el.getAttribute("data-count-target"));
        const suffix = el.getAttribute("data-count-suffix") || "";
        if (Number.isNaN(target)) return;
        const counter = { val: 0 };
        gsap.to(counter, {
          val: target, duration: 1.2, ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
          onUpdate: () => { el.textContent = Math.round(counter.val) + suffix; },
        });
      });

      // Pinned "3 steps" scrollytelling — desktop only; mobile gets the
      // panels stacked and revealed normally (see data-reveal on each).
      if (isDesktop && pinRef.current && panel1Ref.current && panel2Ref.current && panel3Ref.current) {
        gsap.set([panel2Ref.current, panel3Ref.current], { opacity: 0, y: 24 });
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: pinRef.current,
            start: "top top",
            end: "+=150%",
            scrub: 0.6,
            pin: true,
            onUpdate: (self) => {
              setActiveStep(self.progress < 0.33 ? 0 : self.progress < 0.66 ? 1 : 2);
            },
          },
        });
        tl.to(panel1Ref.current, { opacity: 0, y: -24, duration: 1 })
          .fromTo(panel2Ref.current, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1 }, "<")
          .to(panel2Ref.current, { opacity: 0, y: -24, duration: 1 })
          .fromTo(panel3Ref.current, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1 }, "<");
      } else {
        gsap.utils.toArray("[data-step-panel]").forEach((el) => {
          gsap.fromTo(el, { opacity: 0, y: 24 }, {
            opacity: 1, y: 0, duration: 0.6, ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 88%", once: true },
          });
        });
      }
    }, rootRef);

    return () => ctx.revert();
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    if (status === "sending") return;
    if (!name.trim() || !email.trim() || !platform.trim()) {
      setStatus("error");
      setErrorMsg("Please fill in your name, email, and platform/channel.");
      return;
    }
    if (!turnstileToken) {
      setStatus("error");
      setErrorMsg("Please complete the security check below.");
      return;
    }
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch(`${API_BASE_URL}/affiliate-apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, platform, audience, message, turnstile_token: turnstileToken }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || "Something went wrong — please try again.");
      setStatus("sent");
      track("affiliate_application_submitted");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Something went wrong — please try again.");
    }
  }

  return (
    <div ref={rootRef} className="min-h-screen bg-white text-slate-800 dark:bg-[#0d0d0f] dark:text-white">
      <SiteNav />

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-brand-100/50 blur-3xl dark:bg-brand-500/10" />
        <div className="relative mx-auto max-w-3xl px-5 py-16 text-center sm:py-20">
          <div data-hero-item className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-extrabold text-brand-600 ring-1 ring-brand-100 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/25">
            <Sparkles className="h-3.5 w-3.5" /> Affiliate program
          </div>
          <h1 data-hero-item className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-800 dark:text-white sm:text-5xl">
            Send us learners.<br /><span className="text-brand-500">We'll send you a cut.</span>
          </h1>
          <p data-hero-item className="mx-auto mt-5 max-w-lg text-lg font-semibold text-slate-500 dark:text-stone-400">
            If your audience is learning — or wants to learn — Armenian, partner with us and earn
            real commission on every subscriber you bring in.
          </p>
          <div data-hero-item className="mt-7">
            <a href="#apply" className="btn3d btn3d-brand text-base">Apply now <ArrowRight className="h-5 w-5" /></a>
          </div>
        </div>
      </header>

      {/* Stats */}
      <section className="border-y border-slate-100 bg-slate-50 dark:border-white/[0.06] dark:bg-white/[0.04]">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-5 py-10 sm:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.label} data-reveal className="text-center">
              <s.icon className="mx-auto h-6 w-6 text-brand-500" />
              <div className="mt-2 font-display text-3xl font-extrabold tabular-nums text-slate-800 dark:text-white" data-count-target={s.count} data-count-suffix={s.suffix}>
                0{s.suffix}
              </div>
              <div className="mt-1 text-sm font-bold text-slate-600 dark:text-stone-300">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pinned 3-step scrollytelling (desktop) / stacked reveal (mobile) */}
      <section ref={pinRef} className="relative overflow-hidden">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-5 py-16 text-center lg:min-h-screen">
          <div className="mb-8 flex items-center gap-2">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={"h-2 w-2 rounded-full transition-colors " + (i === activeStep ? "bg-brand-500" : "bg-slate-200 dark:bg-white/10")}
              />
            ))}
          </div>

          <div className="relative w-full">
            {[panel1Ref, panel2Ref, panel3Ref].map((ref, i) => (
              <div key={STEPS[i].title} ref={ref} data-step-panel className={i === 0 ? "" : "lg:absolute lg:inset-0 mt-10 lg:mt-0"}>
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-brand-500 to-pom-500 text-white shadow-btn-brand">
                  {(() => { const Icon = STEPS[i].icon; return <Icon className="h-8 w-8" />; })()}
                </span>
                <div className="mt-2 text-xs font-extrabold uppercase tracking-wide text-brand-500">Step {i + 1}</div>
                <div className="mt-1 font-display text-2xl font-extrabold text-slate-800 dark:text-white sm:text-3xl">{STEPS[i].title}</div>
                <p className="mx-auto mt-3 max-w-md text-base font-semibold leading-relaxed text-slate-500 dark:text-stone-400">{STEPS[i].text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Application form */}
      <section id="apply" className="mx-auto max-w-2xl px-5 py-16">
        <div data-reveal className="text-center">
          <div className="font-display text-sm font-extrabold uppercase tracking-wide text-brand-500">Ready?</div>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-4xl">
            Apply to the program
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm font-semibold text-slate-500 dark:text-stone-400">
            We review every application ourselves — usually within a couple of days.
          </p>
          <Link to="/affiliate-dashboard" className="mt-3 inline-block text-sm font-bold text-brand-600 hover:underline dark:text-brand-400">
            Already approved? View your dashboard
          </Link>
        </div>

        <div data-reveal className="mt-8 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-white/[0.07] dark:bg-[#18181b] sm:p-8">
          {status === "sent" ? (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-grass-50 text-grass-600 dark:bg-grass-500/15 dark:text-grass-400">
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <h3 className="mt-4 font-display text-xl font-extrabold text-slate-800 dark:text-white">Application sent</h3>
              <p className="mt-1.5 max-w-sm text-sm font-semibold text-slate-500 dark:text-stone-400">
                Thanks — we'll get back to you at {email} soon.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your name">
                  <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Anahit Petrosyan" autoComplete="name" />
                </Field>
                <Field label="Email">
                  <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Platform / channel">
                  <input className={inputCls} value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="YouTube, blog, classroom…" />
                </Field>
                <Field label="Audience size (optional)">
                  <input className={inputCls} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. 5,000 subscribers" />
                </Field>
              </div>
              <Field label="Tell us a bit more (optional)">
                <textarea className={inputCls + " min-h-[110px] resize-y"} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Who's your audience, and how would you promote Haylingua?" />
              </Field>

              <div className="pt-1"><Turnstile onVerify={setTurnstileToken} /></div>

              {status === "error" && (
                <div className="flex items-center gap-2 rounded-xl bg-cardinal-50 px-3.5 py-2.5 text-sm font-semibold text-cardinal-600 dark:bg-cardinal-500/10 dark:text-cardinal-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {errorMsg}
                </div>
              )}

              <button type="submit" disabled={status === "sending"} className="btn3d btn3d-brand w-full text-sm uppercase disabled:opacity-70">
                {status === "sending" ? (<><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>) : (<><Send className="h-4 w-4" /> Submit application</>)}
              </button>
            </form>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
