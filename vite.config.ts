import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

/**
 * Single page, prerendered at build time. No router ships to the client, and
 * the HTML that arrives already contains the whole document.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    assetsInlineLimit: 2048,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        // three.js is the single heaviest dependency. Isolating it into its own
        // chunk keeps it out of the critical path and lets it cache across
        // deploys independently of app code.
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "three";
          if (id.includes("node_modules/react")) return "react";
        },
      },
    },
  },
  server: { port: 5173, host: true },
});
