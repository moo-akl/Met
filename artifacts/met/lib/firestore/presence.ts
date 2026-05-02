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
import { getFirestoreModule } from "./client";
import { isInCooldown, markCooldown } from "./cooldown";

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
}

export async function startFirestoreProximity(
  opts: StartProximityOptions,
): Promise<{ started: boolean; reason?: string }> {
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

  // Make sure Firestore is reachable before we spin up the timers.
  // Web / Expo Go falls back to a noop here so the caller can decide
  // whether to keep using the legacy GPS-presence module.
  const fs = await getFirestoreModule();
  if (!fs) {
    return { started: false, reason: "Firestore native module unavailable" };
  }

  const generation = nextGeneration++;

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

export function stopFirestoreProximity(): void {
  if (!state) return;
  if (state.pushTimer) clearInterval(state.pushTimer);
  if (state.pullTimer) clearInterval(state.pullTimer);
  state.abort.abort();
  state = null;
}

export function isFirestoreProximityRunning(): boolean {
  return state !== null;
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
    if (!fs) return;
    const geohash = geohashForLocation([here.lat, here.lng]);
    try {
      const fsMod = await import("@react-native-firebase/firestore");
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
      if (live) live.lastPushed = here;
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
    if (!fs) return;

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
          const isVisible =
            typeof data["isVisible"] === "boolean"
              ? (data["isVisible"] as boolean)
              : true;
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

      // Persistent 2h cooldown — gates the server-side encounter write
      // (and therefore the bilateral met_people doc creation) but NOT
      // the listener emission, since a returning encounter is still
      // useful to surface in the UI.
      const cooled = await isInCooldown(s.uid, c.uid);
      const live = liveStateFor(gen);
      if (!live) return;

      let recorded = false;
      if (!cooled) {
        // Stamp the cooldown BEFORE the API call so a concurrent pull
        // (or a parallel BLE detection in AppContext) can't read
        // "not cooled" while our request is still in flight and fire
        // a duplicate write. We accept the trade-off: if recordEncounter
        // fails, the pair is locked out for 2h before we'd retry — but
        // that's still strictly better than risking a double-increment
        // of metCount on the server side.
        await markCooldown(live.uid, c.uid);
        try {
          await api.recordEncounter(
            { uid: live.uid, signal: live.abort.signal },
            {
              otherUid: c.uid,
              location: { lat: c.lat, lng: c.lng },
            },
          );
          recorded = true;
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

      // Pull the profile for the listener payload. We do this even
      // when the encounter was cooldown-suppressed so the in-app
      // detection event still has a profile to render.
      let profile: RemoteProfile;
      try {
        profile = await api.getProfile(
          { uid: live.uid, signal: live.abort.signal },
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
        // Don't roll back the persistent cooldown — that's keyed off
        // the server having recorded the encounter, which already
        // happened (the row exists; we just couldn't fetch the avatar
        // yet).
        const r = liveStateFor(gen);
        if (r && !recorded) r.lastEmitted.delete(c.uid);
        continue;
      }

      const stillLive = liveStateFor(gen);
      if (!stillLive) return;
      try {
        stillLive.listener({
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
