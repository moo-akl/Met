import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

describe("RevealEndpointMonitor via recordRevealOutcome", () => {
  let recordRevealOutcome: (
    endpoint: "accept" | "decline",
    statusCode: number,
  ) => void;
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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("fires an alert when error rate exceeds 5% with at least 5 calls", () => {
    // 10 calls: 2 errors (20%) — well above the 5% threshold
    for (let i = 0; i < 8; i++) {
      recordRevealOutcome("accept", 200);
    }
    recordRevealOutcome("accept", 500);
    recordRevealOutcome("accept", 500);

    expect(loggerErrorSpy).toHaveBeenCalledTimes(2);
    const firstCall = loggerErrorSpy.mock.calls[0][0];
    expect(firstCall.alert).toBe("reveal_error_rate_exceeded");
    expect(firstCall.endpoint).toBe("POST /api/reveals/accept");
    expect(firstCall.errorCount).toBeGreaterThanOrEqual(1);
    expect(firstCall.totalCount).toBeGreaterThanOrEqual(5);
    expect(firstCall.errorRatePct).toBeGreaterThan(5);
  });

  it("does NOT fire an alert when error rate is at or below 5%", () => {
    // 20 calls: 1 error (5%) — at threshold, no alert
    for (let i = 0; i < 19; i++) {
      recordRevealOutcome("accept", 200);
    }
    recordRevealOutcome("accept", 500);

    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it("does NOT fire an alert when fewer than 5 calls have been recorded", () => {
    // 4 calls total, all errors — minimum not met
    for (let i = 0; i < 4; i++) {
      recordRevealOutcome("accept", 500);
    }

    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it("does NOT count 4xx responses as errors", () => {
    // 8 x 2xx + 10 x 4xx = well above min calls, but 4xx are NOT errors
    for (let i = 0; i < 8; i++) {
      recordRevealOutcome("decline", 200);
    }
    for (let i = 0; i < 10; i++) {
      recordRevealOutcome("decline", 404);
    }

    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it("discards records older than 5 minutes from the window", () => {
    // Record 4 errors just under the minimum (so no alert yet)
    for (let i = 0; i < 4; i++) {
      recordRevealOutcome("accept", 500);
    }

    // Advance time past the 5-minute window
    vi.advanceTimersByTime(5 * 60_000 + 1);

    // New calls — 5 fresh ones, only 1 error (20%), but old errors are gone
    // so effective window has 4 successes + 1 error = 5 total, 1 error = 20%
    // This SHOULD alert because error rate is > 5% with ≥ 5 total calls
    for (let i = 0; i < 4; i++) {
      recordRevealOutcome("accept", 200);
    }
    recordRevealOutcome("accept", 500);

    // Alert fires only for the new window (the old 4 errors were pruned)
    expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    const call = loggerErrorSpy.mock.calls[0][0];
    expect(call.alert).toBe("reveal_error_rate_exceeded");
    // totalCount should reflect only the new calls, not the old pruned ones
    expect(call.totalCount).toBe(5);
    expect(call.errorCount).toBe(1);
  });

  it("tracks accept and decline endpoints independently", () => {
    // Trigger alert on accept (10 calls, 2 errors = 20%)
    for (let i = 0; i < 8; i++) {
      recordRevealOutcome("accept", 200);
    }
    recordRevealOutcome("accept", 500);
    recordRevealOutcome("accept", 500);

    // Decline stays clean
    for (let i = 0; i < 10; i++) {
      recordRevealOutcome("decline", 200);
    }

    const alertCalls = loggerErrorSpy.mock.calls.filter(
      (c) => c[0].alert === "reveal_error_rate_exceeded",
    );
    const endpoints = alertCalls.map((c) => c[0].endpoint);
    expect(endpoints.every((e: string) => e === "POST /api/reveals/accept")).toBe(true);
  });

  it("includes structured fields in the alert payload", () => {
    for (let i = 0; i < 8; i++) {
      recordRevealOutcome("decline", 200);
    }
    recordRevealOutcome("decline", 500);
    recordRevealOutcome("decline", 500);

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
