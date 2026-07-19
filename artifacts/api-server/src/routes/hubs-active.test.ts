import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted DB mock — must be defined before vi.mock() factory runs.
// groupBy is included because GET /api/hubs/active uses it in its first query.
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
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    offset: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
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

// Stub auth so tests don't need a real Firebase token.
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
// Fixtures
// ---------------------------------------------------------------------------

const AUTH_HEADER = "Bearer test-token-alice";

const checkinRow = {
  placeId: "place-123",
  placeName: "Cool Cafe",
  lat: "37.7749",
  lng: "-122.4194",
  checkinCount: "5",
};

const bizProfileRow = {
  placeId: "place-123",
  businessId: "biz-001",
  ownerId: "owner-uid",
  name: "Cool Cafe Official",
  logoUrl: "https://example.com/logo.png",
  description: "A cool place",
  isActiveSubscription: true,
  mediaUrls: [],
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

  dbMocks.chain.select.mockReturnThis();
  dbMocks.chain.from.mockReturnThis();
  dbMocks.chain.where.mockReturnThis();
  dbMocks.chain.groupBy.mockReturnThis();
  dbMocks.chain.orderBy.mockReturnThis();
  dbMocks.chain.limit.mockResolvedValue([]);
  dbMocks.chain.insert.mockReturnThis();
  dbMocks.chain.values.mockReturnThis();
  dbMocks.chain.update.mockReturnThis();
  dbMocks.chain.set.mockReturnThis();
  dbMocks.chain.returning.mockResolvedValue([]);
  dbMocks.chain.execute.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Tests: GET /api/hubs/active — gold partner marker enrichment
// ---------------------------------------------------------------------------

describe("GET /api/hubs/active — businessProfile enrichment", () => {
  it("returns 200 with an empty venues array when no recent check-ins exist", async () => {
    dbMocks.chain.limit.mockResolvedValueOnce([]);

    const res = await request(app)
      .get("/api/hubs/active")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ venues: [] });
  });

  it("returns businessProfile: null when no matching business profile exists for the active venue", async () => {
    // First query: return one check-in row so activePlaceIds is non-empty.
    // The first .where() call must return the chain (for .groupBy chaining);
    // the second .where() call (businessProfiles query) resolves with [].
    dbMocks.chain.limit.mockResolvedValueOnce([checkinRow]);
    dbMocks.chain.where.mockReturnValueOnce(dbMocks.chain); // first query's .where()
    dbMocks.chain.where.mockResolvedValueOnce([]);           // second query's .where()

    const res = await request(app)
      .get("/api/hubs/active")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.venues).toHaveLength(1);
    expect(res.body.venues[0].businessProfile).toBeNull();
  });

  it("attaches the businessProfile when a matching row with isActiveSubscription: true exists", async () => {
    dbMocks.chain.limit.mockResolvedValueOnce([checkinRow]);
    dbMocks.chain.where.mockReturnValueOnce(dbMocks.chain);     // first query's .where()
    dbMocks.chain.where.mockResolvedValueOnce([bizProfileRow]); // second query's .where()

    const res = await request(app)
      .get("/api/hubs/active")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    const venue = res.body.venues[0] as Record<string, unknown>;
    expect(venue.placeId).toBe("place-123");
    expect(venue.placeName).toBe("Cool Cafe");
    expect(venue.businessProfile).toMatchObject({
      placeId: "place-123",
      businessId: "biz-001",
      name: "Cool Cafe Official",
      logoUrl: "https://example.com/logo.png",
      isActiveSubscription: true,
    });
  });

  it("faithfully forwards isActiveSubscription: false (client decides whether to show gold marker)", async () => {
    const inactiveBiz = { ...bizProfileRow, isActiveSubscription: false };

    dbMocks.chain.limit.mockResolvedValueOnce([checkinRow]);
    dbMocks.chain.where.mockReturnValueOnce(dbMocks.chain);
    dbMocks.chain.where.mockResolvedValueOnce([inactiveBiz]);

    const res = await request(app)
      .get("/api/hubs/active")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.venues[0].businessProfile).toMatchObject({
      isActiveSubscription: false,
    });
  });

  it("matches businessProfile to the correct venue by placeId when multiple active venues exist", async () => {
    const rows = [
      { placeId: "place-A", placeName: "Venue A", lat: "1.0", lng: "1.0", checkinCount: "3" },
      { placeId: "place-B", placeName: "Venue B", lat: "2.0", lng: "2.0", checkinCount: "1" },
    ];
    const bizForA = { ...bizProfileRow, placeId: "place-A", businessId: "biz-A" };

    dbMocks.chain.limit.mockResolvedValueOnce(rows);
    dbMocks.chain.where.mockReturnValueOnce(dbMocks.chain);
    dbMocks.chain.where.mockResolvedValueOnce([bizForA]);

    const res = await request(app)
      .get("/api/hubs/active")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    const venues = res.body.venues as Array<{ placeId: string; businessProfile: unknown }>;
    const venueA = venues.find((v) => v.placeId === "place-A");
    const venueB = venues.find((v) => v.placeId === "place-B");
    expect(venueA?.businessProfile).toMatchObject({ businessId: "biz-A" });
    expect(venueB?.businessProfile).toBeNull();
  });

  it("returns correct numeric lat/lng values (converted from SQL AVG strings)", async () => {
    dbMocks.chain.limit.mockResolvedValueOnce([checkinRow]);
    dbMocks.chain.where.mockReturnValueOnce(dbMocks.chain);
    dbMocks.chain.where.mockResolvedValueOnce([]);

    const res = await request(app)
      .get("/api/hubs/active")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    const venue = res.body.venues[0] as Record<string, unknown>;
    expect(typeof venue.lat).toBe("number");
    expect(typeof venue.lng).toBe("number");
    expect(venue.lat).toBe(37.7749);
    expect(venue.lng).toBe(-122.4194);
  });

  it("skips the businessProfiles query entirely when no check-ins exist", async () => {
    dbMocks.chain.limit.mockResolvedValueOnce([]);

    await request(app)
      .get("/api/hubs/active")
      .set("Authorization", AUTH_HEADER);

    // Only the first .select() chain (for hubCheckinsTable) should run.
    // The second query (businessProfilesTable) is gated on activePlaceIds.length > 0.
    // Verify .where() was called exactly once (for the hubCheckinsTable query).
    expect(dbMocks.chain.where).toHaveBeenCalledTimes(1);
  });
});
