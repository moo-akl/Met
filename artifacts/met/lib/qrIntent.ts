/**
 * Durable pending venue-QR check-in intent.
 *
 * Saved the moment a /v/<placeId>?t=<token> link is seen (cold start, live
 * link, or route mount) so the check-in survives onboarding, email
 * verification and app restarts. Consumed only on a server-confirmed
 * success or an explicit user cancel. Expires after one hour.
 *
 * `ownerUid` binds an intent to the account that was signed in when it was
 * captured; an intent bound to a different uid is discarded on load, and
 * sign-out clears it, so a logout can never apply a pending check-in to an
 * unrelated user.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export const QR_INTENT_KEY = "met:pending-qr-intent:v1";
export const QR_INTENT_TTL_MS = 60 * 60 * 1000;

export type QrIntent = {
  placeId: string;
  token: string;
  createdAt: number;
  ownerUid?: string | null;
};

const PLACE_RE = /^[A-Za-z0-9_\-:.]{1,200}$/;
const TOKEN_RE = /^[A-Za-z0-9_\-.~]{1,500}$/;

export function isValidQrParts(placeId: unknown, token: unknown): boolean {
  return (
    typeof placeId === "string" &&
    typeof token === "string" &&
    PLACE_RE.test(placeId) &&
    TOKEN_RE.test(token)
  );
}

export const QR_ALLOWED_HOSTS = ["metapp.replit.app", "met-app.org", "www.met-app.org"];

/**
 * Parse a venue QR URL. Only Met-owned links are accepted:
 *   met:///v/<placeId>?t=<token>, met://v/<placeId>?t=<token>,
 *   https://(metapp.replit.app|met-app.org)/v/<placeId>?t=<token>
 * Any other host is ignored so unrelated web links can't hijack onboarding.
 */
export function parseQrIntentFromUrl(
  url: string | null | undefined,
): { placeId: string; token: string } | null {
  if (!url) return null;
  let path: string;
  const scheme = url.match(/^met:\/\/\/?(.*)$/i);
  if (scheme) {
    path = "/" + scheme[1];
  } else {
    const https = url.match(/^https:\/\/([^/?#:]+)(?::\d+)?(\/[^#]*)?/i);
    if (!https) return null;
    if (!QR_ALLOWED_HOSTS.includes(https[1].toLowerCase())) return null;
    path = https[2] ?? "/";
  }
  const m = path.match(/^\/v\/([^/?#]+)\/?(?:\?([^#]*))?$/);
  if (!m) return null;
  let placeId: string;
  try {
    placeId = decodeURIComponent(m[1]);
  } catch {
    return null;
  }
  const query = m[2] ?? "";
  let token: string | null = null;
  for (const part of query.split("&")) {
    const [k, v] = part.split("=");
    if (k === "t" && v) {
      try {
        token = decodeURIComponent(v);
      } catch {
        return null;
      }
    }
  }
  if (!token || !isValidQrParts(placeId, token)) return null;
  return { placeId, token };
}

export function isQrIntentExpired(intent: QrIntent, now = Date.now()): boolean {
  return now - intent.createdAt > QR_INTENT_TTL_MS || intent.createdAt > now + 60_000;
}

/** Validate a stored JSON value. Returns null for anything malformed. */
export function decodeQrIntent(raw: string | null): QrIntent | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<QrIntent>;
    if (!isValidQrParts(v.placeId, v.token)) return null;
    if (typeof v.createdAt !== "number" || !Number.isFinite(v.createdAt)) return null;
    return {
      placeId: v.placeId as string,
      token: v.token as string,
      createdAt: v.createdAt,
      ownerUid: typeof v.ownerUid === "string" ? v.ownerUid : null,
    };
  } catch {
    return null;
  }
}

export async function saveQrIntent(
  placeId: string,
  token: string,
  ownerUid: string | null = null,
  now = Date.now(),
): Promise<QrIntent | null> {
  if (!isValidQrParts(placeId, token)) return null;
  try {
    // Re-scanning the same code keeps the original timestamp only if the
    // token matches; a new token always refreshes the intent.
    const existing = decodeQrIntent(await AsyncStorage.getItem(QR_INTENT_KEY));
    if (
      existing &&
      existing.placeId === placeId &&
      existing.token === token &&
      !isQrIntentExpired(existing, now) &&
      (existing.ownerUid ?? null) === ownerUid
    ) {
      return existing;
    }
    const intent: QrIntent = { placeId, token, createdAt: now, ownerUid };
    await AsyncStorage.setItem(QR_INTENT_KEY, JSON.stringify(intent));
    return intent;
  } catch {
    return null;
  }
}

/**
 * Load the pending intent. Expired, malformed, or other-account intents are
 * removed and null is returned. Pass `currentUid` when known.
 */
export async function loadQrIntent(
  currentUid?: string | null,
  now = Date.now(),
): Promise<QrIntent | null> {
  try {
    const intent = decodeQrIntent(await AsyncStorage.getItem(QR_INTENT_KEY));
    if (!intent) {
      await AsyncStorage.removeItem(QR_INTENT_KEY);
      return null;
    }
    if (isQrIntentExpired(intent, now)) {
      await AsyncStorage.removeItem(QR_INTENT_KEY);
      return null;
    }
    if (currentUid && intent.ownerUid && intent.ownerUid !== currentUid) {
      await AsyncStorage.removeItem(QR_INTENT_KEY);
      return null;
    }
    return intent;
  } catch {
    return null;
  }
}

export async function clearQrIntent(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QR_INTENT_KEY);
  } catch {
    // best-effort
  }
}

// ── In-flight dedupe ─────────────────────────────────────────────────────────
// Competing navigation (cold-start link + route mount + onboarding resume)
// must never fire two verify calls for the same code.
const inflight = new Map<string, Promise<unknown>>();

export function runQrVerifyOnce<T>(
  placeId: string,
  token: string,
  run: () => Promise<T>,
  uid: string | null = null,
): Promise<T> {
  // Keyed per account: a different signed-in user never shares a promise.
  const key = `${uid ?? ""}\u0000${placeId}\u0000${token}`;
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = run().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, p);
  return p;
}

/** Route path for a pending intent. */
export function qrIntentHref(intent: { placeId: string; token: string }): string {
  return `/v/${encodeURIComponent(intent.placeId)}?t=${encodeURIComponent(intent.token)}`;
}
