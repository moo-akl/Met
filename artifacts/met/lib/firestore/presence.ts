// Firestore-backed proximity service.
//
// Replaces the api-server-backed `lib/proximity/presence.ts` for the
// nearby-discovery half of the pipeline. Same external shape — start /
// stop / listener emits `ProximityDetection` — so callers (AppContext)
// don't change.
//
// Loop:
//   pushLoop  — every 30m of GPS movement (or PUSH_INTERVAL_MS, whichever
//               comes first), write our coords + geohash to users/{uid}.
//   pullLoop  — every PULL_INTERVAL_MS, query users with geohash inside
//               the 50m bounds for our location, filter visible+nonself,
//               apply 2h cooldown via AsyncStorage, then call
//               api.recordEncounter (server batch-writes both sides) and
//               emit a detection event.
//
// Race-safety mirrors the original module: per-session generation
// number, in-flight pull guard, dedup-window seeded BEFORE await.
//
// Background tracking is intentionally not supported. The first GPS
// fix happens in the foreground and the loops stop when the app is
// backgrounded.

import * as Location from "expo-location";
import {
  distanceBetween,
  geohashForLocation,
  geohashQueryBounds,
} from "geofire-common";

import { api, type RemoteProfile } from "../api/client";
import { getFirestoreModule, getFirestoreSdk } from "./client";
import { isInCooldown, markCooldown } from "./cooldown";
import { isExplicitlyVisible } from "../discoveryVisibility";

const PUSH_INTERVAL_MS = 60_000;
const PULL_INTERVAL_MS = 30_000;
const NEARBY_RADIUS_M = 50;
const NEARBY_RADIUS_KM = NEARBY_RADIUS_M / 1000;
const MOVEMENT_DISTANCE_M = 30;
const FIRE_REEMIT_MS = 10 * 60_000;

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
  // Re-emit dedup window: at most one event per uid per FIRE_REEMIT_MS,
  // independent of the persistent cooldown (which gates server writes,
  // not in-app emissions).
  lastEmitted: Map<string, number>;
  pullInFlight: boolean;
  pushInFlight: boolean;
  // Last position we successfully pushed. Used to suppress writes when
  // the device hasn't moved beyond MOVEMENT_DISTANCE_M (saves Firestore
  // writes and respects the user's battery).
  lastPushed: { lat: number; lng: number } | null;
}

let state: ServiceState | null = null;
let nextGeneration = 1;

export interface StartProximityOptions {
  uid: string;
  listener: ProximityListener;
  isVisible: boolean;
}

export async function startFirestoreProximity(
  opts: StartProximityOptions,
): Promise<{ started: boolean; reason?: string }> {
  if (!opts.isVisible) {
    stopFirestoreProximity(opts.uid);
    void suppressFirestorePresence(opts.uid).catch((err) => {
      console.warn(
        "[firestore-proximity] hidden presence suppression failed",
        err,
      );
    });
    return { started: false, reason: "User is hidden" };
  }

  if (state) {
    if (state.uid === opts.uid) {
      state.listener = opts.listener;
      return { started: true };
    }
    stopFirestoreProximity();
  }

  if (!api.isConfigured()) {
    return { started: false, reason: "API not configured" };
  }

  // Reserve a generation before the first async bridge lookup. stop() must
  // be able to invalidate a start even if Firebase is still initializing.
  const generation = nextGeneration++;

  // Make sure Firestore is reachable before we spin up the timers.
  // Web / Expo Go falls back to a noop here so the caller can decide
  // whether to keep using the legacy GPS-presence module.
  const fs = await getFirestoreModule();
  if (!fs) {
    return { started: false, reason: "Firestore native module unavailable" };
  }
  if (state !== null || generation + 1 !== nextGeneration) {
    return { started: false, reason: "Superseded by newer start/stop" };
  }

  const perm = await Location.getForegroundPermissionsAsync();
  if (perm.status !== "granted") {
    return { started: false, reason: "Location permission not granted" };
  }
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
    pushInFlight: false,
    lastPushed: null,
  };

  void runPushOnce(generation);
  void runPullOnce(generation);
  state.pushTimer = setInterval(
    () => runPushOnce(generation),
    PUSH_INTERVAL_MS,
  );
  state.pullTimer = setInterval(
    () => runPullOnce(generation),
    PULL_INTERVAL_MS,
  );

  return { started: true };
}

export function stopFirestoreProximity(uid?: string | null): void {
  // Invalidate starts that are still waiting for permissions, and prevent
  // an in-flight location lookup from starting a new Firestore write.
  nextGeneration += 1;
  const stopped = state;
  if (stopped) {
    if (stopped.pushTimer) clearInterval(stopped.pushTimer);
    if (stopped.pullTimer) clearInterval(stopped.pullTimer);
    stopped.abort.abort();
  }
  state = null;
  const stoppedUid = stopped?.uid ?? uid ?? undefined;
  if (stoppedUid) {
    // A stopped foreground location service must not leave an old geohash
    // available to a later discovery query. Do not delete the user doc:
    // it also carries profile/visibility data and existing connections.
    void clearFirestoreLocation(stoppedUid, true).catch((err) => {
      console.warn("[firestore-proximity] stale location cleanup failed", err);
    });
  }
}

