import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const systemChromium = process.env.CHROMIUM_EXECUTABLE_PATH ??
  (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined);

export default defineConfig({
  testDir: "./browser-tests",
  outputDir: "/tmp/venue-manager-playwright-results",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4178",
    browserName: "chromium",
    headless: true,
    launchOptions: {
      ...(systemChromium ? { executablePath: systemChromium } : {}),
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "pnpm exec vite --config vite.config.ts --host 127.0.0.1 --port 4178 --strictPort --base /",
    url: "http://127.0.0.1:4178/browser-tests/poster-editor.html",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
