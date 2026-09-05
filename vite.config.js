import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
    // Source maps for prod JS — lets Sentry (and DevTools) resolve minified
    // vendor.js stack traces back to real source instead of dead-ending.
    sourcemap: true,
    modulePreload: {
      // Vite's default behavior adds a <link rel="modulepreload"> for EVERY
      // chunk reachable from a dynamic import() anywhere in the app,
      // including ones nested behind a lazy-loaded route — so despite
      // Phaser only being touched by AdventurePlayer.jsx's own dynamic
      // import() (itself behind React.lazy()), every single page — the
      // marketing homepage included — was downloading the full ~1.2MB
      // phaser chunk on first paint. Filtering it out of the preload list
      // here restores real lazy-loading: the browser only fetches it when a
      // learner actually opens an adventure and that import() fires.
      resolveDependencies: (filename, deps) => deps.filter((dep) => !dep.includes("phaser")),
    },
    rollupOptions: {
      output: {
        // IMPORTANT: React and every library the APP SHELL loads eagerly must
        // live in the SAME chunk. Splitting React out of the chunk that a
        // synchronously/eagerly-loaded consumer lives in lets that consumer
        // evaluate first and read `React.useLayoutEffect` while React is
        // still undefined — crashing the whole app before it mounts (blank
        // screen). This only bites eager chunks though: a package reachable
        // *only* through a dynamic import() behind React.lazy() (see
        // LAZY_ONLY_PACKAGES below) always evaluates after the app has
        // already mounted and the vendor chunk has long since initialized,
        // so it's safe to let those live in their own async chunk.
        //
        // Sentry stays split because it's loaded lazily via dynamic import in
        // main.jsx (only when VITE_SENTRY_DSN is set), so it must not be pulled
        // into the eager vendor chunk.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@sentry")) return "sentry";
          // Phaser (~1.2 MB) powers only the Adventures scene, loaded via a
          // dynamic import() nested inside AdventurePlayer.jsx (itself behind
          // React.lazy()). Forcing it into an explicitly-named chunk here
          // used to make Rollup hoist a literal `import "./phaser-*.js"` into
          // the EAGER main entry chunk — every page, marketing homepage
          // included, downloaded the full ~1.2MB on first paint. Returning
          // nothing lets Rollup fall back to its default automatic
          // chunking, which correctly keeps it as a lazy async chunk
          // referenced only from AdventurePlayer's own chunk — verified via
          // a build check (`grep phaser dist/assets/index-*.js` finds no
          // match) before landing this. Don't reintroduce a forced chunk
          // name for it without re-verifying that check.
          if (id.includes("node_modules/phaser")) return;
          // Same class of bug, applied to every other library that was
          // getting force-grouped into "vendor" even though it's only used
          // behind a React.lazy() route (recharts on AffiliateDashboardPage
          // /CmsAffiliates, @dnd-kit on the CMS analytics builder, @dicebear
          // on AvatarBuilder/Shop, canvas-confetti on AdventurePlayer/
          // ChestOpening, blobs on BannerBuilder, markdown-to-jsx on
          // BlogPostPage, gsap on About/Affiliates/Careers/Forum/Pricing) —
          // verified via `grep -rl "from ['\"]<pkg>" src` that none of these
          // roots are imported by App.jsx, LandingPage.jsx, SiteNav.jsx, or
          // SiteFooter.jsx (the only eagerly-rendered code). This full list
          // is that root set's complete transitive dependency closure
          // (walked via each package's own package.json "dependencies"),
          // so e.g. recharts' hidden pull of @reduxjs/toolkit/react-redux/
          // immer doesn't silently stay stuck in vendor. Regenerate this
          // list (see the walk script noted in the PR/commit that added it)
          // if any of the seven root packages' own dependencies change.
          const LAZY_ONLY_PACKAGES = [
            "@dicebear/adventurer", "@dicebear/adventurer-neutral", "@dicebear/avataaars",
            "@dicebear/avataaars-neutral", "@dicebear/big-ears", "@dicebear/big-ears-neutral",
            "@dicebear/big-smile", "@dicebear/bottts", "@dicebear/bottts-neutral",
            "@dicebear/collection", "@dicebear/core", "@dicebear/croodles",
            "@dicebear/croodles-neutral", "@dicebear/dylan", "@dicebear/fun-emoji",
            "@dicebear/glass", "@dicebear/icons", "@dicebear/identicon", "@dicebear/initials",
            "@dicebear/lorelei", "@dicebear/lorelei-neutral", "@dicebear/micah",
            "@dicebear/miniavs", "@dicebear/notionists", "@dicebear/notionists-neutral",
            "@dicebear/open-peeps", "@dicebear/personas", "@dicebear/pixel-art",
            "@dicebear/pixel-art-neutral", "@dicebear/rings", "@dicebear/shapes",
            "@dicebear/thumbs", "@dicebear/toon-head",
            "@dnd-kit/accessibility", "@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities",
            "@reduxjs/toolkit", "@standard-schema/spec", "@standard-schema/utils",
            "blobs", "canvas-confetti", "clsx", "decimal.js-light",
            "d3-array", "d3-color", "d3-ease", "d3-format", "d3-interpolate", "d3-path",
            "d3-scale", "d3-shape", "d3-time", "d3-time-format", "d3-timer",
            "es-toolkit", "eventemitter3", "gsap", "immer", "internmap",
            "markdown-to-jsx", "react-redux", "recharts", "redux", "redux-thunk",
            "reselect", "tiny-invariant", "use-sync-external-store", "victory-vendor",
          ];
          if (LAZY_ONLY_PACKAGES.some((pkg) => id.includes(`node_modules/${pkg}/`))) return;
          return "vendor";
        },
      },
    },
  },
});
