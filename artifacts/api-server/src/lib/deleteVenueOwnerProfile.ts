import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import {
  db,
  venueOwnerProfilesTable,
  venueApplicationHistoryTable,
  venueEventsTable,
  venueEventRsvpsTable,
  venueRewardsTable,
  venueAnnouncementsTable,
  venueBusinessesTable,
  venueMembershipsTable,
  venueMembershipAuditTable,
  venueManagerRegistrationTokensTable,
  venueManagersTable,
  venueManagerSessionsTable,
  venueManagerTokensTable,
  venueActivationPoliciesTable,
  venueApplicationInviteTokensTable,
  venueOutreachEmailLogsTable,
  venueContentReportsTable,
  hubCheckinsTable,
  venueQrVerificationsTable,
  venueReviewsTable,
  monthlyChampionsTable,
  userStatsTable,
  profilesTable,
} from "@workspace/db";

/**
 * Minimum shape of the transaction handle / db object required by this function.
 * Drizzle's transaction callback receives an object with the same query interface as
 * the main `db` instance, so `typeof db` satisfies this constraint.
 */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Permanently removes a venue's business/access, registration/email, activation,
 * application, content, RSVP and guest records. Place-scoped guest records are
 * preserved when another profile still represents that place.
 *
 * Must be called inside a `db.transaction()` block so the entire cascade is atomic.
 *
 * Shared Met/Firebase identities and managers of other venues are never deleted.
 * Returns exclusively referenced venue file URLs collected before deletion so the caller
 * can perform best-effort Storage cleanup outside the transaction.
 */
