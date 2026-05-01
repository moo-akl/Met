// JS surface of the `expo-met-ble` native module.
//
// The native module advertises a single BLE service (the Met service
// UUID) carrying an 8-byte identity hash so other Met phones can
// detect us. Scanning is handled separately by `react-native-ble-plx`.
//
// Foreground only. Background advertising on iOS requires
// `bluetooth-peripheral` background mode + App Store justification —
// out of scope for v1.0.
//
// In Expo Go (no native module linked) every method here is a no-op
// that resolves harmlessly so callers don't need to feature-detect.

import { Platform } from "react-native";

interface NativeMetBle {
  startAdvertising(uid: string, hashHex: string): Promise<boolean>;
  stopAdvertising(): Promise<void>;
  isAvailable(): Promise<boolean>;
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
      "[ble] expo-met-ble native module not registered (Expo Go?) — advertising disabled",
      err,
    );
    nativeMod = null;
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
