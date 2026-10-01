/**
 * Met — Firebase Cloud Functions.
 *
 * Today we ship a single trigger: `mirrorRevealStatusToPostgres`. It
 * watches the recipient's `users/{uid}/requests/{peerUid}` document and,
 * when its `status` flips to "accepted" or "declined", writes the same
 * change into the Postgres `reveal_requests` table.
 *
 * Why this exists
 * ---------------
 * The mobile client writes accept/decline directly into Firestore from
 * BOTH parties' `requests/` docs in a single batch (see
 * `artifacts/met/lib/firestore/encounters.ts → writeRevealResponse`).
 * That keeps the two phones in sync instantly even when the api-server
 * is slow or unreachable.
 *
 * However, Postgres is the source of truth used to rebuild a user's
 * encounter list after logout / re-install. Without this function the
 * Postgres mirror would silently drift out of sync if the client's
 * fire-and-forget call to `/api/reveals/accept` failed.
 *
 * Making Firestore the trigger means Postgres becomes eventually
 * consistent regardless of phone connectivity at the moment of accept.
 *
 * Idempotency
 * -----------
 * - We act ONLY on the "inbound" doc (the recipient's view) so the
 *   parallel write to the sender's "outbound" doc doesn't double-fire.
 * - We act ONLY on a status TRANSITION into "accepted"/"declined". A
 *   re-write of the same status (or any unrelated field change) is a
 *   no-op.
 * - The Postgres UPDATE is gated on `status = 'pending'` so a second
 *   delivery of the same event lands on 0 rows.
 *
 * Mutual-consent shortcut
 * -----------------------
 * Mirrors the behaviour of `POST /api/reveals/accept` in the api-
 * server: if the recipient also had a pending OUTBOUND request to the
 * same sender, we flip that reverse row to "accepted" too.
 */

import {
  onDocumentWrittenWithAuthContext,
  onDocumentCreated,
} from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { Pool } from "pg";
import * as admin from "firebase-admin";
import {
  acquireProfilePrivacyLocks,
  isExplicitRevealRelationshipStatus,
  withPostgresTransaction,
} from "./privacy";

admin.initializeApp();

// DATABASE_URL is provided to the function as a Firebase Secret. Set it
// with `firebase functions:secrets:set DATABASE_URL` before deploying.
const DATABASE_URL = defineSecret("DATABASE_URL");

// Pool is created lazily on first invocation and reused across warm
// invocations. Cloud Functions sandboxes single-tenant containers per
// instance, so a small pool is appropriate.
let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = DATABASE_URL.value();
  if (!connectionString) {
    throw new Error("DATABASE_URL secret is not set");
  }
  pool = new Pool({
    connectionString,
    max: 2,
    // Keep idle connections short so the function instance can suspend
    // cleanly; long idle pg sockets can block instance scale-down.
    idleTimeoutMillis: 10_000,
  });
  return pool;
}

type TerminalStatus = "accepted" | "declined";
const TERMINAL_STATUSES: ReadonlySet<TerminalStatus> = new Set([
  "accepted",
  "declined",
]);

function isTerminalStatus(value: unknown): value is TerminalStatus {
  return typeof value === "string" && TERMINAL_STATUSES.has(value as TerminalStatus);
}

