/**
 * tiktok.ts
 *
 * Thin wrapper around react-native-tiktok-business-sdk.
 * Android-only for now — all calls are silent no-ops on iOS.
 *
 * Call initTikTok() once at app startup, then use the helper functions
 * to fire standard and custom events.
 *
 * The SDK requires three IDs from TikTok Events Manager:
 *   EXPO_PUBLIC_TIKTOK_APP_ID    — your Android package name (app.met.founders)
 *   EXPO_PUBLIC_TIKTOK_TT_APP_ID — the numeric TikTok App ID from Events Manager
 *   EXPO_PUBLIC_TIKTOK_ACCESS_TOKEN — access token from Events Manager
 */

import { Platform } from "react-native";
import type {
  TikTokSdkConfig,
} from "react-native-tiktok-business-sdk";

// Lazily loaded so the import never crashes on iOS (native module not linked).
let sdk: typeof import("react-native-tiktok-business-sdk") | null = null;
let _initialized = false;

/** Call once at app startup. Silent no-op on iOS or if any ID is missing. */
export async function initTikTok(
  appId: string,
  ttAppId: string,
  accessToken: string,
  debug = false,
  options?: TikTokSdkConfig,
): Promise<void> {
  if (Platform.OS !== "android") return;
  if (_initialized) return;
  if (!appId || !ttAppId || !accessToken) return;

  try {
    sdk = await import("react-native-tiktok-business-sdk");
    await sdk.initializeSdk(appId, ttAppId, accessToken, debug, options);
    _initialized = true;
  } catch (e) {
    console.warn("[TikTok] init failed:", e);
  }
}

// ---------------------------------------------------------------------------
// Standard events
// ---------------------------------------------------------------------------

/** App launched / session started (fires automatically via SDK but useful for manual override). */
export function tiktokTrackLaunch(): void {
  if (!sdk) return;
  sdk
    .trackEvent(sdk.TikTokEventName.LAUNCH_APP)
    .catch((e) => console.warn("[TikTok] LaunchAPP:", e));
}

/** New user completed registration. */
export function tiktokTrackRegistration(
  method: "email" | "google" | "apple",
): void {
  if (!sdk) return;
  sdk
    .trackEvent(sdk.TikTokEventName.REGISTRATION, undefined, {
      description: method,
    })
    .catch((e) => console.warn("[TikTok] Registration:", e));
}

/** User viewed the paywall / subscription offer. */
export function tiktokTrackViewContent(contentId: string): void {
  if (!sdk) return;
  sdk
    .trackContentEvent(sdk.TikTokContentEventName.VIEW_CONTENT, {
      [sdk.TikTokContentEventParameter.CONTENT_ID]: contentId,
      [sdk.TikTokContentEventParameter.CONTENT_TYPE]: "subscription",
    })
    .catch((e) => console.warn("[TikTok] ViewContent:", e));
}

/** User completed a purchase / subscription. */
export function tiktokTrackPurchase(params: {
  value: number;
  currency: string;
  contentId?: string;
}): void {
  if (!sdk) return;
  sdk
    .trackContentEvent(sdk.TikTokContentEventName.PURCHASE, {
      [sdk.TikTokContentEventParameter.VALUE]: params.value,
      [sdk.TikTokContentEventParameter.CURRENCY]: params.currency,
      [sdk.TikTokContentEventParameter.CONTENT_ID]:
        params.contentId ?? "subscription",
      [sdk.TikTokContentEventParameter.CONTENT_TYPE]: "subscription",
    })
    .catch((e) => console.warn("[TikTok] Purchase:", e));
}

/** User started a free trial. */
export function tiktokTrackStartTrial(): void {
  if (!sdk) return;
  sdk
    .trackEvent(sdk.TikTokEventName.START_TRIAL)
    .catch((e) => console.warn("[TikTok] StartTrial:", e));
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/** Associate events with a logged-in user. Call after sign-in / sign-up. */
export function tiktokIdentify(uid: string): void {
  if (!sdk) return;
  sdk
    .identify(uid, "", "", "")
    .catch((e) => console.warn("[TikTok] identify:", e));
}

/** Clear user identity on sign-out. */
export function tiktokLogout(): void {
  if (!sdk) return;
  sdk.logout().catch((e) => console.warn("[TikTok] logout:", e));
}

// ---------------------------------------------------------------------------
// Custom events
// ---------------------------------------------------------------------------

/** Fire any custom event with arbitrary properties. */
export function tiktokTrackCustom(
  eventName: string,
  properties?: { description?: string; value?: number; currency?: string; query?: string },
): void {
  if (!sdk) return;
  sdk
    .trackCustomEvent(eventName, properties)
    .catch((e) => console.warn("[TikTok] custom event:", e));
}
