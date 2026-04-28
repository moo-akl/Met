// Thin wrapper around React Native Firebase. The native modules are only
// linked into real iOS/Android builds (EAS / dev client). On web preview
// and Expo Go (without the linked module) we expose `available = false`
// so callers fall back to local-only behaviour.
//
// Usage:
//   import { isFirebaseAvailable, getAuthModule } from "@/lib/firebase";

import { Platform } from "react-native";

type AuthModule = typeof import("@react-native-firebase/auth").default;

let cachedAuth: ReturnType<AuthModule> | null = null;
let nativeUnavailable = false;

export function isFirebaseAvailable(): boolean {
  // Web preview and Expo Go without the linked native module both lack
  // the native bridge. Once we've detected unavailability we cache it.
  if (nativeUnavailable) return false;
  if (Platform.OS === "web") {
    nativeUnavailable = true;
    return false;
  }
  return true;
}

export async function getAuthModule(): Promise<ReturnType<AuthModule> | null> {
  if (!isFirebaseAvailable()) return null;
  if (cachedAuth) return cachedAuth;
  try {
    const mod = await import("@react-native-firebase/auth");
    cachedAuth = mod.default();
    return cachedAuth;
  } catch {
    nativeUnavailable = true;
    return null;
  }
}
