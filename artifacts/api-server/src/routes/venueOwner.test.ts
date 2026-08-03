import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  };
  return { chain };
});

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  venueOwnerProfilesTable: {
    id: "id",
    ownerUid: "ownerUid",
    placeId: "placeId",
    contactEmail: "contactEmail",
    applicationStatus: "applicationStatus",
    isApproved: "isApproved",
    isVerified: "isVerified",
    submittedAt: "submittedAt",
  },
  venueApplicationHistoryTable: {
    id: "id",
    venueOwnerProfileId: "venueOwnerProfileId",
    eventType: "eventType",
    fromStatus: "fromStatus",
    toStatus: "toStatus",
    actorRole: "actorRole",
    actorUid: "actorUid",
    applicantMessage: "applicantMessage",
    internalNote: "internalNote",
    metadata: "metadata",
    createdAt: "createdAt",
  },
  venueEventsTable: {},
  venueEventRsvpsTable: {},
  venueRewardsTable: {},
  venueAnnouncementsTable: {},
  hubCheckinsTable: {},
  profilesTable: {},
  venueAdminCredentialsTable: {},
  venueBusinessesTable: {},
  venueMembershipsTable: {},
  venueMembershipAuditTable: {},
}));

vi.mock("../middlewares/requireUid", () => ({
  requireUid: (req: { uid?: string }, _res: unknown, next: () => void) => {
    req.uid = "venue-owner-uid";
    next();
  },
}));

