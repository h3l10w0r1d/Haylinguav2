// src/ForumPage.jsx — Community forum index: category list. Public read;
// posting (in category/thread pages) requires the regular user login used
// across the rest of the app. Moderation lives in the CMS (/cms/forum).
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Sparkles, MessagesSquare, ArrowRight, Hand, Lightbulb, Bug, Users, Loader2, Search, X, MessageSquare,
} from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";

gsap.registerPlugin(ScrollTrigger);

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
const CATEGORY_ICONS = { hand: Hand, "message-circle": MessagesSquare, lightbulb: Lightbulb, bug: Bug };

function timeAgo(isoStr) {
  if (!isoStr) return null;
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export default function ForumPage() {
  usePageMeta("Community", "Ask questions, share tips, and talk with other Armenian learners in the Haylingua community forum.");

  const rootRef = useRef(null);
  const [categories, setCategories] = useState(null);
  const [error, setError] = useState(false);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/forum/categories`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => setCategories(Array.isArray(d?.categories) ? d.categories : []))
      .catch(() => setError(true));
  }, []);

  // Debounced search — fires 300ms after typing stops, empty query clears
  // back to the category list.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setSearchResults(null); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`${API_BASE}/forum/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { threads: [] }))
        .then((d) => setSearchResults(Array.isArray(d?.threads) ? d.threads : []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (reduceMotion) {
        gsap.set("[data-hero-item]", { opacity: 1, y: 0 });
        gsap.set("[data-reveal-item]", { opacity: 1, y: 0 });
        return;
      }
      gsap.timeline({ defaults: { ease: "power3.out" } })
        .fromTo("[data-hero-item]", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08 });
      gsap.utils.toArray("[data-reveal-group]").forEach((group) => {
        const items = group.querySelectorAll("[data-reveal-item]");
        gsap.fromTo(items, { opacity: 0, y: 22, scale: 0.98 }, {
          opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "power2.out", stagger: 0.08,
          scrollTrigger: { trigger: group, start: "top 88%", once: true },
        });
      });
    }, rootRef);
    return () => ctx.revert();
  }, [categories]);

  return (
    <div ref={rootRef} className="min-h-screen bg-white text-slate-800 dark:bg-[#0d0d0f] dark:text-white">
      <SiteNav />

      <header className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-brand-100/50 blur-3xl dark:bg-brand-500/10" />
        <div className="relative mx-auto max-w-3xl px-5 py-16 text-center sm:py-20">
          <div data-hero-item className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-extrabold text-brand-600 ring-1 ring-brand-100 dark:bg-brand-500/15 dark:text-brand-400 dark:ring-brand-500/25">
            <Sparkles className="h-3.5 w-3.5" /> Community
          </div>
          <h1 data-hero-item className="mt-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-800 dark:text-white sm:text-5xl">
            A place for Haylingua learners to talk
          </h1>
          <p data-hero-item className="mx-auto mt-5 max-w-lg text-lg font-semibold text-slate-500 dark:text-stone-400">
            Ask questions, share progress, and get help from other learners and the team. Anyone can read — log in to post.
          </p>
          <div data-hero-item className="relative mx-auto mt-7 max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-stone-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search threads…"
              className="w-full rounded-2xl bg-slate-50 py-3 pl-11 pr-10 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400 placeholder:text-slate-400 dark:bg-white/[0.04] dark:text-white dark:ring-white/[0.08] dark:focus:bg-white/[0.06] dark:placeholder:text-stone-500"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-stone-500 dark:hover:text-stone-300">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 pb-20">
        {searchResults !== null ? (
          <div>
            <div className="mb-4 text-sm font-bold text-slate-400 dark:text-stone-500">
              {searching ? "Searching…" : `${searchResults.length} result${searchResults.length === 1 ? "" : "s"} for "${query.trim()}"`}
            </div>
            {!searching && searchResults.length === 0 ? (
              <div className="rounded-3xl bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-white/[0.04] dark:text-stone-400 dark:ring-white/[0.08]">
                No threads match that search.
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((t) => (
                  <Link
                    key={t.id}
                    to={`/community/thread/${t.id}`}
                    className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-slate-800 dark:text-white">{t.title}</div>
                      <div className="mt-0.5 text-xs font-semibold text-slate-400 dark:text-stone-500">{t.category_name} · by {t.author_name} · {timeAgo(t.last_reply_at)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-sm font-extrabold text-slate-500 tabular-nums dark:text-stone-400">
                      <MessageSquare className="h-4 w-4" /> {t.reply_count}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : error ? (
          <div className="rounded-3xl bg-cardinal-50 p-8 text-center text-sm font-semibold text-cardinal-700 ring-1 ring-cardinal-200 dark:bg-cardinal-500/10 dark:text-cardinal-300 dark:ring-cardinal-500/25">
            Couldn't load the community right now — try again shortly.
          </div>
        ) : categories === null ? (
          <div className="flex justify-center py-12 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : categories.length === 0 ? (
          <div className="rounded-3xl bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-white/[0.04] dark:text-stone-400 dark:ring-white/[0.08]">
            <Users className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-stone-600" />
            No categories yet — check back soon.
          </div>
        ) : (
          <div data-reveal-group className="space-y-3">
            {categories.map((c) => {
              const Icon = CATEGORY_ICONS[c.icon] || MessagesSquare;
              const activity = timeAgo(c.last_activity_at);
              return (
                <Link
                  key={c.id}
                  to={`/community/${c.slug}`}
                  data-reveal-item
                  className="group flex items-center gap-4 rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-lg font-extrabold text-slate-800 dark:text-white">{c.name}</div>
                    {c.description && <p className="mt-0.5 truncate text-sm font-semibold text-slate-500 dark:text-stone-400">{c.description}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-extrabold text-slate-600 tabular-nums dark:text-stone-300">{c.thread_count} {Number(c.thread_count) === 1 ? "thread" : "threads"}</div>
                    {activity && <div className="text-xs font-semibold text-slate-400 dark:text-stone-500">{activity}</div>}
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500 dark:text-stone-600" />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
