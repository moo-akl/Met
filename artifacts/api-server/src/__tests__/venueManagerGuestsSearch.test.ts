/**
 * Integration tests for the `search` query-param filter on the venue-manager
 * guests leaderboard endpoint.
 *
 * GET /api/venue-manager/businesses/:businessId/guests?search=<name>
 *
 * The tests exercise the full HTTP path (supertest → app → real Drizzle query
 * → real Postgres) so that a regression in the ILIKE WHERE clause would be
 * caught rather than silently pass against mocks.
 *
 * Tests are skipped automatically when DATABASE_URL is not set (CI only runs
 * them when a test database is available).  All @workspace/db imports are
 * performed lazily inside beforeAll so that the module can be loaded — and
 * cleanly skipped — even without a database connection.
 */

import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { vi } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import type { Express } from "express";

// ---------------------------------------------------------------------------
// Session secret — must be set before the app module is imported.
// ---------------------------------------------------------------------------
const TEST_SESSION_SECRET = "itest-guests-search-session-secret";
process.env["SESSION_SECRET"] = TEST_SESSION_SECRET;

// ---------------------------------------------------------------------------
// Mocks — prevent startup noise without touching the Postgres path.
// ---------------------------------------------------------------------------
vi.mock("pino-http", () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    level: "silent",
  },
}));

vi.mock("../middlewares/rateLimit", () => ({
  createIpRateLimiter:
    () => (_req: unknown, _res: unknown, next: () => void) => next(),
  createUserRateLimiter:
    () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/objectStorage", () => ({
  ObjectStorageService: class {},
}));

vi.mock("../lib/email.js", () => ({
  sendVenueApprovedEmail: vi.fn(),
  sendVenueRejectedEmail: vi.fn(),
  sendChangesRequestedEmail: vi.fn(),
  sendVenueRegistrationConfirmationEmail: vi.fn(),
}));

vi.mock("../lib/push", () => ({ sendPush: vi.fn() }));

