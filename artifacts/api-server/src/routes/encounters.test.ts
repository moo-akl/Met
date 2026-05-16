import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock handles — defined before vi.mock() factory runs.
// ---------------------------------------------------------------------------

const dbMocks = vi.hoisted(() => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  return { chain };
});

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  profilesTable: {},
  encountersTable: {},
  revealRequestsTable: {},
}));

vi.mock("../lib/firestoreMirror", () => ({
  mirrorProfileToFirestore: vi.fn().mockResolvedValue(undefined),
  recordSymmetricEncounter: vi.fn().mockResolvedValue({
    otherUid: "bob",
    metCount: 1,
    lastMet: new Date("2024-01-01T00:00:00Z"),
  }),
  mirrorRevealRequest: vi.fn().mockResolvedValue(undefined),
  mirrorRevealStatus: vi.fn().mockResolvedValue(undefined),
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

const encounterFixture = {
  id: 1,
  observerUid: "alice",
  observedUid: "bob",
  firstSeenAt: new Date("2024-01-01T00:00:00Z"),
  lastSeenAt: new Date("2024-01-01T00:00:00Z"),
  encounterCount: 1,
  lastRssi: null,
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
  dbMocks.chain.update.mockReturnThis();
  dbMocks.chain.set.mockReturnThis();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function postEncounterAs(uid: string, body: Record<string, unknown>) {
  return request(app)
    .post("/api/encounters")
    .set("x-met-uid", uid)
    .send(body);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/encounters", () => {
  describe("authentication", () => {
    it("returns 401 when no auth header or x-met-uid is provided", async () => {
      const res = await request(app)
        .post("/api/encounters")
        .send({ observedUid: "bob" });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("message");
    });
  });

  describe("input validation", () => {
    it("returns 400 when observedUid is missing from the body", async () => {
      const res = await postEncounterAs("alice", {});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message");
    });

    it("returns 400 when the caller tries to log an encounter with themselves", async () => {
      const res = await postEncounterAs("alice", { observedUid: "alice" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toMatch(/self/i);
    });
  });

  describe("successful creation", () => {
    it("returns 200 with the encounter row when a new encounter is created", async () => {
      // No existing encounter found → insert path.
      dbMocks.chain.limit.mockResolvedValueOnce([]);
      dbMocks.chain.returning.mockResolvedValueOnce([encounterFixture]);

      const res = await postEncounterAs("alice", { observedUid: "bob" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        observerUid: "alice",
        observedUid: "bob",
        encounterCount: 1,
      });
    });

    it("returns 200 and bumps encounterCount when the same pair meets again after the dedup window", async () => {
      // Existing encounter with a lastSeenAt far in the past (> 10 minutes).
      const oldEncounter = {
        ...encounterFixture,
        lastSeenAt: new Date(Date.now() - 15 * 60 * 1000),
        encounterCount: 1,
      };
      const updatedEncounter = { ...oldEncounter, encounterCount: 2 };

      dbMocks.chain.limit.mockResolvedValueOnce([oldEncounter]);
      dbMocks.chain.returning.mockResolvedValueOnce([updatedEncounter]);

      const res = await postEncounterAs("alice", { observedUid: "bob" });

      expect(res.status).toBe(200);
      expect(res.body.encounterCount).toBe(2);
    });

    it("returns 200 and does NOT bump encounterCount within the dedup window", async () => {
      // Existing encounter seen 2 minutes ago → still within the 10-minute window.
      const recentEncounter = {
        ...encounterFixture,
        lastSeenAt: new Date(Date.now() - 2 * 60 * 1000),
        encounterCount: 3,
      };
      const unchangedEncounter = { ...recentEncounter };

      dbMocks.chain.limit.mockResolvedValueOnce([recentEncounter]);
      dbMocks.chain.returning.mockResolvedValueOnce([unchangedEncounter]);

      const res = await postEncounterAs("alice", { observedUid: "bob" });

      expect(res.status).toBe(200);
      expect(res.body.encounterCount).toBe(3);
    });
  });

  describe("rate limiting (30 req/min per user)", () => {
    it("allows the first 30 requests and blocks the 31st with 429 and Retry-After", async () => {
      const uid = "uid-encounter-rl-test";

      // All selects return no existing encounter; all inserts return the fixture.
      dbMocks.chain.limit.mockResolvedValue([]);
      dbMocks.chain.returning.mockResolvedValue([encounterFixture]);

      for (let i = 1; i <= 30; i++) {
        const res = await postEncounterAs(uid, { observedUid: `peer-${i}` });
        expect(res.status).toBe(200);
      }

      const blocked = await postEncounterAs(uid, { observedUid: "peer-31" });

      expect(blocked.status).toBe(429);
      expect(blocked.body).toHaveProperty("message");
      expect(blocked.body.message).toMatch(/too many requests/i);

      const retryAfter = Number(blocked.headers["retry-after"]);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });
  });
});
