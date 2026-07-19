import { vi, describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";

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
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  };
  return { chain };
});

// ---------------------------------------------------------------------------
// Hoisted gte spy — allows us to assert what cutoff Date was passed to queries.
// We hold a reference to the real gte so we can restore it after resetAllMocks.
// ---------------------------------------------------------------------------

const { gteSpy, realGteHolder } = vi.hoisted(() => {
  const realGteHolder: { fn: ((...args: unknown[]) => unknown) | undefined } = { fn: undefined };
  const gteSpy = vi.fn((...args: unknown[]) => realGteHolder.fn?.(...args));
  return { gteSpy, realGteHolder };
});

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  realGteHolder.fn = actual.gte as (...args: unknown[]) => unknown;
  return { ...actual, gte: gteSpy };
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
  dbMocks.chain.groupBy.mockReturnThis();
  dbMocks.chain.orderBy.mockReturnThis();
  dbMocks.chain.onConflictDoUpdate.mockResolvedValue(undefined);

  // Restore gte call-through after vi.resetAllMocks() clears the implementation.
  gteSpy.mockImplementation((...args: unknown[]) => realGteHolder.fn?.(...args));
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function postEventAs(uid: string | null, bizId: string, body: Record<string, unknown>) {
  const req = request(app)
    .post(`/api/business/${bizId}/events`)
    .send(body);
  if (uid !== null) {
    req.set("x-met-uid", uid);
  }
  return req;
}

function putEventAs(uid: string | null, bizId: string, eventId: string, body: Record<string, unknown>) {
  const req = request(app)
    .put(`/api/business/${bizId}/events/${eventId}`)
    .send(body);
  if (uid !== null) {
    req.set("x-met-uid", uid);
  }
  return req;
}

