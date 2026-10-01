import { and, eq, inArray, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { db, pool, revealRequestsTable } from "@workspace/db";
import * as schema from "@workspace/db/schema";

function profilePrivacyLockKey(uid: string): string {
  return `met-profile-privacy:${uid}`;
}

type ProfilePrivacySessionDb = Omit<typeof db, "$client">;

/**
 * Serialize visibility changes with writes that can create discovery data.
 *
 * Transaction-scoped advisory locks work across API processes and remain held
 * until callers finish their Firestore and push side effects. Sorting UIDs
 * gives multi-user operations a consistent lock order and avoids deadlocks.
 */
export async function withProfilePrivacyLocks<T>(
  uids: string[],
  operation: (
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ) => Promise<T>,
): Promise<T> {
  const lockUids = [...new Set(uids)].sort();
  return db.transaction(async (tx) => {
    for (const uid of lockUids) {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${profilePrivacyLockKey(uid)}, 0))`,
      );
    }
    return operation(tx);
  });
}

/**
 * Hold the same privacy advisory locks across a Postgres commit and its
 * Firestore mirror. A dedicated checked-out client owns the session locks and
 * is also the client bound to Drizzle transactions, so the locks cannot be
 * stranded on one pool connection while transaction work uses another.
 */
export async function withProfilePrivacySessionLocks<T>(
  uids: string[],
  operation: (sessionDb: ProfilePrivacySessionDb) => Promise<T>,
): Promise<T> {
  const lockUids = [...new Set(uids)].sort();
  const client = await pool.connect();
  const acquiredKeys: string[] = [];
  let operationFailed = false;

  try {
    for (const uid of lockUids) {
      const key = profilePrivacyLockKey(uid);
      await client.query(
        "SELECT pg_advisory_lock(hashtextextended($1, 0))",
        [key],
      );
      acquiredKeys.push(key);
    }

    const sessionDb = drizzle(client, { schema });
    return await operation(sessionDb);
  } catch (err) {
    operationFailed = true;
    throw err;
  } finally {
    let unlockError: unknown;
    try {
      for (const key of acquiredKeys.reverse()) {
        await client.query(
          "SELECT pg_advisory_unlock(hashtextextended($1, 0))",
          [key],
        );
      }
    } catch (err) {
      unlockError = err;
    } finally {
      client.release(
        unlockError
          ? unlockError instanceof Error
            ? unlockError
            : new Error(String(unlockError))
          : undefined,
      );
    }
    if (unlockError && !operationFailed) throw unlockError;
  }
}

/**
 * UIDs the caller has an existing, deliberate relationship with. A pending
 * reveal request represents a direct, explicit interaction initiated by one
 * party; accepted requests represent established connections.
 * Network membership is deliberately not a global exception here: hidden
 * profiles remain unavailable through generic profile/encounter lookups and
 * are retained only inside that network's membership endpoint.
 */
export async function getExplicitlyKnownUids(
  uid: string,
  candidates: string[],
): Promise<Set<string>> {
  const targetUids = [...new Set(candidates.filter((candidate) => candidate !== uid))];
  if (targetUids.length === 0) return new Set();

  const known = new Set<string>();
  const reveals = await db
    .select({
      senderUid: revealRequestsTable.senderUid,
      recipientUid: revealRequestsTable.recipientUid,
    })
    .from(revealRequestsTable)
    .where(
      and(
        inArray(revealRequestsTable.status, ["pending", "accepted"]),
        or(
          and(
            eq(revealRequestsTable.senderUid, uid),
            inArray(revealRequestsTable.recipientUid, targetUids),
          ),
          and(
            eq(revealRequestsTable.recipientUid, uid),
            inArray(revealRequestsTable.senderUid, targetUids),
          ),
        ),
      ),
    );
  for (const reveal of reveals) {
    known.add(reveal.senderUid === uid ? reveal.recipientUid : reveal.senderUid);
  }

  return known;
}