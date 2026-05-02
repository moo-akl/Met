// Unified BLE proximity service: iBeacon range + advertise.
//
// Mirrors the public API of `lib/proximity/presence.ts` so AppContext
// can wire them up with the same effect pattern. Exports a single
// `BleProximityDetection`-shaped event so the upsert pipeline doesn't
// have to special-case the BLE path.
//
// Architecture
// ------------
// We use Apple's iBeacon protocol (CoreLocation on iOS, BluetoothLeScanner
// + manufacturer-data parsing on Android) as the wire format. The
// proximity UUID is constant across all Met installs; each device's
// identity is encoded in the `major` field as the polynomial-rolling
// hash of their uid (matches the original Flutter MVP byte-for-byte).
//
// In Expo Go (no native BLE module linked) every call here is a
// well-typed no-op that resolves with `started: false` and the reason.

import type { RemoteProfile } from "../api/client";
import { uidToMajor } from "./encode";
import {
  startBleScanner,
  stopBleScanner,
  type BleDetection,
  type BleListener,
} from "./scanner";
import {
  startBeaconAdvertising,
  stopBeaconAdvertising,
  isBeaconAdvertisingAvailable,
} from "../../modules/expo-met-ble/src";
import { MET_IBEACON_UUID, MET_IBEACON_MINOR } from "./uuids";

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

  // Compute our own iBeacon major and start advertising. If the
  // advertiser fails the scanner can still discover other peers, so
  // we surface both results independently.
  let advertiserResult: { started: boolean; reason?: string } = {
    started: false,
    reason: "Not attempted",
  };
  try {
    const major = uidToMajor(opts.uid);
    if (session && session.generation === generation) {
      const ok = await startBeaconAdvertising(
        MET_IBEACON_UUID,
        major,
        MET_IBEACON_MINOR,
      );
      advertiserResult = ok
        ? { started: true }
        : {
            started: false,
            reason: "iBeacon advertiser unavailable or denied",
          };
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

  return { scanner: scannerResult, advertiser: advertiserResult };
}

export async function stopBleProximity(): Promise<void> {
  const s = session;
  session = null;
  stopBleScanner();
  if (s?.advertising) {
    await stopBeaconAdvertising();
  }
}

export { isBeaconAdvertisingAvailable as isAdvertisingAvailable };

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
