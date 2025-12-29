// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// If you set BUILD_TARGET=mobile -> base "./" (Capacitor friendly)
// Otherwise (default) -> base "/" (web/Render friendly)
const isMobileBuild = process.env.BUILD_TARGET === "mobile";

export default defineConfig({
  // ✅ Load .env from project root
  envDir: import.meta.dirname,

  // ✅ Web needs "/" so assets load on routes like /auth/callback
  // ✅ Mobile/Capacitor needs "./" so it works from file:// or embedded webview
  base: isMobileBuild ? "./" : "/",

  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },

  css: {
    postcss: {
      plugins: [],
    },
  },

  // ✅ Vite app lives in /client
  root: path.resolve(import.meta.dirname, "client"),

  build: {
    // ✅ Output to dist/public so Capacitor sync picks it up
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,

    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          query: ["@tanstack/react-query"],
          supabase: ["@supabase/supabase-js"],
          radix: [
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-aspect-ratio",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-context-menu",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-hover-card",
            "@radix-ui/react-label",
            "@radix-ui/react-menubar",
            "@radix-ui/react-navigation-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-progress",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slider",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group",
            "@radix-ui/react-tooltip",
          ],
        },
      },
    },

    chunkSizeWarningLimit: 2000,
  },

  server: {
    host: "0.0.0.0",
    allowedHosts: true,

    // ✅ IMPORTANT: forward /api/* to your Express server in dev
    // Run the server with: npm run start:5001
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
        secure: false,
      },
    },

    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
