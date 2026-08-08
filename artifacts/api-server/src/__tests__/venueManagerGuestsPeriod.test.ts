/**
 * Integration tests for the `period` query-param filter on the venue-manager
 * guests leaderboard endpoint.
 *
 * GET /api/venue-manager/businesses/:businessId/guests?period=<all|month|week>
 *
 * The tests exercise the full HTTP path (supertest → app → real Drizzle query
 * → real Postgres) so that a date-math regression in the WHERE clause would
 * be caught rather than silently pass against mocks.
 *
 * Tests are skipped automatically when DATABASE_URL is not set (CI only runs
 * them when a test database is available).
 */

import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { vi } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  venueOwnerProfilesTable,
  venueBusinessesTable,
  venueManagersTable,
  venueManagerSessionsTable,
  venueMembershipsTable,
  hubCheckinsTable,
} from "@workspace/db";
import type { Express } from "express";

// ---------------------------------------------------------------------------
// Session secret — must be set before the app module is imported.
// ---------------------------------------------------------------------------
const TEST_SESSION_SECRET = "itest-guests-period-session-secret";
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

/** Unique namespace so test rows never collide with production data. */
const TEST_PREFIX = `itest-guests-period-${process.pid}-${Date.now()}`;
const TEST_PLACE_ID = `${TEST_PREFIX}-place`;
const TEST_OWNER_UID = `${TEST_PREFIX}-owner`;
const TEST_MANAGER_EMAIL = `${TEST_PREFIX}@itest.invalid`;
const RAW_SESSION_TOKEN = `${TEST_PREFIX}-session-token`;

/** Test user UIDs. */
const USER_A = `${TEST_PREFIX}-user-a`;
const USER_B = `${TEST_PREFIX}-user-b`;
const USER_C = `${TEST_PREFIX}-user-c`;

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

/** Return a Date exactly `n` days before now (preserving the time-of-day). */
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

/**
 * Return the boundary date that the server computes for `period=month`.
 * Mirrors: new Date(now.getFullYear(), now.getMonth(), 1)
 */
function monthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Return the boundary date that the server computes for `period=week`.
 * Mirrors: new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
 */
function weekStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
}

// ---------------------------------------------------------------------------
// Fixture IDs — populated by seed()
// ---------------------------------------------------------------------------
let businessId = 0;

