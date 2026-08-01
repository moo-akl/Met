/**
 * Real-database integration coverage for venue claim reclaim semantics.
 *
 * The lifecycle promises that terminal applications (`withdrawn`, `expired`)
 * release the venue so it can be claimed again. That promise lives in the
 * database constraint, not in route code, so these tests run against a real
 * Postgres connection instead of a mocked Drizzle chain — a mocked client
 * cannot prove a unique index behaves correctly.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  venueOwnerProfilesTable,
  venueApplicationHistoryTable,
} from "@workspace/db";

const hasDatabase = Boolean(process.env.DATABASE_URL);

// Namespaced so a failed run can never collide with real rows.
const TEST_PREFIX = `itest-reclaim-${process.pid}-${Date.now()}`;
const placeId = (suffix: string) => `${TEST_PREFIX}-place-${suffix}`;
const ownerUid = (suffix: string) => `${TEST_PREFIX}-owner-${suffix}`;

async function insertClaim(input: {
  owner: string;
  place: string;
  applicationStatus: "submitted" | "approved" | "withdrawn" | "expired";
  submittedAt?: Date;
}) {
  const [row] = await db
    .insert(venueOwnerProfilesTable)
    .values({
      ownerUid: input.owner,
      placeId: input.place,
      placeName: "Integration Test Venue",
      businessName: "Integration Test Venue",
      verificationDocUrl: "https://example.com/proof.pdf",
      applicationStatus: input.applicationStatus,
      submittedAt: input.submittedAt ?? new Date(),
    })
    .returning();
  return row;
}

/**
 * Drizzle wraps driver errors in DrizzleQueryError, so the Postgres SQLSTATE
 * lives on `cause` rather than the thrown error itself.
 */
async function expectActiveClaimConflict(op: Promise<unknown>) {
  const error = await op.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, "expected the duplicate active claim to be rejected").not.toBeNull();
  const cause = (error as { cause?: { code?: string; constraint?: string } }).cause;
  expect(cause?.code).toBe("23505");
  expect(cause?.constraint).toBe("venue_owner_profiles_active_place_id_uniq");
}

async function cleanup() {
  const rows = await db
    .select({ id: venueOwnerProfilesTable.id })
    .from(venueOwnerProfilesTable)
    .where(sql`${venueOwnerProfilesTable.ownerUid} LIKE ${`${TEST_PREFIX}%`}`);
  const ids = rows.map((r) => r.id);
  if (ids.length > 0) {
    await db
      .delete(venueApplicationHistoryTable)
      .where(inArray(venueApplicationHistoryTable.venueOwnerProfileId, ids));
    await db.delete(venueOwnerProfilesTable).where(inArray(venueOwnerProfilesTable.id, ids));
  }
}

describe.skipIf(!hasDatabase)("venue claim reclaim semantics (real database)", () => {
  beforeAll(cleanup);
  afterEach(cleanup);

  it("prevents two owners from holding the same venue at once", async () => {
    const place = placeId("contested");
    await insertClaim({ owner: ownerUid("a"), place, applicationStatus: "submitted" });

    await expectActiveClaimConflict(
      insertClaim({ owner: ownerUid("b"), place, applicationStatus: "submitted" }),
    );
  });

  it("frees the venue for another owner once an application is withdrawn", async () => {
    const place = placeId("withdrawn");
    const first = await insertClaim({
      owner: ownerUid("withdrawer"),
      place,
      applicationStatus: "submitted",
    });

    await db
      .update(venueOwnerProfilesTable)
      .set({ applicationStatus: "withdrawn", withdrawnAt: new Date() })
      .where(eq(venueOwnerProfilesTable.id, first.id));

    const second = await insertClaim({
      owner: ownerUid("next-after-withdraw"),
      place,
      applicationStatus: "submitted",
    });

    expect(second.id).not.toBe(first.id);
    expect(second.applicationStatus).toBe("submitted");

    // The withdrawn application is retained for audit, not deleted.
    const [retained] = await db
      .select()
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.id, first.id));
    expect(retained?.applicationStatus).toBe("withdrawn");
  });

  it("frees the venue for another owner once an application expires", async () => {
    const place = placeId("expired");
    const stale = await insertClaim({
      owner: ownerUid("staler"),
      place,
      applicationStatus: "submitted",
      submittedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    });

    // Mirrors the cron transition: status flips, the row survives.
    await db
      .update(venueOwnerProfilesTable)
      .set({ applicationStatus: "expired", expiredAt: new Date() })
      .where(eq(venueOwnerProfilesTable.id, stale.id));

    const reclaimed = await insertClaim({
      owner: ownerUid("next-after-expiry"),
      place,
      applicationStatus: "submitted",
    });

    expect(reclaimed.id).not.toBe(stale.id);

    const [retained] = await db
      .select()
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.id, stale.id));
    expect(retained?.applicationStatus).toBe("expired");
  });

  it("still blocks a reclaim while the original application is approved", async () => {
    const place = placeId("approved");
    await insertClaim({
      owner: ownerUid("approved-owner"),
      place,
      applicationStatus: "approved",
    });

    await expectActiveClaimConflict(
      insertClaim({ owner: ownerUid("hopeful"), place, applicationStatus: "submitted" }),
    );
  });

  it("lets the same owner reclaim a venue they previously withdrew", async () => {
    const place = placeId("self-reclaim");
    const owner = ownerUid("self");
    const original = await insertClaim({ owner, place, applicationStatus: "submitted" });

    await db
      .update(venueOwnerProfilesTable)
      .set({ applicationStatus: "withdrawn", withdrawnAt: new Date() })
      .where(eq(venueOwnerProfilesTable.id, original.id));

    // Same owner row is reused (owner_uid stays unique) and re-enters review.
    const [reactivated] = await db
      .update(venueOwnerProfilesTable)
      .set({ applicationStatus: "submitted", submittedAt: new Date(), withdrawnAt: null })
      .where(
        and(
          eq(venueOwnerProfilesTable.id, original.id),
          eq(venueOwnerProfilesTable.ownerUid, owner),
        ),
      )
      .returning();

    expect(reactivated?.applicationStatus).toBe("submitted");
  });
});
