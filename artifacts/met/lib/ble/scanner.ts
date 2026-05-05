// BLE scanner singleton.
//
// Owns one `BleManager` instance. Filters scans on the Met service
// UUID, extracts identity hashes from each advertisement, dedupes for
// a re-emit window, batch-resolves hashes → profiles via the backend,
// and forwards every match as a `ProximityDetection` to the listener.
//
// Race-safety mirrors `lib/proximity/presence.ts`: a per-session
// generation token tags every async hop so a stale start can't clobber
// a fresh one. Every callback re-checks `liveStateFor(gen)` before
// touching shared state.
//
// Behavior in Expo Go: `loadPlx()` returns null and `start()` resolves
// `{started:false, reason:"BLE native module unavailable"}` without
// throwing. Same fallback for web.

import { api, type RemoteProfile } from "../api/client";
import { extractHash } from "./encode";
import { loadPlx, type PlxManager } from "./plx";
import { MET_SERVICE_UUID } from "./uuids";
import {
  recordScannerStart,
  recordResolveAttempt,
  recordResolveResult,
} from "./debug";

const RESOLVE_BATCH_INTERVAL_MS = 4_000;
const RESOLVE_BATCH_MAX = 32;
const FIRE_REEMIT_MS = 10 * 60_000;

export interface BleDetection {
  uid: string;
  hash: string;
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
  manager: PlxManager;
  listener: BleListener;
  // hash → most-recent rssi seen during the current batch window.
  pendingHashes: Map<string, number | null>;
  // hash → last time we successfully emitted; subject to FIRE_REEMIT_MS.
  lastEmitted: Map<string, number>;
  // Hashes currently being resolved by the backend. The scan callback
  // treats these like "recently emitted" — incoming duplicates while
  // the request is in flight are dropped instead of re-queued. This
  // prevents the same hash from being emitted twice when the resolve
  // completes (legit fire) AND on the very next tick (re-queued during
  // the await). Cleared in `finally`, regardless of success/failure.
  inFlightHashes: Set<string>;
  resolveTimer: ReturnType<typeof setInterval> | null;
  resolveInFlight: boolean;
  stateSub: { remove: () => void } | null;
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
  const result = await _startBleScannerImpl(opts);
  recordScannerStart(result.started, result.reason ?? null);
  return result;
}

async function _startBleScannerImpl(
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

  const plx = loadPlx();
  if (!plx) {
    return { started: false, reason: "BLE native module unavailable" };
  }

  const generation = nextGeneration++;
  let manager: PlxManager;
  try {
    // restoreStateIdentifier lets iOS resurrect the central manager
    // when the app is relaunched in the background after termination.
    // Combined with the `bluetooth-central` UIBackgroundMode, our
    // service-UUID-filtered scan keeps delivering peripherals while
    // the app is suspended. Android handles background scanning via
    // the foreground service started by the native MetBleModule, so
    // the identifier is harmless cross-platform.
    manager = new plx.BleManager({
      restoreStateIdentifier: "MetBleCentralRestore",
    });
  } catch (err) {
    console.warn("[ble] failed to construct BleManager", err);
    return { started: false, reason: "BleManager construction failed" };
  }

  // Wait for the radio to be powered on before scanning. iOS will
  // prompt the user the first time the BleManager is constructed.
  const ready = await waitForPoweredOn(manager, plx).catch((err): boolean => {
    console.warn("[ble] state probe failed", err);
    return false;
  });

  if (generation + 1 !== nextGeneration || state !== null) {
    // Superseded — newer start/stop won the race.
    try { manager.destroy(); } catch { /* noop */ }
    return { started: false, reason: "Superseded by newer start/stop" };
  }

  if (!ready) {
    try { manager.destroy(); } catch { /* noop */ }
    return { started: false, reason: "Bluetooth not powered on" };
  }

  const next: ScannerState = {
    generation,
    uid: opts.uid,
    manager,
    listener: opts.listener,
    pendingHashes: new Map(),
    lastEmitted: new Map(),
    inFlightHashes: new Set(),
    resolveTimer: null,
    resolveInFlight: false,
    stateSub: null,
  };
  state = next;

  // Track radio state changes so we can pause/resume the scan.
  next.stateSub = manager.onStateChange((newState) => {
    const live = liveStateFor(generation);
    if (!live) return;
    if (newState === plx.State.PoweredOn) {
      restartScan(generation);
    } else {
      try { live.manager.stopDeviceScan(); } catch { /* noop */ }
    }
  }, false);

  restartScan(generation);
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
  if (s.stateSub) {
    try { s.stateSub.remove(); } catch { /* noop */ }
  }
  try { s.manager.stopDeviceScan(); } catch { /* noop */ }
  try { s.manager.destroy(); } catch { /* noop */ }
}

export function isBleScannerRunning(): boolean {
  return state !== null;
}

async function waitForPoweredOn(
  manager: PlxManager,
  plx: ReturnType<typeof loadPlx>,
): Promise<boolean> {
  if (!plx) return false;
  const initial = await manager.state();
  if (initial === plx.State.PoweredOn) return true;
  // Wait up to 4s for the radio to come up. On iOS the first
  // construction triggers the system prompt which can take a moment.
  return await new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      sub.remove();
      resolve(false);
    }, 4_000);
    const sub = manager.onStateChange((s) => {
      if (s === plx.State.PoweredOn) {
        clearTimeout(timeout);
        sub.remove();
        resolve(true);
      } else if (
        s === plx.State.Unauthorized ||
        s === plx.State.Unsupported
      ) {
        clearTimeout(timeout);
        sub.remove();
        resolve(false);
      }
    }, true);
  });
}

