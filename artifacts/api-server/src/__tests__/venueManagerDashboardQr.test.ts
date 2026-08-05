/**
 * Integration tests for the qrVerificationsToday dedup behaviour in the venue
 * manager dashboard endpoint.
 *
 * These tests exercise the full HTTP path (supertest → app → real Drizzle
 * query → real Postgres) so that a regression from COUNT(DISTINCT …) to
 * COUNT(*) in the route would make the same-user-twice test fail rather than
 * silently pass against a mock.
 *
 * Tests are skipped automatically when DATABASE_URL is not set (CI only runs
 * them when a test database is available).
 */

import { createHmac, createHash } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { vi } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import {
  db,
  venueOwnerProfilesTable,
  venueBusinessesTable,
  venueManagersTable,
  venueManagerSessionsTable,
  venueMembershipsTable,
  venueQrVerificationsTable,
} from "@workspace/db";
import type { Express } from "express";

// ---------------------------------------------------------------------------
// Session secret — must be set before the app module is imported so that
// cookie-parser picks it up at initialisation time.
// ---------------------------------------------------------------------------

const TEST_SESSION_SECRET = "itest-dashboard-qr-session-secret";
process.env["SESSION_SECRET"] = TEST_SESSION_SECRET;

// ---------------------------------------------------------------------------
// Non-DB mocks — these don't affect Drizzle/Postgres but prevent startup
// noise (pino-http formatters, GCS client, email transport, etc.).
// vi.mock calls are hoisted so they apply before app is imported.
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const hasDatabase = Boolean(process.env["DATABASE_URL"]);

/** Unique namespace so test rows can never collide with production data. */
const TEST_PREFIX = `itest-qr-dashboard-${process.pid}-${Date.now()}`;

const TEST_PLACE_ID = `${TEST_PREFIX}-place`;
const TEST_OWNER_UID = `${TEST_PREFIX}-owner`;
const TEST_MANAGER_EMAIL = `${TEST_PREFIX}@itest.invalid`;
const RAW_SESSION_TOKEN = `${TEST_PREFIX}-session-token`;

// Two guests used in dedup assertions
const USER_A = `${TEST_PREFIX}-user-a`;
const USER_B = `${TEST_PREFIX}-user-b`;

/**
 * SHA-256 base64url hash — mirrors hashOpaque() in venueManager.ts.
 */
