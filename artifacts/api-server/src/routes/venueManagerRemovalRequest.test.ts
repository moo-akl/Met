/**
 * Venue Manager — removal-request route tests.
 *
 * Verifies that:
 *   1. Posting a valid removal request returns 201 and records the event in
 *      the application history.
 *   2. `sendAdminVenueRemovalRequestEmail` is called (via the fire-and-forget
 *      dynamic import) with the correct `to`, and that nodemailer's sendMail
 *      receives the expected subject and key body content.
 *   3. The 201 is still returned even when sendMail rejects, confirming the
 *      fire-and-forget wrapper swallows errors.
 *   4. Unauthenticated or CSRF-less requests are rejected before any email is
 *      attempted.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

// ---------------------------------------------------------------------------
// Environment — must be set before any module under test is imported.
// ---------------------------------------------------------------------------

process.env["SESSION_SECRET"] = "test-session-secret-565";
process.env["SMTP_HOST"] = "smtp.example.com";
process.env["SMTP_PORT"] = "587";
process.env["SMTP_USER"] = "noreply@example.com";
process.env["SMTP_PASS"] = "test-smtp-pass";
process.env["SMTP_FROM"] = '"Met Venues" <noreply@example.com>';

// ---------------------------------------------------------------------------
// nodemailer mock — must be declared before any import that loads nodemailer.
// ---------------------------------------------------------------------------

const mockSendMail = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ messageId: "test-msg-id" }),
);

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
  },
}));

// ---------------------------------------------------------------------------
// Rate-limit bypass (not the focus of this test suite).
// ---------------------------------------------------------------------------

vi.mock("../middlewares/rateLimit", () => ({
  createIpRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  createUserRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// ---------------------------------------------------------------------------
// Database mock — single chained object; individual tests drive per-call
// return values via mockResolvedValueOnce.
// ---------------------------------------------------------------------------

const dbMocks = vi.hoisted(() => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
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

vi.mock("@workspace/db", () => ({
  db: dbMocks.chain,
  // Tables are used as opaque tokens in the mock (only identity matters).
  venueManagerSessionsTable: { id: "id", tokenHash: "tokenHash", managerId: "managerId", csrfTokenHash: "csrfTokenHash", revokedAt: "revokedAt", expiresAt: "expiresAt" },
  venueManagersTable: { id: "id", email: "email", displayName: "displayName", passwordHash: "passwordHash", failedLoginAttempts: "failedLoginAttempts", lockedUntil: "lockedUntil", lastLoginAt: "lastLoginAt", updatedAt: "updatedAt" },
  venueMembershipsTable: { id: "id", managerId: "managerId", businessId: "businessId", role: "role", status: "status", acceptedAt: "acceptedAt" },
  venueMembershipAuditTable: { id: "id", businessId: "businessId", eventType: "eventType" },
  venueBusinessesTable: { id: "id", venueOwnerProfileId: "venueOwnerProfileId", placeId: "placeId", legalName: "legalName", isActive: "isActive", createdByUid: "createdByUid" },
  venueOwnerProfilesTable: { id: "id", ownerUid: "ownerUid", placeId: "placeId", businessName: "businessName", placeName: "placeName", applicationStatus: "applicationStatus", isApproved: "isApproved", contactEmail: "contactEmail", qrToken: "qrToken" },
  venueApplicationHistoryTable: { id: "id", venueOwnerProfileId: "venueOwnerProfileId", eventType: "eventType", fromStatus: "fromStatus", actorRole: "actorRole", applicantMessage: "applicantMessage", metadata: "metadata" },
  venueEventsTable: {},
  venueEventRsvpsTable: {},
  venueRewardsTable: {},
  venueAnnouncementsTable: {},
  venueManagerTokensTable: {},
  hubCheckinsTable: {},
  profilesTable: {},
  venueQrVerificationsTable: {},
}));

// ---------------------------------------------------------------------------
// requireUid mock — claim route only; not used in these tests but imported by
// the router module.
// ---------------------------------------------------------------------------

vi.mock("../middlewares/requireUid", () => ({
  requireUid: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// ---------------------------------------------------------------------------
// Session / CSRF helpers
// ---------------------------------------------------------------------------

const SESSION_SECRET = process.env["SESSION_SECRET"]!;
const RAW_SESSION_TOKEN = "test-raw-session-token-abc123";
const RAW_CSRF_TOKEN = "test-csrf-token-xyz789";

/** Replicates express cookie-parser's signing algorithm (cookie-signature). */
function signCookieValue(val: string, secret: string): string {
  const sig = crypto
    .createHmac("sha256", secret)
    .update(val)
    .digest("base64")
    .replace(/=+$/, "");
  return `s:${val}.${sig}`;
}

