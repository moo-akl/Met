import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock handles — defined before vi.mock() factory runs.
// ---------------------------------------------------------------------------

const dbMocks = vi.hoisted(() => {
  const txChain = {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  };

  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(txChain)),
  };
  return { chain, txChain };
});

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  profilesTable: {},
  encountersTable: {},
  revealRequestsTable: {},
}));

vi.mock("../lib/firestoreMirror", () => ({
  mirrorProfileToFirestore: vi.fn().mockResolvedValue(undefined),
  mirrorRevealRequest: vi.fn().mockResolvedValue(undefined),
  mirrorRevealStatus: vi.fn().mockResolvedValue(undefined),
  recordSymmetricEncounter: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/firebaseAdmin", () => ({
  adminStorage: vi.fn(),
  adminAuth: vi.fn(),
  adminDb: vi.fn(),
  tryInitAdmin: vi.fn(() => null),
}));

// ---------------------------------------------------------------------------
// App — imported after mocks are registered so mocked modules are in place.
// ---------------------------------------------------------------------------

import request from "supertest";
import app from "../app";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const recipientFixture = {
  uid: "bob",
  uidHash: "hash-bob",
  displayName: "Bob Builder",
  photoUrl: null,
  bio: null,
  socials: {},
  isVisible: true,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
};

const revealFixture = {
  id: 1,
  senderUid: "alice",
  recipientUid: "bob",
  message: null,
  status: "pending",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
  respondedAt: null,
};

// ---------------------------------------------------------------------------
// Ensure no real Redis connection is attempted.
// ---------------------------------------------------------------------------

beforeAll(() => {
  delete process.env["REDIS_URL"];
});

