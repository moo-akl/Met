/**
 * Reveal endpoint error-rate monitor.
 *
 * Tracks success/failure outcomes for `POST /api/reveals/accept` and
 * `POST /api/reveals/decline` in a fixed 5-minute sliding window.
 * When the error rate exceeds 5% (and at least MIN_CALLS_FOR_ALERT calls
 * have been recorded) a structured `logger.error` is emitted with
 * `alert: "reveal_error_rate_exceeded"` so the log can be picked up by
 * any alerting policy attached to Cloud Logging (e.g. a log-based metric
 * filter on that field).
 *
 * Redis-backed (fleet-wide) counting
 * ------------------------------------
 * When REDIS_URL is set, error and total counts are accumulated in Redis
 * using fixed-window INCR keys that expire at the end of each window.
 * This gives accurate fleet-wide visibility across multiple server instances
 * — any instance can alert when the aggregate rate crosses the threshold.
 *
 * Falls back to in-process tracking when Redis is unavailable (same pattern
 * as the rate limiter), so the monitor remains functional in local dev and
 * during transient Redis outages.
 *
 * Redis key format: `rm:<endpoint_key>:total:<windowStart>`
 *                   `rm:<endpoint_key>:errors:<windowStart>`
 *   - <endpoint_key> — short stable identifier (e.g. "accept", "decline")
 *   - <windowStart>  — unix second of the current window start
 */

import Redis from "ioredis";
import { logger } from "./logger";

const WINDOW_MS = 5 * 60_000;
const WINDOW_SEC = WINDOW_MS / 1000;
const ERROR_RATE_THRESHOLD = 0.05;
const MIN_CALLS_FOR_ALERT = 5;

// ---------------------------------------------------------------------------
// Redis client — created once, shared across monitor instances.
// ---------------------------------------------------------------------------

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url) return null;

  redisClient = new Redis(url, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    lazyConnect: false,
  });

  redisClient.on("error", (err: Error) => {
    logger.error(
      { err },
      "Redis client error — reveal monitor falling back to memory",
    );
  });

  return redisClient;
}

// Exported for tests only — allows injecting a mock Redis client.
export function _setRedisClientForTest(client: Redis | null): void {
  redisClient = client;
}

// ---------------------------------------------------------------------------
// In-process fallback
// ---------------------------------------------------------------------------

interface CallRecord {
  ts: number;
  isError: boolean;
}

// ---------------------------------------------------------------------------
// Monitor
// ---------------------------------------------------------------------------

class RevealEndpointMonitor {
  private records: CallRecord[] = [];
  private readonly endpoint: string;
  private readonly key: string;

  constructor(endpoint: string, key: string) {
    this.endpoint = endpoint;
    this.key = key;
  }

  /**
   * Record one completed call.
   *
   * Fire-and-forget — the caller (res.on("finish")) does not need to await.
   * Returns the Promise so tests can await the Redis I/O if needed.
   */
  record(isError: boolean): Promise<void> {
    return this.recordAsync(isError);
  }

  private async recordAsync(isError: boolean): Promise<void> {
    const redis = getRedisClient();

    if (redis && redis.status === "ready") {
      try {
        await this.recordRedis(redis, isError);
        return;
      } catch (err) {
        logger.warn(
          { err },
          "Redis reveal monitor record failed — falling back to memory",
        );
      }
    }

    this.recordMemory(isError);
  }

  // -------------------------------------------------------------------------
  // Redis path
  // -------------------------------------------------------------------------

  private async recordRedis(redis: Redis, isError: boolean): Promise<void> {
    const nowSec = Math.floor(Date.now() / 1000);
    const windowStart = nowSec - (nowSec % WINDOW_SEC);
    const windowEnd = windowStart + WINDOW_SEC;

    const totalKey = `rm:${this.key}:total:${windowStart}`;
    const errorsKey = `rm:${this.key}:errors:${windowStart}`;

    const pipeline = redis.pipeline();
    pipeline.incr(totalKey);
    pipeline.expireat(totalKey, windowEnd);

    if (isError) {
      pipeline.incr(errorsKey);
      pipeline.expireat(errorsKey, windowEnd);
    }

    const results = await pipeline.exec();
    if (!results) return;

    // results[0] is [err, newTotal] from INCR totalKey
    const total = results[0]?.[1] as number | null;
    if (total == null) return;

    if (!isError) return; // no alert check needed for successes

    // results[2] is [err, newErrors] from INCR errorsKey (only when isError)
    const errors = results[2]?.[1] as number | null;
    if (errors == null) return;

    if (total >= MIN_CALLS_FOR_ALERT) {
      const errorRate = errors / total;
      if (errorRate > ERROR_RATE_THRESHOLD) {
        this.emitAlert(errors, total, errorRate);
      }
    }
  }

  // -------------------------------------------------------------------------
  // In-process fallback path
  // -------------------------------------------------------------------------

  private recordMemory(isError: boolean): void {
    const now = Date.now();
    const cutoff = now - WINDOW_MS;

    this.records.push({ ts: now, isError });

    // Prune records outside the window. We prune on every call so
    // memory stays O(calls-in-window) rather than O(all-time-calls).
    this.records = this.records.filter((r) => r.ts >= cutoff);

    if (isError) {
      this.maybeAlertMemory(cutoff);
    }
  }

  private maybeAlertMemory(cutoff: number): void {
    const window = this.records.filter((r) => r.ts >= cutoff);
    const total = window.length;
    if (total < MIN_CALLS_FOR_ALERT) return;

    const errors = window.filter((r) => r.isError).length;
    const errorRate = errors / total;
    if (errorRate <= ERROR_RATE_THRESHOLD) return;

    this.emitAlert(errors, total, errorRate);
  }

  // -------------------------------------------------------------------------
  // Shared alert emission
  // -------------------------------------------------------------------------

  private emitAlert(errors: number, total: number, errorRate: number): void {
    logger.error(
      {
        alert: "reveal_error_rate_exceeded",
        endpoint: this.endpoint,
        errorCount: errors,
        totalCount: total,
        errorRatePct: Math.round(errorRate * 100),
        thresholdPct: Math.round(ERROR_RATE_THRESHOLD * 100),
        windowMs: WINDOW_MS,
      },
      `ALERT: ${this.endpoint} error rate ${Math.round(errorRate * 100)}% ` +
        `exceeds ${Math.round(ERROR_RATE_THRESHOLD * 100)}% threshold ` +
        `(${errors}/${total} calls in last ${WINDOW_MS / 60_000} min)`,
    );
  }
}

const acceptMonitor = new RevealEndpointMonitor(
  "POST /api/reveals/accept",
  "accept",
);
const declineMonitor = new RevealEndpointMonitor(
  "POST /api/reveals/decline",
  "decline",
);

/**
 * Record one completed call for a reveal write endpoint.
 *
 * `isError` should be true for any HTTP ≥ 500 response or unhandled exception.
 * 4xx responses (validation, 404 not-found) are NOT counted as errors because
 * they represent normal client-side conditions (e.g. no pending request).
 *
 * @param endpoint - which endpoint handled the request
 * @param statusCode - the HTTP status code that was sent to the client
 */
export function recordRevealOutcome(
  endpoint: "accept" | "decline",
  statusCode: number,
): Promise<void> {
  const isError = statusCode >= 500;
  if (endpoint === "accept") {
    return acceptMonitor.record(isError);
  } else {
    return declineMonitor.record(isError);
  }
}
