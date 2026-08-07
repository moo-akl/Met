/**
 * Integration tests for POST /api/admin/agent/applications/:id/registration-link
 *
 * These tests exercise the full HTTP path (supertest → app → real Drizzle
 * query → real Postgres) and assert that:
 *   - the happy path writes a token row and calls sendRegistrationLinkEmail
 *     with the correct arguments, returning 201
 *   - a 404 is returned when the venue profile does not belong to the
 *     requesting agent (different assignedAgentId)
 *   - a 409 is returned when no business record exists for the venue
 *
 * Tests are skipped automatically when DATABASE_URL is not set.
 */

import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { eq, and } from "drizzle-orm";
import {
  db,
  venueOwnerProfilesTable,
  venueBusinessesTable,
  salesAgentsTable,
  venueApplicationHistoryTable,
  venueManagerRegistrationTokensTable,
} from "@workspace/db";
import type { Express } from "express";

// ---------------------------------------------------------------------------
// Session secret — must be set before the app module is imported so that
// cookie-parser picks it up at initialisation time.
// ---------------------------------------------------------------------------

const TEST_SESSION_SECRET = "itest-agent-reg-link-session-secret";
process.env["SESSION_SECRET"] = TEST_SESSION_SECRET;
process.env["VENUE_MANAGER_BASE_URL"] = "https://manager.test.invalid";

// ---------------------------------------------------------------------------
// Non-DB mocks — applied before app is imported via vi.mock hoisting.
// ---------------------------------------------------------------------------

