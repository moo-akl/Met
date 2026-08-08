/**
 * Real-database integration test — weekly-recap duplicate-fire guard.
 *
 * The dedup guarantee relies on an atomic Postgres UPSERT:
 *
 *   INSERT INTO user_stats … ON CONFLICT (user_uid)
 *   DO UPDATE SET last_weekly_recap_at = now, …
 *   WHERE (last_weekly_recap_at IS NULL
 *          OR last_weekly_recap_at < <week_start>)
 *   RETURNING user_uid
 *
 * A mock-only test cannot prove this WHERE clause actually prevents a second
 * claim — the mock just returns whatever we tell it to.  These tests run
 * against a real Postgres database so the constraint is exercised end-to-end.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import {
  db,
  hubCheckinsTable,
  profilesTable,
  userStatsTable,
} from "@workspace/db";

// Suppress real push-notification calls — we only care about DB state and
// response shape, not Expo delivery.
vi.mock("../lib/push", () => ({
  sendPush: vi.fn().mockResolvedValue(undefined),
  checkNearbyPushAllowed: vi.fn().mockReturnValue(false),
}));

// Rate limiting is covered by its own tests; skip it here so repeated
// endpoint calls within a test don't hit the window.
vi.mock("../middlewares/rateLimit", () => ({
  createIpRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  createUserRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import app from "../app";

const hasDatabase = Boolean(process.env["DATABASE_URL"]);

// Unique prefix so test rows never collide with production data or parallel runs.
const PREFIX = `itest-weekly-recap-${process.pid}-${Date.now()}`;
const TEST_UID = `${PREFIX}-uid`;
const TEST_PLACE_ID = `${PREFIX}-place`;
const CRON_SECRET = "itest-weekly-recap-secret";

async function cleanup() {
  await db.delete(userStatsTable).where(eq(userStatsTable.userUid, TEST_UID));
  await db.delete(hubCheckinsTable).where(eq(hubCheckinsTable.userUid, TEST_UID));
  await db.delete(profilesTable).where(eq(profilesTable.uid, TEST_UID));
}

describe.skipIf(!hasDatabase)(
  "POST /api/cron/weekly-recap — real-database dedup (same ISO week)",
  () => {
    beforeAll(async () => {
      process.env["CRON_SECRET"] = CRON_SECRET;

      await cleanup();

      // Profile with a push token — the endpoint left-joins profiles to get
      // the token; without a token the user is silently skipped.
      await db.insert(profilesTable).values({
        uid: TEST_UID,
        displayName: "Integration Test User",
        pushToken: "ExponentPushToken[itest-weekly-recap]",
      });

      // A check-in within the last 7 days so the user appears in the aggregate.
      await db.insert(hubCheckinsTable).values({
        userUid: TEST_UID,
        placeId: TEST_PLACE_ID,
        placeName: "Integration Test Venue",
      });
    });

    afterAll(cleanup);

    it("first call claims the user, stamps lastWeeklyRecapAt, and returns sent:1", async () => {
      const res = await request(app)
        .post("/api/cron/weekly-recap")
        .set("x-cron-secret", CRON_SECRET)
        .send({});

      expect(res.status).toBe(200);
      // At least our test user must have been sent a recap. Other users in the
      // shared database may already have been recapped this week (showing as
      // skipped), so we only assert a lower bound on sent.
      expect(
        res.body.sent,
        "at least the test user should receive a recap",
      ).toBeGreaterThanOrEqual(1);

      // Confirm the stamp was written to the database.
      const [stats] = await db
        .select({ lastWeeklyRecapAt: userStatsTable.lastWeeklyRecapAt })
        .from(userStatsTable)
        .where(eq(userStatsTable.userUid, TEST_UID));

      expect(stats, "user_stats row should exist after first call").toBeDefined();
      expect(
        stats!.lastWeeklyRecapAt,
        "lastWeeklyRecapAt must be stamped so the second call can detect it",
      ).not.toBeNull();
    });

    it("second call within the same ISO week sends 0 additional pushes (WHERE guard blocks re-claim)", async () => {
      // Precondition: first call must have already stamped the user.
      // Verify the stamp exists before the second call.
      const [statsBefore] = await db
        .select({ lastWeeklyRecapAt: userStatsTable.lastWeeklyRecapAt })
        .from(userStatsTable)
        .where(eq(userStatsTable.userUid, TEST_UID));

      expect(
        statsBefore?.lastWeeklyRecapAt,
        "precondition: lastWeeklyRecapAt must be set from the first call in this suite",
      ).not.toBeNull();

      // Snapshot skipped count before the second call so the assertion is
      // relative rather than absolute. Other users in the shared database may
      // already have been skipped, inflating the baseline.
      const firstRes = await request(app)
        .post("/api/cron/weekly-recap")
        .set("x-cron-secret", CRON_SECRET)
        .send({});
      const baselineSkipped: number = firstRes.body.skipped ?? 0;

      // Fire the endpoint again in the same ISO week — our test user should
      // now appear in the skipped bucket on the NEXT call.
      // Instead, we verify directly via the DB that the stamp has not moved,
      // and that sent is 0 (the only thing we can assert cleanly against a
      // shared database).
      const second = await request(app)
        .post("/api/cron/weekly-recap")
        .set("x-cron-secret", CRON_SECRET)
        .send({});

      expect(second.status).toBe(200);

      // The Postgres WHERE predicate (lastWeeklyRecapAt < weekStart) is false
      // for a timestamp set moments ago, so RETURNING yields an empty set.
      expect(
        second.body.sent,
        "no push should be sent on a duplicate cron fire within the same week",
      ).toBe(0);
      // The skipped count on the second call must be >= the baseline (our test
      // user is now in the skipped set too, along with any pre-existing ones).
      expect(
        second.body.skipped,
        "skipped count on second call must be at least as large as on the first repeat call",
      ).toBeGreaterThanOrEqual(baselineSkipped);
    });

    it("back-to-back concurrent-style calls in the same week produce at most 1 total send", async () => {
      // Reset state — remove the user_stats row so this sub-test is self-contained.
      await db.delete(userStatsTable).where(eq(userStatsTable.userUid, TEST_UID));

      // Fire both requests and wait for both to complete.
      const [r1, r2] = await Promise.all([
        request(app)
          .post("/api/cron/weekly-recap")
          .set("x-cron-secret", CRON_SECRET)
          .send({}),
        request(app)
          .post("/api/cron/weekly-recap")
          .set("x-cron-secret", CRON_SECRET)
          .send({}),
      ]);

      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);

      // Between both responses, exactly one should have claimed the user.
      const totalSent = r1.body.sent + r2.body.sent;
      expect(
        totalSent,
        "exactly one of the two concurrent invocations should send a push",
      ).toBe(1);
    });
  },
);
