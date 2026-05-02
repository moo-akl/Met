// Live, on-device BLE pipeline introspection.
//
// Why this exists
// ---------------
// TestFlight + APK installs have no console. When the iBeacon pipeline
// silently produces zero detections in the field there is no way to
// distinguish "native module not linked", "ranger denied", "advertiser
// failed", "ranged but server rejected" from each other without
// shipping a debug build. This singleton records the few facts we
// actually need to triage:
//
//   - Whether the native module loaded
//   - Whether the scanner / advertiser actually started (and reason if not)
//   - Our own iBeacon major
//   - Raw ranged-beacon counts and a small sample of majors observed
//   - Resolve attempt count + last result/error
//
// The Settings → Diagnostics view renders a small read-only card
// driven by this snapshot. Users screenshot it, we read it, we know
// exactly which layer is failing.
//
// Notes
// -----
// Session-scoped, no persistence. The snapshot reference changes on
// every mutation so `useSyncExternalStore` notices. Every recorder is
// safe to call from any context — they never throw and never block.

export interface BleDebugSnapshot {
  /** "linked" once requireNativeModule succeeded; "missing" if it returned null/threw; "unknown" before init. */
  nativeModule: "linked" | "missing" | "unknown";
  /** Reason the native module wasn't loaded, when known. */
  nativeModuleReason: string | null;

  /** uid currently driving the BLE session. */
  ourUid: string | null;
  /** iBeacon major derived from `ourUid`. */
  ourMajor: number | null;

  /** Last scanner start outcome. null until a start has been attempted. */
  scannerStarted: boolean | null;
  scannerReason: string | null;
  scannerStartedAt: number | null;

  /** Last advertiser start outcome. */
  advertiserStarted: boolean | null;
  advertiserReason: string | null;
  advertiserStartedAt: number | null;

  /** Total native onBeaconRanged events observed (any beacons[].length). */
  rangedEventCount: number;
  /** Sum of beacons[].length across all events. */
  rangedBeaconCount: number;
  /** Wall-clock timestamp of the most recent ranged event. */
  rangedBeaconLastAt: number | null;
  /** Up to 8 most-recent unique majors observed (FIFO). */
  rangedSampleMajors: number[];

  /**
   * Why ranged beacons were skipped before being queued for resolve.
   * Lets us diagnose `rangedEventCount > 0 && resolveAttemptCount === 0`
   * in one screenshot.
   */
  droppedInvalidMajor: number;
  droppedMinorMismatch: number;
  droppedCooldown: number;
  droppedInFlight: number;
  /** Resolved entry that turned out to be self (uid match). */
  droppedSelf: number;

  /** Number of /api/ble/resolve attempts kicked off. */
  resolveAttemptCount: number;
  /** Successful resolve responses. */
  resolveSuccessCount: number;
  /** Failed resolves (network or server error). */
  resolveFailureCount: number;
  /** Wall-clock timestamp of the last resolve attempt. */
  resolveLastAt: number | null;
  /** Short, human-readable summary of the last resolve outcome. */
  resolveLastResult: string | null;
  /** Last resolve error message, if any. */
  resolveLastError: string | null;
}

const SAMPLE_MAJORS_MAX = 8;

const state: BleDebugSnapshot = {
  nativeModule: "unknown",
  nativeModuleReason: null,
  ourUid: null,
  ourMajor: null,
  scannerStarted: null,
  scannerReason: null,
  scannerStartedAt: null,
  advertiserStarted: null,
  advertiserReason: null,
  advertiserStartedAt: null,
  rangedEventCount: 0,
  rangedBeaconCount: 0,
  rangedBeaconLastAt: null,
  rangedSampleMajors: [],
  droppedInvalidMajor: 0,
  droppedMinorMismatch: 0,
  droppedCooldown: 0,
  droppedInFlight: 0,
  droppedSelf: 0,
  resolveAttemptCount: 0,
  resolveSuccessCount: 0,
  resolveFailureCount: 0,
  resolveLastAt: null,
  resolveLastResult: null,
  resolveLastError: null,
};

let snapshot: BleDebugSnapshot = { ...state, rangedSampleMajors: [] };
const listeners = new Set<() => void>();

function bump(): void {
  // New top-level identity AND fresh array references for any nested
  // collections so useSyncExternalStore's referential check fires.
  snapshot = {
    ...state,
    rangedSampleMajors: state.rangedSampleMajors.slice(),
  };
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* listener failures must not break recording */
    }
  });
}

export function recordNativeModule(
  loaded: boolean,
  reason?: string | null,
): void {
  try {
    state.nativeModule = loaded ? "linked" : "missing";
    state.nativeModuleReason = reason ?? null;
    bump();
  } catch {
    /* noop */
  }
}

export function recordSelf(uid: string | null, major: number | null): void {
  try {
    state.ourUid = uid;
    state.ourMajor = major;
    bump();
  } catch {
    /* noop */
  }
}

