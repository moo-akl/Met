// Persistent per-pair encounter cooldown.
//
// We don't want to write the same encounter every time two devices
// poll within visual range of each other — the old Flutter app used a
// 2-hour window and that's what we mirror here.
//
// Cooldown state lives in AsyncStorage so it survives app restarts.
// Each pair gets one key: `met:cooldown:<myUid>:<otherUid> = epochMs`.
// We read lazily and write on every successful encounter record.

import AsyncStorage from "@react-native-async-storage/async-storage";

const COOLDOWN_MS = 2 * 60 * 60 * 1000;
const KEY_PREFIX = "met:cooldown:";

function key(myUid: string, otherUid: string): string {
  return `${KEY_PREFIX}${myUid}:${otherUid}`;
}

/**
 * Returns true if we've already recorded an encounter with `otherUid`
 * within the cooldown window. Treats storage errors as "not in
 * cooldown" — better to risk a duplicate write than miss an encounter.
 */
export async function isInCooldown(
  myUid: string,
  otherUid: string,
): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(key(myUid, otherUid));
    if (!raw) return false;
    const ts = Number.parseInt(raw, 10);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < COOLDOWN_MS;
  } catch {
    return false;
  }
}

/**
 * Stamp a fresh cooldown for the given pair. Best-effort — failures
 * are swallowed.
 */
export async function markCooldown(
  myUid: string,
  otherUid: string,
): Promise<void> {
  try {
    await AsyncStorage.setItem(key(myUid, otherUid), String(Date.now()));
  } catch {
    /* best-effort */
  }
}

/**
 * Clear all cooldowns for the given user. Used on sign-out / account
 * reset so a fresh sign-in doesn't inherit stale state.
 */
export async function clearCooldownsFor(uid: string): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const prefix = `${KEY_PREFIX}${uid}:`;
    const mine = allKeys.filter((k) => k.startsWith(prefix));
    if (mine.length > 0) await AsyncStorage.multiRemove(mine);
  } catch {
    /* best-effort */
  }
}
