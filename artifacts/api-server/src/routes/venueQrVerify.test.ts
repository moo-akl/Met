import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted DB mock — Drizzle chain where every terminal method returns a
// "thenable chain": an object that is both awaitable (via .then()) AND has
// all builder methods so callers can keep chaining (e.g. .limit().offset()).
// ---------------------------------------------------------------------------

const dbMocks = vi.hoisted(() => {
  const insertValues = vi.fn().mockResolvedValue(undefined);

  /**
   * Creates a thenable result object that resolves to `value` when awaited,
   * and also exposes all Drizzle builder methods so callers can keep chaining
   * without hitting "property X is not a function" errors (e.g. .offset()).
   */
  function makeThenableResult(value: unknown[]): Record<string | symbol, unknown> {
    const r: Record<string | symbol, unknown> = {};
    r.then = (
      resolve: (v: unknown[]) => void,
      _reject?: (e: unknown) => void,
    ) => { resolve(value); };
    // All builder methods on the result just return the result itself so
    // further chaining resolves to the same value.
    for (const m of ["offset", "limit", "orderBy", "groupBy", "leftJoin", "where", "select", "from"]) {
      r[m] = () => r;
    }
    r[Symbol.iterator] = () => value[Symbol.iterator]();
    return r;
  }

  const chain: Record<string | symbol, unknown> = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    // limit() returns a thenable chain so callers can do .limit().offset().
    limit: vi.fn().mockImplementation(() => makeThenableResult([])),
    insert: vi.fn().mockReturnThis(),
    values: insertValues,
    leftJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue(undefined),
  };

  // Make the chain itself a thenable so that queries without a final .limit()
  // (e.g. the membership lookup in loadVenueAccess) also resolve to [] when
  // awaited, and are iterable in for..of loops.
  chain.then = (
    resolve: (v: unknown[]) => void,
    _reject?: (e: unknown) => void,
  ) => { resolve([]); };
  chain[Symbol.iterator] = () => [][Symbol.iterator]();

  return { chain, insertValues, makeThenableResult };
});

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  venueOwnerProfilesTable: {},
  venueQrVerificationsTable: {},
  hubCheckinsTable: {},
  userStatsTable: {},
  profileViewsTable: {},
  reviewsTable: {},
  profilesTable: {},
  monthlyChampionsTable: {},
  trophiesTable: {},
  subscriptionsTable: {},
  revealRequestsTable: {},
  venueMembershipsTable: {},
  venueBusinessesTable: {},
  venueEventsTable: {},
  venueEventRsvpsTable: {},
  venueRewardsTable: {},
  venueAnnouncementsTable: {},
  venueApplicationHistoryTable: {},
  venueAdminCredentialsTable: {},
  salesAgentsTable: {},
  venueManagersTable: {},
  venueManagerSessionsTable: {},
  venueManagerTokensTable: {},
  venueManagerRegistrationTokensTable: {},
  venueMembershipAuditTable: {},
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
    req.uid = "guest-uid";
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

const PLACE_ID = "ChIJtestplace123";
const VALID_TOKEN = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const OLD_TOKEN  = "b1ffcd00-1a2b-4f39-ac7e-7cc0ce491b22";
const NEW_TOKEN  = "c2aade11-2b3c-4e4a-bd8f-8dd1df502c33";