/** Replicates the hashOpaque helper used by the venueManager router. */
function hashOpaque(value: string): string {
  return crypto.createHash("sha256").update(value).digest("base64url");
}

const SIGNED_COOKIE = signCookieValue(RAW_SESSION_TOKEN, SESSION_SECRET);
const SESSION_TOKEN_HASH = hashOpaque(RAW_SESSION_TOKEN);
const CSRF_TOKEN_HASH = hashOpaque(RAW_CSRF_TOKEN);

const BUSINESS_ID = 42;

/** A mock session row returned by the DB. */
const mockSessionRow = {
  id: 1,
  managerId: 7,
  tokenHash: SESSION_TOKEN_HASH,
  csrfTokenHash: CSRF_TOKEN_HASH,
  revokedAt: null,
  expiresAt: new Date(Date.now() + 3_600_000),
};

/** A mock membership row: manager 7 owns business 42. */
const mockMembershipRow = {
  id: 10,
  managerId: 7,
  businessId: BUSINESS_ID,
  role: "owner",
  status: "active",
};

/** A mock business row used for the isActive check inside activeMembership. */
const mockBusinessRow = { id: BUSINESS_ID, isActive: true };

/** A mock business+profile join row returned by businessWithProfile. */
const mockBusinessWithProfile = {
  business: {
    id: BUSINESS_ID,
    placeId: "place-abc",
    legalName: "Corner Social Ltd",
    isActive: true,
    createdByUid: "uid-owner",
  },
  profile: {
    id: 1,
    ownerUid: "uid-owner",
    businessName: "Corner Social",
    placeName: "The Corner",
    applicationStatus: "approved",
    isApproved: true,
    contactEmail: "owner@example.com",
  },
};

// ---------------------------------------------------------------------------
// Test app
// ---------------------------------------------------------------------------

import venueManagerRouter from "./venueManager";

const SESSION_COOKIE = "met_venue_manager";

function buildApp() {
  const app = express();
  app.use(cookieParser(SESSION_SECRET));
  app.use(express.json());
  app.use("/api", venueManagerRouter);
  return app;
}

const app = buildApp();

/** Returns a supertest request pre-loaded with a valid signed session cookie. */
function authed() {
  return request(app)
    .post(`/api/venue-manager/businesses/${BUSINESS_ID}/removal-request`)
    .set("Cookie", `${SESSION_COOKIE}=${encodeURIComponent(SIGNED_COOKIE)}`)
    .set("x-csrf-token", RAW_CSRF_TOKEN);
}

// ---------------------------------------------------------------------------
// Per-test DB fixture reset + default sequence
// ---------------------------------------------------------------------------