const VALID_CREATE_BODY = {
  title: "Grand Opening",
  startTime: "2030-06-01T10:00:00.000Z",
  endTime: "2030-06-01T12:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/business/:id/events", () => {
  describe("authentication", () => {
    it("returns 401 when no auth header or x-met-uid is provided", async () => {
      const res = await request(app)
        .post(`/api/business/${BIZ_ID}/events`)
        .send(VALID_CREATE_BODY);

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("message");
    });
  });

  describe("owner-only access", () => {
    it("returns 403 when the caller is not the business owner", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);

      const res = await postEventAs(OTHER_UID, BIZ_ID, VALID_CREATE_BODY);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("message");
    });

    it("returns 404 when the business does not exist", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([]);

      const res = await postEventAs(OWNER_UID, BIZ_ID, VALID_CREATE_BODY);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("message");
    });
  });

  describe("input validation", () => {
    it("returns 400 when endTime is before startTime", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);

      const res = await postEventAs(OWNER_UID, BIZ_ID, {
        title: "Bad Event",
        startTime: "2030-06-01T12:00:00.000Z",
        endTime: "2030-06-01T10:00:00.000Z",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/endTime must be after startTime/i);
    });

    it("returns 400 when endTime equals startTime", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);

      const res = await postEventAs(OWNER_UID, BIZ_ID, {
        title: "Bad Event",
        startTime: "2030-06-01T10:00:00.000Z",
        endTime: "2030-06-01T10:00:00.000Z",
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/endTime must be after startTime/i);
    });

    it("returns 400 when title is missing", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);

      const res = await postEventAs(OWNER_UID, BIZ_ID, {
        startTime: "2030-06-01T10:00:00.000Z",
        endTime: "2030-06-01T12:00:00.000Z",
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message");
    });

    it("returns 400 when title is an empty string", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);

      const res = await postEventAs(OWNER_UID, BIZ_ID, {
        title: "",
        startTime: "2030-06-01T10:00:00.000Z",
        endTime: "2030-06-01T12:00:00.000Z",
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message");
    });

    it("returns 400 when startTime is not a valid datetime string", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);

      const res = await postEventAs(OWNER_UID, BIZ_ID, {
        title: "Bad Event",
        startTime: "not-a-date",
        endTime: "2030-06-01T12:00:00.000Z",
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message");
    });

    it("returns 400 when endTime is missing", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);

      const res = await postEventAs(OWNER_UID, BIZ_ID, {
        title: "Bad Event",
        startTime: "2030-06-01T10:00:00.000Z",
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message");
    });
  });

  describe("happy path", () => {
    it("returns 201 with the created event when all inputs are valid", async () => {
      const createdEvent = {
        eventId: 99,
        businessId: BIZ_ID,
        title: "Grand Opening",
        description: null,
        startTime: new Date("2030-06-01T10:00:00.000Z"),
        endTime: new Date("2030-06-01T12:00:00.000Z"),
      };

      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);
      dbMocks.chain.returning.mockResolvedValueOnce([createdEvent]);

      const res = await postEventAs(OWNER_UID, BIZ_ID, VALID_CREATE_BODY);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ title: "Grand Opening", businessId: BIZ_ID });
    });

    it("accepts an optional description field", async () => {
      const createdEvent = {
        eventId: 100,
        businessId: BIZ_ID,
        title: "Grand Opening",
        description: "Come and join us!",
        startTime: new Date("2030-06-01T10:00:00.000Z"),
        endTime: new Date("2030-06-01T12:00:00.000Z"),
      };

      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);
      dbMocks.chain.returning.mockResolvedValueOnce([createdEvent]);

      const res = await postEventAs(OWNER_UID, BIZ_ID, {
        ...VALID_CREATE_BODY,
        description: "Come and join us!",
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ description: "Come and join us!" });
    });

    it("calls db.insert with the correct businessId and parsed dates", async () => {
      const createdEvent = {
        eventId: 101,
        businessId: BIZ_ID,
        title: "Grand Opening",
        description: null,
        startTime: new Date("2030-06-01T10:00:00.000Z"),
        endTime: new Date("2030-06-01T12:00:00.000Z"),
      };

      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);
      dbMocks.chain.returning.mockResolvedValueOnce([createdEvent]);

      await postEventAs(OWNER_UID, BIZ_ID, VALID_CREATE_BODY);

      expect(dbMocks.chain.insert).toHaveBeenCalled();
      expect(dbMocks.chain.values).toHaveBeenCalledWith(
        expect.objectContaining({ businessId: BIZ_ID, title: "Grand Opening" }),
      );
      expect(dbMocks.chain.returning).toHaveBeenCalled();
    });

    it("persists imageUrl when provided", async () => {
      const imageUrl = "https://example.com/event-banner.jpg";
      const createdEvent = {
        eventId: 102,
        businessId: BIZ_ID,
        title: "Photo Event",
        description: null,
        imageUrl,
        startTime: new Date("2030-06-01T10:00:00.000Z"),
        endTime: new Date("2030-06-01T12:00:00.000Z"),
      };

      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);
      dbMocks.chain.returning.mockResolvedValueOnce([createdEvent]);

      const res = await postEventAs(OWNER_UID, BIZ_ID, {
        ...VALID_CREATE_BODY,
        imageUrl,
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ imageUrl });
      expect(dbMocks.chain.values).toHaveBeenCalledWith(
        expect.objectContaining({ imageUrl }),
      );
    });

    it("does not include imageUrl in db.insert when omitted from the request", async () => {
      const createdEvent = {
        eventId: 103,
        businessId: BIZ_ID,
        title: "No Image",
        description: null,
        startTime: new Date("2030-06-01T10:00:00.000Z"),
        endTime: new Date("2030-06-01T12:00:00.000Z"),
      };

      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);
      dbMocks.chain.returning.mockResolvedValueOnce([createdEvent]);

      await postEventAs(OWNER_UID, BIZ_ID, VALID_CREATE_BODY);

      const insertedValues = dbMocks.chain.values.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(insertedValues).not.toHaveProperty("imageUrl");
    });
  });
});

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

    it("updates imageUrl when explicitly provided", async () => {
      const imageUrl = "https://example.com/new-banner.jpg";
      const updatedEvent = { ...eventFixture, imageUrl };

      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);
      dbMocks.chain.returning.mockResolvedValueOnce([updatedEvent]);

      const res = await putEventAs(OWNER_UID, BIZ_ID, EVENT_ID, {
        title: "Grand Re-opening",
        imageUrl,
        startTime: "2030-06-01T10:00:00.000Z",
        endTime: "2030-06-01T13:00:00.000Z",
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ imageUrl });
      const setArg = dbMocks.chain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setArg).toHaveProperty("imageUrl", imageUrl);
    });

    it("does NOT include imageUrl in db.update when omitted — preserves existing value", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);
      dbMocks.chain.returning.mockResolvedValueOnce([{ ...eventFixture, title: "Grand Re-opening" }]);

      await putEventAs(OWNER_UID, BIZ_ID, EVENT_ID, VALID_UPDATE_BODY);

      const setArg = dbMocks.chain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setArg).not.toHaveProperty("imageUrl");
    });

    it("explicitly clears imageUrl when null is sent", async () => {
      const updatedEvent = { ...eventFixture, imageUrl: null };

      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);
      dbMocks.chain.returning.mockResolvedValueOnce([updatedEvent]);

      const res = await putEventAs(OWNER_UID, BIZ_ID, EVENT_ID, {
        title: "Grand Re-opening",
        imageUrl: null,
        startTime: "2030-06-01T10:00:00.000Z",
        endTime: "2030-06-01T13:00:00.000Z",
      });

      expect(res.status).toBe(200);
      expect(res.body.imageUrl).toBeNull();
      const setArg = dbMocks.chain.set.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(setArg).toHaveProperty("imageUrl", null);
    });
  });
});

