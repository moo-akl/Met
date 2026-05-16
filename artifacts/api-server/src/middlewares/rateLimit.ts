/**
 * In-memory fixed-window rate limiter middleware.
 *
 * Each key (IP address or user UID) gets `max` requests per `windowMs`.
 * When the limit is exceeded the middleware responds with HTTP 429 and a
 * `Retry-After` header indicating how many seconds remain in the current
 * window.
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
 * Upgrade path to Redis:
 *   Replace the `store` Map with a Redis client and use INCR + EXPIREAT
 *   commands for atomic, distributed counting.  The `RateLimiter` class
 *   interface would remain the same; only `check` needs to be swapped out.
 */

import type { Request, Response, NextFunction } from "express";

interface WindowEntry {
  count: number;
  windowStart: number;
}

interface RateLimiterOptions {
  /** Duration of each fixed window in milliseconds. */
  windowMs: number;
  /** Maximum number of requests allowed within one window. */
  max: number;
  /** Human-readable label used in log messages. */
  name?: string;
}

class RateLimiter {
  private readonly store = new Map<string, WindowEntry>();
  private readonly windowMs: number;
  private readonly max: number;

  constructor(opts: RateLimiterOptions) {
    this.windowMs = opts.windowMs;
    this.max = opts.max;

    // Periodically sweep expired entries to prevent unbounded memory growth.
    // A 5-minute sweep cycle is a reasonable default for single-instance use.
    setInterval(() => this.sweep(), 5 * 60 * 1000).unref();
  }

  /**
   * Returns `{ allowed, retryAfterSec }`.
   * `retryAfterSec` is only meaningful when `allowed` is false.
   */
  check(key: string): { allowed: boolean; retryAfterSec: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.store.set(key, { count: 1, windowStart: now });
      return { allowed: true, retryAfterSec: 0 };
    }

    entry.count += 1;

    if (entry.count > this.max) {
      const retryAfterSec = Math.ceil(
        (this.windowMs - (now - entry.windowStart)) / 1000,
      );
      return { allowed: false, retryAfterSec };
    }

    return { allowed: true, retryAfterSec: 0 };
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

  return (req: Request, res: Response, next: NextFunction): void => {
    // `req.ip` is set by Express using `trust proxy` configuration in app.ts.
    // With `trust proxy: 1`, Express strips the client-injected portion of
    // the X-Forwarded-For chain and returns the IP from the trusted upstream
    // hop — preventing header-spoofing bypasses.
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

    const { allowed, retryAfterSec } = limiter.check(ip);

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

  return (req: Request, res: Response, next: NextFunction): void => {
    // Prefer UID (always set after requireUid). Fall back to req.ip so
    // the key remains proxy-aware even in the unlikely case uid is absent.
    const key = req.uid ?? req.ip ?? req.socket.remoteAddress ?? "unknown";
    const { allowed, retryAfterSec } = limiter.check(key);

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
