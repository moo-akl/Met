/**
 * Idempotently establishes the venue business/membership domain from legacy
 * approved venue-owner profiles. It makes no destructive changes and prints a
 * reconciliation report; resolve reported rows before disabling legacy auth.
 *
 * Run after `pnpm --filter @workspace/db run push`:
 *   pnpm --filter @workspace/scripts run backfill-venue-businesses
 */
import {
  db,
  venueBusinessesTable,
  venueMembershipAuditTable,
  venueMembershipsTable,
  venueOwnerProfilesTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

async function run() {
  const approvedProfiles = await db
    .select()
    .from(venueOwnerProfilesTable)
    .where(
      and(
        eq(venueOwnerProfilesTable.isApproved, true),
        eq(venueOwnerProfilesTable.applicationStatus, "approved"),
      ),
    );

  let businessesCreated = 0;
  let membershipsCreated = 0;
  const manualResolution: Array<{ profileId: number; placeId: string; reason: string }> = [];

  for (const profile of approvedProfiles) {
    await db.transaction(async (tx) => {
      const [business] = await tx
        .insert(venueBusinessesTable)
        .values({
          venueOwnerProfileId: profile.id,
          placeId: profile.placeId,
          legalName: profile.businessName,
          createdByUid: profile.ownerUid,
        })
        .onConflictDoNothing()
        .returning();

      let resolvedBusiness = business;
      if (business) businessesCreated++;
      if (!resolvedBusiness) {
        [resolvedBusiness] = await tx
          .select()
          .from(venueBusinessesTable)
          .where(eq(venueBusinessesTable.venueOwnerProfileId, profile.id))
          .limit(1);
      }
      if (!resolvedBusiness || resolvedBusiness.placeId !== profile.placeId) {
        manualResolution.push({
          profileId: profile.id,
          placeId: profile.placeId,
          reason: "Business identity conflicts with the legacy profile",
        });
        return;
      }

      const [membership] = await tx
        .insert(venueMembershipsTable)
        .values({
          businessId: resolvedBusiness.id,
          uid: profile.ownerUid,
          role: "owner",
          status: "active",
          acceptedAt: profile.approvedAt ?? profile.createdAt,
        })
        .onConflictDoNothing()
        .returning();
      if (!membership) return;
      membershipsCreated++;
      await tx.insert(venueMembershipAuditTable).values({
        businessId: resolvedBusiness.id,
        membershipId: membership.id,
        eventType: "backfilled",
        subjectUid: profile.ownerUid,
        toRole: "owner",
        toStatus: "active",
        metadata: JSON.stringify({ source: "venue_owner_profiles" }),
      });
    });
  }

  const missingMemberships = await db.execute(sql`
    SELECT p.id, p.place_id
    FROM venue_owner_profiles p
    LEFT JOIN venue_businesses b ON b.venue_owner_profile_id = p.id
    LEFT JOIN venue_memberships m
      ON m.business_id = b.id
      AND m.uid = p.owner_uid
      AND m.role = 'owner'
      AND m.status = 'active'
    WHERE p.is_approved = true
      AND p.application_status = 'approved'
      AND (b.id IS NULL OR m.id IS NULL)
  `);
  for (const row of missingMemberships.rows as Array<{ id: number; place_id: string }>) {
    manualResolution.push({
      profileId: row.id,
      placeId: row.place_id,
      reason: "Approved profile has no canonical active owner membership",
    });
  }

  console.log(
    JSON.stringify(
      {
        approvedProfiles: approvedProfiles.length,
        businessesCreated,
        membershipsCreated,
        manualResolution,
        readyToDisableLegacyFallback: manualResolution.length === 0,
      },
      null,
      2,
    ),
  );
  if (manualResolution.length > 0) {
    // Fail closed: unresolved records mean the legacy fallback must stay on.
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("Venue business backfill failed", error);
  process.exitCode = 1;
});