function hashOpaque(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

/**
 * Replicates cookie-signature `sign(val, secret)`.
 * cookie-parser verifies cookies of the form `s:<val>.<mac>`.
 */
function signCookieValue(val: string, secret: string): string {
  const mac = createHmac("sha256", secret)
    .update(val)
    .digest("base64")
    .replace(/=+$/, "");
  return "s:" + val + "." + mac;
}

/** Cookie header value that cookie-parser will decode to RAW_SESSION_TOKEN. */
function sessionCookieHeader(): string {
  const signed = signCookieValue(RAW_SESSION_TOKEN, TEST_SESSION_SECRET);
  return `met_venue_manager=${encodeURIComponent(signed)}`;
}

/** Returns a Date N days before now. */
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Test fixture IDs — populated by seed()
// ---------------------------------------------------------------------------

let businessId = 0;

// ---------------------------------------------------------------------------
// Seed & cleanup
// ---------------------------------------------------------------------------

async function seed() {
  // 1. venueOwnerProfilesTable — required by businessWithProfile join
  const [profile] = await db
    .insert(venueOwnerProfilesTable)
    .values({
      ownerUid: TEST_OWNER_UID,
      placeId: TEST_PLACE_ID,
      placeName: "QR Dedup Test Venue",
      businessName: "QR Dedup Test Venue Ltd",
      applicationStatus: "approved",
      isApproved: true,
      isVerified: true,
    })
    .returning({ id: venueOwnerProfilesTable.id });

  // 2. venueBusinessesTable — the business the manager belongs to
  const [business] = await db
    .insert(venueBusinessesTable)
    .values({
      venueOwnerProfileId: profile!.id,
      placeId: TEST_PLACE_ID,
      legalName: "QR Dedup Test Venue Ltd",
      createdByUid: TEST_OWNER_UID,
      isActive: true,
    })
    .returning({ id: venueBusinessesTable.id });

  businessId = business!.id;

  // 3. venueManagersTable — credentials record (password not exercised)
  const [manager] = await db
    .insert(venueManagersTable)
    .values({
      email: TEST_MANAGER_EMAIL,
      passwordHash: "scrypt$dummy$dummy",
      displayName: "Integration Test Manager",
    })
    .returning({ id: venueManagersTable.id });

  // 4. venueManagerSessionsTable — pre-issued session tied to our cookie
  await db.insert(venueManagerSessionsTable).values({
    managerId: manager!.id,
    tokenHash: hashOpaque(RAW_SESSION_TOKEN),
    csrfTokenHash: hashOpaque("csrf-token-not-tested"),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
  });

  // 5. venueMembershipsTable — owner role so all dashboard data is visible
  await db.insert(venueMembershipsTable).values({
    businessId: business!.id,
    managerId: manager!.id,
    role: "owner",
    status: "active",
    acceptedAt: new Date(),
  });
}

async function cleanup() {
  await db
    .delete(venueQrVerificationsTable)
    .where(eq(venueQrVerificationsTable.placeId, TEST_PLACE_ID));

  // Membership, session, and manager rows share the manager email namespace —
  // delete in dependency order to satisfy FK-like relationships.
  const sessions = await db
    .select({ id: venueManagerSessionsTable.id })
    .from(venueManagerSessionsTable);
  const managers = await db
    .select({ id: venueManagersTable.id, email: venueManagersTable.email })
    .from(venueManagersTable)
    .where(eq(venueManagersTable.email, TEST_MANAGER_EMAIL));

  for (const m of managers) {
    await db
      .delete(venueMembershipsTable)
      .where(eq(venueMembershipsTable.managerId, m.id));
    for (const s of sessions) {
      // Only delete sessions belonging to this manager
      await db
        .delete(venueManagerSessionsTable)
        .where(eq(venueManagerSessionsTable.managerId, m.id));
    }
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

async function insertVerification(userUid: string, verifiedAt: Date) {
  await db.insert(venueQrVerificationsTable).values({
    userUid,
    placeId: TEST_PLACE_ID,
    verifiedAt,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasDatabase)(
  "GET /api/venue-manager/businesses/:id/dashboard — qrVerificationsToday dedup (real database)",
  () => {
    let app: Express;

    beforeAll(async () => {
      // Dynamic import so SESSION_SECRET is already set when cookie-parser
      // is initialised inside app.ts.
      app = (await import("../app")).default;
      await cleanup(); // ensure a clean slate before seeding
      await seed();
    });

    afterEach(async () => {
      // Remove verification rows between tests; keep auth fixtures intact.
      await db
        .delete(venueQrVerificationsTable)
        .where(eq(venueQrVerificationsTable.placeId, TEST_PLACE_ID));
    });

    // -----------------------------------------------------------------------
    // Test 1: same guest scans twice today → qrVerificationsToday = 1
    //
    // Two venue_qr_verifications rows exist for the same (userUid, placeId)
    // on today's date. COUNT(DISTINCT userUid) must deduplicate them and the
    // endpoint must report 1. If the query regressed to COUNT(*) this test
    // would receive 2 and fail.
    // -----------------------------------------------------------------------
    it("counts a guest who scanned twice today as 1, not 2", async () => {
      const now = new Date();
      await insertVerification(USER_A, now);
      await insertVerification(USER_A, new Date(now.getTime() + 5 * 60_000));

      const res = await request(app)
        .get(`/api/venue-manager/businesses/${businessId}/dashboard`)
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      expect(res.body.qrVerificationsToday).toBe(1);
    });

    // -----------------------------------------------------------------------
    // Test 2: two different guests scan today → count = 2
    //
    // Validates that DISTINCT is on userUid, not on all columns, so two unique
    // users are both counted.
    // -----------------------------------------------------------------------
    it("counts two different guests scanning today as 2", async () => {
      await insertVerification(USER_A, new Date());
      await insertVerification(USER_B, new Date());

      const res = await request(app)
        .get(`/api/venue-manager/businesses/${businessId}/dashboard`)
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      expect(res.body.qrVerificationsToday).toBe(2);
    });

    // -----------------------------------------------------------------------
    // Test 3: verification from yesterday → excluded from today's count
    //
    // The WHERE clause filters verifiedAt >= todayStart. Yesterday's row must
    // not inflate qrVerificationsToday.
    // -----------------------------------------------------------------------
    it("excludes verifications from previous days in the today count", async () => {
      await insertVerification(USER_A, daysAgo(1));  // yesterday — excluded
      await insertVerification(USER_B, new Date());  // today — included

      const res = await request(app)
        .get(`/api/venue-manager/businesses/${businessId}/dashboard`)
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      expect(res.body.qrVerificationsToday).toBe(1);
    });

    // -----------------------------------------------------------------------
    // Test 4: no verifications today → count = 0
    //
    // Ensures the endpoint returns 0 (not null/undefined) when no guest has
    // scanned today.
    // -----------------------------------------------------------------------
    it("returns 0 when no guest has scanned today", async () => {
      await insertVerification(USER_A, daysAgo(2)); // 2 days ago — excluded

      const res = await request(app)
        .get(`/api/venue-manager/businesses/${businessId}/dashboard`)
        .set("Cookie", sessionCookieHeader());

      expect(res.status).toBe(200);
      expect(res.body.qrVerificationsToday).toBe(0);
    });

    // -----------------------------------------------------------------------
    // Test 5: 7-day trend deduplicates per day
    //
    // USER_A scans twice on the same day within the 7-day window. The trend
    // entry for that day must show count = 1 (per-day DISTINCT). A row older
    // than 7 days must not appear in the trend at all.
    // -----------------------------------------------------------------------
    it(
      "7-day trend deduplicates multiple same-day scans and excludes rows outside the window",
      async () => {
        const threeDaysAgo = daysAgo(3);
        const eightDaysAgo = daysAgo(8); // outside 7-day window

        // Two scans by USER_A 3 days ago → per-day distinct = 1
        await insertVerification(USER_A, threeDaysAgo);
        await insertVerification(
          USER_A,
          new Date(threeDaysAgo.getTime() + 60_000),
        );
        // One scan by USER_B on the same day → that day's distinct count = 2
        await insertVerification(USER_B, threeDaysAgo);
        // Scan 8 days ago → outside the window, must not appear
        await insertVerification(USER_A, eightDaysAgo);

        const res = await request(app)
          .get(`/api/venue-manager/businesses/${businessId}/dashboard`)
          .set("Cookie", sessionCookieHeader());

        expect(res.status).toBe(200);

        const trend: Array<{ day: string; count: number }> =
          res.body.qrVerificationsTrend;

        // Only one calendar day should appear (the 8-days-ago row is excluded)
        expect(trend).toHaveLength(1);
        // That day must deduplicate USER_A's two scans, yielding 2 unique users
        expect(trend[0]?.count).toBe(2);
      },
    );
  },
);
