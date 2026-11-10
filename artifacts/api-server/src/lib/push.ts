/**
 * Helpers for sending remote pushes to Firebase Messaging and legacy Expo
 * push tokens. Failures are best-effort and must not break API responses.
 *
 * All functions are best-effort — failures are logged but never propagated
 * to callers so a push outage never breaks the primary API response path.
 */

import { logger } from "./logger";
import { adminMessaging } from "./firebaseAdmin";
import { recordNotificationForPushToken } from "./notificationInbox";

export interface PushData {
  type?: "reveal_request" | "reveal_accepted" | "encounter" | "reencounter"
    | "venue_reward_winner" | "venue_reward_owner_notification"
    | "venue_owner_approved" | "venue_owner_rejected"
    | string;
  fromUid?: string;
  encounterId?: string;
  [key: string]: string | undefined;
}

export interface PushPayload {
  title: string;
  body: string;
  data?: PushData;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Send a push and report the provider result for delivery summaries.
 * Raw Firebase registration tokens use Firebase Admin; older Expo tokens
 * continue to use the Expo Push API.
 */
export async function sendPushWithStatus(
  token: string | null | undefined,
  payload: PushPayload,
): Promise<{ sent: boolean; reason?: string }> {
  if (!token) return { sent: false, reason: "no_token" };
  try {
    try {
      await recordNotificationForPushToken(token, payload);
    } catch (err) {
      logger.warn(
        { err },
        "Could not save push notification to the inbox",
      );
    }

    if (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[")) {
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
      const responseBody = await res.json().catch(() => null) as
        | { data?: { status?: string; message?: string } | Array<{ status?: string; message?: string }> }
        | null;
      const ticket = Array.isArray(responseBody?.data)
        ? responseBody.data[0]
        : responseBody?.data;
      if (!res.ok || ticket?.status !== "ok") {
        const reason = ticket?.message ?? `expo_http_${res.status}`;
        logger.warn({ status: res.status, reason }, "Expo push delivery failed");
        return { sent: false, reason };
      }
      return { sent: true };
    }

    const data = Object.fromEntries(
      Object.entries(payload.data ?? {}).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
    await adminMessaging().send({
      token,
      notification: { title: payload.title, body: payload.body },
      data,
      android: {
        priority: "high",
        notification: {
          channelId: "default",
          sound: "default",
        },
      },
      apns: {
        headers: { "apns-priority": "10" },
        payload: { aps: { sound: "default", badge: 1, "content-available": 1 } },
      },
    });
    return { sent: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "push_delivery_failed";
    logger.warn(
      { reason },
      "Push delivery failed",
    );
    return { sent: false, reason };
  }
}

/**
 * Send a best-effort push without exposing delivery status to ordinary
 * callers. Event notifications use sendPushWithStatus to record a summary.
 */
export async function sendPush(
  token: string | null | undefined,
  payload: PushPayload,
): Promise<void> {
  await sendPushWithStatus(token, payload);
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
