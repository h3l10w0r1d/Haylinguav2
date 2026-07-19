// src/CommunityPage.jsx — "Community" (forum) landing. The real forum is a
// separate, larger build (threads/replies/moderation, CMS-managed) — this is
// an honest placeholder so the nav link works today instead of 404ing, not a
// fake feature. Public, unauthenticated marketing page.
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Sparkles, MessagesSquare, Send, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import Turnstile from "./lib/Turnstile";

gsap.registerPlugin(ScrollTrigger);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

export default function CommunityPage() {
  const rootRef = useRef(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [turnstileToken, setTurnstileToken] = useState("");

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (reduceMotion) { gsap.set("[data-hero-item]", { opacity: 1, y: 0 }); return; }
      gsap.timeline({ defaults: { ease: "power3.out" } })
        .fromTo("[data-hero-item]", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08 });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  async function notifyMe(e) {
    e.preventDefault();
    if (!email.trim() || status === "sending" || !turnstileToken) return;
    setStatus("sending");
    try {
      // Reuses the contact inbox for now — a lightweight signal, not a real
      // waitlist table, since the forum doesn't exist to notify people about yet.
      const res = await fetch(`${API_BASE_URL}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Community waitlist", email, topic: "Community waitlist", message: `Notify when the community/forum launches: ${email}`, turnstile_token: turnstileToken }),
      });
      if (!res.ok) throw new Error("request failed");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div ref={rootRef} className="min-h-screen bg-white text-slate-800 dark:bg-[#0d0d0f] dark:text-white">
      <SiteNav />

      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-brand-100/50 blur-3xl dark:bg-brand-500/10" />
        <div className="relative mx-auto max-w-2xl px-5 py-20 text-center sm:py-28">
          <div data-hero-item className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-extrabold text-brand-600 ring-1 ring-brand-100 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/25">
            <Sparkles className="h-3.5 w-3.5" /> Community
          </div>
          <div data-hero-item className="mx-auto mt-6 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-brand-500 to-pom-500 text-white shadow-btn-brand">
            <MessagesSquare className="h-8 w-8" />
          </div>
          <h1 data-hero-item className="mt-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-800 dark:text-white sm:text-5xl">
            A place for Haylingua learners to talk — coming soon
          </h1>
          <p data-hero-item className="mx-auto mt-5 max-w-md text-lg font-semibold text-slate-500 dark:text-stone-400">
            We're building a real community space — ask questions, share progress, get help
            from other learners. It's in the works; leave your email and we'll let you know the day it opens.
          </p>

          <div data-hero-item className="mx-auto mt-8 max-w-sm">
            {status === "sent" ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-grass-50 px-4 py-3 text-sm font-extrabold text-grass-700 dark:bg-grass-500/15 dark:text-grass-300">
                <CheckCircle2 className="h-4 w-4" /> We'll email you when it's live.
              </div>
            ) : (
              <form onSubmit={notifyMe} className="flex flex-col items-center gap-3">
                <div className="flex w-full items-center gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-semibold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400 placeholder:text-slate-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500"
                  />
                  <button type="submit" disabled={status === "sending" || !turnstileToken} className="btn3d btn3d-brand shrink-0 !px-4 text-sm disabled:opacity-70">
                    {status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
                <Turnstile onVerify={setTurnstileToken} />
                {status === "error" && (
                  <div className="flex items-center gap-2 text-sm font-bold text-pom-600 dark:text-pom-400">
                    <AlertTriangle className="h-4 w-4" /> Something went wrong — try again.
                  </div>
                )}
              </form>
            )}
          </div>
          <p data-hero-item className="mt-4 text-xs font-semibold text-slate-400 dark:text-stone-500">
            In the meantime, reach us directly via <a href="/contact" className="font-bold text-brand-600 hover:underline dark:text-brand-400">Contact</a>.
          </p>
        </div>
      </header>

      <SiteFooter />
    </div>
  );
}
