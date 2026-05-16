/**
 * Fixed-window rate limiter middleware backed by Redis (ioredis).
 *
 * When REDIS_URL is set the limiter uses Redis INCR + EXPIREAT for atomic,
 * distributed counting that works correctly across multiple server instances
 * and survives restarts. When REDIS_URL is absent (local development) an
 * in-memory Map is used as a fallback so the server remains fully functional
 * without a Redis dependency.
 *
 * Redis key format: `rl:<name>:<key>:<windowStart>`
 *   - <name>   — limiter label (e.g. "ip", "user-write")
 *   - <key>    — per-client identifier (IP or UID)
 *   - <windowStart> — unix second of the current window start, used to bucket
 *                     requests into fixed windows without a separate TTL lookup
 *
 * IP identity:
 *   The IP key is derived from `req.ip`, which Express populates using the
 *   `trust proxy` setting in app.ts. With `trust proxy: 1`, Express trusts
 *   one upstream hop of X-Forwarded-For and returns the first untrusted IP
 *   from the right — preventing clients from spoofing their apparent address
 *   by injecting arbitrary values into the header.
 *   If the deployment gains additional proxy layers, increase `trust proxy`
 *   accordingly.
 *
 * Log aggregation:
 *   Repeated 429s from the same source within a burst window are coalesced to
 *   avoid flooding logs. The first hit is always logged immediately. Subsequent
 *   hits within the burst window are silently counted; a summary log is emitted
 *   every ALERT_LOG_EVERY_N hits and once more when the burst window closes.
 */

import type { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import Redis from "ioredis";
import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the first 12 hex characters of the SHA-256 of `value`.
 * Used to include a stable fingerprint of an IP or UID in log entries
 * without recording plaintext PII.
 */
function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

// ---------------------------------------------------------------------------
// Alert aggregator — coalesces burst 429 log entries per (name, keyHash)
// ---------------------------------------------------------------------------

/**
 * How long (ms) a burst window stays open after the last hit before the
 * aggregator flushes a final summary and resets.
 */
const ALERT_BURST_WINDOW_MS = 10_000; // 10 seconds

/**
 * Emit an intermediate summary every N hits so very active abusers are
 * still visible without producing one log line per request.
 */
const ALERT_LOG_EVERY_N = 10;

interface BurstEntry {
  /** Total hits recorded in the current burst window. */
  hitCount: number;
  /** Timestamp of the first hit in this burst. */
  burstStartMs: number;
  /** Timestamp of the most recent hit — used to expire quiet bursts. */
  lastHitMs: number;
  /** hitCount at the time of the last log emission (to detect new growth). */
  lastLoggedCount: number;
  /** Stored here so the sweep/flush path never needs to parse the map key. */
  name: string;
  keyHash: string;
}

class AlertAggregator {
  private readonly bursts = new Map<string, BurstEntry>();
  private readonly sweepTimer: ReturnType<typeof setInterval>;
  /** Clock function — defaults to `Date.now`; can be overridden in tests. */
  now: () => number;

  constructor(now?: () => number) {
    this.now = now ?? Date.now;
    // Sweep every half burst-window to flush entries that have gone quiet.
    this.sweepTimer = setInterval(
      () => this.sweep(),
      ALERT_BURST_WINDOW_MS / 2,
    );
    this.sweepTimer.unref();
  }

  /**
   * Record one 429 hit for the given (name, keyHash).
   *
   * Returns a log context object when a log line should be emitted, or `null`
   * when the hit is silently absorbed into the current burst.
   */
  record(
    name: string,
    keyHash: string,
    extraFields: Record<string, unknown>,
  ): {
    fields: Record<string, unknown>;
    message: string;
  } | null {
    const mapKey = `${name}:${keyHash}`;
    const now = this.now();
    const existing = this.bursts.get(mapKey);

    if (!existing || now - existing.lastHitMs > ALERT_BURST_WINDOW_MS) {
      // Flush any unreported hits from the previous burst before resetting.
      // This covers the case where a new hit arrives after the burst window
      // expires but before the periodic sweep timer runs — without this flush
      // those accumulated counts would be silently dropped.
      if (existing) {
        this.flushEntry(existing);
      }

      // First hit of a new burst — always log immediately.
      this.bursts.set(mapKey, {
        hitCount: 1,
        burstStartMs: now,
        lastHitMs: now,
        lastLoggedCount: 1,
        name,
        keyHash,
      });
      return {
        fields: { ...extraFields, hitCount: 1 },
        message: "rate limit exceeded",
      };
    }

    // Within an active burst window — accumulate.
    existing.hitCount += 1;
    existing.lastHitMs = now;

    const newHits = existing.hitCount - existing.lastLoggedCount;
    if (newHits >= ALERT_LOG_EVERY_N) {
      existing.lastLoggedCount = existing.hitCount;
      return {
        fields: {
          ...extraFields,
          hitCount: existing.hitCount,
          burstDurationMs: now - existing.burstStartMs,
        },
        message: "rate limit burst in progress",
      };
    }

    // Absorb silently.
    return null;
  }

  /**
   * Emit a final summary log for an entry if it has unreported hits.
   * Called both by the sweep timer and inline in record() when a burst expires.
   */
  private flushEntry(entry: BurstEntry): void {
    const unreported = entry.hitCount - entry.lastLoggedCount;
    if (unreported > 0) {
      logger.warn(
        {
          rateLimitName: entry.name,
          keyHash: entry.keyHash,
          hitCount: entry.hitCount,
          burstDurationMs: entry.lastHitMs - entry.burstStartMs,
        },
        "rate limit burst ended",
      );
    }
  }

  /**
   * Exposed for tests only — triggers the same logic as the periodic sweep
   * timer without requiring fake timers or real waits.
   */
  triggerSweep(): void {
    this.sweep();
  }

  /**
   * Flush burst entries that have gone quiet (no hit for a full burst window).
   * Emits a final summary if there are unreported hits since the last log.
   */
  private sweep(): void {
    const now = this.now();
    for (const [mapKey, entry] of this.bursts) {
      if (now - entry.lastHitMs < ALERT_BURST_WINDOW_MS) continue;
      this.flushEntry(entry);
      this.bursts.delete(mapKey);
    }
  }
}

const alertAggregator = new AlertAggregator();

/** Exported for testing only — allows overriding the clock without fake timers. */
export const _alertAggregatorForTest = alertAggregator;

// ---------------------------------------------------------------------------
// Redis client — created once, shared across all limiter instances.
// ---------------------------------------------------------------------------

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url) return null;

  redisClient = new Redis(url, {
    // Fail fast on connection errors rather than queuing commands indefinitely.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    lazyConnect: false,
  });

  redisClient.on("error", (err: Error) => {
    logger.error({ err }, "Redis client error — rate limiter falling back to memory");
  });

  return redisClient;
}

