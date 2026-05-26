import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { api } from "@/lib/api/client";

// Server-backed referral system.
// - The canonical state lives in the server (Postgres + RevenueCat).
// - We sync to AsyncStorage so the UI works instantly on relaunch without a
//   network round-trip and so isPromoPlusActive() (called by useSubscription)
//   can read locally.

const MY_CODE_KEY = "met:referrals:myCode:v1";
const REWARD_KEY = "met:referrals:reward:v1"; // { unlockedAt, expiresAt }
const USED_KEY = "met:referrals:codeUsed:v1"; // code used by this device

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

// Tiny external store so screens can subscribe without prop drilling.
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
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function getAuthOpts(): Promise<{ uid: string } | null> {
  try {
    const authMod = await import("@react-native-firebase/auth");
    const user = authMod.default().currentUser;
    if (!user) return null;
    return { uid: user.uid };
  } catch {
    return null;
  }
}

async function readLocalReward(): Promise<ReferralReward> {
  const raw = await AsyncStorage.getItem(REWARD_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReferralReward;
  } catch {
    return null;
  }
}

async function writeLocalReward(r: ReferralReward): Promise<void> {
  if (!r) {
    await AsyncStorage.removeItem(REWARD_KEY);
  } else {
    await AsyncStorage.setItem(REWARD_KEY, JSON.stringify(r));
  }
}

async function refreshFromLocal(): Promise<void> {
  const [myCode, reward] = await Promise.all([
    AsyncStorage.getItem(MY_CODE_KEY),
    readLocalReward(),
  ]);
  cache = { myCode, count: cache.count, reward };
  notify();
}

// Sync state from the server and update local cache + AsyncStorage.
async function syncFromServer(opts: { uid: string }): Promise<void> {
  try {
    const stats = await api.getReferralStats(opts);
    const now = Date.now();
    let reward: ReferralReward = null;
    if (stats.rewardActive && stats.rewardExpiresAt && stats.rewardExpiresAt > now) {
      reward = { unlockedAt: stats.rewardExpiresAt - REWARD_DURATION_MS, expiresAt: stats.rewardExpiresAt };
    }
    await writeLocalReward(reward);
    if (stats.code) {
      await AsyncStorage.setItem(MY_CODE_KEY, stats.code);
    }
    cache = {
      myCode: stats.code ?? cache.myCode,
      count: stats.count,
      reward,
    };
    notify();
  } catch {
    // Network unavailable — use local cache; will retry next launch.
  }
}

// Called once at app start. Loads from local cache immediately, then syncs
// from server in the background (non-blocking).
export async function initReferrals(): Promise<void> {
  await refreshFromLocal();
  const opts = await getAuthOpts();
  if (opts) {
    void syncFromServer(opts);
  }
}

// Make sure we have a code for this device. Idempotent.
// When a uid is available it also registers the code server-side.
export async function ensureMyCode(): Promise<string> {
  const existing = await AsyncStorage.getItem(MY_CODE_KEY);
  if (existing) {
    // Best-effort: re-register in case the server lost this code
    // (e.g. fresh deployment, DB wipe). Fire-and-forget.
    const opts = await getAuthOpts();
    if (opts) {
      void api.registerReferralCode(opts, existing).catch(() => undefined);
    }
    return existing;
  }
  const code = generateCode();
  await AsyncStorage.setItem(MY_CODE_KEY, code);
  // Register with server
  let confirmedCode = code;
  const opts = await getAuthOpts();
  if (opts) {
    try {
      const res = await api.registerReferralCode(opts, code);
      // Server may return the pre-existing code (e.g. after sign-out cleared
      // local storage but the server still had the original code). Always use
      // the server-confirmed value so the UI shows the stable code.
      if (res.code) {
        confirmedCode = res.code;
        await AsyncStorage.setItem(MY_CODE_KEY, confirmedCode);
      }
    } catch {
      // Server unavailable — local code will be registered on next launch.
    }
  }
  cache = { ...cache, myCode: confirmedCode };
  notify();
  return confirmedCode;
}

export type RecordReferralResult =
  | "accepted"
  | "invalid_format"
  | "self_referral"
  | "already_used"
  | "code_not_found"
  | "server_error";

// Redeem another user's referral code during onboarding.
// Delegates entirely to the server — no local counter manipulation.
export async function recordReferral(
  rawCode: string,
): Promise<RecordReferralResult> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(code)) return "invalid_format";

  // Prevent re-submission if already used (local guard for fast feedback)
  const used = await AsyncStorage.getItem(USED_KEY);
  if (used) return "already_used";

  const opts = await getAuthOpts();
  if (!opts) return "server_error";

  try {
    const { result } = await api.redeemReferralCode(opts, code);
    if (result === "accepted") {
      await AsyncStorage.setItem(USED_KEY, code);
    }
    return result;
  } catch {
    return "server_error";
  }
}

// Dev-only simulate helper — kept for testing the UI flow.
export async function simulateInvite(): Promise<void> {
  if (!__DEV__) return;
  cache = { ...cache, count: cache.count + 1 };
  if (cache.count >= REQUIRED_INVITES && !cache.reward) {
    const now = Date.now();
    const reward: ReferralReward = { unlockedAt: now, expiresAt: now + REWARD_DURATION_MS };
    cache = { ...cache, reward };
    await writeLocalReward(reward);
  }
  notify();
}

// True if the local promotional Plus is currently active.
// Used by useSubscription to OR with RevenueCat's entitlement.
// NOTE: the server also grants a real RevenueCat entitlement so this
// is the fallback for when the SDK hasn't refreshed yet.
export async function isPromoPlusActive(): Promise<boolean> {
  const r = await readLocalReward();
  return !!r && r.expiresAt > Date.now();
}

export async function getPromoPlusUntil(): Promise<number | null> {
  const r = await readLocalReward();
  return r && r.expiresAt > Date.now() ? r.expiresAt : null;
}

// Wipe everything — invoked from the existing resetAll flow.
export async function clearReferrals(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(MY_CODE_KEY),
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
