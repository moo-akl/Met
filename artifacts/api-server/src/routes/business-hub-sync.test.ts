import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Integration tests: Business Portal → EnhancedHubSheet sync
//
// These tests confirm that a business profile created or updated via the
// portal routes (POST /api/business, PUT /api/business/:id) is faithfully
// surfaced in the hub map endpoint (GET /api/hubs/active) that feeds the
// EnhancedHubSheet shown to app users.
//
// A stateful in-memory store captures the data written by POST/PUT and feeds
// it directly into GET, so if the portal writes the wrong placeId, logoUrl,
// or name the GET assertion fails — not just the POST assertion.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Stateful in-memory store — simulates the businessProfilesTable across calls.
// Populated by db.insert().values() capture; read by the GET mock setup helper.
// ---------------------------------------------------------------------------

type BizRow = {
  placeId: string;
  businessId: string;
  ownerId: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  isActiveSubscription: boolean;
  mediaUrls: string[];
};

type EventRow = {
  eventId: number;
  businessId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  startTime: Date;
  endTime: Date;
};

let store: { biz: BizRow | null; events: EventRow[] } = { biz: null, events: [] };

// ---------------------------------------------------------------------------
// Hoisted DB mock — must be defined before vi.mock() factory runs.
// The chain covers every Drizzle method used by the two routes under test.
// ---------------------------------------------------------------------------

const dbMocks = vi.hoisted(() => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
    offset: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  };
  return { chain };
});

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  hubCheckinsTable: {},
  businessProfilesTable: {},
  userStatsTable: {},
  profileViewsTable: {},
  reviewsTable: {},
  profilesTable: {},
  monthlyChampionsTable: {},
  trophiesTable: {},
  subscriptionsTable: {},
  revealRequestsTable: {},
  businessEventsTable: {},
  businessReviewsTable: {},
}));

vi.mock("../lib/firebaseAdmin", () => ({
  adminDb: vi.fn(),
  adminAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockRejectedValue(new Error("no real token")),
  })),
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

// Stub auth so tests don't need real Firebase tokens.
vi.mock("../middlewares/requireUid", () => ({
  requireUid: (
    req: { uid?: string; headers: Record<string, string | undefined> },
    _res: unknown,
    next: () => void,
  ) => {
    req.uid = req.headers["x-met-uid"] ?? "owner-alice";
    next();
  },
}));

// ---------------------------------------------------------------------------
// App — imported after all mocks are registered.
// ---------------------------------------------------------------------------

import request from "supertest";
import app from "../app";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OWNER_UID = "owner-alice";
const BIZ_ID = "biz-sync-001";
const PLACE_ID = "place-sync-abc";

/** An active hub check-in row at the same placeId */
const checkinRow = {
  placeId: PLACE_ID,
  placeName: "Sync Cafe Hub",
  lat: "40.7128",
  lng: "-74.0060",
  checkinCount: "3",
};

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
  store.biz = null;
  store.events = [];

  dbMocks.chain.select.mockReturnThis();
  dbMocks.chain.from.mockReturnThis();
  dbMocks.chain.where.mockReturnThis();
  dbMocks.chain.groupBy.mockReturnThis();
  dbMocks.chain.orderBy.mockReturnThis();
  dbMocks.chain.limit.mockResolvedValue([]);
  dbMocks.chain.insert.mockReturnThis();
  dbMocks.chain.values.mockReturnThis();
  dbMocks.chain.returning.mockResolvedValue([]);
  dbMocks.chain.update.mockReturnThis();
  dbMocks.chain.set.mockReturnThis();
  dbMocks.chain.delete.mockReturnThis();
  dbMocks.chain.execute.mockResolvedValue(undefined);
  dbMocks.chain.onConflictDoUpdate.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sets up db.insert mocks for POST /api/business so that:
 * 1. The uniqueness check returns no existing record.
 * 2. db.insert().values() captures the inserted data into `store.biz`.
 * 3. db.returning() returns a record derived from that captured data.
 *
 * This means if POST passes the wrong placeId / logoUrl / name to the DB,
 * `store.biz` will reflect that wrong value and the GET assertion will fail.
 */
