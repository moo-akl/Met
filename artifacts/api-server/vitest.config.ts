import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    pool: "forks",
    include: ["src/**/*.test.ts"],
    // Generous timeouts: completion-validation runs this suite in parallel
    // with typechecks and other suites, so CPU contention can make otherwise
    // fast tests exceed the 5s default and flake.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
