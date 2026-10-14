import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    pool: "forks",
    include: ["src/**/*.test.ts"],
    // Integration tests share database state, and some endpoints compare a
    // reviewed audience against a fresh query before sending. Running test
    // files concurrently makes unrelated fixtures change those counts.
    fileParallelism: false,
    // Generous timeouts also cover completion-validation CPU contention.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