export function recordScannerStart(
  started: boolean,
  reason?: string | null,
): void {
  try {
    state.scannerStarted = started;
    state.scannerReason = reason ?? null;
    state.scannerStartedAt = Date.now();
    bump();
  } catch {
    /* noop */
  }
}

export function recordAdvertiserStart(
  started: boolean,
  reason?: string | null,
): void {
  try {
    state.advertiserStarted = started;
    state.advertiserReason = reason ?? null;
    state.advertiserStartedAt = Date.now();
    bump();
  } catch {
    /* noop */
  }
}

export function recordRangedEvent(
  beaconCount: number,
  majors: ReadonlyArray<number>,
): void {
  try {
    state.rangedEventCount += 1;
    state.rangedBeaconCount += beaconCount;
    state.rangedBeaconLastAt = Date.now();
    if (majors.length > 0) {
      const next = state.rangedSampleMajors.slice();
      for (const m of majors) {
        if (typeof m !== "number" || !Number.isFinite(m)) continue;
        const idx = next.indexOf(m);
        if (idx >= 0) next.splice(idx, 1);
        next.push(m);
      }
      while (next.length > SAMPLE_MAJORS_MAX) next.shift();
      state.rangedSampleMajors = next;
    }
    bump();
  } catch {
    /* noop */
  }
}

export type DropReason =
  | "invalidMajor"
  | "minorMismatch"
  | "cooldown"
  | "inFlight"
  | "self";

export function recordDrop(reason: DropReason, count = 1): void {
  try {
    if (count <= 0) return;
    switch (reason) {
      case "invalidMajor":
        state.droppedInvalidMajor += count;
        break;
      case "minorMismatch":
        state.droppedMinorMismatch += count;
        break;
      case "cooldown":
        state.droppedCooldown += count;
        break;
      case "inFlight":
        state.droppedInFlight += count;
        break;
      case "self":
        state.droppedSelf += count;
        break;
    }
    bump();
  } catch {
    /* noop */
  }
}

export function recordResolveAttempt(): void {
  try {
    state.resolveAttemptCount += 1;
    state.resolveLastAt = Date.now();
    bump();
  } catch {
    /* noop */
  }
}

export function recordResolveResult(
  result:
    | { ok: true; entries: number; matched: number }
    | { ok: false; error: string },
): void {
  try {
    state.resolveLastAt = Date.now();
    if (result.ok) {
      state.resolveSuccessCount += 1;
      state.resolveLastResult = `200 ok — ${result.entries} entr${result.entries === 1 ? "y" : "ies"} returned (${result.matched} matched)`;
      state.resolveLastError = null;
    } else {
      state.resolveFailureCount += 1;
      state.resolveLastResult = `failed`;
      state.resolveLastError = result.error.slice(0, 200);
    }
    bump();
  } catch {
    /* noop */
  }
}

export function getBleDebugSnapshot(): BleDebugSnapshot {
  return snapshot;
}

export function subscribeToBleDebug(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Render the snapshot as a compact, copy-friendly multi-line string. */
export function formatBleDebugSnapshot(s: BleDebugSnapshot): string {
  const fmtTs = (t: number | null) =>
    t == null ? "—" : new Date(t).toISOString().slice(11, 19) + " UTC";
  const fmtBool = (b: boolean | null) => (b == null ? "—" : b ? "yes" : "NO");
  return [
    `native module: ${s.nativeModule}${s.nativeModuleReason ? ` (${s.nativeModuleReason})` : ""}`,
    `our uid: ${s.ourUid ?? "—"}`,
    `our major: ${s.ourMajor ?? "—"}`,
    `scanner started: ${fmtBool(s.scannerStarted)}${s.scannerReason ? ` — ${s.scannerReason}` : ""}`,
    `  at: ${fmtTs(s.scannerStartedAt)}`,
    `advertiser started: ${fmtBool(s.advertiserStarted)}${s.advertiserReason ? ` — ${s.advertiserReason}` : ""}`,
    `  at: ${fmtTs(s.advertiserStartedAt)}`,
    `ranged events: ${s.rangedEventCount} (${s.rangedBeaconCount} beacons)`,
    `  last: ${fmtTs(s.rangedBeaconLastAt)}`,
    `  recent majors: [${s.rangedSampleMajors.join(", ")}]`,
    `drops: invalidMajor=${s.droppedInvalidMajor} minorMismatch=${s.droppedMinorMismatch} cooldown=${s.droppedCooldown} inFlight=${s.droppedInFlight} self=${s.droppedSelf}`,
    `resolve attempts: ${s.resolveAttemptCount} (ok=${s.resolveSuccessCount}, fail=${s.resolveFailureCount})`,
    `  last: ${fmtTs(s.resolveLastAt)} — ${s.resolveLastResult ?? "—"}`,
    s.resolveLastError ? `  err: ${s.resolveLastError}` : null,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}
