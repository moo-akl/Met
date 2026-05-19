/**
 * Helpers for sending remote push notifications via the Expo Push API.
 *
 * All functions are best-effort — failures are logged but never propagated
 * to callers so a push outage never breaks the primary API response path.
 */

import { logger } from "./logger";

export interface PushData {
  type?: "reveal_request" | "reveal_accepted" | "encounter";
  fromUid?: string;
  encounterId?: string;
}

export interface PushPayload {
  title: string;
  body: string;
  data?: PushData;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Send a single push notification to the given Expo push token.
 * No-ops if the token is null/undefined. Swallows all errors.
 */
export async function sendPush(
  token: string | null | undefined,
  payload: PushPayload,
): Promise<void> {
  if (!token) return;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        to: token,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: "default",
      }),
    });
    if (!res.ok) {
      logger.warn(
        { status: res.status },
        "Expo push API returned non-2xx status",
      );
    }
  } catch (err) {
    logger.warn(
      { err: (err as Error)?.message },
      "Expo push API request failed",
    );
  }
}

// ---------------------------------------------------------------------------
// Nearby-push rate limiter (in-memory)
//
// Key: `{observerUid}:{observedUid}` — tracks the last time observer's device
// triggered a push to the observed user. Rate-limited to once per 15 min per
// directional pair so repeated BLE/GPS detections don't spam the other user.
// ---------------------------------------------------------------------------

const NEARBY_PUSH_TTL_MS = 15 * 60 * 1000;
const nearbyPushCache = new Map<string, number>();

/**
 * Returns true (and records the send) when a nearby push is allowed for
 * this (observer → observed) pair. Returns false if the pair is within
 * the 15-minute cooldown window.
 */
export function checkNearbyPushAllowed(
  observerUid: string,
  observedUid: string,
): boolean {
  const key = `${observerUid}:${observedUid}`;
  const now = Date.now();
  const last = nearbyPushCache.get(key);
  if (last !== undefined && now - last < NEARBY_PUSH_TTL_MS) return false;
  nearbyPushCache.set(key, now);
  return true;
}