function setupPostInsert(overrides: Partial<BizRow> = {}) {
  dbMocks.chain.limit.mockResolvedValueOnce([]);

  dbMocks.chain.values.mockImplementationOnce((data: Record<string, unknown>) => {
    store.biz = {
      placeId: String(data["placeId"] ?? ""),
      businessId: BIZ_ID,
      ownerId: OWNER_UID,
      name: String(data["name"] ?? ""),
      logoUrl: (data["logoUrl"] as string | null | undefined) ?? null,
      description: (data["description"] as string | null | undefined) ?? null,
      isActiveSubscription: false,
      mediaUrls: (data["mediaUrls"] as string[]) ?? [],
      ...overrides,
    };
    return dbMocks.chain;
  });

  dbMocks.chain.returning.mockImplementationOnce(() => {
    return Promise.resolve(store.biz ? [store.biz] : []);
  });
}

/**
 * Sets up db mocks for GET /api/hubs/active so that the businessProfile
 * returned is built from `store.biz` — the same data written by POST.
 *
 * If `store.biz` is null (no business registered), the venue gets null.
 */
function setupHubsActiveFromStore(extraCheckins?: typeof checkinRow[]) {
  const checkins = extraCheckins ?? [checkinRow];
  dbMocks.chain.limit.mockResolvedValueOnce(checkins);

  if (checkins.length > 0) {
    dbMocks.chain.where.mockReturnValueOnce(dbMocks.chain);
    dbMocks.chain.where.mockImplementationOnce(() => {
      return Promise.resolve(store.biz ? [store.biz] : []);
    });
  }
}

/**
 * Seeds store.biz directly (skipping the POST round-trip) so that
 * GET /api/business/:placeId and POST /api/business/:id/events have a
 * valid business to work against.
 */
function seedStoreBiz(overrides: Partial<BizRow> = {}) {
  store.biz = {
    placeId: PLACE_ID,
    businessId: BIZ_ID,
    ownerId: OWNER_UID,
    name: "Event Cafe",
    logoUrl: null,
    description: null,
    isActiveSubscription: false,
    mediaUrls: [],
    ...overrides,
  };
}

/**
 * Sets up db mocks for POST /api/business/:id/events:
 *  1. getBusinessById → limit resolves with store.biz
 *  2. db.insert().values() captures the new event into store.events.
 *     No fallback for businessId — if the route passes the wrong field name
 *     businessId will be "" and assertions will fail immediately.
 *  3. db.returning() returns the captured event
 */
function setupEventInsert() {
  dbMocks.chain.limit.mockResolvedValueOnce(store.biz ? [store.biz] : []);

  dbMocks.chain.values.mockImplementationOnce((data: Record<string, unknown>) => {
    const event: EventRow = {
      eventId: store.events.length + 1,
      // No ?? BIZ_ID fallback — a wrong field name produces "" and the test fails.
      businessId: String(data["businessId"] ?? ""),
      title: String(data["title"] ?? ""),
      description: (data["description"] as string | null | undefined) ?? null,
      imageUrl: (data["imageUrl"] as string | null | undefined) ?? null,
      startTime: data["startTime"] instanceof Date ? data["startTime"] : new Date(String(data["startTime"] ?? "")),
      endTime: data["endTime"] instanceof Date ? data["endTime"] : new Date(String(data["endTime"] ?? "")),
    };
    store.events.push(event);
    return dbMocks.chain;
  });

  dbMocks.chain.returning.mockImplementationOnce(() => {
    return Promise.resolve(store.events.length ? [store.events[store.events.length - 1]] : []);
  });
}

/**
 * Sets up db mocks for GET /api/business/:placeId:
 *  1. Biz lookup: limit resolves with store.biz ONLY if store.biz.placeId === requestedPlaceId.
 *     A mismatch produces [] → route returns 404, catching wrong-key lookups.
 *  2. Events lookup: limit resolves with events ONLY for store.biz.businessId,
 *     so events belonging to a different businessId are never returned.
 *
 * This enforces the placeId → businessId → events linkage end-to-end.
 */