export async function deleteVenueOwnerProfile(
  tx: Tx,
  profile: {
    id: number; ownerUid: string; placeId: string;
    coverPhotoUrl?: string | null; logoUrl?: string | null; verificationDocUrl?: string | null;
  },
): Promise<string[]> {
  const profileId = profile.id;
  const ownerUid = profile.ownerUid;
  const placeId = profile.placeId;
  const applicationInvites = await tx.select({ id: venueApplicationInviteTokensTable.id })
    .from(venueApplicationInviteTokensTable)
    .where(eq(venueApplicationInviteTokensTable.applicationId, profileId));
  const applicationInviteIds = applicationInvites.map(({ id }) => id);

  // Resolve the business record if this venue was approved.
  const [business] = await tx
    .select()
    .from(venueBusinessesTable)
    .where(eq(venueBusinessesTable.venueOwnerProfileId, profileId))
    .limit(1).for("update");

  if (business) {
    const registrationTokens = await tx.select({ id: venueManagerRegistrationTokensTable.id })
      .from(venueManagerRegistrationTokensTable)
      .where(eq(venueManagerRegistrationTokensTable.businessId, business.id));
    const registrationTokenIds = registrationTokens.map(({ id }) => id);
    // Delete email records before their FK links are set to NULL by token deletion.
    await tx.delete(venueOutreachEmailLogsTable).where(or(
      eq(venueOutreachEmailLogsTable.venueOwnerProfileId, profileId),
      ...(registrationTokenIds.length ? [inArray(venueOutreachEmailLogsTable.registrationTokenId, registrationTokenIds)] : []),
      ...(applicationInviteIds.length ? [inArray(venueOutreachEmailLogsTable.applicationInviteTokenId, applicationInviteIds)] : []),
    ));
    // Collect manager IDs before we delete memberships.
    const memberships = await tx
      .select({ managerId: venueMembershipsTable.managerId })
      .from(venueMembershipsTable)
      .where(eq(venueMembershipsTable.businessId, business.id));

    const managerIds = memberships
      .map((m: { managerId: number | null }) => m.managerId)
      .filter((id: number | null): id is number => id !== null);
    if (managerIds.length) {
      // Serialize orphan detection with enrollment in other businesses.
      await tx.select({ id: venueManagersTable.id }).from(venueManagersTable)
        .where(inArray(venueManagersTable.id, managerIds)).for("update");
    }

    // Remove invite/recovery tokens for this business.
    await tx
      .delete(venueManagerTokensTable)
      .where(eq(venueManagerTokensTable.businessId, business.id));

    // Remove one-time registration tokens.
    await tx
      .delete(venueManagerRegistrationTokensTable)
      .where(eq(venueManagerRegistrationTokensTable.businessId, business.id));

    // Remove membership audit trail.
    await tx
      .delete(venueMembershipAuditTable)
      .where(eq(venueMembershipAuditTable.businessId, business.id));

    // Remove memberships.
    await tx
      .delete(venueMembershipsTable)
      .where(eq(venueMembershipsTable.businessId, business.id));

    // Delete manager credential records that have no remaining memberships
    // in any other business (i.e. they were exclusively tied to this one).
    if (managerIds.length > 0) {
      const stillAttached = await tx
        .select({ managerId: venueMembershipsTable.managerId })
        .from(venueMembershipsTable)
        .where(inArray(venueMembershipsTable.managerId, managerIds));

      const attachedSet = new Set(
        stillAttached
          .map((m: { managerId: number | null }) => m.managerId)
          .filter((id: number | null): id is number => id !== null),
      );
      const orphanIds = managerIds.filter((id: number) => !attachedSet.has(id));
      if (orphanIds.length > 0) {
        await tx.delete(venueManagerSessionsTable)
          .where(inArray(venueManagerSessionsTable.managerId, orphanIds));
        await tx.delete(venueManagerTokensTable).where(or(
          inArray(venueManagerTokensTable.managerId, orphanIds),
          inArray(venueManagerTokensTable.createdByManagerId, orphanIds),
        ));
        await tx
          .delete(venueManagersTable)
          .where(inArray(venueManagersTable.id, orphanIds));
      }
    }

    // Delete the business record itself.
    await tx
      .delete(venueBusinessesTable)
      .where(eq(venueBusinessesTable.id, business.id));
  }
  // Also handles applications which never had an approved business.
  await tx.delete(venueOutreachEmailLogsTable).where(or(
    eq(venueOutreachEmailLogsTable.venueOwnerProfileId, profileId),
    ...(applicationInviteIds.length ? [inArray(venueOutreachEmailLogsTable.applicationInviteTokenId, applicationInviteIds)] : []),
  ));
  await tx.delete(venueApplicationInviteTokensTable)
    .where(eq(venueApplicationInviteTokensTable.applicationId, profileId));
  await tx.delete(venueActivationPoliciesTable)
    .where(eq(venueActivationPoliciesTable.profileId, profileId));

  // Delete event RSVPs before events (no FK cascade in schema).
  // Also collect imageUrl values so the caller can clean up Storage files.
  const ownedEvents = await tx
    .select({ id: venueEventsTable.id, imageUrl: venueEventsTable.imageUrl })
    .from(venueEventsTable)
    .where(and(eq(venueEventsTable.ownerUid, ownerUid), eq(venueEventsTable.placeId, placeId)));

  const announcements = await tx.select({ id: venueAnnouncementsTable.id, imageUrl: venueAnnouncementsTable.imageUrl })
    .from(venueAnnouncementsTable)
    .where(and(eq(venueAnnouncementsTable.ownerUid, ownerUid), eq(venueAnnouncementsTable.placeId, placeId)));
  const fileUrls = [...new Set([
    profile.coverPhotoUrl, profile.logoUrl, profile.verificationDocUrl,
    ...ownedEvents.map(({ imageUrl }) => imageUrl),
    ...announcements.map(({ imageUrl }) => imageUrl),
  ].filter((url): url is string => Boolean(url)))];

  if (ownedEvents.length > 0) {
    await tx
      .delete(venueEventRsvpsTable)
      .where(inArray(venueEventRsvpsTable.eventId, ownedEvents.map((e: { id: number }) => e.id)));
  }

  await tx
    .delete(venueEventsTable)
    .where(and(eq(venueEventsTable.ownerUid, ownerUid), eq(venueEventsTable.placeId, placeId)));

  await tx
    .delete(venueRewardsTable)
    .where(and(eq(venueRewardsTable.ownerUid, ownerUid), eq(venueRewardsTable.placeId, placeId)));

  await tx
    .delete(venueAnnouncementsTable)
    .where(and(eq(venueAnnouncementsTable.ownerUid, ownerUid), eq(venueAnnouncementsTable.placeId, placeId)));

  await tx.delete(venueContentReportsTable).where(and(
    eq(venueContentReportsTable.placeId, placeId),
    or(
      and(eq(venueContentReportsTable.entityType, "venue"), eq(venueContentReportsTable.entityId, profileId)),
      ...(ownedEvents.length ? [and(eq(venueContentReportsTable.entityType, "event"), inArray(venueContentReportsTable.entityId, ownedEvents.map(({ id }) => id)))] : []),
      ...(announcements.length ? [and(eq(venueContentReportsTable.entityType, "announcement"), inArray(venueContentReportsTable.entityId, announcements.map(({ id }) => id)))] : []),
    ),
  ));

  // An expired/withdrawn historical profile may share its place with a new
  // listing. Never erase the replacement's place-scoped guest data.
  const [otherProfile] = await tx.select({ id: venueOwnerProfilesTable.id })
    .from(venueOwnerProfilesTable)
    .where(and(eq(venueOwnerProfilesTable.placeId, placeId), ne(venueOwnerProfilesTable.id, profileId)))
    .limit(1);
  if (!otherProfile) {
    const guests = await tx.selectDistinct({ uid: hubCheckinsTable.userUid })
      .from(hubCheckinsTable).where(eq(hubCheckinsTable.placeId, placeId));
    await tx.delete(hubCheckinsTable).where(eq(hubCheckinsTable.placeId, placeId));
    await tx.delete(venueQrVerificationsTable).where(eq(venueQrVerificationsTable.placeId, placeId));
    await tx.delete(venueReviewsTable).where(eq(venueReviewsTable.placeId, placeId));
    await tx.delete(monthlyChampionsTable).where(eq(monthlyChampionsTable.placeId, placeId));
    // Visitor memories belong to the place, not its current business owner.
    // Preserve their safety reports if the business listing is removed.
    await tx.delete(venueContentReportsTable).where(and(
      eq(venueContentReportsTable.placeId, placeId), ne(venueContentReportsTable.entityType, "guestbook"),
    ));
    await tx.update(userStatsTable).set({
      hubStreaks: sql`${userStatsTable.hubStreaks} - ${placeId}`,
      updatedAt: new Date(),
    }).where(sql`${userStatsTable.hubStreaks} ? ${placeId}`);
    if (guests.length) {
      await tx.update(profilesTable).set({
        pioneerScore: sql`COALESCE(${profilesTable.referralCount}, 0) * 20
          + (SELECT COUNT(*) FROM ${hubCheckinsTable} WHERE ${hubCheckinsTable.userUid} = ${profilesTable.uid} AND ${hubCheckinsTable.source} = 'qr_verified') * 2
          + COALESCE(${profilesTable.chatConnections}, 0) * 5`,
      }).where(inArray(profilesTable.uid, guests.map(({ uid }) => uid)));
    }
  }

  // Delete the application audit trail.
  await tx
    .delete(venueApplicationHistoryTable)
    .where(eq(venueApplicationHistoryTable.venueOwnerProfileId, profileId));

  // Finally remove the profile itself.
  await tx
    .delete(venueOwnerProfilesTable)
    .where(eq(venueOwnerProfilesTable.id, profileId));

  if (!fileUrls.length) return [];
  // A reused image/document must survive deletion of only one of its venues.
  const remainingProfiles = await tx.select({
    cover: venueOwnerProfilesTable.coverPhotoUrl, logo: venueOwnerProfilesTable.logoUrl,
    doc: venueOwnerProfilesTable.verificationDocUrl,
  }).from(venueOwnerProfilesTable).where(or(
    inArray(venueOwnerProfilesTable.coverPhotoUrl, fileUrls),
    inArray(venueOwnerProfilesTable.logoUrl, fileUrls),
    inArray(venueOwnerProfilesTable.verificationDocUrl, fileUrls),
  ));
  const remainingEvents = await tx.select({ url: venueEventsTable.imageUrl })
    .from(venueEventsTable).where(inArray(venueEventsTable.imageUrl, fileUrls));
  const remainingAnnouncements = await tx.select({ url: venueAnnouncementsTable.imageUrl })
    .from(venueAnnouncementsTable).where(inArray(venueAnnouncementsTable.imageUrl, fileUrls));
  const sharedUrls = new Set([
    ...remainingProfiles.flatMap(({ cover, logo, doc }) => [cover, logo, doc]),
    ...remainingEvents.map(({ url }) => url), ...remainingAnnouncements.map(({ url }) => url),
  ]);
  return fileUrls.filter((url) => !sharedUrls.has(url));
}
