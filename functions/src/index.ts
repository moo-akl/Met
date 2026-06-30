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
    try {
      await client.query("BEGIN");

      // Forward update — gated on status='pending' so re-delivery of
      // the same event is a no-op (UPDATE returns 0 rows).
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

      // Mutual-consent shortcut — only on accept, AND only if the
      // forward update actually flipped a real pending row. Without
      // this gate, a stray "accepted" write on the inbound doc with
      // no matching forward pending row could still flip an
      // unrelated reverse pending row to accepted, manufacturing a
      // connection without genuine recipient consent. This mirrors
      // the api-server's accept route which only runs the reverse
      // update inside the same transaction after confirming the
      // forward row existed.
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

      await client.query("COMMIT");

      const rowsUpdated = forward.rowCount ?? 0;

      // A rowCount of 0 means no matching pending row existed in Postgres
      // at the time of the mirror — Postgres and Firestore have diverged.
      // This can happen when a previous mirror succeeded (idempotent path)
      // but may also indicate a genuine consistency gap if the api-server
      // never wrote the original pending row. Log it distinctly so a
      // Cloud Logging alert on `alert = "reveal_mirror_no_row"` can surface
      // these divergence events before a user reports "nothing happened".
      if (rowsUpdated === 0) {
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
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      // Re-throw so Cloud Functions retries per its policy. The Postgres
      // gating clause makes retries safe.
      // The `alert` field makes this line filterable as a Cloud Logging
      // log-based alert: severity=ERROR AND jsonPayload.alert="reveal_mirror_failed".
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
    } finally {
      client.release();
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

    const db = getPool();

    // ── Resolve observedHash → profile ──────────────────────────────────
    const observedResult = await db.query<{
      uid: string;
      push_token: string | null;
      is_visible: boolean;
    }>(
      `SELECT uid, push_token, is_visible
         FROM profiles
        WHERE uid_hash = $1
        LIMIT 1`,
      [observedHash],
    );

    if (observedResult.rows.length === 0) {
      logger.info(
        { observedHash },
        "onBleDetectionCreated: no profile for hash — skipping",
      );
      await snap.ref.update({ processed: true, skipped: "hash_not_found" });
      return;
    }

    const observedRow = observedResult.rows[0]!;
    const observedUid = observedRow.uid;

    if (observedUid === observerUid) {
      await snap.ref.update({ processed: true, skipped: "self" });
      return;
    }

    if (!observedRow.is_visible) {
      await snap.ref.update({ processed: true, skipped: "ghost_mode" });
      return;
    }

    // Observer's push token — their JS was frozen when the native scanner
    // fired, so they haven't seen the encounter in the UI yet.
    const observerResult = await db.query<{ push_token: string | null }>(
      `SELECT push_token FROM profiles WHERE uid = $1 LIMIT 1`,
      [observerUid],
    );
    const observerPushToken = observerResult.rows[0]?.push_token ?? null;

    // ── Postgres encounter upsert (both directions, 10-min dedup) ────────
    // Mirrors the logic in POST /api/encounters (encounters.ts). Using a
    // single ON CONFLICT statement is cleaner and avoids a SELECT round-trip.
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
    await db.query(upsertSql, [observerUid, observedUid, rssi]);
    await db.query(upsertSql, [observedUid, observerUid, rssi]);

    // ── Firestore met_people symmetric mirror ────────────────────────────
    // Replicates recordSymmetricEncounter from api-server/firestoreMirror.ts.
    const firestoreDb = admin.firestore();
    const aRef = firestoreDb
      .collection("users")
      .doc(observerUid)
      .collection("met_people")
      .doc(observedUid);
    const bRef = firestoreDb
      .collection("users")
      .doc(observedUid)
      .collection("met_people")
      .doc(observerUid);
    const serverNow = admin.firestore.FieldValue.serverTimestamp();
    const metBatch = firestoreDb.batch();
    metBatch.set(
      aRef,
      {
        uid: observedUid,
        lastMet: serverNow,
        metCount: admin.firestore.FieldValue.increment(1),
        createdAt: serverNow,
      },
      { merge: true },
    );
    metBatch.set(
      bRef,
      {
        uid: observerUid,
        lastMet: serverNow,
        metCount: admin.firestore.FieldValue.increment(1),
        createdAt: serverNow,
      },
      { merge: true },
    );
    await metBatch.commit();

    // ── Push notifications ───────────────────────────────────────────────
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

    // Notify the observed user (they were detected — their token is handy)
    if (observedRow.push_token) {
      await sendExpoPush(observedRow.push_token, observerUid);
    }
    // Notify the observer — their JS was frozen, so they missed the event
    if (observerPushToken) {
      await sendExpoPush(observerPushToken, observedUid);
    }

    // Mark processed and record the resolved observedUid for debugging
    await snap.ref.update({ processed: true, observedUid });

    logger.info(
      { observerUid, observedUid },
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
 * Skips
 * -----
 * - Recipient has no push token stored → skip silently (notifications disabled
 *   or token not yet registered).
 * - Sender == recipient (self-chat edge case) → skip.
 * - nextSenderUid missing and participants unavailable → skip.
 * - Expo API non-OK response → log warning, do not retry (Expo errors on
 *   invalid tokens are permanent; retrying would not help).
 */
export const sendChatMessageNotification = onDocumentCreated(
  {
    document: "chats/{chatId}/messages/{msgId}",
    // No Postgres access needed — push tokens and display names are read
    // from Firestore (users/{uid}.pushToken / .displayName), which is
    // already accessible via the Admin SDK without extra secrets.
    // DATABASE_URL (Replit-internal) is unreachable from Cloud Functions.
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

    // Read sender profile (for display name) and recipient profile (for push
    // token) from Firestore. The api-server mirrors displayName on every
    // profile upsert, and mirrors pushToken on every push-token registration,
    // so both fields are reliably present for active users.
    const [senderSnap, recipientSnap] = await Promise.all([
      firestoreDb.collection("users").doc(senderUid).get(),
      firestoreDb.collection("users").doc(recipientUid).get(),
    ]);

    const senderData = senderSnap.data() as Record<string, unknown> | undefined;
    const recipientData = recipientSnap.data() as
      | Record<string, unknown>
      | undefined;

    const pushToken =
      typeof recipientData?.["pushToken"] === "string"
        ? recipientData["pushToken"]
        : null;
    if (!pushToken) {
      // Recipient has push notifications disabled or hasn't registered a
      // token yet — skip silently.
      logger.info(
        { recipientUid },
        "sendChatMessageNotification: no push token for recipient, skipping",
      );
      return;
    }

    const senderName =
      typeof senderData?.["displayName"] === "string"
        ? senderData["displayName"]
        : "Someone";

    // Chat push notifications are handled by the API server (POST /api/chats/notify),
    // which respects the recipient's notifyChat notification preference. Sending here
    // too would cause duplicate notifications, so this Cloud Function intentionally
    // skips the FCM send and serves only as a hook for future server-side logic
    // (analytics, moderation, etc.).
    logger.info(
      { recipientUid, senderUid, senderName },
      "sendChatMessageNotification: skipping FCM — notification delegated to API server",
    );
  },
);
