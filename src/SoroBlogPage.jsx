// src/SoroBlogPage.jsx — public, unauthenticated page embedding Soro's
// third-party "autopilot" blog widget (https://trysoro.com). Deliberately
// kept separate from the first-party blog at /blog (src/BlogPage.jsx,
// src/BlogPostPage.jsx) — that system stays exactly as-is; this is an
// independent, standalone page.
//
// SECURITY NOTE: the Soro embed script gets full JS execution rights on
// whatever page it's mounted on (it can read cookies, DOM, make its own
// network requests). This page is intentionally NOT part of the
// authenticated app and is never rendered inside HeaderLayout, so it never
// shares a page with localStorage-held auth tokens (hay_token/access_token)
// or any other in-app secrets. If this widget is ever wanted somewhere
// closer to the authenticated product, that placement needs its own
// security review first.
import { useEffect, useRef } from "react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import usePageMeta from "./lib/usePageMeta";

const SORO_EMBED_SRC = "https://app.trysoro.com/api/embed/b2a1d719-9c5a-485e-8bc3-1c964fe72357";

export default function SoroBlogPage() {
  const containerRef = useRef(null);

  usePageMeta("Blog", "Armenian language tips, guides, and news.");

  useEffect(() => {
    // React won't execute a <script> tag written directly in JSX (and
    // dangerouslySetInnerHTML doesn't run <script> contents either) — the
    // standard way to mount a third-party embed is to create and append the
    // script element imperatively, exactly as the vendor's own snippet
    // would do in plain HTML.
    const script = document.createElement("script");
    script.src = SORO_EMBED_SRC;
    script.defer = true;
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0d0d0f]">
      <SiteNav />
      <main className="mx-auto max-w-5xl px-5 py-14">
        <div id="soro-blog" ref={containerRef} />
      </main>
      <SiteFooter />
    </div>
  );
}
