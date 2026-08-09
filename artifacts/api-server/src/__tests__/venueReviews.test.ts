/**
 * Integration tests for venue review routes introduced alongside venueReviewsTable.
 *
 * Coverage:
 *  1. POST /api/hubs/:placeId/review without a prior QR scan → 403
 *  2. POST /api/hubs/:placeId/review with a QR scan → 200, review persisted
 *  3. A second POST upserts (updates) the existing row in place
 *  4. GET /api/hubs/:placeId/reviews returns review list + correct averageRating
 *  5. GET /api/hubs/:placeId/my-review returns the caller's review or null
 *
 * Tests skip automatically when DATABASE_URL is absent.
 * Auth: non-production X-Met-Uid header is used to bypass Firebase token
 * verification (requireUid accepts this in NODE_ENV != production).
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { and, eq } from "drizzle-orm";
import {
  db,
  profilesTable,
  venueQrVerificationsTable,
  venueReviewsTable,
} from "@workspace/db";
import type { Express } from "express";

// ---------------------------------------------------------------------------
// Must be set before any app import so session middleware initialises.
// ---------------------------------------------------------------------------
process.env["SESSION_SECRET"] = "itest-venue-reviews-secret";

// ---------------------------------------------------------------------------
// Mocks — silence noisy middleware and external calls.
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

vi.mock("../lib/push", () => ({ sendPush: vi.fn() }));

vi.mock("../lib/firebaseAdmin", () => ({
  adminAuth: () => ({
    verifyIdToken: vi
      .fn()
      .mockRejectedValue(new Error("not used in these tests")),
  }),
  adminDb: { collection: vi.fn() },
  adminStorage: {},
}));

vi.mock("../lib/objectStorage", () => ({ ObjectStorageService: class {} }));

vi.mock("../lib/email.js", () => ({
  sendVenueApprovedEmail: vi.fn(),
  sendVenueRejectedEmail: vi.fn(),
  sendVenueChangesRequestedEmail: vi.fn(),
  sendRegistrationLinkEmail: vi.fn(),
  sendClaimLinkOverdueAlertEmail: vi.fn(),
}));

vi.mock("../lib/revenueCat", () => ({
  getVerifiedTier: vi.fn().mockResolvedValue("free"),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const hasDatabase = Boolean(process.env["DATABASE_URL"]);

const TP = `itestvr-${process.pid}`;
const PLACE_ID = `${TP}-place`;
const USER_UID = `${TP}-user`;
const USER2_UID = `${TP}-user2`;
const UNVERIFIED_UID = `${TP}-unverified`;

/** Non-production auth bypass — requireUid accepts X-Met-Uid directly. */
function uid(u: string) {
  return { "X-Met-Uid": u };
}

// ---------------------------------------------------------------------------
// Seed & cleanup
// ---------------------------------------------------------------------------

async function seed() {
  // Minimal profile rows for users that submit reviews (the GET /reviews
  // route inner-joins profilesTable to attach displayName + photoUrl).
  for (const u of [USER_UID, USER2_UID, UNVERIFIED_UID]) {
    await db
      .insert(profilesTable)
      .values({ uid: u, displayName: `Test ${u}` })
      .onConflictDoNothing();
  }

  // Grant QR verification for USER_UID and USER2_UID only; UNVERIFIED_UID
  // intentionally has no row so POST should return 403 for them.
  await db.insert(venueQrVerificationsTable).values([
    { userUid: USER_UID, placeId: PLACE_ID },
    { userUid: USER2_UID, placeId: PLACE_ID },
  ]);
}

