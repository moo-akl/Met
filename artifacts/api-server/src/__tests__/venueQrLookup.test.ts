import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import request from "supertest";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const APPROVED_PROFILE = {
  id: 1,
  ownerUid: "uid-owner-1",
  placeId: "place-abc123",
  placeName: "The Grand Venue",
  businessName: "Grand Venue Ltd",
  tagline: "A place to be seen",
  description: "Great spot downtown",
  coverPhotoUrl: null,
  logoUrl: null,
  lat: "40.7128",
  lng: "-74.0060",
  qrToken: "valid-token-uuid-1234",
  isApproved: true,
  isVerified: true,
  applicationStatus: "approved" as const,
  phone: null,
  websiteUrl: null,
  publicEmail: null,
  openingHours: null,
  verificationDocUrl: null,
  registrationNotes: null,
  contactEmail: null,
  contactName: null,
  applicationSource: "mobile",
  rejectionReason: null,
  submittedAt: null,
  reviewedAt: null,
  approvedAt: null,
  rejectedAt: null,
  withdrawnAt: null,
  expiredAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ---------------------------------------------------------------------------
// Helper: build a Drizzle-style select chain mock that resolves to `rows`
// ---------------------------------------------------------------------------
function makeDbMock(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return { select: vi.fn(() => chain) };
}

// ---------------------------------------------------------------------------
// Shared mock setup — registers all vi.doMock calls needed before app import
// ---------------------------------------------------------------------------
function applyCommonMocks(rows: unknown[]) {
  // pino-http requires a real pino instance; bypass it entirely
  vi.doMock("pino-http", () => ({
    default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  }));

  vi.doMock("../lib/logger", () => ({
    logger: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      fatal: vi.fn(),
      level: "silent",
    },
  }));

  vi.doMock("../middlewares/rateLimit", () => ({
    createIpRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
    createUserRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  }));

  vi.doMock("../lib/push", () => ({ sendPush: vi.fn() }));
  vi.doMock("../lib/email.js", () => ({
    sendVenueApprovedEmail: vi.fn(),
    sendVenueRejectedEmail: vi.fn(),
    sendChangesRequestedEmail: vi.fn(),
    sendVenueRegistrationConfirmationEmail: vi.fn(),
  }));

  vi.doMock("@workspace/db", () => ({
    db: makeDbMock(rows),
    venueOwnerProfilesTable: {},
    venueEventsTable: {},
    venueRewardsTable: {},
    venueAnnouncementsTable: {},
    venueApplicationHistoryTable: {},
    venueBusinessTable: {},
    venueRsvpsTable: {},
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/v/:placeId — QR venue lookup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 200 — valid QR token
  // -------------------------------------------------------------------------
  it("returns 200 with venue name when the token matches", async () => {
    vi.resetModules();
    applyCommonMocks([APPROVED_PROFILE]);

    const app = (await import("../app")).default;

    const res = await request(app)
      .get(`/api/v/${APPROVED_PROFILE.placeId}`)
      .query({ t: APPROVED_PROFILE.qrToken });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("profile");
    expect(res.body.profile.placeName).toBe(APPROVED_PROFILE.placeName);
    expect(res.body.profile.placeId).toBe(APPROVED_PROFILE.placeId);
    // qrToken must NOT be exposed in the public response
    expect(res.body.profile).not.toHaveProperty("qrToken");
  });

  // -------------------------------------------------------------------------
  // 200 — no token provided (token-free access is permitted)
  // -------------------------------------------------------------------------
  it("returns 200 with venue info when no token is provided", async () => {
    vi.resetModules();
    applyCommonMocks([APPROVED_PROFILE]);

    const app = (await import("../app")).default;

    const res = await request(app).get(`/api/v/${APPROVED_PROFILE.placeId}`);

    expect(res.status).toBe(200);
    expect(res.body.profile.placeName).toBe(APPROVED_PROFILE.placeName);
    expect(res.body.profile.businessName).toBe(APPROVED_PROFILE.businessName);
  });

  // -------------------------------------------------------------------------
  // 401 — wrong token
  // -------------------------------------------------------------------------
  it("returns 401 when the token does not match the stored qrToken", async () => {
    vi.resetModules();
    applyCommonMocks([APPROVED_PROFILE]);

    const app = (await import("../app")).default;

    const res = await request(app)
      .get(`/api/v/${APPROVED_PROFILE.placeId}`)
      .query({ t: "wrong-token-definitely-invalid" });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toMatch(/invalid|expired/i);
  });

  // -------------------------------------------------------------------------
  // 404 — unknown placeId
  // -------------------------------------------------------------------------
  it("returns 404 when no approved venue exists for the placeId", async () => {
    vi.resetModules();
    applyCommonMocks([]); // empty result — venue not found

    const app = (await import("../app")).default;

    const res = await request(app).get("/api/v/place-does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toMatch(/not found/i);
  });
});
