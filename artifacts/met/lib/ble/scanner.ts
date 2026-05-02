// iBeacon scanner singleton.
//
// Owns one CoreLocation ranging session (iOS) / one BLE scan session
// (Android) for the Met proximity UUID. Each ranged beacon's `major`
// is queued and resolved to a profile via the backend, then forwarded
// as a `BleDetection` to the listener.
//
// Why iBeacon over GATT
// ---------------------
// The earlier GATT-based scanner relied on `react-native-ble-plx` to
// discover Met advertisements by service UUID. iOS strips service UUIDs
// from advertisements when an app is backgrounded, so iOS↔iOS
// detection in the field was unreliable. iBeacon ranging via
// CoreLocation works in the foreground reliably and is the same
// scheme the original Flutter MVP shipped — it's what made the old
// app feel instant.
//
// Race-safety mirrors `lib/proximity/presence.ts`: a per-session
// generation token tags every async hop so a stale start can't clobber
// a fresh one. Every callback re-checks `liveStateFor(gen)` before
// touching shared state.
//
// Behavior in Expo Go: the native module isn't linked, so
// `startBeaconRanging` returns `started: false` and `start()` resolves
// `{started:false, reason:"BLE native module unavailable"}` without
// throwing. Same fallback for web.

import { api, type RemoteProfile } from "../api/client";
import {
  startBeaconRanging,
  type BeaconRangedEvent,
} from "../../modules/expo-met-ble/src";
import { MET_IBEACON_MINOR, MET_IBEACON_UUID } from "./uuids";

// Resolve cadence. iBeacon ranging delivers callbacks roughly once per
// second per peer in range, so we don't need a long batch window —
// 800ms is short enough to feel instant but long enough to coalesce
// multiple events from the same peer into one HTTP round-trip.
const RESOLVE_BATCH_INTERVAL_MS = 800;
const RESOLVE_BATCH_MAX = 32;
// Cooldown before re-emitting the same peer to the listener. Mirrors
// the Flutter MVP's 10-minute "recently met" window so we don't spam
// the encounter feed with duplicate detections.
const FIRE_REEMIT_MS = 10 * 60_000;

export interface BleDetection {
  uid: string;
  /** iBeacon major value matched on the server. */
  major: number;
  rssi: number | null;
  source: "ble";
  profile: RemoteProfile;
  observedAt: number;
}

export type BleListener = (event: BleDetection) => void;

export interface StartBleScannerOptions {
  uid: string;
  listener: BleListener;
}

interface ScannerState {
  generation: number;
  uid: string;
  listener: BleListener;
  rangingHandle: { started: boolean; remove: () => void } | null;
  // major → most-recent rssi seen during the current batch window.
  pendingMajors: Map<number, number | null>;
  // major → last time we successfully emitted; subject to FIRE_REEMIT_MS.
  lastEmitted: Map<number, number>;
  // Majors currently being resolved by the backend. Same dedup
  // semantics as the legacy GATT scanner: drop dupes while in flight.
  inFlightMajors: Set<number>;
  resolveTimer: ReturnType<typeof setInterval> | null;
  resolveInFlight: boolean;
}

let state: ScannerState | null = null;
let nextGeneration = 1;

function liveStateFor(gen: number): ScannerState | null {
  if (!state || state.generation !== gen) return null;
  return state;
}

export async function startBleScanner(
  opts: StartBleScannerOptions,
): Promise<{ started: boolean; reason?: string }> {
  if (state) {
    if (state.uid === opts.uid) {
      state.listener = opts.listener;
      return { started: true };
    }
    stopBleScanner();
  }

  if (!api.isConfigured()) {
    return { started: false, reason: "API not configured" };
  }

  const generation = nextGeneration++;
  const next: ScannerState = {
    generation,
    uid: opts.uid,
    listener: opts.listener,
    rangingHandle: null,
    pendingMajors: new Map(),
    lastEmitted: new Map(),
    inFlightMajors: new Set(),
    resolveTimer: null,
    resolveInFlight: false,
  };
  state = next;

  // Subscribe to the native ranging stream. Each event carries an
  // array of beacons currently in range (one per peer) with their
  // latest major/rssi/accuracy.
  const handle = await startBeaconRanging(MET_IBEACON_UUID, (ev) => {
    const live = liveStateFor(generation);
    if (!live) return;
    handleRangedEvent(live, ev);
  });

  if (generation + 1 !== nextGeneration || state !== next) {
    // Superseded — newer start/stop won the race.
    handle.remove();
    return { started: false, reason: "Superseded by newer start/stop" };
  }

  if (!handle.started) {
    state = null;
    return {
      started: false,
      reason: "iBeacon ranging unavailable (Expo Go or permission denied)",
    };
  }

  next.rangingHandle = handle;
  next.resolveTimer = setInterval(
    () => runResolveOnce(generation),
    RESOLVE_BATCH_INTERVAL_MS,
  );

  return { started: true };
}

