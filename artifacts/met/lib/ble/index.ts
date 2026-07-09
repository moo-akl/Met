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
  generation: number;
  advertising: boolean;
}

let session: SessionState | null = null;
let nextGeneration = 1;

export interface StartBleProximityOptions {
  uid: string;
  listener: BleProximityListener;
}

export async function startBleProximity(
  opts: StartBleProximityOptions,
): Promise<{
  scanner: { started: boolean; reason?: string };
  advertiser: { started: boolean; reason?: string };
}> {
  // Replace any in-flight session for a different uid.
  if (session && session.uid !== opts.uid) {
    await stopBleProximity();
  }

  const generation = nextGeneration++;
  session = { uid: opts.uid, generation, advertising: false };
  recordSelf(opts.uid, null);

  // Android 13+ (API 33): request POST_NOTIFICATIONS permission so the
  // foreground-service notification is visible to the user. Without this
  // the notification silently drops on API 33+ devices even though the
  // foreground service is running. No-op on iOS and lower Android APIs.
  if (Platform.OS === "android" && (Platform.Version as number) >= 33) {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    ).catch(() => {});
  }

  // Android: start the foreground service NOW so the process stays in
  // the foreground-service tier for the entire BLE proximity session.
  // This guarantees background BLE scanning works even on devices where
  // GATT advertising is unavailable (the previous fallback was to start
  // the service only when advertising succeeded, leaving those devices
  // with no background protection for the react-native-ble-plx scan).
  // No-op on iOS and Expo Go.
  void setBackgroundMode(true);

  const adapter: BleListener = (ev: BleDetection) => {
    // Live-session check before forwarding.
    if (!session || session.generation !== generation) return;
    opts.listener({
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

  // Compute our own identity hash for the advertiser. If hashing fails
  // somehow we still want the scanner running, so we don't bail.
  let advertiserResult = { started: false, reason: "Not attempted" };
  try {
    const hash = await uidToBleHash(opts.uid);
    if (session && session.generation === generation) {
      const ok = await startAdvertising(opts.uid, hash);
      advertiserResult = ok
        ? { started: true, reason: "" }
        : { started: false, reason: "Advertiser unavailable or denied" };
      if (session && session.generation === generation) {
        session.advertising = ok;
      }
    } else {
      advertiserResult = { started: false, reason: "Superseded" };
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
  if (s?.advertising) {
    await stopAdvertising();
  }
  // Release the explicit background-mode hold. The native side is
  // reference-counted — it stops the foreground service only when
  // advertising and iBeacon scanning have also released it.
  void setBackgroundMode(false);
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