function restartScan(gen: number): void {
  const s = liveStateFor(gen);
  if (!s) return;
  try { s.manager.stopDeviceScan(); } catch { /* noop */ }
  s.manager.startDeviceScan(
    [MET_SERVICE_UUID],
    { allowDuplicates: true },
    (err, device) => {
      const live = liveStateFor(gen);
      if (!live) return;
      if (err) {
        console.warn("[ble] scan error", err.message);
        return;
      }
      if (!device) return;
      const hash = extractHash({
        serviceData: device.serviceData,
        serviceDataKeys: [MET_SERVICE_UUID, MET_SERVICE_UUID.toUpperCase()],
        localName: device.localName ?? device.name,
      });
      if (!hash) return;
      const now = Date.now();
      // Skip if we emitted recently OR a resolve for this hash is in
      // flight (which will emit shortly). The in-flight check is what
      // prevents the dedup race during the resolve await window.
      const lastEmit = live.lastEmitted.get(hash) ?? 0;
      if (now - lastEmit < FIRE_REEMIT_MS) return;
      if (live.inFlightHashes.has(hash)) return;
      // Capture the strongest (least-negative) RSSI seen this batch.
      const prev = live.pendingHashes.get(hash) ?? null;
      const rssi = device.rssi;
      if (rssi != null && (prev == null || rssi > prev)) {
        live.pendingHashes.set(hash, rssi);
      } else if (!live.pendingHashes.has(hash)) {
        live.pendingHashes.set(hash, rssi);
      }
    },
  );
}

async function runResolveOnce(gen: number): Promise<void> {
  let s = liveStateFor(gen);
  if (!s) return;
  if (s.resolveInFlight) return;
  if (s.pendingHashes.size === 0) return;

  // Drain the pending batch, but only take RESOLVE_BATCH_MAX hashes
  // per tick. The remainder stays in `pendingHashes` so the next tick
  // (or a future scan callback that sees a higher RSSI) picks them up.
  const allEntries = [...s.pendingHashes.entries()];
  const taken = allEntries.slice(0, RESOLVE_BATCH_MAX);
  const overflow = allEntries.slice(RESOLVE_BATCH_MAX);
  const batch = new Map<string, number | null>(taken);

  s.pendingHashes.clear();
  // Requeue overflow immediately so we don't drop signals.
  for (const [h, r] of overflow) s.pendingHashes.set(h, r);

  // Mark this batch as in-flight so the scan callback drops dupes
  // until either the resolve completes (at which point we set
  // lastEmitted) or it fails (at which point we re-queue them).
  for (const h of batch.keys()) s.inFlightHashes.add(h);
  s.resolveInFlight = true;
  const hashes = [...batch.keys()];
  recordResolveAttempt();

  try {
    let entries: { hash: string; profile: RemoteProfile }[] = [];
    try {
      entries = await api.bleResolve({ uid: s.uid }, hashes);
    } catch (err) {
      // Re-queue hashes for the next tick — they may resolve later.
      const live = liveStateFor(gen);
      if (live) {
        for (const [h, r] of batch) {
          if (!live.pendingHashes.has(h)) live.pendingHashes.set(h, r);
        }
      }
      const errMsg = (err as Error)?.message ?? String(err);
      console.warn("[ble] resolve failed", errMsg);
      recordResolveResult({ ok: false, error: errMsg });
      return;
    }

    s = liveStateFor(gen);
    if (!s) {
      recordResolveResult({ ok: true, entries: entries.length, matched: 0 });
      return;
    }

    const now = Date.now();
    const matched = new Set<string>();
    for (const entry of entries) {
      // Filter self by uid — our own broadcast can echo back to us via
      // BLE on Android, and the server would happily resolve it.
      if (entry.profile.uid === s.uid) continue;
      matched.add(entry.hash);
      // Reserve dedup slot before invoking the listener so concurrent
      // resolves can't double-emit.
      s.lastEmitted.set(entry.hash, now);
      const rssi = batch.get(entry.hash) ?? null;
      try {
        s.listener({
          uid: entry.profile.uid,
          hash: entry.hash,
          rssi,
          source: "ble",
          profile: entry.profile,
          observedAt: now,
        });
      } catch (err) {
        console.warn("[ble] listener threw", err);
      }
    }
    // Hashes that didn't match a profile (server miss): they're
    // strangers without a Met account, OR a race against onboarding.
    // Don't lock them via lastEmitted — leaving them out lets the next
    // tick re-resolve. We still rely on inFlightHashes being cleared
    // in `finally` to allow them to re-enter the queue.
    recordResolveResult({
      ok: true,
      entries: entries.length,
      matched: matched.size,
    });
    void matched;
  } finally {
    const live = liveStateFor(gen);
    if (live) {
      for (const h of batch.keys()) live.inFlightHashes.delete(h);
      live.resolveInFlight = false;
    }
  }
}
