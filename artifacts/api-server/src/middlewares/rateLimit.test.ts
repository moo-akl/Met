/**
 * Unit tests for the rate-limit middleware.
 *
 * Two backends are exercised:
 *   - In-memory  — Redis mock reports status !== "ready", so the limiter falls
 *                  back to its MemoryStore.
 *   - Redis mock  — Redis mock reports status "ready" and returns pipeline
 *                   results that we control per-test.
 *
 * A fresh middleware is created for every test so that each test starts with a
 * clean MemoryStore (no carry-over counts from previous tests).  Unique client
 * keys are also used per test for the same reason.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// Hoisted mock handles — must be defined before vi.mock() factories run.
// ---------------------------------------------------------------------------

const redisMocks = vi.hoisted(() => {
  const mockExec = vi.fn();
  const mockIncr = vi.fn();
  const mockExpireat = vi.fn();

  const mockPipeline = vi.fn(() => ({
    incr: mockIncr.mockReturnThis(),
    expireat: mockExpireat.mockReturnThis(),
    exec: mockExec,
  }));

  const mockRedisInstance = {
    status: "close" as string,
    pipeline: mockPipeline,
    on: vi.fn(),
  };

  // Must use a regular function (not an arrow function) so vitest can use it
  // as a constructor with `new Redis(...)`.  When a constructor returns a plain
  // object, JavaScript uses that object as the result of the `new` expression.
  // eslint-disable-next-line prefer-arrow-callback
  const MockRedis = vi.fn(function MockRedisCtor() { return mockRedisInstance; });

  return { mockExec, mockIncr, mockExpireat, mockPipeline, mockRedisInstance, MockRedis };
});

const loggerMocks = vi.hoisted(() => ({
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("ioredis", () => ({ default: redisMocks.MockRedis }));
vi.mock("../lib/logger", () => ({ logger: loggerMocks }));

// ---------------------------------------------------------------------------
// Subject — imported after mocks are registered.
// ---------------------------------------------------------------------------

import { createIpRateLimiter, createUserRateLimiter, _alertAggregatorForTest } from "./rateLimit";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let reqCounter = 0;

/**
 * Creates a minimal mock Express Request.
 * Each call gets a unique IP/UID to prevent cross-test state bleed in the
 * (shared) AlertAggregator burst tracker.
 */
function makeReq(opts: { ip?: string; uid?: string; path?: string } = {}): Request {
  reqCounter += 1;
  const ip = opts.ip ?? `10.0.0.${reqCounter % 254 + 1}-${reqCounter}`;
  const uid = opts.uid ?? undefined;
  const warnSpy = vi.fn();

  return {
    ip,
    uid,
    path: opts.path ?? "/api/test",
    method: "GET",
    socket: { remoteAddress: ip },
    // pino-http attaches req.log — provide a fake so logRateLimitExceeded uses it
    log: { warn: warnSpy, error: vi.fn(), info: vi.fn() },
    _warnSpy: warnSpy,
  } as unknown as Request;
}

interface ResMock {
  res: Response;
  statusCode: () => number;
  headers: () => Record<string, string>;
  body: () => unknown;
}

/**
 * Creates a chainable mock Express Response.
 * Captures status code, headers, and JSON body.
 */
function makeRes(): ResMock {
  const state: { code: number; headers: Record<string, string>; body: unknown } = {
    code: 200,
    headers: {},
    body: undefined,
  };

  const res = {
    setHeader: vi.fn((k: string, v: string) => {
      state.headers[k] = v;
      return res;
    }),
    status: vi.fn((code: number) => {
      state.code = code;
      return res;
    }),
    json: vi.fn((payload: unknown) => {
      state.body = payload;
      return res;
    }),
  } as unknown as Response;

  return {
    res,
    statusCode: () => state.code,
    headers: () => state.headers,
    body: () => state.body,
  };
}

