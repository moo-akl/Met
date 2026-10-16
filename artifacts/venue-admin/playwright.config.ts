import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const systemChromium = process.env.CHROMIUM_EXECUTABLE_PATH ??
  (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined);

export default defineConfig({
  testDir: "./browser-tests",
  testMatch: "*.spec.ts",
  outputDir: "/tmp/venue-admin-playwright-results",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4179",
    browserName: "chromium",
    headless: true,
    launchOptions: {
      ...(systemChromium ? { executablePath: systemChromium } : {}),
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "pnpm exec vite --config vite.config.ts --host 127.0.0.1 --port 4179 --strictPort --base /venue-admin/",
    url: "http://127.0.0.1:4179/venue-admin/browser-tests/email-template-editor.html",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
