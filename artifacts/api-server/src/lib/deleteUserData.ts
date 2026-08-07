import { db } from "@workspace/db";
import {
  profilesTable,
  encountersTable,
  revealRequestsTable,
  referralCodesTable,
  referralRedemptionsTable,
  presenceTable,
  pioneerReferralsTable,
  hubCheckinsTable,
  profileViewsTable,
  reviewsTable,
  monthlyChampionsTable,
  userReportsTable,
  userStatsTable,
  subscriptionsTable,
  networkMembersTable,
  networkAnnouncementsTable,
  networkPollVotesTable,
  networkQuestionnaireAnswersTable,
  venueEventRsvpsTable,
} from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { adminAuth, adminDb } from "./firebaseAdmin";
import { logger } from "./logger";

/**
 * Fully deletes all data belonging to a user across Postgres and Firestore.
 * Used by DELETE /api/profiles/me (user-initiated) and the admin cleanup job.
 *
 * Postgres changes are wrapped in a single transaction for atomicity.
 * Firebase Auth deletion is best-effort — it may already be gone (that is
 * exactly the case when the admin cleanup job calls this function).
 */
export async function deleteUserData(uid: string): Promise<void> {
  await deletePostgresUserData(uid);
  await deleteFirestoreUserData(uid);
  await deleteFirebaseAuthUser(uid);
}

async function deletePostgresUserData(uid: string): Promise<void> {
  await db.transaction(async (tx) => {
    // Engagement / activity tables
    await tx
      .delete(hubCheckinsTable)
      .where(eq(hubCheckinsTable.userUid, uid));
    // Remove RSVPs where this user attended another venue's event.
    // (RSVPs for this user's own events are handled by the venue delete block
    // in profiles.ts before deleteUserData is called.)
    await tx
      .delete(venueEventRsvpsTable)
      .where(eq(venueEventRsvpsTable.userUid, uid));
    await tx
      .delete(profileViewsTable)
      .where(
        or(
          eq(profileViewsTable.viewerUid, uid),
          eq(profileViewsTable.targetUid, uid),
        ),
      );
    await tx
      .delete(reviewsTable)
      .where(
        or(
          eq(reviewsTable.reviewerUid, uid),
          eq(reviewsTable.receiverUid, uid),
        ),
      );
    await tx
      .delete(monthlyChampionsTable)
      .where(eq(monthlyChampionsTable.userUid, uid));
    await tx
      .delete(userReportsTable)
      .where(
        or(
          eq(userReportsTable.reporterUid, uid),
          eq(userReportsTable.reportedUid, uid),
        ),
      );
    await tx
      .delete(userStatsTable)
      .where(eq(userStatsTable.userUid, uid));
    await tx
      .delete(subscriptionsTable)
      .where(eq(subscriptionsTable.userUid, uid));

    // Network participation (memberships and authored content only;
    // networks the user created are left intact with an orphaned creator uid).
    await tx
      .delete(networkPollVotesTable)
      .where(eq(networkPollVotesTable.uid, uid));
    await tx
      .delete(networkQuestionnaireAnswersTable)
      .where(eq(networkQuestionnaireAnswersTable.uid, uid));
    await tx
      .delete(networkAnnouncementsTable)
      .where(eq(networkAnnouncementsTable.authorUid, uid));
    await tx
      .delete(networkMembersTable)
      .where(eq(networkMembersTable.uid, uid));

    // Pioneer referrals
    await tx
      .delete(pioneerReferralsTable)
      .where(
        or(
          eq(pioneerReferralsTable.pioneerUid, uid),
          eq(pioneerReferralsTable.referredUserUid, uid),
        ),
      );

    // Core social tables
    await tx
      .delete(revealRequestsTable)
      .where(
        or(
          eq(revealRequestsTable.senderUid, uid),
          eq(revealRequestsTable.recipientUid, uid),
        ),
      );
    await tx
      .delete(encountersTable)
      .where(
        or(
          eq(encountersTable.observerUid, uid),
          eq(encountersTable.observedUid, uid),
        ),
      );

    // Referrals
    await tx
      .delete(referralRedemptionsTable)
      .where(eq(referralRedemptionsTable.redeemerUid, uid));
    await tx
      .delete(referralCodesTable)
      .where(eq(referralCodesTable.uid, uid));

    // Presence
    await tx.delete(presenceTable).where(eq(presenceTable.uid, uid));

    // Profile is last (most tables reference it)
    await tx.delete(profilesTable).where(eq(profilesTable.uid, uid));
  });
}

async function deleteFirestoreUserData(uid: string): Promise<void> {
  const fsDb = adminDb();
  const userRef = fsDb.collection("users").doc(uid);

  for (const subcollection of ["met_people", "requests"] as const) {
    const docs = await userRef.collection(subcollection).listDocuments();
    // Firestore batch limit is 500 writes
    for (let i = 0; i < docs.length; i += 500) {
      const batch = fsDb.batch();
      docs.slice(i, i + 500).forEach((d) => batch.delete(d));
      await batch.commit();
    }
  }

  await userRef.delete();
}

async function deleteFirebaseAuthUser(uid: string): Promise<void> {
  try {
    await adminAuth().deleteUser(uid);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "auth/user-not-found") {
      // Already deleted — expected in the admin cleanup path.
      return;
    }
    logger.warn({ err, uid }, "Failed to delete Firebase Auth user during cleanup");
  }
}