export const mirrorRevealStatusToPostgres = onDocumentWrittenWithAuthContext(
  {
    document: "users/{uid}/requests/{peerUid}",
    secrets: [DATABASE_URL],
    // Single concurrent Postgres write per pair is plenty; cap to keep
    // the connection pool tiny and prevent runaway scale-out.
    maxInstances: 5,
  },
  async (event) => {
    const after = event.data?.after;
    const before = event.data?.before;

    // Doc deleted — nothing to mirror. Removals are handled separately
    // through `mirrorConnectionRemoval` on the api-server.
    if (!after?.exists) return;

    const afterData = after.data() ?? {};
    const beforeData = before?.exists ? before.data() ?? {} : {};

    const direction = afterData["direction"];
    const status = afterData["status"];
    const prevStatus = beforeData["status"];

    // Gate on the inbound doc only. Both sides flip at the same time
    // via a 2-doc batch from the client, so processing only the
    // recipient's view dedupes the trigger.
    if (direction !== "inbound") return;

    if (!isTerminalStatus(status)) return;

    // Only act on a real transition. A no-op write (same status, other
    // field changed) shouldn't re-update Postgres.
    if (prevStatus === status) return;

    const { uid, peerUid } = event.params as { uid: string; peerUid: string };
    // For an inbound doc: the doc owner is the recipient, the doc id
    // is the sender's uid.
    const recipientUid = uid;
    const senderUid = peerUid;

    // Authorization gate.
    //
    // Firestore rules currently allow EITHER party to write
    // `users/{uid}/requests/{otherUid}` (the recipient owns the doc,
    // and the sender is allowed to flip it as a resilience path).
    // That's fine for the live UI handshake on the two phones, but it
    // means we cannot trust the doc state alone as authorization to
    // mutate Postgres — a malicious sender could write the recipient's
    // inbound doc to "accepted" themselves and trick this trigger
    // into recording a fake consent.
    //
    // Accept and decline are RECIPIENT actions. Mirror to Postgres only
    // when the writer is the recipient (the doc owner). The Admin SDK
    // (api-server) bypasses auth and shows up as `null` authType — we
    // mirror those too because they already went through the API's
    // `requireUid` middleware.
    const authType = event.authType;
    const writerUid = event.authId;
    // In firebase-functions v6 the "user" AuthType was removed. Authenticated
    // user writes now surface as "unknown" with authId set to the user's UID.
    // We identify the recipient by checking authId directly rather than
    // relying on the now-absent "user" string.
    const writerIsRecipient =
      writerUid !== undefined && writerUid === recipientUid;
    // Trusted contexts: only Admin SDK writes from the api-server. We
    // intentionally do NOT treat "unauthenticated" auth as trusted —
    // the only legitimate non-user writer in this path is the api-server
    // Admin SDK (service_account) or a Cloud Platform system action.
    const writerIsAdmin =
      authType === "system" || authType === "service_account";
    if (!writerIsRecipient && !writerIsAdmin) {
      logger.warn(
        {
          authType,
          writerUid,
          senderUid,
          recipientUid,
          status,
        },
        "Refusing to mirror reveal status: writer is not the recipient",
      );
      return;
    }

    const db = getPool();
    const client = await db.connect();
    let skipReason: string | null = null;
    let rowsUpdated = 0;
    let requestWasAlreadyAccepted = false;
    try {
      const result = await withPostgresTransaction(client, async () => {
        let requestWasAlreadyAccepted = false;
        if (status === "accepted") {
          await acquireProfilePrivacyLocks(client, [senderUid, recipientUid]);

          // Read canonical visibility only after both locks are held. Hide
          // takes the same locks until its Firestore and Postgres changes end.
          const profileResult = await client.query<{
            uid: string;
            is_visible: boolean;
          }>(
            `SELECT uid, is_visible
               FROM profiles
              WHERE uid = $1 OR uid = $2`,
            [senderUid, recipientUid],
          );
          const senderProfile = profileResult.rows.find(
            (profile) => profile.uid === senderUid,
          );
          const recipientProfile = profileResult.rows.find(
            (profile) => profile.uid === recipientUid,
          );
          if (!senderProfile || !recipientProfile) {
            return {
              skipReason: "profile_not_found",
              rowsUpdated: 0,
              requestWasAlreadyAccepted: false,
            };
          }

          // Hidden users may still accept an existing explicit request. Check
          // its canonical Postgres row while holding the pair's privacy locks;
          // never turn a missing/declined request into a new connection.
          const requestResult = await client.query<{ status: string }>(
            `SELECT status
               FROM reveal_requests
              WHERE sender_uid = $1
                AND recipient_uid = $2
              FOR UPDATE`,
            [senderUid, recipientUid],
          );
          const requestStatus = requestResult.rows[0]?.status;
          requestWasAlreadyAccepted = requestStatus === "accepted";
          const hasExistingRelationship =
            isExplicitRevealRelationshipStatus(requestStatus);
          const bothProfilesVisible =
            senderProfile.is_visible && recipientProfile.is_visible;

          if (!bothProfilesVisible && !hasExistingRelationship) {
            return {
              skipReason: !senderProfile.is_visible
                ? "hidden_sender"
                : "hidden_recipient",
              rowsUpdated: 0,
              requestWasAlreadyAccepted,
            };
          }
          if (!hasExistingRelationship) {
            return {
              skipReason: "reveal_request_not_found",
              rowsUpdated: 0,
              requestWasAlreadyAccepted: false,
            };
          }

          // This barrier also serializes against direct client-side fail-safe
          // Hide writes, which do not acquire the API's Postgres advisory lock.
          const firestoreDb = admin.firestore();
          const senderUserRef = firestoreDb.collection("users").doc(senderUid);
          const recipientUserRef = firestoreDb
            .collection("users")
            .doc(recipientUid);
          const firestoreSkipReason = await firestoreDb.runTransaction(
            async (transaction): Promise<string | null> => {
              // Read both visibility mirrors so direct client-side hide writes
              // serialize with this barrier. An existing canonical request is
              // nevertheless explicit consent, so mirror visibility (including
              // stale/missing visibility data) does not revoke it.
              await transaction.get(senderUserRef);
              await transaction.get(recipientUserRef);
              const currentRequest = await transaction.get(after.ref);

              if (
                !currentRequest.exists ||
                currentRequest.get("direction") !== "inbound" ||
                currentRequest.get("status") !== status
              ) {
                return "stale_request";
              }

              // Existing pending/accepted requests remain explicit
              // relationships when either participant is hidden. Commit the
              // read set together with a same-value request write; it adds no
              // public fields and its follow-up trigger is a no-op.
              transaction.set(after.ref, { status }, { merge: true });
              return null;
            },
          );
          if (firestoreSkipReason) {
            return {
              skipReason: firestoreSkipReason,
              rowsUpdated: 0,
              requestWasAlreadyAccepted,
            };
          }
        }

        // Forward update — gated on status='pending' so re-delivery of the
        // same event is a no-op (UPDATE returns 0 rows).
        const forward = await client.query(
          `UPDATE reveal_requests
              SET status = $1,
                  responded_at = NOW(),
                  updated_at = NOW()
            WHERE sender_uid = $2
              AND recipient_uid = $3
              AND status = 'pending'
            RETURNING id`,
          [status, senderUid, recipientUid],
        );

        // Only accept the reverse pending request when the forward row was
        // genuinely pending, avoiding manufacturing mutual consent.
        if (status === "accepted" && (forward.rowCount ?? 0) > 0) {
          await client.query(
            `UPDATE reveal_requests
                SET status = 'accepted',
                    responded_at = NOW(),
                    updated_at = NOW()
              WHERE sender_uid = $1
                AND recipient_uid = $2
                AND status = 'pending'`,
            [recipientUid, senderUid],
          );
        }

        return {
          skipReason: null,
          rowsUpdated: forward.rowCount ?? 0,
          requestWasAlreadyAccepted,
        };
      });
      skipReason = result.skipReason;
      rowsUpdated = result.rowsUpdated;
      requestWasAlreadyAccepted = result.requestWasAlreadyAccepted;
    } catch (err) {
      // withPostgresTransaction rolls back and releases the client on error.
      logger.error(
        {
          alert: "reveal_mirror_failed",
          err,
          senderUid,
          recipientUid,
          status,
        },
        "Failed to mirror reveal status to Postgres",
      );
      throw err;
    }

    if (skipReason) {
      logger.info(
        { senderUid, recipientUid, status, skipReason },
        "Skipping accepted reveal mirror because visibility or the existing request does not permit it",
      );
      return;
    }

    // A rowCount of 0 means no matching pending row existed in Postgres at
    // the time of the mirror (possible divergence or duplicate delivery).
    if (rowsUpdated === 0 && requestWasAlreadyAccepted) {
      logger.info(
        { senderUid, recipientUid, status },
        "Reveal request was already accepted; mirror is idempotent",
      );
    } else if (rowsUpdated === 0) {
      logger.warn(
        {
          alert: "reveal_mirror_no_row",
          senderUid,
          recipientUid,
          status,
        },
        "Mirror reveal status: no pending row found in Postgres (possible divergence or duplicate delivery)",
      );
    } else {
      logger.info(
        {
          senderUid,
          recipientUid,
          status,
          rowsUpdated,
        },
        "Mirrored reveal status to Postgres",
      );
    }
  },
);

