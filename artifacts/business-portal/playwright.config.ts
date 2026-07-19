import { defineConfig, devices } from "@playwright/test";

const chromiumExecutablePath =
  process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"] ??
  "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:22981",
    ...devices["Desktop Chrome"],
    launchOptions: {
      executablePath: chromiumExecutablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  },
  webServer: {
    command: "PORT=22981 BASE_PATH=/business-portal/ pnpm run dev",
    url: "http://localhost:22981/business-portal/",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
