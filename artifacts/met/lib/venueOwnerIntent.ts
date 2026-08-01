/**
 * Persistent venue-owner sign-up intent.
 *
 * When a user taps "I own or manage a venue" (or opens a venue-owner deep
 * link) before they are authenticated, that intent must survive app
 * termination — otherwise a force-quit during auth/email-verification drops
 * them onto the normal consumer flow. The flag is stored globally (not
 * UID-scoped) because it is set *before* sign-in; it is cleared as soon as
 * it is consumed (routed to venue setup/dashboard) or on sign-out.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "met:venue-owner-intent:v1";

export async function saveVenueOwnerIntent(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, "1");
  } catch {
    // Best-effort — in-memory state still drives the current session.
  }
}

export async function loadVenueOwnerIntent(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === "1";
  } catch {
    return false;
  }
}

export async function clearVenueOwnerIntent(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Best-effort.
  }
}