/**
 * onBleDetectionCreated
 *
 * Fires when the native BLE scanner (MetBleModule.kt / MetBleModule.swift)
 * writes a `ble_detections/{id}` document. The native code runs inside an
 * Android foreground service or iOS bluetooth-central background mode, so
 * this path works even when both phones have their JS thread suspended.
 *
 * What it does
 * ------------
 * 1. Resolves `observedHash` (16-char hex) → uid via Postgres `uid_hash`.
 * 2. Validates: not self, not ghost-mode.
 * 3. Upserts the encounter in Postgres for BOTH directions (10-min dedup).
 * 4. Mirrors `met_people` docs in Firestore for both users (symmetric batch).
 * 5. Sends an Expo push notification to both users.
 * 6. Marks `processed: true` so retries skip re-processing.
 *
 * Idempotency
 * -----------
 * The Postgres upsert uses ON CONFLICT … DO UPDATE, and the Firestore batch
 * uses `set … merge:true`, so duplicate deliveries are safe. A retry after
 * a crash before step 6 re-runs all steps harmlessly.
 */
export const onBleDetectionCreated = onDocumentCreated(
  {
    document: "ble_detections/{id}",
    secrets: [DATABASE_URL],
    // Background encounters can spike at events; cap to keep the
    // Postgres pool small and avoid thundering-herd on scale-out.
    maxInstances: 20,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data() as Record<string, unknown>;

    // Idempotency guard — shouldn't normally be true on onCreate, but
    // protects against an extremely unlikely double-delivery.
    if (data["processed"] === true) return;

    const observerUid =
      typeof data["observerUid"] === "string" ? data["observerUid"] : null;
    const observedHash =
      typeof data["observedHash"] === "string" ? data["observedHash"] : null;
    const rssi =
      typeof data["rssi"] === "number" ? Math.trunc(data["rssi"]) : null;

    if (!observerUid || !observedHash) {
      logger.warn(
        { observerUid, observedHash },
        "onBleDetectionCreated: missing required fields — skipping",
      );
      await snap.ref.update({ processed: true, error: "missing_fields" });
      return;
    }

    const sendExpoPush = async (
      token: string,
      encounterId: string,
    ): Promise<void> => {
      try {
        const resp = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            to: token,
            title: "Someone nearby is using Met!",
            body: "You've crossed paths with someone.",
            data: { type: "encounter", encounterId },
            sound: "default",
            channelId: "default",
          }),
        });
        if (!resp.ok) {
          logger.warn(
            { status: resp.status },
            "onBleDetectionCreated: Expo push non-OK",
          );
        }
      } catch (err) {
        logger.warn({ err }, "onBleDetectionCreated: push fetch threw");
      }
    };

    const client = await getPool().connect();
    let outcome: {
      skipReason: string | null;
      observedUid: string | null;
    };
    try {
      outcome = await withPostgresTransaction(client, async () => {
        // Resolve only the UID before locking; visibility and push-token
        // snapshots are fetched again under the shared per-profile locks.
        const observedResult = await client.query<{ uid: string }>(
          `SELECT uid
             FROM profiles
            WHERE uid_hash = $1
            LIMIT 1`,
          [observedHash],
        );
        const observedUid = observedResult.rows[0]?.uid;
        if (!observedUid) {
          return { skipReason: "hash_not_found", observedUid: null };
        }
        if (observedUid === observerUid) {
          return { skipReason: "self", observedUid };
        }

        await acquireProfilePrivacyLocks(client, [observerUid, observedUid]);

        // This is the canonical visibility/token read. It follows acquisition
        // of both locks, so it cannot use a pre-Hide profile or token snapshot.
        const profileResult = await client.query<{
          uid: string;
          uid_hash: string | null;
          push_token: string | null;
          is_visible: boolean;
        }>(
          `SELECT uid, uid_hash, push_token, is_visible
             FROM profiles
            WHERE uid = $1 OR uid = $2`,
          [observerUid, observedUid],
        );
        const observerRow = profileResult.rows.find(
          (profile) => profile.uid === observerUid,
        );
        const observedRow = profileResult.rows.find(
          (profile) => profile.uid === observedUid,
        );
        if (!observerRow) {
          return { skipReason: "observer_not_found", observedUid };
        }
        if (!observedRow || observedRow.uid_hash !== observedHash) {
          return { skipReason: "hash_not_found", observedUid };
        }
        if (!observerRow.is_visible) {
          return { skipReason: "hidden_observer", observedUid };
        }
        if (!observedRow.is_visible) {
          return { skipReason: "ghost_mode", observedUid };
        }

        // ── Firestore met_people symmetric mirror ─────────────────────────
        // Check current Firestore state and commit both discovery mirrors
        // while the same Postgres privacy locks remain held.
        const firestoreDb = admin.firestore();
        const observerUserRef = firestoreDb.collection("users").doc(observerUid);
        const observedUserRef = firestoreDb.collection("users").doc(observedUid);
        const aRef = observerUserRef
          .collection("met_people")
          .doc(observedUid);
        const bRef = observedUserRef
          .collection("met_people")
          .doc(observerUid);
        const firestoreSkipReason = await firestoreDb.runTransaction(
          async (transaction): Promise<string | null> => {
            const observerUser = await transaction.get(observerUserRef);
            const observedUser = await transaction.get(observedUserRef);

            if (!observerUser.exists) return "observer_not_found";
            if (observerUser.get("isVisible") !== true) return "hidden_observer";
            if (!observedUser.exists) return "observed_user_not_found";
            if (observedUser.get("isVisible") !== true) return "ghost_mode";

            const serverNow = admin.firestore.FieldValue.serverTimestamp();
            transaction.set(
              aRef,
              {
                uid: observedUid,
                lastMet: serverNow,
                metCount: admin.firestore.FieldValue.increment(1),
                createdAt: serverNow,
              },
              { merge: true },
            );
            transaction.set(
              bRef,
              {
                uid: observerUid,
                lastMet: serverNow,
                metCount: admin.firestore.FieldValue.increment(1),
                createdAt: serverNow,
              },
              { merge: true },
            );
            return null;
          },
        );
        if (firestoreSkipReason) {
          return { skipReason: firestoreSkipReason, observedUid };
        }

        // ── Postgres encounter upsert (both directions, 10-min dedup) ────
        const upsertSql = `
          INSERT INTO encounters (observer_uid, observed_uid, last_rssi)
          VALUES ($1, $2, $3)
          ON CONFLICT (observer_uid, observed_uid) DO UPDATE SET
            last_seen_at    = NOW(),
            last_rssi       = COALESCE($3, encounters.last_rssi),
            encounter_count = CASE
              WHEN NOW() - encounters.last_seen_at > INTERVAL '10 minutes'
              THEN encounters.encounter_count + 1
              ELSE encounters.encounter_count
            END`;
        await client.query(upsertSql, [observerUid, observedUid, rssi]);
        await client.query(upsertSql, [observedUid, observerUid, rssi]);

        // Keep notification delivery inside the same lock window as discovery
        // writes; a Hide request must wait for any in-flight alert to finish.
        if (observedRow.push_token) {
          await sendExpoPush(observedRow.push_token, observerUid);
        }
        if (observerRow.push_token) {
          await sendExpoPush(observerRow.push_token, observedUid);
        }

        return { skipReason: null, observedUid };
      });
    } catch (err) {
      logger.error(
        { err, observerUid, observedHash },
        "onBleDetectionCreated: privacy-guarded encounter transaction failed",
      );
      throw err;
    }

    if (outcome.skipReason) {
      await snap.ref.update({
        processed: true,
        skipped: outcome.skipReason,
      });
      return;
    }

    // Mark processed after the guarded transaction commits.
    await snap.ref.update({
      processed: true,
      observedUid: outcome.observedUid,
    });

    logger.info(
      { observerUid, observedUid: outcome.observedUid },
      "onBleDetectionCreated: encounter recorded via background BLE",
    );
  },
);

