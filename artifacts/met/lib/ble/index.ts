// Unified BLE proximity service: scanner + advertiser.
//
// Mirrors the public API of `lib/proximity/presence.ts` so AppContext
// can wire them up with the same effect pattern. Exports a single
// `ProximityDetection`-shaped event so the upsert pipeline doesn't
// have to special-case the BLE path.
//
// In Expo Go (no native BLE module linked) every call here is a
// well-typed no-op that resolves with `started: false` and the reason.

import { Platform, PermissionsAndroid } from "react-native";
import type { RemoteProfile } from "../api/client";
import { uidToBleHash } from "./encode";
import {
  startBleScanner,
  stopBleScanner,
  type BleDetection,
  type BleListener,
} from "./scanner";
import {
  startAdvertising,
  stopAdvertising,
  isAdvertisingAvailable,
  setBackgroundMode,
} from "../../modules/expo-met-ble/src";
import { recordSelf, recordAdvertiserStart } from "./debug";

export type { BleDetection };

// Shape callers rely on. Identical to `ProximityDetection` from the
// GPS service so AppContext can call the same upsert function.
export interface BleProximityDetection {
  uid: string;
  rssi: number | null;
  distanceM: number; // estimated from RSSI; rough.
  source: "ble";
  profile: RemoteProfile;
  observedAt: number;
}

export type BleProximityListener = (event: BleProximityDetection) => void;

interface SessionState {
  uid: string;
  listener: BleProximityListener;
  isVisible: boolean;
  advertising: boolean;
}

let session: SessionState | null = null;
let advertisingQueue: Promise<void> = Promise.resolve();

function serializeAdvertising(operation: () => Promise<void>): Promise<void> {
  const next = advertisingQueue.then(operation, operation);
  advertisingQueue = next.catch(() => {});
  return next;
}

export interface StartBleProximityOptions {
  uid: string;
  /** Only an explicitly visible user may publish a BLE identity beacon. */
  isVisible: boolean;
  listener: BleProximityListener;
}

export async function startBleProximity(
  opts: StartBleProximityOptions,
): Promise<{
  scanner: { started: boolean; reason?: string };
  advertiser: { started: boolean; reason?: string };
}> {
  if (!opts.isVisible) {
    // Hidden mode stops both sides of proximity: neither our identity nor
    // new nearby identities should be processed while discovery is off.
    // stopBleProximity invalidates pending starts synchronously before its
    // native cleanup awaits complete.
    await stopBleProximity();
    return {
      scanner: { started: false, reason: "User is hidden" },
      advertiser: { started: false, reason: "User is hidden" },
    };
  }

  // Replace any session for a different identity. Hidden mode returned
  // above, so active sessions always represent an explicit visible opt-in.
  if (session && session.uid !== opts.uid) {
    await stopBleProximity();
  }

  let activeSession = session;
  if (!activeSession || activeSession.uid !== opts.uid) {
    activeSession = {
      uid: opts.uid,
      listener: opts.listener,
      isVisible: opts.isVisible,
      advertising: false,
    };
    session = activeSession;
    recordSelf(opts.uid, null);
  } else {
    activeSession.listener = opts.listener;
    activeSession.isVisible = opts.isVisible;
  }

  // Android 13+ (API 33): request POST_NOTIFICATIONS permission so the
  // foreground-service notification is visible to the user. Without this
  // the notification silently drops on API 33+ devices even though the
  // foreground service is running. No-op on iOS and lower Android APIs.
  if (Platform.OS === "android" && (Platform.Version as number) >= 33) {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    ).catch(() => {});
  }
  if (session !== activeSession) {
    return {
      scanner: { started: false, reason: "Superseded" },
      advertiser: { started: false, reason: "Superseded" },
    };
  }

  // Android: start the foreground service NOW so the process stays in
  // the foreground-service tier for the entire BLE proximity session.
  // This guarantees background BLE scanning works even on devices where
  // GATT advertising is unavailable (the previous fallback was to start
  // the service only when advertising succeeded, leaving those devices
  // with no background protection for the react-native-ble-plx scan).
  // No-op on iOS and Expo Go.
  await setBackgroundMode(true);
  if (session !== activeSession) {
    if (!session) void setBackgroundMode(false);
    return {
      scanner: { started: false, reason: "Superseded" },
      advertiser: { started: false, reason: "Superseded" },
    };
  }

  const adapter: BleListener = (ev: BleDetection) => {
    // The same session can switch visibility or refresh its consumer
    // callback without tearing down the scanner.
    if (session !== activeSession) return;
    activeSession.listener({
      uid: ev.uid,
      rssi: ev.rssi,
      distanceM: rssiToMeters(ev.rssi),
      source: "ble",
      profile: ev.profile,
      observedAt: ev.observedAt,
    });
  };

  const scannerResult = await startBleScanner({
    uid: opts.uid,
    listener: adapter,
  });
  if (session !== activeSession) {
    return {
      scanner: { started: false, reason: "Superseded" },
      advertiser: { started: false, reason: "Superseded" },
    };
  }

  let advertiserResult = { started: false, reason: "Not attempted" };
  try {
    const hash = await uidToBleHash(opts.uid);
    if (session === activeSession && activeSession.isVisible) {
      await serializeAdvertising(async () => {
        // A hide/stop can be requested while a hash or native operation
        // is pending. Check again inside the serialized native queue.
        if (session !== activeSession || !activeSession!.isVisible) {
          await stopAdvertising();
          activeSession!.advertising = false;
          return;
        }
        const ok = await startAdvertising(opts.uid, hash);
        if (session !== activeSession || !activeSession!.isVisible) {
          await stopAdvertising();
          activeSession!.advertising = false;
          return;
        }
        activeSession!.advertising = ok;
        advertiserResult = ok
          ? { started: true, reason: "" }
          : { started: false, reason: "Advertiser unavailable or denied" };
      });
    } else {
      advertiserResult = { started: false, reason: "Superseded or hidden" };
    }
  } catch (err) {
    advertiserResult = {
      started: false,
      reason: `Advertiser threw: ${(err as Error)?.message ?? "unknown"}`,
    };
  }

  recordAdvertiserStart(advertiserResult.started, advertiserResult.reason);
  return { scanner: scannerResult, advertiser: advertiserResult };
}

export async function stopBleProximity(): Promise<void> {
  const s = session;
  session = null;
  stopBleScanner();
  await serializeAdvertising(async () => {
    // Always clear native persisted owner/restoration state, even when the
    // JS session believes advertising never started or a previous start is
    // still in flight.
    await stopAdvertising();
    if (s) s.advertising = false;
  });
  // Release the explicit background-mode hold. The native side is
  // reference-counted — it stops the foreground service only when
  // advertising and iBeacon scanning have also released it.
  if (!session) await setBackgroundMode(false);
}

export { isAdvertisingAvailable };

// Very rough RSSI → distance estimator. Uses a free-space path-loss
// approximation with a calibrated 1-meter reference of -59 dBm and an
// environmental factor of 2.5 (typical indoor). Caller treats this as
// a hint, not truth — the UI shows source label + a coarse band.
function rssiToMeters(rssi: number | null): number {
  if (rssi == null || !isFinite(rssi)) return 0;
  const REF_RSSI_AT_1M = -59;
  const PATH_LOSS = 2.5;
  if (rssi >= REF_RSSI_AT_1M) return 1;
  const meters = Math.pow(10, (REF_RSSI_AT_1M - rssi) / (10 * PATH_LOSS));
  // Clamp to a sane window so transient junk doesn't paint "1 km".
  return Math.max(1, Math.min(50, Math.round(meters)));
}
