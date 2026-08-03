/**
 * Integration coverage for DELETE /admin/venue-owner/venues/:id
 *
 * Verifies that a full venue deletion cascades across all related tables,
 * that the profile and every associated row are removed, and that the
 * placeId is freed for a new applicant to claim.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env["ADMIN_SECRET"] = "test-admin-bootstrap";
process.env["SESSION_SECRET"] = "test-session-secret";

const dbMocks = vi.hoisted(() => {
  // ─── Admin credential store ────────────────────────────────────────────────
  const credTable = {
    id: "cred_id",
    passwordHash: "passwordHash",
    sessionVersion: "sessionVersion",
    lastLoginAt: "lastLoginAt",
    passwordChangedAt: "passwordChangedAt",
    failedLoginAttempts: "failedLoginAttempts",
    lockedUntil: "lockedUntil",
    updatedAt: "updatedAt",
  };
  const credState: {
    rows: Array<Record<string, unknown>>;
    pendingWrite: Record<string, unknown> | null;
  } = { rows: [], pendingWrite: null };
  const credChain: Record<string, ReturnType<typeof vi.fn>> = {} as never;
  credChain["where"] = vi.fn(() => credChain);
  credChain["limit"] = vi.fn(async () => credState.rows.map((r) => ({ ...r })));
  credChain["values"] = vi.fn((row: Record<string, unknown>) => {
    credState.pendingWrite = row;
    return credChain;
  });
  credChain["set"] = vi.fn((row: Record<string, unknown>) => {
    if (credState.rows[0]) Object.assign(credState.rows[0], row);
    return credChain;
  });
  credChain["returning"] = vi.fn(async () => {
    if (credState.pendingWrite) {
      const row = {
        id: 1,
        sessionVersion: 1,
        passwordChangedAt: new Date(),
        lastLoginAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...credState.pendingWrite,
      };
      credState.pendingWrite = null;
      credState.rows = [row];
    }
    return credState.rows.map((r) => ({ ...r }));
  });

  // ─── Distinct table tokens ─────────────────────────────────────────────────
  // (column names are arbitrary strings; we only need unique object identity)
  const profileTable = {
    id: "profile_id",
    ownerUid: "ownerUid",
    placeId: "placeId",
    placeName: "placeName",
    businessName: "businessName",
    applicationStatus: "applicationStatus",
    isApproved: "isApproved",
    isVerified: "isVerified",
    contactEmail: "contactEmail",
    submittedAt: "submittedAt",
    ne: "ne",
  };
  const bizTable = {
    id: "biz_id",
    venueOwnerProfileId: "venueOwnerProfileId",
    placeId: "biz_placeId",
    legalName: "legalName",
    isActive: "isActive",
    createdByUid: "createdByUid",
  };
  const membershipsTable = {
    id: "mem_id",
    businessId: "businessId",
    managerId: "managerId",
    uid: "uid",
    role: "role",
    status: "status",
    acceptedAt: "acceptedAt",
  };
  const eventsTable = {
    id: "event_id",
    ownerUid: "event_ownerUid",
  };

  // ─── Dedicated select chains for tables that need distinct behaviour ────────
  // profileChain: where → self (limit is the terminal call)
  const profileChain = {
    where: vi.fn(),
    limit: vi.fn(),
  };
  profileChain.where.mockReturnValue(profileChain);
  profileChain.limit.mockResolvedValue([]);

  // bizSelectChain: where → self (limit is the terminal call)
  const bizSelectChain = {
    where: vi.fn(),
    limit: vi.fn(),
  };
  bizSelectChain.where.mockReturnValue(bizSelectChain);
  bizSelectChain.limit.mockResolvedValue([]);

  // membershipsSelectChain: no .limit() — where() resolves directly
  const membershipsSelectChain = {
    where: vi.fn().mockResolvedValue([]),
  };

  // eventsSelectChain: no .limit() — where() resolves directly
  const eventsSelectChain = {
    where: vi.fn().mockResolvedValue([]),
  };

  // ─── Delete call tracker ──────────────────────────────────────────────────
  const deletedTables: unknown[] = [];

  // ─── Main chain ───────────────────────────────────────────────────────────
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
    groupBy: vi.fn().mockResolvedValue([]),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    delete: vi.fn((table: unknown) => {
      deletedTables.push(table);
      return { where: vi.fn().mockResolvedValue([]) };
    }),
    transaction: vi.fn(),
  };

  return {
    chain,
    credChain,
    credState,
    credTable,
    profileTable,
    bizTable,
    membershipsTable,
    eventsTable,
    profileChain,
    bizSelectChain,
    membershipsSelectChain,
    eventsSelectChain,
    deletedTables,
  };
});

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  venueOwnerProfilesTable: dbMocks.profileTable,
  venueApplicationHistoryTable: {
    id: "hist_id",
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
  venueAdminCredentialsTable: dbMocks.credTable,
  venueBusinessesTable: dbMocks.bizTable,
  venueMembershipsTable: dbMocks.membershipsTable,
  venueMembershipAuditTable: { id: "audit_id", businessId: "audit_businessId", membershipId: "membershipId", eventType: "eventType", subjectUid: "subjectUid", toRole: "toRole", toStatus: "toStatus", metadata: "metadata" },
  venueEventsTable: dbMocks.eventsTable,
  venueEventRsvpsTable: { id: "rsvp_id", eventId: "eventId", status: "status" },
  venueRewardsTable: { id: "reward_id", ownerUid: "reward_ownerUid" },
  venueAnnouncementsTable: { id: "ann_id", ownerUid: "ann_ownerUid" },
  venueManagerRegistrationTokensTable: { id: "reg_id", businessId: "reg_businessId" },
  venueManagersTable: { id: "mgr_id" },
  venueManagerSessionsTable: { id: "mgrsess_id", managerId: "mgrsess_managerId" },
  venueManagerTokensTable: { id: "mgrток_id", businessId: "mgrtok_businessId" },
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
vi.mock("../lib/email.js", () => ({
  sendVenueApprovedEmail: vi.fn().mockResolvedValue(undefined),
  sendVenueRejectedEmail: vi.fn().mockResolvedValue(undefined),
  sendVenueChangesRequestedEmail: vi.fn().mockResolvedValue(undefined),
}));

import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import venueOwnerRouter from "./venueOwner";

const app = express();
app.use(express.json());
app.use(cookieParser(process.env["SESSION_SECRET"]));
app.use("/api", venueOwnerRouter);

/** Creates an admin session via the bootstrap flow and returns a signed-in agent. */
async function signedInAgent() {
  const agent = request.agent(app);
  const res = await agent.post("/api/admin/venue-owner/setup").send({
    bootstrapCode: "test-admin-bootstrap",
    password: "SecurePassword1",
  });
  expect(res.status).toBe(200);
  return agent;
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

const PLACE_ID = "google-place-deletion-test";
const OWNER_UID = "deletion-test-owner-uid";
const PROFILE_ID = 42;
const BUSINESS_ID = 7;
const MANAGER_ID = 3;
const EVENT_ID = 11;

const fullProfile = {
  id: PROFILE_ID,
  ownerUid: OWNER_UID,
  placeId: PLACE_ID,
  placeName: "Deletion Test Venue",
  businessName: "Deletion Test Venue Ltd",
  applicationStatus: "approved" as const,
  isApproved: true,
  isVerified: true,
  lat: "40.7128",
  lng: "-74.006",
  tagline: null,
  description: null,
  coverPhotoUrl: null,
  logoUrl: null,
  verificationDocUrl: "https://example.com/proof.pdf",
  registrationNotes: null,
  contactEmail: null,
  contactName: null,
  applicationSource: "mobile",
  rejectionReason: null,
  phone: null,
  websiteUrl: null,
  publicEmail: null,
  openingHours: null,
  submittedAt: new Date("2026-01-01T00:00:00.000Z"),
  reviewedAt: new Date("2026-01-02T00:00:00.000Z"),
  approvedAt: new Date("2026-01-02T00:00:00.000Z"),
  rejectedAt: null,
  withdrawnAt: null,
  expiredAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

const fullBusiness = {
  id: BUSINESS_ID,
  venueOwnerProfileId: PROFILE_ID,
  placeId: PLACE_ID,
  legalName: "Deletion Test Venue Ltd",
  isActive: true,
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

// ─── beforeEach: reset mocks and wire up table dispatch ──────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Reset credential store.
  dbMocks.credState.rows = [];
  dbMocks.credState.pendingWrite = null;

  // Clear delete tracker.
  dbMocks.deletedTables.length = 0;

  // Reset per-table select chains.
  dbMocks.profileChain.where.mockReset().mockReturnValue(dbMocks.profileChain);
  dbMocks.profileChain.limit.mockReset().mockResolvedValue([]);
  dbMocks.bizSelectChain.where.mockReset().mockReturnValue(dbMocks.bizSelectChain);
  dbMocks.bizSelectChain.limit.mockReset().mockResolvedValue([]);
  dbMocks.membershipsSelectChain.where.mockReset().mockResolvedValue([]);
  dbMocks.eventsSelectChain.where.mockReset().mockResolvedValue([]);

  // Wire up the main chain.
  dbMocks.chain.select.mockReturnThis();
  dbMocks.chain.from.mockImplementation((table: unknown) => {
    if (table === dbMocks.credTable) return dbMocks.credChain;
    if (table === dbMocks.profileTable) return dbMocks.profileChain;
    if (table === dbMocks.bizTable) return dbMocks.bizSelectChain;
    if (table === dbMocks.membershipsTable) return dbMocks.membershipsSelectChain;
    if (table === dbMocks.eventsTable) return dbMocks.eventsSelectChain;
    return dbMocks.chain;
  });
  dbMocks.chain.insert.mockImplementation((table: unknown) => {
    if (table === dbMocks.credTable) return dbMocks.credChain;
    return dbMocks.chain;
  });
  dbMocks.chain.update.mockImplementation((table: unknown) => {
    if (table === dbMocks.credTable) return dbMocks.credChain;
    return dbMocks.chain;
  });
  dbMocks.chain.where.mockReturnThis();
  dbMocks.chain.orderBy.mockResolvedValue([]);
  dbMocks.chain.groupBy.mockResolvedValue([]);
  dbMocks.chain.limit.mockResolvedValue([]);
  dbMocks.chain.values.mockReturnThis();
  dbMocks.chain.onConflictDoNothing.mockReturnThis();
  dbMocks.chain.set.mockReturnThis();
  dbMocks.chain.returning.mockResolvedValue([]);
  dbMocks.chain.delete.mockImplementation((table: unknown) => {
    dbMocks.deletedTables.push(table);
    return { where: vi.fn().mockResolvedValue([]) };
  });
  dbMocks.chain.transaction.mockImplementation(
    async (cb: (tx: typeof dbMocks.chain) => unknown) => cb(dbMocks.chain),
  );
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("DELETE /admin/venue-owner/venues/:id — access control", () => {
  it("rejects the request without a valid admin session", async () => {
    const res = await request(app).delete(`/api/admin/venue-owner/venues/${PROFILE_ID}`);
    expect(res.status).toBe(401);
    expect(dbMocks.chain.delete).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-numeric profile id", async () => {
    const agent = await signedInAgent();
    const res = await agent.delete("/api/admin/venue-owner/venues/not-a-number");
    expect(res.status).toBe(400);
    expect(dbMocks.chain.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when the venue profile does not exist", async () => {
    // profileChain.limit stays at its default [] — no profile found.
    const agent = await signedInAgent();
    const res = await agent.delete(`/api/admin/venue-owner/venues/${PROFILE_ID}`);
    expect(res.status).toBe(404);
    expect(dbMocks.chain.delete).not.toHaveBeenCalled();
  });
});

describe("DELETE /admin/venue-owner/venues/:id — full cascade deletion", () => {
  it("deletes all related rows for a fully-provisioned venue and returns 200", async () => {
    // ── arrange ──────────────────────────────────────────────────────────────
    // Pre-tx: profile lookup returns the full profile.
    dbMocks.profileChain.limit.mockResolvedValueOnce([fullProfile]);

    // In-tx: business lookup returns the business.
    dbMocks.bizSelectChain.limit.mockResolvedValueOnce([fullBusiness]);

    // In-tx: first memberships query returns one manager.
    // In-tx: second memberships query (stillAttached check) returns empty —
    //        the manager has no other business, so it becomes an orphan.
    dbMocks.membershipsSelectChain.where
      .mockResolvedValueOnce([{ managerId: MANAGER_ID }])
      .mockResolvedValueOnce([]);

    // In-tx: owned events query returns one event.
    dbMocks.eventsSelectChain.where.mockResolvedValueOnce([{ id: EVENT_ID }]);

    // ── act ───────────────────────────────────────────────────────────────────
    const agent = await signedInAgent();
    const res = await agent.delete(`/api/admin/venue-owner/venues/${PROFILE_ID}`);

    // ── assert: HTTP ─────────────────────────────────────────────────────────
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted successfully/i);

    // ── assert: every related table was targeted by a delete call ─────────────
    // The 13 delete operations expected (order-independent check):
    const { chain } = dbMocks;
    expect(chain.delete).toHaveBeenCalledTimes(13);

    const { venueManagerSessionsTable, venueManagerTokensTable, venueManagerRegistrationTokensTable,
            venueMembershipAuditTable, venueMembershipsTable, venueManagersTable, venueBusinessesTable,
            venueEventRsvpsTable, venueEventsTable, venueRewardsTable, venueAnnouncementsTable,
            venueApplicationHistoryTable, venueOwnerProfilesTable } = await import("@workspace/db");

    for (const table of [
      venueManagerSessionsTable,
      venueManagerTokensTable,
      venueManagerRegistrationTokensTable,
      venueMembershipAuditTable,
      venueMembershipsTable,
      venueManagersTable,
      venueBusinessesTable,
      venueEventRsvpsTable,
      venueEventsTable,
      venueRewardsTable,
      venueAnnouncementsTable,
      venueApplicationHistoryTable,
      venueOwnerProfilesTable,
    ]) {
      expect(chain.delete).toHaveBeenCalledWith(table);
    }
  });

  it("still deletes all rows when the venue has no business record (pre-approval profile)", async () => {
    // Profile exists but was never approved → no business record, no managers.
    const pendingProfile = { ...fullProfile, isApproved: false, applicationStatus: "submitted" as const };
    dbMocks.profileChain.limit.mockResolvedValueOnce([pendingProfile]);
    // bizSelectChain.limit stays at default [] — no business.
    // eventsSelectChain.where stays at default [] — no events.

    const agent = await signedInAgent();
    const res = await agent.delete(`/api/admin/venue-owner/venues/${PROFILE_ID}`);

    expect(res.status).toBe(200);
    // Without a business, the manager-related tables are not touched.
    const { venueOwnerProfilesTable, venueApplicationHistoryTable,
            venueEventsTable, venueRewardsTable, venueAnnouncementsTable } = await import("@workspace/db");
    for (const table of [venueOwnerProfilesTable, venueApplicationHistoryTable, venueEventsTable, venueRewardsTable, venueAnnouncementsTable]) {
      expect(dbMocks.chain.delete).toHaveBeenCalledWith(table);
    }
    // Manager-scoped tables must NOT have been deleted.
    const { venueManagerSessionsTable, venueManagerTokensTable, venueManagerRegistrationTokensTable,
            venueMembershipAuditTable, venueMembershipsTable, venueManagersTable, venueBusinessesTable } = await import("@workspace/db");
    for (const table of [venueManagerSessionsTable, venueManagerTokensTable, venueManagerRegistrationTokensTable,
                         venueMembershipAuditTable, venueMembershipsTable, venueManagersTable, venueBusinessesTable]) {
      expect(dbMocks.chain.delete).not.toHaveBeenCalledWith(table);
    }
  });

  it("skips RSVPs when the venue has no events", async () => {
    dbMocks.profileChain.limit.mockResolvedValueOnce([fullProfile]);
    dbMocks.bizSelectChain.limit.mockResolvedValueOnce([fullBusiness]);
    // memberships: owner only, no manager IDs
    dbMocks.membershipsSelectChain.where
      .mockResolvedValueOnce([{ managerId: null }])
      .mockResolvedValueOnce([]);
    // eventsSelectChain: no events
    dbMocks.eventsSelectChain.where.mockResolvedValueOnce([]);

    const agent = await signedInAgent();
    const res = await agent.delete(`/api/admin/venue-owner/venues/${PROFILE_ID}`);

    expect(res.status).toBe(200);
    // RSVPs must not have been deleted (no events to source event IDs from).
    const { venueEventRsvpsTable } = await import("@workspace/db");
    expect(dbMocks.chain.delete).not.toHaveBeenCalledWith(venueEventRsvpsTable);
    // Events table itself still gets a delete (WHERE ownerUid = ...).
    const { venueEventsTable } = await import("@workspace/db");
    expect(dbMocks.chain.delete).toHaveBeenCalledWith(venueEventsTable);
  });
});

describe("DELETE /admin/venue-owner/venues/:id — idempotency and place reclaim", () => {
  it("returns 404 on a second delete of the same venue id", async () => {
    // First call finds the profile; subsequent calls find nothing.
    dbMocks.profileChain.limit
      .mockResolvedValueOnce([fullProfile])
      .mockResolvedValue([]);
    dbMocks.bizSelectChain.limit.mockResolvedValueOnce([fullBusiness]);
    dbMocks.membershipsSelectChain.where
      .mockResolvedValueOnce([{ managerId: MANAGER_ID }])
      .mockResolvedValueOnce([]);
    dbMocks.eventsSelectChain.where.mockResolvedValueOnce([{ id: EVENT_ID }]);

    const agent = await signedInAgent();

    const first = await agent.delete(`/api/admin/venue-owner/venues/${PROFILE_ID}`);
    expect(first.status).toBe(200);

    const second = await agent.delete(`/api/admin/venue-owner/venues/${PROFILE_ID}`);
    expect(second.status).toBe(404);
  });

  it("accepts a new application for the same placeId once the venue is deleted", async () => {
    // ── arrange: deletion ─────────────────────────────────────────────────────
    dbMocks.profileChain.limit.mockResolvedValueOnce([fullProfile]);
    dbMocks.bizSelectChain.limit.mockResolvedValueOnce([fullBusiness]);
    dbMocks.membershipsSelectChain.where
      .mockResolvedValueOnce([{ managerId: MANAGER_ID }])
      .mockResolvedValueOnce([]);
    dbMocks.eventsSelectChain.where.mockResolvedValueOnce([{ id: EVENT_ID }]);

    const agent = await signedInAgent();
    const deleteRes = await agent.delete(`/api/admin/venue-owner/venues/${PROFILE_ID}`);
    expect(deleteRes.status).toBe(200);

    // ── arrange: new application for same placeId ─────────────────────────────
    // After deletion the profile table has no row for this placeId.
    // Both the email-dup check and placeIsClaimedByAnotherOwner must return [].
    // profileChain.limit defaults to [] already (mockResolvedValueOnce above was consumed).

    // The insert returning a new application row so the handler can respond 201.
    dbMocks.chain.returning.mockResolvedValueOnce([
      { id: 99, applicationStatus: "submitted" },
    ]);

    // ── act ───────────────────────────────────────────────────────────────────
    const applyRes = await request(app).post("/api/venue-owner/apply").send({
      contactEmail: "new-owner@example.com",
      contactName: "New Owner",
      placeId: PLACE_ID,
      placeName: "Deletion Test Venue",
      businessName: "New Owner Co",
      lat: 40.7128,
      lng: -74.006,
      verificationDocUrl: "https://example.com/new-proof.pdf",
    });

    // ── assert ────────────────────────────────────────────────────────────────
    expect(applyRes.status).toBe(201);
    expect(applyRes.body.applicationId).toBe(99);
    expect(applyRes.body.status).toBe("submitted");
  });
});
