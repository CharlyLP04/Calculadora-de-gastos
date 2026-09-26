import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Clara · Finanzas personales",
        short_name: "Clara",
        description:
          "Tu dinero, con claridad. Finanzas personales sin conexión.",
        theme_color: "#0A0F1D",
        background_color: "#0A0F1D",
        display: "standalone",
        orientation: "portrait",
        lang: "es-MX",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Excel y PDF se cargan con import() y pesan ~1.3 MB entre los cuatro.
        // Precachearlos obligaba a todo el mundo a descargarlos en la primera
        // carga, aunque no exportara nunca. Se guardan al usarlos por primera
        // vez y desde entonces funcionan sin conexión.
        globIgnores: [
          "assets/xlsx-*.js",
          "assets/jspdf*.js",
          "assets/html2canvas*.js",
          "assets/index.es-*.js",
          "assets/purify*.js",
        ],
        runtimeCaching: [
          {
            urlPattern:
              /\/assets\/(xlsx|jspdf|html2canvas|index\.es|purify)[.-][^/]*\.js$/,
            handler: "CacheFirst",
            options: {
              cacheName: "clara-exportadores",
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/__/],
        maximumFileSizeToCacheInBytes: 4000000,
        importScripts: ["sw-notifications.js"],
        skipWaiting: false,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
