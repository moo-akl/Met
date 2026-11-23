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
  venueEventWelcomeNoteDeliveriesTable,
  communityEventWelcomeNoteDeliveriesTable,
  venueQrVerificationsTable,
  venueReviewsTable,
  communityEventsTable,
  communityEventRsvpsTable,
  communityEventPlanMessagesTable,
  communityEventPlanMediaUploadsTable,
  communityEventPlanNotificationPreferencesTable,
  communityEventJoinRequestsTable,
  communityEventHostRatingsTable,
  eventAttendanceTable,
  eventAttendanceCorrectionsTable,
} from "@workspace/db";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { adminAuth, adminDb, adminStorage } from "./firebaseAdmin";
import { venueGuestbookTable, venueGuestbookBlocksTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * Fully deletes all data belonging to a user across Postgres and Firestore.
 * Used by the scheduled account purge and admin cleanup.
 *
 * Postgres changes are wrapped in a single transaction for atomicity.
 * Firebase Auth deletion is best-effort — it may already be gone (that is
 * exactly the case when the admin cleanup job calls this function).
 */
export async function deleteUserData(
  uid: string,
  options: { accountId?: string; strictCleanup?: boolean } = {},
): Promise<void> {
  const mediaPaths = await deletePostgresUserData(uid, options.accountId);
  await deleteFirestoreUserData(uid);
  await deleteStorageAssets(uid, mediaPaths, options.strictCleanup === true);
  await deleteFirebaseAuthUser(uid, options.strictCleanup === true);
}

async function deletePostgresUserData(uid: string, accountId?: string): Promise<string[]> {
  return db.transaction(async (tx) => {
    const ownedEvents = accountId
      ? or(
          eq(communityEventsTable.ownerUid, uid),
          eq(communityEventsTable.accountId, accountId),
        )
      : eq(communityEventsTable.ownerUid, uid);
    const ownedEventIds = tx
      .select({ id: communityEventsTable.id })
      .from(communityEventsTable)
      .where(ownedEvents);
    const mediaPathRows = await tx
      .select({ mediaObjectPath: communityEventPlanMessagesTable.mediaObjectPath })
      .from(communityEventPlanMessagesTable)
      .where(eq(communityEventPlanMessagesTable.senderUid, uid));
    const uploadPathRows = await tx
      .select({ objectPath: communityEventPlanMediaUploadsTable.objectPath })
      .from(communityEventPlanMediaUploadsTable)
      .where(
        or(
          eq(communityEventPlanMediaUploadsTable.ownerUid, uid),
          inArray(communityEventPlanMediaUploadsTable.eventId, ownedEventIds),
        ),
      );
    const mediaPaths = [
      ...mediaPathRows.map((row) => row.mediaObjectPath),
      ...uploadPathRows.map((row) => row.objectPath),
    ].filter((path): path is string => Boolean(path));

    await tx.delete(venueGuestbookTable).where(eq(venueGuestbookTable.authorUid, uid));
    await tx.delete(venueGuestbookBlocksTable).where(or(
      eq(venueGuestbookBlocksTable.blockerUid, uid), eq(venueGuestbookBlocksTable.blockedUid, uid),
    ));
    // Engagement / activity tables
    await tx
      .delete(hubCheckinsTable)
      .where(eq(hubCheckinsTable.userUid, uid));
    // Private QR visits intentionally have no public hub_checkins row.
    // Account deletion must erase those visits as well.
    await tx
      .delete(venueQrVerificationsTable)
      .where(eq(venueQrVerificationsTable.userUid, uid));
    await tx
      .delete(venueReviewsTable)
      .where(eq(venueReviewsTable.userUid, uid));
    // Remove RSVPs where this user attended another venue's event.
    // (RSVPs for this user's own events are handled by the venue delete block
    // in profiles.ts before deleteUserData is called.)
    await tx
      .delete(venueEventRsvpsTable)
      .where(eq(venueEventRsvpsTable.userUid, uid));
    await tx
      .delete(venueEventWelcomeNoteDeliveriesTable)
      .where(eq(venueEventWelcomeNoteDeliveriesTable.userUid, uid));
    await tx
      .delete(communityEventWelcomeNoteDeliveriesTable)
      .where(eq(communityEventWelcomeNoteDeliveriesTable.userUid, uid));
    await tx
      .delete(communityEventRsvpsTable)
      .where(
        or(
          eq(communityEventRsvpsTable.userUid, uid),
          inArray(communityEventRsvpsTable.eventId, ownedEventIds),
        ),
      );
    await tx
      .delete(communityEventPlanMessagesTable)
      .where(eq(communityEventPlanMessagesTable.senderUid, uid));
    await tx
      .delete(communityEventPlanMediaUploadsTable)
      .where(
        or(
          eq(communityEventPlanMediaUploadsTable.ownerUid, uid),
          inArray(communityEventPlanMediaUploadsTable.eventId, ownedEventIds),
        ),
      );
    await tx
      .delete(communityEventPlanNotificationPreferencesTable)
      .where(eq(communityEventPlanNotificationPreferencesTable.userUid, uid));
    await tx
      .delete(communityEventJoinRequestsTable)
      .where(eq(communityEventJoinRequestsTable.userUid, uid));
    await tx
      .delete(communityEventHostRatingsTable)
      .where(eq(communityEventHostRatingsTable.reviewerUid, uid));
    await tx
      .delete(eventAttendanceTable)
      .where(
        or(
          eq(eventAttendanceTable.userUid, uid),
          and(
            eq(eventAttendanceTable.eventType, "member"),
            inArray(eventAttendanceTable.eventId, ownedEventIds),
          ),
        ),
      );
    await tx
      .delete(eventAttendanceCorrectionsTable)
      .where(
        or(
          eq(eventAttendanceCorrectionsTable.userUid, uid),
          eq(eventAttendanceCorrectionsTable.actorUid, uid),
          and(
            eq(eventAttendanceCorrectionsTable.eventType, "member"),
            inArray(eventAttendanceCorrectionsTable.eventId, ownedEventIds),
          ),
        ),
      );
    await tx
      .update(communityEventsTable)
      .set({
        inviteeUids: sql`array_remove(${communityEventsTable.inviteeUids}, ${uid})`,
        updatedAt: new Date(),
      })
      .where(sql`${uid} = ANY(${communityEventsTable.inviteeUids})`);
    await tx.delete(communityEventsTable).where(ownedEvents);
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
    return mediaPaths;
  });
}

async function deleteFirestoreUserData(uid: string): Promise<void> {
  const fsDb = adminDb();
  // Bookmarks are private account data, not public visit history.
  await fsDb.recursiveDelete(fsDb.collection("savedPlaces").doc(uid));
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

async function deleteStorageAssets(
  uid: string,
  mediaPaths: string[],
  strict: boolean,
): Promise<void> {
  const failedFiles: string[] = [];
  let listFailed = false;

  try {
    const bucket = adminStorage().bucket();
    // Profile photos are stored as profile-photos/{uid}.{ext}
    const results = await Promise.allSettled([
      bucket.getFiles({ prefix: `profile-photos/${uid}.` }),
      bucket.getFiles({ prefix: `venue-guestbook/${uid}/` }),
    ]);
    const byName = new Map<string, { name: string; delete: () => Promise<unknown> }>();
    for (const result of results) {
      if (result.status === "rejected") { listFailed = true; continue; }
      for (const file of result.value[0]) byName.set(file.name, file);
    }
    const files = [...byName.values()];

    const extraFiles = [...new Set(mediaPaths)]
      .filter((path) => path.startsWith("community-event-plan-media/"))
      .map((path) => bucket.file(path));
    await Promise.all(
      [...files, ...extraFiles].map(async (f) => {
        try {
          await f.delete();
        } catch (err: unknown) {
          // Ignore 404 — file is already gone, which is a success for our purposes.
          const code = (err as { code?: number })?.code;
          if (code === 404) return;
          failedFiles.push(f.name);
          logger.warn(
            { err, uid, file: f.name },
            "Non-fatal: failed to delete Storage file during user cleanup",
          );
        }
      }),
    );
  } catch (err) {
    logger.warn({ err, uid }, "Non-fatal: failed to list Storage assets during user cleanup");
    listFailed = true;
  }

  // If anything went wrong, persist the uid so an admin can retry cleanup.
  if (listFailed || failedFiles.length > 0) {
    try {
      const fsDb = adminDb();
      await fsDb
        .collection("admin")
        .doc("failed-storage-cleanup")
        .collection("uids")
        .doc(uid)
        .set({
          uid,
          failedAt: new Date().toISOString(),
          ...(listFailed ? { error: "failed to list files" } : { failedFiles }),
        });
    } catch (fsErr) {
      logger.warn(
        { fsErr, uid },
        "Could not persist failed-storage-cleanup record to Firestore",
      );
    }
    if (strict) {
      throw new Error(
        listFailed
          ? "Storage assets could not be listed during account purge."
          : `Failed to delete ${failedFiles.length} Storage asset(s) during account purge.`,
      );
    }
  }
}

async function deleteFirebaseAuthUser(uid: string, strict: boolean): Promise<void> {
  try {
    const auth = adminAuth();
    if (typeof auth.revokeRefreshTokens === "function") {
      await auth.revokeRefreshTokens(uid);
    }
    await auth.deleteUser(uid);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "auth/user-not-found") {
      // Already deleted — expected in the admin cleanup path.
      return;
    }
    logger.warn({ err, uid }, "Failed to delete Firebase Auth user during cleanup");
    if (strict) throw new Error("Firebase Auth identity could not be deleted.");
  }
}
