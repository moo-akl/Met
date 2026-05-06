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

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { Pool } from "pg";

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

export const mirrorRevealStatusToPostgres = onDocumentWritten(
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

      // Mutual-consent shortcut — only on accept, only if a reverse
      // pending row exists. Mirrors the api-server's accept route.
      if (status === "accepted") {
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

      logger.info(
        {
          senderUid,
          recipientUid,
          status,
          rowsUpdated: forward.rowCount ?? 0,
        },
        "Mirrored reveal status to Postgres",
      );
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      // Re-throw so Cloud Functions retries per its policy. The Postgres
      // gating clause makes retries safe.
      logger.error(
        { err, senderUid, recipientUid, status },
        "Failed to mirror reveal status to Postgres",
      );
      throw err;
    } finally {
      client.release();
    }
  },
);
