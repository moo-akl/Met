import { afterEach, describe, it, expect, vi } from "vitest";
import request from "supertest";

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const APPROVED_PROFILE = {
  id: 1,
  ownerUid: "uid-owner-1",
  placeId: "place-html-test",
  placeName: "The Grand Venue",
  businessName: "Grand Venue Ltd",
  tagline: "A place to be seen",
  description: "Great spot downtown",
  coverPhotoUrl: null,
  logoUrl: null,
  lat: "40.7128",
  lng: "-74.0060",
  qrToken: "valid-qr-token-html-1234",
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
// Shared mock setup — registers all vi.doMock calls before app import
// ---------------------------------------------------------------------------
function applyCommonMocks(rows: unknown[]) {
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

describe("GET /v/:placeId — QR check-in HTML page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 200 — valid token: venue name appears in the page body
  // -------------------------------------------------------------------------
  it("returns 200 HTML containing the venue name when the token matches", async () => {
    vi.resetModules();
    applyCommonMocks([APPROVED_PROFILE]);

    const app = (await import("../app")).default;

    const res = await request(app)
      .get(`/v/${APPROVED_PROFILE.placeId}`)
      .query({ t: APPROVED_PROFILE.qrToken });

    expect(res.status).toBe(200);
    expect(res.type).toMatch(/html/);
    // Venue name must appear in the page body (in the <h1> and the <title>)
    expect(res.text).toContain(APPROVED_PROFILE.placeName);
    // Must NOT be a 404 or error page
    expect(res.text).not.toContain("Venue not found");
    expect(res.text).not.toContain("Invalid check-in link");
  });

  // -------------------------------------------------------------------------
  // 200 — no token: still shows the venue name
  // -------------------------------------------------------------------------
  it("returns 200 HTML with the venue name when no token is provided", async () => {
    vi.resetModules();
    applyCommonMocks([APPROVED_PROFILE]);

    const app = (await import("../app")).default;

    const res = await request(app).get(`/v/${APPROVED_PROFILE.placeId}`);

    expect(res.status).toBe(200);
    expect(res.type).toMatch(/html/);
    expect(res.text).toContain(APPROVED_PROFILE.placeName);
  });

  // -------------------------------------------------------------------------
  // 400 — invalid token: error page shown, venue info not exposed
  // -------------------------------------------------------------------------
  it("returns 400 HTML with an error message when the token does not match", async () => {
    vi.resetModules();
    applyCommonMocks([APPROVED_PROFILE]);

    const app = (await import("../app")).default;

    const res = await request(app)
      .get(`/v/${APPROVED_PROFILE.placeId}`)
      .query({ t: "wrong-token-definitely-invalid" });

    expect(res.status).toBe(400);
    expect(res.type).toMatch(/html/);
    expect(res.text).toContain("Invalid check-in link");
    // The page should mention the venue name in the "ask staff" context but
    // must not render the full branded check-in success page.
    expect(res.text).not.toContain("Open in the Met app");
  });

  // -------------------------------------------------------------------------
  // 404 — unknown placeId: 404 page shown
  // -------------------------------------------------------------------------
  it("returns 404 HTML when no approved venue exists for the placeId", async () => {
    vi.resetModules();
    applyCommonMocks([]); // empty result — venue not found

    const app = (await import("../app")).default;

    const res = await request(app).get("/v/place-does-not-exist");

    expect(res.status).toBe(404);
    expect(res.type).toMatch(/html/);
    expect(res.text).toContain("Venue not found");
    // Must not accidentally render any venue info
    expect(res.text).not.toContain(APPROVED_PROFILE.placeName);
  });
});
