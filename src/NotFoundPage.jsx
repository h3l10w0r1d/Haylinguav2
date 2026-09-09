// src/NotFoundPage.jsx — real 404 for unknown URLs. Previously the catch-all
// route silently redirected to "/" with a 200, so a mistyped or dead link
// (from a PR campaign, a stale backlink, a typo) lost the visitor's context
// and told Google every dead URL was actually the homepage. This renders in
// place (no redirect — the bad URL stays visible and shareable for
// debugging) and is explicitly deindexed.
import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";

export default function NotFoundPage() {
  usePageMeta("Page not found", "This page doesn't exist or has moved.", { noindex: true });

  return (
    <div className="min-h-screen bg-white text-slate-800 dark:bg-[#0d0d0f] dark:text-white">
      <SiteNav />
      <main id="main-content" className="mx-auto flex max-w-xl flex-col items-center px-5 py-24 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
          <Compass className="h-8 w-8" />
        </div>
        <div className="mt-6 font-display text-2xl font-extrabold uppercase tracking-wide text-brand-500">404</div>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          We couldn't find that page
        </h1>
        <p className="mt-4 max-w-md text-base font-medium leading-relaxed text-slate-500 dark:text-stone-400">
          The link might be mistyped, or the page may have moved. Here's where you probably meant to go:
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="btn3d btn3d-brand text-sm">Go to homepage</Link>
          <Link to="/armenian-alphabet" className="btn3d btn3d-neutral text-sm">Start the alphabet</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