export function isFirestoreProximityRunning(): boolean {
  return state !== null;
}

/**
 * Hide the user's Firestore presence immediately, including a location
 * left behind by a previous app session. This is a field update, not a
 * document delete, so profile and connection data remain intact.
 */
export async function suppressFirestorePresence(uid: string): Promise<boolean> {
  const fs = await getFirestoreModule();
  if (!fs) return false;
  const firestore = await getFirestoreSdk();
  await fs.collection("users").doc(uid).set(
    {
      uid,
      isVisible: false,
      location: firestore.default.FieldValue.delete(),
      geohash: firestore.default.FieldValue.delete(),
    },
    { merge: true },
  );
  return true;
}

/**
 * Remove only the short-lived location fields. Visibility and all
 * intentional profile/chat/connection data are preserved.
 */
export async function clearFirestoreLocation(
  uid: string,
  onlyIfStopped = false,
): Promise<boolean> {
  if (onlyIfStopped && state?.uid === uid) return false;
  const fs = await getFirestoreModule();
  if (!fs || (onlyIfStopped && state?.uid === uid)) return false;
  const firestore = await getFirestoreSdk();
  if (onlyIfStopped && state?.uid === uid) return false;
  await fs.collection("users").doc(uid).update({
    location: firestore.default.FieldValue.delete(),
    geohash: firestore.default.FieldValue.delete(),
  });
  if (onlyIfStopped && state?.uid === uid) {
    // A newer foreground session may have started while this cleanup write
    // was in flight. Re-publish a fresh fix rather than leaving its document
    // without a location or a pre-cleanup fix as the newest value.
    state.lastPushed = null;
    if (!state.pushInFlight) void runPushOnce(state.generation);
  }
  return true;
}

function liveStateFor(gen: number): ServiceState | null {
  if (!state || state.generation !== gen) return null;
  return state;
}

async function getCurrentPosition(): Promise<Location.LocationObject | null> {
  try {
    // High accuracy (~10m on modern phones) — Balanced is ~100m on
    // Android, which is too coarse for the 50m proximity radius.
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  } catch (err) {
    console.warn("[firestore-proximity] getCurrentPositionAsync failed", err);
    return null;
  }
}

function metresBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  // distanceBetween returns kilometres.
  return distanceBetween([a.lat, a.lng], [b.lat, b.lng]) * 1000;
}

async function runPushOnce(gen: number): Promise<void> {
  let s = liveStateFor(gen);
  if (!s) return;
  if (s.pushInFlight) return;
  s.pushInFlight = true;
  try {
    const pos = await getCurrentPosition();
    s = liveStateFor(gen);
    if (!s || !pos) return;

    const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    if (
      s.lastPushed &&
      metresBetween(s.lastPushed, here) < MOVEMENT_DISTANCE_M
    ) {
      // Device hasn't moved enough to bother with a write — saves on
      // Firestore quota AND avoids stamping a fresh `lastActive` for a
      // stationary user, which would falsely show them as "active now".
      return;
    }

    const fs = await getFirestoreModule();
    s = liveStateFor(gen);
    if (!s || !fs) return;
    const geohash = geohashForLocation([here.lat, here.lng]);
    try {
      const fsMod = await getFirestoreSdk();
      // Firebase module initialization is async; stop may have been called
      // while it was loading. Revalidate before beginning the location write.
      s = liveStateFor(gen);
      if (!s) return;
      await fs
        .collection("users")
        .doc(s.uid)
        .set(
          {
            location: new fsMod.default.GeoPoint(here.lat, here.lng),
            geohash,
            lastActive: fsMod.default.FieldValue.serverTimestamp(),
            uid: s.uid,
          },
          { merge: true },
        );
      const live = liveStateFor(gen);
      if (live) {
        live.lastPushed = here;
      } else if (state?.uid === s.uid) {
        // A new visible session for the same uid may have started while the
        // old write was in flight. Keep its next push eligible so it replaces
        // any older fix that committed last.
        state.lastPushed = null;
      } else {
        // A stop may race with the Firestore write itself. Re-clear after
        // that write settles so stale coordinates cannot be the last write.
        await clearFirestoreLocation(s.uid).catch((err) => {
          console.warn(
            "[firestore-proximity] stale location cleanup failed",
            err,
          );
        });
      }
    } catch (err) {
      console.warn("[firestore-proximity] presence push failed", err);
    }
  } finally {
    const live = liveStateFor(gen);
    if (live) live.pushInFlight = false;
  }
}

