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
  venueAdminCredentialsTable,
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

/**
 * Builds the met_venue_admin cookie header for admin session tests.
 * Format mirrors what the route writes: `${credentialId}.${sessionVersion}.${expiresAt}`.
 */
function adminCookieHeader(credentialId: number, sessionVersion = 1): string {
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  const raw = `${credentialId}.${sessionVersion}.${expiresAt}`;
  const signed = signCookieValue(raw, TEST_SESSION_SECRET);
  return `met_venue_admin=${encodeURIComponent(signed)}`;
}

// ---------------------------------------------------------------------------
// Fixture IDs — populated in beforeAll
// ---------------------------------------------------------------------------

let agentId = 0;
let otherAgentId = 0;
let deactivatedAgentId = 0;
let profileId = 0;
let profileNoBizId = 0;
let profileNoEmailId = 0;
let profileNoEmailBusinessId = 0;
let businessId = 0;
let profileForDeactivatedAgentId = 0;
let businessForDeactivatedAgentId = 0;

// For the deactivation-cleanup test: an agent that starts active then gets
// deactivated via the PATCH endpoint during the test.
let agentToDeactivateId = 0;
let profileForAgentToDeactivateId = 0;
let businessForAgentToDeactivateId = 0;
// Admin credential used to authenticate the PATCH /admin/venue-owner/agents/:id call.
let adminCredentialId = 0;

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

  // A deactivated agent — isActive:false — used to verify the middleware rejects them
  const [deactivatedAgent] = await db
    .insert(salesAgentsTable)
    .values({
      email: `deactivated-${TEST_AGENT_EMAIL}`,
      displayName: "Deactivated Agent",
      passwordHash: "scrypt$dummy$dummy",
      isActive: false,
      sessionVersion: 1,
    })
    .returning({ id: salesAgentsTable.id });
  deactivatedAgentId = deactivatedAgent!.id;

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
  // (used for the 409/no-business test)
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

  // A third approved profile assigned to our agent with NULL contactEmail
  // but WITH a business row — used for the 409/no-email test.
  const [profileNoEmail] = await db
    .insert(venueOwnerProfilesTable)
    .values({
      ownerUid: `${TEST_OWNER_UID}-noemail`,
      placeId: `${TEST_PLACE_ID}-noemail`,
      placeName: "No-Email Test Venue",
      businessName: "No-Email Test Venue Ltd",
      applicationStatus: "approved",
      isApproved: true,
      contactEmail: null,
      assignedAgentId: agentId,
    })
    .returning({ id: venueOwnerProfilesTable.id });
  profileNoEmailId = profileNoEmail!.id;

  const [profileNoEmailBusiness] = await db
    .insert(venueBusinessesTable)
    .values({
      venueOwnerProfileId: profileNoEmailId,
      placeId: `${TEST_PLACE_ID}-noemail`,
      legalName: "No-Email Test Venue Ltd",
      createdByUid: `${TEST_OWNER_UID}-noemail`,
      isActive: true,
    })
    .returning({ id: venueBusinessesTable.id });
  profileNoEmailBusinessId = profileNoEmailBusiness!.id;

  // An approved venue profile assigned to the deactivated agent — the session
  // middleware must reject the request before any venue lookup runs.
  const [profileForDeactivatedAgent] = await db
    .insert(venueOwnerProfilesTable)
    .values({
      ownerUid: `${TEST_OWNER_UID}-deactivated`,
      placeId: `${TEST_PLACE_ID}-deactivated`,
      placeName: "Deactivated Agent Test Venue",
      businessName: "Deactivated Agent Test Venue Ltd",
      applicationStatus: "approved",
      isApproved: true,
      contactEmail: TEST_CONTACT_EMAIL,
      assignedAgentId: deactivatedAgentId,
    })
    .returning({ id: venueOwnerProfilesTable.id });
  profileForDeactivatedAgentId = profileForDeactivatedAgent!.id;

  // A business record for the deactivated-agent's venue so the endpoint
  // would succeed if it ever got past the session check.
  const [businessForDeactivatedAgent] = await db
    .insert(venueBusinessesTable)
    .values({
      venueOwnerProfileId: profileForDeactivatedAgentId,
      placeId: `${TEST_PLACE_ID}-deactivated`,
      legalName: "Deactivated Agent Test Venue Ltd",
      createdByUid: `${TEST_OWNER_UID}-deactivated`,
      isActive: true,
    })
    .returning({ id: venueBusinessesTable.id });
  businessForDeactivatedAgentId = businessForDeactivatedAgent!.id;

  // ── Deactivation-cleanup test fixtures ────────────────────────────────────
  // An agent that starts ACTIVE so we can deactivate them in the test and
  // verify their outstanding tokens are cleaned up.
  const [agentToDeactivate] = await db
    .insert(salesAgentsTable)
    .values({
      email: `to-deactivate-${TEST_AGENT_EMAIL}`,
      displayName: "Agent To Deactivate",
      passwordHash: "scrypt$dummy$dummy",
      isActive: true,
      sessionVersion: 1,
    })
    .returning({ id: salesAgentsTable.id });
  agentToDeactivateId = agentToDeactivate!.id;

  const [profileForAgentToDeactivate] = await db
    .insert(venueOwnerProfilesTable)
    .values({
      ownerUid: `${TEST_OWNER_UID}-to-deactivate`,
      placeId: `${TEST_PLACE_ID}-to-deactivate`,
      placeName: "Agent-To-Deactivate Test Venue",
      businessName: "Agent-To-Deactivate Test Venue Ltd",
      applicationStatus: "approved",
      isApproved: true,
      contactEmail: TEST_CONTACT_EMAIL,
      assignedAgentId: agentToDeactivateId,
    })
    .returning({ id: venueOwnerProfilesTable.id });
  profileForAgentToDeactivateId = profileForAgentToDeactivate!.id;

  const [businessForAgentToDeactivate] = await db
    .insert(venueBusinessesTable)
    .values({
      venueOwnerProfileId: profileForAgentToDeactivateId,
      placeId: `${TEST_PLACE_ID}-to-deactivate`,
      legalName: "Agent-To-Deactivate Test Venue Ltd",
      createdByUid: `${TEST_OWNER_UID}-to-deactivate`,
      isActive: true,
    })
    .returning({ id: venueBusinessesTable.id });
  businessForAgentToDeactivateId = businessForAgentToDeactivate!.id;

  // Admin credential used to authenticate the PATCH endpoint.
  const [adminCredential] = await db
    .insert(venueAdminCredentialsTable)
    .values({ passwordHash: "scrypt$dummy$dummy", sessionVersion: 1 })
    .returning({ id: venueAdminCredentialsTable.id });
  adminCredentialId = adminCredential!.id;
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

  if (profileNoEmailBusinessId) {
    await db
      .delete(venueManagerRegistrationTokensTable)
      .where(
        eq(
          venueManagerRegistrationTokensTable.businessId,
          profileNoEmailBusinessId,
        ),
      );
    await db
      .delete(venueBusinessesTable)
      .where(eq(venueBusinessesTable.id, profileNoEmailBusinessId));
  }

  if (businessForDeactivatedAgentId) {
    await db
      .delete(venueManagerRegistrationTokensTable)
      .where(
        eq(
          venueManagerRegistrationTokensTable.businessId,
          businessForDeactivatedAgentId,
        ),
      );
    await db
      .delete(venueBusinessesTable)
      .where(eq(venueBusinessesTable.id, businessForDeactivatedAgentId));
  }

  for (const pid of [profileId, profileNoBizId, profileNoEmailId, profileForDeactivatedAgentId]) {
    if (pid) {
      await db
        .delete(venueOwnerProfilesTable)
        .where(eq(venueOwnerProfilesTable.id, pid));
    }
  }

  // Also remove the no-biz / no-email / deactivated profiles by placeId in case the id was never set
  await db
    .delete(venueOwnerProfilesTable)
    .where(eq(venueOwnerProfilesTable.placeId, `${TEST_PLACE_ID}-nobiz`));
  await db
    .delete(venueOwnerProfilesTable)
    .where(eq(venueOwnerProfilesTable.placeId, `${TEST_PLACE_ID}-noemail`));
  await db
    .delete(venueOwnerProfilesTable)
    .where(eq(venueOwnerProfilesTable.placeId, `${TEST_PLACE_ID}-deactivated`));

  if (businessForAgentToDeactivateId) {
    await db
      .delete(venueManagerRegistrationTokensTable)
      .where(eq(venueManagerRegistrationTokensTable.businessId, businessForAgentToDeactivateId));
    await db
      .delete(venueBusinessesTable)
      .where(eq(venueBusinessesTable.id, businessForAgentToDeactivateId));
  }

  if (profileForAgentToDeactivateId) {
    await db
      .delete(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.id, profileForAgentToDeactivateId));
  }
  await db
    .delete(venueOwnerProfilesTable)
    .where(eq(venueOwnerProfilesTable.placeId, `${TEST_PLACE_ID}-to-deactivate`));

  for (const aid of [agentId, otherAgentId, deactivatedAgentId, agentToDeactivateId]) {
    if (aid) {
      await db
        .delete(salesAgentsTable)
        .where(eq(salesAgentsTable.id, aid));
    }
  }

  if (adminCredentialId) {
    await db
      .delete(venueAdminCredentialsTable)
      .where(eq(venueAdminCredentialsTable.id, adminCredentialId));
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
    // 409: approved profile assigned to the agent with a business record but
    // NULL contactEmail — the endpoint must refuse before writing any token
    // or calling the email helper.
    // -----------------------------------------------------------------------
    it("returns 409 with 'contact email' message when contactEmail is NULL", async () => {
      mockSendRegistrationLinkEmail.mockClear();

      // Confirm no token rows exist for the no-email business before the call.
      const tokensBefore = await db
        .select()
        .from(venueManagerRegistrationTokensTable)
        .where(
          eq(
            venueManagerRegistrationTokensTable.businessId,
            profileNoEmailBusinessId,
          ),
        );
      expect(tokensBefore.length).toBe(0);

      const res = await request(app)
        .post(
          `/api/admin/agent/applications/${profileNoEmailId}/registration-link`,
        )
        .set("Cookie", agentCookieHeader(agentId));

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        message: expect.stringContaining("contact email"),
      });

      // No token row must have been written.
      const tokensAfter = await db
        .select()
        .from(venueManagerRegistrationTokensTable)
        .where(
          eq(
            venueManagerRegistrationTokensTable.businessId,
            profileNoEmailBusinessId,
          ),
        );
      expect(tokensAfter.length).toBe(0);

      // Email helper must never have been called.
      expect(mockSendRegistrationLinkEmail).not.toHaveBeenCalled();
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

    // -----------------------------------------------------------------------
    // 401: deactivated agent (isActive:false) with an approved venue that has
    // a valid business record — the session middleware must refuse before any
    // venue lookup or email send occurs.
    // -----------------------------------------------------------------------
    it("returns 401 for a deactivated agent even when their venue looks valid", async () => {
      mockSendRegistrationLinkEmail.mockClear();

      const res = await request(app)
        .post(
          `/api/admin/agent/applications/${profileForDeactivatedAgentId}/registration-link`,
        )
        .set("Cookie", agentCookieHeader(deactivatedAgentId));

      expect(res.status).toBe(401);

      // No token row must have been written.
      const tokens = await db
        .select()
        .from(venueManagerRegistrationTokensTable)
        .where(
          eq(
            venueManagerRegistrationTokensTable.businessId,
            businessForDeactivatedAgentId,
          ),
        );
      expect(tokens.length).toBe(0);

      // sendRegistrationLinkEmail must never have been called.
      expect(mockSendRegistrationLinkEmail).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Deactivation cleanup: when an agent is deactivated via the admin PATCH
    // endpoint, their outstanding unconsumed registration tokens must be
    // deleted, making the previously issued token invalid at /venue-manager/register.
    // -----------------------------------------------------------------------
    it("deletes outstanding tokens when the issuing agent is deactivated, causing the registration endpoint to reject them", async () => {
      // 1. Insert a registration token for the "to-deactivate" agent's business.
      const rawToken = "itest-deact-token-" + Date.now();
      const crypto = await import("node:crypto");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("base64url");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db
        .insert(venueManagerRegistrationTokensTable)
        .values({ businessId: businessForAgentToDeactivateId, tokenHash, expiresAt });

      // Confirm the token exists before deactivation.
      const tokensBefore = await db
        .select()
        .from(venueManagerRegistrationTokensTable)
        .where(eq(venueManagerRegistrationTokensTable.businessId, businessForAgentToDeactivateId));
      expect(tokensBefore.length).toBeGreaterThanOrEqual(1);

      // 2. Deactivate the agent via the admin PATCH endpoint.
      const deactivateRes = await request(app)
        .patch(`/api/admin/venue-owner/agents/${agentToDeactivateId}`)
        .set("Cookie", adminCookieHeader(adminCredentialId))
        .send({ isActive: false });
      expect(deactivateRes.status).toBe(200);
      expect(deactivateRes.body.agent.isActive).toBe(false);

      // 3. The outstanding token must have been deleted.
      const tokensAfter = await db
        .select()
        .from(venueManagerRegistrationTokensTable)
        .where(eq(venueManagerRegistrationTokensTable.businessId, businessForAgentToDeactivateId));
      expect(tokensAfter.length).toBe(0);

      // 4. Attempting to use the token at the registration endpoint must be
      //    rejected because the token no longer exists.
      const registerRes = await request(app)
        .post("/api/venue-manager/register")
        .send({
          token: rawToken,
          email: `regtest-${Date.now()}@itest.invalid`,
          displayName: "Test User",
          password: "Str0ngP@ssword!",
        });
      expect(registerRes.status).toBe(400);
      expect(registerRes.body.message).toMatch(/invalid or has expired/i);
    });

    // -----------------------------------------------------------------------
    // SMTP down: sendRegistrationLinkEmail throws → 200 with emailSent:false,
    // no history row written, token row still exists.
    // -----------------------------------------------------------------------
    it("returns 200 with emailSent:false and skips history when the email helper throws", async () => {
      // Make the email helper throw to simulate a broken SMTP transport.
      mockSendRegistrationLinkEmail.mockRejectedValueOnce(
        new Error("SMTP connection refused"),
      );

      const tokenCountBefore = (
        await db
          .select()
          .from(venueManagerRegistrationTokensTable)
          .where(eq(venueManagerRegistrationTokensTable.businessId, businessId))
      ).length;

      const historyCountBefore = (
        await db
          .select()
          .from(venueApplicationHistoryTable)
          .where(
            and(
              eq(venueApplicationHistoryTable.venueOwnerProfileId, profileId),
              eq(venueApplicationHistoryTable.eventType, "email_sent"),
            ),
          )
      ).length;

      const res = await request(app)
        .post(`/api/admin/agent/applications/${profileId}/registration-link`)
        .set("Cookie", agentCookieHeader(agentId));

      // Endpoint must respond 200 (not 500) and report failure gracefully.
      expect(res.status).toBe(200);
      expect(res.body.emailSent).toBe(false);
      expect(res.body.contactEmail).toBe(TEST_CONTACT_EMAIL);

      // A new token row must still exist — the token was persisted before the
      // send attempt and must not be rolled back on delivery failure.
      const tokenCountAfter = (
        await db
          .select()
          .from(venueManagerRegistrationTokensTable)
          .where(eq(venueManagerRegistrationTokensTable.businessId, businessId))
      ).length;
      expect(tokenCountAfter).toBeGreaterThan(tokenCountBefore);

      // No new history row must have been written (history only records a
      // successful send).
      const historyCountAfter = (
        await db
          .select()
          .from(venueApplicationHistoryTable)
          .where(
            and(
              eq(venueApplicationHistoryTable.venueOwnerProfileId, profileId),
              eq(venueApplicationHistoryTable.eventType, "email_sent"),
            ),
          )
      ).length;
      expect(historyCountAfter).toBe(historyCountBefore);
    });
  },
);
