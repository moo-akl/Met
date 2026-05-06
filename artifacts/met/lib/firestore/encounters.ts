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

/**
 * Recipient-driven response to a reveal request — writes the new
 * `status` ("accepted" | "declined") into BOTH users' `requests/`
 * subcollections in a single Firestore batch.
 *
 * This is the bulletproof primary path for accept/decline:
 *   - It updates the recipient's own inbound doc (which the recipient's
 *     UI already reads) AND the sender's outbound doc (which the
 *     sender's `subscribeToRequestsChange` listener picks up
 *     immediately, flipping their encounter to "connected").
 *   - It does NOT depend on the api-server being reachable; rules
 *     allow either party to write the doc on their own side.
 *   - Postgres (source of truth for cross-session restore) is kept in
 *     sync server-side by the `mirrorRevealStatusToPostgres` Firebase
 *     Cloud Function (`functions/src/index.ts`), which watches this
 *     same Firestore doc. AppContext no longer makes a fire-and-forget
 *     call to the api-server here.
 *
 * Mirrors the pattern the legacy Flutter app used:
 *   batch.set(myRef, {status}, merge:true)
 *   batch.set(theirRef, {status}, merge:true)
 *
 * No-op on web / Expo Go (no native bridge).
 */
export async function writeRevealResponse(
  myUid: string,
  peerUid: string,
  status: "accepted" | "declined",
): Promise<boolean> {
  const fs = await getFirestoreModule();
  if (!fs) return false;
  try {
    // Pull the namespace fresh to access FieldValue.serverTimestamp().
    // The cached firestore() *instance* doesn't expose FieldValue —
    // it lives on the module's default export (the namespace fn).
    const fsMod = await import("@react-native-firebase/firestore");
    const now = fsMod.default.FieldValue.serverTimestamp();
    const myRef = fs
      .collection("users")
      .doc(myUid)
      .collection("requests")
      .doc(peerUid);
    const theirRef = fs
      .collection("users")
      .doc(peerUid)
      .collection("requests")
      .doc(myUid);
    const batch = fs.batch();
    // merge:true so we keep any other fields the api-server already
    // wrote (peerUid, direction, message, createdAt) and only flip
    // status / updatedAt / respondedAt.
    batch.set(
      myRef,
      {
        status,
        updatedAt: now,
        respondedAt: now,
      },
      { merge: true },
    );
    batch.set(
      theirRef,
      {
        status,
        updatedAt: now,
        respondedAt: now,
      },
      { merge: true },
    );
    await batch.commit();
    return true;
  } catch (err) {
    console.warn("[firestore] writeRevealResponse failed", err);
    return false;
  }
}

export interface RemovalDoc {
  peerUid: string;
  removedAt: number; // epoch ms
}

/**
 * Symmetric Remove / Block — wipes the connection from BOTH users'
 * Firestore views in one client batch and drops a one-shot signal in
 * the peer's `removals` subcollection so their `subscribeToRemovals`
 * listener removes the encounter from their UI in real time.
 *
 * Mirrors the legacy Flutter app's batch:
 *   batch.delete(myUid/requests/peer)
 *   batch.delete(peer/requests/myUid)
 *   batch.delete(myUid/met_people/peer)
 *   batch.delete(peer/met_people/myUid)
 *   batch.set(peer/removals/myUid, {peerUid: myUid, removedAt: now})
 *
 * Bulletproof primary path for Remove and Block — does not depend on
 * the api-server being reachable. Postgres is mirrored via the
 * Cloud Function trigger (or the api-server background call).
 *
 * No-op on web / Expo Go (no native bridge).
 */
export async function writeRemoval(
  myUid: string,
  peerUid: string,
): Promise<boolean> {
  const fs = await getFirestoreModule();
  if (!fs) return false;
  try {
    const fsMod = await import("@react-native-firebase/firestore");
    const now = fsMod.default.FieldValue.serverTimestamp();
    const myReq = fs
      .collection("users")
      .doc(myUid)
      .collection("requests")
      .doc(peerUid);
    const theirReq = fs
      .collection("users")
      .doc(peerUid)
      .collection("requests")
      .doc(myUid);
    const myMet = fs
      .collection("users")
      .doc(myUid)
      .collection("met_people")
      .doc(peerUid);
    const theirMet = fs
      .collection("users")
      .doc(peerUid)
      .collection("met_people")
      .doc(myUid);
    const theirRemovalSignal = fs
      .collection("users")
      .doc(peerUid)
      .collection("removals")
      .doc(myUid);
    const batch = fs.batch();
    batch.delete(myReq);
    batch.delete(theirReq);
    batch.delete(myMet);
    batch.delete(theirMet);
    batch.set(
      theirRemovalSignal,
      { peerUid: myUid, removedAt: now },
      { merge: true },
    );
    await batch.commit();
    return true;
  } catch (err) {
    console.warn("[firestore] writeRemoval failed", err);
    return false;
  }
}

/**
 * Subscribe to the current user's `removals` subcollection. The
 * api-server writes a doc here when the OTHER party removes the
 * connection — the client uses it as a one-shot signal to drop the
 * encounter from its local list so both devices stay in sync.
 *
 * The initial snapshot is delivered too — that way a removal that
 * happened while the user was offline still gets applied on next launch.
 */
export async function subscribeToRemovals(
  uid: string,
  listener: (removals: RemovalDoc[]) => void,
): Promise<() => void> {
  let cancelled = false;
  let real: (() => void) | null = null;
  const fs = await getFirestoreModule();
  if (!fs) return () => {};
  if (cancelled) return () => {};

  real = fs
    .collection("users")
    .doc(uid)
    .collection("removals")
    .onSnapshot(
      (snap) => {
        const out: RemovalDoc[] = [];
        snap.forEach((doc) => {
          const d = doc.data() as Record<string, unknown>;
          const peerUid =
            typeof d["peerUid"] === "string"
              ? (d["peerUid"] as string)
              : doc.id;
          const removedAt = toEpochMs(d["removedAt"] as MaybeTimestamp);
          out.push({ peerUid, removedAt });
        });
        listener(out);
      },
      (err) => {
        console.warn("[firestore] removals snapshot error", err);
      },
    );

  return () => {
    cancelled = true;
    if (real) real();
  };
}
