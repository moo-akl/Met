import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted DB mock — Drizzle chain with per-call overrides via mockResolvedValueOnce
// ---------------------------------------------------------------------------

const dbMocks = vi.hoisted(() => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
  };
  return { chain };
});

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  hubCheckinsTable: {},
  userStatsTable: {},
  profileViewsTable: {},
  reviewsTable: {},
  profilesTable: {},
  monthlyChampionsTable: {},
  trophiesTable: {},
  subscriptionsTable: {},
  revealRequestsTable: {},
  venueOwnerProfilesTable: {},
  venueQrVerificationsTable: {},
}));

vi.mock("../lib/firebaseAdmin", () => ({
  adminDb: vi.fn(),
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

vi.mock("../middlewares/requireUid", () => ({
  requireUid: (
    req: { uid?: string; headers: Record<string, string | undefined> },
    _res: unknown,
    next: () => void,
  ) => {
    req.uid = "test-uid";
    next();
  },
}));

// ---------------------------------------------------------------------------
// App — imported after mocks are registered.
// ---------------------------------------------------------------------------

import request from "supertest";
import app from "../app";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLACE_ID = "ChIJregisteredVenue456";
const PLACE_NAME = "The Grand Hall";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

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

  // Restore chain defaults after resetAllMocks wipes them.
  dbMocks.chain.select.mockReturnThis();
  dbMocks.chain.from.mockReturnThis();
  dbMocks.chain.where.mockReturnThis();
  dbMocks.chain.orderBy.mockReturnThis();
  dbMocks.chain.offset.mockReturnThis();
  dbMocks.chain.insert.mockReturnThis();
  dbMocks.chain.values.mockResolvedValue(undefined);
  dbMocks.chain.update.mockReturnThis();
  dbMocks.chain.set.mockReturnThis();
  dbMocks.chain.limit.mockResolvedValue([]);
  dbMocks.chain.execute.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Tests: POST /api/hubs/checkin — QR gate for registered venues
// ---------------------------------------------------------------------------

describe("POST /api/hubs/checkin — registered venue QR gate", () => {
  // -------------------------------------------------------------------------
  // GPS-only arrival at a registered venue: presence is recorded but
  // leaderboard/streak credit must NOT be awarded until QR scan.
  // -------------------------------------------------------------------------
  it("returns 200 with streak_points:0 and isQrVerified:false when the user arrives at a registered venue without scanning the QR code", async () => {
    // DB call sequence for a registered-venue checkin without QR:
    //   1. Cooldown check (hubCheckinsTable)         → [] — no recent checkin
    //   2. registeredRow (venueOwnerProfilesTable)   → [{ id: 1 }] — approved venue
    //   3. qrRow (venueQrVerificationsTable)         → [] — not QR-verified
    //   4. statsRow (userStatsTable)                 → [] — no existing stats
    dbMocks.chain.limit
      .mockResolvedValueOnce([]) // 1. cooldown → allowed through
      .mockResolvedValueOnce([{ id: 1 }]) // 2. registeredRow → venue is approved
      .mockResolvedValueOnce([]) // 3. qrRow → not verified
      .mockResolvedValueOnce([]); // 4. statsRow → irrelevant (early return before this)

    const res = await request(app)
      .post("/api/hubs/checkin")
      .set("Authorization", "Bearer test-token")
      .send({ lat: 37.7749, lng: -122.4194, placeId: PLACE_ID, placeName: PLACE_NAME });

    // Presence is recorded but leaderboard credit is withheld.
    expect(res.status).toBe(200);
    expect(res.body.streak_points).toBe(0);
    expect(res.body.isQrVerified).toBe(false);
    expect(res.body.isRegisteredVenue).toBe(true);

    // userStatsTable must NOT be updated — streak is frozen until QR scan.
    expect(dbMocks.chain.update).not.toHaveBeenCalled();
    // Only the hub_checkins insert should have happened, not a user_stats insert.
    const valsCalls: unknown[][] = (dbMocks.chain.values as ReturnType<typeof vi.fn>).mock.calls;
    const statsInsert = valsCalls.find(
      (args) =>
        typeof args[0] === "object" &&
        args[0] !== null &&
        "hubStreaks" in (args[0] as Record<string, unknown>),
    );
    expect(statsInsert).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // After the user scans the QR code at a registered venue, the subsequent
  // /checkin call (now QR-verified) must award leaderboard/streak credit.
  // -------------------------------------------------------------------------
  it("updates user_stats with a non-zero streak when the user is QR-verified at a registered venue", async () => {
    // DB call sequence for a registered-venue checkin that IS QR-verified:
    //   1. Cooldown check (hubCheckinsTable)         → [] — no recent checkin
    //   2. registeredRow (venueOwnerProfilesTable)   → [{ id: 1 }] — approved venue
    //   3. qrRow (venueQrVerificationsTable)         → [{ verifiedAt }] — QR verified
    //   4. statsRow (userStatsTable)                 → [] — no existing stats → INSERT path
    //   5. prevCheckinRow (hubCheckinsTable, offset) → [] — first visit, streak = 1
    //   6. profilesTable (pioneer check)             → [] — not a pioneer
    const verifiedAt = new Date();
    dbMocks.chain.limit
      .mockResolvedValueOnce([]) // 1. cooldown → allowed through
      .mockResolvedValueOnce([{ id: 1 }]) // 2. registeredRow → approved venue
      .mockResolvedValueOnce([{ verifiedAt }]) // 3. qrRow → QR-verified
      .mockResolvedValueOnce([]) // 4. statsRow → no existing stats (INSERT path)
      .mockResolvedValueOnce([]) // 5. prevCheckinRow → first checkin, streak = 1
      .mockResolvedValueOnce([]); // 6. profilesTable → not pioneer

    const res = await request(app)
      .post("/api/hubs/checkin")
      .set("Authorization", "Bearer test-token")
      .send({ lat: 37.7749, lng: -122.4194, placeId: PLACE_ID, placeName: PLACE_NAME });

    expect(res.status).toBe(200);
    expect(res.body.isQrVerified).toBe(true);
    expect(res.body.streak_points).toBeGreaterThan(0);

    // user_stats must have been written with a non-zero streak for this venue.
    const valsCalls: unknown[][] = (dbMocks.chain.values as ReturnType<typeof vi.fn>).mock.calls;
    const statsInsert = valsCalls.find(
      (args) =>
        typeof args[0] === "object" &&
        args[0] !== null &&
        "hubStreaks" in (args[0] as Record<string, unknown>),
    );
    expect(statsInsert).toBeDefined();
    const insertedRow = statsInsert![0] as Record<string, unknown>;
    const hubStreaks = insertedRow["hubStreaks"] as Record<string, number>;
    expect(hubStreaks[PLACE_ID]).toBeGreaterThan(0);
  });
});
