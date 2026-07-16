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
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  return { chain };
});

const recalcMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  userReportsTable: {},
  userStatsTable: {},
  reviewsTable: {},
}));

vi.mock("../lib/reviewRecalc", () => ({
  recalcUserRating: recalcMock,
}));

vi.mock("../lib/firebaseAdmin", () => ({
  adminDb: vi.fn(() => ({
    collection: vi.fn(() => ({
      add: vi.fn().mockResolvedValue({ id: "firestore-doc-id" }),
    })),
  })),
  adminAuth: vi.fn(),
  adminStorage: vi.fn(),
  adminMessaging: vi.fn(),
  tryInitAdmin: vi.fn(() => null),
}));

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
  // The count query (select → from → where) terminates at .where() and is awaited
  // directly. The delete query (delete → where) also terminates at .where().
  // Use mockResolvedValueOnce for the first call (count) and mockResolvedValue
  // for the rest (delete and any others) so awaiting them gives sensible values.
  dbMocks.chain.where
    .mockResolvedValueOnce([{ total: 1 }]) // count query → 1 report so far
    .mockResolvedValue(undefined);          // delete + any other where
  dbMocks.chain.limit.mockResolvedValue([]);
  dbMocks.chain.delete.mockReturnThis();
  dbMocks.chain.insert.mockReturnThis();
  dbMocks.chain.values.mockReturnThis();
  dbMocks.chain.onConflictDoNothing.mockResolvedValue(undefined);
  dbMocks.chain.onConflictDoUpdate.mockResolvedValue(undefined);
  dbMocks.chain.update.mockReturnThis();
  dbMocks.chain.set.mockReturnThis();

  recalcMock.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const VALID_BODY = {
  encounterId: "enc-123",
  reportedUid: "bob",
  reason: "harassment",
};

describe("POST /api/reports — ghost-rating cleanup", () => {
  it("deletes reviews in both directions when reportedUid is provided", async () => {
    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", "Bearer test-token-alice")
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(dbMocks.chain.delete).toHaveBeenCalled();
  });

  it("recalculates ratings for both reporter and reported user after removing reviews", async () => {
    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", "Bearer test-token-alice")
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(recalcMock).toHaveBeenCalledTimes(2);
    expect(recalcMock).toHaveBeenCalledWith("alice");
    expect(recalcMock).toHaveBeenCalledWith("bob");
  });

  it("does NOT delete reviews or recalculate when reportedUid is absent", async () => {
    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", "Bearer test-token-alice")
      .send({ encounterId: "enc-456", reason: "spam" });

    expect(res.status).toBe(200);
    expect(dbMocks.chain.delete).not.toHaveBeenCalled();
    expect(recalcMock).not.toHaveBeenCalled();
  });

  it("still returns the Firestore id on success", async () => {
    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", "Bearer test-token-alice")
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", "firestore-doc-id");
  });

  it("returns 400 for an invalid reason value", async () => {
    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", "Bearer test-token-alice")
      .send({ encounterId: "enc-789", reason: "not-a-real-reason" });

    expect(res.status).toBe(400);
  });
});
