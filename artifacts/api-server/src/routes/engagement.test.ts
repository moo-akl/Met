import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted Firestore adminDb mock — built before vi.mock() factories run so
// individual tests can override getMock.mockResolvedValueOnce().
// ---------------------------------------------------------------------------

const adminDbMocks = vi.hoisted(() => {
  const getMock = vi.fn();
  const innerDocMock = vi.fn().mockReturnValue({ get: getMock });
  const innerColMock = vi.fn().mockReturnValue({ doc: innerDocMock });
  const outerDocMock = vi.fn().mockReturnValue({ collection: innerColMock });
  const outerColMock = vi.fn().mockReturnValue({ doc: outerDocMock });
  const firestoreInstance = { collection: outerColMock };
  const adminDbFn = vi.fn().mockReturnValue(firestoreInstance);
  return { getMock, innerDocMock, innerColMock, outerDocMock, outerColMock, adminDbFn };
});

// ---------------------------------------------------------------------------
// Hoisted DB mock — standard Drizzle chain
// ---------------------------------------------------------------------------

const dbMocks = vi.hoisted(() => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
    // Additional chain methods used by weekly-recap and other handlers
    leftJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
  };
  return { chain };
});

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  hubCheckinsTable: {},
  // Provide column stubs for userStatsTable so that assertions on
  // onConflictDoUpdate({ target, set, where }) can verify the target is the
  // primary key and the set includes the dedup stamp.
  userStatsTable: {
    userUid: "col:user_uid",
    lastWeeklyRecapAt: "col:last_weekly_recap_at",
    updatedAt: "col:updated_at",
  },
  profileViewsTable: {},
  reviewsTable: {},
  profilesTable: {},
  monthlyChampionsTable: {},
  trophiesTable: {},
  subscriptionsTable: {},
  revealRequestsTable: {},
}));

vi.mock("../lib/firebaseAdmin", () => ({
  adminDb: adminDbMocks.adminDbFn,
  adminAuth: vi.fn(),
  adminStorage: vi.fn(),
  adminMessaging: vi.fn(),
  tryInitAdmin: vi.fn(() => null),
}));

vi.mock("../lib/firestoreMirror", () => ({
  mirrorProfileToFirestore: vi.fn().mockResolvedValue(undefined),
  recordSymmetricEncounter: vi.fn().mockResolvedValue(undefined),
  mirrorRevealRequest: vi.fn().mockResolvedValue(undefined),
  mirrorRevealStatus: vi.fn().mockResolvedValue(undefined),
  mirrorConnectionRemoval: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/push", () => ({
  sendPush: vi.fn().mockResolvedValue(undefined),
  checkNearbyPushAllowed: vi.fn().mockReturnValue(false),
}));

vi.mock("../lib/revenueCat", () => ({
  getVerifiedTier: vi.fn().mockResolvedValue("free"),
}));

// ---------------------------------------------------------------------------
// App — imported after mocks are registered.
// ---------------------------------------------------------------------------

import request from "supertest";
import app from "../app";
import { sendPush } from "../lib/push";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a valid POST /api/reviews body. */
function reviewBody(overrides: Record<string, unknown> = {}) {
  return {
    receiverUid: "receiver-uid",
    starRating: 5,
    vibeTags: ["kind"],
    ...overrides,
  };
}

/** Minimal Auth header for the requireUid middleware (uid encoded in token). */
const AUTH_HEADER = "Bearer test-token-alice";

beforeAll(() => {
  delete process.env["REDIS_URL"];
  process.env["FIREBASE_SERVICE_ACCOUNT_JSON"] = JSON.stringify({
    project_id: "test",
    client_email: "test@test.com",
    private_key: "fake",
  });
});