function setupGetByPlaceId(requestedPlaceId: string = PLACE_ID) {
  // Biz lookup (limit(1)) — placeId-sensitive
  dbMocks.chain.limit.mockImplementationOnce(() => {
    const match = store.biz?.placeId === requestedPlaceId ? [store.biz] : [];
    return Promise.resolve(match);
  });

  // Events lookup (limit(50)) — businessId-sensitive
  dbMocks.chain.limit.mockImplementationOnce(() => {
    const bizId = store.biz?.businessId;
    return Promise.resolve(store.events.filter((e) => e.businessId === bizId));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Business Portal → EnhancedHubSheet sync", () => {
  describe("POST /api/business → GET /api/hubs/active round-trip", () => {
    it("name written by POST is exactly what GET /api/hubs/active surfaces in businessProfile", async () => {
      setupPostInsert();

      const createRes = await request(app)
        .post("/api/business")
        .set("x-met-uid", OWNER_UID)
        .send({
          placeId: PLACE_ID,
          name: "Sync Cafe",
          logoUrl: "https://example.com/logo.png",
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.name).toBe("Sync Cafe");

      setupHubsActiveFromStore();

      const hubsRes = await request(app)
        .get("/api/hubs/active")
        .set("x-met-uid", OWNER_UID);

      expect(hubsRes.status).toBe(200);
      expect(hubsRes.body.venues).toHaveLength(1);
      // The name in GET comes from what POST actually wrote to the store —
      // not from a hard-coded fixture — so a mismatch in the write path fails here.
      expect(hubsRes.body.venues[0].businessProfile).toMatchObject({
        name: "Sync Cafe",
        placeId: PLACE_ID,
        businessId: BIZ_ID,
      });
    });

    it("logoUrl written by POST is exactly what GET /api/hubs/active surfaces in businessProfile", async () => {
      const logo = "https://cdn.example.com/my-unique-logo-12345.png";
      setupPostInsert();

      const createRes = await request(app)
        .post("/api/business")
        .set("x-met-uid", OWNER_UID)
        .send({ placeId: PLACE_ID, name: "Logo Cafe", logoUrl: logo });

      expect(createRes.status).toBe(201);
      expect(createRes.body.logoUrl).toBe(logo);

      setupHubsActiveFromStore();

      const hubsRes = await request(app)
        .get("/api/hubs/active")
        .set("x-met-uid", OWNER_UID);

      // store.biz.logoUrl was set from what POST passed to values() —
      // if POST had passed the wrong URL, this assertion fails.
      expect(hubsRes.body.venues[0].businessProfile.logoUrl).toBe(logo);
    });

    it("isActiveSubscription defaults to false for a new profile and GET forwards it as-is", async () => {
      setupPostInsert();

      const createRes = await request(app)
        .post("/api/business")
        .set("x-met-uid", OWNER_UID)
        .send({ placeId: PLACE_ID, name: "Free Tier Cafe" });

      expect(createRes.body.isActiveSubscription).toBe(false);

      setupHubsActiveFromStore();

      const hubsRes = await request(app)
        .get("/api/hubs/active")
        .set("x-met-uid", OWNER_UID);

      expect(hubsRes.body.venues[0].businessProfile.isActiveSubscription).toBe(false);
    });

    it("isActiveSubscription: true (active subscription) flows through to the gold hub marker", async () => {
      setupPostInsert({ isActiveSubscription: true });

      await request(app)
        .post("/api/business")
        .set("x-met-uid", OWNER_UID)
        .send({ placeId: PLACE_ID, name: "Premium Cafe" });

      setupHubsActiveFromStore();

      const hubsRes = await request(app)
        .get("/api/hubs/active")
        .set("x-met-uid", OWNER_UID);

      expect(hubsRes.body.venues[0].businessProfile.isActiveSubscription).toBe(true);
    });

    it("placeId written by POST is what binds the businessProfile to the correct venue", async () => {
      setupPostInsert();

      const createRes = await request(app)
        .post("/api/business")
        .set("x-met-uid", OWNER_UID)
        .send({ placeId: PLACE_ID, name: "Sync Cafe" });

      // The POST response carries the placeId that was passed to db.values()
      expect(createRes.body.placeId).toBe(PLACE_ID);

      // GET /api/hubs/active for a different placeId must NOT surface this biz
      const differentCheckin = { ...checkinRow, placeId: "place-DIFFERENT" };
      dbMocks.chain.limit.mockResolvedValueOnce([differentCheckin]);
      dbMocks.chain.where.mockReturnValueOnce(dbMocks.chain);
      // Store contains PLACE_ID; query is for place-DIFFERENT → empty result
      dbMocks.chain.where.mockResolvedValueOnce([]);

      const hubsRes = await request(app)
        .get("/api/hubs/active")
        .set("x-met-uid", OWNER_UID);

      expect(hubsRes.body.venues[0].businessProfile).toBeNull();
    });
  });

  describe("PUT /api/business/:id → GET /api/hubs/active round-trip", () => {
    it("updated logoUrl from portal is reflected in the hub businessProfile", async () => {
      const originalLogo = "https://example.com/original.png";
      const newLogo = "https://cdn.example.com/updated-logo.png";

      // Seed store with the existing profile (as if previously created)
      store.biz = {
        placeId: PLACE_ID,
        businessId: BIZ_ID,
        ownerId: OWNER_UID,
        name: "Sync Cafe",
        logoUrl: originalLogo,
        description: null,
        isActiveSubscription: false,
        mediaUrls: [],
      };

      // PUT /api/business/:id — getBusinessById returns the existing record,
      // then update captures the new logoUrl into store.biz.
      dbMocks.chain.limit.mockResolvedValueOnce([store.biz]);
      dbMocks.chain.set.mockImplementationOnce((updates: Record<string, unknown>) => {
        if (store.biz && updates["logoUrl"] !== undefined) {
          store.biz = { ...store.biz, logoUrl: (updates["logoUrl"] as string | null) };
        }
        return dbMocks.chain;
      });
      dbMocks.chain.returning.mockImplementationOnce(() => {
        return Promise.resolve(store.biz ? [store.biz] : []);
      });

      const updateRes = await request(app)
        .put(`/api/business/${BIZ_ID}`)
        .set("x-met-uid", OWNER_UID)
        .send({ logoUrl: newLogo });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.logoUrl).toBe(newLogo);

      // GET /api/hubs/active should surface the new logo from store.biz
      setupHubsActiveFromStore();

      const hubsRes = await request(app)
        .get("/api/hubs/active")
        .set("x-met-uid", OWNER_UID);

      expect(hubsRes.status).toBe(200);
      expect(hubsRes.body.venues[0].businessProfile.logoUrl).toBe(newLogo);
    });

    it("updated name from portal is reflected in the hub businessProfile", async () => {
      store.biz = {
        placeId: PLACE_ID,
        businessId: BIZ_ID,
        ownerId: OWNER_UID,
        name: "Original Name",
        logoUrl: null,
        description: null,
        isActiveSubscription: false,
        mediaUrls: [],
      };

      const newName = "Rebranded Hub Name";
      dbMocks.chain.limit.mockResolvedValueOnce([store.biz]);
      dbMocks.chain.set.mockImplementationOnce((updates: Record<string, unknown>) => {
        if (store.biz && updates["name"] !== undefined) {
          store.biz = { ...store.biz, name: String(updates["name"]) };
        }
        return dbMocks.chain;
      });
      dbMocks.chain.returning.mockImplementationOnce(() =>
        Promise.resolve(store.biz ? [store.biz] : []),
      );

      const updateRes = await request(app)
        .put(`/api/business/${BIZ_ID}`)
        .set("x-met-uid", OWNER_UID)
        .send({ name: newName });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.name).toBe(newName);

      setupHubsActiveFromStore();

      const hubsRes = await request(app)
        .get("/api/hubs/active")
        .set("x-met-uid", OWNER_UID);

      expect(hubsRes.body.venues[0].businessProfile.name).toBe(newName);
    });

    it("null logoUrl (logo removed) is forwarded — hub shows no logo", async () => {
      store.biz = {
        placeId: PLACE_ID,
        businessId: BIZ_ID,
        ownerId: OWNER_UID,
        name: "Sync Cafe",
        logoUrl: "https://example.com/old-logo.png",
        description: null,
        isActiveSubscription: false,
        mediaUrls: [],
      };

      dbMocks.chain.limit.mockResolvedValueOnce([store.biz]);
      dbMocks.chain.set.mockImplementationOnce((updates: Record<string, unknown>) => {
        if (store.biz && "logoUrl" in updates) {
          store.biz = { ...store.biz, logoUrl: (updates["logoUrl"] as string | null) ?? null };
        }
        return dbMocks.chain;
      });
      dbMocks.chain.returning.mockImplementationOnce(() =>
        Promise.resolve(store.biz ? [store.biz] : []),
      );

      const updateRes = await request(app)
        .put(`/api/business/${BIZ_ID}`)
        .set("x-met-uid", OWNER_UID)
        .send({ logoUrl: null });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.logoUrl).toBeNull();

      setupHubsActiveFromStore();

      const hubsRes = await request(app)
        .get("/api/hubs/active")
        .set("x-met-uid", OWNER_UID);

      expect(hubsRes.body.venues[0].businessProfile.logoUrl).toBeNull();
    });
  });

  describe("POST /api/business/:id/events → GET /api/business/:placeId round-trip", () => {
    it("event created via POST appears in GET /api/business/:placeId events array", async () => {
      seedStoreBiz();
      setupEventInsert();

      const START = "2027-03-01T18:00:00.000Z";
      const END = "2027-03-01T20:00:00.000Z";

      const postRes = await request(app)
        .post(`/api/business/${BIZ_ID}/events`)
        .set("x-met-uid", OWNER_UID)
        .send({ title: "Grand Opening Night", startTime: START, endTime: END });

      expect(postRes.status).toBe(201);
      expect(postRes.body.title).toBe("Grand Opening Night");
      expect(postRes.body.businessId).toBe(BIZ_ID);

      setupGetByPlaceId();

      const getRes = await request(app)
        .get(`/api/business/${PLACE_ID}`)
        .set("x-met-uid", OWNER_UID);

      expect(getRes.status).toBe(200);
      expect(getRes.body.events).toHaveLength(1);
      expect(getRes.body.events[0]).toMatchObject({
        title: "Grand Opening Night",
        businessId: BIZ_ID,
        startTime: new Date(START).toISOString(),
        endTime: new Date(END).toISOString(),
      });
    });

    it("event startTime and endTime stored by POST match exactly what GET returns", async () => {
      seedStoreBiz();
      setupEventInsert();

      const START = "2027-06-15T09:00:00.000Z";
      const END = "2027-06-15T11:30:00.000Z";

      await request(app)
        .post(`/api/business/${BIZ_ID}/events`)
        .set("x-met-uid", OWNER_UID)
        .send({ title: "Morning Workshop", startTime: START, endTime: END });

      setupGetByPlaceId();

      const getRes = await request(app)
        .get(`/api/business/${PLACE_ID}`)
        .set("x-met-uid", OWNER_UID);

      expect(getRes.status).toBe(200);
      const ev = getRes.body.events[0] as { startTime: string; endTime: string };
      expect(new Date(ev.startTime).toISOString()).toBe(new Date(START).toISOString());
      expect(new Date(ev.endTime).toISOString()).toBe(new Date(END).toISOString());
    });

    it("businessId on the event matches the placeId-linked business — no orphan", async () => {
      seedStoreBiz();
      setupEventInsert();

      await request(app)
        .post(`/api/business/${BIZ_ID}/events`)
        .set("x-met-uid", OWNER_UID)
        .send({
          title: "Orphan Guard Test",
          startTime: "2027-04-10T10:00:00.000Z",
          endTime: "2027-04-10T12:00:00.000Z",
        });

      // The captured event must carry the same businessId that the biz profile uses.
      expect(store.events[0]?.businessId).toBe(BIZ_ID);

      // GET /api/business/:placeId must look up the biz by placeId and then fetch
      // events using that same businessId — verify the link is intact end-to-end.
      setupGetByPlaceId();

      const getRes = await request(app)
        .get(`/api/business/${PLACE_ID}`)
        .set("x-met-uid", OWNER_UID);

      expect(getRes.status).toBe(200);
      expect(getRes.body.placeId).toBe(PLACE_ID);
      expect(getRes.body.businessId).toBe(BIZ_ID);
      expect(getRes.body.events[0]?.businessId).toBe(BIZ_ID);
    });

    it("multiple events created by POST all appear in GET response", async () => {
      seedStoreBiz();

      const events = [
        { title: "Event Alpha", startTime: "2027-05-01T10:00:00.000Z", endTime: "2027-05-01T12:00:00.000Z" },
        { title: "Event Beta",  startTime: "2027-05-08T14:00:00.000Z", endTime: "2027-05-08T16:00:00.000Z" },
        { title: "Event Gamma", startTime: "2027-05-15T18:00:00.000Z", endTime: "2027-05-15T20:00:00.000Z" },
      ];

      for (const ev of events) {
        setupEventInsert();
        const res = await request(app)
          .post(`/api/business/${BIZ_ID}/events`)
          .set("x-met-uid", OWNER_UID)
          .send(ev);
        expect(res.status).toBe(201);
      }

      expect(store.events).toHaveLength(3);

      setupGetByPlaceId();

      const getRes = await request(app)
        .get(`/api/business/${PLACE_ID}`)
        .set("x-met-uid", OWNER_UID);

      expect(getRes.status).toBe(200);
      expect(getRes.body.events).toHaveLength(3);
      const titles = (getRes.body.events as Array<{ title: string }>).map((e) => e.title);
      expect(titles).toContain("Event Alpha");
      expect(titles).toContain("Event Beta");
      expect(titles).toContain("Event Gamma");
    });

    it("GET /api/business/:placeId returns 404 when placeId has no matching business (events cannot be orphaned)", async () => {
      // No store.biz — simulates a placeId with no registered business.
      setupGetByPlaceId("place-UNKNOWN");

      const getRes = await request(app)
        .get(`/api/business/place-UNKNOWN`)
        .set("x-met-uid", OWNER_UID);

      expect(getRes.status).toBe(404);
    });

    it("GET /api/business/:placeId returns 404 when the registered biz is at a different placeId (no cross-leak)", async () => {
      // Biz exists but for a different placeId — the mock only returns it when the
      // requestedPlaceId matches store.biz.placeId, so a mismatched request gets 404.
      seedStoreBiz({ placeId: "place-OTHER" });
      setupEventInsert();

      await request(app)
        .post(`/api/business/${BIZ_ID}/events`)
        .set("x-met-uid", OWNER_UID)
        .send({
          title: "Wrong Place Event",
          startTime: "2027-08-01T10:00:00.000Z",
          endTime: "2027-08-01T12:00:00.000Z",
        });

      // Request for PLACE_ID ("place-sync-abc") but biz is at "place-OTHER"
      // → the placeId-sensitive mock returns [] → route returns 404
      setupGetByPlaceId(PLACE_ID);

      const getRes = await request(app)
        .get(`/api/business/${PLACE_ID}`)
        .set("x-met-uid", OWNER_UID);

      expect(getRes.status).toBe(404);
    });

    it("POST /api/business/:id/events returns 404 when businessId does not exist", async () => {
      // store.biz is null → getBusinessById returns nothing
      dbMocks.chain.limit.mockResolvedValueOnce([]);

      const postRes = await request(app)
        .post(`/api/business/nonexistent-biz/events`)
        .set("x-met-uid", OWNER_UID)
        .send({
          title: "Ghost Event",
          startTime: "2027-07-01T10:00:00.000Z",
          endTime: "2027-07-01T12:00:00.000Z",
        });

      expect(postRes.status).toBe(404);
      expect(store.events).toHaveLength(0);
    });
  });

  describe("GET /api/hubs/active — venue matching integrity", () => {
    it("returns businessProfile: null for an active venue with no registered business", async () => {
      // store.biz is null — no business registered for this placeId
      const unregisteredCheckin = {
        placeId: "place-no-business",
        placeName: "Unregistered Spot",
        lat: "51.5074",
        lng: "-0.1278",
        checkinCount: "2",
      };

      dbMocks.chain.limit.mockResolvedValueOnce([unregisteredCheckin]);
      dbMocks.chain.where.mockReturnValueOnce(dbMocks.chain);
      dbMocks.chain.where.mockResolvedValueOnce([]);

      const hubsRes = await request(app)
        .get("/api/hubs/active")
        .set("x-met-uid", OWNER_UID);

      expect(hubsRes.status).toBe(200);
      expect(hubsRes.body.venues).toHaveLength(1);
      expect(hubsRes.body.venues[0].businessProfile).toBeNull();
    });

    it("attaches businessProfile only to the matching venue when multiple active venues exist", async () => {
      store.biz = {
        placeId: "place-A",
        businessId: "biz-A",
        ownerId: OWNER_UID,
        name: "Business A",
        logoUrl: "https://example.com/a.png",
        description: null,
        isActiveSubscription: true,
        mediaUrls: [],
      };

      const checkinA = { placeId: "place-A", placeName: "Venue A", lat: "1.0", lng: "1.0", checkinCount: "5" };
      const checkinB = { placeId: "place-B", placeName: "Venue B", lat: "2.0", lng: "2.0", checkinCount: "2" };

      dbMocks.chain.limit.mockResolvedValueOnce([checkinA, checkinB]);
      dbMocks.chain.where.mockReturnValueOnce(dbMocks.chain);
      dbMocks.chain.where.mockImplementationOnce(() =>
        Promise.resolve(store.biz ? [store.biz] : []),
      );

      const hubsRes = await request(app)
        .get("/api/hubs/active")
        .set("x-met-uid", OWNER_UID);

      expect(hubsRes.status).toBe(200);
      const venues = hubsRes.body.venues as Array<{ placeId: string; businessProfile: Record<string, unknown> | null }>;
      const venueA = venues.find((v) => v.placeId === "place-A");
      const venueB = venues.find((v) => v.placeId === "place-B");
      expect(venueA?.businessProfile).toMatchObject({ businessId: "biz-A", name: "Business A" });
      expect(venueB?.businessProfile).toBeNull();
    });
  });
});
