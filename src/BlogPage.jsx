// src/BlogPage.jsx — public, unauthenticated blog listing (first-party blog,
// separate from the external blog.haylingua.am). Follows the same
// SiteNav/SiteFooter/usePageMeta pattern as AboutPage.jsx.
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";
import { useLocale, localizedPath, SUPPORTED_LOCALES } from "./i18n";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
const PAGE_SIZE = 12;

export default function BlogPage() {
  const { t } = useTranslation("common");
  const locale = useLocale();
  const lp = (path) => localizedPath(path, locale);
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const [data, setData] = useState(null); // { posts, total, page, page_size }
  const [loading, setLoading] = useState(true);

  usePageMeta(
    t("blog.metaTitle"),
    t("blog.metaDescription"),
    {
      alternates: SUPPORTED_LOCALES.map((loc) => ({ locale: loc, path: "/blog" })).concat([
        { locale: "", path: "/blog" },
      ]),
    }
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/blog?page=${page}&page_size=${PAGE_SIZE}&locale=${locale || "en"}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, locale]);

  const posts = data?.posts || [];
  const total = data?.total || 0;
  const hasNext = page * PAGE_SIZE < total;
  const hasPrev = page > 1;

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <SiteNav />

      <main>
        <header className="mx-auto max-w-3xl px-5 pb-8 pt-14 text-center">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-5xl">
            {t("blog.heading")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold text-slate-500 dark:text-stone-400">
            {t("blog.subtitle")}
          </p>
        </header>

        <section className="mx-auto max-w-5xl px-5 pb-10">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-500 dark:text-stone-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-semibold">{t("blog.loading")}</span>
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500 dark:bg-white/[0.04] dark:text-stone-400">
              {t("blog.empty")}
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => (
                <Link
                  key={p.id}
                  to={lp(`/blog/${p.slug}`)}
                  className="group flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]"
                >
                  {p.cover_image_url && (
                    <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-white/[0.06]">
                      <img src={p.cover_image_url} alt={p.cover_image_alt || ""} className="h-full w-full object-cover transition group-hover:scale-105" />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    {Array.isArray(p.tags) && p.tags.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {p.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <h2 className="font-display text-lg font-extrabold text-slate-800 dark:text-white">{p.title}</h2>
                    {p.excerpt && <p className="mt-2 line-clamp-3 text-sm font-semibold text-slate-500 dark:text-stone-400">{p.excerpt}</p>}
                    <div className="mt-auto pt-3 text-xs font-bold text-slate-400 dark:text-stone-500">
                      {p.author_name}
                      {p.published_at && ` · ${new Date(p.published_at).toLocaleDateString(locale || "en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {(hasPrev || hasNext) && (
            <div className="mt-10 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={!hasPrev}
                onClick={() => setSearchParams({ page: String(page - 1) })}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-40 dark:bg-[#18181b] dark:text-stone-300 dark:ring-white/[0.08]"
              >
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t("blog.newer")}
              </button>
              <button
                type="button"
                disabled={!hasNext}
                onClick={() => setSearchParams({ page: String(page + 1) })}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-40 dark:bg-[#18181b] dark:text-stone-300 dark:ring-white/[0.08]"
              >
                {t("blog.older")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </button>
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
