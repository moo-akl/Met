import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Encounter, Profile } from "./types";

const PROFILE_KEY = "met:profile:v1";
const ENCOUNTERS_KEY = "met:encounters:v1";
const PERMISSIONS_KEY = "met:permissions:v1";
const CONNECTIONS_SORT_KEY = "met:connectionsSort:v1";
const PREFERENCES_KEY = "met:prefs:v1";
const DISCLOSURE_LOCATION_KEY = "met:disclosure:location:v1";
const DISCLOSURE_BLUETOOTH_KEY = "met:disclosure:bluetooth:v1";
const PUSH_TOKEN_KEY = "met:pushToken:v1";
const DRAG_HINT_DISMISSED_KEY = "met:interestsDragHintDismissed:v1";

export type DisclosureKindStorage = "location" | "bluetooth";

function disclosureKey(kind: DisclosureKindStorage): string {
  return kind === "location" ? DISCLOSURE_LOCATION_KEY : DISCLOSURE_BLUETOOTH_KEY;
}

export async function loadDisclosureAccepted(
  kind: DisclosureKindStorage,
): Promise<boolean> {
  const raw = await AsyncStorage.getItem(disclosureKey(kind));
  return raw === "1";
}

export async function saveDisclosureAccepted(
  kind: DisclosureKindStorage,
  accepted: boolean,
): Promise<void> {
  if (accepted) {
    await AsyncStorage.setItem(disclosureKey(kind), "1");
  } else {
    await AsyncStorage.removeItem(disclosureKey(kind));
  }
}

export async function loadPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

export async function savePushToken(token: string): Promise<void> {
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
}

export async function clearPushToken(): Promise<void> {
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
}

// 24h TTL for pending reveal requests in either direction. After this they
// silently revert to "encounter" so the requests sheet doesn't pile up forever.
export const REQUEST_TTL_MS = 24 * 60 * 60 * 1000;

export type ConnectionsSort = "recent" | "frequent" | "name";

// User-tunable discovery + housekeeping preferences. All optional so older
// installs stay compatible; defaults are applied on hydrate.
export type DiscoveryRange = "room" | "nearby" | "venue";
// 0 = off (keep everything). Otherwise the cutoff in days.
export type AutoCleanupDays = 0 | 30 | 60 | 90;

export type Preferences = {
  discoveryRange: DiscoveryRange;
  notifyDailyRecap: boolean;
  notifyRecurringMeets: boolean;
  notifyChat: boolean;
  autoCleanupDays: AutoCleanupDays;
};

export const DEFAULT_PREFERENCES: Preferences = {
  discoveryRange: "nearby",
  notifyDailyRecap: true,
  notifyRecurringMeets: true,
  notifyChat: true,
  autoCleanupDays: 0,
};

export const DISCOVERY_RANGE_METERS: Record<DiscoveryRange, number> = {
  room: 10,
  nearby: 50,
  venue: 200,
};

export const DISCOVERY_RANGE_LABEL: Record<DiscoveryRange, string> = {
  room: "Same room (10m)",
  nearby: "Nearby (50m)",
  venue: "Same venue (200m)",
};

// Tier-gated extra photo allowance. Total photos = 1 main + extras.
// Free users see the lock; tapping Add routes them to /paywall.
// Tier itself lives in lib/revenuecat.tsx (single source of truth) — kept
// inline here as a Record literal so storage doesn't depend on revenuecat.
export const MAX_EXTRA_PHOTOS_BY_TIER: {
  free: number;
  plus: number;
  pro: number;
} = {
  free: 0,
  plus: 2,
  pro: 5,
};

export async function loadProfile(): Promise<Profile | null> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  return raw ? (JSON.parse(raw) as Profile) : null;
}

export async function saveProfile(p: Profile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export async function clearProfile(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_KEY);
}

export async function loadEncounters(): Promise<Encounter[] | null> {
  const raw = await AsyncStorage.getItem(ENCOUNTERS_KEY);
  return raw ? (JSON.parse(raw) as Encounter[]) : null;
}