const VENUE_ROW = {
  id: 1,
  qrToken: VALID_TOKEN,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Queues a value that the next call to `limit()` will return.
 * Because limit() returns a makeThenableResult(), callers can still chain
 * .offset() on the result without hitting "not a function" errors.
 */
function mockNextLimit(value: unknown[]) {
  (dbMocks.chain.limit as ReturnType<typeof vi.fn>).mockImplementationOnce(
    () => dbMocks.makeThenableResult(value),
  );
}

function resetDbChain() {
  (dbMocks.chain.select as ReturnType<typeof vi.fn>).mockReturnThis();
  (dbMocks.chain.from as ReturnType<typeof vi.fn>).mockReturnThis();
  (dbMocks.chain.where as ReturnType<typeof vi.fn>).mockReturnThis();
  (dbMocks.chain.orderBy as ReturnType<typeof vi.fn>).mockReturnThis();
  (dbMocks.chain.offset as ReturnType<typeof vi.fn>).mockReturnThis();
  (dbMocks.chain.insert as ReturnType<typeof vi.fn>).mockReturnThis();
  (dbMocks.chain.leftJoin as ReturnType<typeof vi.fn>).mockReturnThis();
  (dbMocks.chain.groupBy as ReturnType<typeof vi.fn>).mockReturnThis();
  (dbMocks.chain.update as ReturnType<typeof vi.fn>).mockReturnThis();
  (dbMocks.chain.set as ReturnType<typeof vi.fn>).mockReturnThis();
  (dbMocks.chain.limit as ReturnType<typeof vi.fn>).mockImplementation(
    () => dbMocks.makeThenableResult([]),
  );
  (dbMocks.chain.returning as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (dbMocks.chain.execute as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  dbMocks.insertValues.mockResolvedValue(undefined);
}

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
  resetDbChain();
});

// ---------------------------------------------------------------------------
// Tests: POST /api/hubs/qr-verify
// ---------------------------------------------------------------------------

describe("POST /api/hubs/qr-verify — QR token gate", () => {
  // -----------------------------------------------------------------------
  // 200 — valid token matches the stored qrToken
  // -----------------------------------------------------------------------
  it("returns 200 and records a verification row when the token is valid", async () => {
    // DB returns the venue with a matching qrToken
    mockNextLimit([VENUE_ROW]);

    const res = await request(app)
      .post("/api/hubs/qr-verify")
      .set("Authorization", "Bearer test-token")
      .send({ placeId: PLACE_ID, token: VALID_TOKEN });

    expect(res.status).toBe(200);
    // Response now also carries the streak awarded by the qr-verify endpoint.
    expect(res.body).toEqual(expect.objectContaining({ verified: true }));

    // A verification row must have been inserted
    expect(dbMocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ userUid: "guest-uid", placeId: PLACE_ID }),
    );
  });

  // -----------------------------------------------------------------------
  // 403 — token supplied but does not match the stored qrToken
  // -----------------------------------------------------------------------
  it("returns 403 and does NOT insert a verification row when the token is wrong", async () => {
    // DB returns the venue, but the stored token differs from what the guest sent
    mockNextLimit([{ id: 1, qrToken: VALID_TOKEN }]);

    const res = await request(app)
      .post("/api/hubs/qr-verify")
      .set("Authorization", "Bearer test-token")
      .send({ placeId: PLACE_ID, token: "00000000-0000-0000-0000-000000000000" });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toMatch(/invalid qr/i);

    // No verification row should be inserted on rejection
    expect(dbMocks.insertValues).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 403 — replaying an old token after the venue owner has rotated the QR code
  // -----------------------------------------------------------------------
  it("returns 403 and does NOT insert a row when an old token is replayed after rotation", async () => {
    // After rotation the DB now holds NEW_TOKEN; the guest still has OLD_TOKEN
    mockNextLimit([{ id: 1, qrToken: NEW_TOKEN }]);

    const res = await request(app)
      .post("/api/hubs/qr-verify")
      .set("Authorization", "Bearer test-token")
      .send({ placeId: PLACE_ID, token: OLD_TOKEN });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/invalid qr/i);

    // Confirm no verification row was written for the stale token
    expect(dbMocks.insertValues).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 404 — placeId does not correspond to any approved venue
  // -----------------------------------------------------------------------
  it("returns 404 when no approved venue exists for the given placeId", async () => {
    // DB returns empty — no matching approved venue
    mockNextLimit([]);

    const res = await request(app)
      .post("/api/hubs/qr-verify")
      .set("Authorization", "Bearer test-token")
      .send({ placeId: "place-does-not-exist", token: VALID_TOKEN });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toMatch(/not found/i);

    // No verification row should be inserted when the venue is missing
    expect(dbMocks.insertValues).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 400 — malformed request body (missing fields)
  // -----------------------------------------------------------------------
  it("returns 400 when placeId or token are missing", async () => {
    const res = await request(app)
      .post("/api/hubs/qr-verify")
      .set("Authorization", "Bearer test-token")
      .send({ placeId: PLACE_ID }); // token missing

    expect(res.status).toBe(400);
    expect(dbMocks.insertValues).not.toHaveBeenCalled();
  });

  it("returns 400 when the token is not a valid UUID", async () => {
    const res = await request(app)
      .post("/api/hubs/qr-verify")
      .set("Authorization", "Bearer test-token")
      .send({ placeId: PLACE_ID, token: "not-a-uuid" });

    expect(res.status).toBe(400);
    expect(dbMocks.insertValues).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: hub_checkins row recording via POST /api/hubs/qr-verify
// ---------------------------------------------------------------------------

describe("POST /api/hubs/qr-verify — hub_checkins row recording", () => {
  // -----------------------------------------------------------------------
  // Valid token + no recent checkin → hub_checkins row must be inserted
  // -----------------------------------------------------------------------
  it("inserts a hub_checkins row when the token is valid and no recent checkin exists", async () => {
    // Sequence of limit() calls inside qr-verify handler:
    //   1. venue lookup → VENUE_ROW
    //   2. recent hub_checkins check → [] (none → triggers hub_checkins insert)
    //   3 & 4. streak queries (statsRow + prevCheckinRow) → []
    mockNextLimit([VENUE_ROW]); // venue lookup
    mockNextLimit([]);           // recent hub_checkins check → none
    mockNextLimit([]);           // streak: statsRow
    mockNextLimit([]);           // streak: prevCheckinRow

    const res = await request(app)
      .post("/api/hubs/qr-verify")
      .set("Authorization", "Bearer test-token")
      .send({ placeId: PLACE_ID, token: VALID_TOKEN });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ verified: true });

    // insertValues is called for:
    //   1) venueQrVerificationsTable
    //   2) hubCheckinsTable   ← the key assertion for this test
    //   3) userStatsTable (no existing stats row)
    expect(dbMocks.insertValues).toHaveBeenCalledTimes(3);
    // The second insert is the hub_checkins row.
    expect(dbMocks.insertValues).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ userUid: "guest-uid", placeId: PLACE_ID }),
    );
  });

  // -----------------------------------------------------------------------
  // Valid token but a recent hub_checkins row already exists → no duplicate
  // -----------------------------------------------------------------------
  it("does NOT insert a duplicate hub_checkins row when one already exists within 4 hours", async () => {
    mockNextLimit([VENUE_ROW]);    // venue lookup
    mockNextLimit([{ id: 99 }]);   // recent hub_checkins → exists (skips insert)

    const res = await request(app)
      .post("/api/hubs/qr-verify")
      .set("Authorization", "Bearer test-token")
      .send({ placeId: PLACE_ID, token: VALID_TOKEN });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ verified: true });

    // Only the venueQrVerificationsTable insert fires; the hub_checkins insert
    // is suppressed because a recent row already exists.
    // venueQrVerifications insert has exactly {userUid, placeId} (2 keys).
    // hub_checkins insert would have the same shape — check that there is at
    // most one such bare call (i.e. the dedup guard worked).
    const allCalls = (dbMocks.insertValues as ReturnType<typeof vi.fn>).mock.calls as
      [Record<string, unknown>][];
    const bareCheckinCalls = allCalls.filter(
      ([arg]) =>
        arg &&
        typeof arg === "object" &&
        arg["userUid"] === "guest-uid" &&
        arg["placeId"] === PLACE_ID &&
        Object.keys(arg).length === 2,
    );
    expect(bareCheckinCalls).toHaveLength(1); // verification row only
  });

  // -----------------------------------------------------------------------
  // Wrong token → 403 and NO hub_checkins row inserted
  // -----------------------------------------------------------------------
  it("returns 403 and does NOT insert a hub_checkins row when the token is wrong", async () => {
    mockNextLimit([VENUE_ROW]); // venue has VALID_TOKEN; guest sends wrong token

    const res = await request(app)
      .post("/api/hubs/qr-verify")
      .set("Authorization", "Bearer test-token")
      .send({ placeId: PLACE_ID, token: "00000000-0000-0000-0000-000000000000" });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/invalid qr/i);

    // Token mismatch must abort before any DB insert fires.
    expect(dbMocks.insertValues).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Missing token → 400 and NO hub_checkins row inserted
  // -----------------------------------------------------------------------
  it("returns 400 and does NOT insert a hub_checkins row when the token is absent", async () => {
    const res = await request(app)
      .post("/api/hubs/qr-verify")
      .set("Authorization", "Bearer test-token")
      .send({ placeId: PLACE_ID }); // token omitted

    expect(res.status).toBe(400);
    expect(dbMocks.insertValues).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /api/venue-owner/me/guests — leaderboard after QR check-in
// ---------------------------------------------------------------------------

const OWNER_PROFILE_ROW = {
  id: 1,
  placeId: PLACE_ID,
  ownerUid: "guest-uid",
  businessName: "Test Venue",
  placeName: "Test Place",
  isApproved: true,
  applicationStatus: "approved",
  isVerified: false,
  lat: "0",
  lng: "0",
  tagline: null,
  description: null,
  qrToken: VALID_TOKEN,
  coverPhotoUrl: null,
  logoUrl: null,
  phone: null,
  websiteUrl: null,
  publicEmail: null,
  openingHours: null,
  approvedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const GUEST_ROW = {
  uid: "checked-in-guest",
  displayName: "Happy Guest",
  photoUrl: null,
  bio: null,
  interests: [],
  isPioneer: false,
  checkinCount: 2,
  lastCheckinAt: new Date().toISOString(),
};

describe("GET /api/venue-owner/me/guests — leaderboard after QR check-in", () => {
  // -----------------------------------------------------------------------
  // Owner with legacy access sees checked-in guests with their checkinCount
  // -----------------------------------------------------------------------
  it("returns guests with checkinCount ≥ 1 for the owner's venue", async () => {
    // loadVenueAccess:
    //   - venueMembershipsTable query (no .limit()) → chain.then → [] (no memberships)
    //   - Legacy venueOwnerProfilesTable query → limit(1) → owner profile
    // Guests list query:
    //   - .leftJoin().where().groupBy().orderBy().limit(30).offset(0) → [GUEST_ROW]
    //     (limit() returns a thenable; .offset() on thenable returns same thenable)
    // Total count query (no .limit()) → chain.then → [] → total: 0
    mockNextLimit([OWNER_PROFILE_ROW]); // legacy profile lookup
    mockNextLimit([GUEST_ROW]);          // guests list (limit(30) call)

    const res = await request(app)
      .get("/api/venue-owner/me/guests")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("guests");
    expect(Array.isArray(res.body.guests)).toBe(true);
    expect(res.body.guests).toHaveLength(1);

    const guest = res.body.guests[0];
    expect(guest.uid).toBe("checked-in-guest");
    expect(guest.displayName).toBe("Happy Guest");
    expect(guest.checkinCount).toBeGreaterThanOrEqual(1);
    expect(guest.rank).toBe(1);
  });

  // -----------------------------------------------------------------------
  // Venue with no check-ins returns an empty guest list
  // -----------------------------------------------------------------------
  it("returns an empty guest list when no one has checked in", async () => {
    mockNextLimit([OWNER_PROFILE_ROW]); // legacy profile lookup
    mockNextLimit([]);                   // guests list → empty

    const res = await request(app)
      .get("/api/venue-owner/me/guests")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.guests).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  // -----------------------------------------------------------------------
  // No approved profile for the uid → 403
  // -----------------------------------------------------------------------
  it("returns 403 when the caller has no active venue membership or approved profile", async () => {
    // Memberships → [] (via chain.then), legacy profile lookup → []
    mockNextLimit([]); // legacy profile lookup → none

    const res = await request(app)
      .get("/api/venue-owner/me/guests")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(403);
  });
});