vi.mock("../lib/firebaseAdmin", () => ({
  adminAuth: () => ({ getUserByEmail: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const hasDatabase = Boolean(process.env["DATABASE_URL"]);

/** Unique namespace so test rows never collide with other test runs. */
const TEST_PREFIX = `itest-guests-search-${process.pid}-${Date.now()}`;
const TEST_PLACE_ID = `${TEST_PREFIX}-place`;
const TEST_OWNER_UID = `${TEST_PREFIX}-owner`;
const TEST_MANAGER_EMAIL = `${TEST_PREFIX}@itest.invalid`;
const RAW_SESSION_TOKEN = `${TEST_PREFIX}-session-token`;

/** Test user UIDs. */
const USER_ALICE = `${TEST_PREFIX}-alice`;
const USER_BOB = `${TEST_PREFIX}-bob`;
const USER_CHARLIE = `${TEST_PREFIX}-charlie`;

function hashOpaque(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function signCookieValue(val: string, secret: string): string {
  const mac = createHmac("sha256", secret)
    .update(val)
    .digest("base64")
    .replace(/=+$/, "");
  return "s:" + val + "." + mac;
}

function sessionCookieHeader(): string {
  const signed = signCookieValue(RAW_SESSION_TOKEN, TEST_SESSION_SECRET);
  return `met_venue_manager=${encodeURIComponent(signed)}`;
}

// ---------------------------------------------------------------------------
// Lazy db module — only imported when DATABASE_URL is present.
// These are populated inside beforeAll; the describe.skipIf guard ensures
// beforeAll never runs (and these are never accessed) when hasDatabase=false.
// ---------------------------------------------------------------------------
type DbModule = typeof import("@workspace/db");
let dbModule: DbModule;

// ---------------------------------------------------------------------------
// Fixture IDs — populated by seed()
// ---------------------------------------------------------------------------
let businessId = 0;

// ---------------------------------------------------------------------------
// Seed & cleanup
// ---------------------------------------------------------------------------
async function seed() {
  const { db, venueOwnerProfilesTable, venueBusinessesTable, venueManagersTable,
    venueManagerSessionsTable, venueMembershipsTable, profilesTable } = dbModule;

  const [profile] = await db
    .insert(venueOwnerProfilesTable)
    .values({
      ownerUid: TEST_OWNER_UID,
      placeId: TEST_PLACE_ID,
      placeName: "Search Filter Test Venue",
      businessName: "Search Filter Test Venue Ltd",
      applicationStatus: "approved",
      isApproved: true,
      isVerified: true,
    })
    .returning({ id: venueOwnerProfilesTable.id });

  const [business] = await db
    .insert(venueBusinessesTable)
    .values({
      venueOwnerProfileId: profile!.id,
      placeId: TEST_PLACE_ID,
      legalName: "Search Filter Test Venue Ltd",
      createdByUid: TEST_OWNER_UID,
      isActive: true,
    })
    .returning({ id: venueBusinessesTable.id });

  businessId = business!.id;

  const [manager] = await db
    .insert(venueManagersTable)
    .values({
      email: TEST_MANAGER_EMAIL,
      passwordHash: "scrypt$dummy$dummy",
      displayName: "Integration Test Manager",
    })
    .returning({ id: venueManagersTable.id });

  await db.insert(venueManagerSessionsTable).values({
    managerId: manager!.id,
    tokenHash: hashOpaque(RAW_SESSION_TOKEN),
    csrfTokenHash: hashOpaque("csrf-token-not-tested"),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
  });

  await db.insert(venueMembershipsTable).values({
    businessId: business!.id,
    managerId: manager!.id,
    role: "owner",
    status: "active",
    acceptedAt: new Date(),
  });

  // Seed profiles with known display names so the name filter has something to match.
  await db
    .insert(profilesTable)
    .values([
      { uid: USER_ALICE, displayName: "Alice Wonderland" },
      { uid: USER_BOB, displayName: "Bob Builder" },
      { uid: USER_CHARLIE, displayName: "Charlie Chaplin" },
    ])
    .onConflictDoUpdate({
      target: profilesTable.uid,
      set: { displayName: profilesTable.displayName },
    });
}

async function cleanup() {
  const { db, venueOwnerProfilesTable, venueBusinessesTable,
    venueManagersTable, venueManagerSessionsTable, venueMembershipsTable,
    hubCheckinsTable, profilesTable } = dbModule;

  // Remove checkins for our test venue
  await db
    .delete(hubCheckinsTable)
    .where(eq(hubCheckinsTable.placeId, TEST_PLACE_ID));

  // Remove test profiles
  await db
    .delete(profilesTable)
    .where(inArray(profilesTable.uid, [USER_ALICE, USER_BOB, USER_CHARLIE]));

  // Remove auth fixtures in dependency order
  const managers = await db
    .select({ id: venueManagersTable.id })
    .from(venueManagersTable)
    .where(eq(venueManagersTable.email, TEST_MANAGER_EMAIL));

  for (const m of managers) {
    await db
      .delete(venueManagerSessionsTable)
      .where(eq(venueManagerSessionsTable.managerId, m.id));
    await db
      .delete(venueMembershipsTable)
      .where(eq(venueMembershipsTable.managerId, m.id));
  }

  await db
    .delete(venueManagersTable)
    .where(eq(venueManagersTable.email, TEST_MANAGER_EMAIL));

  const businesses = await db
    .select({ id: venueBusinessesTable.id })
    .from(venueBusinessesTable)
    .where(eq(venueBusinessesTable.placeId, TEST_PLACE_ID));

  for (const b of businesses) {
    await db
      .delete(venueBusinessesTable)
      .where(eq(venueBusinessesTable.id, b.id));
  }

  await db
    .delete(venueOwnerProfilesTable)
    .where(eq(venueOwnerProfilesTable.placeId, TEST_PLACE_ID));
}

/** Insert a hub_checkins row with the given timestamp (defaults to now). */
async function insertCheckin(userUid: string, createdAt: Date = new Date()) {
  const { db, hubCheckinsTable } = dbModule;
  await db.insert(hubCheckinsTable).values({
    userUid,
    placeId: TEST_PLACE_ID,
    createdAt,
  } as typeof hubCheckinsTable.$inferInsert);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasDatabase)(
  "GET /api/venue-manager/businesses/:id/guests — search filter (real database)",
  () => {
    let app: Express;

    beforeAll(async () => {
      // Lazily import @workspace/db so the module can load cleanly when
      // DATABASE_URL is absent (the describe.skipIf guard means we only
      // reach here when a real database is available).
      dbModule = await import("@workspace/db");

      // Dynamic import so SESSION_SECRET is set before cookie-parser initialises.
      app = (await import("../app")).default;

      await cleanup();
      await seed();
    });

    afterEach(async () => {
      // Remove checkin rows between tests; keep auth and profile fixtures.
      const { db, hubCheckinsTable } = dbModule;
      await db
        .delete(hubCheckinsTable)
        .where(eq(hubCheckinsTable.placeId, TEST_PLACE_ID));
    });

    // -----------------------------------------------------------------------
    // Partial name match — returns only the matched guest
    // -----------------------------------------------------------------------
    it("search=Alice returns only the guest whose displayName contains 'Alice'", async () => {
      await insertCheckin(USER_ALICE);
      await insertCheckin(USER_BOB);
      await insertCheckin(USER_CHARLIE);

      const res = await request(app)
        .get(`/api/venue-manager/businesses/${businessId}/guests?search=Alice`)
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.guests).toHaveLength(1);
      expect(res.body.guests[0].uid).toBe(USER_ALICE);
      expect(res.body.guests[0].displayName).toBe("Alice Wonderland");
    });

    it("partial suffix match returns the correct guest", async () => {
      await insertCheckin(USER_ALICE);
      await insertCheckin(USER_BOB);
      await insertCheckin(USER_CHARLIE);

      // "Wonderland" is Alice's surname — only she should match
      const res = await request(app)
        .get(
          `/api/venue-manager/businesses/${businessId}/guests?search=Wonderland`,
        )
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.guests[0].uid).toBe(USER_ALICE);
    });

    // -----------------------------------------------------------------------
    // Non-matching search — returns empty list
    // -----------------------------------------------------------------------
    it("search term that matches no displayName returns an empty list", async () => {
      await insertCheckin(USER_ALICE);
      await insertCheckin(USER_BOB);
      await insertCheckin(USER_CHARLIE);

      const res = await request(app)
        .get(
          `/api/venue-manager/businesses/${businessId}/guests?search=Zephyr`,
        )
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      expect(res.body.guests).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // Case-insensitive matching
    // -----------------------------------------------------------------------
    it("search is case-insensitive (lowercase query matches mixed-case name)", async () => {
      await insertCheckin(USER_BOB);
      await insertCheckin(USER_CHARLIE);

      // "bob" (all lowercase) should match "Bob Builder"
      const res = await request(app)
        .get(`/api/venue-manager/businesses/${businessId}/guests?search=bob`)
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.guests[0].uid).toBe(USER_BOB);
    });

    it("search is case-insensitive (uppercase query matches mixed-case name)", async () => {
      await insertCheckin(USER_BOB);
      await insertCheckin(USER_CHARLIE);

      // "BOB" (all uppercase) should still match "Bob Builder"
      const res = await request(app)
        .get(`/api/venue-manager/businesses/${businessId}/guests?search=BOB`)
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.guests[0].uid).toBe(USER_BOB);
    });

    // -----------------------------------------------------------------------
    // search + period intersection — only guests matching both constraints
    // -----------------------------------------------------------------------
    it("search combined with period=month returns only guests satisfying both filters", async () => {
      // Alice checked in this month
      await insertCheckin(USER_ALICE, new Date());
      // Bob checked in 40 days ago (outside current month)
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      await insertCheckin(USER_BOB, oldDate);

      const res = await request(app)
        .get(
          `/api/venue-manager/businesses/${businessId}/guests?search=Alice&period=month`,
        )
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.guests[0].uid).toBe(USER_ALICE);
    });

    it("search combined with period=month excludes a matching guest whose checkin is outside the month", async () => {
      // Alice checked in 40 days ago (outside current month)
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      await insertCheckin(USER_ALICE, oldDate);

      const res = await request(app)
        .get(
          `/api/venue-manager/businesses/${businessId}/guests?search=Alice&period=month`,
        )
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      expect(res.body.guests).toHaveLength(0);
    });

    it("search combined with period=week returns only guests who checked in this week and match the name", async () => {
      // Alice checked in today (within the current week)
      await insertCheckin(USER_ALICE, new Date());
      // Bob checked in 8 days ago (before the current week boundary)
      const outsideWeek = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      await insertCheckin(USER_BOB, outsideWeek);

      // Searching "Bob" with period=week: Bob's checkin is outside the window
      const weekBobRes = await request(app)
        .get(
          `/api/venue-manager/businesses/${businessId}/guests?search=Bob&period=week`,
        )
        .set("Cookie", sessionCookieHeader());

      expect(weekBobRes.status).toBe(200);
      expect(weekBobRes.body.total).toBe(0);

      // Searching "Alice" with period=week: Alice's checkin is inside the window
      const weekAliceRes = await request(app)
        .get(
          `/api/venue-manager/businesses/${businessId}/guests?search=Alice&period=week`,
        )
        .set("Cookie", sessionCookieHeader());

      expect(weekAliceRes.status).toBe(200);
      expect(weekAliceRes.body.total).toBe(1);
      expect(weekAliceRes.body.guests[0].uid).toBe(USER_ALICE);
    });

    // -----------------------------------------------------------------------
    // Empty / blank search — no filter applied, all guests returned
    // -----------------------------------------------------------------------
    it("an empty search string returns all guests (same as omitting search)", async () => {
      await insertCheckin(USER_ALICE);
      await insertCheckin(USER_BOB);

      const res = await request(app)
        .get(`/api/venue-manager/businesses/${businessId}/guests?search=`)
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
    });

    // -----------------------------------------------------------------------
    // Multiple matches — returns all of them
    // -----------------------------------------------------------------------
    it("search term matching multiple guests returns all of them", async () => {
      await insertCheckin(USER_ALICE);
      await insertCheckin(USER_BOB);
      await insertCheckin(USER_CHARLIE);

      // "li" appears in "A*li*ce Wonderland" and "Char*li*e Chaplin", not in "Bob Builder"
      const res = await request(app)
        .get(`/api/venue-manager/businesses/${businessId}/guests?search=li`)
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      const uids = res.body.guests.map((g: { uid: string }) => g.uid);
      expect(uids).toContain(USER_ALICE);   // A*li*ce
      expect(uids).toContain(USER_CHARLIE); // Char*li*e
      expect(uids).not.toContain(USER_BOB);
    });
  },
);
