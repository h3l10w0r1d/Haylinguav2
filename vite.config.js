import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
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
          return "vendor";
        },
      },
    },
  },
});
