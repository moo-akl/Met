import { eq, inArray } from "drizzle-orm";
import {
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
} from "@workspace/db";

/**
 * Minimum shape of the transaction handle / db object required by this function.
 * Drizzle's transaction callback receives an object with the same query interface as
 * the main `db` instance, so `typeof db` satisfies this constraint.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = { select: any; delete: any };

/**
 * Permanently deletes a venue owner profile and every record that depends on it:
 *   • venue_businesses (if the venue was approved)
 *     – venue_manager_sessions (for managers of that business)
 *     – venue_manager_tokens
 *     – venue_manager_registration_tokens
 *     – venue_membership_audit
 *     – venue_memberships
 *     – venue_managers that are now orphaned
 *   • venue_event_rsvps (for this venue's events)
 *   • venue_events
 *   • venue_rewards
 *   • venue_announcements
 *   • venue_application_history
 *   • venue_owner_profiles (the profile itself — last)
 *
 * Must be called inside a `db.transaction()` block so the entire cascade is atomic.
 *
 * Returns the event image URLs that were collected before deletion so the caller
 * can perform best-effort Storage cleanup outside the transaction.
 */
export async function deleteVenueOwnerProfile(
  tx: Tx,
  profile: { id: number; ownerUid: string },
): Promise<string[]> {
  const profileId = profile.id;
  const ownerUid = profile.ownerUid;

  // Resolve the business record if this venue was approved.
  const [business] = await tx
    .select()
    .from(venueBusinessesTable)
    .where(eq(venueBusinessesTable.venueOwnerProfileId, profileId))
    .limit(1);

  if (business) {
    // Collect manager IDs before we delete memberships.
    const memberships = await tx
      .select({ managerId: venueMembershipsTable.managerId })
      .from(venueMembershipsTable)
      .where(eq(venueMembershipsTable.businessId, business.id));

    const managerIds = memberships
      .map((m: { managerId: number | null }) => m.managerId)
      .filter((id: number | null): id is number => id !== null);

    // Revoke all active sessions for those managers.
    if (managerIds.length > 0) {
      await tx
        .delete(venueManagerSessionsTable)
        .where(inArray(venueManagerSessionsTable.managerId, managerIds));
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

  // Delete event RSVPs before events (no FK cascade in schema).
  // Also collect imageUrl values so the caller can clean up Storage files.
  const ownedEvents = await tx
    .select({ id: venueEventsTable.id, imageUrl: venueEventsTable.imageUrl })
    .from(venueEventsTable)
    .where(eq(venueEventsTable.ownerUid, ownerUid));

  const eventImageUrls = ownedEvents
    .map((e: { id: number; imageUrl: string | null }) => e.imageUrl)
    .filter((u: string | null): u is string => u != null);

  if (ownedEvents.length > 0) {
    await tx
      .delete(venueEventRsvpsTable)
      .where(inArray(venueEventRsvpsTable.eventId, ownedEvents.map((e: { id: number }) => e.id)));
  }

  await tx
    .delete(venueEventsTable)
    .where(eq(venueEventsTable.ownerUid, ownerUid));

  await tx
    .delete(venueRewardsTable)
    .where(eq(venueRewardsTable.ownerUid, ownerUid));

  await tx
    .delete(venueAnnouncementsTable)
    .where(eq(venueAnnouncementsTable.ownerUid, ownerUid));

  // Delete the application audit trail.
  await tx
    .delete(venueApplicationHistoryTable)
    .where(eq(venueApplicationHistoryTable.venueOwnerProfileId, profileId));

  // Finally remove the profile itself.
  await tx
    .delete(venueOwnerProfilesTable)
    .where(eq(venueOwnerProfilesTable.id, profileId));

  return eventImageUrls;
}