function seedHappyPathDb() {
  // Reset chain stubs.
  dbMocks.chain.select.mockReturnThis();
  dbMocks.chain.from.mockReturnThis();
  dbMocks.chain.innerJoin.mockReturnThis();
  dbMocks.chain.where.mockReturnThis();
  dbMocks.chain.limit
    // 1. Session token lookup (getSession → venueManagerSessionsTable)
    .mockResolvedValueOnce([mockSessionRow])
    // 2. Manager existence check (getSession → venueManagersTable)
    .mockResolvedValueOnce([{ id: 7 }])
    // 3. Membership lookup (activeMembership → venueMembershipsTable)
    .mockResolvedValueOnce([mockMembershipRow])
    // 4. Business isActive check (activeMembership → venueBusinessesTable)
    .mockResolvedValueOnce([mockBusinessRow])
    // 5. Business+profile join (businessWithProfile)
    .mockResolvedValueOnce([mockBusinessWithProfile])
    // Fallback: any unexpected extra query returns empty.
    .mockResolvedValue([]);
  dbMocks.chain.insert.mockReturnThis();
  dbMocks.chain.values.mockResolvedValue(undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  seedHappyPathDb();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /venue-manager/businesses/:businessId/removal-request", () => {
  describe("happy path", () => {
    it("returns 201 and records the removal request in the history table", async () => {
      const res = await authed().send({ reason: "Closing permanently" });

      expect(res.status).toBe(201);
      expect(res.body.message).toMatch(/removal request has been received/i);
      expect(dbMocks.chain.insert).toHaveBeenCalled();
      expect(dbMocks.chain.values).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "removal_requested" }),
      );
    });

    it("calls sendMail with the correct `to` address", async () => {
      await authed().send({ reason: "Moving locations" });

      await vi.waitFor(() => expect(mockSendMail).toHaveBeenCalled(), { timeout: 3000 });

      const mailOptions = mockSendMail.mock.calls[0]![0] as Record<string, unknown>;
      expect(mailOptions["to"]).toBe("metapp.contact@gmail.com");
    });

    it("sends an email whose subject names the venue and signals a removal request", async () => {
      await authed().send({ reason: "Permanent closure" });

      await vi.waitFor(() => expect(mockSendMail).toHaveBeenCalled(), { timeout: 3000 });

      const mailOptions = mockSendMail.mock.calls[0]![0] as Record<string, unknown>;
      const subject = mailOptions["subject"] as string;
      expect(typeof subject).toBe("string");
      expect(subject.toLowerCase()).toContain("removal");
      // The venue's business name must appear in the subject.
      expect(subject).toContain("Corner Social");
    });

    it("includes the business ID and reason in the email body", async () => {
      await authed().send({ reason: "We are closing" });

      await vi.waitFor(() => expect(mockSendMail).toHaveBeenCalled(), { timeout: 3000 });

      const mailOptions = mockSendMail.mock.calls[0]![0] as Record<string, unknown>;
      const html = mailOptions["html"] as string;
      expect(html).toContain(String(BUSINESS_ID));
      expect(html).toContain("We are closing");
    });

    it("records 'No reason provided' in the email body when reason is omitted", async () => {
      await authed().send({});

      await vi.waitFor(() => expect(mockSendMail).toHaveBeenCalled(), { timeout: 3000 });

      const mailOptions = mockSendMail.mock.calls[0]![0] as Record<string, unknown>;
      const html = mailOptions["html"] as string;
      expect(html.toLowerCase()).toContain("no reason provided");
    });
  });

  describe("fire-and-forget error isolation", () => {
    it("still returns 201 even when sendMail rejects", async () => {
      mockSendMail.mockRejectedValueOnce(new Error("SMTP connection refused"));

      const res = await authed().send({ reason: "Testing error path" });

      // The route must not bubble the email failure.
      expect(res.status).toBe(201);

      // Give the fire-and-forget chain a tick to settle so the test does not
      // leave dangling rejections that could pollute later tests.
      await new Promise((r) => setTimeout(r, 50));
    });
  });

  describe("authentication guards", () => {
    it("rejects a request with no session cookie", async () => {
      const res = await request(app)
        .post(`/api/venue-manager/businesses/${BUSINESS_ID}/removal-request`)
        .set("x-csrf-token", RAW_CSRF_TOKEN)
        .send({ reason: "No cookie" });

      expect(res.status).toBe(401);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("rejects a request that omits the CSRF header", async () => {
      const res = await request(app)
        .post(`/api/venue-manager/businesses/${BUSINESS_ID}/removal-request`)
        .set("Cookie", `${SESSION_COOKIE}=${encodeURIComponent(SIGNED_COOKIE)}`)
        // deliberately no x-csrf-token
        .send({ reason: "No CSRF" });

      expect(res.status).toBe(403);
      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });
});
