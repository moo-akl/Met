import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import {
  db, venueOwnerProfilesTable, venueBusinessesTable, venueManagersTable,
  venueMembershipsTable, venueManagerSessionsTable, venueManagerTokensTable,
  venueManagerRegistrationTokensTable, venueMembershipAuditTable,
  venueApplicationHistoryTable, venueApplicationInviteTokensTable,
  venueActivationPoliciesTable, venueOutreachEmailLogsTable,
  venueEventsTable, venueEventRsvpsTable, venueRewardsTable, venueAnnouncementsTable,
  venueContentReportsTable, venueQrVerificationsTable, venueReviewsTable,
  hubCheckinsTable, monthlyChampionsTable, userStatsTable,
} from "@workspace/db";
import { deleteVenueOwnerProfile } from "./deleteVenueOwnerProfile";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
// Every fixture and destructive assertion runs in an intentionally rolled-back
// transaction: no real venue, identity, email, or existing data is touched.
async function isolated(run: (tx: Tx, key: string) => Promise<void>) {
  const rollback = new Error("fixture rollback");
  try {
    await db.transaction(async (tx) => {
      await run(tx, `venue-delete-${crypto.randomUUID()}`);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}
async function profile(tx: Tx, key: string, extra: Partial<typeof venueOwnerProfilesTable.$inferInsert> = {}) {
  const [row] = await tx.insert(venueOwnerProfilesTable).values({
    ownerUid: key, placeId: key, placeName: key, businessName: key,
    contactEmail: `${key}@example.com`, isApproved: true, applicationStatus: "approved",
    ...extra,
  }).returning();
  return row!;
}
async function business(tx: Tx, p: typeof venueOwnerProfilesTable.$inferSelect) {
  const [row] = await tx.insert(venueBusinessesTable).values({
    venueOwnerProfileId: p.id, placeId: p.placeId, legalName: p.businessName, createdByUid: p.ownerUid,
  }).returning();
  return row!;
}
async function manager(tx: Tx, key: string) {
  const [row] = await tx.insert(venueManagersTable).values({
    email: `${key}@example.com`, firebaseUid: key, passwordHash: "unused-test-hash", displayName: key,
  }).returning();
  return row!;
}

describe("permanent venue deletion", () => {
  it("removes dependent records, orphaned manager emails, old codes and all venue file references", async () => isolated(async (tx, key) => {
    const p = await profile(tx, key, { coverPhotoUrl: "cover", logoUrl: "logo", verificationDocUrl: "doc" });
    const b = await business(tx, p);
    const m = await manager(tx, key);
    await tx.insert(venueMembershipsTable).values({ businessId: b.id, managerId: m.id, uid: key, role: "owner", status: "active" });
    await tx.insert(venueManagerSessionsTable).values({ managerId: m.id, tokenHash: key, csrfTokenHash: key, expiresAt: new Date(Date.now() + 60_000) });
    const [reg] = await tx.insert(venueManagerRegistrationTokensTable).values({
      businessId: b.id, tokenHash: key, invitedEmail: m.email, expiresAt: new Date(),
    }).returning();
    await tx.insert(venueManagerTokensTable).values({
      businessId: b.id, managerId: m.id, email: m.email, role: "owner",
      tokenHash: key, purpose: "recovery", expiresAt: new Date(), createdByManagerId: m.id,
    });
    await tx.insert(venueMembershipAuditTable).values({ businessId: b.id, eventType: "granted", subjectUid: key });
    await tx.insert(venueApplicationHistoryTable).values({ venueOwnerProfileId: p.id, eventType: "approved", actorRole: "admin" });
    await tx.insert(venueActivationPoliciesTable).values({ profileId: p.id, registrationDeadline: new Date() });
    const [invite] = await tx.insert(venueApplicationInviteTokensTable).values({
      tokenHash: key, invitedEmail: m.email, businessName: key, expiresAt: new Date(), applicationId: p.id,
    }).returning();
    // Include logs tied ONLY through token IDs; FK SET NULL must not preserve email.
    await tx.insert(venueOutreachEmailLogsTable).values([
      { registrationTokenId: reg!.id, businessName: key, recipientEmail: m.email, template: "registration", kind: "registration_invite", deliveryStatus: "sent" },
      { applicationInviteTokenId: invite!.id, businessName: key, recipientEmail: m.email, template: "outreach", kind: "new_venue_outreach", deliveryStatus: "sent" },
    ]);
    const [event] = await tx.insert(venueEventsTable).values({ ownerUid: key, placeId: key, title: key, startsAt: new Date(), imageUrl: "event" }).returning();
    await tx.insert(venueEventRsvpsTable).values({ eventId: event!.id, userUid: key });
    await tx.insert(venueRewardsTable).values({
      ownerUid: key, placeId: key, title: key, prizeDescription: key,
      startDate: new Date(), endDate: new Date(Date.now() + 86_400_000),
    });
    await tx.insert(venueAnnouncementsTable).values({ ownerUid: key, placeId: key, title: key, body: key, imageUrl: "announcement" });
    await tx.insert(venueContentReportsTable).values({ placeId: key, reporterUid: key, entityType: "venue", entityId: p.id, reason: "test" });
    await tx.insert(venueQrVerificationsTable).values({ placeId: key, userUid: key });
    await tx.insert(venueReviewsTable).values({ placeId: key, userUid: key, starRating: 5 });
    await tx.insert(hubCheckinsTable).values({ placeId: key, userUid: key, source: "qr_verified" });
    await tx.insert(monthlyChampionsTable).values({ placeId: key, userUid: key, month: "2026-10-01" });
    await tx.insert(userStatsTable).values({ userUid: key, hubStreaks: { [key]: 2, otherVenue: 3 } });

    expect(await deleteVenueOwnerProfile(tx, p)).toEqual(expect.arrayContaining(["cover", "logo", "doc", "event", "announcement"]));
    for (const [table, condition] of [
      [venueOwnerProfilesTable, eq(venueOwnerProfilesTable.id, p.id)],
      [venueBusinessesTable, eq(venueBusinessesTable.id, b.id)],
      [venueManagersTable, eq(venueManagersTable.id, m.id)],
      [venueManagerSessionsTable, eq(venueManagerSessionsTable.managerId, m.id)],
      [venueMembershipsTable, eq(venueMembershipsTable.businessId, b.id)],
      [venueManagerRegistrationTokensTable, eq(venueManagerRegistrationTokensTable.businessId, b.id)],
      [venueManagerTokensTable, eq(venueManagerTokensTable.businessId, b.id)],
      [venueMembershipAuditTable, eq(venueMembershipAuditTable.businessId, b.id)],
      [venueActivationPoliciesTable, eq(venueActivationPoliciesTable.profileId, p.id)],
      [venueApplicationHistoryTable, eq(venueApplicationHistoryTable.venueOwnerProfileId, p.id)],
      [venueApplicationInviteTokensTable, eq(venueApplicationInviteTokensTable.id, invite!.id)],
      [venueOutreachEmailLogsTable, eq(venueOutreachEmailLogsTable.recipientEmail, m.email)],
      [venueEventsTable, eq(venueEventsTable.placeId, key)],
      [venueEventRsvpsTable, eq(venueEventRsvpsTable.eventId, event!.id)],
      [venueRewardsTable, eq(venueRewardsTable.placeId, key)],
      [venueAnnouncementsTable, eq(venueAnnouncementsTable.placeId, key)],
      [hubCheckinsTable, eq(hubCheckinsTable.placeId, key)],
      [venueQrVerificationsTable, eq(venueQrVerificationsTable.placeId, key)],
      [venueReviewsTable, eq(venueReviewsTable.placeId, key)],
      [monthlyChampionsTable, eq(monthlyChampionsTable.placeId, key)],
      [venueContentReportsTable, eq(venueContentReportsTable.placeId, key)],
    ] as const) {
      const result = await tx.execute(sql`SELECT COUNT(*)::int AS n FROM ${table} WHERE ${condition}`);
      expect(result.rows[0]?.n).toBe(0);
    }
    const [stats] = await tx.select().from(userStatsTable).where(eq(userStatsTable.userUid, key));
    expect(stats?.hubStreaks).toEqual({ otherVenue: 3 });
    // Venue email and place can immediately be reused; shared Auth identity is
    // deliberately not part of this SQL cleanup.
    const newProfile = await profile(tx, key);
    expect(newProfile.id).not.toBe(p.id);
    expect((await manager(tx, key)).id).not.toBe(m.id);
  }));

  it("keeps another venue's manager, sessions, content, email logs and reused files", async () => isolated(async (tx, key) => {
    const p = await profile(tx, key, { logoUrl: "shared-logo" });
    const other = await profile(tx, `${key}-other`, { logoUrl: "shared-logo" });
    const b = await business(tx, p), otherB = await business(tx, other), m = await manager(tx, key);
    await tx.insert(venueMembershipsTable).values([b, otherB].map(({ id }) => ({ businessId: id, managerId: m.id, role: "owner" as const, status: "active" as const })));
    await tx.insert(venueManagerSessionsTable).values({ managerId: m.id, tokenHash: key, csrfTokenHash: key, expiresAt: new Date() });
    await tx.insert(venueEventsTable).values({ ownerUid: key, placeId: other.placeId, title: key, startsAt: new Date() });
    await tx.insert(venueOutreachEmailLogsTable).values({ venueOwnerProfileId: other.id, businessName: key, recipientEmail: m.email, template: "registration", kind: "registration_invite", deliveryStatus: "sent" });
    expect(await deleteVenueOwnerProfile(tx, p)).not.toContain("shared-logo");
    expect(await tx.select().from(venueManagersTable).where(eq(venueManagersTable.id, m.id))).toHaveLength(1);
    expect(await tx.select().from(venueManagerSessionsTable).where(eq(venueManagerSessionsTable.managerId, m.id))).toHaveLength(1);
    expect(await tx.select().from(venueMembershipsTable).where(eq(venueMembershipsTable.businessId, otherB.id))).toHaveLength(1);
    expect(await tx.select().from(venueEventsTable).where(eq(venueEventsTable.placeId, other.placeId))).toHaveLength(1);
    expect(await tx.select().from(venueOutreachEmailLogsTable).where(eq(venueOutreachEmailLogsTable.venueOwnerProfileId, other.id))).toHaveLength(1);
  }));

  it("does not erase a replacement venue's guest data when deleting an old expired application", async () => isolated(async (tx, key) => {
    const old = await profile(tx, `${key}-old`, { placeId: key, applicationStatus: "expired", isApproved: false });
    const replacement = await profile(tx, `${key}-new`, { placeId: key });
    await tx.insert(venueReviewsTable).values({ placeId: key, userUid: key, starRating: 5 });
    await tx.insert(hubCheckinsTable).values({ placeId: key, userUid: key });
    await deleteVenueOwnerProfile(tx, old);
    expect(await tx.select().from(venueOwnerProfilesTable).where(eq(venueOwnerProfilesTable.id, replacement.id))).toHaveLength(1);
    expect(await tx.select().from(venueReviewsTable).where(eq(venueReviewsTable.placeId, key))).toHaveLength(1);
    expect(await tx.select().from(hubCheckinsTable).where(eq(hubCheckinsTable.placeId, key))).toHaveLength(1);
  }));
});
