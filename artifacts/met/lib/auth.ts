// Auth helpers for the Met app.
//
// Strategy: real sign-in only — no anonymous fallback in production.
// The user must sign in with Apple, Google, or email/password before
// onboarding can save a profile. On web preview / Expo Go (no native
// module) the dev "Skip sign-in" button issues a local- ID so the rest
// of onboarding can still be developed against, but production builds
// always go through Firebase.

import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

import { getAuthModule, isFirebaseAvailable } from "./firebase";

// Web OAuth client ID for Google Sign-In. This is the project-level
// `client_type: 3` entry from google-services.json — required by
// Firebase to verify Google ID tokens regardless of platform.
const GOOGLE_WEB_CLIENT_ID =
  "572463722097-murgspd878hrs4r6aa6nkhhupfh5rivu.apps.googleusercontent.com";

let googleConfigured = false;

async function ensureGoogleConfigured(): Promise<void> {
  if (googleConfigured) return;
  const mod = await import("@react-native-google-signin/google-signin");
  mod.GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
  googleConfigured = true;
}

/**
 * Generate a fresh nonce pair for Apple Sign-In. Apple expects the
 * SHA-256 hash of the nonce in `signInAsync({ nonce })` and embeds the
 * raw value in the returned identity JWT. We then forward the raw
 * value to Firebase so it can verify the round-trip and prevent token
 * replay.
 */
async function generateAppleNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    raw,
  );
  return { raw, hashed };
}

/**
 * True if the thrown error represents a user-initiated cancellation
 * (closing the SSO sheet, dismissing the Apple dialog, etc.). Callers
 * should treat this as a silent no-op rather than a hard failure.
 */
function isCancelError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  if (!code) return false;
  // expo-apple-authentication: ERR_REQUEST_CANCELED
  // @react-native-google-signin/google-signin: SIGN_IN_CANCELLED (-5 / "12501")
  if (code === "ERR_REQUEST_CANCELED" || code === "ERR_CANCELED") return true;
  if (code === "SIGN_IN_CANCELLED" || code === "-5" || code === "12501") {
    return true;
  }
  return false;
}

/**
 * Heuristic: does this look like a legacy / non-Firebase ID? Used by
 * UI surfaces that may want to nudge the user to (re-)sign in.
 *
 * Firebase UIDs are 28-character base62 strings. Legacy IDs are pure
 * digits (Date.now()) or our `local-` dev fallback prefix.
 */
export function isLegacyUserId(id: string): boolean {
  if (id.startsWith("local-")) return true;
  if (/^\d+$/.test(id)) return true;
  return false;
}

/**
 * Returns the current user's ID without forcing a sign-in. Returns null
 * if no session exists yet.
 */
export async function getCurrentUserId(): Promise<string | null> {
  if (!isFirebaseAvailable()) return null;
  const auth = await getAuthModule();
  return auth?.currentUser?.uid ?? null;
}

/**
 * Returns the current Firebase UID, or throws if no user is signed in.
 * Use this at the boundary of any operation that needs an authenticated
 * identity.
 */
export async function requireUserId(): Promise<string> {
  const auth = await getAuthModule();
  if (!auth || !auth.currentUser) {
    throw new Error("Not signed in");
  }
  return auth.currentUser.uid;
}

/**
 * Signs the current user out. No-op when Firebase isn't available.
 */
export async function signOut(): Promise<void> {
  const auth = await getAuthModule();
  if (!auth) return;
  try {
    await auth.signOut();
  } catch {
    // Best-effort.
  }
}

/**
 * Permanently deletes the current Firebase user, then signs out. Used
 * by "Delete Account" so the user starts with a brand-new identity.
 *
 * For credentialed users Firebase may return `auth/requires-recent-login`
 * — when that happens we fall back to signOut() so the local session is
 * still cleared.
 */
export async function deleteUserAccount(): Promise<void> {
  const auth = await getAuthModule();
  if (!auth) return;
  const user = auth.currentUser;
  if (!user) return;
  try {
    await user.delete();
  } catch {
    try {
      await auth.signOut();
    } catch {
      // Best-effort.
    }
  }
}

// ---------------------------------------------------------------------
// Sign-in methods
//
// All sign-in methods return:
//   - the new Firebase UID on success
//   - null when the user explicitly cancels the SSO sheet
//   - throw on every other failure (network, invalid credentials, etc.)
// ---------------------------------------------------------------------

export async function signInWithApple(): Promise<string | null> {
  if (Platform.OS !== "ios") {
    throw new Error("Apple Sign-In is only available on iOS");
  }
  const auth = await getAuthModule();
  if (!auth) throw new Error("Firebase not available");

  const AppleAuth = await import("expo-apple-authentication");

  const { raw, hashed } = await generateAppleNonce();
  let credential: import("expo-apple-authentication").AppleAuthenticationCredential;
  try {
    credential = await AppleAuth.signInAsync({
      requestedScopes: [
        AppleAuth.AppleAuthenticationScope.FULL_NAME,
        AppleAuth.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashed,
    });
  } catch (e) {
    if (isCancelError(e)) return null;
    throw e;
  }
  if (!credential.identityToken) {
    throw new Error("No Apple identity token");
  }
  const firebaseAuth = (await import("@react-native-firebase/auth")).default;
  // Pass the raw nonce so Firebase can verify the JWT carries the same
  // (hashed) value Apple received from us — replay protection.
  const provider = firebaseAuth.AppleAuthProvider.credential(
    credential.identityToken,
    raw,
  );
  const userCred = await auth.signInWithCredential(provider);
  return userCred.user.uid;
}

export async function signInWithGoogle(): Promise<string | null> {
  const auth = await getAuthModule();
  if (!auth) throw new Error("Firebase not available");

  await ensureGoogleConfigured();
  const mod = await import("@react-native-google-signin/google-signin");
  const { GoogleSignin } = mod;

  // Android requires Google Play Services. iOS no-op.
  if (Platform.OS === "android") {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  let res: unknown;
  try {
    res = await GoogleSignin.signIn();
  } catch (e) {
    if (isCancelError(e)) return null;
    throw e;
  }

  // Compatible with both v15+ (data shape) and older flat shape.
  const resAny = res as { data?: { idToken?: string }; idToken?: string; type?: string };
  if (resAny.type === "cancelled") return null;
  const idToken = resAny.data?.idToken ?? resAny.idToken;
  if (!idToken) {
    throw new Error("No Google ID token returned");
  }

  const firebaseAuth = (await import("@react-native-firebase/auth")).default;
  const cred = firebaseAuth.GoogleAuthProvider.credential(idToken);
  const userCred = await auth.signInWithCredential(cred);
  return userCred.user.uid;
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<string> {
  const auth = await getAuthModule();
  if (!auth) throw new Error("Firebase not available");
  const userCred = await auth.signInWithEmailAndPassword(email.trim(), password);
  return userCred.user.uid;
}

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<string> {
  const auth = await getAuthModule();
  if (!auth) throw new Error("Firebase not available");
  const userCred = await auth.createUserWithEmailAndPassword(
    email.trim(),
    password,
  );
  return userCred.user.uid;
}

export async function sendPasswordReset(email: string): Promise<void> {
  const auth = await getAuthModule();
  if (!auth) throw new Error("Firebase not available");
  await auth.sendPasswordResetEmail(email.trim());
}
