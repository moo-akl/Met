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
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  };
  return { chain };
});

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  businessProfilesTable: {},
  businessEventsTable: {},
  businessReviewsTable: {},
  hubCheckinsTable: {},
  profilesTable: {},
}));

vi.mock("../lib/firebaseAdmin", () => ({
  adminAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockRejectedValue(new Error("no real token")),
  })),
  adminStorage: vi.fn(),
  adminDb: vi.fn(),
  adminMessaging: vi.fn(),
  tryInitAdmin: vi.fn(() => null),
}));

// ---------------------------------------------------------------------------
// App — imported after mocks are registered.
// ---------------------------------------------------------------------------

import request from "supertest";
import app from "../app";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OWNER_UID = "owner-alice";
const OTHER_UID = "other-bob";
const BIZ_ID = "biz-001";
const EVENT_ID = "42";

const bizFixture = {
  businessId: BIZ_ID,
  ownerId: OWNER_UID,
  placeId: "place-xyz",
  name: "Alice's Coffee",
};

const eventFixture = {
  eventId: 42,
  businessId: BIZ_ID,
  title: "Grand Opening",
  description: null,
  startTime: new Date("2030-06-01T10:00:00Z"),
  endTime: new Date("2030-06-01T12:00:00Z"),
};

const VALID_UPDATE_BODY = {
  title: "Grand Re-opening",
  startTime: "2030-06-01T10:00:00.000Z",
  endTime: "2030-06-01T13:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeAll(() => {
  delete process.env["REDIS_URL"];
});

beforeEach(() => {
  vi.resetAllMocks();

  dbMocks.chain.select.mockReturnThis();
  dbMocks.chain.from.mockReturnThis();
  dbMocks.chain.where.mockReturnThis();
  dbMocks.chain.limit.mockResolvedValue([]);
  dbMocks.chain.insert.mockReturnThis();
  dbMocks.chain.values.mockReturnThis();
  dbMocks.chain.returning.mockResolvedValue([]);
  dbMocks.chain.update.mockReturnThis();
  dbMocks.chain.set.mockReturnThis();
  dbMocks.chain.delete.mockReturnThis();
  dbMocks.chain.orderBy.mockReturnThis();
  dbMocks.chain.onConflictDoUpdate.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function putEventAs(uid: string | null, bizId: string, eventId: string, body: Record<string, unknown>) {
  const req = request(app)
    .put(`/api/business/${bizId}/events/${eventId}`)
    .send(body);
  if (uid !== null) {
    req.set("x-met-uid", uid);
  }
  return req;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PUT /api/business/:id/events/:eventId", () => {
  describe("authentication", () => {
    it("returns 401 when no auth header or x-met-uid is provided", async () => {
      const res = await request(app)
        .put(`/api/business/${BIZ_ID}/events/${EVENT_ID}`)
        .send(VALID_UPDATE_BODY);

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("message");
    });
  });

  describe("owner-only access", () => {
    it("returns 403 when the caller is not the business owner", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);

      const res = await putEventAs(OTHER_UID, BIZ_ID, EVENT_ID, VALID_UPDATE_BODY);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("message");
    });

    it("returns 404 when the business does not exist", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([]);

      const res = await putEventAs(OWNER_UID, BIZ_ID, EVENT_ID, VALID_UPDATE_BODY);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("message");
    });
  });

  describe("input validation", () => {
    it("returns 400 when endTime is before startTime", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);

      const res = await putEventAs(OWNER_UID, BIZ_ID, EVENT_ID, {
        startTime: "2030-06-01T12:00:00.000Z",
        endTime: "2030-06-01T10:00:00.000Z",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/endTime must be after startTime/i);
    });

    it("returns 400 when endTime equals startTime", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);

      const res = await putEventAs(OWNER_UID, BIZ_ID, EVENT_ID, {
        startTime: "2030-06-01T10:00:00.000Z",
        endTime: "2030-06-01T10:00:00.000Z",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/endTime must be after startTime/i);
    });

    it("returns 400 when no updatable fields are provided", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);

      const res = await putEventAs(OWNER_UID, BIZ_ID, EVENT_ID, {});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message");
    });

    it("returns 400 when the request body fails schema validation", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);

      const res = await putEventAs(OWNER_UID, BIZ_ID, EVENT_ID, {
        title: "",
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message");
    });
  });

  describe("event not found", () => {
    it("returns 404 when the event does not belong to this business", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);
      dbMocks.chain.returning.mockResolvedValueOnce([]);

      const res = await putEventAs(OWNER_UID, BIZ_ID, EVENT_ID, VALID_UPDATE_BODY);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("message");
    });
  });

  describe("happy path", () => {
    it("returns 200 with the updated event when all inputs are valid", async () => {
      const updatedEvent = { ...eventFixture, title: "Grand Re-opening" };

      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);
      dbMocks.chain.returning.mockResolvedValueOnce([updatedEvent]);

      const res = await putEventAs(OWNER_UID, BIZ_ID, EVENT_ID, VALID_UPDATE_BODY);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ title: "Grand Re-opening", businessId: BIZ_ID });
    });

    it("accepts a partial update with only a title change", async () => {
      const updatedEvent = { ...eventFixture, title: "New Title" };

      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);
      dbMocks.chain.returning.mockResolvedValueOnce([updatedEvent]);

      const res = await putEventAs(OWNER_UID, BIZ_ID, EVENT_ID, { title: "New Title" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ title: "New Title" });
    });

    it("calls db.update with the correct businessId and eventId filters", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);
      dbMocks.chain.returning.mockResolvedValueOnce([{ ...eventFixture, title: "Grand Re-opening" }]);

      await putEventAs(OWNER_UID, BIZ_ID, EVENT_ID, VALID_UPDATE_BODY);

      expect(dbMocks.chain.update).toHaveBeenCalled();
      expect(dbMocks.chain.set).toHaveBeenCalled();
      expect(dbMocks.chain.returning).toHaveBeenCalled();
    });
  });
});
