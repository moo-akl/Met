// Real-time Firestore subscriptions for met_people + reveal requests.
//
// These complement the REST flows in AppContext rather than replacing
// them: REST remains the source of truth (servers write via Admin SDK),
// while these onSnapshot streams give us low-latency UI updates so a
// peer's accept / decline shows up within a second instead of waiting
// for the next 20s poll.
//
// Both helpers are no-ops on web / Expo Go (no native bridge).

import { getFirestoreModule } from "./client";

export interface MetPersonDoc {
  otherUid: string;
  lastMet: number; // epoch ms (client-side parsed from Firestore Timestamp)
  metCount: number;
  location: { lat: number; lng: number } | null;
}

export interface RequestChangeDoc {
  otherUid: string;
  direction: "inbound" | "outbound";
  status: "pending" | "accepted" | "declined";
  message: string | null;
  updatedAt: number; // epoch ms
}

export type MetPeopleListener = (people: MetPersonDoc[]) => void;
export type RequestChangeListener = (change: RequestChangeDoc) => void;

type MaybeTimestamp = { toMillis?: () => number } | number | null | undefined;
function toEpochMs(v: MaybeTimestamp): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && typeof v.toMillis === "function") {
    try {
      return v.toMillis();
    } catch {
      return Date.now();
    }
  }
  return Date.now();
}

/**
 * Subscribe to the current user's met_people subcollection. Listener is
 * invoked once with the initial snapshot and then on every server-side
 * change.
 *
 * Returns an async-resolved unsubscribe. Calling the returned function
 * before the underlying onSnapshot hook is wired (during the initial
 * import + Firestore module load) is safe — it queues the cancel.
 */
export async function subscribeToMetPeople(
  uid: string,
  listener: MetPeopleListener,
): Promise<() => void> {
  let cancelled = false;
  let real: (() => void) | null = null;
  const fs = await getFirestoreModule();
  if (!fs) return () => {};
  if (cancelled) return () => {};

  real = fs
    .collection("users")
    .doc(uid)
    .collection("met_people")
    .orderBy("lastMet", "desc")
    .onSnapshot(
      (snap) => {
        const out: MetPersonDoc[] = [];
        snap.forEach((doc) => {
          const d = doc.data() as Record<string, unknown>;
          const otherUid =
            typeof d["otherUid"] === "string"
              ? (d["otherUid"] as string)
              : doc.id;
          const lastMet = toEpochMs(d["lastMet"] as MaybeTimestamp);
          const metCount =
            typeof d["metCount"] === "number" ? (d["metCount"] as number) : 1;
          let location: { lat: number; lng: number } | null = null;
          const locRaw = d["location"] as
            | { latitude?: number; longitude?: number }
            | undefined;
          if (
            locRaw &&
            typeof locRaw.latitude === "number" &&
            typeof locRaw.longitude === "number"
          ) {
            location = { lat: locRaw.latitude, lng: locRaw.longitude };
          }
          out.push({ otherUid, lastMet, metCount, location });
        });
        listener(out);
      },
      (err) => {
        console.warn("[firestore] met_people snapshot error", err);
      },
    );

  return () => {
    cancelled = true;
    if (real) real();
  };
}

export interface RequestSnapshotDoc {
  peerUid: string;
  direction: "inbound" | "outbound";
  status: "pending" | "accepted" | "declined";
}

/**
 * Subscribe to the current user's requests subcollection.
 *
 * The listener receives:
 *   - `changes`: docs that changed in this snapshot (added/modified).
 *     Used by AppContext to apply outbound-accepted transitions
 *     immediately, without waiting for the next 20s REST poll. This is
 *     the critical path for the SENDER to see "request_sent → connected"
 *     the moment the recipient accepts.
 *   - The REST poll is still triggered as a follow-up so the joined
 *     sender/recipient profile (which the mirror docs don't carry) gets
 *     merged in for full UI fidelity.
 *
 * Returns an unsubscribe callback.
 */
export async function subscribeToRequestsChange(
  uid: string,
  listener: (changes: RequestSnapshotDoc[]) => void,
): Promise<() => void> {
  let cancelled = false;
  let real: (() => void) | null = null;
  const fs = await getFirestoreModule();
  if (!fs) return () => {};
  if (cancelled) return () => {};

  // metadata.hasPendingWrites is true for our own optimistic writes;
  // we don't filter on that here because the server is the only writer
  // (Admin SDK), so pending writes shouldn't appear from this client.
  let firstSnapshot = true;
  real = fs
    .collection("users")
    .doc(uid)
    .collection("requests")
    .onSnapshot(
      (snap) => {
        // Skip the initial snapshot — AppContext already runs an
        // immediate poll on mount, so re-triggering it here would just
        // duplicate that work.
        if (firstSnapshot) {
          firstSnapshot = false;
          return;
        }
        const docChanges = snap.docChanges();
        if (snap.empty && docChanges.length === 0) return;
        const changes: RequestSnapshotDoc[] = [];
        for (const change of docChanges) {
          if (change.type === "removed") continue;
          const d = change.doc.data() as Record<string, unknown>;
          const peerUid =
            typeof d["peerUid"] === "string"
              ? (d["peerUid"] as string)
              : change.doc.id;
          const direction =
            d["direction"] === "outbound" ? "outbound" : "inbound";
          const rawStatus = d["status"];
          const status =
            rawStatus === "accepted" || rawStatus === "declined"
              ? rawStatus
              : "pending";
          changes.push({ peerUid, direction, status });
        }
        listener(changes);
      },
      (err) => {
        console.warn("[firestore] requests snapshot error", err);
      },
    );

  return () => {
    cancelled = true;
    if (real) real();
  };
}
