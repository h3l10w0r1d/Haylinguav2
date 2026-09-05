// src/lib/RelatedBlogPosts.jsx — "From the blog" section for the SEO
// landing pages (ArmenianAlphabetPage, ArmenianPronunciationPage, etc.),
// completing the other half of the cross-link with BlogPostPage.jsx's
// "Keep learning" links (see blogTopics.js). Fetches by tag via GET
// /blog?tag=..., locale-aware. Renders nothing while loading or if no
// matching posts exist yet — an empty "From the blog" section would be
// worse than no section, especially for topics with few posts so far.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLocale, localizedPath } from "../i18n";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

export default function RelatedBlogPosts({ tags, max = 3 }) {
  const { t } = useTranslation("common");
  const locale = useLocale();
  const lp = (path) => localizedPath(path, locale);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    if (!tags || tags.length === 0) return;
    let cancelled = false;
    // Tries each tag in order until one returns results — a page like
    // ArmenianVocabularyPage maps to many tags (colors, food, family, …)
    // and the first one with published posts is enough for a "from the
    // blog" teaser; no need to merge/dedupe across every tag.
    (async () => {
      for (const tag of tags) {
        try {
          const res = await fetch(`${API_BASE}/blog?tag=${encodeURIComponent(tag)}&locale=${locale || "en"}&page_size=${max}`);
          if (!res.ok) continue;
          const data = await res.json();
          if (!cancelled && Array.isArray(data.posts) && data.posts.length > 0) {
            setPosts(data.posts.slice(0, max));
            return;
          }
        } catch {
          // try the next tag
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tags, locale, max]);

  if (posts.length === 0) return null;

  return (
    <section className="border-t border-slate-100 bg-slate-50 px-5 py-14 dark:border-white/[0.06] dark:bg-white/[0.04]">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-center font-display text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">
          {t("blog.fromBlogHeading")}
        </h2>
        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              to={lp(`/blog/${post.slug}`)}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#18181b] dark:ring-white/[0.08]"
            >
              <div className="font-display text-base font-extrabold text-slate-800 dark:text-white">{post.title}</div>
              {post.excerpt && (
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-500 dark:text-stone-400">{post.excerpt}</p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
