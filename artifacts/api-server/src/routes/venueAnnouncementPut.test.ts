/**
 * Tests for PUT /venue-owner/me/announcements/:id
 *
 * Verifies:
 *   • Successful update returns 200 with the updated announcement
 *   • imageUrl is stored/cleared correctly
 *   • Validation rejects empty title, empty body, non-URL imageUrl, and NaN id
 *   • Pin-swap: updating with isPinned=true unpins all other announcements for the venue
 *   • 404 when the announcement does not belong to the caller's venue
 *   • 403 when the caller has no active membership
 */

// ---------------------------------------------------------------------------
// Vitest hoisted mocks
// ---------------------------------------------------------------------------

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
    delete: vi.fn().mockReturnThis(),
  };
  return { chain };
});

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  venueOwnerProfilesTable: {
    id: "id",
    ownerUid: "ownerUid",
    placeId: "placeId",
    applicationStatus: "applicationStatus",
    isApproved: "isApproved",
    isVerified: "isVerified",
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
  venueAnnouncementsTable: {
    id: "id",
    placeId: "placeId",
    ownerUid: "ownerUid",
    isPinned: "isPinned",
    title: "title",
    body: "body",
    imageUrl: "imageUrl",
  },
  hubCheckinsTable: {},
  profilesTable: {},
  venueAdminCredentialsTable: {},
  venueBusinessesTable: {},
  venueMembershipsTable: {},
  venueMembershipAuditTable: {},
  salesAgentsTable: {},
  venueManagerRegistrationTokensTable: {},
  venueManagersTable: {},
  venueManagerSessionsTable: {},
  venueManagerTokensTable: {},
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
vi.mock("../lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../lib/firebaseAdmin", () => ({ adminStorage: {} }));
vi.mock("../lib/email.js", () => ({
  sendVenueApprovedEmail: vi.fn(),
  sendVenueRejectedEmail: vi.fn(),
  sendVenueChangesRequestedEmail: vi.fn(),
  sendRegistrationLinkEmail: vi.fn(),
  sendClaimLinkOverdueAlertEmail: vi.fn(),
}));
vi.mock("../lib/deleteVenueOwnerProfile", () => ({ deleteVenueOwnerProfile: vi.fn() }));

import express from "express";
import request from "supertest";
import venueOwnerRouter from "./venueOwner";

const app = express();
app.use(express.json());
app.use("/api", venueOwnerRouter);

// ---------------------------------------------------------------------------
// Re-usable DB setup helpers
// ---------------------------------------------------------------------------

/**
 * Mock an active membership + approved business + approved profile so
 * requireVenueAccess succeeds.
 *
 * loadVenueAccess query sequence:
 *   1. db.select().from(memberships).where()         → membership array
 *   2. db.select().from(businesses).where().limit(1) → business row
 *   3. db.select().from(profiles).where().limit(1)   → profile row
 * then the route fetches the existing announcement: .where().limit(1)
 */
function mockActiveAccessForEdit(
  existingAnnouncement: Record<string, unknown> = {
    id: 99,
    placeId: "place-1",
    ownerUid: "venue-owner-uid",
    title: "Old Title",
    body: "Old Body",
    imageUrl: null,
    isPinned: false,
  },
) {
  dbMocks.chain.where.mockResolvedValueOnce([
    { uid: "venue-owner-uid", status: "active", role: "owner", businessId: 1 },
  ]);
  dbMocks.chain.limit
    .mockResolvedValueOnce([
      { id: 1, placeId: "place-1", isActive: true, venueOwnerProfileId: 88 },
    ])
    .mockResolvedValueOnce([
      {
        id: 88,
        placeId: "place-1",
        ownerUid: "venue-owner-uid",
        isApproved: true,
        applicationStatus: "approved",
      },
    ])
    .mockResolvedValueOnce([existingAnnouncement]);
  dbMocks.chain.returning.mockReset();
  dbMocks.chain.returning.mockResolvedValue([existingAnnouncement]);
}

function mockRevokedAccess() {
  dbMocks.chain.where.mockResolvedValueOnce([]); // no active memberships
  // legacy fallback: where() → chain (default), limit() → [] (default)
}

// ---------------------------------------------------------------------------
// beforeEach: reset all mocks to safe defaults
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
  dbMocks.chain.select.mockReturnThis();
  dbMocks.chain.from.mockReturnThis();
  dbMocks.chain.where.mockReturnThis();
  dbMocks.chain.orderBy.mockReturnThis();
  dbMocks.chain.limit.mockResolvedValue([]);
  dbMocks.chain.insert.mockReturnThis();
  dbMocks.chain.values.mockReturnThis();
  dbMocks.chain.update.mockReturnThis();
  dbMocks.chain.set.mockReturnThis();
  dbMocks.chain.delete.mockReturnThis();
  dbMocks.chain.returning.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("PUT /api/venue-owner/me/announcements/:id — validation", () => {
  it("returns 400 when the id is not a number", async () => {
    const res = await request(app)
      .put("/api/venue-owner/me/announcements/not-a-number")
      .send({ title: "Valid Title", body: "Valid body" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid announcement id/i);
    expect(dbMocks.chain.update).not.toHaveBeenCalled();
  });

  it("returns 400 when title is an empty string", async () => {
    mockActiveAccessForEdit();

    const res = await request(app)
      .put("/api/venue-owner/me/announcements/99")
      .send({ title: "" });

    expect(res.status).toBe(400);
    expect(dbMocks.chain.update).not.toHaveBeenCalled();
  });

  it("returns 400 when imageUrl is not a valid URL", async () => {
    mockActiveAccessForEdit();

    const res = await request(app)
      .put("/api/venue-owner/me/announcements/99")
      .send({ imageUrl: "not-a-url" });

    expect(res.status).toBe(400);
    expect(dbMocks.chain.update).not.toHaveBeenCalled();
  });

  it("returns 400 when body is an empty string", async () => {
    mockActiveAccessForEdit();

    const res = await request(app)
      .put("/api/venue-owner/me/announcements/99")
      .send({ body: "" });

    expect(res.status).toBe(400);
    expect(dbMocks.chain.update).not.toHaveBeenCalled();
  });
});

describe("PUT /api/venue-owner/me/announcements/:id — access control", () => {
  it("returns 403 when the caller has a revoked membership", async () => {
    mockRevokedAccess();

    const res = await request(app)
      .put("/api/venue-owner/me/announcements/99")
      .send({ title: "Updated" });

    expect(res.status).toBe(403);
    expect(dbMocks.chain.update).not.toHaveBeenCalled();
  });

  it("returns 404 when the announcement does not belong to the caller's venue", async () => {
    // Membership resolves fine but the announcement lookup returns nothing.
    dbMocks.chain.where.mockResolvedValueOnce([
      { uid: "venue-owner-uid", status: "active", role: "owner", businessId: 1 },
    ]);
    dbMocks.chain.limit
      .mockResolvedValueOnce([
        { id: 1, placeId: "place-1", isActive: true, venueOwnerProfileId: 88 },
      ])
      .mockResolvedValueOnce([
        {
          id: 88,
          placeId: "place-1",
          ownerUid: "venue-owner-uid",
          isApproved: true,
          applicationStatus: "approved",
        },
      ])
      .mockResolvedValueOnce([]); // announcement not found

    const res = await request(app)
      .put("/api/venue-owner/me/announcements/99")
      .send({ title: "Updated" });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
    expect(dbMocks.chain.update).not.toHaveBeenCalled();
  });
});

describe("PUT /api/venue-owner/me/announcements/:id — successful update", () => {
  it("returns 200 with the updated announcement when all fields are valid", async () => {
    const updated = {
      id: 99,
      placeId: "place-1",
      ownerUid: "venue-owner-uid",
      title: "New Title",
      body: "New body text",
      imageUrl: "https://example.com/banner.jpg",
      isPinned: false,
    };
    mockActiveAccessForEdit();
    dbMocks.chain.returning.mockReset();
    dbMocks.chain.returning.mockResolvedValue([updated]);

    const res = await request(app)
      .put("/api/venue-owner/me/announcements/99")
      .send({
        title: "New Title",
        body: "New body text",
        imageUrl: "https://example.com/banner.jpg",
      });

    expect(res.status).toBe(200);
    expect(res.body.announcement).toBeDefined();
    expect(dbMocks.chain.update).toHaveBeenCalled();
    expect(dbMocks.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New Title",
        body: "New body text",
        imageUrl: "https://example.com/banner.jpg",
      }),
    );
  });

  it("clears imageUrl when null is sent", async () => {
    const existing = {
      id: 99,
      placeId: "place-1",
      ownerUid: "venue-owner-uid",
      title: "Title",
      body: "Body",
      imageUrl: "https://example.com/old.jpg",
      isPinned: false,
    };
    mockActiveAccessForEdit(existing);
    dbMocks.chain.returning.mockReset();
    dbMocks.chain.returning.mockResolvedValue([{ ...existing, imageUrl: null }]);

    const res = await request(app)
      .put("/api/venue-owner/me/announcements/99")
      .send({ imageUrl: null });

    expect(res.status).toBe(200);
    expect(dbMocks.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ imageUrl: null }),
    );
  });

  it("accepts a partial update with only imageUrl", async () => {
    const existing = {
      id: 99,
      placeId: "place-1",
      ownerUid: "venue-owner-uid",
      title: "Title",
      body: "Body",
      imageUrl: null,
      isPinned: false,
    };
    mockActiveAccessForEdit(existing);
    dbMocks.chain.returning.mockReset();
    dbMocks.chain.returning.mockResolvedValue([
      { ...existing, imageUrl: "https://cdn.example.com/img.jpg" },
    ]);

    const res = await request(app)
      .put("/api/venue-owner/me/announcements/99")
      .send({ imageUrl: "https://cdn.example.com/img.jpg" });

    expect(res.status).toBe(200);
    expect(dbMocks.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ imageUrl: "https://cdn.example.com/img.jpg" }),
    );
  });

  it("does not overwrite title or body when they are omitted from the payload", async () => {
    mockActiveAccessForEdit();

    const res = await request(app)
      .put("/api/venue-owner/me/announcements/99")
      .send({ imageUrl: "https://example.com/new.jpg" });

    expect(res.status).toBe(200);
    // set() should NOT contain title or body keys because they were omitted
    const setArgs = dbMocks.chain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArgs?.["title"]).toBeUndefined();
    expect(setArgs?.["body"]).toBeUndefined();
    expect(setArgs?.["imageUrl"]).toBe("https://example.com/new.jpg");
  });
});

