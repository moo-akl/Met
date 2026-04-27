import AsyncStorage from "@react-native-async-storage/async-storage";

// Per-day quotas, keyed by local-day so the bucket resets at midnight.
//
// Free tier: 4 reveals per day (used to be 2/day · originally 3/week).
// Plus tier: 1 opening message per day.
// Pro tier:  2 opening messages per day.
//
// We also expose a soft cap on the visible encounter feed for free users.

export const FREE_REVEALS_PER_DAY = 4;
export const PLUS_OPENING_MESSAGES_PER_DAY = 1;
export const PRO_OPENING_MESSAGES_PER_DAY = 2;
export const FREE_VISIBLE_ENCOUNTERS = 20;

const REVEALS_KEY = "met:reveals:v2";
const OPENINGS_KEY = "met:openings:v1";

type DailyUsage = {
  dayKey: string;
  count: number;
};

function dayKeyOf(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function todayKey(): string {
  return dayKeyOf(Date.now());
}

// Start of the local day (midnight) in ms. Used to slice encounter feeds
// against the free 20/day cap so the bucket resets at midnight automatically.
export function startOfTodayMs(now: number = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

async function readBucket(key: string): Promise<DailyUsage> {
  const raw = await AsyncStorage.getItem(key);
  const today = todayKey();
  if (!raw) return { dayKey: today, count: 0 };
  try {
    const parsed = JSON.parse(raw) as DailyUsage;
    if (parsed.dayKey !== today) return { dayKey: today, count: 0 };
    return parsed;
  } catch {
    return { dayKey: today, count: 0 };
  }
}

// Single-flight mutex per bucket so two concurrent taps can't both pass a
// `remaining > 0` check and then both increment past the cap.
const writeChains: Record<string, Promise<unknown>> = {};

function tryConsume(
  key: string,
  cap: number,
): Promise<number | null> {
  const prev = writeChains[key] ?? Promise.resolve();
  const next = prev.then(async () => {
    const cur = await readBucket(key);
    if (cur.count >= cap) return null;
    const updated: DailyUsage = { dayKey: cur.dayKey, count: cur.count + 1 };
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    return updated.count;
  });
  writeChains[key] = next.catch(() => undefined);
  return next;
}

// ---------- Reveals ----------

export async function getRevealsToday(): Promise<number> {
  return (await readBucket(REVEALS_KEY)).count;
}

export async function getRevealsRemaining(): Promise<number> {
  return Math.max(0, FREE_REVEALS_PER_DAY - (await readBucket(REVEALS_KEY)).count);
}

export function tryConsumeFreeReveal(): Promise<number | null> {
  return tryConsume(REVEALS_KEY, FREE_REVEALS_PER_DAY);
}

export async function resetRevealsToday(): Promise<void> {
  await AsyncStorage.removeItem(REVEALS_KEY);
}

// ---------- Opening messages ----------

export async function getOpeningMessagesToday(): Promise<number> {
  return (await readBucket(OPENINGS_KEY)).count;
}

export async function getOpeningMessagesRemaining(
  perDayCap: number,
): Promise<number> {
  return Math.max(0, perDayCap - (await readBucket(OPENINGS_KEY)).count);
}

export function tryConsumeOpeningMessage(
  perDayCap: number,
): Promise<number | null> {
  return tryConsume(OPENINGS_KEY, perDayCap);
}

export async function resetOpeningMessagesToday(): Promise<void> {
  await AsyncStorage.removeItem(OPENINGS_KEY);
}