// ---------------------------------------------------------------------------
// GET /api/business/:id/analytics
// ---------------------------------------------------------------------------

function getAnalyticsAs(uid: string | null, bizId: string, query?: Record<string, string>) {
  const qs = query ? "?" + new URLSearchParams(query).toString() : "";
  const req = request(app).get(`/api/business/${bizId}/analytics${qs}`);
  if (uid !== null) {
    req.set("x-met-uid", uid);
  }
  return req;
}

function setupAnalyticsMocks() {
  dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);
  dbMocks.chain.orderBy.mockResolvedValueOnce([]);
  dbMocks.chain.orderBy.mockResolvedValueOnce([]);
}

describe("GET /api/business/:id/analytics", () => {
  describe("authentication and ownership", () => {
    it("returns 401 when no uid is provided", async () => {
      const res = await getAnalyticsAs(null, BIZ_ID);
      expect(res.status).toBe(401);
    });

    it("returns 403 when the caller is not the business owner", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([bizFixture]);
      const res = await getAnalyticsAs(OTHER_UID, BIZ_ID);
      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("message");
    });

    it("returns 404 when the business does not exist", async () => {
      dbMocks.chain.limit.mockResolvedValueOnce([]);
      const res = await getAnalyticsAs(OWNER_UID, BIZ_ID);
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("message");
    });
  });

  describe("valid days values", () => {
    it("returns 200 with the expected shape when days=7", async () => {
      setupAnalyticsMocks();

      const res = await getAnalyticsAs(OWNER_UID, BIZ_ID, { days: "7" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("dailyCheckins");
      expect(res.body).toHaveProperty("peakHours");
      expect(res.body).toHaveProperty("totalCheckins");
      expect(res.body).toHaveProperty("uniqueVisitors");
      expect(Array.isArray(res.body.dailyCheckins)).toBe(true);
      expect(Array.isArray(res.body.peakHours)).toBe(true);
    });

    it("returns 200 with the expected shape when days=30 (default)", async () => {
      setupAnalyticsMocks();

      const res = await getAnalyticsAs(OWNER_UID, BIZ_ID, { days: "30" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("dailyCheckins");
      expect(res.body).toHaveProperty("peakHours");
      expect(res.body).toHaveProperty("totalCheckins");
      expect(res.body).toHaveProperty("uniqueVisitors");
    });

    it("returns 200 with the expected shape when days=90", async () => {
      setupAnalyticsMocks();

      const res = await getAnalyticsAs(OWNER_UID, BIZ_ID, { days: "90" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("dailyCheckins");
      expect(res.body).toHaveProperty("peakHours");
      expect(res.body).toHaveProperty("totalCheckins");
      expect(res.body).toHaveProperty("uniqueVisitors");
    });

    it("returns 200 without a days param, defaulting to 30 days", async () => {
      setupAnalyticsMocks();

      const res = await getAnalyticsAs(OWNER_UID, BIZ_ID);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("dailyCheckins");
      expect(res.body).toHaveProperty("peakHours");
    });
  });

  describe("out-of-range days values are clamped gracefully", () => {
    it("returns 200 when days=0 (clamped to 1)", async () => {
      setupAnalyticsMocks();

      const res = await getAnalyticsAs(OWNER_UID, BIZ_ID, { days: "0" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("dailyCheckins");
      expect(res.body).toHaveProperty("peakHours");
    });

    it("returns 200 when days=-5 (clamped to 1)", async () => {
      setupAnalyticsMocks();

      const res = await getAnalyticsAs(OWNER_UID, BIZ_ID, { days: "-5" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("dailyCheckins");
      expect(res.body).toHaveProperty("peakHours");
    });

    it("returns 200 when days=999 (clamped to 90)", async () => {
      setupAnalyticsMocks();

      const res = await getAnalyticsAs(OWNER_UID, BIZ_ID, { days: "999" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("dailyCheckins");
      expect(res.body).toHaveProperty("peakHours");
    });

    it("returns 200 when days=abc (non-numeric, defaults to 30)", async () => {
      setupAnalyticsMocks();

      const res = await getAnalyticsAs(OWNER_UID, BIZ_ID, { days: "abc" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("dailyCheckins");
      expect(res.body).toHaveProperty("peakHours");
    });
  });

  describe("cutoff date is computed correctly from the clamped days value", () => {
    // Fixed reference point: 2026-01-15T12:00:00.000Z
    // Expected cutoffs (UTC date string YYYY-MM-DD):
    //   days=7   → 2026-01-08
    //   days=30  → 2025-12-16
    //   days=90  → 2025-10-17
    //   days=0   (clamped to 1)  → 2026-01-14
    //   days=-5  (clamped to 1)  → 2026-01-14
    //   days=999 (clamped to 90) → 2025-10-17
    //   days=abc (defaulted to 30) → 2025-12-16

    const FIXED_NOW = new Date("2026-01-15T12:00:00.000Z");

    afterEach(() => {
      vi.useRealTimers();
    });

    function cutoffDateFromSpy(): string {
      const dateArg = gteSpy.mock.calls
        .map((call: unknown[]) => call[1])
        .find((v): v is Date => v instanceof Date);
      if (!dateArg) throw new Error("gte was not called with a Date argument");
      return dateArg.toISOString().slice(0, 10);
    }

    it("passes a 7-day cutoff to the database when days=7", async () => {
      vi.useFakeTimers({ now: FIXED_NOW });
      setupAnalyticsMocks();
      await getAnalyticsAs(OWNER_UID, BIZ_ID, { days: "7" });
      expect(cutoffDateFromSpy()).toBe("2026-01-08");
    });

    it("passes a 30-day cutoff to the database when days=30", async () => {
      vi.useFakeTimers({ now: FIXED_NOW });
      setupAnalyticsMocks();
      await getAnalyticsAs(OWNER_UID, BIZ_ID, { days: "30" });
      expect(cutoffDateFromSpy()).toBe("2025-12-16");
    });

    it("passes a 90-day cutoff to the database when days=90", async () => {
      vi.useFakeTimers({ now: FIXED_NOW });
      setupAnalyticsMocks();
      await getAnalyticsAs(OWNER_UID, BIZ_ID, { days: "90" });
      expect(cutoffDateFromSpy()).toBe("2025-10-17");
    });

    it("clamps days=0 to 1 — passes a 1-day cutoff to the database", async () => {
      vi.useFakeTimers({ now: FIXED_NOW });
      setupAnalyticsMocks();
      await getAnalyticsAs(OWNER_UID, BIZ_ID, { days: "0" });
      expect(cutoffDateFromSpy()).toBe("2026-01-14");
    });

    it("clamps days=-5 to 1 — passes a 1-day cutoff to the database", async () => {
      vi.useFakeTimers({ now: FIXED_NOW });
      setupAnalyticsMocks();
      await getAnalyticsAs(OWNER_UID, BIZ_ID, { days: "-5" });
      expect(cutoffDateFromSpy()).toBe("2026-01-14");
    });

    it("clamps days=999 to 90 — passes a 90-day cutoff to the database", async () => {
      vi.useFakeTimers({ now: FIXED_NOW });
      setupAnalyticsMocks();
      await getAnalyticsAs(OWNER_UID, BIZ_ID, { days: "999" });
      expect(cutoffDateFromSpy()).toBe("2025-10-17");
    });

    it("defaults days=abc to 30 — passes a 30-day cutoff to the database", async () => {
      vi.useFakeTimers({ now: FIXED_NOW });
      setupAnalyticsMocks();
      await getAnalyticsAs(OWNER_UID, BIZ_ID, { days: "abc" });
      expect(cutoffDateFromSpy()).toBe("2025-12-16");
    });
  });
});