vi.mock("../middlewares/rateLimit", () => ({
  createUserRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  createIpRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/push", () => ({ sendPush: vi.fn().mockResolvedValue(undefined) }));

import express from "express";
import request from "supertest";
import venueOwnerRouter from "./venueOwner";

const app = express();
app.use(express.json());
app.use("/api", venueOwnerRouter);

const validApplication = {
  placeId: "google-place-1",
  placeName: "The Corner",
  businessName: "Corner Social",
  lat: 40.7128,
  lng: -74.006,
  verificationDocUrl: "https://example.com/ownership-proof.pdf",
};

const submittedProfile = {
  id: 7,
  ownerUid: "venue-owner-uid",
  ...validApplication,
  lat: String(validApplication.lat),
  lng: String(validApplication.lng),
  tagline: null,
  description: null,
  coverPhotoUrl: null,
  logoUrl: null,
  registrationNotes: null,
  isApproved: false,
  isVerified: false,
  rejectionReason: null,
  applicationStatus: "submitted",
  submittedAt: new Date(),
  reviewedAt: null,
  approvedAt: null,
  rejectedAt: null,
  withdrawnAt: null,
  expiredAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.resetAllMocks();
  dbMocks.chain.select.mockReturnThis();
  dbMocks.chain.from.mockReturnThis();
  dbMocks.chain.where.mockReturnThis();
  dbMocks.chain.orderBy.mockReturnThis();
  dbMocks.chain.limit.mockResolvedValue([]);
  dbMocks.chain.insert.mockReturnThis();
  dbMocks.chain.values.mockResolvedValue(undefined);
  dbMocks.chain.update.mockReturnThis();
  dbMocks.chain.set.mockReturnThis();
  dbMocks.chain.returning
    .mockResolvedValueOnce([submittedProfile])
    .mockResolvedValue([]);
});

describe("venue application lifecycle", () => {
  it("rejects whitespace-only venue details before any database write", async () => {
    const response = await request(app)
      .post("/api/venue-owner/register")
      .send({ ...validApplication, placeId: "   " });

    expect(response.status).toBe(400);
    expect(dbMocks.chain.insert).not.toHaveBeenCalled();
  });

  it("requires a verification document and valid coordinates", async () => {
    const response = await request(app)
      .post("/api/venue-owner/register")
      .send({ ...validApplication, verificationDocUrl: undefined, lat: 91 });

    expect(response.status).toBe(400);
    expect(dbMocks.chain.insert).not.toHaveBeenCalled();
  });

  it("returns applicant-safe status history without internal notes", async () => {
    dbMocks.chain.limit
      .mockResolvedValueOnce([submittedProfile])
      .mockResolvedValueOnce([]);
    dbMocks.chain.orderBy.mockResolvedValueOnce([
      {
        id: 1,
        eventType: "submitted",
        fromStatus: null,
        toStatus: "submitted",
        applicantMessage: "Application submitted for review.",
        createdAt: new Date(),
      },
    ]);

    const response = await request(app).get("/api/venue-owner/me/application");

    expect(response.status).toBe(200);
    expect(response.body.application.status).toBe("submitted");
    expect(response.body.history).toHaveLength(1);
    expect(response.body.history[0].internalNote).toBeUndefined();
  });

  it("refuses to resubmit an application that is still awaiting review", async () => {
    dbMocks.chain.limit.mockResolvedValueOnce([
      { id: 7, applicationStatus: "submitted" },
    ]);

    const response = await request(app)
      .post("/api/venue-owner/reapply")
      .send(validApplication);

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/declined or sent back for changes/i);
  });

  it("lets an applicant resubmit after the reviewer asked for changes", async () => {
    dbMocks.chain.limit
      .mockResolvedValueOnce([{ id: 7, applicationStatus: "changes_requested" }])
      // No other owner holds the place.
      .mockResolvedValueOnce([]);
    dbMocks.chain.returning.mockReset();
    dbMocks.chain.returning.mockResolvedValue([
      { ...submittedProfile, applicationStatus: "resubmitted" },
    ]);

    const response = await request(app)
      .post("/api/venue-owner/reapply")
      .send(validApplication);

    expect(response.status).toBe(200);
    expect(response.body.profile.status).toBe("resubmitted");
    expect(dbMocks.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "resubmitted",
        fromStatus: "changes_requested",
        toStatus: "resubmitted",
      }),
    );
  });

  it("does not record a resubmission if the status changes before its guarded update", async () => {
    dbMocks.chain.limit
      .mockResolvedValueOnce([{ id: 7, applicationStatus: "changes_requested" }])
      .mockResolvedValueOnce([]);
    dbMocks.chain.returning.mockReset();
    dbMocks.chain.returning.mockResolvedValue([]);

    const response = await request(app)
      .post("/api/venue-owner/reapply")
      .send(validApplication);

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/changed while you were updating/i);
    expect(dbMocks.chain.values).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "resubmitted" }),
    );
  });

  it("does not expose legacy header-secret review endpoints", async () => {
    const response = await request(app)
      .get("/api/admin/venue-owner/pending")
      .set("x-admin-secret", "anything");

    expect(response.status).toBe(404);
  });
});

describe("web application duplicate submission guard", () => {
  const validWebApplication = {
    contactEmail: "owner@example.com",
    contactName: "Jane Doe",
    placeId: "google-place-web-1",
    placeName: "The Web Venue",
    businessName: "Web Venue Co",
    lat: 51.5074,
    lng: -0.1278,
    verificationDocUrl: "https://example.com/doc.pdf",
  };

  it("rejects a second pending application from the same email and venue with 409", async () => {
    // The email+placeId duplicate check runs first and finds an existing pending row.
    // placeIsClaimedByAnotherOwner is never reached, and no insert is attempted.
    dbMocks.chain.limit.mockResolvedValueOnce([{ id: 42 }]);

    const response = await request(app)
      .post("/api/venue-owner/apply")
      .send(validWebApplication);

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already have a pending application/i);
    expect(dbMocks.chain.insert).not.toHaveBeenCalled();
  });

  it("allows a first-time application when no pending record exists for that email and venue", async () => {
    // First limit call: email+placeId duplicate check — no existing row for this email+venue.
    // Second limit call: placeIsClaimedByAnotherOwner — no other owner holds this venue.
    dbMocks.chain.limit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    // The insert chain needs values() to return the chain so .returning() is reachable.
    dbMocks.chain.values.mockReturnThis();
    dbMocks.chain.returning.mockReset();
    dbMocks.chain.returning
      .mockResolvedValueOnce([{ id: 55, applicationStatus: "submitted" }])
      .mockResolvedValue([]);

    const response = await request(app)
      .post("/api/venue-owner/apply")
      .send(validWebApplication);

    expect(response.status).toBe(201);
    expect(response.body.applicationId).toBe(55);
  });
});

