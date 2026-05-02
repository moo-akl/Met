// JS surface of the `expo-met-ble` native module.
//
// Two pipelines are exposed:
//
//   1. iBeacon (primary) — `startBeaconAdvertising` /
//      `startBeaconRanging` with a constant proximity UUID and a
//      16-bit `major` derived from the user's uid. iBeacon is the
//      same wire format the original Flutter MVP used; it gives
//      sub-second cross-platform detection and is supported by every
//      modern iOS/Android device. CoreLocation handles ranging on
//      iOS; we parse iBeacon manufacturer frames manually on Android.
//
//   2. Legacy GATT (`startAdvertising` / `stopAdvertising`) — kept
//      exported so older code paths still link, but new callers
//      should use the iBeacon API.
//
// In Expo Go (no native module linked) every method here is a no-op
// that resolves harmlessly so callers don't need to feature-detect.

import { Platform } from "react-native";

interface RangedBeacon {
  major: number;
  minor: number;
  rssi: number;
  accuracy: number;
  proximity: number;
}

export interface BeaconRangedEvent {
  uuid: string;
  beacons: RangedBeacon[];
}

interface NativeSubscription {
  remove(): void;
}

interface NativeMetBle {
  // Legacy GATT.
  startAdvertising(uid: string, hashHex: string): Promise<boolean>;
  stopAdvertising(): Promise<void>;
  isAvailable(): Promise<boolean>;

  // iBeacon advertise.
  startBeaconAdvertising(
    uuid: string,
    major: number,
    minor: number,
  ): Promise<boolean>;
  stopBeaconAdvertising(): Promise<void>;
  isBeaconAdvertisingAvailable(): Promise<boolean>;

  // iBeacon range.
  startBeaconRanging(uuid: string): Promise<boolean>;
  stopBeaconRanging(uuid: string): Promise<void>;
  stopAllBeaconRanging(): Promise<void>;

  // Event channel — Expo NativeModule base class injects these.
  addListener(
    name: "onBeaconRanged",
    listener: (ev: BeaconRangedEvent) => void,
  ): NativeSubscription;
}

let nativeMod: NativeMetBle | null | undefined;

function getNative(): NativeMetBle | null {
  if (nativeMod !== undefined) return nativeMod;
  if (Platform.OS === "web") {
    nativeMod = null;
    return null;
  }
  try {
    // `requireNativeModule` throws synchronously when the module is
    // not registered (Expo Go). Catch and degrade.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expoModulesCore = require("expo-modules-core") as {
      requireOptionalNativeModule?: (name: string) => unknown;
      requireNativeModule?: (name: string) => unknown;
    };
    const opt = expoModulesCore.requireOptionalNativeModule;
    const req = expoModulesCore.requireNativeModule;
    const raw = opt
      ? (opt("ExpoMetBle") as NativeMetBle | null)
      : req
        ? (req("ExpoMetBle") as NativeMetBle | null)
        : null;
    nativeMod = raw ?? null;
    return nativeMod;
  } catch (err) {
    console.warn(
      "[ble] expo-met-ble native module not registered (Expo Go?) — BLE disabled",
      err,
    );
    nativeMod = null;
    return null;
  }
}

// ===== Legacy GATT =====

/**
 * Legacy GATT advertise. Prefer `startBeaconAdvertising` for new code.
 */
export async function startAdvertising(
  uid: string,
  hashHex: string,
): Promise<boolean> {
  const mod = getNative();
  if (!mod) return false;
  try {
    return await mod.startAdvertising(uid, hashHex);
  } catch (err) {
    console.warn("[ble] startAdvertising failed", err);
    return false;
  }
}

/** Stop the legacy GATT advertisement. Idempotent. */
export async function stopAdvertising(): Promise<void> {
  const mod = getNative();
  if (!mod) return;
  try {
    await mod.stopAdvertising();
  } catch (err) {
    console.warn("[ble] stopAdvertising failed", err);
  }
}

/**
 * Returns true if the legacy GATT advertiser is linked AND the radio
 * is available + permitted. False in Expo Go.
 */
export async function isAdvertisingAvailable(): Promise<boolean> {
  const mod = getNative();
  if (!mod) return false;
  try {
    return await mod.isAvailable();
  } catch {
    return false;
  }
}