async function runPullOnce(gen: number): Promise<void> {
  let s = liveStateFor(gen);
  if (!s) return;
  if (s.pullInFlight) return;
  s.pullInFlight = true;
  try {
    const pos = await getCurrentPosition();
    s = liveStateFor(gen);
    if (!s || !pos) return;

    const center: [number, number] = [
      pos.coords.latitude,
      pos.coords.longitude,
    ];

    const fs = await getFirestoreModule();
    s = liveStateFor(gen);
    if (!s || !fs) return;

    // geohashQueryBounds returns one or more [start, end] pairs; we
    // dispatch each pair as its own range query (Firestore can't OR
    // ranges in a single query) and merge the results.
    const bounds = geohashQueryBounds(center, NEARBY_RADIUS_M);

    const candidates = new Map<
      string,
      { uid: string; lat: number; lng: number; isVisible: boolean }
    >();
    for (const b of bounds) {
      try {
        const snap = await fs
          .collection("users")
          .orderBy("geohash")
          .startAt(b[0])
          .endAt(b[1])
          .get();
        s = liveStateFor(gen);
        if (!s) return;
        snap.forEach((doc) => {
          const data = doc.data() as Record<string, unknown>;
          const loc = data["location"] as
            | { latitude?: number; longitude?: number }
            | undefined;
          if (
            !loc ||
            typeof loc.latitude !== "number" ||
            typeof loc.longitude !== "number"
          ) {
            return;
          }
          const otherUid =
            typeof data["uid"] === "string" ? (data["uid"] as string) : doc.id;
          if (otherUid === s!.uid) return;
          // Server rules already enforce `isVisible == true` for reads
          // by other users, but we re-check defensively in case the
          // doc was readable for a different reason.
          const isVisible = isExplicitlyVisible(data["isVisible"]);
          if (!isVisible) return;
          candidates.set(otherUid, {
            uid: otherUid,
            lat: loc.latitude,
            lng: loc.longitude,
            isVisible,
          });
        });
      } catch (err) {
        console.warn("[firestore-proximity] bounds query failed", err);
      }
    }

    s = liveStateFor(gen);
    if (!s) return;
    const now = Date.now();

    for (const c of candidates.values()) {
      // Geohash bounds are a coarse filter — re-test the actual great-
      // circle distance and drop everything outside the true radius.
      const distKm = distanceBetween(center, [c.lat, c.lng]);
      if (distKm > NEARBY_RADIUS_KM) continue;
      const distanceM = distKm * 1000;

      // In-app dedup window — even if the persistent cooldown has
      // expired we don't want the listener firing twice for the same
      // person within 10 minutes.
      const lastEmit = s.lastEmitted.get(c.uid) ?? 0;
      if (now - lastEmit < FIRE_REEMIT_MS) continue;
      s.lastEmitted.set(c.uid, now);

      // Resolve the canonical profile before recording an encounter. The
      // Firestore query is only a visibility snapshot and can race with a
      // peer hiding themselves.
      let profile: RemoteProfile;
      try {
        profile = await api.getProfile(
          { uid: s.uid, signal: s.abort.signal },
          c.uid,
        );
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          console.warn(
            "[firestore-proximity] getProfile failed for",
            c.uid,
            err,
          );
        }
        // Roll back the in-app dedup slot so we'll retry next pull.
        const r = liveStateFor(gen);
        if (r) r.lastEmitted.delete(c.uid);
        continue;
      }

      const stillLive = liveStateFor(gen);
      if (!stillLive) return;
      if (!isExplicitlyVisible(profile.isVisible)) {
        stillLive.lastEmitted.delete(c.uid);
        continue;
      }

      // Persistent 2h cooldown — gates the server-side encounter write
      // (and therefore the bilateral met_people doc creation) but NOT
      // the listener emission, since a returning encounter is still
      // useful to surface in the UI.
      const cooled = await isInCooldown(stillLive.uid, c.uid);
      const current = liveStateFor(gen);
      if (!current) return;

      if (!cooled) {
        // Stamp the cooldown BEFORE the API call so a concurrent pull
        // (or a parallel BLE detection in AppContext) can't read
        // "not cooled" while our request is still in flight and fire
        // a duplicate write.
        await markCooldown(current.uid, c.uid);
        try {
          await api.recordEncounter(
            { uid: current.uid, signal: current.abort.signal },
            {
              otherUid: c.uid,
              location: { lat: c.lat, lng: c.lng },
            },
          );
        } catch (err) {
          if ((err as { name?: string }).name !== "AbortError") {
            console.warn(
              "[firestore-proximity] recordEncounter failed",
              c.uid,
              err,
            );
          }
        }
      }

      const liveAfterRecord = liveStateFor(gen);
      if (!liveAfterRecord) return;
      try {
        liveAfterRecord.listener({
          uid: c.uid,
          distanceM,
          source: "gps",
          profile,
          observedAt: now,
        });
      } catch (err) {
        console.warn("[firestore-proximity] listener threw", err);
      }
    }
  } finally {
    const live = liveStateFor(gen);
    if (live) live.pullInFlight = false;
  }
}