describe("venue search and expiry safeguards", () => {
  const originalGoogleApiKey = process.env["GOOGLE_API_KEY"];
  const originalCronSecret = process.env["CRON_SECRET"];

  afterAll(() => {
    if (originalGoogleApiKey === undefined) delete process.env["GOOGLE_API_KEY"];
    else process.env["GOOGLE_API_KEY"] = originalGoogleApiKey;
    if (originalCronSecret === undefined) delete process.env["CRON_SECRET"];
    else process.env["CRON_SECRET"] = originalCronSecret;
  });

  it("returns a deliberate configuration error when Google Places is unavailable", async () => {
    delete process.env["GOOGLE_API_KEY"];

    const response = await request(app)
      .get("/api/venue-owner/places/search")
      .query({ query: "Corner Social" });

    expect(response.status).toBe(503);
    expect(response.body.message).toMatch(/not configured/i);
  });

  it("returns a deliberate upstream error when Google Places fails", async () => {
    process.env["GOOGLE_API_KEY"] = "test-google-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: vi.fn(),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app)
      .get("/api/venue-owner/places/search")
      .query({ query: "Corner Social" });

    expect(response.status).toBe(503);
    expect(response.body.message).toMatch(/temporarily unavailable/i);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://places.googleapis.com/v1/places:searchText",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Goog-Api-Key": "test-google-key" }),
      }),
    );
    vi.unstubAllGlobals();
  });

  it("maps valid Google Places results and drops incomplete places", async () => {
    process.env["GOOGLE_API_KEY"] = "test-google-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        places: [
          {
            id: "place-complete",
            displayName: { text: "The Corner" },
            formattedAddress: "1 Main Street",
            primaryTypeDisplayName: { text: "Bar" },
            googleMapsUri: "https://maps.google.com/?cid=1",
            location: { latitude: 40.7, longitude: -74 },
          },
          {
            id: "place-without-location",
            displayName: { text: "Incomplete Result" },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app)
      .get("/api/venue-owner/places/search")
      .query({ query: "Corner Social", lat: "40.7", lng: "-74" });

    expect(response.status).toBe(200);
    expect(response.body.places).toEqual([
      expect.objectContaining({
        placeId: "place-complete",
        placeName: "The Corner",
        lat: 40.7,
        lng: -74,
      }),
    ]);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain("locationBias");
    vi.unstubAllGlobals();
  });

  it("rejects invalid search input before contacting Google Places", async () => {
    process.env["GOOGLE_API_KEY"] = "test-google-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app)
      .get("/api/venue-owner/places/search")
      .query({ query: "x", lat: "not-a-number" });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("requires the cron secret for stale-application expiry", async () => {
    delete process.env["CRON_SECRET"];

    const response = await request(app).post("/api/venue-owner/expire-pending-claims");

    expect(response.status).toBe(503);
    expect(dbMocks.chain.select).not.toHaveBeenCalled();
  });

  it("expires stale submitted applications and appends an audit event", async () => {
    process.env["CRON_SECRET"] = "test-cron-secret";
    dbMocks.chain.where.mockResolvedValueOnce([
      { id: 7, placeId: "google-place-1", applicationStatus: "submitted" },
    ]);

    const response = await request(app)
      .post("/api/venue-owner/expire-pending-claims")
      .set("x-cron-secret", "test-cron-secret");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      expired: 1,
      placeIds: ["google-place-1"],
    });
    expect(dbMocks.chain.update).toHaveBeenCalled();
    expect(dbMocks.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "expired",
        fromStatus: "submitted",
        toStatus: "expired",
        actorRole: "system",
      }),
    );
  });
});

