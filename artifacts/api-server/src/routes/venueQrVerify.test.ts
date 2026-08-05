import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted DB mock — Drizzle chain with per-call overrides via mockResolvedValueOnce
// ---------------------------------------------------------------------------

const dbMocks = vi.hoisted(() => {
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: insertValues,
  };
  return { chain, insertValues };
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

function resetDbChain() {
  dbMocks.chain.select.mockReturnThis();
  dbMocks.chain.from.mockReturnThis();
  dbMocks.chain.where.mockReturnThis();
  dbMocks.chain.insert.mockReturnThis();
  dbMocks.chain.limit.mockResolvedValue([]);
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
    dbMocks.chain.limit.mockResolvedValueOnce([VENUE_ROW]);

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
    dbMocks.chain.limit.mockResolvedValueOnce([
      { id: 1, qrToken: VALID_TOKEN },
    ]);

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
    dbMocks.chain.limit.mockResolvedValueOnce([
      { id: 1, qrToken: NEW_TOKEN },
    ]);

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
    dbMocks.chain.limit.mockResolvedValueOnce([]);

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