// ===== iBeacon advertise =====

/**
 * Begin advertising as an iBeacon with the given proximity UUID and
 * `<major, minor>` pair. Resolves true on success, false if BLE is
 * unavailable / denied or the native module isn't linked.
 *
 * Safe to call repeatedly — the native side replaces any in-flight
 * iBeacon advertisement.
 */
export async function startBeaconAdvertising(
  uuid: string,
  major: number,
  minor: number,
): Promise<boolean> {
  const mod = getNative();
  if (!mod) return false;
  try {
    return await mod.startBeaconAdvertising(uuid, major, minor);
  } catch (err) {
    console.warn("[ble] startBeaconAdvertising failed", err);
    return false;
  }
}

/** Stop the current iBeacon advertisement. Idempotent. */
export async function stopBeaconAdvertising(): Promise<void> {
  const mod = getNative();
  if (!mod) return;
  try {
    await mod.stopBeaconAdvertising();
  } catch (err) {
    console.warn("[ble] stopBeaconAdvertising failed", err);
  }
}

/**
 * Returns true if iBeacon advertising is supported on this device
 * AND the user has granted Bluetooth permission. False in Expo Go,
 * on web, on devices without multi-advertisement support, or when
 * the radio is off.
 */
export async function isBeaconAdvertisingAvailable(): Promise<boolean> {
  const mod = getNative();
  if (!mod) return false;
  try {
    return await mod.isBeaconAdvertisingAvailable();
  } catch {
    return false;
  }
}

// ===== iBeacon range (scan) =====

export type BeaconRangedListener = (ev: BeaconRangedEvent) => void;

/**
 * Start ranging beacons matching the given proximity UUID. The
 * provided listener fires roughly once per second per peer in range
 * with the latest measurement. Returns a subscription handle that
 * MUST be `.remove()`-d when the caller stops needing events.
 *
 * Idempotent — calling start twice for the same UUID just re-arms
 * the underlying CoreLocation/BluetoothLeScanner request.
 */
export async function startBeaconRanging(
  uuid: string,
  listener: BeaconRangedListener,
): Promise<{ started: boolean; remove: () => void }> {
  const mod = getNative();
  if (!mod) {
    return { started: false, remove: () => {} };
  }
  let sub: NativeSubscription | null = null;
  try {
    sub = mod.addListener("onBeaconRanged", (ev) => {
      // Filter by UUID at the JS layer too — Android shares one
      // BluetoothLeScanner across all UUIDs and the native filter is
      // permissive, so multiple listeners would otherwise see each
      // other's events.
      if (ev.uuid?.toLowerCase() === uuid.toLowerCase()) {
        try {
          listener(ev);
        } catch (err) {
          console.warn("[ble] beacon listener threw", err);
        }
      }
    });
  } catch (err) {
    console.warn("[ble] addListener failed", err);
  }

  let started = false;
  try {
    started = await mod.startBeaconRanging(uuid);
  } catch (err) {
    console.warn("[ble] startBeaconRanging failed", err);
  }

  const remove = () => {
    try { sub?.remove(); } catch { /* noop */ }
    void mod.stopBeaconRanging(uuid).catch(() => {});
  };

  if (!started) {
    // Caller gets a no-op `remove` since nothing started, but we still
    // tear down the listener subscription so we don't leak it.
    try { sub?.remove(); } catch { /* noop */ }
    return { started: false, remove: () => {} };
  }
  return { started: true, remove };
}

/** Stop ranging a single proximity UUID. Idempotent. */
export async function stopBeaconRanging(uuid: string): Promise<void> {
  const mod = getNative();
  if (!mod) return;
  try {
    await mod.stopBeaconRanging(uuid);
  } catch (err) {
    console.warn("[ble] stopBeaconRanging failed", err);
  }
}

/** Stop ranging all proximity UUIDs. Idempotent. */
export async function stopAllBeaconRanging(): Promise<void> {
  const mod = getNative();
  if (!mod) return;
  try {
    await mod.stopAllBeaconRanging();
  } catch (err) {
    console.warn("[ble] stopAllBeaconRanging failed", err);
  }
}
