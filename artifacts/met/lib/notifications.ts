import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import messaging from "@react-native-firebase/messaging";
import { Platform } from "react-native";

import {
  loadLastProcessedNotifId,
  loadPushToken,
  saveLastProcessedNotifId,
  savePushToken,
} from "./storage";

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
 * Fetches a raw FCM registration token via @react-native-firebase/messaging
 * and stashes it locally. Works on both iOS and Android without routing
 * through Expo's push relay service.
 *
 * Safe on simulator — returns null instead of throwing.
 */
export async function registerForPushTokenAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }
  const granted = await getNotificationPermissionGranted();
  if (!granted) return null;

  try {
    const token = await messaging().getToken();
    if (token) {
      await savePushToken(token);
    }
    return token || null;
  } catch (err) {
    console.warn("[notifications] messaging().getToken() failed", err);
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
export type PushTokenUploader = (
  opts: { uid: string },
  token: string,
) => Promise<void>;

export async function registerAndUploadPushToken(
  uid: string,
  _uploadOverride?: PushTokenUploader,
): Promise<string | null> {
  const token = await registerForPushTokenAsync();
  if (!token || !uid) return token;

  // Lazy-import the API client to avoid a circular dependency: notifications
  // is loaded early at module level, and api/client has no dependency on us.
  try {
    if (_uploadOverride) {
      await _uploadOverride({ uid }, token);
    } else {
      const { api } = await import("./api/client");
      await api.registerPushToken({ uid }, token);
    }
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
  type?: "reveal_request" | "reveal_accepted" | "encounter" | "chat_message";
  fromUid?: string;
  encounterId?: string;
  chatPeerUid?: string;
};

/**
 * Minimal router interface required by routeNotifTap. Matches the subset of
 * expo-router's Router that we actually call so the function is easy to test
 * without importing the full router.
 */
export interface NotifRouter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  push: (path: any) => void;
}

/**
 * Pure routing function: given a notification data payload and a router,
 * pushes to the correct screen.
 *
 * - chat_message   → /chat/<chatPeerUid>
 * - reveal_accepted → /connection/<fromUid>
 * - reveal_request / encounter / unknown → /encounter/<encounterId ?? fromUid>
 *
 * Returns false (and does nothing) when the payload lacks the required uid.
 */
export function routeNotifTap(data: NotifData, router: NotifRouter): boolean {
  if (data.type === "chat_message") {
    if (!data.chatPeerUid) return false;
    router.push(`/chat/${data.chatPeerUid}`);
    return true;
  }
  if (data.type === "reveal_accepted") {
    if (!data.fromUid) return false;
    router.push(`/connection/${data.fromUid}`);
    return true;
  }
  // reveal_request, encounter, or unknown type → encounter screen
  const peerUid = data.encounterId ?? data.fromUid;
  if (!peerUid) return false;
  router.push(`/encounter/${peerUid}`);
  return true;
}

/**
 * Wires the foreground + tap listeners. Returns an unsubscribe.
 *
 * `onTap` is called whenever the user taps a notification (cold start
 * or while running). The caller is responsible for routing to the
 * matching screen — typically `/encounter/[id]` or opening the
 * Requests sheet on Home.
 *
 * `tappedIds` is an optional shared Set that the caller can also pass
 * to foreground-delivery listeners so they can skip showing an in-app
 * banner for a notification the user already tapped (e.g. Android
 * heads-up banners that fire both listeners for the same tap).
 */
export function setupNotificationListeners(
  onTap: (data: NotifData) => void,
  tappedIds?: Set<string>,
): () => void {
  // Track which notification request identifiers we've already routed
  // for so the cold-start payload (which can be replayed by Expo on
  // subsequent launches if not cleared) doesn't double-fire alongside
  // the live tap listener for the same tap.
  // If the caller passes in a shared set, use it so the foreground
  // listener can also see which IDs have been tapped.
  const processed = tappedIds ?? new Set<string>();
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
  //
  // Primary defence: call clearLastNotificationResponseAsync() so Expo
  // does not hand back the same response on the next cold start. This
  // function was added in a later Expo SDK revision, so we guard with a
  // runtime check.
  //
  // Secondary defence (Android fallback): even when the clear call is
  // unavailable or fails, we persist the processed notification ID in
  // AsyncStorage and compare it against the returned response on every
  // launch. If the IDs match we skip dispatch, preventing replay.
  Notifications.getLastNotificationResponseAsync()
    .then(async (resp) => {
      if (!resp) return;

      const id = resp.notification.request.identifier;

      // Cross-session dedup: skip if this ID was already handled on a
      // previous launch (protects against Android stale-response replay
      // when clearLastNotificationResponseAsync is not available).
      try {
        const lastId = await loadLastProcessedNotifId();
        if (lastId !== null && lastId === id) return;
      } catch {
        // Storage read failure — proceed and process the notification
        // rather than silently dropping a legitimate tap.
      }

      dispatch(id, resp.notification.request.content.data);

      // Persist the ID before attempting the Expo clear so we always have
      // a record of having processed this notification, even if clear fails.
      saveLastProcessedNotifId(id).catch(() => {});

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

/**
 * Local notification for an incoming chat message.
 * Fires when the app is in the foreground and a new message arrives
 * from a connected peer. Used as a heads-up so the user can tap through
 * to the conversation even if they're on another screen.
 */
export async function presentChatMessageNotification(opts: {
  peerUid: string;
  peerName?: string;
  text: string;
}): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: opts.peerName ?? "New message",
        body: opts.text.length > 100 ? opts.text.slice(0, 97) + "…" : opts.text,
        data: {
          type: "chat_message",
          chatPeerUid: opts.peerUid,
        } satisfies NotifData,
        sound: "default",
      },
      trigger: null,
    });
  } catch (err) {
    console.warn("[notifications] presentChatMessageNotification failed", err);
  }
}
