import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { loadPushToken, savePushToken } from "./storage";

let configured = false;

/**
 * One-time global setup. Safe to call from app boot — it's idempotent.
 * Configures the foreground presentation handler and (Android) creates
 * the default notification channel.
 */
export function configureNotifications(): void {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowAlert: true,
    }),
  });

  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "Met",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200],
      lightColor: "#92C977",
    }).catch((err) => {
      console.warn("[notifications] setNotificationChannelAsync failed", err);
    });
  }
}

/**
 * Asks the OS for notification permission. Returns true if granted.
 * Idempotent — calling again after grant just returns the existing
 * status without showing a second prompt.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    let canAskAgain = existing.canAskAgain;
    if (status !== "granted" && canAskAgain !== false) {
      const next = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      status = next.status;
      canAskAgain = next.canAskAgain;
    }
    return status === "granted";
  } catch (err) {
    console.warn("[notifications] requestNotificationPermission failed", err);
    return false;
  }
}

export async function getNotificationPermissionGranted(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * Fetches an Expo push token and stashes it locally. Once we wire the
 * api-server endpoint we'll POST this token so the backend can target
 * the device with FCM/APNS pushes via Expo Push API.
 *
 * Safe on simulator / Expo Go — returns null and logs a warning instead
 * of throwing.
 */
export async function registerForPushTokenAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }
  const granted = await getNotificationPermissionGranted();
  if (!granted) return null;

  // Pull the EAS projectId from app.json's `extra.eas.projectId` so the
  // Expo push service knows which project this token belongs to.
  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
      ?.eas?.projectId ??
    (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
  if (!projectId) {
    console.warn(
      "[notifications] missing EAS projectId — cannot fetch push token",
    );
    return null;
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (data) {
      await savePushToken(data);
    }
    return data ?? null;
  } catch (err) {
    console.warn("[notifications] getExpoPushTokenAsync failed", err);
    return null;
  }
}

export async function getCachedPushToken(): Promise<string | null> {
  return loadPushToken();
}

/**
 * Fetches an Expo push token (or returns the cached one), saves it locally,
 * and uploads it to the api-server so the backend can send remote push
 * notifications to this device.
 *
 * Requires the caller's Firebase UID so the api-server can associate the
 * token with the right profile row. Best-effort — upload failures are
 * swallowed so the app continues to work even if the server is unreachable.
 */
export async function registerAndUploadPushToken(
  uid: string,
): Promise<string | null> {
  const token = await registerForPushTokenAsync();
  if (!token || !uid) return token;

  // Lazy-import the API client to avoid a circular dependency: notifications
  // is loaded early at module level, and api/client has no dependency on us.
  try {
    const { api } = await import("./api/client");
    await api.registerPushToken({ uid }, token);
  } catch (err) {
    console.warn("[notifications] failed to upload push token to server", err);
  }

  return token;
}

/**
 * Tap-handler payload. Notifications carry data of this shape so the
 * tap-handler can deep-link to the right place.
 */
export type NotifData = {
  type?: "reveal_request" | "reveal_accepted" | "encounter";
  fromUid?: string;
  encounterId?: string;
};

/**
 * Wires the foreground + tap listeners. Returns an unsubscribe.
 *
 * `onTap` is called whenever the user taps a notification (cold start
 * or while running). The caller is responsible for routing to the
 * matching screen — typically `/encounter/[id]` or opening the
 * Requests sheet on Home.
 */
export function setupNotificationListeners(
  onTap: (data: NotifData) => void,
): () => void {
  // Track which notification request identifiers we've already routed
  // for so the cold-start payload (which can be replayed by Expo on
  // subsequent launches if not cleared) doesn't double-fire alongside
  // the live tap listener for the same tap.
  const processed = new Set<string>();
  const dispatch = (
    id: string | undefined,
    data: Record<string, unknown> | null | undefined,
  ) => {
    if (id) {
      if (processed.has(id)) return;
      processed.add(id);
    }
    onTap((data ?? {}) as NotifData);
  };

  const tapSub = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      dispatch(
        response.notification.request.identifier,
        response.notification.request.content.data,
      );
    },
  );

  // Cold-start tap: when the user opened the app *by tapping* a
  // notification, getLastNotificationResponseAsync() returns it once.
  // We then clear it so the same tap isn't replayed on the next cold
  // start (Android in particular can hand back the stale response).
  Notifications.getLastNotificationResponseAsync()
    .then((resp) => {
      if (!resp) return;
      dispatch(
        resp.notification.request.identifier,
        resp.notification.request.content.data,
      );
      const clear = (
        Notifications as unknown as {
          clearLastNotificationResponseAsync?: () => Promise<void>;
        }
      ).clearLastNotificationResponseAsync;
      if (typeof clear === "function") {
        clear().catch(() => {});
      }
    })
    .catch(() => {});

  return () => {
    tapSub.remove();
  };
}

/**
 * Schedules a local notification for an inbound reveal request. Used
 * as a foreground / warm-start fallback so the user gets a heads-up
 * even before server-side push is wired up.
 */
export async function presentRevealRequestNotification(opts: {
  fromUid: string;
  fromName?: string;
  message?: string;
}): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: opts.fromName
          ? `${opts.fromName} wants to reveal`
          : "New reveal request",
        body:
          opts.message?.trim() ||
          "Someone you've crossed paths with wants to connect.",
        data: {
          type: "reveal_request",
          fromUid: opts.fromUid,
        } satisfies NotifData,
        sound: "default",
      },
      trigger: null, // fire immediately
    });
  } catch (err) {
    console.warn("[notifications] presentRevealRequestNotification failed", err);
  }
}

/**
 * Local notification for the observer when they detect a new nearby user.
 * Fires immediately so the user knows they crossed paths with someone even
 * if the app is backgrounded.
 */
export async function presentEncounterNotification(opts: {
  peerUid: string;
  peerName?: string;
}): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: opts.peerName
          ? `You crossed paths with ${opts.peerName}`
          : "You crossed paths with someone!",
        body: "Open Met to see who's nearby.",
        data: {
          type: "encounter",
          encounterId: opts.peerUid,
        } satisfies NotifData,
        sound: "default",
      },
      trigger: null,
    });
  } catch (err) {
    console.warn("[notifications] presentEncounterNotification failed", err);
  }
}

/**
 * Local notif when an outbound request is accepted by the recipient.
 */
export async function presentRevealAcceptedNotification(opts: {
  fromUid: string;
  fromName?: string;
}): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: opts.fromName
          ? `${opts.fromName} accepted your request`
          : "Reveal accepted",
        body: "You're now connected — tap to say hi.",
        data: {
          type: "reveal_accepted",
          fromUid: opts.fromUid,
        } satisfies NotifData,
        sound: "default",
      },
      trigger: null,
    });
  } catch (err) {
    console.warn("[notifications] presentRevealAcceptedNotification failed", err);
  }
}
