import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import {
  communityEventsTable,
  db,
  profilesTable,
  subscriptionsTable,
  userAccountsTable,
} from "@workspace/db";

/**
 * Resolve the stable Met account ID for a Firebase UID.
 *
 * Existing accounts keep their Firebase UID as the Met ID so their current
 * RevenueCat customer and quota history are not split. New accounts receive
 * an opaque ID. Legacy event and subscription rows are associated lazily.
 */
export async function ensureUserAccount(uid: string) {
  return db.transaction(async (tx) => {
    let [account] = await tx
      .select()
      .from(userAccountsTable)
      .where(eq(userAccountsTable.firebaseUid, uid))
      .limit(1);

    if (!account) {
      const [profile] = await tx
        .select({ uid: profilesTable.uid })
        .from(profilesTable)
        .where(eq(profilesTable.uid, uid))
        .limit(1);
      const [subscription] = await tx
        .select({ userUid: subscriptionsTable.userUid })
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.userUid, uid))
        .limit(1);
      const [event] = await tx
        .select({ id: communityEventsTable.id })
        .from(communityEventsTable)
        .where(eq(communityEventsTable.ownerUid, uid))
        .limit(1);
      const hasLegacyIdentity = Boolean(profile || subscription || event);
      const accountId = hasLegacyIdentity ? uid : randomUUID();
      await tx
        .insert(userAccountsTable)
        .values({ accountId, firebaseUid: uid })
        .onConflictDoNothing({ target: userAccountsTable.firebaseUid });
      [account] = await tx
        .select()
        .from(userAccountsTable)
        .where(eq(userAccountsTable.firebaseUid, uid))
        .limit(1);
    }

    if (!account || account.firebaseUid !== uid) {
      throw new Error("Unable to resolve the signed-in Met account.");
    }

    await tx
      .update(communityEventsTable)
      .set({ accountId: account.accountId })
      .where(
        and(
          eq(communityEventsTable.ownerUid, uid),
          isNull(communityEventsTable.accountId),
        ),
      );
    await tx
      .update(subscriptionsTable)
      .set({ accountId: account.accountId })
      .where(
        and(
          eq(subscriptionsTable.userUid, uid),
          isNull(subscriptionsTable.accountId),
        ),
      );

    return account;
  });
}