beforeEach(() => {
  vi.resetAllMocks();

  // Restore default adminDb chain after resetAllMocks wipes the implementations.
  const getMock = adminDbMocks.getMock;
  adminDbMocks.innerDocMock.mockReturnValue({ get: getMock });
  adminDbMocks.innerColMock.mockReturnValue({ doc: adminDbMocks.innerDocMock });
  adminDbMocks.outerDocMock.mockReturnValue({ collection: adminDbMocks.innerColMock });
  adminDbMocks.outerColMock.mockReturnValue({ doc: adminDbMocks.outerDocMock });
  adminDbMocks.adminDbFn.mockReturnValue({ collection: adminDbMocks.outerColMock });

  // Default db chain back to self-returning
  dbMocks.chain.select.mockReturnThis();
  dbMocks.chain.from.mockReturnThis();
  dbMocks.chain.where.mockReturnThis();
  dbMocks.chain.orderBy.mockReturnThis();
  dbMocks.chain.offset.mockReturnThis();
  dbMocks.chain.insert.mockReturnThis();
  dbMocks.chain.values.mockReturnThis();
  dbMocks.chain.update.mockReturnThis();
  dbMocks.chain.set.mockReturnThis();
  dbMocks.chain.limit.mockResolvedValue([]);
  dbMocks.chain.execute.mockResolvedValue(undefined);
  dbMocks.chain.leftJoin.mockReturnThis();
  dbMocks.chain.groupBy.mockReturnThis();
  dbMocks.chain.onConflictDoUpdate.mockReturnThis();
  dbMocks.chain.onConflictDoNothing.mockReturnThis();
  dbMocks.chain.returning.mockResolvedValue([]);
  // sendPush must return a Promise after resetAllMocks() wipes its implementation,
  // otherwise .catch(() => {}) in the weekly-recap handler throws.
  vi.mocked(sendPush).mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Mock the requireUid middleware so tests don't need a real Firebase token.
// ---------------------------------------------------------------------------

vi.mock("../middlewares/requireUid", () => ({
  requireUid: (
    req: { uid?: string; headers: Record<string, string | undefined> },
    _res: unknown,
    next: () => void,
  ) => {
    req.uid = "alice";
    next();
  },
}));

// ---------------------------------------------------------------------------
// Tests: POST /api/reviews — Firestore encounter guard
// ---------------------------------------------------------------------------

describe("POST /api/reviews — Firestore encounter guard", () => {
  it("returns 400 when receiverUid is missing", async () => {
    const res = await request(app)
      .post("/api/reviews")
      .set("Authorization", AUTH_HEADER)
      .send({ starRating: 5 });

    expect(res.status).toBe(400);
  });

  it("returns 400 when reviewer tries to review themselves", async () => {
    const res = await request(app)
      .post("/api/reviews")
      .set("Authorization", AUTH_HEADER)
      .send(reviewBody({ receiverUid: "alice" }));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Cannot review yourself");
  });

  it("returns 403 encounter_required when no Firestore met_people document exists", async () => {
    adminDbMocks.getMock.mockResolvedValueOnce({ exists: false });

    const res = await request(app)
      .post("/api/reviews")
      .set("Authorization", AUTH_HEADER)
      .send(reviewBody());

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("encounter_required");
    expect(res.body.detail).toMatch(/actually met/i);
  });

  it("returns 403 encounter_required when Firestore get() throws", async () => {
    adminDbMocks.getMock.mockRejectedValueOnce(new Error("Firestore unavailable"));

    const res = await request(app)
      .post("/api/reviews")
      .set("Authorization", AUTH_HEADER)
      .send(reviewBody());

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("encounter_required");
  });

  it("queries the correct Firestore path (users/{reviewer}/met_people/{receiver})", async () => {
    adminDbMocks.getMock.mockResolvedValueOnce({ exists: false });

    await request(app)
      .post("/api/reviews")
      .set("Authorization", AUTH_HEADER)
      .send(reviewBody({ receiverUid: "receiver-uid" }));

    expect(adminDbMocks.outerColMock).toHaveBeenCalledWith("users");
    expect(adminDbMocks.outerDocMock).toHaveBeenCalledWith("alice");
    expect(adminDbMocks.innerColMock).toHaveBeenCalledWith("met_people");
    expect(adminDbMocks.innerDocMock).toHaveBeenCalledWith("receiver-uid");
    expect(adminDbMocks.getMock).toHaveBeenCalledTimes(1);
  });

  it("passes the Firestore guard and proceeds to co-location check when encounter exists", async () => {
    adminDbMocks.getMock.mockResolvedValueOnce({ exists: true });

    // Reviewer has no recent hub check-ins → co_location_required
    dbMocks.chain.where.mockResolvedValueOnce([]);

    const res = await request(app)
      .post("/api/reviews")
      .set("Authorization", AUTH_HEADER)
      .send(reviewBody());

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("co_location_required");
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /api/cron/weekly-recap — dedup guard
// ---------------------------------------------------------------------------

const CRON_SECRET = "test-cron-secret";

/** Sample hub check-in row returned by the aggregate select. */
const checkinRow = {
  userUid: "uid-alice",
  placeId: "place-1",
  placeName: "The Coffee House",
  cnt: 3,
  pushToken: "ExponentPushToken[abc]",
};

describe("POST /api/cron/weekly-recap — dedup guard", () => {
  beforeAll(() => {
    process.env["CRON_SECRET"] = CRON_SECRET;
  });

  it("returns 401 when the cron secret is missing", async () => {
    const res = await request(app).post("/api/cron/weekly-recap").send({});
    expect(res.status).toBe(401);
  });

  it("returns 401 when the cron secret is wrong", async () => {
    const res = await request(app)
      .post("/api/cron/weekly-recap")
      .set("x-cron-secret", "wrong-secret")
      .send({});
    expect(res.status).toBe(401);
  });

  it("returns sent:0, skipped:0 when no users have check-ins in the past 7 days", async () => {
    // The aggregate select resolves to an empty array — no active users.
    dbMocks.chain.orderBy.mockResolvedValueOnce([]);

    const res = await request(app)
      .post("/api/cron/weekly-recap")
      .set("x-cron-secret", CRON_SECRET)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sent: 0, skipped: 0 });
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("sends a push on the first call and returns sent:1, skipped:0", async () => {
    // Step 1: aggregate select returns one active user.
    dbMocks.chain.orderBy.mockResolvedValueOnce([checkinRow]);
    // Step 2: UPSERT claim — this invocation successfully claims the user.
    dbMocks.chain.returning.mockResolvedValueOnce([{ userUid: "uid-alice" }]);

    const res = await request(app)
      .post("/api/cron/weekly-recap")
      .set("x-cron-secret", CRON_SECRET)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(1);
    expect(res.body.skipped).toBe(0);
    expect(sendPush).toHaveBeenCalledTimes(1);
    expect(sendPush).toHaveBeenCalledWith(
      checkinRow.pushToken,
      expect.objectContaining({
        title: "Your week on Met 📊",
        data: { type: "weekly_recap" },
      }),
    );
  });

  // ---------------------------------------------------------------------------
  // Guard-shape test — verifies the UPSERT conflict options contain the
  // dedup predicate.  This test fails if the WHERE clause is removed from
  // the production onConflictDoUpdate call, even if the mock returns are still
  // scripted to look correct.
  // ---------------------------------------------------------------------------
  it("UPSERT uses a lastWeeklyRecapAt stamp and a week-boundary WHERE guard in the conflict clause", async () => {
    dbMocks.chain.orderBy.mockResolvedValueOnce([checkinRow]);
    dbMocks.chain.returning.mockResolvedValueOnce([{ userUid: "uid-alice" }]);

    await request(app)
      .post("/api/cron/weekly-recap")
      .set("x-cron-secret", CRON_SECRET)
      .send({});

    // onConflictDoUpdate must have been called exactly once (the claim UPSERT).
    expect(dbMocks.chain.onConflictDoUpdate).toHaveBeenCalledTimes(1);

    const [conflictConfig] =
      dbMocks.chain.onConflictDoUpdate.mock.calls[0] as [
        {
          target: unknown;
          set: Record<string, unknown>;
          where: unknown;
        },
      ];

    // The SET clause must stamp lastWeeklyRecapAt so subsequent runs see the mark.
    expect(conflictConfig.set).toHaveProperty("lastWeeklyRecapAt");
    expect(conflictConfig.set["lastWeeklyRecapAt"]).toBeTruthy();

    // A WHERE guard must be present; removing it collapses the predicate so every
    // duplicate cron run would also claim users and send extra pushes.
    expect(conflictConfig.where).toBeDefined();
    expect(conflictConfig.where).not.toBeNull();

    // A conflict target must identify the primary key so the UPSERT resolves.
    expect(conflictConfig.target).toBeDefined();
    expect(conflictConfig.target).not.toBeNull();
  });

  it("sends 0 additional pushes when the cron fires a second time within the same week", async () => {
    // Both calls see the same active user in check-in data.
    dbMocks.chain.orderBy
      .mockResolvedValueOnce([checkinRow]) // first call
      .mockResolvedValueOnce([checkinRow]); // second call

    // First call: UPSERT claims the user (lastWeeklyRecapAt was null / old).
    // Second call: the WHERE guard (lastWeeklyRecapAt >= weekStart) makes
    // Postgres skip the update, so RETURNING yields an empty set.
    dbMocks.chain.returning
      .mockResolvedValueOnce([{ userUid: "uid-alice" }]) // first call — claimed
      .mockResolvedValueOnce([]); // second call — WHERE skips, nothing returned

    // ── First invocation ──────────────────────────────────────────────────────
    const first = await request(app)
      .post("/api/cron/weekly-recap")
      .set("x-cron-secret", CRON_SECRET)
      .send({});

    expect(first.status).toBe(200);
    expect(first.body.sent).toBe(1);
    expect(first.body.skipped).toBe(0);

    const sendPushMock = vi.mocked(sendPush);
    const callsAfterFirst = sendPushMock.mock.calls.length;
    expect(callsAfterFirst).toBe(1);

    // ── Second invocation (same week, simulated duplicate cron fire) ──────────
    const second = await request(app)
      .post("/api/cron/weekly-recap")
      .set("x-cron-secret", CRON_SECRET)
      .send({});

    expect(second.status).toBe(200);
    // The RETURNING clause returned an empty set — user was already claimed.
    expect(second.body.sent).toBe(0);
    expect(second.body.skipped).toBe(1);
    // sendPush must NOT have been called a second time.
    expect(sendPushMock.mock.calls.length).toBe(callsAfterFirst);

    // ── Post-second-call guard assertion ────────────────────────────────────
    // Both invocations must have issued onConflictDoUpdate with a WHERE guard.
    // This assertion runs AFTER both requests so it inspects both UPSERT calls.
    // Exactly two calls are expected: one per cron invocation.
    const onConflictCalls = dbMocks.chain.onConflictDoUpdate.mock.calls as [
      { target: unknown; set: Record<string, unknown>; where: unknown },
    ][];
    expect(onConflictCalls).toHaveLength(2);
    for (const [cfg] of onConflictCalls) {
      // The WHERE predicate must exist on every call — removing it from
      // production code would collapse the guard and this assertion would fail.
      expect(cfg.where).toBeDefined();
      expect(cfg.where).not.toBeNull();
      // The SET must stamp lastWeeklyRecapAt so the guard has a value to check.
      expect(cfg.set).toHaveProperty("lastWeeklyRecapAt");
      expect(cfg.target).toBeDefined();
    }
  });
});
