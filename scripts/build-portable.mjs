// In-process build for environments that cannot launch esbuild subprocesses.
import { build, loadEnv } from "vite";
import { transformAsync } from "@babel/core";
import ts from "@babel/plugin-transform-typescript";
import jsx from "@babel/plugin-transform-react-jsx";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import fs from "node:fs";
const source = fs.readFileSync("vite.config.ts", "utf8");
const appEnv = loadEnv("production", process.cwd(), "VITE_");
const manifest = {
  name: "Clara · Finanzas personales",
  short_name: "Clara",
  description: "Tu dinero, con claridad. Finanzas personales sin conexión.",
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
};
await build({
  configFile: false,
  resolve: { preserveSymlinks: true },
  base: process.env.BASE_PATH || "/",
  esbuild: false,
  build: { minify: false, cssMinify: false, target: "esnext" },
  plugins: [
    {
      name: "in-process-typescript",
      enforce: "pre",
      async transform(code, id) {
        code = code
          .replaceAll("process.env.NODE_ENV", JSON.stringify("production"))
          .replaceAll("process.env", "({})")
          .replaceAll("import.meta.env.SSR", "false")
          .replaceAll(
            "import.meta.env.BASE_URL",
            JSON.stringify(process.env.BASE_PATH || "/"),
          )
          .replace(/import\.meta\.env\.(VITE_[A-Z_]+)/g, (_, name) =>
            JSON.stringify(process.env[name] || appEnv[name] || ""),
          );
        if (/\.(tsx?|jsx)$/.test(id) && !id.includes("node_modules"))
          return await transformAsync(code, {
            filename: id,
            plugins: [
              [ts, { isTSX: id.endsWith(".tsx"), allExtensions: true }],
              [jsx, { runtime: "automatic" }],
            ],
            sourceMaps: true,
            babelrc: false,
            configFile: false,
          });
        return { code, map: null };
      },
    },
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest,
      workbox: {
        importScripts: ["sw-notifications.js"],
        mode: "development",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/__/],
        maximumFileSizeToCacheInBytes: 4000000,
      },
    }),
  ],
});
