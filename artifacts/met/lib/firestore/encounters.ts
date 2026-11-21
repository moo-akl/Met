// Real-time Firestore subscriptions for met_people + reveal requests.
//
// These complement the REST flows in AppContext rather than replacing
// them: REST remains the source of truth (servers write via Admin SDK),
// while these onSnapshot streams give us low-latency UI updates so a
// peer's accept / decline shows up within a second instead of waiting
// for the next 20s poll.
//
// Both helpers are no-ops on web / Expo Go (no native bridge).

import { getFirestoreModule, getFirestoreSdk } from "./client";

export interface MetPersonDoc {
  otherUid: string;
  lastMet: number; // epoch ms (client-side parsed from Firestore Timestamp)
  metCount: number;
  location: { lat: number; lng: number } | null;
  /** The other person's subscription tier, written by the server at encounter
   *  record time. Used to show the subscriber ring on encounter cards. */
  tier?: "free" | "plus" | "pro";
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
  const sdk = await getFirestoreSdk();

  const peopleQuery = sdk.query(
    sdk.collection(sdk.doc(sdk.collection(fs, "users"), uid), "met_people"),
    sdk.orderBy("lastMet", "desc"),
  );
  real = sdk.onSnapshot(
    peopleQuery,
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
          const rawTier = d["tier"];
          const tier =
            rawTier === "plus" || rawTier === "pro" || rawTier === "free"
              ? (rawTier as "free" | "plus" | "pro")
              : undefined;
          out.push({ otherUid, lastMet, metCount, location, tier });
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
  const sdk = await getFirestoreSdk();

  // metadata.hasPendingWrites is true for our own optimistic writes;
  // we don't filter on that here because the server is the only writer
  // (Admin SDK), so pending writes shouldn't appear from this client.
  //
  // NOTE: We intentionally do NOT skip the first snapshot. If the sender
  // opens the app after the recipient already accepted, the first snapshot
  // is the only chance to see the "accepted" state — there will be no
  // subsequent change to the doc. Skipping it caused the sender to stay
  // stuck on "request_sent" forever when they weren't online at accept time.
  const requestsRef = sdk.collection(
    sdk.doc(sdk.collection(fs, "users"), uid),
    "requests",
  );
  real = sdk.onSnapshot(
    requestsRef,
      (snap) => {
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
    const now = new Date();
    const sdk = await getFirestoreSdk();
    const users = sdk.collection(fs, "users");
    const myRef = sdk.doc(
      sdk.collection(sdk.doc(users, myUid), "requests"),
      peerUid,
    );
    const theirRef = sdk.doc(
      sdk.collection(sdk.doc(users, peerUid), "requests"),
      myUid,
    );
    const batch = sdk.writeBatch(fs);
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
    const sdk = await getFirestoreSdk();
    const now = sdk.serverTimestamp();
    const users = sdk.collection(fs, "users");
    const userCollection = (uid: string, name: string) =>
      sdk.collection(sdk.doc(users, uid), name);
    const myReq = sdk.doc(userCollection(myUid, "requests"), peerUid);
    const theirReq = sdk.doc(userCollection(peerUid, "requests"), myUid);
    const myMet = sdk.doc(userCollection(myUid, "met_people"), peerUid);
    const theirMet = sdk.doc(userCollection(peerUid, "met_people"), myUid);
    const theirRemovalSignal = sdk.doc(
      userCollection(peerUid, "removals"),
      myUid,
    );
    const batch = sdk.writeBatch(fs);
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
  const sdk = await getFirestoreSdk();

  const removalsRef = sdk.collection(
    sdk.doc(sdk.collection(fs, "users"), uid),
    "removals",
  );
  real = sdk.onSnapshot(
    removalsRef,
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
