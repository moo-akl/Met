// Auth helpers for the Met app.
//
// Strategy:
//   - On real iOS/Android builds: lazily sign the user in anonymously the
//     first time we need an identity, and use the resulting Firebase UID as
//     the user's stable Profile.id. Firebase persists the session across
//     app launches via its own native storage.
//   - On web preview / Expo Go without the native module: fall back to a
//     locally-generated UUID-style ID so onboarding still completes during
//     development.
//
// Future work (Phase 2 of Firebase wiring):
//   - Email/password sign-in screen
//   - Apple Sign-In (expo-apple-authentication)
//   - Google Sign-In (@react-native-google-signin/google-signin)
//   - Account-link flow for converting an anonymous user into a
//     credentialed one without losing data.

import { getAuthModule, isFirebaseAvailable } from "./firebase";

function generateLocalId(): string {
  // Roughly UUID-ish; only used as a dev fallback when Firebase isn't
  // available (web preview, Expo Go).
  return (
    "local-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}

/**
 * Returns a stable user ID. On native it signs in anonymously if there's
 * no current Firebase user, then returns the Firebase UID. On web /
 * Expo Go (no native module) it returns a locally-generated ID so the
 * dev preview can still complete onboarding.
 *
 * IMPORTANT: when Firebase IS available (native dev-client / EAS build)
 * we do NOT silently fall back to a local ID on sign-in failure — that
 * would let production users complete onboarding with a non-Firebase
 * identity. Instead the error is rethrown so the caller can show a
 * blocking retry UI.
 *
 * Safe to call multiple times — it reuses the existing session.
 */
export async function getOrCreateUserId(): Promise<string> {
  const auth = await getAuthModule();
  if (!auth) {
    return generateLocalId();
  }
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }
  const cred = await auth.signInAnonymously();
  return cred.user.uid;
}

/**
 * Heuristic: does this look like a Firebase UID?
 *
 * Firebase UIDs are typically 28-character base62 strings. Anything that
 * is a pure-digit timestamp (legacy `Date.now().toString()`) or starts
 * with our `local-` prefix should be migrated when Firebase becomes
 * available.
 */
export function isLegacyUserId(id: string): boolean {
  if (id.startsWith("local-")) return true;
  if (/^\d+$/.test(id)) return true; // legacy Date.now() IDs
  return false;
}

/**
 * Returns the current user's ID without forcing a sign-in. Returns null
 * if no session exists yet. Use this when you only want to *read* the
 * current identity.
 */
export async function getCurrentUserId(): Promise<string | null> {
  if (!isFirebaseAvailable()) return null;
  const auth = await getAuthModule();
  return auth?.currentUser?.uid ?? null;
}

/**
 * Signs the current user out. On the dev fallback path this is a no-op
 * since there's no Firebase session to invalidate.
 */
export async function signOut(): Promise<void> {
  const auth = await getAuthModule();
  if (!auth) return;
  try {
    await auth.signOut();
  } catch {
    // Ignore — caller is typically using this as a "best effort" cleanup.
  }
}

/**
 * Permanently deletes the current Firebase user, then signs out. Used
 * by the "Delete Account" flow so the user starts with a brand-new
 * identity if they re-onboard.
 *
 * Best-effort: never throws. Anonymous users can always be deleted.
 * For credentialed users (Phase 2: email/Apple/Google), Firebase may
 * return `auth/requires-recent-login` — when that happens we fall back
 * to signOut() so at least the local session is cleared. The caller
 * (UI layer) is then responsible for prompting re-authentication if
 * stricter deletion is required.
 */
export async function deleteUserAccount(): Promise<void> {
  const auth = await getAuthModule();
  if (!auth) return;
  const user = auth.currentUser;
  if (!user) return;
  try {
    await user.delete();
  } catch {
    // Couldn't delete (e.g. requires-recent-login, network). Sign out
    // so we at least invalidate the local session before the local
    // data wipe runs.
    try {
      await auth.signOut();
    } catch {
      // Best-effort.
    }
  }
}