describe("PUT /api/venue-owner/me/announcements/:id — pin-swap behaviour", () => {
  it("unpins all other venue announcements before pinning the target one", async () => {
    const existing = {
      id: 99,
      placeId: "place-1",
      ownerUid: "venue-owner-uid",
      title: "Title",
      body: "Body",
      imageUrl: null,
      isPinned: false,
    };
    mockActiveAccessForEdit(existing);
    dbMocks.chain.returning.mockReset();
    dbMocks.chain.returning.mockResolvedValue([{ ...existing, isPinned: true }]);

    const res = await request(app)
      .put("/api/venue-owner/me/announcements/99")
      .send({ isPinned: true });

    expect(res.status).toBe(200);

    // The route must have called update() at least twice:
    //   1st: unpin all others (set isPinned=false where id != 99)
    //   2nd: apply the actual update
    const updateCalls = dbMocks.chain.update.mock.calls.length;
    expect(updateCalls).toBeGreaterThanOrEqual(2);

    // The first set() call should set isPinned=false (the unpin sweep)
    const firstSetArgs = dbMocks.chain.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstSetArgs?.["isPinned"]).toBe(false);

    // The second set() call should include the caller's isPinned=true
    const secondSetArgs = dbMocks.chain.set.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(secondSetArgs?.["isPinned"]).toBe(true);
  });

  it("does NOT unpin other announcements when isPinned is not in the payload", async () => {
    mockActiveAccessForEdit();

    const res = await request(app)
      .put("/api/venue-owner/me/announcements/99")
      .send({ title: "Just a title update" });

    expect(res.status).toBe(200);

    // Only one update() call (the announcement itself)
    expect(dbMocks.chain.update.mock.calls.length).toBe(1);
  });

  it("does NOT unpin others when isPinned=false is sent", async () => {
    mockActiveAccessForEdit({ id: 99, placeId: "place-1", ownerUid: "venue-owner-uid", isPinned: true, title: "t", body: "b", imageUrl: null });

    const res = await request(app)
      .put("/api/venue-owner/me/announcements/99")
      .send({ isPinned: false });

    expect(res.status).toBe(200);
    // Only one update() for the announcement itself — no unpin sweep
    expect(dbMocks.chain.update.mock.calls.length).toBe(1);
  });
});
