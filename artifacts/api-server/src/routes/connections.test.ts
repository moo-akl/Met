import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted DB mock — must be defined before vi.mock() factory runs.
// ---------------------------------------------------------------------------

const dbMocks = vi.hoisted(() => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  return { chain };
});

const recalcMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mirrorMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  revealRequestsTable: {},
  reviewsTable: {},
  userStatsTable: {},
}));

vi.mock("../lib/reviewRecalc", () => ({
  recalcUserRating: recalcMock,
}));

vi.mock("../lib/firestoreMirror", () => ({
  mirrorConnectionRemoval: mirrorMock,
  mirrorProfileToFirestore: vi.fn().mockResolvedValue(undefined),
  mirrorRevealRequest: vi.fn().mockResolvedValue(undefined),
  mirrorRevealStatus: vi.fn().mockResolvedValue(undefined),
  recordSymmetricEncounter: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/firebaseAdmin", () => ({
  adminDb: vi.fn(),
  adminAuth: vi.fn(),
  adminStorage: vi.fn(),
  adminMessaging: vi.fn(),
  tryInitAdmin: vi.fn(() => null),
}));

vi.mock("../lib/push", () => ({
  sendPush: vi.fn().mockResolvedValue(undefined),
  checkNearbyPushAllowed: vi.fn().mockReturnValue(false),
}));

vi.mock("../lib/revenueCat", () => ({
  getVerifiedTier: vi.fn().mockResolvedValue("free"),
}));

// ---------------------------------------------------------------------------
// requireUid — always sets uid to "alice" in tests.
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
// App — imported after mocks are registered.
// ---------------------------------------------------------------------------

import request from "supertest";
import app from "../app";

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

  dbMocks.chain.select.mockReturnThis();
  dbMocks.chain.from.mockReturnThis();
  dbMocks.chain.where.mockReturnThis();
  dbMocks.chain.limit.mockResolvedValue([]);
  dbMocks.chain.delete.mockReturnThis();
  dbMocks.chain.insert.mockReturnThis();
  dbMocks.chain.values.mockReturnThis();
  dbMocks.chain.update.mockReturnThis();
  dbMocks.chain.set.mockReturnThis();

  recalcMock.mockResolvedValue(undefined);
  mirrorMock.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/connections/remove", () => {
  it("returns 400 when peerUid equals callerUid", async () => {
    const res = await request(app)
      .post("/api/connections/remove")
      .set("Authorization", "Bearer test-token-alice")
      .send({ peerUid: "alice" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Cannot remove yourself");
  });

  it("returns 400 when peerUid is missing", async () => {
    const res = await request(app)
      .post("/api/connections/remove")
      .set("Authorization", "Bearer test-token-alice")
      .send({});

    expect(res.status).toBe(400);
  });

  it("deletes reveal-request rows and returns success", async () => {
    const res = await request(app)
      .post("/api/connections/remove")
      .set("Authorization", "Bearer test-token-alice")
      .send({ peerUid: "bob" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    // db.delete() must have been called (at least once for reveal requests,
    // once for reviews — exact call count depends on chaining).
    expect(dbMocks.chain.delete).toHaveBeenCalled();
  });

  it("deletes reviews between the two users", async () => {
    const res = await request(app)
      .post("/api/connections/remove")
      .set("Authorization", "Bearer test-token-alice")
      .send({ peerUid: "bob" });

    expect(res.status).toBe(200);
    // db.delete() is called twice: once for reveal requests, once for reviews.
    expect(dbMocks.chain.delete).toHaveBeenCalledTimes(2);
  });

  it("recalculates ratings for both callerUid and peerUid after removing reviews", async () => {
    const res = await request(app)
      .post("/api/connections/remove")
      .set("Authorization", "Bearer test-token-alice")
      .send({ peerUid: "bob" });

    expect(res.status).toBe(200);
    expect(recalcMock).toHaveBeenCalledTimes(2);
    expect(recalcMock).toHaveBeenCalledWith("alice");
    expect(recalcMock).toHaveBeenCalledWith("bob");
  });

  it("mirrors the connection removal to Firestore", async () => {
    await request(app)
      .post("/api/connections/remove")
      .set("Authorization", "Bearer test-token-alice")
      .send({ peerUid: "bob" });

    expect(mirrorMock).toHaveBeenCalledWith({ uidA: "alice", uidB: "bob" });
  });

  it("is idempotent — still returns success when no review rows exist", async () => {
    // db.delete().where() resolving to empty is the default mock behaviour;
    // the route should not throw and must still return 200.
    const res = await request(app)
      .post("/api/connections/remove")
      .set("Authorization", "Bearer test-token-alice")
      .send({ peerUid: "charlie" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });
});

