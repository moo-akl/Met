// JS surface of the `expo-met-ble` native module.
//
// The native module advertises a single BLE service (the Met service
// UUID) carrying an 8-byte identity hash so other Met phones can
// detect us. Scanning is handled separately by `react-native-ble-plx`.
//
// Background-capable as of build #45. iOS uses the
// `bluetooth-peripheral` UIBackgroundMode + CBPeripheralManager
// `restoreIdentifier`. Android uses a foreground service started by
// the native module the moment advertising/scan begins.
//
// In Expo Go (no native module linked) every method here is a no-op
// that resolves harmlessly so callers don't need to feature-detect.

import { Platform } from "react-native";
import { recordNativeModule } from "../../../lib/ble/debug";

interface NativeMetBle {
  startAdvertising(uid: string, hashHex: string): Promise<boolean>;
  stopAdvertising(): Promise<void>;
  isAvailable(): Promise<boolean>;
  setBackgroundMode(active: boolean): Promise<void>;
}

let nativeMod: NativeMetBle | null | undefined;

function getNative(): NativeMetBle | null {
  if (nativeMod !== undefined) return nativeMod;
  if (Platform.OS === "web") {
    nativeMod = null;
    recordNativeModule(false, "web platform");
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
    recordNativeModule(
      nativeMod !== null,
      nativeMod === null ? "ExpoMetBle returned null (not registered)" : null,
    );
    return nativeMod;
  } catch (err) {
    console.warn(
      "[ble] expo-met-ble native module not registered (Expo Go?) — advertising disabled",
      err,
    );
    nativeMod = null;
    recordNativeModule(false, (err as Error)?.message ?? "require threw");
    return null;
  }
}

/**
 * Begin advertising the Met service with this user's identity hash.
 * Resolves true on success, false if BLE is unavailable / denied.
 *
 * Safe to call repeatedly — the native side replaces any in-flight
 * advertisement.
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

/** Stop the current advertisement. Idempotent. */
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
 * Returns true if the native module is linked AND the radio is
 * available + permitted for advertising. False in Expo Go.
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

/**
 * Android only. Starts (`active=true`) or stops (`active=false`) the
 * foreground service that keeps the process in the foreground-service
 * tier so BLE scanning continues while the app is backgrounded.
 *
 * Call with `true` as soon as BLE proximity starts and `false` when
 * it stops. The foreground service is reference-counted against
 * advertising and iBeacon scan activity — it only stops when ALL
 * sources have released it.
 *
 * No-op on iOS (background BLE is handled via UIBackgroundModes) and
 * in Expo Go (no native module).
 */
export async function setBackgroundMode(active: boolean): Promise<void> {
  const mod = getNative();
  if (!mod) return;
  try {
    await mod.setBackgroundMode(active);
  } catch (err) {
    console.warn("[ble] setBackgroundMode failed", err);
  }
}
