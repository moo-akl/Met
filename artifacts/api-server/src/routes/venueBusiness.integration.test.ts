/**
 * Database-enforced invariants for the venue business domain. These tests
 * deliberately use Postgres: mock chains cannot prove partial unique indexes
 * protect an ownership transfer under concurrent writes.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  venueBusinessesTable,
  venueMembershipAuditTable,
  venueMembershipsTable,
  venueOwnerProfilesTable,
} from "@workspace/db";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const PREFIX = `itest-venue-business-${process.pid}-${Date.now()}`;
const uid = (name: string) => `${PREFIX}-uid-${name}`;
const place = (name: string) => `${PREFIX}-place-${name}`;

async function approvedProfile(name: string) {
  const [profile] = await db.insert(venueOwnerProfilesTable).values({
    ownerUid: uid(name),
    placeId: place(name),
    placeName: `Venue ${name}`,
    businessName: `Business ${name}`,
    verificationDocUrl: "https://example.com/proof.pdf",
    applicationStatus: "approved",
    isApproved: true,
    isVerified: true,
    approvedAt: new Date(),
  }).returning();
  return profile;
}

async function businessFor(profile: Awaited<ReturnType<typeof approvedProfile>>) {
  const [business] = await db.insert(venueBusinessesTable).values({
    venueOwnerProfileId: profile.id,
    placeId: profile.placeId,
    legalName: profile.businessName,
    createdByUid: profile.ownerUid,
  }).returning();
  return business;
}

async function cleanup() {
  const profiles = await db.select({ id: venueOwnerProfilesTable.id })
    .from(venueOwnerProfilesTable)
    .where(sql`${venueOwnerProfilesTable.ownerUid} LIKE ${`${PREFIX}%`}`);
  const profileIds = profiles.map((profile) => profile.id);
  if (!profileIds.length) return;
  const businesses = await db.select({ id: venueBusinessesTable.id })
    .from(venueBusinessesTable)
    .where(inArray(venueBusinessesTable.venueOwnerProfileId, profileIds));
  const businessIds = businesses.map((business) => business.id);
  if (businessIds.length) {
    await db.delete(venueMembershipAuditTable)
      .where(inArray(venueMembershipAuditTable.businessId, businessIds));
    await db.delete(venueMembershipsTable)
      .where(inArray(venueMembershipsTable.businessId, businessIds));
    await db.delete(venueBusinessesTable)
      .where(inArray(venueBusinessesTable.id, businessIds));
  }
  await db.delete(venueOwnerProfilesTable).where(inArray(venueOwnerProfilesTable.id, profileIds));
}

async function expectUniqueConflict(operation: Promise<unknown>, constraint: string) {
  const thrown = await operation.then(() => null, (error: unknown) => error);
  expect(thrown).not.toBeNull();
  expect((thrown as { cause?: { code?: string; constraint?: string } }).cause?.code).toBe("23505");
  expect((thrown as { cause?: { constraint?: string } }).cause?.constraint).toBe(constraint);
}

describe.skipIf(!hasDatabase)("venue business domain (real database)", () => {
  beforeAll(cleanup);
  afterEach(cleanup);

  it("isolates memberships to their own business", async () => {
    const first = await approvedProfile("first");
    const second = await approvedProfile("second");
    const firstBusiness = await businessFor(first);
    const secondBusiness = await businessFor(second);
    await db.insert(venueMembershipsTable).values({
      businessId: firstBusiness.id, uid: first.ownerUid, role: "owner", status: "active", acceptedAt: new Date(),
    });
    await db.insert(venueMembershipsTable).values({
      businessId: secondBusiness.id, uid: second.ownerUid, role: "owner", status: "active", acceptedAt: new Date(),
    });

    const rows = await db.select().from(venueMembershipsTable).where(and(
      eq(venueMembershipsTable.uid, first.ownerUid),
      eq(venueMembershipsTable.businessId, secondBusiness.id),
      eq(venueMembershipsTable.status, "active"),
    ));
    expect(rows).toEqual([]);
  });

  it("makes revoked managers ineligible for active access queries", async () => {
    const profile = await approvedProfile("revoked");
    const business = await businessFor(profile);
    const managerUid = uid("revoked-manager");
    await db.insert(venueMembershipsTable).values({
      businessId: business.id, uid: managerUid, role: "manager", status: "revoked", revokedAt: new Date(),
    });
    const active = await db.select().from(venueMembershipsTable).where(and(
      eq(venueMembershipsTable.businessId, business.id),
      eq(venueMembershipsTable.uid, managerUid),
      eq(venueMembershipsTable.status, "active"),
    ));
    expect(active).toEqual([]);
  });

  it("prevents two active owners during an ownership transfer", async () => {
    const profile = await approvedProfile("transfer");
    const business = await businessFor(profile);
    await db.insert(venueMembershipsTable).values({
      businessId: business.id, uid: profile.ownerUid, role: "owner", status: "active", acceptedAt: new Date(),
    });
    await expectUniqueConflict(
      db.insert(venueMembershipsTable).values({
        businessId: business.id, uid: uid("new-owner"), role: "owner", status: "active", acceptedAt: new Date(),
      }),
      "venue_memberships_one_active_owner_uniq",
    );
  });

  it("allows a revoked owner to be replaced atomically by a new active owner", async () => {
    const profile = await approvedProfile("replacement");
    const business = await businessFor(profile);
    const successor = uid("successor");
    await db.insert(venueMembershipsTable).values({
      businessId: business.id, uid: profile.ownerUid, role: "owner", status: "active", acceptedAt: new Date(),
    });
    await db.transaction(async (tx) => {
      await tx.update(venueMembershipsTable)
        .set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(venueMembershipsTable.businessId, business.id), eq(venueMembershipsTable.uid, profile.ownerUid)));
      await tx.insert(venueMembershipsTable).values({
        businessId: business.id, uid: successor, role: "owner", status: "active", acceptedAt: new Date(),
      });
    });
    const owners = await db.select().from(venueMembershipsTable).where(and(
      eq(venueMembershipsTable.businessId, business.id),
      eq(venueMembershipsTable.role, "owner"),
      eq(venueMembershipsTable.status, "active"),
    ));
    expect(owners).toHaveLength(1);
    expect(owners[0]?.uid).toBe(successor);
  });
});