beforeEach(() => {
  vi.clearAllMocks();
  // Restore chainable returns after clearAllMocks resets them.
  dbMocks.chain.select.mockReturnThis();
  dbMocks.chain.from.mockReturnThis();
  dbMocks.chain.where.mockReturnThis();
  dbMocks.chain.insert.mockReturnThis();
  dbMocks.chain.values.mockReturnThis();
  dbMocks.chain.onConflictDoUpdate.mockReturnThis();
  dbMocks.chain.update.mockReturnThis();
  dbMocks.chain.set.mockReturnThis();
  dbMocks.chain.transaction.mockImplementation(
    async (cb: (tx: unknown) => Promise<unknown>) => cb(dbMocks.txChain),
  );
  dbMocks.txChain.update.mockReturnThis();
  dbMocks.txChain.set.mockReturnThis();
  dbMocks.txChain.where.mockReturnThis();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function postRevealAs(uid: string, body: Record<string, unknown>) {
  return request(app)
    .post("/api/reveals")
    .set("x-met-uid", uid)
    .send(body);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/reveals", () => {
  describe("authentication", () => {
    it("returns 401 when no auth header or x-met-uid is provided", async () => {
      const res = await request(app)
        .post("/api/reveals")
        .send({ recipientUid: "bob" });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("message");
    });
  });

  describe("input validation", () => {
    it("returns 400 when recipientUid is missing from the body", async () => {
      const res = await postRevealAs("alice", {});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message");
    });

    it("returns 400 when the sender tries to send a reveal request to themselves", async () => {
      const res = await postRevealAs("alice", { recipientUid: "alice" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toMatch(/yourself/i);
    });

    it("returns 404 when the recipient profile does not exist", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([]);

      const res = await postRevealAs("alice", { recipientUid: "ghost" });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toMatch(/not found/i);
    });
  });

  describe("successful creation", () => {
    it("returns 200 with the reveal request and recipient profile on a valid request", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([recipientFixture]);
      dbMocks.chain.returning.mockResolvedValueOnce([revealFixture]);

      const res = await postRevealAs("alice", { recipientUid: "bob" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        senderUid: "alice",
        recipientUid: "bob",
        status: "pending",
      });
      expect(res.body).toHaveProperty("profile");
      expect(res.body.profile).toMatchObject({ uid: "bob", displayName: "Bob Builder" });
    });

    it("accepts an optional message in the reveal request", async () => {
      const revealWithMessage = { ...revealFixture, message: "Hey, we met at the conference!" };

      dbMocks.chain.limit.mockResolvedValueOnce([recipientFixture]);
      dbMocks.chain.returning.mockResolvedValueOnce([revealWithMessage]);

      const res = await postRevealAs("alice", {
        recipientUid: "bob",
        message: "Hey, we met at the conference!",
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Hey, we met at the conference!");
    });

    it("does not expose the respondedAt field as non-null for a new pending request", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([recipientFixture]);
      dbMocks.chain.returning.mockResolvedValueOnce([revealFixture]);

      const res = await postRevealAs("alice", { recipientUid: "bob" });

      expect(res.status).toBe(200);
      expect(res.body.respondedAt).toBeNull();
    });
  });

  describe("rate limiting (20 req/min per user)", () => {
    it("allows the first 20 requests and blocks the 21st with 429 and Retry-After", async () => {
      const uid = "uid-reveal-rl-test";

      // Every request: select finds recipient, insert returns the reveal row.
      dbMocks.chain.limit.mockResolvedValue([recipientFixture]);
      dbMocks.chain.returning.mockResolvedValue([revealFixture]);

      for (let i = 1; i <= 20; i++) {
        const res = await postRevealAs(uid, { recipientUid: `peer-${i}` });
        expect(res.status).toBe(200);
      }

      const blocked = await postRevealAs(uid, { recipientUid: "peer-21" });

      expect(blocked.status).toBe(429);
      expect(blocked.body).toHaveProperty("message");
      expect(blocked.body.message).toMatch(/too many requests/i);

      const retryAfter = Number(blocked.headers["retry-after"]);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/reveals/accept
// ---------------------------------------------------------------------------

describe("POST /api/reveals/accept", () => {
  describe("authentication", () => {
    it("returns 401 when no credentials are provided", async () => {
      const res = await request(app)
        .post("/api/reveals/accept")
        .send({ senderUid: "alice" });

      expect(res.status).toBe(401);
    });
  });

  describe("accept flow", () => {
    it("returns 404 when there is no pending request from the given sender", async () => {
      // Transaction inner call: forward update returns undefined (no row matched).
      dbMocks.txChain.returning.mockResolvedValueOnce([]);

      const res = await request(app)
        .post("/api/reveals/accept")
        .set("x-met-uid", "bob")
        .send({ senderUid: "alice" });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/no pending request/i);
    });

    it("returns 200 with the updated reveal row when accepted successfully", async () => {
      const acceptedReveal = { ...revealFixture, status: "accepted", respondedAt: new Date() };

      // First returning = forward update, second returning = reverse update (no-op).
      dbMocks.txChain.returning
        .mockResolvedValueOnce([acceptedReveal])
        .mockResolvedValueOnce([]);

      const res = await request(app)
        .post("/api/reveals/accept")
        .set("x-met-uid", "bob")
        .send({ senderUid: "alice" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("accepted");
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/reveals/decline
// ---------------------------------------------------------------------------

describe("POST /api/reveals/decline", () => {
  describe("authentication", () => {
    it("returns 401 when no credentials are provided", async () => {
      const res = await request(app)
        .post("/api/reveals/decline")
        .send({ senderUid: "alice" });

      expect(res.status).toBe(401);
    });
  });

  describe("decline flow", () => {
    it("returns 404 when there is no pending request from the given sender", async () => {
      dbMocks.chain.returning.mockResolvedValueOnce([]);

      const res = await request(app)
        .post("/api/reveals/decline")
        .set("x-met-uid", "bob")
        .send({ senderUid: "alice" });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/no pending request/i);
    });

    it("returns 200 with the declined reveal row", async () => {
      const declinedReveal = { ...revealFixture, status: "declined", respondedAt: new Date() };
      dbMocks.chain.returning.mockResolvedValueOnce([declinedReveal]);

      const res = await request(app)
        .post("/api/reveals/decline")
        .set("x-met-uid", "bob")
        .send({ senderUid: "alice" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("declined");
    });
  });
});
