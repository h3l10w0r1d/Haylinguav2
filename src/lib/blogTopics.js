// src/lib/blogTopics.js — shared tag <-> SEO-landing-page mapping so the
// blog and the evergreen landing pages cross-link by topic instead of
// staying two disconnected content silos (blog posts previously only
// linked back to /blog, and landing pages didn't reference the blog at
// all — zero link equity/topical-authority flow between them).
//
// TAG_TO_PATH drives BlogPostPage.jsx's "Keep learning" links (post tags ->
// landing pages). The keys mirror the tags actually used across
// seed_blog_posts.py / _scheduled_batch2_*.py / _translated_posts_*.py.
export const TAG_TO_PATH = {
  alphabet: "/armenian-alphabet",
  reading: "/armenian-alphabet",
  writing: "/armenian-alphabet",
  history: "/armenian-alphabet",
  pronunciation: "/armenian-pronunciation",
  greetings: "/armenian-pronunciation",
  dialects: "/eastern-armenian",
  vocabulary: "/armenian-vocabulary",
  numbers: "/armenian-vocabulary",
  colors: "/armenian-vocabulary",
  family: "/armenian-vocabulary",
  food: "/armenian-vocabulary",
  animals: "/armenian-vocabulary",
  body: "/armenian-vocabulary",
  months: "/armenian-vocabulary",
  seasons: "/armenian-vocabulary",
  travel: "/armenian-vocabulary",
  phrases: "/armenian-vocabulary",
  "days-of-the-week": "/armenian-vocabulary",
  grammar: "/learn-armenian-online",
  verbs: "/learn-armenian-online",
  adjectives: "/learn-armenian-online",
  pronouns: "/learn-armenian-online",
  beginner: "/learn-armenian-online",
  "getting started": "/learn-armenian-online",
  "online-learning": "/learn-armenian-online",
  "heritage-speakers": "/learn-armenian-online",
  "study-tips": "/learn-armenian-online",
  tips: "/learn-armenian-online",
  faq: "/learn-armenian-online",
  comparison: "/learn-armenian-online",
  "language-facts": "/learn-armenian-online",
  culture: "/learn-armenian-online",
  idioms: "/learn-armenian-online",
  expressions: "/learn-armenian-online",
  proverbs: "/learn-armenian-online",
  traditions: "/learn-armenian-online",
};

// Short i18n key per landing page, used for both directions' link labels —
// see common.json's blog.relatedTopics.* (BlogPostPage.jsx) — the landing
// pages themselves fetch by REVERSE_TAGS below rather than needing a label.
export const PATH_TO_LABEL_KEY = {
  "/armenian-alphabet": "alphabet",
  "/armenian-pronunciation": "pronunciation",
  "/armenian-vocabulary": "vocabulary",
  "/learn-armenian-online": "online",
  "/eastern-armenian": "eastern",
};

// Reverse of TAG_TO_PATH, deduped — which tags should each landing page's
// "From the blog" section (see RelatedBlogPosts.jsx) query for.
export const PATH_TO_TAGS = Object.entries(TAG_TO_PATH).reduce((acc, [tag, path]) => {
  (acc[path] ||= []).push(tag);
  return acc;
}, {});

// Picks up to `max` distinct landing pages relevant to a post's tags, in tag
// order, falling back to the general hub page if nothing matched (a post
// should always link somewhere, never zero).
export function relatedLandingPaths(tags, max = 3) {
  const paths = new Set();
  for (const tag of tags || []) {
    const path = TAG_TO_PATH[tag];
    if (path) paths.add(path);
    if (paths.size >= max) break;
  }
  if (paths.size === 0) paths.add("/learn-armenian-online");
  return [...paths];
}