describe("map layer — GET /api/hubs/venue-owners", () => {
  const approvedProfile = {
    id: 1,
    placeId: "place-123",
    placeName: "The Corner Bar",
    businessName: "Corner Social",
    tagline: "Come as you are",
    logoUrl: null,
    lat: "40.7128",
    lng: "-74.0060",
    isApproved: true,
    isVerified: true,
    applicationStatus: "approved",
  };

  it("returns approved venues with valid coordinates", async () => {
    // The profile query is `db.select().from().where()` — no trailing .limit(),
    // so we resolve the where() call directly to the profile array for this test.
    // The rewards and events sub-queries each call .where().limit(), so subsequent
    // where() calls keep returning the chain and limit() resolves to empty arrays.
    dbMocks.chain.where
      .mockResolvedValueOnce([approvedProfile]) // profile query
      .mockReturnThis() // rewards .where() → chain → .limit() below
      .mockReturnThis(); // events .where() → chain → .limit() below
    dbMocks.chain.limit
      .mockResolvedValueOnce([]) // no active rewards
      .mockResolvedValueOnce([]); // no upcoming events

    const response = await request(app).get("/api/hubs/venue-owners");

    expect(response.status).toBe(200);
    expect(response.body.venues).toHaveLength(1);
    expect(response.body.venues[0]).toMatchObject({
      placeId: "place-123",
      placeName: "The Corner Bar",
      lat: 40.7128,
      lng: -74.006,
      hasActiveReward: false,
      hasUpcomingEvent: false,
    });
  });

  it("excludes venues whose coordinates are missing", async () => {
    dbMocks.chain.where
      .mockResolvedValueOnce([{ ...approvedProfile, lat: null, lng: null }])
      .mockReturnThis()
      .mockReturnThis();
    dbMocks.chain.limit
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const response = await request(app).get("/api/hubs/venue-owners");

    expect(response.status).toBe(200);
    expect(response.body.venues).toHaveLength(0);
  });

  it("returns an empty list when no approved venues exist", async () => {
    // Profile query returns no profiles; no sub-queries are made.
    dbMocks.chain.where.mockResolvedValueOnce([]);

    const response = await request(app).get("/api/hubs/venue-owners");

    expect(response.status).toBe(200);
    expect(response.body.venues).toEqual([]);
  });

  it("queries with isApproved, isVerified, and applicationStatus='approved' filters", async () => {
    // The profile query must guard on all three status columns so that revoked
    // venues (applicationStatus != 'approved') cannot appear on the map even if
    // isApproved were somehow stale.
    dbMocks.chain.where.mockResolvedValueOnce([]);

    await request(app).get("/api/hubs/venue-owners");

    // The mock table exposes column names as plain strings so drizzle's eq()
    // builds SQL nodes referencing those strings. Serialise the where() call
    // arguments and assert all three guard columns are present.
    const whereArgs = dbMocks.chain.where.mock.calls.map((c: unknown[]) => JSON.stringify(c));
    const profileWhereCall = whereArgs.find(
      (s: string) =>
        s.includes("isApproved") && s.includes("isVerified") && s.includes("applicationStatus"),
    );
    expect(profileWhereCall).toBeDefined();
  });
});

