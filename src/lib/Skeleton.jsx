// src/lib/Skeleton.jsx — one pulsing placeholder primitive, shared across
// post-auth screens so "loading" looks the same everywhere (Dashboard's
// hero card already used a bare `animate-pulse` block; this just gives that
// same treatment a name so Shop/Friends/Profile/etc. stop rolling their own
// spinner-and-text loading state).
export function SkeletonBlock({ className = "" }) {
  return <div className={"animate-pulse rounded-lg bg-stone-200 dark:bg-white/[0.08] " + className} />;
}
