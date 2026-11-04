import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const port = Number(process.env.PORT ?? 3000);
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    {
      name: "guide-static-page-dev-routes",
      apply: "serve",
      configureServer(server) {
        const guidePages: Record<string, string> = {
          "/guides": "/guides/index.html",
          "/guides/": "/guides/index.html",
          "/guides/sossusvlei": "/guides/sossusvlei/index.html",
          "/guides/sossusvlei/": "/guides/sossusvlei/index.html",
          "/guides/alhambra": "/guides/alhambra/index.html",
          "/guides/alhambra/": "/guides/alhambra/index.html",
          "/guides/kinkaku-ji": "/guides/kinkaku-ji/index.html",
          "/guides/kinkaku-ji/": "/guides/kinkaku-ji/index.html",
          "/guides/angkor-wat": "/guides/angkor-wat/index.html",
          "/guides/angkor-wat/": "/guides/angkor-wat/index.html",
          "/guides/taj-mahal": "/guides/taj-mahal/index.html",
          "/guides/taj-mahal/": "/guides/taj-mahal/index.html",
          "/guides/halong-bay": "/guides/halong-bay/index.html",
          "/guides/halong-bay/": "/guides/halong-bay/index.html",
          "/guides/borobudur": "/guides/borobudur/index.html",
          "/guides/borobudur/": "/guides/borobudur/index.html",
          "/guides/gardens-by-the-bay": "/guides/gardens-by-the-bay/index.html",
          "/guides/gardens-by-the-bay/": "/guides/gardens-by-the-bay/index.html",
          "/articles": "/articles/index.html",
          "/articles/": "/articles/index.html",
          "/articles/asia": "/articles/asia/index.html",
          "/articles/asia/": "/articles/asia/index.html",
          "/articles/asia/where-to-visit-vietnam": "/articles/asia/where-to-visit-vietnam/index.html",
          "/articles/asia/where-to-visit-vietnam/": "/articles/asia/where-to-visit-vietnam/index.html",
          "/articles/asia/where-to-visit-thailand": "/articles/asia/where-to-visit-thailand/index.html",
          "/articles/asia/where-to-visit-thailand/": "/articles/asia/where-to-visit-thailand/index.html",
          "/articles/asia/where-to-visit-japan": "/articles/asia/where-to-visit-japan/index.html",
          "/articles/asia/where-to-visit-japan/": "/articles/asia/where-to-visit-japan/index.html",
          "/articles/asia/10-places-in-hanoi": "/articles/asia/10-places-in-hanoi/index.html",
          "/articles/asia/10-places-in-hanoi/": "/articles/asia/10-places-in-hanoi/index.html",
          "/articles/asia/10-places-in-ho-chi-minh-city": "/articles/asia/10-places-in-ho-chi-minh-city/index.html",
          "/articles/asia/10-places-in-ho-chi-minh-city/": "/articles/asia/10-places-in-ho-chi-minh-city/index.html",
          "/articles/asia/10-places-in-bangkok": "/articles/asia/10-places-in-bangkok/index.html",
          "/articles/asia/10-places-in-bangkok/": "/articles/asia/10-places-in-bangkok/index.html",
          "/articles/asia/10-places-in-tokyo": "/articles/asia/10-places-in-tokyo/index.html",
          "/articles/asia/10-places-in-tokyo/": "/articles/asia/10-places-in-tokyo/index.html",
          "/articles/travel-apps": "/articles/travel-apps/index.html",
          "/articles/travel-apps/": "/articles/travel-apps/index.html",
          "/articles/dating-apps-for-travelers": "/articles/dating-apps-for-travelers/index.html",
          "/articles/dating-apps-for-travelers/": "/articles/dating-apps-for-travelers/index.html",
          "/articles/meet-people-while-traveling": "/articles/meet-people-while-traveling/index.html",
          "/articles/meet-people-while-traveling/": "/articles/meet-people-while-traveling/index.html",
          "/articles/build-connections-new-city": "/articles/build-connections-new-city/index.html",
          "/articles/build-connections-new-city/": "/articles/build-connections-new-city/index.html",
          "/articles/first-hello-to-connection": "/articles/first-hello-to-connection/index.html",
          "/articles/first-hello-to-connection/": "/articles/first-hello-to-connection/index.html",
        };
        server.middlewares.use((req, _res, next) => {
          const [pathname, query] = (req.url ?? "/").split("?", 2);
          const guidePage = guidePages[pathname];
          if (guidePage) req.url = `${guidePage}${query ? `?${query}` : ""}`;
          next();
        });
      },
    },
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
