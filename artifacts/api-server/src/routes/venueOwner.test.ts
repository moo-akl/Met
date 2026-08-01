import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("allows only rejected applications to be resubmitted", async () => {
    dbMocks.chain.limit.mockResolvedValueOnce([
      { id: 7, applicationStatus: "submitted" },
    ]);

    const response = await request(app)
      .post("/api/venue-owner/reapply")
      .send(validApplication);

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/rejected/i);
  });

  it("does not expose legacy header-secret review endpoints", async () => {
    const response = await request(app)
      .get("/api/admin/venue-owner/pending")
      .set("x-admin-secret", "anything");

    expect(response.status).toBe(404);
  });
});