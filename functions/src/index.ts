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
 * sendChatMessageNotification
 *
 * Fires when a new message document is created in `chats/{chatId}/messages`.
 * Looks up the recipient's Expo push token in Postgres and sends a push
 * notification via the Expo Push API so the recipient is alerted even when
 * the app is in the background or closed.
 *
 * The notification payload carries `{ type: "chat_message", chatPeerUid }`
 * so the client tap-handler can deep-link straight to the correct connection
 * screen without any additional network round-trips.
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
 * - Recipient has no push token stored → skip silently (not yet registered).
 * - Sender == recipient (self-chat edge case) → skip.
 * - Expo API non-OK response → log warning, do not retry (Expo errors on
 *   invalid tokens are permanent; retrying would not help).
 */
export const sendChatMessageNotification = onDocumentCreated(
  {
    document: "chats/{chatId}/messages/{msgId}",
    secrets: [DATABASE_URL],
    // Push notifications are latency-sensitive but not write-heavy; cap
    // instances to avoid overwhelming the Postgres connection pool.
    maxInstances: 10,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const msgData = snap.data() as Record<string, unknown>;
    const senderUid =
      typeof msgData["from"] === "string" ? msgData["from"] : null;
    const text = typeof msgData["text"] === "string" ? msgData["text"] : "";

    if (!senderUid || !text.trim()) return;

    const { chatId } = event.params as { chatId: string; msgId: string };

    // Read the parent chat document to get the participants array. This is
    // more reliable than string-splitting chatId, and future-proofs us if
    // the ID scheme ever changes.
    const chatSnap = await admin
      .firestore()
      .collection("chats")
      .doc(chatId)
      .get();
    if (!chatSnap.exists) return;

    const chatData = chatSnap.data() as Record<string, unknown> | undefined;
    const participants = chatData?.["participants"];
    if (!Array.isArray(participants) || participants.length !== 2) return;

    const recipientUid = participants.find(
      (p: unknown): p is string => typeof p === "string" && p !== senderUid,
    );
    if (!recipientUid) return;

    // Fetch both profiles in one query: we need the recipient's push token
    // and the sender's display name for the notification title.
    const db = getPool();
    const result = await db.query<{
      uid: string;
      display_name: string;
      push_token: string | null;
    }>(
      `SELECT uid, display_name, push_token
         FROM profiles
        WHERE uid = ANY($1)`,
      [[senderUid, recipientUid]],
    );

    const rows = result.rows;
    const senderRow = rows.find((r) => r.uid === senderUid);
    const recipientRow = rows.find((r) => r.uid === recipientUid);

    const pushToken = recipientRow?.push_token ?? null;
    if (!pushToken) {
      logger.info(
        { recipientUid },
        "sendChatMessageNotification: no push token for recipient, skipping",
      );
      return;
    }

    const senderName = senderRow?.display_name ?? "Someone";
    const preview = text.length > 100 ? text.slice(0, 97) + "…" : text;

    const payload = {
      to: pushToken,
      title: senderName,
      body: preview,
      data: { type: "chat_message", chatPeerUid: senderUid },
      sound: "default",
      // Android notification channel — matches the channel created in
      // configureNotifications() on the client.
      channelId: "default",
    };

    let resp: Response;
    try {
      resp = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      // Network failure — re-throw so Cloud Functions retries.
      logger.error(
        { err, recipientUid },
        "sendChatMessageNotification: network error calling Expo Push API",
      );
      throw err;
    }

    if (!resp.ok) {
      // 4xx errors from Expo (e.g. invalid token format) are permanent;
      // logging a warning without rethrowing avoids infinite retry loops.
      const body = await resp.text().catch(() => "");
      logger.warn(
        { status: resp.status, body, recipientUid },
        "sendChatMessageNotification: Expo Push API returned non-OK status",
      );
      return;
    }

    const responseData = (await resp.json()) as unknown;
    logger.info(
      { recipientUid, senderUid, responseData },
      "sendChatMessageNotification: push notification sent",
    );
  },
);
