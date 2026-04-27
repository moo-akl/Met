import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

// Local-only referral attribution for the prototype. In production this would
// live on a backend that resolves install-time deferred deep links and grants
// RevenueCat promotional entitlements. Here we mirror that flow with on-device
// state so the full UX (code, share, progress, reward) is fully testable.

const MY_CODE_KEY = "met:referrals:myCode:v1";
const COUNTS_KEY = "met:referrals:counts:v1"; // { [code]: number }
const REWARD_KEY = "met:referrals:reward:v1"; // { unlockedAt, expiresAt }
const USED_KEY = "met:referrals:codeUsed:v1"; // string — set when the user accepts a code in onboarding

export const REQUIRED_INVITES = 3;
export const REWARD_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type ReferralReward = {
  unlockedAt: number;
  expiresAt: number;
} | null;

export type ReferralState = {
  myCode: string | null;
  count: number;
  reward: ReferralReward;
};

// Tiny external store so screens can subscribe to changes without prop drilling.
const subs = new Set<() => void>();
function notify() {
  for (const s of subs) s();
}
function subscribe(cb: () => void): () => void {
  subs.add(cb);
  return () => subs.delete(cb);
}

let cache: ReferralState = { myCode: null, count: 0, reward: null };

function getSnapshot(): ReferralState {
  return cache;
}

function generateCode(): string {
  // 6 chars, no ambiguous 0/O/1/I.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function readCounts(): Promise<Record<string, number>> {
  const raw = await AsyncStorage.getItem(COUNTS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

async function writeCounts(counts: Record<string, number>): Promise<void> {
  await AsyncStorage.setItem(COUNTS_KEY, JSON.stringify(counts));
}

async function readReward(): Promise<ReferralReward> {
  const raw = await AsyncStorage.getItem(REWARD_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReferralReward;
  } catch {
    return null;
  }
}

async function writeReward(r: ReferralReward): Promise<void> {
  if (!r) {
    await AsyncStorage.removeItem(REWARD_KEY);
  } else {
    await AsyncStorage.setItem(REWARD_KEY, JSON.stringify(r));
  }
}

// Refreshes the in-memory cache from disk and notifies subscribers.
async function refresh(): Promise<void> {
  const [myCode, counts, reward] = await Promise.all([
    AsyncStorage.getItem(MY_CODE_KEY),
    readCounts(),
    readReward(),
  ]);
  const count = myCode ? (counts[myCode] ?? 0) : 0;
  cache = { myCode, count, reward };
  notify();
}

// Called once at app start.
export async function initReferrals(): Promise<void> {
  await ensureMyCode();
  await refresh();
}

// Make sure we have a code for this device. Idempotent.
export async function ensureMyCode(): Promise<string> {
  const existing = await AsyncStorage.getItem(MY_CODE_KEY);
  if (existing) return existing;
  const code = generateCode();
  await AsyncStorage.setItem(MY_CODE_KEY, code);
  return code;
}

export type RecordReferralResult =
  | "accepted"
  | "invalid_format"
  | "self_referral"
  | "already_used";

// Mark a code as used by THIS device (during onboarding). Increments the
// owner's count and unlocks their reward if they cross the threshold.
//
// PROTOTYPE NOTE: in production, attribution must be verified server-side
// against a real registry of issued codes (and de-duplicated by a trusted
// install identifier) — otherwise random/typo codes would award rewards.
// Here we do best-effort local validation so the UX flow is fully testable.
// The function returns a structured result so the caller can surface the
// specific reason for rejection (instead of silently consuming the user's
// one-and-only redemption on a typo).
export async function recordReferral(
  rawCode: string,
): Promise<RecordReferralResult> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(code)) return "invalid_format";
  const myCode = await AsyncStorage.getItem(MY_CODE_KEY);
  if (myCode && code === myCode) return "self_referral";
  const used = await AsyncStorage.getItem(USED_KEY);
  if (used) return "already_used"; // each device may use only one code, ever

  const counts = await readCounts();
  counts[code] = (counts[code] ?? 0) + 1;
  await writeCounts(counts);
  await AsyncStorage.setItem(USED_KEY, code);

  // If we (this device) own the code that was just used, also unlock the
  // reward locally — useful for the demo "simulate a friend joining" path.
  if (myCode && myCode === code && counts[code] >= REQUIRED_INVITES) {
    await unlockReward();
  }
  await refresh();
  return "accepted";
}

// Bump our own count by 1 (demo-only path so users can see the reward flow).
// Guarded by `__DEV__` at the call site so this never fires in release builds.
export async function simulateInvite(): Promise<void> {
  if (!__DEV__) return; // belt-and-suspenders: never unlock rewards in prod
  const myCode = await ensureMyCode();
  const counts = await readCounts();
  counts[myCode] = (counts[myCode] ?? 0) + 1;
  await writeCounts(counts);
  if (counts[myCode] >= REQUIRED_INVITES) {
    await unlockReward();
  }
  await refresh();
}

async function unlockReward(): Promise<void> {
  const existing = await readReward();
  if (existing && existing.expiresAt > Date.now()) return; // already active
  const now = Date.now();
  await writeReward({ unlockedAt: now, expiresAt: now + REWARD_DURATION_MS });
}

// True if the local promotional Plus is currently active. Used by
// useSubscription to OR with RevenueCat's entitlement.
export async function isPromoPlusActive(): Promise<boolean> {
  const r = await readReward();
  return !!r && r.expiresAt > Date.now();
}

export async function getPromoPlusUntil(): Promise<number | null> {
  const r = await readReward();
  return r && r.expiresAt > Date.now() ? r.expiresAt : null;
}

// Wipe everything — invoked from the existing `resetAll` flow.
export async function clearReferrals(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(MY_CODE_KEY),
    AsyncStorage.removeItem(COUNTS_KEY),
    AsyncStorage.removeItem(REWARD_KEY),
    AsyncStorage.removeItem(USED_KEY),
  ]);
  cache = { myCode: null, count: 0, reward: null };
  notify();
}

// React hook — re-renders on any referral state change.
export function useReferrals(): ReferralState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