async function cleanup() {
  await db
    .delete(venueReviewsTable)
    .where(eq(venueReviewsTable.placeId, PLACE_ID));
  await db
    .delete(venueQrVerificationsTable)
    .where(eq(venueQrVerificationsTable.placeId, PLACE_ID));
  for (const u of [USER_UID, USER2_UID, UNVERIFIED_UID]) {
    await db.delete(profilesTable).where(eq(profilesTable.uid, u));
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasDatabase)(
  "venue reviews — POST/GET /api/hubs/:placeId/review(s) (real database)",
  () => {
    let app: Express;

    beforeAll(async () => {
      app = (await import("../app")).default;
      await cleanup();
      await seed();
    });

    afterAll(async () => {
      await cleanup();
    });

    // -----------------------------------------------------------------------
    // 1. POST without a QR scan → 403
    // -----------------------------------------------------------------------
    it("returns 403 when the caller has no QR verification for the venue", async () => {
      const res = await request(app)
        .post(`/api/hubs/${PLACE_ID}/review`)
        .set(uid(UNVERIFIED_UID))
        .send({ starRating: 4 });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/QR/i);
    });

    // -----------------------------------------------------------------------
    // 2. POST with a QR scan → 200, review persisted
    // -----------------------------------------------------------------------
    it("returns 200 and persists the review when the caller has a QR verification", async () => {
      const res = await request(app)
        .post(`/api/hubs/${PLACE_ID}/review`)
        .set(uid(USER_UID))
        .send({ starRating: 5, comment: "Amazing place!" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("review");
      expect(res.body.review.starRating).toBe(5);
      expect(res.body.review.comment).toBe("Amazing place!");
      expect(res.body.review.userUid).toBe(USER_UID);
      expect(res.body.review.placeId).toBe(PLACE_ID);

      // Verify it was written to the database.
      const [row] = await db
        .select()
        .from(venueReviewsTable)
        .where(
          and(
            eq(venueReviewsTable.userUid, USER_UID),
            eq(venueReviewsTable.placeId, PLACE_ID),
          ),
        )
        .limit(1);

      expect(row).toBeDefined();
      expect(row!.starRating).toBe(5);
      expect(row!.comment).toBe("Amazing place!");
    });

    // -----------------------------------------------------------------------
    // 3. Second POST upserts (updates) the existing row
    // -----------------------------------------------------------------------
    it("updates the existing review on a second submission (UPSERT)", async () => {
      // USER_UID already has a review from test #2.
      const res = await request(app)
        .post(`/api/hubs/${PLACE_ID}/review`)
        .set(uid(USER_UID))
        .send({ starRating: 3, comment: "Changed my mind." });

      expect(res.status).toBe(200);
      expect(res.body.review.starRating).toBe(3);
      expect(res.body.review.comment).toBe("Changed my mind.");

      // Only one row should exist for this (user, place) pair.
      const rows = await db
        .select()
        .from(venueReviewsTable)
        .where(
          and(
            eq(venueReviewsTable.userUid, USER_UID),
            eq(venueReviewsTable.placeId, PLACE_ID),
          ),
        );

      expect(rows).toHaveLength(1);
      expect(rows[0]!.starRating).toBe(3);
    });

    // -----------------------------------------------------------------------
    // 4. GET /reviews returns the list + correct averageRating
    // -----------------------------------------------------------------------
    it("GET /reviews returns all reviews and a correct averageRating", async () => {
      // Submit a second reviewer's rating so we can verify the average math.
      await request(app)
        .post(`/api/hubs/${PLACE_ID}/review`)
        .set(uid(USER2_UID))
        .send({ starRating: 5 });

      // USER_UID: 3 stars (from upsert test), USER2_UID: 5 stars → avg = 4.0
      const res = await request(app)
        .get(`/api/hubs/${PLACE_ID}/reviews`)
        .set(uid(USER_UID));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("reviews");
      expect(res.body).toHaveProperty("averageRating");
      expect(res.body).toHaveProperty("total");

      const { reviews, averageRating, total } = res.body as {
        reviews: { starRating: number; displayName: string }[];
        averageRating: number;
        total: number;
      };

      expect(total).toBe(2);
      expect(reviews).toHaveLength(2);

      // Every review must include displayName (from the profile join).
      for (const r of reviews) {
        expect(r).toHaveProperty("displayName");
      }

      // Average: (3 + 5) / 2 = 4.0 — rounded to 1 decimal place.
      expect(averageRating).toBe(4.0);
    });

    // -----------------------------------------------------------------------
    // 5a. GET /my-review returns the caller's own review
    // -----------------------------------------------------------------------
    it("GET /my-review returns the caller's own review", async () => {
      const res = await request(app)
        .get(`/api/hubs/${PLACE_ID}/my-review`)
        .set(uid(USER_UID));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("review");
      expect(res.body.review).not.toBeNull();
      expect(res.body.review.starRating).toBe(3);
      expect(res.body.review.userUid).toBe(USER_UID);
    });

    // -----------------------------------------------------------------------
    // 5b. GET /my-review returns null when the caller has no review
    // -----------------------------------------------------------------------
    it("GET /my-review returns null when the caller has not submitted a review", async () => {
      const res = await request(app)
        .get(`/api/hubs/${PLACE_ID}/my-review`)
        .set(uid(UNVERIFIED_UID));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("review");
      expect(res.body.review).toBeNull();
    });

    // -----------------------------------------------------------------------
    // 6. POST validates the body — starRating must be 1–5
    // -----------------------------------------------------------------------
    it("returns 400 when starRating is out of range", async () => {
      const res = await request(app)
        .post(`/api/hubs/${PLACE_ID}/review`)
        .set(uid(USER_UID))
        .send({ starRating: 6 });

      expect(res.status).toBe(400);
    });

    // -----------------------------------------------------------------------
    // 7. Aggregate stats cover ALL reviews even when list is capped at 20
    // -----------------------------------------------------------------------
    it("returns venue-wide total and averageRating even when there are more than 20 reviews", async () => {
      // Seed 25 extra profiles + QR verifications + reviews (all 5-star)
      // for a separate place so other tests are not affected.
      const MANY_PLACE = `${TP}-many`;
      const extraUids = Array.from({ length: 25 }, (_, i) => `${TP}-extra${i}`);

      try {
        // Insert profiles
        for (const u of extraUids) {
          await db
            .insert(profilesTable)
            .values({ uid: u, displayName: `Extra ${u}` })
            .onConflictDoNothing();
        }
        // Insert QR verifications
        await db.insert(venueQrVerificationsTable).values(
          extraUids.map((u) => ({ userUid: u, placeId: MANY_PLACE })),
        );
        // Insert reviews with a mix of ratings: first 20 are 5-star, last 5 are 1-star
        // This lets us check that the average covers all 25, not just the 20 returned.
        await db.insert(venueReviewsTable).values(
          extraUids.map((u, i) => ({
            userUid: u,
            placeId: MANY_PLACE,
            starRating: i < 20 ? 5 : 1,
            comment: null,
          })),
        );

        const res = await request(app)
          .get(`/api/hubs/${MANY_PLACE}/reviews`)
          .set(uid(USER_UID));

        expect(res.status).toBe(200);

        const { reviews, averageRating, total } = res.body as {
          reviews: unknown[];
          averageRating: number;
          total: number;
        };

        // total must reflect all 25 reviews
        expect(total).toBe(25);
        // list must be capped at 20
        expect(reviews.length).toBe(20);
        // average: (20×5 + 5×1) / 25 = 105/25 = 4.2
        expect(averageRating).toBe(4.2);
      } finally {
        // Cleanup
        await db
          .delete(venueReviewsTable)
          .where(eq(venueReviewsTable.placeId, MANY_PLACE));
        await db
          .delete(venueQrVerificationsTable)
          .where(eq(venueQrVerificationsTable.placeId, MANY_PLACE));
        for (const u of extraUids) {
          await db.delete(profilesTable).where(eq(profilesTable.uid, u));
        }
      }
    });
  },
);
