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
        // IMPORTANT: React and every library that consumes it must live in the
        // SAME chunk. Splitting React into its own chunk lets a consumer chunk
        // (recharts, @dnd-kit, react-smooth, …) evaluate first and read
        // `React.useLayoutEffect` while React is still undefined — crashing the
        // whole app before it mounts (blank screen). Keeping them together makes
        // Rollup order module init correctly within the chunk.
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
          return "vendor";
        },
      },
    },
  },
});