// ---------------------------------------------------------------------------
// In-memory fallback (local dev / no REDIS_URL)
// ---------------------------------------------------------------------------

interface WindowEntry {
  count: number;
  windowStart: number;
}

class MemoryStore {
  private readonly store = new Map<string, WindowEntry>();
  private readonly windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
    setInterval(() => this.sweep(), 5 * 60 * 1000).unref();
  }

  check(key: string): { count: number; windowExpiresSec: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.store.set(key, { count: 1, windowStart: now });
      return { count: 1, windowExpiresSec: Math.ceil(this.windowMs / 1000) };
    }

    entry.count += 1;
    const windowExpiresSec = Math.ceil(
      (this.windowMs - (now - entry.windowStart)) / 1000,
    );
    return { count: entry.count, windowExpiresSec };
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now - entry.windowStart >= this.windowMs) {
        this.store.delete(key);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Core limiter
// ---------------------------------------------------------------------------

interface RateLimiterOptions {
  /** Duration of each fixed window in milliseconds. */
  windowMs: number;
  /** Maximum number of requests allowed within one window. */
  max: number;
  /** Human-readable label used in Redis keys and log messages. */
  name?: string;
}

class RateLimiter {
  private readonly windowMs: number;
  private readonly max: number;
  private readonly name: string;
  private readonly memoryStore: MemoryStore;

  constructor(opts: RateLimiterOptions) {
    this.windowMs = opts.windowMs;
    this.max = opts.max;
    this.name = opts.name ?? "rl";
    this.memoryStore = new MemoryStore(opts.windowMs);
  }

  async check(key: string): Promise<{ allowed: boolean; count: number; retryAfterSec: number }> {
    const redis = getRedisClient();

    if (redis && redis.status === "ready") {
      return this.checkRedis(redis, key);
    }

    return this.checkMemory(key);
  }

  private async checkRedis(
    redis: Redis,
    key: string,
  ): Promise<{ allowed: boolean; count: number; retryAfterSec: number }> {
    const windowSec = Math.ceil(this.windowMs / 1000);
    const nowSec = Math.floor(Date.now() / 1000);
    const windowStart = nowSec - (nowSec % windowSec);
    const windowEnd = windowStart + windowSec;
    const redisKey = `rl:${this.name}:${key}:${windowStart}`;

    try {
      const pipeline = redis.pipeline();
      pipeline.incr(redisKey);
      pipeline.expireat(redisKey, windowEnd);
      const results = await pipeline.exec();

      // results[0] is [error, count] from INCR
      const count = results?.[0]?.[1] as number | null;
      if (count == null) throw new Error("unexpected null from INCR");

      const retryAfterSec = windowEnd - nowSec;
      return {
        allowed: count <= this.max,
        count,
        retryAfterSec: count > this.max ? retryAfterSec : 0,
      };
    } catch (err) {
      logger.warn({ err, key }, "Redis rate limit check failed — falling back to memory");
      return this.checkMemory(key);
    }
  }

  private checkMemory(key: string): { allowed: boolean; count: number; retryAfterSec: number } {
    const { count, windowExpiresSec } = this.memoryStore.check(key);
    return {
      allowed: count <= this.max,
      count,
      retryAfterSec: count > this.max ? windowExpiresSec : 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Shared log helper — runs a 429 through the aggregator and emits if needed
// ---------------------------------------------------------------------------

function logRateLimitExceeded(
  req: Request,
  name: string,
  key: string,
  count: number,
  retryAfterSec: number,
): void {
  const baseFields = {
    rateLimitName: name,
    keyHash: hashKey(key),
    route: req.path,
    method: req.method,
    windowCount: count,
    retryAfterSec,
  };

  const entry = alertAggregator.record(name, hashKey(key), baseFields);
  if (!entry) return; // silently absorbed into burst

  const log = req.log ?? logger;
  log.warn(entry.fields, entry.message);
}

// ---------------------------------------------------------------------------
// Middleware factories
// ---------------------------------------------------------------------------

/**
 * Builds an Express middleware that rate-limits by **IP address**.
 * Intended for global application to all routes.
 *
 * Default: 100 requests per minute per IP.
 */
export function createIpRateLimiter(
  opts: RateLimiterOptions = { windowMs: 60_000, max: 100, name: "ip" },
) {
  const limiter = new RateLimiter(opts);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // `req.ip` is set by Express using `trust proxy` configuration in app.ts.
    // With `trust proxy: 1`, Express strips the client-injected portion of
    // the X-Forwarded-For chain and returns the IP from the trusted upstream
    // hop — preventing header-spoofing bypasses.
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

    const { allowed, count, retryAfterSec } = await limiter.check(ip);

    if (!allowed) {
      logRateLimitExceeded(req, opts.name ?? "ip", ip, count, retryAfterSec);
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({
        message: `Too many requests — please retry after ${retryAfterSec} second(s).`,
      });
      return;
    }

    next();
  };
}

/**
 * Builds an Express middleware that rate-limits by **authenticated user UID**.
 * Must be placed AFTER `requireUid` so that `req.uid` is already populated.
 * Falls back to IP-based keying when `req.uid` is not set (should not happen
 * on protected routes, but provides a safe default).
 *
 * Default: 30 requests per minute per user — suitable for write endpoints.
 */
export function createUserRateLimiter(
  opts: RateLimiterOptions = { windowMs: 60_000, max: 30, name: "user-write" },
) {
  const limiter = new RateLimiter(opts);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Prefer UID (always set after requireUid). Fall back to req.ip so
    // the key remains proxy-aware even in the unlikely case uid is absent.
    const key = req.uid ?? req.ip ?? req.socket.remoteAddress ?? "unknown";
    const { allowed, count, retryAfterSec } = await limiter.check(key);

    if (!allowed) {
      logRateLimitExceeded(req, opts.name ?? "user-write", key, count, retryAfterSec);
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({
        message: `Too many requests — please retry after ${retryAfterSec} second(s).`,
      });
      return;
    }

    next();
  };
}