export function stopBleScanner(): void {
  const s = state;
  if (!s) return;
  state = null;
  if (s.resolveTimer) clearInterval(s.resolveTimer);
  if (s.rangingHandle) {
    try { s.rangingHandle.remove(); } catch { /* noop */ }
  }
}

export function isBleScannerRunning(): boolean {
  return state !== null;
}

function handleRangedEvent(live: ScannerState, ev: BeaconRangedEvent): void {
  const now = Date.now();
  for (const beacon of ev.beacons) {
    const major = beacon.major | 0;
    // The server's `uidToMajor` is `... % 65535`, so its valid output
    // range is [0, 65534]. The OpenAPI Zod schema rejects 65535, so a
    // single rogue/foreign beacon advertising `major === 65535` would
    // 400 the entire resolve batch and starve every legitimate major
    // alongside it. Clamp client-side and drop minor mismatches too.
    if (major < 0 || major > 65534) continue;
    if (beacon.minor !== undefined && beacon.minor !== MET_IBEACON_MINOR) {
      continue;
    }
    // Skip if we emitted this peer recently OR a resolve for this
    // major is in flight (which will emit shortly).
    const lastEmit = live.lastEmitted.get(major) ?? 0;
    if (now - lastEmit < FIRE_REEMIT_MS) continue;
    if (live.inFlightMajors.has(major)) continue;
    // Capture the strongest (least-negative) RSSI seen this batch.
    const prev = live.pendingMajors.get(major) ?? null;
    const rssi = typeof beacon.rssi === "number" ? beacon.rssi : null;
    if (rssi != null && (prev == null || rssi > prev)) {
      live.pendingMajors.set(major, rssi);
    } else if (!live.pendingMajors.has(major)) {
      live.pendingMajors.set(major, rssi);
    }
  }
}

async function runResolveOnce(gen: number): Promise<void> {
  let s = liveStateFor(gen);
  if (!s) return;
  if (s.resolveInFlight) return;
  if (s.pendingMajors.size === 0) return;

  // Drain the pending batch, but only take RESOLVE_BATCH_MAX majors
  // per tick. The remainder stays in `pendingMajors` so the next tick
  // (or a future ranging event with a higher RSSI) picks them up.
  const allEntries = [...s.pendingMajors.entries()];
  const taken = allEntries.slice(0, RESOLVE_BATCH_MAX);
  const overflow = allEntries.slice(RESOLVE_BATCH_MAX);
  const batch = new Map<number, number | null>(taken);

  s.pendingMajors.clear();
  for (const [m, r] of overflow) s.pendingMajors.set(m, r);

  for (const m of batch.keys()) s.inFlightMajors.add(m);
  s.resolveInFlight = true;
  const majors = [...batch.keys()];

  try {
    let entries: { major: number | null; profile: RemoteProfile }[] = [];
    try {
      entries = await api.bleResolve({ uid: s.uid }, { majors });
    } catch (err) {
      const live = liveStateFor(gen);
      if (live) {
        for (const [m, r] of batch) {
          if (!live.pendingMajors.has(m)) live.pendingMajors.set(m, r);
        }
      }
      console.warn("[ble] resolve failed", (err as Error)?.message ?? err);
      return;
    }

    s = liveStateFor(gen);
    if (!s) return;

    const now = Date.now();
    // Group resolved profiles by major so we can pick exactly one
    // winner per major (the closest by RSSI is meaningless across
    // collisions — pick the first; collisions at 16 bits are rare
    // enough for current scale that this is acceptable).
    const byMajor = new Map<number, RemoteProfile[]>();
    for (const entry of entries) {
      if (entry.major == null) continue;
      // Filter self by uid.
      if (entry.profile.uid === s.uid) continue;
      const list = byMajor.get(entry.major) ?? [];
      list.push(entry.profile);
      byMajor.set(entry.major, list);
    }

    for (const [major, profiles] of byMajor) {
      // Reserve dedup slot before invoking the listener.
      s.lastEmitted.set(major, now);
      const rssi = batch.get(major) ?? null;
      // Emit one detection per matched profile under this major.
      for (const profile of profiles) {
        try {
          s.listener({
            uid: profile.uid,
            major,
            rssi,
            source: "ble",
            profile,
            observedAt: now,
          });
        } catch (err) {
          console.warn("[ble] listener threw", err);
        }
      }
    }
    // Majors that didn't match a profile (server miss): they're
    // strangers without a Met account, OR a race against onboarding.
    // Don't lock them via lastEmitted — leaving them out lets the next
    // tick re-resolve. We still rely on inFlightMajors being cleared
    // in `finally` to allow them to re-enter the queue.
  } finally {
    const live = liveStateFor(gen);
    if (live) {
      for (const m of batch.keys()) live.inFlightMajors.delete(m);
      live.resolveInFlight = false;
    }
  }
}
