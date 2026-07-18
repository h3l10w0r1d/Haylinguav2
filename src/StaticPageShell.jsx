// src/StaticPageShell.jsx — shared shell for content-heavy public pages
// (Terms, Privacy, Refund Policy, Cookie Policy). Nav + title block + a
// typography-focused prose column + footer. Light/dark aware.
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";

// A restrained "prose" ruleset via plain classes (no @tailwindcss/typography
// dependency) — just enough hierarchy for long-form legal copy to read well.
export function Prose({ children }) {
  return (
    <div
      className="
        max-w-none
        [&>h2]:mt-10 [&>h2]:mb-3 [&>h2]:font-display [&>h2]:text-xl [&>h2]:font-extrabold [&>h2]:text-slate-800 dark:[&>h2]:text-white
        [&>h2:first-child]:mt-0
        [&>h3]:mt-6 [&>h3]:mb-2 [&>h3]:text-base [&>h3]:font-extrabold [&>h3]:text-slate-700 dark:[&>h3]:text-stone-200
        [&>p]:my-3 [&>p]:text-[15px] [&>p]:leading-relaxed [&>p]:text-slate-600 dark:[&>p]:text-stone-300
        [&>ul]:my-3 [&>ul]:list-disc [&>ul]:space-y-1.5 [&>ul]:pl-5 [&>ul]:text-[15px] [&>ul]:leading-relaxed [&>ul]:text-slate-600 dark:[&>ul]:text-stone-300
        [&_a]:font-semibold [&_a]:text-brand-600 dark:[&_a]:text-brand-400 [&_a]:underline [&_a]:decoration-brand-200 dark:[&_a]:decoration-brand-500/40 [&_a]:underline-offset-2
        [&_strong]:font-extrabold [&_strong]:text-slate-800 dark:[&_strong]:text-white
      "
    >
      {children}
    </div>
  );
}

export default function StaticPageShell({ eyebrow, title, updated, intro, children }) {
  return (
    <div className="min-h-screen bg-white text-slate-800 dark:bg-[#0d0d0f] dark:text-white">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
        {eyebrow && (
          <div className="text-xs font-extrabold uppercase tracking-wider text-brand-500">{eyebrow}</div>
        )}
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {title}
        </h1>
        {updated && (
          <div className="mt-2 text-sm font-semibold text-slate-400 dark:text-stone-500">Last updated {updated}</div>
        )}
        {intro && (
          <p className="mt-5 max-w-xl text-base font-medium leading-relaxed text-slate-500 dark:text-stone-400">
            {intro}
          </p>
        )}
        <div className="mt-10 border-t border-slate-100 pt-8 dark:border-white/[0.06]">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