/** Runs the middleware once and resolves when next() is called or the response ends. */
async function runMiddleware(
  middleware: (req: Request, res: Response, next: NextFunction) => Promise<void>,
  req: Request,
  res: Response,
): Promise<{ nextCalled: boolean }> {
  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });
  return { nextCalled };
}

// ---------------------------------------------------------------------------
// Suite helpers — create small-window limiters so tests don't need many reqs
// ---------------------------------------------------------------------------

/** IP limiter: max 3 requests per minute. */
const ipOpts = { windowMs: 60_000, max: 3, name: "test-ip" } as const;

/** User limiter: max 2 requests per minute. */
const userOpts = { windowMs: 60_000, max: 2, name: "test-user" } as const;

// ---------------------------------------------------------------------------
// Reset spies before every test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. In-memory backend (Redis status !== "ready")
// ---------------------------------------------------------------------------

describe("In-memory backend", () => {
  beforeEach(() => {
    // Ensure Redis is treated as unavailable so the memory fallback is used.
    redisMocks.mockRedisInstance.status = "close";
    process.env["REDIS_URL"] = "redis://localhost:6379";
  });

  describe("IP rate limiter", () => {
    it("passes requests within the limit and calls next()", async () => {
      const middleware = createIpRateLimiter(ipOpts);
      const req = makeReq({ ip: "1.2.3.4" });
      const { res } = makeRes();

      const { nextCalled } = await runMiddleware(middleware, req, res);

      expect(nextCalled).toBe(true);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("returns 429 on the request that exceeds the limit", async () => {
      const middleware = createIpRateLimiter(ipOpts);
      const ip = "5.6.7.8";

      // Exhaust the limit.
      for (let i = 0; i < ipOpts.max; i++) {
        const req = makeReq({ ip });
        const { res } = makeRes();
        await runMiddleware(middleware, req, res);
      }

      // This is the (max + 1)th request — should be blocked.
      const req = makeReq({ ip });
      const rm = makeRes();
      const { nextCalled } = await runMiddleware(middleware, req, rm.res);

      expect(nextCalled).toBe(false);
      expect(rm.statusCode()).toBe(429);
    });

    it("sets the Retry-After header on a 429 response", async () => {
      const middleware = createIpRateLimiter(ipOpts);
      const ip = "9.10.11.12";

      for (let i = 0; i < ipOpts.max; i++) {
        await runMiddleware(middleware, makeReq({ ip }), makeRes().res);
      }

      const req = makeReq({ ip });
      const rm = makeRes();
      await runMiddleware(middleware, req, rm.res);

      const retryAfter = Number(rm.headers()["Retry-After"]);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });

    it("includes a human-readable message in the 429 JSON body", async () => {
      const middleware = createIpRateLimiter(ipOpts);
      const ip = "13.14.15.16";

      for (let i = 0; i < ipOpts.max; i++) {
        await runMiddleware(middleware, makeReq({ ip }), makeRes().res);
      }

      const req = makeReq({ ip });
      const rm = makeRes();
      await runMiddleware(middleware, req, rm.res);

      expect((rm.body() as { message: string }).message).toMatch(/too many requests/i);
    });

    it("emits a warn log with the expected fields on the first 429", async () => {
      const middleware = createIpRateLimiter(ipOpts);
      const ip = "17.18.19.20";

      for (let i = 0; i < ipOpts.max; i++) {
        await runMiddleware(middleware, makeReq({ ip }), makeRes().res);
      }

      const req = makeReq({ ip });
      const rm = makeRes();
      await runMiddleware(middleware, req, rm.res);

      // req.log.warn is used when req.log is present (it always is here).
      const reqLogWarn = (req as unknown as { _warnSpy: ReturnType<typeof vi.fn> })._warnSpy;
      expect(reqLogWarn).toHaveBeenCalledOnce();

      const [fields, message] = reqLogWarn.mock.calls[0] as [Record<string, unknown>, string];
      expect(message).toBe("rate limit exceeded");
      expect(fields).toMatchObject({
        rateLimitName: ipOpts.name,
        route: "/api/test",
        windowCount: ipOpts.max + 1,
      });
      // keyHash should be a 12-character hex string (SHA-256 prefix).
      expect(typeof fields["keyHash"]).toBe("string");
      expect((fields["keyHash"] as string).length).toBe(12);
    });

    it("does NOT call next() after a 429", async () => {
      const middleware = createIpRateLimiter(ipOpts);
      const ip = "21.22.23.24";

      for (let i = 0; i < ipOpts.max; i++) {
        await runMiddleware(middleware, makeReq({ ip }), makeRes().res);
      }

      const req = makeReq({ ip });
      const rm = makeRes();
      const { nextCalled } = await runMiddleware(middleware, req, rm.res);

      expect(nextCalled).toBe(false);
    });
  });

  describe("User rate limiter", () => {
    it("passes requests within the limit and calls next()", async () => {
      const middleware = createUserRateLimiter(userOpts);
      const req = makeReq({ uid: "user-mem-pass" });
      const { res } = makeRes();

      const { nextCalled } = await runMiddleware(middleware, req, res);

      expect(nextCalled).toBe(true);
    });

    it("returns 429 when the per-user limit is exceeded", async () => {
      const middleware = createUserRateLimiter(userOpts);
      const uid = "user-mem-block";

      for (let i = 0; i < userOpts.max; i++) {
        await runMiddleware(middleware, makeReq({ uid }), makeRes().res);
      }

      const req = makeReq({ uid });
      const rm = makeRes();
      await runMiddleware(middleware, req, rm.res);

      expect(rm.statusCode()).toBe(429);
    });

    it("sets the Retry-After header on a 429 response", async () => {
      const middleware = createUserRateLimiter(userOpts);
      const uid = "user-mem-retry-after";

      for (let i = 0; i < userOpts.max; i++) {
        await runMiddleware(middleware, makeReq({ uid }), makeRes().res);
      }

      const req = makeReq({ uid });
      const rm = makeRes();
      await runMiddleware(middleware, req, rm.res);

      const retryAfter = Number(rm.headers()["Retry-After"]);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });

    it("emits a warn log with rateLimitName, keyHash, route, and windowCount on 429", async () => {
      const middleware = createUserRateLimiter(userOpts);
      const uid = "user-mem-log";

      for (let i = 0; i < userOpts.max; i++) {
        await runMiddleware(middleware, makeReq({ uid }), makeRes().res);
      }

      const req = makeReq({ uid });
      const rm = makeRes();
      await runMiddleware(middleware, req, rm.res);

      const reqLogWarn = (req as unknown as { _warnSpy: ReturnType<typeof vi.fn> })._warnSpy;
      expect(reqLogWarn).toHaveBeenCalledOnce();

      const [fields, message] = reqLogWarn.mock.calls[0] as [Record<string, unknown>, string];
      expect(message).toBe("rate limit exceeded");
      expect(fields).toMatchObject({
        rateLimitName: userOpts.name,
        route: "/api/test",
        windowCount: userOpts.max + 1,
      });
      expect(typeof fields["keyHash"]).toBe("string");
      expect((fields["keyHash"] as string).length).toBe(12);
    });

    it("limits by uid (different users are tracked independently)", async () => {
      const middleware = createUserRateLimiter(userOpts);

      // Exhaust the limit for user-a.
      for (let i = 0; i < userOpts.max; i++) {
        await runMiddleware(middleware, makeReq({ uid: "user-indep-a" }), makeRes().res);
      }

      // user-b should still be allowed on their first request.
      const req = makeReq({ uid: "user-indep-b" });
      const rm = makeRes();
      const { nextCalled } = await runMiddleware(middleware, req, rm.res);

      expect(nextCalled).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Redis mock backend (Redis status === "ready")
// ---------------------------------------------------------------------------

describe("Redis mock backend", () => {
  beforeEach(() => {
    redisMocks.mockRedisInstance.status = "ready";
    process.env["REDIS_URL"] = "redis://localhost:6379";
  });

  /**
   * Configures the pipeline mock to return a fixed INCR count for the next call.
   * EXPIREAT always succeeds (returns 1).
   */
  function setRedisCount(count: number): void {
    redisMocks.mockExec.mockResolvedValueOnce([
      [null, count],  // INCR result
      [null, 1],      // EXPIREAT result
    ]);
  }

  describe("IP rate limiter", () => {
    it("passes the request when Redis count is within the limit", async () => {
      setRedisCount(1); // first hit in window
      const middleware = createIpRateLimiter(ipOpts);
      const req = makeReq({ ip: "redis-1.2.3.4" });
      const rm = makeRes();

      const { nextCalled } = await runMiddleware(middleware, req, rm.res);

      expect(nextCalled).toBe(true);
      expect(rm.statusCode()).toBe(200);
    });

    it("returns 429 when Redis count exceeds the limit", async () => {
      setRedisCount(ipOpts.max + 1); // already over
      const middleware = createIpRateLimiter(ipOpts);
      const req = makeReq({ ip: "redis-5.6.7.8" });
      const rm = makeRes();

      const { nextCalled } = await runMiddleware(middleware, req, rm.res);

      expect(nextCalled).toBe(false);
      expect(rm.statusCode()).toBe(429);
    });

    it("sets Retry-After header when Redis signals rate-limit exceeded", async () => {
      setRedisCount(ipOpts.max + 2);
      const middleware = createIpRateLimiter(ipOpts);
      const req = makeReq({ ip: "redis-9.10.11.12" });
      const rm = makeRes();

      await runMiddleware(middleware, req, rm.res);

      const retryAfter = Number(rm.headers()["Retry-After"]);
      expect(retryAfter).toBeGreaterThan(0);
    });

    it("emits a warn log with expected fields when Redis signals 429", async () => {
      setRedisCount(ipOpts.max + 1);
      const middleware = createIpRateLimiter(ipOpts);
      const req = makeReq({ ip: "redis-13.14.15.16" });
      const rm = makeRes();

      await runMiddleware(middleware, req, rm.res);

      const reqLogWarn = (req as unknown as { _warnSpy: ReturnType<typeof vi.fn> })._warnSpy;
      expect(reqLogWarn).toHaveBeenCalledOnce();

      const [fields, message] = reqLogWarn.mock.calls[0] as [Record<string, unknown>, string];
      expect(message).toBe("rate limit exceeded");
      expect(fields).toMatchObject({
        rateLimitName: ipOpts.name,
        route: "/api/test",
        windowCount: ipOpts.max + 1,
      });
    });

    it("falls back to in-memory when Redis pipeline throws", async () => {
      redisMocks.mockExec.mockRejectedValueOnce(new Error("Redis timeout"));
      // Memory store starts fresh, so count will be 1 → allowed.
      const middleware = createIpRateLimiter(ipOpts);
      const req = makeReq({ ip: "redis-fallback-17.18.19.20" });
      const rm = makeRes();

      const { nextCalled } = await runMiddleware(middleware, req, rm.res);

      expect(nextCalled).toBe(true);
    });
  });

  describe("User rate limiter", () => {
    it("passes the request when Redis count is within the limit", async () => {
      setRedisCount(1);
      const middleware = createUserRateLimiter(userOpts);
      const req = makeReq({ uid: "redis-user-pass" });
      const rm = makeRes();

      const { nextCalled } = await runMiddleware(middleware, req, rm.res);

      expect(nextCalled).toBe(true);
    });

    it("returns 429 when Redis count exceeds the per-user limit", async () => {
      setRedisCount(userOpts.max + 1);
      const middleware = createUserRateLimiter(userOpts);
      const req = makeReq({ uid: "redis-user-block" });
      const rm = makeRes();

      await runMiddleware(middleware, req, rm.res);

      expect(rm.statusCode()).toBe(429);
    });

    it("sets the Retry-After header when Redis signals per-user limit exceeded", async () => {
      setRedisCount(userOpts.max + 1);
      const middleware = createUserRateLimiter(userOpts);
      const req = makeReq({ uid: "redis-user-retry-after" });
      const rm = makeRes();

      await runMiddleware(middleware, req, rm.res);

      const retryAfter = Number(rm.headers()["Retry-After"]);
      expect(retryAfter).toBeGreaterThan(0);
    });

    it("emits a warn log with rateLimitName, keyHash, route, windowCount on 429", async () => {
      setRedisCount(userOpts.max + 1);
      const middleware = createUserRateLimiter(userOpts);
      const req = makeReq({ uid: "redis-user-log" });
      const rm = makeRes();

      await runMiddleware(middleware, req, rm.res);

      const reqLogWarn = (req as unknown as { _warnSpy: ReturnType<typeof vi.fn> })._warnSpy;
      expect(reqLogWarn).toHaveBeenCalledOnce();

      const [fields, message] = reqLogWarn.mock.calls[0] as [Record<string, unknown>, string];
      expect(message).toBe("rate limit exceeded");
      expect(fields).toMatchObject({
        rateLimitName: userOpts.name,
        route: "/api/test",
        windowCount: userOpts.max + 1,
      });
      expect((fields["keyHash"] as string).length).toBe(12);
    });
  });
});

// ---------------------------------------------------------------------------
// 3. AlertAggregator burst-coalescing behaviour
// ---------------------------------------------------------------------------

describe("AlertAggregator burst-coalescing", () => {
  beforeEach(() => {
    redisMocks.mockRedisInstance.status = "close";
    process.env["REDIS_URL"] = "redis://localhost:6379";
  });

  afterEach(() => {
    // Reset the aggregator clock back to real Date.now after each test.
    _alertAggregatorForTest.now = Date.now;
  });

  it("emits exactly one warn log for the first 429 in a burst; subsequent hits within the burst window are silently absorbed", async () => {
    // Unique limiter name ensures no key collision with other tests in the shared AlertAggregator.
    const middleware = createIpRateLimiter({ windowMs: 60_000, max: 1, name: "burst-first-hit" });
    const ip = "192.168.200.1";

    // First request passes (within limit).
    await runMiddleware(middleware, makeReq({ ip }), makeRes().res);

    // Second request — first 429 in the burst — should log "rate limit exceeded".
    const firstBlocked = makeReq({ ip });
    await runMiddleware(middleware, firstBlocked, makeRes().res);

    // Third request — still within the burst window — should be silently absorbed.
    const secondBlocked = makeReq({ ip });
    await runMiddleware(middleware, secondBlocked, makeRes().res);

    const firstSpy = (firstBlocked as unknown as { _warnSpy: ReturnType<typeof vi.fn> })._warnSpy;
    const secondSpy = (secondBlocked as unknown as { _warnSpy: ReturnType<typeof vi.fn> })._warnSpy;

    expect(firstSpy).toHaveBeenCalledOnce();
    const [, firstMsg] = firstSpy.mock.calls[0] as [unknown, string];
    expect(firstMsg).toBe("rate limit exceeded");

    expect(secondSpy).not.toHaveBeenCalled();
  });

  it("emits a 'burst in progress' warn log after every ALERT_LOG_EVERY_N (10) accumulated hits within the burst window", async () => {
    const middleware = createIpRateLimiter({ windowMs: 60_000, max: 1, name: "burst-progress" });
    const ip = "192.168.200.2";

    // Exhaust the limit (1 allowed request).
    await runMiddleware(middleware, makeReq({ ip }), makeRes().res);

    // First 429 — burst starts, hitCount=1, lastLoggedCount=1 — logs "rate limit exceeded".
    const firstBlocked = makeReq({ ip });
    await runMiddleware(middleware, firstBlocked, makeRes().res);

    // Hits 2–10 within the burst (9 absorbed requests).
    for (let i = 0; i < 9; i++) {
      await runMiddleware(middleware, makeReq({ ip }), makeRes().res);
    }

    // Hit 11 — newHits since last log = 10 >= ALERT_LOG_EVERY_N — logs "rate limit burst in progress".
    const eleventhBlocked = makeReq({ ip });
    await runMiddleware(middleware, eleventhBlocked, makeRes().res);

    const firstSpy = (firstBlocked as unknown as { _warnSpy: ReturnType<typeof vi.fn> })._warnSpy;
    const eleventhSpy = (eleventhBlocked as unknown as { _warnSpy: ReturnType<typeof vi.fn> })._warnSpy;

    // First 429 should have logged exactly once.
    expect(firstSpy).toHaveBeenCalledOnce();

    // Eleventh 429 should trigger the intermediate summary.
    expect(eleventhSpy).toHaveBeenCalledOnce();
    const [fields, msg] = eleventhSpy.mock.calls[0] as [Record<string, unknown>, string];
    expect(msg).toBe("rate limit burst in progress");
    expect(fields).toMatchObject({ hitCount: 11 });
  });

  it("emits a 'burst ended' warn via logger when the sweep timer fires after a burst goes quiet", async () => {
    // Use a controlled clock so we can advance time without patching global timers.
    let fakeNow = Date.now();
    _alertAggregatorForTest.now = () => fakeNow;

    const middleware = createIpRateLimiter({ windowMs: 60_000, max: 1, name: "sweep-flush" });
    const ip = "192.168.200.10";

    // Exhaust the limit (1 allowed request).
    await runMiddleware(middleware, makeReq({ ip }), makeRes().res);

    // First 429: hitCount=1, lastLoggedCount=1 → logs "rate limit exceeded".
    await runMiddleware(middleware, makeReq({ ip }), makeRes().res);

    // Second 429: silently absorbed → hitCount=2, lastLoggedCount=1 (1 unreported hit pending flush).
    await runMiddleware(middleware, makeReq({ ip }), makeRes().res);

    // Isolate the upcoming flush assertion.
    loggerMocks.warn.mockClear();

    // Advance the injected clock past the 10-second burst window — the burst is now "quiet".
    fakeNow += 10_001;

    // Simulate the periodic sweep timer firing (no real setInterval wait needed).
    _alertAggregatorForTest.triggerSweep();

    // The sweep should have flushed the quiet burst and emitted the "burst ended" summary.
    expect(loggerMocks.warn).toHaveBeenCalledWith(
      expect.objectContaining({ hitCount: 2, rateLimitName: "sweep-flush" }),
      "rate limit burst ended",
    );
  });

  it("emits a 'burst ended' warn via logger when the burst window expires and a new hit arrives", async () => {
    // Use a controlled clock so we can advance time without patching global timers.
    let fakeNow = Date.now();
    _alertAggregatorForTest.now = () => fakeNow;

    const middleware = createIpRateLimiter({ windowMs: 60_000, max: 1, name: "burst-ended" });
    const ip = "192.168.200.3";

    // Exhaust the limit.
    await runMiddleware(middleware, makeReq({ ip }), makeRes().res);

    // First 429: hitCount=1, lastLoggedCount=1 → logs "rate limit exceeded".
    await runMiddleware(middleware, makeReq({ ip }), makeRes().res);

    // Second 429: absorbed → hitCount=2, lastLoggedCount=1 (1 unreported hit pending flush).
    await runMiddleware(middleware, makeReq({ ip }), makeRes().res);

    // Isolate the upcoming flush assertion.
    loggerMocks.warn.mockClear();

    // Advance the injected clock past the 10-second burst window but stay within the
    // 60-second rate-limit window so the MemoryStore still blocks the next request.
    fakeNow += 10_001;

    // A new 429 from the same key arrives — record() detects the expired burst and calls
    // flushEntry() inline, which emits the "burst ended" summary via logger.warn.
    await runMiddleware(middleware, makeReq({ ip }), makeRes().res);

    expect(loggerMocks.warn).toHaveBeenCalledWith(
      expect.objectContaining({ hitCount: 2, rateLimitName: "burst-ended" }),
      "rate limit burst ended",
    );
  });

  it("emits 'burst ended' exactly once when triggerSweep() is called twice after a burst goes quiet", async () => {
    let fakeNow = Date.now();
    _alertAggregatorForTest.now = () => fakeNow;

    const middleware = createIpRateLimiter({ windowMs: 60_000, max: 1, name: "sweep-idempotent" });
    const ip = "192.168.200.20";

    // Exhaust the limit (1 allowed request).
    await runMiddleware(middleware, makeReq({ ip }), makeRes().res);

    // First 429: hitCount=1, lastLoggedCount=1 → logs "rate limit exceeded".
    await runMiddleware(middleware, makeReq({ ip }), makeRes().res);

    // Second 429: absorbed → hitCount=2, lastLoggedCount=1 (1 unreported hit pending flush).
    await runMiddleware(middleware, makeReq({ ip }), makeRes().res);

    // Isolate the upcoming flush assertions.
    loggerMocks.warn.mockClear();

    // Advance past the 10-second burst window so the burst is now quiet.
    fakeNow += 10_001;

    // First sweep — should flush the quiet burst and emit "rate limit burst ended" once.
    _alertAggregatorForTest.triggerSweep();

    // Second sweep — entry was already deleted; nothing to flush, no duplicate log.
    _alertAggregatorForTest.triggerSweep();

    const burstEndedCalls = loggerMocks.warn.mock.calls.filter(
      ([, msg]) => msg === "rate limit burst ended",
    );
    expect(burstEndedCalls).toHaveLength(1);
    expect(burstEndedCalls[0]![0]).toMatchObject({ hitCount: 2, rateLimitName: "sweep-idempotent" });
  });

  it("stays silent at sweep time when all burst hits were already reported via intermediate summaries (unreported === 0)", async () => {
    let fakeNow = Date.now();
    _alertAggregatorForTest.now = () => fakeNow;

    const middleware = createIpRateLimiter({ windowMs: 60_000, max: 1, name: "sweep-fully-logged" });
    const ip = "192.168.201.10";

    // Exhaust the limit (1 allowed request).
    await runMiddleware(middleware, makeReq({ ip }), makeRes().res);

    // First 429: hitCount=1, lastLoggedCount=1 — logs "rate limit exceeded".
    await runMiddleware(middleware, makeReq({ ip }), makeRes().res);

    // Fire 10 more 429s within the burst window.
    // Hits 2–10 are silently absorbed; hit 11 crosses the ALERT_LOG_EVERY_N threshold
    // and logs "rate limit burst in progress", setting lastLoggedCount=11=hitCount.
    for (let i = 0; i < 10; i++) {
      await runMiddleware(middleware, makeReq({ ip }), makeRes().res);
    }

    // At this point hitCount === lastLoggedCount === 11, so unreported === 0.

    // Isolate sweep assertions — clear any warn calls from above.
    loggerMocks.warn.mockClear();

    // Advance past the 10-second burst window so the burst is now quiet.
    fakeNow += 10_001;

    // Sweep — flushEntry should detect unreported===0 and emit nothing.
    _alertAggregatorForTest.triggerSweep();

    const burstEndedCalls = loggerMocks.warn.mock.calls.filter(
      ([, msg]) => msg === "rate limit burst ended",
    );
    expect(burstEndedCalls).toHaveLength(0);
  });
});
