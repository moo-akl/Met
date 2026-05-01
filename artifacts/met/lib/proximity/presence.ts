// GPS-based proximity service.
//
// Two loops run concurrently while a user is signed in and has granted
// foreground location permission:
//
//   pushLoop  — every PUSH_INTERVAL_MS, write our coords to /api/presence
//   pullLoop  — every PULL_INTERVAL_MS, query /api/presence/nearby and
//               for every new nearby uid: fetch profile + log encounter
//               + emit a detection event.
//
// The service is a singleton. start()/stop() are idempotent. We never
// crash the app on transient network or permission errors — they are
// logged and the loop continues.
//
// Background tracking is intentionally not supported in v1.0.
//
// ---- Race-safety ----
//
// Every running session carries a `generation` number. Any async path
// (permission check, fetch, etc.) re-validates against the *current*
// `state.generation` after each await; if generations diverge, the path
// bails without touching shared state. This protects against the
// classic "rapid uid/permission change → stale start clobbers fresh
// start" sequence that React effects naturally produce on mount.
//
// The pull loop also uses an in-flight guard to prevent overlapping
// runs (which would double-emit on slow networks), and seeds
// `lastEmitted` *before* the per-uid await chain so concurrent
// detections can't both pass the dedup check.

import * as Location from "expo-location";
import { api, type NearbyEntry, type RemoteProfile } from "../api/client";

const PUSH_INTERVAL_MS = 60_000;
const PULL_INTERVAL_MS = 30_000;
const NEARBY_RADIUS_M = 200;
const NEARBY_MAX_AGE_MIN = 15;

export interface ProximityDetection {
  uid: string;
  distanceM: number;
  source: "gps";
  profile: RemoteProfile;
  observedAt: number;
}

export type ProximityListener = (event: ProximityDetection) => void;

interface ServiceState {
  generation: number;
  uid: string;
  pushTimer: ReturnType<typeof setInterval> | null;
  pullTimer: ReturnType<typeof setInterval> | null;
  abort: AbortController;
  listener: ProximityListener;
  // Re-emit dedup window: at most one event per uid per FIRE_REEMIT_MS.
  // Seeded BEFORE the per-uid await chain in runPullOnce so concurrent
  // pulls can't both clear the check for the same uid.
  lastEmitted: Map<string, number>;
  // Prevent overlapping pulls when the network is slow enough that one
  // pull hasn't finished by the time the next interval tick fires.
  pullInFlight: boolean;
}

const FIRE_REEMIT_MS = 10 * 60_000;

let state: ServiceState | null = null;
let nextGeneration = 1;

export interface StartProximityOptions {
  uid: string;
  listener: ProximityListener;
}

export async function startProximity(
  opts: StartProximityOptions,
): Promise<{ started: boolean; reason?: string }> {
  if (state) {
    if (state.uid === opts.uid) {
      // Already running for the same user — just refresh the listener.
      state.listener = opts.listener;
      return { started: true };
    }
    stopProximity();
  }

  if (!api.isConfigured()) {
    return { started: false, reason: "API not configured" };
  }

  // Reserve a generation NOW so the upcoming permission await can be
  // validated against it. If start() is called again before the await
  // resolves, the second call bumps `nextGeneration` and the first
  // call's post-await check will fail — preventing the stale start.
  const generation = nextGeneration++;

  const perm = await Location.getForegroundPermissionsAsync();
  if (perm.status !== "granted") {
    return { started: false, reason: "Location permission not granted" };
  }
  // Caller may have called stopProximity() or startProximity() again
  // while we awaited the permission check. If so, abandon this start —
  // the newer call (or the lack of one) is authoritative.
  if (state !== null || generation + 1 !== nextGeneration) {
    return { started: false, reason: "Superseded by newer start/stop" };
  }

  const abort = new AbortController();
  state = {
    generation,
    uid: opts.uid,
    pushTimer: null,
    pullTimer: null,
    abort,
    listener: opts.listener,
    lastEmitted: new Map(),
    pullInFlight: false,
  };

  // Kick both loops immediately, then on intervals.
  void runPushOnce(generation);
  void runPullOnce(generation);
  state.pushTimer = setInterval(() => runPushOnce(generation), PUSH_INTERVAL_MS);
  state.pullTimer = setInterval(() => runPullOnce(generation), PULL_INTERVAL_MS);

  return { started: true };
}

