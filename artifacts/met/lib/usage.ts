import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "met:reveals:v1";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const FREE_REVEALS_PER_WEEK = 3;

type WeeklyUsage = {
  weekStart: number;
  count: number;
};

async function read(): Promise<WeeklyUsage> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { weekStart: Date.now(), count: 0 };
  try {
    const parsed = JSON.parse(raw) as WeeklyUsage;
    if (Date.now() - parsed.weekStart > WEEK_MS) {
      return { weekStart: Date.now(), count: 0 };
    }
    return parsed;
  } catch {
    return { weekStart: Date.now(), count: 0 };
  }
}

export async function getRevealsThisWeek(): Promise<number> {
  return (await read()).count;
}

export async function getRevealsRemaining(): Promise<number> {
  return Math.max(0, FREE_REVEALS_PER_WEEK - (await read()).count);
}

// Single-flight mutex so two concurrent taps can't both pass a `remaining > 0`
// check and then both increment past the cap.
let writeChain: Promise<unknown> = Promise.resolve();

/**
 * Atomically check the free-tier quota and consume one reveal if available.
 * Returns the resulting count if consumed, or `null` if the cap was already hit.
 */
export function tryConsumeFreeReveal(): Promise<number | null> {
  const next = writeChain.then(async () => {
    const cur = await read();
    if (cur.count >= FREE_REVEALS_PER_WEEK) return null;
    const updated = { weekStart: cur.weekStart, count: cur.count + 1 };
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
    return updated.count;
  });
  // Don't let a single failure poison the chain.
  writeChain = next.catch(() => undefined);
  return next;
}

export async function incrementRevealsThisWeek(): Promise<number> {
  const result = await tryConsumeFreeReveal();
  return result ?? FREE_REVEALS_PER_WEEK;
}

export async function resetRevealsThisWeek(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