// ---------------------------------------------------------------------------
// Seed & cleanup
// ---------------------------------------------------------------------------
async function seed() {
  const [profile] = await db
    .insert(venueOwnerProfilesTable)
    .values({
      ownerUid: TEST_OWNER_UID,
      placeId: TEST_PLACE_ID,
      placeName: "Period Filter Test Venue",
      businessName: "Period Filter Test Venue Ltd",
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
      legalName: "Period Filter Test Venue Ltd",
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
}

async function cleanup() {
  // Remove checkins for our test venue
  await db
    .delete(hubCheckinsTable)
    .where(eq(hubCheckinsTable.placeId, TEST_PLACE_ID));

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

/** Insert a hub_checkins row with an explicit timestamp. */
async function insertCheckin(userUid: string, createdAt: Date) {
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
  "GET /api/venue-manager/businesses/:id/guests — period filter (real database)",
  () => {
    let app: Express;

    beforeAll(async () => {
      // Dynamic import so SESSION_SECRET is set before cookie-parser initialises.
      app = (await import("../app")).default;
      await cleanup();
      await seed();
    });

    afterEach(async () => {
      // Remove checkin rows between tests; keep auth fixtures intact.
      await db
        .delete(hubCheckinsTable)
        .where(eq(hubCheckinsTable.placeId, TEST_PLACE_ID));
    });

    // -----------------------------------------------------------------------
    // period=all — no date boundary, every checkin counts
    // -----------------------------------------------------------------------
    it("period=all returns every checkin regardless of age", async () => {
      // USER_A checked in 60 days ago, USER_B checked in today
      await insertCheckin(USER_A, daysAgo(60));
      await insertCheckin(USER_B, new Date());

      const res = await request(app)
        .get(`/api/venue-manager/businesses/${businessId}/guests?period=all`)
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      // Both users appear
      expect(res.body.total).toBe(2);
      expect(res.body.guests).toHaveLength(2);
    });

    it("omitting period behaves the same as period=all", async () => {
      await insertCheckin(USER_A, daysAgo(60));
      await insertCheckin(USER_B, new Date());

      const res = await request(app)
        .get(`/api/venue-manager/businesses/${businessId}/guests`)
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
    });

    // -----------------------------------------------------------------------
    // period=month — only checkins on or after the 1st of the current month
    // -----------------------------------------------------------------------
    it("period=month includes checkins from this month and excludes older ones", async () => {
      // A checkin 1 ms after the month boundary — inside the window
      const insideMonth = new Date(monthStart().getTime() + 1);
      // A checkin 1 ms before the month boundary — outside the window
      const outsideMonth = new Date(monthStart().getTime() - 1);

      await insertCheckin(USER_A, insideMonth);   // included
      await insertCheckin(USER_B, outsideMonth);  // excluded
      await insertCheckin(USER_C, new Date());    // included (today)

      const res = await request(app)
        .get(`/api/venue-manager/businesses/${businessId}/guests?period=month`)
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      // USER_A and USER_C are within this month; USER_B is not
      expect(res.body.total).toBe(2);
      const uids = res.body.guests.map((g: { uid: string }) => g.uid);
      expect(uids).toContain(USER_A);
      expect(uids).toContain(USER_C);
      expect(uids).not.toContain(USER_B);
    });

    it("period=month returns 0 when all checkins are from a prior month", async () => {
      // 40 days ago is always in a prior month (or further back)
      await insertCheckin(USER_A, daysAgo(40));

      const res = await request(app)
        .get(`/api/venue-manager/businesses/${businessId}/guests?period=month`)
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      expect(res.body.guests).toHaveLength(0);
    });

    it("period=month counts multiple checkins by the same guest as one entry", async () => {
      const today = new Date();
      // USER_A checks in three times this month
      await insertCheckin(USER_A, today);
      await insertCheckin(USER_A, new Date(today.getTime() - 60_000));
      await insertCheckin(USER_A, new Date(today.getTime() - 120_000));

      const res = await request(app)
        .get(`/api/venue-manager/businesses/${businessId}/guests?period=month`)
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      // total = distinct users = 1; checkinCount reflects all 3 visits
      expect(res.body.total).toBe(1);
      expect(res.body.guests).toHaveLength(1);
      expect(res.body.guests[0].checkinCount).toBe(3);
    });

    // -----------------------------------------------------------------------
    // period=week — only checkins on or after the start of the current week
    //               (Sunday midnight in local time, mirroring server logic)
    // -----------------------------------------------------------------------
    it("period=week includes checkins from this week and excludes older ones", async () => {
      // A checkin 1 ms after the week boundary — inside the window
      const insideWeek = new Date(weekStart().getTime() + 1);
      // A checkin 8 days ago is always before the current week boundary
      const outsideWeek = daysAgo(8);

      await insertCheckin(USER_A, insideWeek);   // included
      await insertCheckin(USER_B, outsideWeek);  // excluded

      const res = await request(app)
        .get(`/api/venue-manager/businesses/${businessId}/guests?period=week`)
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.guests[0].uid).toBe(USER_A);
    });

    it("period=week returns 0 when all checkins are from a prior week", async () => {
      await insertCheckin(USER_A, daysAgo(8));
      await insertCheckin(USER_B, daysAgo(14));

      const res = await request(app)
        .get(`/api/venue-manager/businesses/${businessId}/guests?period=week`)
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      expect(res.body.guests).toHaveLength(0);
    });

    it("period=week counts multiple checkins by the same guest as one entry", async () => {
      const insideWeek = new Date(weekStart().getTime() + 1);
      // USER_A checks in twice this week
      await insertCheckin(USER_A, insideWeek);
      await insertCheckin(USER_A, new Date(insideWeek.getTime() + 60_000));

      const res = await request(app)
        .get(`/api/venue-manager/businesses/${businessId}/guests?period=week`)
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.guests[0].checkinCount).toBe(2);
    });

    // -----------------------------------------------------------------------
    // Cross-period: a checkin visible in "all" must not appear in "week"
    // when it is outside the week boundary.
    // -----------------------------------------------------------------------
    it("the same checkin is included in period=all but excluded from period=week", async () => {
      // 8 days ago is always outside the current week
      await insertCheckin(USER_A, daysAgo(8));

      const [allRes, weekRes] = await Promise.all([
        request(app)
          .get(`/api/venue-manager/businesses/${businessId}/guests?period=all`)
          .set("Cookie", sessionCookieHeader()),
        request(app)
          .get(`/api/venue-manager/businesses/${businessId}/guests?period=week`)
          .set("Cookie", sessionCookieHeader()),
      ]);

      expect(allRes.status).toBe(200);
      expect(allRes.body.total).toBe(1);

      expect(weekRes.status).toBe(200);
      expect(weekRes.body.total).toBe(0);
    });

    // -----------------------------------------------------------------------
    // Response shape: confirm rank, checkinCount, and lastCheckinAt are present
    // -----------------------------------------------------------------------
    it("guests response includes rank, checkinCount, and lastCheckinAt fields", async () => {
      await insertCheckin(USER_A, new Date());

      const res = await request(app)
        .get(`/api/venue-manager/businesses/${businessId}/guests?period=all`)
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      expect(res.body.guests).toHaveLength(1);

      const guest = res.body.guests[0];
      expect(guest).toHaveProperty("rank", 1);
      expect(guest).toHaveProperty("uid", USER_A);
      expect(guest).toHaveProperty("checkinCount", 1);
      expect(guest).toHaveProperty("lastCheckinAt");
      expect(typeof guest.lastCheckinAt).toBe("string");
    });
  },
);
