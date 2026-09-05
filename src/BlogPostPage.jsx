// src/BlogPostPage.jsx — public, unauthenticated blog article page. Renders
// body_markdown via markdown-to-jsx (inert until parsed, unlike
// dangerouslySetInnerHTML on raw stored HTML — this app has no other place
// that renders admin-authored content straight to anonymous visitors, so
// this deliberately avoids being the first).
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Markdown from "markdown-to-jsx";
import { ArrowRight, Loader2 } from "lucide-react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";
import { useLocale, localizedPath } from "./i18n";
import { relatedLandingPaths, PATH_TO_LABEL_KEY } from "./lib/blogTopics";
import { AUTHOR_PROFILES } from "./lib/authors";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";
const SITE_ORIGIN = "https://www.haylingua.am";

export default function BlogPostPage() {
  const { t } = useTranslation("common");
  const locale = useLocale();
  const lp = (path) => localizedPath(path, locale);
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null); // undefined-ish states: null = loading, "notfound" = 404
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPost(null);
    setNotFound(false);
    fetch(`${API_BASE}/blog/${encodeURIComponent(slug)}?locale=${locale || "en"}`)
      .then((r) => {
        if (r.status === 404) {
          if (!cancelled) setNotFound(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((d) => {
        if (!cancelled && d) setPost(d);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, locale]);

  const authorProfile = post ? AUTHOR_PROFILES[post.author_name] : undefined;
  const relatedPaths = useMemo(() => relatedLandingPaths(post?.tags), [post]);

  const metaOptions = useMemo(() => {
    if (!post) return {};
    const path = lp(`/blog/${post.slug}`);
    const url = `${SITE_ORIGIN}${path}`;
    const authorInfo = AUTHOR_PROFILES[post.author_name];
    return {
      path,
      image: post.cover_image_url || undefined,
      structuredData: [
        {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.meta_description || post.excerpt || undefined,
          image: post.cover_image_url || undefined,
          datePublished: post.published_at || undefined,
          dateModified: post.updated_at || post.published_at || undefined,
          // Real name + jobTitle/description when the author is a known,
          // credentialed person (see authors.js) — a stronger E-E-A-T
          // signal than a bare name string, which is all "Haylingua" (the
          // legacy generic byline) gets.
          author: {
            "@type": "Person",
            name: post.author_name || "Haylingua",
            ...(authorInfo ? { jobTitle: authorInfo.role, description: authorInfo.bio, url: `${SITE_ORIGIN}${lp("/about")}` } : {}),
          },
          publisher: {
            "@type": "Organization",
            name: "Haylingua",
            logo: { "@type": "ImageObject", url: `${SITE_ORIGIN}/og.png` },
          },
          mainEntityOfPage: url,
          inLanguage: locale || "en",
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_ORIGIN}${lp("/")}` },
            { "@type": "ListItem", position: 2, name: t("blog.heading"), item: `${SITE_ORIGIN}${lp("/blog")}` },
            { "@type": "ListItem", position: 3, name: post.title, item: url },
          ],
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post, locale]);

  usePageMeta(post?.title, post?.meta_description || post?.excerpt, metaOptions);

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 to-white dark:from-[#0d0d0f] dark:via-[#0d0d0f] dark:to-[#0d0d0f]">
      <SiteNav />

      <main>
        {notFound ? (
          <div className="mx-auto max-w-xl px-5 py-24 text-center">
            <h1 className="font-display text-3xl font-extrabold text-slate-800 dark:text-white">{t("blog.notFoundTitle")}</h1>
            <p className="mt-3 text-sm font-semibold text-slate-500 dark:text-stone-400">
              {t("blog.notFoundText")}
            </p>
            <Link to={lp("/blog")} className="mt-6 inline-block font-bold text-brand-600 hover:underline dark:text-brand-400">
              {t("blog.backToBlog")}
            </Link>
          </div>
        ) : !post ? (
          <div className="flex items-center justify-center gap-2 py-24 text-slate-500 dark:text-stone-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-semibold">{t("blog.loadingPost")}</span>
          </div>
        ) : (
          <>
            <article className="mx-auto max-w-2xl px-5 pb-16 pt-14">
              {Array.isArray(post.tags) && post.tags.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {post.tags.map((t) => (
                    <span key={t} className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white sm:text-4xl">
                {post.title}
              </h1>
              <div className="mt-3 text-sm font-bold text-slate-400 dark:text-stone-500">
                {post.author_name}
                {post.published_at && ` · ${new Date(post.published_at).toLocaleDateString(locale || "en-US", { month: "long", day: "numeric", year: "numeric" })}`}
              </div>

              {post.cover_image_url && (
                <div className="mt-6 overflow-hidden rounded-3xl bg-slate-100 dark:bg-white/[0.06]">
                  <img src={post.cover_image_url} alt={post.cover_image_alt || post.title} className="w-full object-cover" />
                </div>
              )}

              <div
                className={[
                  "mt-8 space-y-4 text-base font-semibold leading-relaxed text-slate-700 dark:text-stone-200",
                  "[&_a]:font-bold [&_a]:text-brand-600 [&_a]:no-underline hover:[&_a]:underline dark:[&_a]:text-brand-400",
                  "[&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:text-slate-800 dark:[&_h2]:text-white",
                  "[&_h3]:mt-6 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-extrabold [&_h3]:text-slate-800 dark:[&_h3]:text-white",
                  "[&_ul]:list-disc [&_ul]:ps-6 [&_ol]:list-decimal [&_ol]:ps-6 [&_li]:mt-1",
                  "[&_blockquote]:border-s-4 [&_blockquote]:border-brand-200 [&_blockquote]:ps-4 [&_blockquote]:italic dark:[&_blockquote]:border-brand-500/30",
                  "[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm dark:[&_code]:bg-white/[0.08]",
                  "[&_img]:rounded-2xl",
                  "[&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:whitespace-nowrap [&_table]:rounded-2xl [&_table]:ring-1 [&_table]:ring-slate-200 dark:[&_table]:ring-white/[0.08]",
                  "[&_thead]:bg-slate-50 dark:[&_thead]:bg-white/[0.04]",
                  "[&_th]:px-4 [&_th]:py-2.5 [&_th]:text-start [&_th]:font-display [&_th]:text-sm [&_th]:font-extrabold [&_th]:text-slate-700 dark:[&_th]:text-stone-200",
                  "[&_td]:border-t [&_td]:border-slate-100 [&_td]:px-4 [&_td]:py-2.5 [&_td]:text-sm [&_td]:font-semibold [&_td]:text-slate-600 dark:[&_td]:border-white/[0.06] dark:[&_td]:text-stone-300",
                ].join(" ")}
              >
                <Markdown>{post.body_markdown || ""}</Markdown>
              </div>

              {authorProfile && (
                <div className="mt-10 flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-white/[0.07] dark:bg-white/[0.04]">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-pom-500 font-display text-lg font-extrabold text-white">
                    {post.author_name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">
                      <Link to={lp("/about#team")} className="hover:underline">{post.author_name}</Link>
                    </div>
                    <div className="text-xs font-extrabold uppercase tracking-wide text-brand-600 dark:text-brand-400">{authorProfile.role}</div>
                    <p className="mt-1.5 text-sm font-semibold leading-relaxed text-slate-500 dark:text-stone-400">{authorProfile.bio}</p>
                  </div>
                </div>
              )}

              {relatedPaths.length > 0 && (
                <div className="mt-10">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-stone-500">
                    {t("blog.keepLearningHeading")}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {relatedPaths.map((path) => (
                      <Link
                        key={path}
                        to={lp(path)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-4 py-2 text-sm font-bold text-brand-700 transition hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20"
                      >
                        {t(`blog.relatedTopics.${PATH_TO_LABEL_KEY[path]}`)} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </article>

            <section className="px-5 py-16">
              <div className="relative mx-auto flex max-w-4xl flex-col items-center overflow-hidden rounded-[2rem] bg-brand-500 px-6 py-12 text-center text-white shadow-btn-brand">
                <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{t("blog.ctaHeading")}</h2>
                <button onClick={() => navigate(lp("/"))} className="btn3d mt-6 bg-white !text-brand-600 shadow-[0_4px_0_0_#B84B00] text-sm uppercase hover:brightness-100">
                  {t("blog.ctaButton")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </button>
              </div>
            </section>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