/**
 * sendChatMessageNotification
 *
 * Fires when a new message document is created in `chats/{chatId}/messages`.
 *
 * Who gets notified
 * -----------------
 * The function reads `nextSenderUid` from the parent `chats/{chatId}` doc.
 * After a message is sent, `nextSenderUid` is set to the OTHER participant
 * (i.e. the one whose turn it is to reply). That person is the recipient of
 * this notification. Falling back to the `participants` array handles the
 * edge case where the meta doc hasn't been written yet.
 *
 * Notification copy
 * -----------------
 * Title: "Your turn"
 * Body:  "[SenderName] replied"
 *
 * The payload carries `{ type: "chat_message", chatPeerUid: senderUid }` so
 * the client tap-handler can deep-link to `/chat/{senderUid}` without any
 * additional network round-trips.
 *
 * Idempotency
 * -----------
 * onCreate triggers fire exactly once per document. If the function is
 * retried (transient error), the Expo Push API is idempotent for duplicate
 * deliveries — the user may see a second notification, but no data is
 * corrupted. This is acceptable given how rarely retries occur.
 *
 * This trigger is intentionally a no-op hook: notification delivery is
 * owned by the API server, which can honor notification preferences and keep
 * push tokens out of broadly readable Firestore presence documents.
 */
export const sendChatMessageNotification = onDocumentCreated(
  {
    document: "chats/{chatId}/messages/{msgId}",
    // The API server handles chat push delivery. User documents retain only
    // the public presence fields required by existing nearby-user queries.
    maxInstances: 10,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const msgData = snap.data() as Record<string, unknown>;
    const senderUid =
      typeof msgData["from"] === "string" ? msgData["from"] : null;

    if (!senderUid) return;

    const { chatId } = event.params as { chatId: string; msgId: string };

    // Read the parent chat document to resolve the recipient.
    // nextSenderUid is set to the OTHER participant when a message is written
    // (see chat.ts → sendMessage), so it reliably identifies whose turn it is
    // to reply — exactly the person we want to notify.
    const firestoreDb = admin.firestore();
    const chatSnap = await firestoreDb.collection("chats").doc(chatId).get();
    if (!chatSnap.exists) return;

    const chatData = chatSnap.data() as Record<string, unknown> | undefined;

    // Primary: use nextSenderUid (most reliable — set by the client on send).
    // Fallback: derive from participants in case the meta doc is slightly
    // behind (e.g. meta update raced the message write).
    let recipientUid: string | null = null;
    const nextSenderUid = chatData?.["nextSenderUid"];
    if (typeof nextSenderUid === "string" && nextSenderUid !== senderUid) {
      recipientUid = nextSenderUid;
    } else {
      const participants = chatData?.["participants"];
      if (Array.isArray(participants)) {
        recipientUid =
          participants.find(
            (p: unknown): p is string =>
              typeof p === "string" && p !== senderUid,
          ) ?? null;
      }
    }

    if (!recipientUid) {
      logger.warn(
        { chatId, senderUid },
        "sendChatMessageNotification: could not determine recipient — skipping",
      );
      return;
    }

    // Guard against the self-chat edge case.
    if (recipientUid === senderUid) return;

    // Chat push notifications are handled by the API server (POST /api/chats/notify),
    // which respects the recipient's notifyChat notification preference. Sending here
    // too would cause duplicate notifications, so this Cloud Function intentionally
    // skips the FCM send and serves only as a hook for future server-side logic
    // (analytics, moderation, etc.).
    logger.info(
      { recipientUid, senderUid },
      "sendChatMessageNotification: skipping FCM — notification delegated to API server",
    );
  },
);
