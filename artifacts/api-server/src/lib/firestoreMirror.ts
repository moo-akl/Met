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
  uidHash: string;
  displayName: string;
  photoUrl: string | null;
  bio: string | null;
  socials: Record<string, string>;
  isVisible: boolean;
};

/**
 * Mirror a profile upsert to `users/{uid}` in Firestore. Best-effort:
 * Postgres remains the source of truth, so a Firestore outage must not
 * fail the API request.
 */
export async function mirrorProfileToFirestore(
  fields: ProfileMirrorFields,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ref = adminDb().collection("users").doc(fields.uid);
    await ref.set(
      {
        uid: fields.uid,
        uidHash: fields.uidHash,
        displayName: fields.displayName,
        photoUrl: fields.photoUrl,
        bio: fields.bio,
        socials: fields.socials,
        isVisible: fields.isVisible,
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

export type RecordEncounterArgs = {
  uidA: string;
  uidB: string;
  location?: { lat: number; lng: number } | null;
};

export type EncounterRecordResult = {
  otherUid: string;
  metCount: number;
  lastMet: Date;
};

/**
 * Symmetric encounter write — creates / updates BOTH
 * `users/{uidA}/met_people/{uidB}` and `users/{uidB}/met_people/{uidA}`
 * in a single batched commit. Increments `metCount` on each side and
 * stamps `lastMet` to the server time.
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

  const batch = db.batch();
  batch.set(
    aRef,
    { uid: args.uidB, ...sharedFields, createdAt: now },
    { merge: true },
  );
  batch.set(
    bRef,
    { uid: args.uidA, ...sharedFields, createdAt: now },
    { merge: true },
  );
  await batch.commit();

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
