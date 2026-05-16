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
 */

import type { Request, Response, NextFunction } from "express";
import Redis from "ioredis";
import { logger } from "../lib/logger";

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

  async check(key: string): Promise<{ allowed: boolean; retryAfterSec: number }> {
    const redis = getRedisClient();

    if (redis && redis.status === "ready") {
      return this.checkRedis(redis, key);
    }

    return this.checkMemory(key);
  }

  private async checkRedis(
    redis: Redis,
    key: string,
  ): Promise<{ allowed: boolean; retryAfterSec: number }> {
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
        retryAfterSec: count > this.max ? retryAfterSec : 0,
      };
    } catch (err) {
      logger.warn({ err, key }, "Redis rate limit check failed — falling back to memory");
      return this.checkMemory(key);
    }
  }

  private checkMemory(key: string): { allowed: boolean; retryAfterSec: number } {
    const { count, windowExpiresSec } = this.memoryStore.check(key);
    return {
      allowed: count <= this.max,
      retryAfterSec: count > this.max ? windowExpiresSec : 0,
    };
  }
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

    const { allowed, retryAfterSec } = await limiter.check(ip);

    if (!allowed) {
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
    const { allowed, retryAfterSec } = await limiter.check(key);

    if (!allowed) {
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({
        message: `Too many requests — please retry after ${retryAfterSec} second(s).`,
      });
      return;
    }

    next();
  };
}
