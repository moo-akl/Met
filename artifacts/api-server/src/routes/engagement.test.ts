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
