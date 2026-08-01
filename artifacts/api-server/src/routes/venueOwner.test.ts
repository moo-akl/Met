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
    applicationStatus: "applicationStatus",
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

  it("does not expose legacy header-secret review endpoints", async () => {
    const response = await request(app)
      .get("/api/admin/venue-owner/pending")
      .set("x-admin-secret", "anything");

    expect(response.status).toBe(404);
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