import { FieldValue, GeoPoint } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";
import { logger } from "./logger";

/**
 * Server-side Firestore mirror layer.
 *
 * All writes that touch another user's data go through these helpers
 * (using the Admin SDK, which bypasses Firestore security rules) so we
 * can keep client-side rules locked down to `allow write: if false`.
 *
 * Helpers come in two flavours:
 *   - `mirror*` — best-effort, swallows Firestore errors and logs them.
 *     Used from endpoints whose primary write target is Postgres.
 *   - `record*` — strict, throws on Firestore failure. Used from new
 *     Firestore-first endpoints where Firestore is the source of truth.
 */

export type ProfileMirrorFields = {
  uid: string;
  isVisible: boolean;
  /** Explicit opt-ins require a fresh location, unlike ordinary profile sync. */
  clearPresence?: boolean;
};

/**
 * Mirror only the fields required for the existing client-side nearby-user
 * query. Firestore rules cannot hide selected fields from a readable document,
 * so profile details and stable BLE hashes remain in Postgres/API responses.
 * Best-effort: Postgres remains the source of truth.
 */
export async function mirrorProfileToFirestore(
  fields: ProfileMirrorFields,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ref = adminDb().collection("users").doc(fields.uid);
    await ref.set(
      {
        uid: fields.uid,
        isVisible: fields.isVisible,
        uidHash: FieldValue.delete(),
        displayName: FieldValue.delete(),
        photoUrl: FieldValue.delete(),
        bio: FieldValue.delete(),
        socials: FieldValue.delete(),
        interests: FieldValue.delete(),
        pushToken: FieldValue.delete(),
        ...(fields.clearPresence
          ? {
              location: FieldValue.delete(),
              geohash: FieldValue.delete(),
              lastActive: FieldValue.delete(),
            }
          : {}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return { ok: true };
  } catch (err) {
    const error = (err as Error)?.message ?? String(err);
    logger.warn({ err: error, uid: fields.uid }, "Firestore profile mirror failed");
    return { ok: false, error };
  }
}

/**
 * Apply Hidden to the discovery document before the canonical profile update.
 * Callers still persist the opt-out if this barrier fails, then return a
 * retryable error so the Firestore mirror can be repaired without restoring
 * the canonical profile to Visible.
 */
export async function hideProfileFromFirestore(
  uid: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await adminDb()
      .collection("users")
      .doc(uid)
      .set(
        {
          isVisible: false,
          location: FieldValue.delete(),
          geohash: FieldValue.delete(),
          lastActive: FieldValue.delete(),
        },
        { merge: true },
      );
    return { ok: true };
  } catch (err) {
    const error = (err as Error)?.message ?? String(err);
    logger.warn({ err: error, uid }, "Firestore hide barrier failed");
    return { ok: false, error };
  }
}

/**
 * Remove stale proximity history for a hidden user from both sides. Accepted
 * reveal requests and chat documents are deliberately untouched, so existing
 * connections remain available through their explicit relationship records.
 */
export async function clearEncounterMirrorsForHiddenUser(
  uid: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const fsDb = adminDb();
    const userRef = fsDb.collection("users").doc(uid);
    const ownEncounterRefs = await userRef
      .collection("met_people")
      .listDocuments();
    const refs = new Map<string, (typeof ownEncounterRefs)[number]>();
    for (const encounterRef of ownEncounterRefs) {
      refs.set(encounterRef.path, encounterRef);
    }
    // Find the reverse-side copies too, including asymmetric/stale records
    // where the hidden user's own met_people doc was already removed.
    const reciprocalDocs = await fsDb
      .collectionGroup("met_people")
      .where("uid", "==", uid)
      .get();
    for (const reciprocalDoc of reciprocalDocs.docs) {
      refs.set(reciprocalDoc.ref.path, reciprocalDoc.ref);
    }
    const encounterRefs = [...refs.values()];
    for (let i = 0; i < encounterRefs.length; i += 500) {
      const batch = fsDb.batch();
      encounterRefs.slice(i, i + 500).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
    return { ok: true };
  } catch (err) {
    const error = (err as Error)?.message ?? String(err);
    logger.warn({ err: error, uid }, "Hidden user's stale encounter mirrors could not be cleared");
    return { ok: false, error };
  }
}

export type RecordEncounterArgs = {
  uidA: string;
  uidB: string;
  location?: { lat: number; lng: number } | null;
  /** uidA's subscription tier — written into uidB's met_people doc so uidB
   *  can show the subscriber ring on uidA's encounter card. */
  tierA?: "free" | "plus" | "pro";
  /** uidB's subscription tier — written into uidA's met_people doc. */
  tierB?: "free" | "plus" | "pro";
};

export type EncounterRecordResult = {
  otherUid: string;
  metCount: number;
  lastMet: Date;
};

/**
 * Symmetric encounter write — creates / updates BOTH
 * `users/{uidA}/met_people/{uidB}` and `users/{uidB}/met_people/{uidA}`
 * in a single Firestore transaction, after reading both profile visibility
 * documents. Increments `metCount` on each side and stamps `lastMet` to the
 * server time.
 *
 * Returns the post-write state from uidA's perspective so callers can
 * surface the new metCount immediately without an extra round trip.
 *
 * Throws on Firestore failure — callers (the new POST /encounters/record
 * route) should map this to a 5xx response.
 */
export async function recordSymmetricEncounter(
  args: RecordEncounterArgs,
): Promise<EncounterRecordResult> {
  const db = adminDb();
  const aRef = db
    .collection("users")
    .doc(args.uidA)
    .collection("met_people")
    .doc(args.uidB);
  const bRef = db
    .collection("users")
    .doc(args.uidB)
    .collection("met_people")
    .doc(args.uidA);

  const geo =
    args.location !== null && args.location !== undefined
      ? new GeoPoint(args.location.lat, args.location.lng)
      : null;

  const now = FieldValue.serverTimestamp();
  const sharedFields: Record<string, unknown> = {
    lastMet: now,
    metCount: FieldValue.increment(1),
  };
  if (geo !== null) sharedFields["location"] = geo;

  // Write each user's tier into the OTHER side's doc so the observer can
  // show the subscriber ring on the encounter card without an extra fetch.
  const aFields: Record<string, unknown> = { ...sharedFields };
  const bFields: Record<string, unknown> = { ...sharedFields };
  if (args.tierB) aFields["tier"] = args.tierB; // uidB's tier goes on uidA's view
  if (args.tierA) bFields["tier"] = args.tierA; // uidA's tier goes on uidB's view

  await db.runTransaction(async (transaction) => {
    const [userASnapshot, userBSnapshot] = await Promise.all([
      transaction.get(db.collection("users").doc(args.uidA)),
      transaction.get(db.collection("users").doc(args.uidB)),
    ]);
    if (
      !userASnapshot.exists ||
      !userBSnapshot.exists ||
      userASnapshot.get("isVisible") !== true ||
      userBSnapshot.get("isVisible") !== true
    ) {
      throw new Error("Cannot record an encounter for a hidden profile");
    }
    transaction.set(
      aRef,
      { uid: args.uidB, ...aFields, createdAt: now },
      { merge: true },
    );
    transaction.set(
      bRef,
      { uid: args.uidA, ...bFields, createdAt: now },
      { merge: true },
    );
  });

  // Read back uidA's side so we can return the materialized server time
  // and current metCount. If the read fails (extremely unlikely after a
  // successful batch), fall back to a synthetic now and metCount=1.
  try {
    const snap = await aRef.get();
    const data = snap.data() ?? {};
    const lastMet =
      data["lastMet"]?.toDate?.() instanceof Date
        ? (data["lastMet"].toDate() as Date)
        : new Date();
    const metCount =
      typeof data["metCount"] === "number" ? (data["metCount"] as number) : 1;
    return { otherUid: args.uidB, metCount, lastMet };
  } catch (err) {
    logger.warn(
      { err: (err as Error)?.message, uidA: args.uidA, uidB: args.uidB },
      "Firestore encounter readback failed; returning synthetic result",
    );
    return { otherUid: args.uidB, metCount: 1, lastMet: new Date() };
  }
}

export type RevealStatus = "pending" | "accepted" | "declined";

/**
 * Mirror a reveal request to BOTH sides' `requests` subcollections.
 *
 * Each doc carries a `direction` field so the recipient's UI can filter
 * inbound-pending for the badge counter without joining against another
 * collection. The doc id on each side is the OTHER party's uid, which
 * matches the schema the old Flutter app used.
 *
 * Best-effort: Postgres is the source of truth for the reveal-request
 * lifecycle, so a Firestore outage must not roll back the API response.
 */
export async function mirrorRevealRequest(args: {
  senderUid: string;
  recipientUid: string;
  status: RevealStatus;
  message: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const db = adminDb();
    const now = FieldValue.serverTimestamp();

    // Recipient's view: the doc lives at users/{recipient}/requests/{sender}
    // and represents an INBOUND request from sender.
    const inboxRef = db
      .collection("users")
      .doc(args.recipientUid)
      .collection("requests")
      .doc(args.senderUid);
    // Sender's view: doc at users/{sender}/requests/{recipient}, OUTBOUND.
    const outboxRef = db
      .collection("users")
      .doc(args.senderUid)
      .collection("requests")
      .doc(args.recipientUid);

    const batch = db.batch();
    batch.set(
      inboxRef,
      {
        peerUid: args.senderUid,
        direction: "inbound",
        status: args.status,
        message: args.message,
        updatedAt: now,
      },
      { merge: true },
    );
    batch.set(
      outboxRef,
      {
        peerUid: args.recipientUid,
        direction: "outbound",
        status: args.status,
        message: args.message,
        updatedAt: now,
      },
      { merge: true },
    );
    await batch.commit();
    return { ok: true };
  } catch (err) {
    const error = (err as Error)?.message ?? String(err);
    logger.warn(
      { err: error, sender: args.senderUid, recipient: args.recipientUid },
      "Firestore reveal mirror failed",
    );
    return { ok: false, error };
  }
}

/**
 * Mirror a status flip on a single existing reveal-request pair (e.g.
 * recipient accepts or declines). Updates BOTH sides so each user's
 * client stream reflects the new state without polling.
 */
export async function mirrorRevealStatus(args: {
  senderUid: string;
  recipientUid: string;
  status: Exclude<RevealStatus, "pending">;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const db = adminDb();
    const now = FieldValue.serverTimestamp();

    const inboxRef = db
      .collection("users")
      .doc(args.recipientUid)
      .collection("requests")
      .doc(args.senderUid);
    const outboxRef = db
      .collection("users")
      .doc(args.senderUid)
      .collection("requests")
      .doc(args.recipientUid);

    const batch = db.batch();
    // We use `set ... merge: true` rather than `update` so the call is
    // idempotent even if the doc was never created (e.g. a stale row in
    // Postgres without a Firestore counterpart from before the mirror
    // existed). The `merge` flag ensures we don't clobber other fields.
    batch.set(
      inboxRef,
      {
        status: args.status,
        respondedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
    batch.set(
      outboxRef,
      {
        status: args.status,
        respondedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
    await batch.commit();
    return { ok: true };
  } catch (err) {
    const error = (err as Error)?.message ?? String(err);
    logger.warn(
      { err: error, sender: args.senderUid, recipient: args.recipientUid },
      "Firestore reveal status mirror failed",
    );
    return { ok: false, error };
  }
}

/**
 * Symmetric removal mirror — when one user removes a connection, both
 * users need to see the other disappear from their connections list.
 *
 * We do three things here:
 *   1. Delete BOTH sides' `requests/{otherUid}` mirror docs so neither
 *      device's snapshot stream keeps surfacing the now-gone pair.
 *   2. Delete BOTH sides' `met_people/{otherUid}` encounter-history
 *      docs. Without this, the `subscribeToMetPeople` listener on the
 *      peer's device re-fabricates the encounter from Firestore on the
 *      next snapshot tick and the connection appears to come back from
 *      the dead. This is the bit that was missing in build #48.
 *   3. Write a `users/{otherUid}/removals/{me}` doc on each side so the
 *      peer's client (which has its own local "encounter" state machine
 *      not directly bound to the requests collection) gets a one-shot
 *      signal it can act on to drop the encounter from its UI
 *      immediately, without waiting for the met_people delete to round-
 *      trip through onSnapshot.
 *
 * Best-effort: Postgres deletes are the source of truth; a Firestore
 * outage must not roll back the API response.
 */
export async function mirrorConnectionRemoval(args: {
  uidA: string;
  uidB: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const db = adminDb();
    const now = FieldValue.serverTimestamp();

    const aRequests = db
      .collection("users")
      .doc(args.uidA)
      .collection("requests")
      .doc(args.uidB);
    const bRequests = db
      .collection("users")
      .doc(args.uidB)
      .collection("requests")
      .doc(args.uidA);
    const aMetPerson = db
      .collection("users")
      .doc(args.uidA)
      .collection("met_people")
      .doc(args.uidB);
    const bMetPerson = db
      .collection("users")
      .doc(args.uidB)
      .collection("met_people")
      .doc(args.uidA);
    const aRemoval = db
      .collection("users")
      .doc(args.uidA)
      .collection("removals")
      .doc(args.uidB);
    const bRemoval = db
      .collection("users")
      .doc(args.uidB)
      .collection("removals")
      .doc(args.uidA);

    const batch = db.batch();
    batch.delete(aRequests);
    batch.delete(bRequests);
    batch.delete(aMetPerson);
    batch.delete(bMetPerson);
    batch.set(aRemoval, { peerUid: args.uidB, removedAt: now }, { merge: true });
    batch.set(bRemoval, { peerUid: args.uidA, removedAt: now }, { merge: true });
    await batch.commit();
    return { ok: true };
  } catch (err) {
    const error = (err as Error)?.message ?? String(err);
    logger.warn(
      { err: error, uidA: args.uidA, uidB: args.uidB },
      "Firestore connection removal mirror failed",
    );
    return { ok: false, error };
  }
}
