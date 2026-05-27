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
 * Why in-process rather than external metrics?
 * This is intentionally lightweight — no extra dependency, no sidecar.
 * The alert fires into the same structured JSON log stream that is already
 * aggregated in production. A Cloud Logging alert on
 *   `jsonPayload.alert = "reveal_error_rate_exceeded"`
 * is all that is needed to page on a surge.
 *
 * Limitations
 * -----------
 * State is per-process: a multi-instance deployment sees independent
 * per-instance windows. This is acceptable — an alert from ANY instance
 * is a meaningful signal. A process restart resets the window, which is
 * fine since crashes are already surfaced through Cloud Run logs.
 */

import { logger } from "./logger";

const WINDOW_MS = 5 * 60_000;
const ERROR_RATE_THRESHOLD = 0.05;
const MIN_CALLS_FOR_ALERT = 5;

interface CallRecord {
  ts: number;
  isError: boolean;
}

class RevealEndpointMonitor {
  private records: CallRecord[] = [];
  private readonly endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  record(isError: boolean): void {
    const now = Date.now();
    const cutoff = now - WINDOW_MS;

    this.records.push({ ts: now, isError });

    // Prune records outside the window. We prune on every record call so
    // memory stays O(calls-in-window) rather than O(all-time-calls).
    this.records = this.records.filter((r) => r.ts >= cutoff);

    if (isError) {
      this.maybeAlert(now, cutoff);
    }
  }

  private maybeAlert(now: number, cutoff: number): void {
    const window = this.records.filter((r) => r.ts >= cutoff);
    const total = window.length;
    if (total < MIN_CALLS_FOR_ALERT) return;

    const errors = window.filter((r) => r.isError).length;
    const errorRate = errors / total;
    if (errorRate <= ERROR_RATE_THRESHOLD) return;

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

const acceptMonitor = new RevealEndpointMonitor("POST /api/reveals/accept");
const declineMonitor = new RevealEndpointMonitor("POST /api/reveals/decline");

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
): void {
  const isError = statusCode >= 500;
  if (endpoint === "accept") {
    acceptMonitor.record(isError);
  } else {
    declineMonitor.record(isError);
  }
}
