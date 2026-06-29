// Lazy initializer for React Native Firebase Firestore + App Check.
//
// Web preview and Expo Go don't link the native modules, so every entry
// point gates on `isFirestoreAvailable()` first. Imports are dynamic so
// the bundle doesn't crash trying to resolve native code when the
// bridge isn't there.

import { Platform } from "react-native";

type FirestoreModule = typeof import("@react-native-firebase/firestore").default;
export type Firestore = ReturnType<FirestoreModule>;

let cached: Firestore | null = null;
let nativeUnavailable = false;
let appCheckInitialized = false;

export function isFirestoreAvailable(): boolean {
  if (nativeUnavailable) return false;
  if (Platform.OS === "web") {
    nativeUnavailable = true;
    return false;
  }
  return true;
}

/**
 * Initialize App Check once per process. Uses the debug provider in
 * `__DEV__` and the platform-native provider (App Attest / Play
 * Integrity) in release builds.
 *
 * Best-effort: any failure is logged and we proceed without App Check.
 * Firestore reads/writes will still succeed — the rules tolerate a
 * missing app-check token outside production.
 */
async function initAppCheck(): Promise<void> {
  if (appCheckInitialized) return;
  appCheckInitialized = true;
  try {
    const { default: appCheck, firebase } = await import(
      "@react-native-firebase/app-check"
    );
    void firebase;
    const provider = appCheck().newReactNativeFirebaseAppCheckProvider();
    provider.configure({
      android: {
        provider: __DEV__ ? "debug" : "playIntegrity",
        debugToken: process.env["EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN"],
      },
      apple: {
        provider: __DEV__ ? "debug" : "appAttestWithDeviceCheckFallback",
        debugToken: process.env["EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN"],
      },
      web: {
        provider: "reCaptchaV3",
        siteKey: "unused",
      },
    });
    await appCheck().initializeAppCheck({
      provider,
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    // Non-fatal — Firestore still works without App Check during dev.
    console.warn("[firestore] App Check init failed", err);
  }
}

/**
 * Returns the Firestore singleton, or null if the native module isn't
 * available. Side-effect: initializes App Check on first call.
 */
export async function getFirestoreModule(): Promise<Firestore | null> {
  if (!isFirestoreAvailable()) return null;
  if (cached) return cached;
  try {
    // Import Firestore first — App Check is best-effort and must never
    // block or crash Firestore initialization.
    const mod = await import("@react-native-firebase/firestore");
    cached = mod.default();
    // Fire-and-forget App Check after Firestore is ready.
    void initAppCheck();
    return cached;
  } catch (err) {
    console.warn("[firestore] init failed", err);
    nativeUnavailable = true;
    return null;
  }
}

/**
 * Eagerly initialize Firestore + App Check. Called once from
 * `_layout.tsx` so the first encounter / nearby query doesn't pay the
 * cold-start cost. Resolves to `false` on platforms without the native
 * bridge.
 */
export async function initializeFirestore(): Promise<boolean> {
  const fs = await getFirestoreModule();
  return fs !== null;
}