export async function saveEncounters(e: Encounter[]): Promise<void> {
  await AsyncStorage.setItem(ENCOUNTERS_KEY, JSON.stringify(e));
}

export async function clearEncounters(): Promise<void> {
  await AsyncStorage.removeItem(ENCOUNTERS_KEY);
}

export async function loadPermissionsCompleted(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(PERMISSIONS_KEY);
  return raw === "1";
}

export async function savePermissionsCompleted(done: boolean): Promise<void> {
  if (done) {
    await AsyncStorage.setItem(PERMISSIONS_KEY, "1");
  } else {
    await AsyncStorage.removeItem(PERMISSIONS_KEY);
  }
}

export async function loadConnectionsSort(): Promise<ConnectionsSort> {
  const raw = await AsyncStorage.getItem(CONNECTIONS_SORT_KEY);
  if (raw === "recent" || raw === "frequent" || raw === "name") return raw;
  return "recent";
}

export async function saveConnectionsSort(s: ConnectionsSort): Promise<void> {
  await AsyncStorage.setItem(CONNECTIONS_SORT_KEY, s);
}

export async function loadPreferences(): Promise<Preferences> {
  try {
    const raw = await AsyncStorage.getItem(PREFERENCES_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    // Re-validate every field so a corrupted blob (or an older app version
    // that wrote an unknown enum value) can't yield undefined label/meter
    // lookups downstream.
    const range: DiscoveryRange =
      parsed.discoveryRange === "room" ||
      parsed.discoveryRange === "nearby" ||
      parsed.discoveryRange === "venue"
        ? parsed.discoveryRange
        : DEFAULT_PREFERENCES.discoveryRange;
    const cleanup: AutoCleanupDays =
      parsed.autoCleanupDays === 0 ||
      parsed.autoCleanupDays === 30 ||
      parsed.autoCleanupDays === 60 ||
      parsed.autoCleanupDays === 90
        ? parsed.autoCleanupDays
        : DEFAULT_PREFERENCES.autoCleanupDays;
    return {
      discoveryRange: range,
      notifyDailyRecap:
        typeof parsed.notifyDailyRecap === "boolean"
          ? parsed.notifyDailyRecap
          : DEFAULT_PREFERENCES.notifyDailyRecap,
      notifyRecurringMeets:
        typeof parsed.notifyRecurringMeets === "boolean"
          ? parsed.notifyRecurringMeets
          : DEFAULT_PREFERENCES.notifyRecurringMeets,
      notifyChat:
        typeof parsed.notifyChat === "boolean"
          ? parsed.notifyChat
          : DEFAULT_PREFERENCES.notifyChat,
      autoCleanupDays: cleanup,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export async function savePreferences(p: Preferences): Promise<void> {
  await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(p));
}

export async function clearPreferences(): Promise<void> {
  await AsyncStorage.removeItem(PREFERENCES_KEY);
}

export async function loadDragHintDismissed(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(DRAG_HINT_DISMISSED_KEY);
  return raw === "1";
}

export async function saveDragHintDismissed(): Promise<void> {
  await AsyncStorage.setItem(DRAG_HINT_DISMISSED_KEY, "1");
}

export async function clearDragHintDismissed(): Promise<void> {
  await AsyncStorage.removeItem(DRAG_HINT_DISMISSED_KEY);
}

function profileBannerDismissedKey(uid: string): string {
  return `met:profileBannerDismissed:v1:${uid}`;
}

export async function loadProfileBannerDismissed(uid: string): Promise<boolean> {
  if (!uid) return false;
  const raw = await AsyncStorage.getItem(profileBannerDismissedKey(uid));
  return raw === "1";
}

export async function saveProfileBannerDismissed(
  uid: string,
  dismissed: boolean,
): Promise<void> {
  if (!uid) return;
  if (dismissed) {
    await AsyncStorage.setItem(profileBannerDismissedKey(uid), "1");
  } else {
    await AsyncStorage.removeItem(profileBannerDismissedKey(uid));
  }
}

const SESSION_COUNT_KEY = "met:sessionCount:v1";
const VALUE_TOUR_SEEN_KEY = "met:valueTourSeen:v2";
const HUB_TOOLTIP_DISMISSED_KEY = "met:hubTooltipDismissed:v1";

export async function loadSessionCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(SESSION_COUNT_KEY);
  return raw ? parseInt(raw, 10) : 0;
}

export async function incrementSessionCount(): Promise<number> {
  const current = await loadSessionCount();
  const next = current + 1;
  await AsyncStorage.setItem(SESSION_COUNT_KEY, String(next));
  return next;
}

export async function loadValueTourSeen(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(VALUE_TOUR_SEEN_KEY);
  return raw === "1";
}

export async function saveValueTourSeen(): Promise<void> {
  await AsyncStorage.setItem(VALUE_TOUR_SEEN_KEY, "1");
}

export async function loadHubTooltipDismissed(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(HUB_TOOLTIP_DISMISSED_KEY);
  return raw === "1";
}

export async function saveHubTooltipDismissed(): Promise<void> {
  await AsyncStorage.setItem(HUB_TOOLTIP_DISMISSED_KEY, "1");
}

const INTERACTIVE_WALKTHROUGH_SEEN_KEY = "met:interactiveWalkthroughSeen:v1";
const INTERACTIVE_WALKTHROUGH_PENDING_KEY = "met:interactiveWalkthroughPending:v1";

export async function loadInteractiveWalkthroughSeen(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(INTERACTIVE_WALKTHROUGH_SEEN_KEY);
  return raw === "1";
}

export async function saveInteractiveWalkthroughSeen(): Promise<void> {
  await AsyncStorage.setItem(INTERACTIVE_WALKTHROUGH_SEEN_KEY, "1");
}

/** Written when a user completes the Value Tour for the first time.
 *  Consumed once by the Home screen to start the interactive walkthrough,
 *  then cleared so subsequent launches never re-show it. */
export async function loadInteractiveWalkthroughPending(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(INTERACTIVE_WALKTHROUGH_PENDING_KEY);
  return raw === "1";
}

export async function saveInteractiveWalkthroughPending(): Promise<void> {
  await AsyncStorage.setItem(INTERACTIVE_WALKTHROUGH_PENDING_KEY, "1");
}

export async function clearInteractiveWalkthroughPending(): Promise<void> {
  await AsyncStorage.removeItem(INTERACTIVE_WALKTHROUGH_PENDING_KEY);
}

const CONNECTIONS_WALKTHROUGH_SEEN_KEY = "met:connectionsWalkthroughSeen:v1";

export async function loadConnectionsWalkthroughSeen(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(CONNECTIONS_WALKTHROUGH_SEEN_KEY);
  return raw === "1";
}

export async function saveConnectionsWalkthroughSeen(): Promise<void> {
  await AsyncStorage.setItem(CONNECTIONS_WALKTHROUGH_SEEN_KEY, "1");
}

const LAST_PROCESSED_NOTIF_ID_KEY = "met:lastProcessedNotifId:v1";

/**
 * Returns the notification request identifier that was last processed on a
 * cold start, or null if none has been recorded yet.
 *
 * Used by setupNotificationListeners as a cross-session dedup fallback for
 * Android where clearLastNotificationResponseAsync may not be available.
 */
export async function loadLastProcessedNotifId(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_PROCESSED_NOTIF_ID_KEY);
}

/**
 * Persists the notification request identifier that was just processed on a
 * cold start so the next launch can skip it if getLastNotificationResponseAsync
 * hands it back again.
 */
export async function saveLastProcessedNotifId(id: string): Promise<void> {
  await AsyncStorage.setItem(LAST_PROCESSED_NOTIF_ID_KEY, id);
}
