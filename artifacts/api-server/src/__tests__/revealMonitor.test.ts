import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal mock Redis object that simulates INCR + EXPIREAT pipelines.
 *
 * `store` is a shared key→count map that persists across pipeline.exec() calls
 * (mirroring how a real Redis instance accumulates counts within a window).
 */
function makeMockRedis(store: Record<string, number> = {}) {
  return {
    status: "ready" as const,
    on: vi.fn(),
    pipeline() {
      type PipelineOp = { cmd: "incr" | "expireat"; key: string };
      const ops: PipelineOp[] = [];
      const p = {
        incr(key: string) {
          ops.push({ cmd: "incr", key });
          return p;
        },
        expireat(key: string, _ts: number) {
          ops.push({ cmd: "expireat", key });
          return p;
        },
        async exec() {
          return ops.map(({ cmd, key }) => {
            if (cmd === "incr") {
              store[key] = (store[key] ?? 0) + 1;
              return [null, store[key]] as [null, number];
            }
            return [null, 1] as [null, number]; // expireat response
          });
        },
      };
      return p;
    },
  };
}

// ---------------------------------------------------------------------------
// In-memory (fallback) path — Redis unavailable
// ---------------------------------------------------------------------------

describe("RevealEndpointMonitor — in-memory fallback (no Redis)", () => {
  let recordRevealOutcome: (
    endpoint: "accept" | "decline",
    statusCode: number,
  ) => Promise<void>;
  let setRedisClientForTest: (client: unknown) => void;
  let loggerErrorSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();

    loggerErrorSpy = vi.fn();

    vi.doMock("../lib/logger", () => ({
      logger: {
        error: loggerErrorSpy,
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    }));

    const mod = await import("../lib/revealMonitor");
    recordRevealOutcome = mod.recordRevealOutcome;
    setRedisClientForTest = mod._setRedisClientForTest;

    // Ensure no Redis client is active — forces in-memory path.
    setRedisClientForTest(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("fires an alert when error rate exceeds 5% with at least 5 calls", async () => {
    for (let i = 0; i < 8; i++) {
      await recordRevealOutcome("accept", 200);
    }
    await recordRevealOutcome("accept", 500);
    await recordRevealOutcome("accept", 500);

    expect(loggerErrorSpy).toHaveBeenCalledTimes(2);
    const firstCall = loggerErrorSpy.mock.calls[0][0];
    expect(firstCall.alert).toBe("reveal_error_rate_exceeded");
    expect(firstCall.endpoint).toBe("POST /api/reveals/accept");
    expect(firstCall.errorCount).toBeGreaterThanOrEqual(1);
    expect(firstCall.totalCount).toBeGreaterThanOrEqual(5);
    expect(firstCall.errorRatePct).toBeGreaterThan(5);
  });

  it("does NOT fire an alert when error rate is at or below 5%", async () => {
    for (let i = 0; i < 19; i++) {
      await recordRevealOutcome("accept", 200);
    }
    await recordRevealOutcome("accept", 500);

    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it("does NOT fire an alert when fewer than 5 calls have been recorded", async () => {
    for (let i = 0; i < 4; i++) {
      await recordRevealOutcome("accept", 500);
    }

    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it("does NOT count 4xx responses as errors", async () => {
    for (let i = 0; i < 8; i++) {
      await recordRevealOutcome("decline", 200);
    }
    for (let i = 0; i < 10; i++) {
      await recordRevealOutcome("decline", 404);
    }

    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it("discards records older than 5 minutes from the window", async () => {
    for (let i = 0; i < 4; i++) {
      await recordRevealOutcome("accept", 500);
    }

    // Advance time past the 5-minute window.
    vi.advanceTimersByTime(5 * 60_000 + 1);

    for (let i = 0; i < 4; i++) {
      await recordRevealOutcome("accept", 200);
    }
    await recordRevealOutcome("accept", 500);

    expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    const call = loggerErrorSpy.mock.calls[0][0];
    expect(call.alert).toBe("reveal_error_rate_exceeded");
    expect(call.totalCount).toBe(5);
    expect(call.errorCount).toBe(1);
  });

  it("tracks accept and decline endpoints independently", async () => {
    for (let i = 0; i < 8; i++) {
      await recordRevealOutcome("accept", 200);
    }
    await recordRevealOutcome("accept", 500);
    await recordRevealOutcome("accept", 500);

    for (let i = 0; i < 10; i++) {
      await recordRevealOutcome("decline", 200);
    }

    const alertCalls = loggerErrorSpy.mock.calls.filter(
      (c) => c[0].alert === "reveal_error_rate_exceeded",
    );
    const endpoints = alertCalls.map((c) => c[0].endpoint);
    expect(
      endpoints.every((e: string) => e === "POST /api/reveals/accept"),
    ).toBe(true);
  });

  it("includes structured fields in the alert payload", async () => {
    for (let i = 0; i < 8; i++) {
      await recordRevealOutcome("decline", 200);
    }
    await recordRevealOutcome("decline", 500);
    await recordRevealOutcome("decline", 500);

    const payload = loggerErrorSpy.mock.calls[0][0];
    expect(payload).toMatchObject({
      alert: "reveal_error_rate_exceeded",
      endpoint: "POST /api/reveals/decline",
      thresholdPct: 5,
      windowMs: 5 * 60_000,
    });
    expect(typeof payload.errorCount).toBe("number");
    expect(typeof payload.totalCount).toBe("number");
    expect(typeof payload.errorRatePct).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// Redis path — shared counters across fleet instances
// ---------------------------------------------------------------------------

describe("RevealEndpointMonitor — Redis path", () => {
  let recordRevealOutcome: (
    endpoint: "accept" | "decline",
    statusCode: number,
  ) => Promise<void>;
  let setRedisClientForTest: (client: unknown) => void;
  let loggerErrorSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();

    loggerErrorSpy = vi.fn();

    vi.doMock("../lib/logger", () => ({
      logger: {
        error: loggerErrorSpy,
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    }));

    const mod = await import("../lib/revealMonitor");
    recordRevealOutcome = mod.recordRevealOutcome;
    setRedisClientForTest = mod._setRedisClientForTest;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("fires an alert when fleet-wide error rate exceeds 5% with at least 5 calls", async () => {
    // Shared Redis store simulates counts already accumulated across instances:
    // 3 errors out of 8 total on a different key bucket than the one below.
    // We start fresh and accumulate here: 8 success + 2 errors = 20%.
    const store: Record<string, number> = {};
    setRedisClientForTest(makeMockRedis(store));

    for (let i = 0; i < 8; i++) {
      await recordRevealOutcome("accept", 200);
    }
    await recordRevealOutcome("accept", 500);
    await recordRevealOutcome("accept", 500);

    expect(loggerErrorSpy).toHaveBeenCalledTimes(2);
    const firstCall = loggerErrorSpy.mock.calls[0][0];
    expect(firstCall.alert).toBe("reveal_error_rate_exceeded");
    expect(firstCall.endpoint).toBe("POST /api/reveals/accept");
    expect(firstCall.errorRatePct).toBeGreaterThan(5);
  });

  it("does NOT fire when error rate is at or below 5%", async () => {
    const store: Record<string, number> = {};
    setRedisClientForTest(makeMockRedis(store));

    for (let i = 0; i < 19; i++) {
      await recordRevealOutcome("accept", 200);
    }
    await recordRevealOutcome("accept", 500); // 1/20 = 5%, at threshold

    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it("does NOT fire when fewer than 5 calls have been recorded", async () => {
    const store: Record<string, number> = {};
    setRedisClientForTest(makeMockRedis(store));

    for (let i = 0; i < 4; i++) {
      await recordRevealOutcome("accept", 500);
    }

    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it("does NOT count 4xx responses as errors", async () => {
    const store: Record<string, number> = {};
    setRedisClientForTest(makeMockRedis(store));

    for (let i = 0; i < 8; i++) {
      await recordRevealOutcome("decline", 200);
    }
    for (let i = 0; i < 10; i++) {
      await recordRevealOutcome("decline", 404);
    }

    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it("treats calls in a new time window as fresh counts (separate Redis keys)", async () => {
    const store: Record<string, number> = {};
    setRedisClientForTest(makeMockRedis(store));

    // 4 errors in the current window — below MIN_CALLS_FOR_ALERT so no alert.
    for (let i = 0; i < 4; i++) {
      await recordRevealOutcome("accept", 500);
    }
    expect(loggerErrorSpy).not.toHaveBeenCalled();

    // Advance time past the 5-minute window boundary.
    // New calls land in a different windowStart → new Redis keys → fresh counts.
    vi.advanceTimersByTime(5 * 60_000 + 1);

    // 4 successes + 1 error = 5 total, 1 error (20%) → should alert.
    for (let i = 0; i < 4; i++) {
      await recordRevealOutcome("accept", 200);
    }
    await recordRevealOutcome("accept", 500);

    expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    const call = loggerErrorSpy.mock.calls[0][0];
    expect(call.alert).toBe("reveal_error_rate_exceeded");
    expect(call.totalCount).toBe(5);
    expect(call.errorCount).toBe(1);
  });

  it("tracks accept and decline endpoints independently via separate Redis keys", async () => {
    const store: Record<string, number> = {};
    setRedisClientForTest(makeMockRedis(store));

    for (let i = 0; i < 8; i++) {
      await recordRevealOutcome("accept", 200);
    }
    await recordRevealOutcome("accept", 500);
    await recordRevealOutcome("accept", 500);

    // Decline stays clean.
    for (let i = 0; i < 10; i++) {
      await recordRevealOutcome("decline", 200);
    }

    const alertCalls = loggerErrorSpy.mock.calls.filter(
      (c) => c[0].alert === "reveal_error_rate_exceeded",
    );
    const endpoints = alertCalls.map((c) => c[0].endpoint);
    expect(
      endpoints.every((e: string) => e === "POST /api/reveals/accept"),
    ).toBe(true);
  });

  it("reflects pre-existing counts from other fleet instances", async () => {
    // Simulate that other server instances have already recorded:
    // 5 total, 0 errors on the accept endpoint for the current window.
    // We pre-seed the store to replicate those counts.
    const windowSec = 5 * 60;
    const nowSec = Math.floor(Date.now() / 1000);
    const windowStart = nowSec - (nowSec % windowSec);
    const store: Record<string, number> = {
      [`rm:accept:total:${windowStart}`]: 7,
      // No errors yet from other instances.
    };
    setRedisClientForTest(makeMockRedis(store));

    // This instance records 1 more success (total: 8, errors: 0) — no alert.
    await recordRevealOutcome("accept", 200);
    expect(loggerErrorSpy).not.toHaveBeenCalled();

    // This instance records 1 error — total: 9, errors: 1 (11%) → alert.
    await recordRevealOutcome("accept", 500);
    expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    const call = loggerErrorSpy.mock.calls[0][0];
    expect(call.alert).toBe("reveal_error_rate_exceeded");
    // The INCR adds 1 to the seeded total (7 + 1 success + 1 error = 9) and
    // 1 to the seeded errors (0 + 1 = 1).
    expect(call.totalCount).toBe(9);
    expect(call.errorCount).toBe(1);
  });

  it("falls back to in-memory tracking when Redis pipeline throws", async () => {
    const brokenRedis = {
      status: "ready" as const,
      on: vi.fn(),
      pipeline() {
        return {
          incr: () => this.pipeline(),
          expireat: () => this.pipeline(),
          async exec(): Promise<never> {
            throw new Error("Redis connection lost");
          },
        };
      },
    };
    setRedisClientForTest(brokenRedis);

    // With broken Redis, the in-memory fallback kicks in.
    for (let i = 0; i < 8; i++) {
      await recordRevealOutcome("accept", 200);
    }
    await recordRevealOutcome("accept", 500);
    await recordRevealOutcome("accept", 500);

    // Alert should still fire via in-memory path.
    const alertCalls = loggerErrorSpy.mock.calls.filter(
      (c) => c[0].alert === "reveal_error_rate_exceeded",
    );
    expect(alertCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("includes structured fields in the alert payload (Redis path)", async () => {
    const store: Record<string, number> = {};
    setRedisClientForTest(makeMockRedis(store));

    for (let i = 0; i < 8; i++) {
      await recordRevealOutcome("decline", 200);
    }
    await recordRevealOutcome("decline", 500);
    await recordRevealOutcome("decline", 500);

    const payload = loggerErrorSpy.mock.calls[0][0];
    expect(payload).toMatchObject({
      alert: "reveal_error_rate_exceeded",
      endpoint: "POST /api/reveals/decline",
      thresholdPct: 5,
      windowMs: 5 * 60_000,
    });
    expect(typeof payload.errorCount).toBe("number");
    expect(typeof payload.totalCount).toBe("number");
    expect(typeof payload.errorRatePct).toBe("number");
  });
});