describe("membership revocation gates — event, reward, and announcement writes", () => {
  const futureIso = new Date(Date.now() + 86400000).toISOString();
  const laterIso = new Date(Date.now() + 172800000).toISOString();

  const validEvent = {
    title: "Friday Night Social",
    startsAt: futureIso,
  };

  const validReward = {
    title: "Free Drink",
    prizeDescription: "One complimentary drink",
    startDate: futureIso,
    endDate: laterIso,
  };

  const validAnnouncement = {
    title: "Happy Hour Extended",
    body: "We are staying open late tonight!",
  };

  /**
   * Simulate an active membership + approved business + approved profile so
   * that requireVenueAccess succeeds and the route can reach the DB insert.
   *
   * loadVenueAccess query sequence:
   *   1. db.select().from(memberships).where()          → membership array
   *   2. db.select().from(businesses).where().limit(1)  → business row
   *   3. db.select().from(profiles).where().limit(1)    → profile row
   * then the route does db.insert().values().returning().
   */
  function mockActiveAccess() {
    dbMocks.chain.where.mockResolvedValueOnce([
      { uid: "venue-owner-uid", status: "active", role: "owner", businessId: 1 },
    ]);
    // subsequent where() calls (business + profile) fall back to .mockReturnThis()
    dbMocks.chain.limit
      .mockResolvedValueOnce([
        { id: 1, placeId: "place-1", isActive: true, venueOwnerProfileId: 99 },
      ])
      .mockResolvedValueOnce([
        { id: 99, placeId: "place-1", ownerUid: "venue-owner-uid", isApproved: true, applicationStatus: "approved" },
      ]);
    // Make the insert chain work: values() must return `this` so .returning() is reachable.
    dbMocks.chain.values.mockReturnThis();
    dbMocks.chain.returning.mockReset();
    dbMocks.chain.returning.mockResolvedValue([{ id: 42, title: "test" }]);
  }

  /**
   * Simulate a revoked or inactive membership: the status='active' filter in
   * loadVenueAccess returns no rows.  The legacy owner fallback also returns
   * nothing, so requireVenueAccess resolves to null → 403.
   *
   * The FIRST where() call is resolved to [] (no active memberships).
   * All subsequent where() calls fall back to .mockReturnThis() (beforeEach
   * default), so the legacy-path limit(1) correctly resolves to [] via the
   * beforeEach limit default.
   */
  function mockRevokedAccess() {
    dbMocks.chain.where.mockResolvedValueOnce([]); // no active memberships
    // legacy fallback: where() → chain (default), limit() → [] (default)
  }

  // ── event creation ────────────────────────────────────────────────────────

  it("blocks event creation when the caller has a revoked membership", async () => {
    mockRevokedAccess();

    const response = await request(app)
      .post("/api/venue-owner/me/events")
      .send(validEvent);

    expect(response.status).toBe(403);
    expect(dbMocks.chain.insert).not.toHaveBeenCalled();
  });

  it("blocks event creation when the caller has an inactive membership", async () => {
    // inactive and revoked both produce an empty active-membership query result
    mockRevokedAccess();

    const response = await request(app)
      .post("/api/venue-owner/me/events")
      .send(validEvent);

    expect(response.status).toBe(403);
    expect(dbMocks.chain.insert).not.toHaveBeenCalled();
  });

  it("allows event creation when the caller has an active membership", async () => {
    mockActiveAccess();

    const response = await request(app)
      .post("/api/venue-owner/me/events")
      .send(validEvent);

    expect(response.status).toBe(201);
    expect(dbMocks.chain.insert).toHaveBeenCalled();
  });

  // ── reward creation ───────────────────────────────────────────────────────

  it("blocks reward creation when the caller has a revoked membership", async () => {
    mockRevokedAccess();

    const response = await request(app)
      .post("/api/venue-owner/me/rewards")
      .send(validReward);

    expect(response.status).toBe(403);
    expect(dbMocks.chain.insert).not.toHaveBeenCalled();
  });

  it("allows reward creation when the caller has an active membership", async () => {
    mockActiveAccess();

    const response = await request(app)
      .post("/api/venue-owner/me/rewards")
      .send(validReward);

    expect(response.status).toBe(201);
    expect(dbMocks.chain.insert).toHaveBeenCalled();
  });

  // ── announcement creation ─────────────────────────────────────────────────

  it("blocks announcement creation when the caller has a revoked membership", async () => {
    mockRevokedAccess();

    const response = await request(app)
      .post("/api/venue-owner/me/announcements")
      .send(validAnnouncement);

    expect(response.status).toBe(403);
    expect(dbMocks.chain.insert).not.toHaveBeenCalled();
  });

  it("allows announcement creation when the caller has an active membership", async () => {
    mockActiveAccess();

    const response = await request(app)
      .post("/api/venue-owner/me/announcements")
      .send(validAnnouncement);

    expect(response.status).toBe(201);
    expect(dbMocks.chain.insert).toHaveBeenCalled();
  });
});