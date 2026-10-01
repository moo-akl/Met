import type { PoolClient } from "pg";

const PRIVACY_LOCK_SQL =
  "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))";

/**
 * Hold a dedicated Postgres transaction for privacy-sensitive work.
 * Callers acquire the per-profile locks after BEGIN and perform all guarded
 * database, Firestore, and notification work before the transaction commits.
 */
export async function withPostgresTransaction<T>(
  client: PoolClient,
  operation: () => Promise<T>,
): Promise<T> {
  let transactionStarted = false;
  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const result = await operation();

    await client.query("COMMIT");
    transactionStarted = false;
    return result;
  } catch (err) {
    if (transactionStarted) {
      await client.query("ROLLBACK").catch(() => undefined);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Match the API server's lock namespace and ordering exactly. Transaction
 * advisory locks are held through commit/rollback by withPostgresTransaction.
 */
export async function acquireProfilePrivacyLocks(
  client: PoolClient,
  uids: readonly string[],
): Promise<void> {
  const lockKeys = [...new Set(uids)]
    .sort()
    .map((uid) => `met-profile-privacy:${uid}`);

  for (const lockKey of lockKeys) {
    await client.query(PRIVACY_LOCK_SQL, [lockKey]);
  }
}

/** A pending request is an explicit pre-existing relationship; accepted is established. */
export function isExplicitRevealRelationshipStatus(
  status: unknown,
): status is "pending" | "accepted" {
  return status === "pending" || status === "accepted";
}