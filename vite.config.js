import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Split vendor code into stable, cacheable chunks that load in parallel,
    // so the app bundle shrinks and returning visitors re-use cached vendors.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (
            id.includes("react-router") ||
            id.includes("/react-dom/") ||
            id.includes("/react/") ||
            id.includes("scheduler")
          ) {
            return "react-vendor";
          }
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("@sentry")) return "sentry";
          return "vendor";
        },
      },
    },
  },
});