vi.mock("pino-http", () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/logger", () => ({
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

vi.mock("../middlewares/rateLimit", () => ({
  createIpRateLimiter:
    () => (_req: unknown, _res: unknown, next: () => void) => next(),
  createUserRateLimiter:
    () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/objectStorage", () => ({
  ObjectStorageService: class {},
}));

vi.mock("../lib/push", () => ({ sendPush: vi.fn() }));

vi.mock("../lib/firebaseAdmin", () => ({
  adminStorage: vi.fn().mockReturnValue({}),
  getFirebaseAdmin: vi.fn().mockReturnValue({}),
}));

// Email helper — this is the central assertion target.
const mockSendRegistrationLinkEmail = vi.fn().mockResolvedValue(true);

vi.mock("../lib/email.js", () => ({
  sendVenueApprovedEmail: vi.fn(),
  sendVenueRejectedEmail: vi.fn(),
  sendVenueChangesRequestedEmail: vi.fn(),
  sendRegistrationLinkEmail: mockSendRegistrationLinkEmail,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const hasDatabase = Boolean(process.env["DATABASE_URL"]);

const TEST_PREFIX = `itest-agent-reglink-${process.pid}-${Date.now()}`;
const TEST_PLACE_ID = `${TEST_PREFIX}-place`;
const TEST_OWNER_UID = `${TEST_PREFIX}-owner`;
const TEST_AGENT_EMAIL = `${TEST_PREFIX}-agent@itest.invalid`;
const TEST_CONTACT_EMAIL = `${TEST_PREFIX}-owner@itest.invalid`;

/**
 * Replicates cookie-signature `sign(val, secret)`.
 * cookie-parser verifies cookies of the form `s:<val>.<mac>`.
 */
function signCookieValue(val: string, secret: string): string {
  const mac = createHmac("sha256", secret)
    .update(val)
    .digest("base64")
    .replace(/=+$/, "");
  return "s:" + val + "." + mac;
}

/**
 * Builds the met_agent_session cookie header for the given agent,
 * using the same format the route writes: `${agentId}.${sessionVersion}.${expiresAt}`.
 */
function agentCookieHeader(agentId: number, sessionVersion = 1): string {
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  const raw = `${agentId}.${sessionVersion}.${expiresAt}`;
  const signed = signCookieValue(raw, TEST_SESSION_SECRET);
  return `met_agent_session=${encodeURIComponent(signed)}`;
}

// ---------------------------------------------------------------------------
// Fixture IDs — populated in beforeAll
// ---------------------------------------------------------------------------

let agentId = 0;
let otherAgentId = 0;
let profileId = 0;
let profileNoBizId = 0;
let businessId = 0;

// ---------------------------------------------------------------------------
// Seed & cleanup
// ---------------------------------------------------------------------------

async function seed() {
  // Agent whose session we'll use in the happy path
  const [agent] = await db
    .insert(salesAgentsTable)
    .values({
      email: TEST_AGENT_EMAIL,
      displayName: "Integration Test Agent",
      passwordHash: "scrypt$dummy$dummy",
      isActive: true,
      sessionVersion: 1,
    })
    .returning({ id: salesAgentsTable.id });
  agentId = agent!.id;

  // A second agent — used to verify 404 isolation
  const [otherAgent] = await db
    .insert(salesAgentsTable)
    .values({
      email: `other-${TEST_AGENT_EMAIL}`,
      displayName: "Other Agent",
      passwordHash: "scrypt$dummy$dummy",
      isActive: true,
      sessionVersion: 1,
    })
    .returning({ id: salesAgentsTable.id });
  otherAgentId = otherAgent!.id;

  // Approved venue profile assigned to our agent (happy-path fixture)
  const [profile] = await db
    .insert(venueOwnerProfilesTable)
    .values({
      ownerUid: TEST_OWNER_UID,
      placeId: TEST_PLACE_ID,
      placeName: "Agent Reg Link Test Venue",
      businessName: "Agent Reg Link Test Venue Ltd",
      applicationStatus: "approved",
      isApproved: true,
      contactEmail: TEST_CONTACT_EMAIL,
      assignedAgentId: agentId,
    })
    .returning({ id: venueOwnerProfilesTable.id });
  profileId = profile!.id;

  // Business record for the happy-path profile
  const [business] = await db
    .insert(venueBusinessesTable)
    .values({
      venueOwnerProfileId: profileId,
      placeId: TEST_PLACE_ID,
      legalName: "Agent Reg Link Test Venue Ltd",
      createdByUid: TEST_OWNER_UID,
      isActive: true,
    })
    .returning({ id: venueBusinessesTable.id });
  businessId = business!.id;

  // A second approved profile assigned to our agent but with NO business row
  // (used for the 409 test)
  const [profileNoBiz] = await db
    .insert(venueOwnerProfilesTable)
    .values({
      ownerUid: `${TEST_OWNER_UID}-nobiz`,
      placeId: `${TEST_PLACE_ID}-nobiz`,
      placeName: "No-Biz Test Venue",
      businessName: "No-Biz Test Venue Ltd",
      applicationStatus: "approved",
      isApproved: true,
      contactEmail: TEST_CONTACT_EMAIL,
      assignedAgentId: agentId,
    })
    .returning({ id: venueOwnerProfilesTable.id });
  profileNoBizId = profileNoBiz!.id;
}

async function cleanup() {
  // Remove history rows, then tokens, then businesses, then profiles, then agents
  // (order matters so FK constraints are not violated)
  await db
    .delete(venueApplicationHistoryTable)
    .where(eq(venueApplicationHistoryTable.venueOwnerProfileId, profileId));

  if (businessId) {
    await db
      .delete(venueManagerRegistrationTokensTable)
      .where(eq(venueManagerRegistrationTokensTable.businessId, businessId));
    await db
      .delete(venueBusinessesTable)
      .where(eq(venueBusinessesTable.id, businessId));
  }

  for (const pid of [profileId, profileNoBizId]) {
    if (pid) {
      await db
        .delete(venueOwnerProfilesTable)
        .where(eq(venueOwnerProfilesTable.id, pid));
    }
  }

  // Also remove the no-biz profile by placeId in case the id was never set
  await db
    .delete(venueOwnerProfilesTable)
    .where(eq(venueOwnerProfilesTable.placeId, `${TEST_PLACE_ID}-nobiz`));

  for (const aid of [agentId, otherAgentId]) {
    if (aid) {
      await db
        .delete(salesAgentsTable)
        .where(eq(salesAgentsTable.id, aid));
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasDatabase)(
  "POST /api/admin/agent/applications/:id/registration-link",
  () => {
    let app: Express;

    beforeAll(async () => {
      app = (await import("../app")).default;
      await cleanup();
      await seed();
    });

    afterAll(async () => {
      await cleanup();
    });

    // -----------------------------------------------------------------------
    // Happy path: approved venue assigned to the requesting agent with a
    // business record — email is sent, 201 returned, history written.
    // -----------------------------------------------------------------------
    it("sends the registration email and returns 201 on the happy path", async () => {
      mockSendRegistrationLinkEmail.mockClear();

      const res = await request(app)
        .post(`/api/admin/agent/applications/${profileId}/registration-link`)
        .set("Cookie", agentCookieHeader(agentId));

      expect(res.status).toBe(201);
      expect(res.body.emailSent).toBe(true);
      expect(res.body.contactEmail).toBe(TEST_CONTACT_EMAIL);
      expect(res.body.sentAt).toBeDefined();

      // Email helper called exactly once with the correct recipient and business name
      expect(mockSendRegistrationLinkEmail).toHaveBeenCalledTimes(1);
      const emailArgs = mockSendRegistrationLinkEmail.mock.calls[0]?.[0] as {
        to: string;
        businessName: string;
        registrationUrl: string;
        expiresAt: Date;
      };
      expect(emailArgs.to).toBe(TEST_CONTACT_EMAIL);
      expect(emailArgs.businessName).toBe("Agent Reg Link Test Venue Ltd");
      expect(emailArgs.registrationUrl).toContain(
        "https://manager.test.invalid",
      );
      expect(emailArgs.registrationUrl).toContain("/register?token=");
      expect(emailArgs.expiresAt).toBeInstanceOf(Date);

      // A registration token row must have been written to the DB
      const tokens = await db
        .select()
        .from(venueManagerRegistrationTokensTable)
        .where(
          eq(venueManagerRegistrationTokensTable.businessId, businessId),
        );
      expect(tokens.length).toBeGreaterThanOrEqual(1);

      // History row must have been recorded
      const history = await db
        .select()
        .from(venueApplicationHistoryTable)
        .where(
          and(
            eq(
              venueApplicationHistoryTable.venueOwnerProfileId,
              profileId,
            ),
            eq(venueApplicationHistoryTable.eventType, "email_sent"),
          ),
        );
      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    // -----------------------------------------------------------------------
    // 404: the venue profile is assigned to a *different* agent, so the
    // requesting agent must not be able to trigger the email.
    // -----------------------------------------------------------------------
    it("returns 404 when the venue is assigned to a different agent", async () => {
      // profileId is assigned to `agentId`; we authenticate as `otherAgentId`
      const res = await request(app)
        .post(`/api/admin/agent/applications/${profileId}/registration-link`)
        .set("Cookie", agentCookieHeader(otherAgentId));

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({
        message: expect.stringContaining("not found"),
      });
    });

    // -----------------------------------------------------------------------
    // 409: approved profile exists and is assigned to the agent, but the
    // business record has not been created yet.
    // -----------------------------------------------------------------------
    it("returns 409 when no business record exists for the venue", async () => {
      const res = await request(app)
        .post(
          `/api/admin/agent/applications/${profileNoBizId}/registration-link`,
        )
        .set("Cookie", agentCookieHeader(agentId));

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        message: expect.stringContaining("Business record"),
      });
    });

    // -----------------------------------------------------------------------
    // 401: no session cookie → must be rejected before hitting any DB query.
    // -----------------------------------------------------------------------
    it("returns 401 when no agent session cookie is present", async () => {
      const res = await request(app).post(
        `/api/admin/agent/applications/${profileId}/registration-link`,
      );

      expect(res.status).toBe(401);
    });
  },
);