export function stopProximity(): void {
  if (!state) return;
  if (state.pushTimer) clearInterval(state.pushTimer);
  if (state.pullTimer) clearInterval(state.pullTimer);
  state.abort.abort();
  state = null;
}

export function isProximityRunning(): boolean {
  return state !== null;
}

// Returns the live state if it's still owned by `gen`, otherwise null.
// Every async hop in the loops should re-check this before mutating
// state or invoking the listener.
function liveStateFor(gen: number): ServiceState | null {
  if (!state || state.generation !== gen) return null;
  return state;
}

async function getCurrentPosition(): Promise<Location.LocationObject | null> {
  try {
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
  } catch (err) {
    console.warn("[proximity] getCurrentPositionAsync failed", err);
    return null;
  }
}

async function runPushOnce(gen: number): Promise<void> {
  let s = liveStateFor(gen);
  if (!s) return;
  const pos = await getCurrentPosition();
  s = liveStateFor(gen);
  if (!s || !pos) return;
  try {
    await api.updatePresence(
      { uid: s.uid, signal: s.abort.signal },
      {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyM: pos.coords.accuracy ?? null,
      },
    );
  } catch (err) {
    if ((err as { name?: string }).name !== "AbortError") {
      console.warn("[proximity] updatePresence failed", err);
    }
  }
}

async function runPullOnce(gen: number): Promise<void> {
  let s = liveStateFor(gen);
  if (!s) return;
  // Skip if a previous pull is still chewing through the network.
  if (s.pullInFlight) return;
  s.pullInFlight = true;
  try {
    const pos = await getCurrentPosition();
    s = liveStateFor(gen);
    if (!s || !pos) return;

    let nearby: NearbyEntry[];
    try {
      nearby = await api.nearbyPresence(
        { uid: s.uid, signal: s.abort.signal },
        {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          radiusM: NEARBY_RADIUS_M,
          maxAgeMin: NEARBY_MAX_AGE_MIN,
        },
      );
    } catch (err) {
      if ((err as { name?: string }).name !== "AbortError") {
        console.warn("[proximity] nearbyPresence failed", err);
      }
      return;
    }

    s = liveStateFor(gen);
    if (!s) return;

    const now = Date.now();
    for (const entry of nearby) {
      if (entry.uid === s.uid) continue;
      const lastEmit = s.lastEmitted.get(entry.uid) ?? 0;
      if (now - lastEmit < FIRE_REEMIT_MS) continue;

      // Reserve the dedup slot BEFORE awaiting the profile/log calls so
      // a parallel run (or rapid second tick) can't slip through.
      s.lastEmitted.set(entry.uid, now);

      let profile: RemoteProfile;
      try {
        profile = await api.getProfile(
          { uid: s.uid, signal: s.abort.signal },
          entry.uid,
        );
      } catch (err) {
        // 404 = no profile uploaded yet; we silently skip and try again
        // on the next poll (the other user might still be onboarding).
        // Roll back the dedup slot so we'll retry next tick.
        const live = liveStateFor(gen);
        if (live) live.lastEmitted.delete(entry.uid);
        if ((err as { name?: string }).name !== "AbortError") {
          console.warn("[proximity] getProfile failed for", entry.uid, err);
        }
        continue;
      }

      // Re-check liveness after each await — generation may have changed.
      const live = liveStateFor(gen);
      if (!live) return;

      try {
        await api.logEncounter(
          { uid: live.uid, signal: live.abort.signal },
          { observedUid: entry.uid },
        );
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          console.warn("[proximity] logEncounter failed", err);
        }
      }

      const stillLive = liveStateFor(gen);
      if (!stillLive) return;
      try {
        stillLive.listener({
          uid: entry.uid,
          distanceM: entry.distanceM,
          source: "gps",
          profile,
          observedAt: now,
        });
      } catch (err) {
        console.warn("[proximity] listener threw", err);
      }
    }
  } finally {
    const live = liveStateFor(gen);
    if (live) live.pullInFlight = false;
  }
}
