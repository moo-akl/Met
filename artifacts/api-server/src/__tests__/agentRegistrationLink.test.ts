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
import { eq, and, inArray, sql } from "drizzle-orm";
import {
  db,
  communityEventsTable,
  profilesTable,
  venueOwnerProfilesTable,
  venueBusinessesTable,
  salesAgentsTable,
  venueApplicationHistoryTable,
  venueManagerRegistrationTokensTable,
  venueAdminCredentialsTable,
  venueMembershipsTable,
  venueManagersTable,
  venueOutreachEmailLogsTable,
  venueOutreachClearedBounceMessagesTable,
  venueActivationPoliciesTable,
  venueContentReportsTable,
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

const firebaseAuthStubs = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  getUsers: vi.fn().mockResolvedValue({ users: [], notFound: [] }),
}));
vi.mock("../lib/firebaseAdmin", () => ({
  adminAuth: () => firebaseAuthStubs,
  adminDb: () => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({ create: vi.fn().mockResolvedValue(undefined) })),
      add: vi.fn().mockResolvedValue({ id: "test-report-doc" }),
    })),
  }),
  adminStorage: vi.fn().mockReturnValue({}),
  getFirebaseAdmin: vi.fn().mockReturnValue({}),
}));

// Email helper — this is the central assertion target.
const mockSendRegistrationLinkEmail = vi.fn().mockResolvedValue(true);
const mockSendVenueContactRequestEmail = vi.fn().mockResolvedValue({
  rfcMessageId: null,
  gmailThreadId: null,
});
const mockSendNewVenueOutreachEmail = vi.fn().mockResolvedValue(undefined);
const gmailBounceMocks = vi.hoisted(() => ({
  readGmailDeliveryFailures: vi.fn(),
  readGmailDeliveryFailureNoticesByIds: vi.fn(),
  readGmailAccountEmail: vi.fn(),
  findGmailSentMessageByRfcMessageId: vi.fn(),
  gmailSentMessageIdExists: vi.fn(),
  readGmailSentMessageById: vi.fn(),
  matchGmailBounceToOutreach: vi.fn(),
}));

vi.mock("../lib/email.js", () => ({
  sendVenueApprovedEmail: vi.fn(),
  sendVenueRejectedEmail: vi.fn(),
  sendVenueChangesRequestedEmail: vi.fn(),
  sendRegistrationLinkEmail: mockSendRegistrationLinkEmail,
  sendRegistrationLinkEmailWithResult: async (options: unknown) => ({
    emailSent: await mockSendRegistrationLinkEmail(options),
    rfcMessageId: null,
    gmailThreadId: null,
  }),
  sendVenueContactRequestEmail: mockSendVenueContactRequestEmail,
  sendNewVenueOutreachEmail: mockSendNewVenueOutreachEmail,
  sendNewVenueOutreachEmailWithResult: async (options: unknown) => {
    await mockSendNewVenueOutreachEmail(options);
    return { rfcMessageId: null };
  },
  getMetAppIntroVideoAssets: vi.fn(() => ({
    videoUrl: "https://manager.test.invalid/venue-admin/media/met-app-intro.mp4",
    posterUrl: "https://manager.test.invalid/venue-admin/media/met-app-intro-poster.jpg",
  })),
  getVenueManagerBaseUrl: vi.fn(() => "https://manager.test.invalid/venue-manager"),
}));

vi.mock("../lib/gmailBounceSync.js", () => ({
  readGmailDeliveryFailures: gmailBounceMocks.readGmailDeliveryFailures,
  readGmailDeliveryFailureNoticesByIds: gmailBounceMocks.readGmailDeliveryFailureNoticesByIds,
  readGmailAccountEmail: gmailBounceMocks.readGmailAccountEmail,
  findGmailSentMessageByRfcMessageId: gmailBounceMocks.findGmailSentMessageByRfcMessageId,
  gmailSentMessageIdExists: gmailBounceMocks.gmailSentMessageIdExists,
  readGmailSentMessageById: gmailBounceMocks.readGmailSentMessageById,
  matchGmailBounceToOutreach: gmailBounceMocks.matchGmailBounceToOutreach,
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
const TEST_MANAGER_UPDATE_EMAIL = `${TEST_PREFIX}-manager-updates@itest.invalid`;
const TEST_MANAGER_UPDATE_PROSPECT_EMAIL = `${TEST_PREFIX}-manager-update-prospect@itest.invalid`;

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
let adminOutreachProfileId = 0;
let adminOutreachBusinessId = 0;
let businessId = 0;
let profileForDeactivatedAgentId = 0;
let businessForDeactivatedAgentId = 0;

// For the already-claimed venue test
let profileAlreadyClaimedId = 0;
let businessAlreadyClaimedId = 0;
let membershipAlreadyClaimedId = 0;
let managerUpdateTestManagerId = 0;
let managerUpdateTestMembershipId = 0;

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

  const [outreachProfile] = await db.insert(venueOwnerProfilesTable).values({
    ownerUid: `${TEST_OWNER_UID}-outreach`,
    placeId: `${TEST_PLACE_ID}-outreach`,
    placeName: "Outreach Test Venue",
    businessName: "Outreach Test Venue",
    applicationStatus: "approved",
    isApproved: true,
    contactEmail: null,
  }).returning({ id: venueOwnerProfilesTable.id });
  adminOutreachProfileId = outreachProfile!.id;
  const [outreachBusiness] = await db.insert(venueBusinessesTable).values({
    venueOwnerProfileId: adminOutreachProfileId,
    placeId: `${TEST_PLACE_ID}-outreach`,
    legalName: "Outreach Test Venue",
    createdByUid: `${TEST_OWNER_UID}-outreach`,
    isActive: true,
  }).returning({ id: venueBusinessesTable.id });
  adminOutreachBusinessId = outreachBusiness!.id;
  const [managerUpdateTestManager] = await db.insert(venueManagersTable).values({
    email: TEST_MANAGER_UPDATE_EMAIL,
    displayName: "Integration Test Manager",
    passwordHash: "scrypt$dummy$dummy",
  }).returning({ id: venueManagersTable.id });
  managerUpdateTestManagerId = managerUpdateTestManager!.id;
  const [managerUpdateTestMembership] = await db.insert(venueMembershipsTable).values({
    businessId: adminOutreachBusinessId,
    managerId: managerUpdateTestManagerId,
    role: "manager",
    status: "active",
  }).returning({ id: venueMembershipsTable.id });
  managerUpdateTestMembershipId = managerUpdateTestMembership!.id;

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

  // ── Already-claimed venue fixtures ───────────────────────────────────────
  // An approved venue profile assigned to our agent that already has an active
  // owner membership backed by a managerId (i.e. the Venue Manager has been
  // claimed). The endpoint must return 409 instead of sending a new link.
  const [profileAlreadyClaimed] = await db
    .insert(venueOwnerProfilesTable)
    .values({
      ownerUid: `${TEST_OWNER_UID}-claimed`,
      placeId: `${TEST_PLACE_ID}-claimed`,
      placeName: "Already Claimed Test Venue",
      businessName: "Already Claimed Test Venue Ltd",
      applicationStatus: "approved",
      isApproved: true,
      contactEmail: TEST_CONTACT_EMAIL,
      assignedAgentId: agentId,
    })
    .returning({ id: venueOwnerProfilesTable.id });
  profileAlreadyClaimedId = profileAlreadyClaimed!.id;

  const [businessAlreadyClaimed] = await db
    .insert(venueBusinessesTable)
    .values({
      venueOwnerProfileId: profileAlreadyClaimedId,
      placeId: `${TEST_PLACE_ID}-claimed`,
      legalName: "Already Claimed Test Venue Ltd",
      createdByUid: `${TEST_OWNER_UID}-claimed`,
      isActive: true,
    })
    .returning({ id: venueBusinessesTable.id });
  businessAlreadyClaimedId = businessAlreadyClaimed!.id;

  // Insert an active owner membership with a non-null managerId to simulate
  // that checkHasClaimedVenueManager returns true.
  const [membershipAlreadyClaimed] = await db
    .insert(venueMembershipsTable)
    .values({
      businessId: businessAlreadyClaimedId,
      managerId: 999999, // sentinel — only needs to be non-null for the guard
      role: "owner",
      status: "active",
    })
    .returning({ id: venueMembershipsTable.id });
  membershipAlreadyClaimedId = membershipAlreadyClaimed!.id;
}

async function cleanup() {
  // Remove history rows, then tokens, then businesses, then profiles, then agents
  // (order matters so FK constraints are not violated)
  await db.delete(venueOutreachEmailLogsTable).where(
    eq(venueOutreachEmailLogsTable.recipientEmail, TEST_MANAGER_UPDATE_PROSPECT_EMAIL),
  );
  if (adminCredentialId) {
    await db.delete(venueOutreachEmailLogsTable).where(and(
      eq(venueOutreachEmailLogsTable.actorUid, `admin:${adminCredentialId}`),
      eq(venueOutreachEmailLogsTable.kind, "manager_announcement"),
    ));
  }
  if (managerUpdateTestMembershipId) {
    await db.delete(venueMembershipsTable)
      .where(eq(venueMembershipsTable.id, managerUpdateTestMembershipId));
  }
  if (managerUpdateTestManagerId) {
    await db.delete(venueManagersTable)
      .where(eq(venueManagersTable.id, managerUpdateTestManagerId));
  }
  for (const pid of [profileId, profileNoBizId, profileNoEmailId, adminOutreachProfileId, profileForDeactivatedAgentId]) {
    if (pid) await db.delete(venueApplicationHistoryTable)
      .where(eq(venueApplicationHistoryTable.venueOwnerProfileId, pid));
  }

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

  if (adminOutreachBusinessId) {
    await db.delete(venueManagerRegistrationTokensTable)
      .where(eq(venueManagerRegistrationTokensTable.businessId, adminOutreachBusinessId));
    await db.delete(venueBusinessesTable)
      .where(eq(venueBusinessesTable.id, adminOutreachBusinessId));
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

  for (const pid of [profileId, profileNoBizId, profileNoEmailId, adminOutreachProfileId, profileForDeactivatedAgentId]) {
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

  // Already-claimed fixture cleanup
  if (membershipAlreadyClaimedId) {
    await db
      .delete(venueMembershipsTable)
      .where(eq(venueMembershipsTable.id, membershipAlreadyClaimedId));
  }
  if (businessAlreadyClaimedId) {
    await db
      .delete(venueManagerRegistrationTokensTable)
      .where(eq(venueManagerRegistrationTokensTable.businessId, businessAlreadyClaimedId));
    await db
      .delete(venueBusinessesTable)
      .where(eq(venueBusinessesTable.id, businessAlreadyClaimedId));
  }
  if (profileAlreadyClaimedId) {
    await db
      .delete(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.id, profileAlreadyClaimedId));
  }
  await db
    .delete(venueOwnerProfilesTable)
    .where(eq(venueOwnerProfilesTable.placeId, `${TEST_PLACE_ID}-claimed`));

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

    describe("community-event content reports", () => {
      it("lists a report and hides/restores its event for guests", async () => {
        const ownerUid = `${TEST_PREFIX}-community-owner`;
        const reporterUid = `${TEST_PREFIX}-community-reporter`;
        let eventId = 0;

        await db.insert(profilesTable).values([
          { uid: ownerUid, displayName: "Community Event Owner", photoUrl: "https://example.com/owner.jpg" },
          { uid: reporterUid, displayName: "Community Event Reporter", photoUrl: "https://example.com/reporter.jpg" },
        ]);

        try {
          const created = await request(app)
            .post("/api/events")
            .set("X-Met-Uid", ownerUid)
            .send({
              title: "Reported community gathering",
              description: "Moderation test event",
              startsAt: new Date(Date.now() + 86_400_000).toISOString(),
              visibility: "public",
              joinApprovalRequired: true,
              location: "Bangkok test park",
              locationPlaceId: `community-report-place-${TEST_PREFIX}`,
              latitude: 13.7563,
              longitude: 100.5018,
              inviteeUids: [],
            })
            .expect(201);
          eventId = created.body.id as number;

          const share = await request(app)
            .post(`/api/community-events/${eventId}/invite-link`)
            .set("X-Met-Uid", reporterUid)
            .expect(200);
          const token = new URL(share.body.url as string).pathname.split("/").pop()!;

          await request(app)
            .post("/api/community-event-reports")
            .set("X-Met-Uid", reporterUid)
            .send({ eventId, reason: "spam" })
            .expect(201);
          const [report] = await db
            .select()
            .from(venueContentReportsTable)
            .where(and(
              eq(venueContentReportsTable.entityType, "community_event"),
              eq(venueContentReportsTable.entityId, eventId),
              eq(venueContentReportsTable.reporterUid, reporterUid),
            ))
            .limit(1);
          expect(report).toBeDefined();

          await request(app)
            .get("/api/admin/venue-owner/content-reports?entityType=community_event")
            .expect(401);
          await request(app)
            .get("/api/admin/venue-owner/content-reports?entityType=community_event")
            .set("Cookie", adminCookieHeader(adminCredentialId))
            .expect(200)
            .expect((response) => {
              expect(response.body.reports).toEqual(
                expect.arrayContaining([
                  expect.objectContaining({
                    id: report!.id,
                    entityId: eventId,
                    contentTitle: "Reported community gathering",
                    contentIsHidden: false,
                    status: "open",
                  }),
                ]),
              );
            });

          await request(app)
            .patch(`/api/admin/venue-owner/content-reports/${report!.id}`)
            .set("Cookie", adminCookieHeader(adminCredentialId))
            .send({ action: "hide_content" })
            .expect(200);
          const hiddenQueue = await request(app)
            .get("/api/admin/venue-owner/content-reports?entityType=community_event&status=all")
            .set("Cookie", adminCookieHeader(adminCredentialId))
            .expect(200);
          expect(hiddenQueue.body.reports).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: report!.id,
                status: "actioned",
                contentIsHidden: true,
              }),
            ]),
          );
          const hiddenFeed = await request(app)
            .get("/api/events/feed")
            .set("X-Met-Uid", reporterUid)
            .expect(200);
          expect(hiddenFeed.body.events).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ eventType: "member", id: eventId })]),
          );
          await request(app)
            .get(`/api/events/member/${eventId}`)
            .set("X-Met-Uid", reporterUid)
            .expect(404);
          await request(app)
            .post("/api/event-invites/resolve")
            .send({ token })
            .expect(404);
          await request(app)
            .post("/api/event-invites/rsvp")
            .set("X-Met-Uid", reporterUid)
            .send({ token, status: "going" })
            .expect(404);
          await request(app)
            .post(`/api/community-events/${eventId}/invite-link`)
            .set("X-Met-Uid", ownerUid)
            .expect(404);

          await request(app)
            .patch(`/api/admin/venue-owner/content-reports/${report!.id}`)
            .set("Cookie", adminCookieHeader(adminCredentialId))
            .send({ action: "restore_content" })
            .expect(200);
          const restoredQueue = await request(app)
            .get("/api/admin/venue-owner/content-reports?entityType=community_event&status=all")
            .set("Cookie", adminCookieHeader(adminCredentialId))
            .expect(200);
          expect(restoredQueue.body.reports).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: report!.id,
                status: "dismissed",
                contentIsHidden: false,
              }),
            ]),
          );
          const restoredFeed = await request(app)
            .get("/api/events/feed")
            .set("X-Met-Uid", reporterUid)
            .expect(200);
          expect(restoredFeed.body.events).toEqual(
            expect.arrayContaining([expect.objectContaining({ eventType: "member", id: eventId })]),
          );
          await request(app)
            .get(`/api/events/member/${eventId}`)
            .set("X-Met-Uid", reporterUid)
            .expect(200);
          await request(app)
            .post("/api/event-invites/resolve")
            .send({ token })
            .expect(200);
        } finally {
          if (eventId) {
            await db
              .delete(venueContentReportsTable)
              .where(and(
                eq(venueContentReportsTable.entityType, "community_event"),
                eq(venueContentReportsTable.entityId, eventId),
              ));
            await db.delete(communityEventsTable).where(eq(communityEventsTable.id, eventId));
          }
          await db.delete(profilesTable).where(inArray(profilesTable.uid, [ownerUid, reporterUid]));
        }
      });
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

    it("asks for a management contact without creating a link or starting the invitation deadline", async () => {
      mockSendVenueContactRequestEmail.mockClear();
      const to = `website-${TEST_CONTACT_EMAIL}`;
      const result = await request(app)
        .post(`/api/admin/venue-owner/applications/${adminOutreachProfileId}/contact-request`)
        .set("Cookie", adminCookieHeader(adminCredentialId))
        .send({ recipientEmail: to });
      expect(result.status).toBe(201);
      expect(result.body).toEqual({ emailSent: true, recipientEmail: to });
      expect(mockSendVenueContactRequestEmail).toHaveBeenCalledWith(expect.objectContaining({ to }));
      expect(await db.select().from(venueManagerRegistrationTokensTable)
        .where(eq(venueManagerRegistrationTokensTable.businessId, adminOutreachBusinessId))).toHaveLength(0);
      expect(await db.select().from(venueActivationPoliciesTable)
        .where(eq(venueActivationPoliciesTable.profileId, adminOutreachProfileId))).toHaveLength(0);
      const history = await db.select().from(venueApplicationHistoryTable)
        .where(eq(venueApplicationHistoryTable.venueOwnerProfileId, adminOutreachProfileId));
      expect(history.some((row) => row.eventType === "email_sent" && row.internalNote === "Asked for the venue management contact")).toBe(true);
    });

    it("emails a new venue before any application exists, without creating an account or token", async () => {
      mockSendNewVenueOutreachEmail.mockClear();
      const businessName = `New venue ${TEST_PREFIX}`;
      const to = `hello-${TEST_CONTACT_EMAIL}`;
      const result = await request(app)
        .post("/api/admin/venue-owner/outreach")
        .set("Cookie", adminCookieHeader(adminCredentialId))
        .send({ businessName, recipientEmail: to.toUpperCase() });
      expect(result.status).toBe(201);
      expect(result.body).toEqual({ emailSent: true, recipientEmail: to });
      expect(mockSendNewVenueOutreachEmail).toHaveBeenCalledWith({
        to, businessName, template: "contact_request",
      });
      expect(await db.select({ id: venueOwnerProfilesTable.id })
        .from(venueOwnerProfilesTable)
        .where(eq(venueOwnerProfilesTable.businessName, businessName))).toHaveLength(0);
    });

    it("rejects invalid new-venue outreach and unauthenticated sends", async () => {
      mockSendNewVenueOutreachEmail.mockClear();
      const invalid = await request(app)
        .post("/api/admin/venue-owner/outreach")
        .set("Cookie", adminCookieHeader(adminCredentialId))
        .send({ businessName: "X", recipientEmail: "not-an-email" });
      expect(invalid.status).toBe(400);
      const unauthenticated = await request(app)
        .post("/api/admin/venue-owner/outreach")
        .send({ businessName: "New Venue", recipientEmail: TEST_CONTACT_EMAIL });
      expect(unauthenticated.status).toBe(401);
      const invalidTemplate = await request(app)
        .post("/api/admin/venue-owner/outreach")
        .set("Cookie", adminCookieHeader(adminCredentialId))
        .send({ businessName: "New Venue", recipientEmail: TEST_CONTACT_EMAIL, template: "registration" });
      expect(invalidTemplate.status).toBe(400);
      expect(mockSendNewVenueOutreachEmail).not.toHaveBeenCalled();
    });

    it("does not claim delivery when new-venue outreach fails", async () => {
      mockSendNewVenueOutreachEmail.mockRejectedValueOnce(new Error("Gmail unavailable"));
      const result = await request(app)
        .post("/api/admin/venue-owner/outreach")
        .set("Cookie", adminCookieHeader(adminCredentialId))
        .send({ businessName: "New Venue", recipientEmail: TEST_CONTACT_EMAIL });
      expect(result.status).toBe(503);
      expect(result.body.message).toContain("Check the connected Gmail Sent folder");
    });

    it("previews the same allowed templates used for sending and accepts a chosen template", async () => {
      mockSendNewVenueOutreachEmail.mockClear();
      const preview = await request(app)
        .post("/api/admin/venue-owner/outreach/preview")
        .set("Cookie", adminCookieHeader(adminCredentialId))
        .send({ businessName: "North & South" });
      expect(preview.status).toBe(200);
      expect(preview.body.templates).toHaveLength(13);
      expect(preview.body.templates.map((template: { id: string }) => template.id)).toEqual([
        "contact_request",
        "a_look_into_met",
        "met_launch_with_links",
        "met_launch_without_links",
        "met_u_foot_traffic_legacy",
        "preapproval_video_application",
        "introduction",
        "benefits",
        "events",
        "rewards",
        "follow_up",
        "latest_updates",
        "latest_updates_prospect",
      ]);
      const eventsTemplate = preview.body.templates.find((template: { id: string }) => template.id === "events");
      expect(eventsTemplate).toMatchObject({
        subject: expect.stringContaining("North & South"),
        text: expect.stringContaining("events"),
      });
      const send = await request(app)
        .post("/api/admin/venue-owner/outreach")
        .set("Cookie", adminCookieHeader(adminCredentialId))
        .send({ businessName: "North & South", recipientEmail: TEST_CONTACT_EMAIL, template: "events" });
      expect(send.status).toBe(201);
      expect(mockSendNewVenueOutreachEmail).toHaveBeenCalledWith({
        to: TEST_CONTACT_EMAIL, businessName: "North & South", template: "events",
      });

      const updateSend = await request(app)
        .post("/api/admin/venue-owner/outreach")
        .set("Cookie", adminCookieHeader(adminCredentialId))
        .send({
          businessName: "Venue managers",
          recipientEmail: TEST_CONTACT_EMAIL,
          template: "latest_updates_prospect",
        });
      expect(updateSend.status).toBe(201);
      expect(mockSendNewVenueOutreachEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: TEST_CONTACT_EMAIL,
        businessName: "Venue managers",
        template: "latest_updates_prospect",
      }));
    });

    it("previews and sends the Met - U foot-traffic invitation template", async () => {
      const recipientEmail = `${TEST_PREFIX}-met-u@example.test`;
      mockSendNewVenueOutreachEmail.mockClear();
      try {
        const preview = await request(app)
          .post("/api/admin/venue-owner/outreach/preview")
          .set("Cookie", adminCookieHeader(adminCredentialId))
          .send({ businessName: "North & South" });
        expect(preview.status, JSON.stringify(preview.body)).toBe(200);
        const template = preview.body.templates.find(
          (entry: { id: string }) => entry.id === "met_u_foot_traffic_legacy",
        );
        expect(template).toMatchObject({
          label: "Met - U · Foot traffic & visitor legacy",
          subject: "Boost foot traffic & give your visitors a permanent legacy with Met - U 🚀",
        });
        expect(template.text).toContain("Hi North & South Team,");
        expect(template.text).toContain("permanently recorded on your venue's all-time visitor leaderboard");

        const send = await request(app)
          .post("/api/admin/venue-owner/outreach")
          .set("Cookie", adminCookieHeader(adminCredentialId))
          .send({
            businessName: "North & South",
            recipientEmail,
            template: "met_u_foot_traffic_legacy",
          });
        expect(send.status).toBe(201);
        expect(mockSendNewVenueOutreachEmail).toHaveBeenCalledWith({
          to: recipientEmail,
          businessName: "North & South",
          template: "met_u_foot_traffic_legacy",
        });
      } finally {
        await db.delete(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.recipientEmail, recipientEmail));
      }
    });

    it("shows a deduplicated manager audience and sends only after explicit confirmation", async () => {
      await db.delete(venueOutreachEmailLogsTable).where(
        eq(venueOutreachEmailLogsTable.recipientEmail, TEST_MANAGER_UPDATE_PROSPECT_EMAIL),
      );
      await db.insert(venueOutreachEmailLogsTable).values({
        businessName: "Previously Contacted Test Venue",
        recipientEmail: TEST_MANAGER_UPDATE_PROSPECT_EMAIL,
        template: "introduction",
        kind: "new_venue_outreach",
        deliveryStatus: "sent",
      });
      firebaseAuthStubs.getUsers.mockImplementation(async (identifiers: Array<{ uid: string }>) => ({
        users: identifiers
          .filter(({ uid }) => uid === `${TEST_OWNER_UID}-outreach`)
          .map(({ uid }) => ({
            uid,
            email: TEST_MANAGER_UPDATE_EMAIL,
            disabled: false,
          })),
        notFound: [],
      }));
      mockSendNewVenueOutreachEmail.mockClear();

      const unauthenticatedAudience = await request(app)
        .get("/api/admin/venue-owner/outreach/manager-updates/audience");
      expect(unauthenticatedAudience.status).toBe(401);

      const audience = await request(app)
        .get("/api/admin/venue-owner/outreach/manager-updates/audience")
        .set("Cookie", adminCookieHeader(adminCredentialId));
      expect(audience.status).toBe(200);
      expect(audience.body.recipientCount).toBeGreaterThan(0);
      expect(audience.body.registeredManagerCount).toBeGreaterThan(0);
      expect(audience.body.contactedProspectCount).toBeGreaterThan(0);
      expect(mockSendNewVenueOutreachEmail).not.toHaveBeenCalled();

      const unconfirmed = await request(app)
        .post("/api/admin/venue-owner/outreach/manager-updates/send")
        .set("Cookie", adminCookieHeader(adminCredentialId))
        .send({
          template: "latest_updates",
          expectedRecipientCount: audience.body.recipientCount,
          expectedRegisteredManagerCount: audience.body.registeredManagerCount,
          expectedContactedProspectCount: audience.body.contactedProspectCount,
          confirm: false,
        });
      expect(unconfirmed.status).toBe(400);
      expect(mockSendNewVenueOutreachEmail).not.toHaveBeenCalled();

      const sent = await request(app)
        .post("/api/admin/venue-owner/outreach/manager-updates/send")
        .set("Cookie", adminCookieHeader(adminCredentialId))
        .send({
          template: "latest_updates",
          expectedRecipientCount: audience.body.recipientCount,
          expectedRegisteredManagerCount: audience.body.registeredManagerCount,
          expectedContactedProspectCount: audience.body.contactedProspectCount,
          confirm: true,
        });
      expect(sent.status, JSON.stringify(sent.body)).toBe(200);
      expect(sent.body).toMatchObject({
        recipientCount: audience.body.recipientCount,
        registeredManagerCount: audience.body.registeredManagerCount,
        contactedProspectCount: audience.body.contactedProspectCount,
        sentCount: audience.body.recipientCount,
        deliveryUncertainCount: 0,
        notAttemptedCount: 0,
        stoppedReason: null,
      });
      const managerEmailCall = mockSendNewVenueOutreachEmail.mock.calls.find(
        ([input]) => input.to === TEST_MANAGER_UPDATE_EMAIL,
      );
      expect(managerEmailCall?.[0]).toMatchObject({
        to: TEST_MANAGER_UPDATE_EMAIL,
        template: "latest_updates",
        attachments: [{
          filename: "met-check-in-qr-posters.pdf",
          contentType: "application/pdf",
          content: expect.any(Buffer),
        }],
      });
      const prospectEmailCall = mockSendNewVenueOutreachEmail.mock.calls.find(
        ([input]) => input.to === TEST_MANAGER_UPDATE_PROSPECT_EMAIL,
      );
      expect(prospectEmailCall?.[0]).toMatchObject({
        to: TEST_MANAGER_UPDATE_PROSPECT_EMAIL,
        businessName: "Previously Contacted Test Venue",
        template: "latest_updates_prospect",
      });
      expect(prospectEmailCall?.[0]).not.toHaveProperty("attachments");
    }, 240_000);

    it("binds a registration link to the chosen manager email, not the public contact email", async () => {
      const to = `manager-${TEST_CONTACT_EMAIL}`;
      mockSendRegistrationLinkEmail.mockClear();
      const result = await request(app)
        .post(`/api/admin/venue-owner/applications/${adminOutreachProfileId}/registration-link`)
        .set("Cookie", adminCookieHeader(adminCredentialId))
        .send({ recipientEmail: to, sendEmail: true });
      expect(result.status).toBe(201);
      expect(result.body.emailSent).toBe(true);
      expect(result.body.contactEmail).toBe(to);
      expect(mockSendRegistrationLinkEmail).toHaveBeenCalledWith(expect.objectContaining({ to }));
      const tokens = await db.select().from(venueManagerRegistrationTokensTable)
        .where(eq(venueManagerRegistrationTokensTable.businessId, adminOutreachBusinessId));
      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.invitedEmail).toBe(to);
      const [profile] = await db.select({ contactEmail: venueOwnerProfilesTable.contactEmail })
        .from(venueOwnerProfilesTable).where(eq(venueOwnerProfilesTable.id, adminOutreachProfileId));
      expect(profile?.contactEmail).toBeNull();
      expect(await db.select().from(venueActivationPoliciesTable)
        .where(eq(venueActivationPoliciesTable.profileId, adminOutreachProfileId))).toHaveLength(1);

      const videoTo = `manager-video-${TEST_CONTACT_EMAIL}`;
      const videoInvite = await request(app)
        .post(`/api/admin/venue-owner/applications/${adminOutreachProfileId}/registration-link`)
        .set("Cookie", adminCookieHeader(adminCredentialId))
        .send({ recipientEmail: videoTo, sendEmail: true, template: "registration_with_video" });
      expect(videoInvite.status).toBe(201);
      expect(videoInvite.body.emailSent).toBe(true);
      expect(mockSendRegistrationLinkEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: videoTo,
        includeAppIntro: true,
      }));
      const invitedTokens = await db.select().from(venueManagerRegistrationTokensTable)
        .where(eq(venueManagerRegistrationTokensTable.businessId, adminOutreachBusinessId));
      expect(invitedTokens.some((token) => token.invitedEmail === videoTo)).toBe(true);
    });

    it("does not send an introduction without an admin session", async () => {
      mockSendVenueContactRequestEmail.mockClear();
      const result = await request(app)
        .post(`/api/admin/venue-owner/applications/${adminOutreachProfileId}/contact-request`)
        .send({ recipientEmail: TEST_CONTACT_EMAIL });
      expect(result.status).toBe(401);
      expect(mockSendVenueContactRequestEmail).not.toHaveBeenCalled();
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
    // 409: approved profile exists, business record exists, contact email is
    // set, but the owner has already claimed the Venue Manager (active owner
    // membership with a non-null managerId). The endpoint must refuse rather
    // than issuing another registration link.
    // -----------------------------------------------------------------------
    it("returns 409 when the venue has already claimed the Venue Manager", async () => {
      mockSendRegistrationLinkEmail.mockClear();

      const res = await request(app)
        .post(
          `/api/admin/agent/applications/${profileAlreadyClaimedId}/registration-link`,
        )
        .set("Cookie", agentCookieHeader(agentId));

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        message: expect.stringContaining("already claimed"),
      });

      // No token row must have been written.
      const tokens = await db
        .select()
        .from(venueManagerRegistrationTokensTable)
        .where(
          eq(
            venueManagerRegistrationTokensTable.businessId,
            businessAlreadyClaimedId,
          ),
        );
      expect(tokens.length).toBe(0);

      // Email helper must never have been called.
      expect(mockSendRegistrationLinkEmail).not.toHaveBeenCalled();
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
      firebaseAuthStubs.verifyIdToken.mockResolvedValueOnce({
        uid: `${TEST_PREFIX}-deactivated-registration-test`,
        email: TEST_CONTACT_EMAIL,
        email_verified: true,
      });
      const registerRes = await request(app)
        .post("/api/venue-manager/register/firebase")
        .send({
          token: rawToken,
          idToken: "deactivated-agent-registration-test",
          displayName: "Test User",
          acceptedTermsVersion: "venue-2026-09",
        });
      expect(registerRes.status).toBe(400);
      expect(registerRes.body.message).toMatch(/invalid or has expired/i);
    });

    // -----------------------------------------------------------------------
    // GET /admin/agent/applications — claimLinkSentAt field
    //
    // Verifies that the agent application list endpoint correctly surfaces the
    // most-recent registration-link send timestamp (or null) for each venue.
    // -----------------------------------------------------------------------
    describe("GET /api/admin/agent/applications — claimLinkSentAt field", () => {
      it("returns null claimLinkSentAt for a venue that has never had a registration link sent", async () => {
        // profileNoBizId is assigned to agentId but always returns 409 from the
        // POST endpoint (no business row), so no history row with
        // metadata.registrationLink=true is ever written for it.
        const res = await request(app)
          .get("/api/admin/agent/applications")
          .set("Cookie", agentCookieHeader(agentId));

        expect(res.status).toBe(200);
        const venues = res.body.venues as Array<{
          id: number;
          claimLinkSentAt: string | null;
        }>;
        expect(Array.isArray(venues)).toBe(true);

        const noBizVenue = venues.find((v) => v.id === profileNoBizId);
        expect(noBizVenue).toBeDefined();
        expect(noBizVenue!.claimLinkSentAt).toBeNull();
      });

      it("returns the correct ISO timestamp in claimLinkSentAt after a registration link is sent", async () => {
        mockSendRegistrationLinkEmail.mockClear();

        const before = Date.now();

        // Send a registration link — this writes the history row the GET
        // endpoint aggregates.
        const postRes = await request(app)
          .post(`/api/admin/agent/applications/${profileId}/registration-link`)
          .set("Cookie", agentCookieHeader(agentId));
        expect(postRes.status).toBe(201);
        expect(postRes.body.sentAt).toBeDefined();

        // Fetch the agent application list and find the venue.
        const getRes = await request(app)
          .get("/api/admin/agent/applications")
          .set("Cookie", agentCookieHeader(agentId));

        expect(getRes.status).toBe(200);
        const venues = getRes.body.venues as Array<{
          id: number;
          claimLinkSentAt: string | null;
        }>;

        const venue = venues.find((v) => v.id === profileId);
        expect(venue).toBeDefined();
        expect(venue!.claimLinkSentAt).toBeTruthy();

        // The timestamp must be a valid ISO string that falls within the window
        // of this test run (with a generous ±10 s tolerance for slow CI).
        const claimTs = new Date(venue!.claimLinkSentAt!).getTime();
        expect(claimTs).toBeGreaterThanOrEqual(before - 10_000);
        expect(claimTs).toBeLessThanOrEqual(Date.now() + 10_000);

        // The value returned by the list endpoint must match the sentAt field
        // from the POST response (same event, same row).
        const postSentAt = new Date(postRes.body.sentAt as string).getTime();
        expect(Math.abs(claimTs - postSentAt)).toBeLessThanOrEqual(1_000);
      });
    });

    // -----------------------------------------------------------------------
    // GET /admin/agent/applications — hasClaimedVenueManager field
    //
    // Verifies that the agent application list endpoint correctly reflects
    // whether each venue owner has already claimed the Venue Manager portal.
    // -----------------------------------------------------------------------
    describe("GET /api/admin/agent/applications — hasClaimedVenueManager field", () => {
      it("returns false for a venue whose owner has not yet claimed the Venue Manager", async () => {
        // profileNoBizId has no business row → can never be claimed.
        const res = await request(app)
          .get("/api/admin/agent/applications")
          .set("Cookie", agentCookieHeader(agentId));

        expect(res.status).toBe(200);
        const venues = res.body.venues as Array<{
          id: number;
          hasClaimedVenueManager: boolean;
        }>;
        expect(Array.isArray(venues)).toBe(true);

        const noBizVenue = venues.find((v) => v.id === profileNoBizId);
        expect(noBizVenue).toBeDefined();
        expect(noBizVenue!.hasClaimedVenueManager).toBe(false);
      });

      it("returns true for a venue whose owner has already claimed the Venue Manager", async () => {
        // profileAlreadyClaimedId has an active owner membership with a non-null
        // managerId — this is the state checkHasClaimedVenueManager tests for.
        const res = await request(app)
          .get("/api/admin/agent/applications")
          .set("Cookie", agentCookieHeader(agentId));

        expect(res.status).toBe(200);
        const venues = res.body.venues as Array<{
          id: number;
          hasClaimedVenueManager: boolean;
        }>;
        expect(Array.isArray(venues)).toBe(true);

        const claimedVenue = venues.find((v) => v.id === profileAlreadyClaimedId);
        expect(claimedVenue).toBeDefined();
        expect(claimedVenue!.hasClaimedVenueManager).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    // Re-send: calling the endpoint twice for the same venue must leave only
    // one token row in the DB and render the first token unusable.
    // -----------------------------------------------------------------------
    it("invalidates the previous token when the registration link is re-sent for the same venue", async () => {
      mockSendRegistrationLinkEmail.mockClear();

      // ── First send ──────────────────────────────────────────────────────
      const firstRes = await request(app)
        .post(`/api/admin/agent/applications/${profileId}/registration-link`)
        .set("Cookie", agentCookieHeader(agentId));
      expect(firstRes.status).toBe(201);

      // Capture the raw token embedded in the registration URL.
      const firstEmailArgs = mockSendRegistrationLinkEmail.mock.calls[0]?.[0] as {
        registrationUrl: string;
      };
      const firstUrl = new URL(firstEmailArgs.registrationUrl);
      const firstRawToken = firstUrl.searchParams.get("token");
      expect(firstRawToken).toBeTruthy();

      mockSendRegistrationLinkEmail.mockClear();

      // ── Second send ─────────────────────────────────────────────────────
      const secondRes = await request(app)
        .post(`/api/admin/agent/applications/${profileId}/registration-link`)
        .set("Cookie", agentCookieHeader(agentId));
      expect(secondRes.status).toBe(201);

      // Only one token must remain — the newly minted one.
      const tokensAfterSecond = await db
        .select()
        .from(venueManagerRegistrationTokensTable)
        .where(eq(venueManagerRegistrationTokensTable.businessId, businessId));
      expect(tokensAfterSecond.length).toBe(1);

      // The first (now invalidated) token must be rejected at the
      // registration endpoint.
      firebaseAuthStubs.verifyIdToken.mockResolvedValueOnce({
        uid: `${TEST_PREFIX}-resend-registration-test`,
        email: TEST_CONTACT_EMAIL,
        email_verified: true,
      });
      const registerRes = await request(app)
        .post("/api/venue-manager/register/firebase")
        .send({
          token: firstRawToken,
          idToken: "resend-registration-test",
          displayName: "Re-send Test User",
          acceptedTermsVersion: "venue-2026-09",
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
      const tokenCountBefore = (
        await db
          .select()
          .from(venueManagerRegistrationTokensTable)
          .where(eq(venueManagerRegistrationTokensTable.businessId, businessId))
      ).length;

      const res = await request(app)
        .post(`/api/admin/agent/applications/${profileId}/registration-link`)
        .set("Cookie", agentCookieHeader(agentId));

      // Endpoint must respond 200 (not 500) and report failure gracefully.
      expect(res.status).toBe(200);
      expect(res.body.emailSent).toBe(false);
      expect(res.body.contactEmail).toBe(TEST_CONTACT_EMAIL);

      // The new token remains available because an email-helper failure leaves
      // delivery uncertain, and previously sent links must remain valid too.
      // A failed/uncertain resend therefore adds one token without deleting
      // the prior successful token.
      const tokenCountAfter = (
        await db
          .select()
          .from(venueManagerRegistrationTokensTable)
          .where(eq(venueManagerRegistrationTokensTable.businessId, businessId))
      ).length;
      expect(tokenCountAfter).toBe(tokenCountBefore + 1);

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

    it("clears confirmed bounced and unsent failed records while retaining uncertain sends", async (context) => {
      // This endpoint intentionally clears every eligible Venue Admin row.
      // Avoid making a shared development/test database destructive if another
      // fixture has already left eligible records behind.
      const existingRows = await db.select({
        deliveryStatus: venueOutreachEmailLogsTable.deliveryStatus,
        sentAt: venueOutreachEmailLogsTable.sentAt,
      }).from(venueOutreachEmailLogsTable);
      if (existingRows.some((row) =>
        row.deliveryStatus === "bounced" ||
        (row.deliveryStatus === "failed" && row.sentAt === null)
      )) {
        context.skip();
      }

      const bounceMessageId = `${TEST_PREFIX}-cleanup-bounce-message`;
      const now = new Date();
      const inserted = await db.insert(venueOutreachEmailLogsTable).values([
        {
          businessName: "Cleanup Failed Venue",
          recipientEmail: `${TEST_PREFIX}-cleanup-failed@example.test`,
          template: "manager_announcement",
          kind: "manager_announcement",
          deliveryStatus: "failed",
        },
        {
          businessName: "Cleanup Bounced Venue",
          recipientEmail: `${TEST_PREFIX}-cleanup-bounced@example.test`,
          template: "manager_announcement",
          kind: "manager_announcement",
          deliveryStatus: "bounced",
          gmailRfcMessageId: `${TEST_PREFIX}-cleanup-original@example.test`,
          gmailBounceMessageId: bounceMessageId,
          sentAt: now,
          bouncedAt: now,
        },
        {
          businessName: "Cleanup Uncertain Venue",
          recipientEmail: `${TEST_PREFIX}-cleanup-uncertain@example.test`,
          template: "manager_announcement",
          kind: "manager_announcement",
          deliveryStatus: "delivery_uncertain",
        },
        {
          businessName: "Cleanup Sending Venue",
          recipientEmail: `${TEST_PREFIX}-cleanup-sending@example.test`,
          template: "manager_announcement",
          kind: "manager_announcement",
          deliveryStatus: "sending",
        },
        {
          businessName: "Cleanup Successful Venue",
          recipientEmail: `${TEST_PREFIX}-cleanup-sent@example.test`,
          template: "manager_announcement",
          kind: "manager_announcement",
          deliveryStatus: "sent",
          gmailRfcMessageId: `${TEST_PREFIX}-cleanup-sent-original@example.test`,
          sentAt: now,
        },
      ]).returning({
        id: venueOutreachEmailLogsTable.id,
        deliveryStatus: venueOutreachEmailLogsTable.deliveryStatus,
      });
      const failedId = inserted.find((row) => row.deliveryStatus === "failed")!.id;
      const bouncedId = inserted.find((row) => row.deliveryStatus === "bounced")!.id;
      const retainedIds = inserted
        .filter((row) => ["delivery_uncertain", "sending", "sent"].includes(row.deliveryStatus))
        .map((row) => row.id);
      const insertedIds = inserted.map((row) => row.id);

      try {
        const staleCount = await request(app)
          .delete("/api/admin/venue-owner/outreach/failed")
          .set("Cookie", adminCookieHeader(adminCredentialId))
          .send({
            confirm: true,
            expectedFailedEmailCount: 0,
            expectedBouncedEmailCount: 1,
          });
        expect(staleCount.status).toBe(409);

        const beforeCleanup = await db.select({ id: venueOutreachEmailLogsTable.id })
          .from(venueOutreachEmailLogsTable)
          .where(inArray(venueOutreachEmailLogsTable.id, insertedIds));
        expect(beforeCleanup).toHaveLength(5);

        const cleared = await request(app)
          .delete("/api/admin/venue-owner/outreach/failed")
          .set("Cookie", adminCookieHeader(adminCredentialId))
          .send({
            confirm: true,
            expectedFailedEmailCount: 1,
            expectedBouncedEmailCount: 1,
          });
        expect(cleared.status, JSON.stringify(cleared.body)).toBe(200);
        expect(cleared.body).toMatchObject({
          clearedEmailCount: 2,
          clearedFailedEmailCount: 1,
          clearedBouncedEmailCount: 1,
          removedUnusedInviteCount: 0,
        });

        const remaining = await db.select({
          id: venueOutreachEmailLogsTable.id,
          deliveryStatus: venueOutreachEmailLogsTable.deliveryStatus,
        })
          .from(venueOutreachEmailLogsTable)
          .where(inArray(venueOutreachEmailLogsTable.id, insertedIds));
        expect(remaining).toHaveLength(3);
        expect(remaining.map((row) => row.id).sort()).toEqual([...retainedIds].sort());
        expect(remaining.map((row) => row.id)).not.toContain(failedId);
        expect(remaining.map((row) => row.id)).not.toContain(bouncedId);
        expect(remaining.map((row) => row.deliveryStatus).sort()).toEqual([
          "delivery_uncertain",
          "sending",
          "sent",
        ]);

        const [bounceTombstone] = await db.select({
          gmailMessageId: venueOutreachClearedBounceMessagesTable.gmailMessageId,
        })
          .from(venueOutreachClearedBounceMessagesTable)
          .where(eq(venueOutreachClearedBounceMessagesTable.gmailMessageId, bounceMessageId));
        expect(bounceTombstone?.gmailMessageId).toBe(bounceMessageId);
      } finally {
        await db.delete(venueOutreachEmailLogsTable)
          .where(inArray(venueOutreachEmailLogsTable.id, insertedIds));
        await db.delete(venueOutreachClearedBounceMessagesTable)
          .where(eq(venueOutreachClearedBounceMessagesTable.gmailMessageId, bounceMessageId));
      }
    });

    it("previews and atomically applies exactly 98 revalidated stale Gmail links", async () => {
      const sentAt = new Date();
      const approved = Array.from({ length: 98 }, (_, index) => {
        const suffix = String(index).padStart(3, "0");
        const recipientEmail = `${TEST_PREFIX}-reconciliation-${suffix}@example.test`;
        const originalSentAt = new Date(sentAt.getTime() + 1_000);
        const notice = {
          gmailMessageId: `${TEST_PREFIX}-reconciliation-bounce-${suffix}`,
          gmailThreadId: `${TEST_PREFIX}-reconciliation-thread-${suffix}`,
          recipientEmail,
          recipientCount: 1,
          recipientMismatch: false,
          originalMessageId: `${TEST_PREFIX}-reconciliation-original-${suffix}@example.test`,
          originalSentAt,
          receivedAt: new Date(originalSentAt.getTime() + 60_000),
          status: "5.4.1",
          reason: "Recipient address rejected",
        };
        return {
          notice,
          sentMessage: {
            gmailMessageId: `${TEST_PREFIX}-sent-message-${suffix}`,
            rfcMessageId: notice.originalMessageId,
            from: ["outreach@example.test"],
            to: [recipientEmail],
            sentAt: originalSentAt,
          },
          row: {
            businessName: `Reconciliation Test Venue ${suffix}`,
            recipientEmail,
            template: "manager_announcement",
            kind: "manager_announcement" as const,
            deliveryStatus: "sent" as const,
            gmailRfcMessageId: `${TEST_PREFIX}-stale-original-${suffix}@example.test`,
            sentAt,
            createdAt: sentAt,
          },
        };
      });
      const unverifiedCandidates = Array.from({ length: 64 }, (_, index) => {
        const suffix = String(index).padStart(3, "0");
        const recipientEmail = `${TEST_PREFIX}-unverified-reconciliation-${suffix}@example.test`;
        const originalSentAt = new Date(sentAt.getTime() + 1_000);
        return {
          notice: {
            gmailMessageId: `${TEST_PREFIX}-unverified-reconciliation-bounce-${suffix}`,
            gmailThreadId: `${TEST_PREFIX}-unverified-reconciliation-thread-${suffix}`,
            recipientEmail,
            recipientCount: 1,
            recipientMismatch: false,
            originalMessageId: `${TEST_PREFIX}-unverified-reconciliation-original-${suffix}@example.test`,
            originalSentAt,
            receivedAt: new Date(originalSentAt.getTime() + 60_000),
            status: "5.4.1",
            reason: "Recipient address rejected",
          },
          row: {
            businessName: `Unverified Reconciliation Test Venue ${suffix}`,
            recipientEmail,
            template: "manager_announcement",
            kind: "manager_announcement" as const,
            deliveryStatus: "sent" as const,
            gmailRfcMessageId: `${TEST_PREFIX}-unverified-stale-original-${suffix}@example.test`,
            sentAt,
            createdAt: sentAt,
          },
        };
      });
      const target = approved[approved.length - 1]!;
      const insertedCandidateRows = await db.insert(venueOutreachEmailLogsTable)
        .values([
          ...approved.map((mapping) => mapping.row),
          ...unverifiedCandidates.map((mapping) => mapping.row),
        ])
        .returning({
          id: venueOutreachEmailLogsTable.id,
          recipientEmail: venueOutreachEmailLogsTable.recipientEmail,
        });
      const approvedIdByRecipient = new Map(
        insertedCandidateRows.map((row) => [row.recipientEmail, row.id]),
      );
      const targetLogId = approvedIdByRecipient.get(target.notice.recipientEmail)!;
      // Real Postgres timestamps may include microseconds that are lost when
      // the preview serializes a Date to ISO milliseconds.
      await db.execute(sql`
        UPDATE venue_outreach_email_logs
        SET created_at = created_at + INTERVAL '123 microseconds',
            sent_at = sent_at + INTERVAL '456 microseconds'
        WHERE id = ${targetLogId}
      `);
      const [unrelated] = await db.insert(venueOutreachEmailLogsTable).values({
        businessName: "Unrelated Test Venue",
        recipientEmail: `${TEST_PREFIX}-unrelated@example.test`,
        template: "introduction",
        kind: "new_venue_outreach",
        deliveryStatus: "sent",
        gmailRfcMessageId: `${TEST_PREFIX}-unrelated-original@example.test`,
        sentAt,
      }).returning({ id: venueOutreachEmailLogsTable.id });
      const ambiguousRecipient = `${TEST_PREFIX}-ambiguous-reconciliation@example.test`;
      const ambiguousOriginalSentAt = new Date(sentAt.getTime() + 2_000);
      const ambiguousNotice = {
        ...target.notice,
        gmailMessageId: `${TEST_PREFIX}-ambiguous-reconciliation-bounce`,
        recipientEmail: ambiguousRecipient,
        originalMessageId: `${TEST_PREFIX}-ambiguous-reconciliation-original@example.test`,
        originalSentAt: ambiguousOriginalSentAt,
      };
      const [ambiguousFirst, ambiguousSecond] = await db.insert(venueOutreachEmailLogsTable).values([
        {
          businessName: "Ambiguous Reconciliation Venue One",
          recipientEmail: ambiguousRecipient,
          template: "manager_announcement",
          kind: "manager_announcement",
          deliveryStatus: "sent",
          gmailRfcMessageId: `${TEST_PREFIX}-ambiguous-stale-one@example.test`,
          sentAt,
          createdAt: sentAt,
        },
        {
          businessName: "Ambiguous Reconciliation Venue Two",
          recipientEmail: ambiguousRecipient,
          template: "manager_announcement",
          kind: "manager_announcement",
          deliveryStatus: "sent",
          gmailRfcMessageId: `${TEST_PREFIX}-ambiguous-stale-two@example.test`,
          sentAt,
          createdAt: sentAt,
        },
      ]).returning({ id: venueOutreachEmailLogsTable.id });
      const noHistoryNotice = {
        ...target.notice,
        gmailMessageId: `${TEST_PREFIX}-no-history-reconciliation-bounce`,
        recipientEmail: `${TEST_PREFIX}-no-history-reconciliation@example.test`,
        originalMessageId: `${TEST_PREFIX}-no-history-reconciliation-original@example.test`,
      };

      try {
        gmailBounceMocks.readGmailDeliveryFailures.mockResolvedValue({
          messages: [
            ...approved.slice(0, -1).map((mapping) => mapping.notice),
            ...unverifiedCandidates.map((mapping) => mapping.notice),
            ambiguousNotice,
            noHistoryNotice,
            target.notice,
          ],
          scannedCount: 121,
          truncated: false,
        });
        gmailBounceMocks.readGmailAccountEmail.mockResolvedValue("outreach@example.test");
        gmailBounceMocks.matchGmailBounceToOutreach.mockImplementation(
          (notice: { gmailMessageId: string }) => notice.gmailMessageId === ambiguousNotice.gmailMessageId
            ? { kind: "ambiguous", candidates: [] }
            : { kind: "unmatched", reason: "no_eligible_send_candidate" },
        );
        const sentByRfcMessageId = new Map(
          approved.map((mapping) => [mapping.notice.originalMessageId, mapping.sentMessage]),
        );
        const sentByGmailMessageId = new Map(
          approved.map((mapping) => [mapping.sentMessage.gmailMessageId, mapping.sentMessage]),
        );
        gmailBounceMocks.findGmailSentMessageByRfcMessageId.mockImplementation(
          async (messageId: string) => {
            const message = sentByRfcMessageId.get(messageId);
            return message ? { kind: "matched", message } : { kind: "none" };
          },
        );
        gmailBounceMocks.gmailSentMessageIdExists.mockResolvedValue(false);

        const unauthenticated = await request(app)
          .post("/api/admin/venue-owner/outreach/reconcile-gmail-bounces/preview")
          .send({ confirm: true });
        expect(unauthenticated.status).toBe(401);

        const sync = await request(app)
          .post("/api/admin/venue-owner/outreach/sync-gmail-bounces")
          .set("Cookie", adminCookieHeader(adminCredentialId))
          .send({ confirm: true });
        expect(sync.status, JSON.stringify(sync.body)).toBe(200);
        expect(sync.body.reconciliationCandidateCount).toBe(162);
        expect(sync.body.reconciliationSourceToken).toEqual(expect.any(String));
        const sourceToken = sync.body.reconciliationSourceToken as string;

        const preview = await request(app)
          .post("/api/admin/venue-owner/outreach/reconcile-gmail-bounces/preview")
          .set("Cookie", adminCookieHeader(adminCredentialId))
          .send({ confirm: true, sourceToken });
        expect(preview.status, JSON.stringify(preview.body)).toBe(200);
        expect(gmailBounceMocks.readGmailDeliveryFailures).toHaveBeenCalledTimes(1);
        expect(preview.body).toMatchObject({
          scannedCount: 121,
          verifiedCandidateCount: 98,
        });
        expect(preview.body.candidates).toEqual(expect.arrayContaining([expect.objectContaining({
          logId: String(targetLogId),
          recipientEmail: target.notice.recipientEmail,
        })]));
        expect(preview.body.planToken).toEqual(expect.any(String));

        const tamperedPlan = await request(app)
          .post("/api/admin/venue-owner/outreach/reconcile-gmail-bounces/apply")
          .set("Cookie", adminCookieHeader(adminCredentialId))
          .send({ planToken: `${preview.body.planToken}x`, confirm: true });
        expect(tamperedPlan.status).toBe(400);

        gmailBounceMocks.readGmailDeliveryFailureNoticesByIds.mockResolvedValue(
          new Map(approved.map((mapping) => [mapping.notice.gmailMessageId, mapping.notice])),
        );
        gmailBounceMocks.readGmailSentMessageById.mockImplementation(
          async (messageId: string) => sentByGmailMessageId.get(messageId) ?? null,
        );
        await db.update(venueOutreachEmailLogsTable)
          .set({ deliveryStatus: "delivery_uncertain" })
          .where(eq(venueOutreachEmailLogsTable.id, targetLogId));
        const apply = await request(app)
          .post("/api/admin/venue-owner/outreach/reconcile-gmail-bounces/apply")
          .set("Cookie", adminCookieHeader(adminCredentialId))
          .send({ planToken: preview.body.planToken, confirm: true });

        expect(apply.status).toBe(409);
        const [staleTarget] = await db.select().from(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.id, targetLogId));
        expect(staleTarget).toMatchObject({
          deliveryStatus: "delivery_uncertain",
          gmailRfcMessageId: target.row.gmailRfcMessageId,
          gmailBounceMessageId: null,
        });
        const firstApproved = approved[0]!;
        const firstApprovedId = approvedIdByRecipient.get(firstApproved.notice.recipientEmail)!;
        const [stillUnchangedAfterRollback] = await db.select().from(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.id, firstApprovedId));
        expect(stillUnchangedAfterRollback).toMatchObject({
          deliveryStatus: "sent",
          gmailRfcMessageId: firstApproved.row.gmailRfcMessageId,
          gmailBounceMessageId: null,
        });
        const [stillAmbiguousOne, stillAmbiguousTwo] = await Promise.all([
          db.select().from(venueOutreachEmailLogsTable)
            .where(eq(venueOutreachEmailLogsTable.id, ambiguousFirst!.id)),
          db.select().from(venueOutreachEmailLogsTable)
            .where(eq(venueOutreachEmailLogsTable.id, ambiguousSecond!.id)),
        ]);
        expect(stillAmbiguousOne[0]).toMatchObject({ deliveryStatus: "sent", gmailBounceMessageId: null });
        expect(stillAmbiguousTwo[0]).toMatchObject({ deliveryStatus: "sent", gmailBounceMessageId: null });

        await db.update(venueOutreachEmailLogsTable)
          .set({ deliveryStatus: "sent" })
          .where(eq(venueOutreachEmailLogsTable.id, targetLogId));
        const refreshedPreview = await request(app)
          .post("/api/admin/venue-owner/outreach/reconcile-gmail-bounces/preview")
          .set("Cookie", adminCookieHeader(adminCredentialId))
          .send({ confirm: true, sourceToken });
        expect(refreshedPreview.status).toBe(200);
        expect(refreshedPreview.body.verifiedCandidateCount).toBe(98);
        const refreshedApply = await request(app)
          .post("/api/admin/venue-owner/outreach/reconcile-gmail-bounces/apply")
          .set("Cookie", adminCookieHeader(adminCredentialId))
          .send({ planToken: refreshedPreview.body.planToken, confirm: true });

        expect(refreshedApply.status).toBe(200);
        expect(refreshedApply.body.appliedCount).toBe(98);
        const [updatedTarget] = await db.select().from(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.id, targetLogId));
        expect(updatedTarget).toMatchObject({
          deliveryStatus: "bounced",
          gmailRfcMessageId: target.notice.originalMessageId,
          gmailBounceMessageId: target.notice.gmailMessageId,
          gmailBounceStatus: "5.4.1",
          gmailBounceReason: "Recipient address rejected",
        });
        const [updatedFirstApproved] = await db.select().from(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.id, firstApprovedId));
        expect(updatedFirstApproved).toMatchObject({
          deliveryStatus: "bounced",
          gmailRfcMessageId: firstApproved.notice.originalMessageId,
          gmailBounceMessageId: firstApproved.notice.gmailMessageId,
        });
        const [unchanged] = await db.select().from(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.id, unrelated!.id));
        expect(unchanged).toMatchObject({
          deliveryStatus: "sent",
          gmailRfcMessageId: `${TEST_PREFIX}-unrelated-original@example.test`,
          gmailBounceMessageId: null,
        });
        const ambiguousRows = await db.select().from(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.recipientEmail, ambiguousRecipient));
        expect(ambiguousRows.map((row) => row.deliveryStatus)).toEqual(["sent", "sent"]);

        const completedPreview = await request(app)
          .post("/api/admin/venue-owner/outreach/reconcile-gmail-bounces/preview")
          .set("Cookie", adminCookieHeader(adminCredentialId))
          .send({ confirm: true, sourceToken });
        expect(completedPreview.status).toBe(409);
        expect(completedPreview.body).toMatchObject({
          message: expect.stringContaining("0 verified matches"),
        });
        expect(completedPreview.body.planToken).toBeUndefined();
      } finally {
        await db.delete(venueOutreachEmailLogsTable)
          .where(inArray(venueOutreachEmailLogsTable.id, insertedCandidateRows.map((row) => row.id)));
        await db.delete(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.id, unrelated!.id));
        await db.delete(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.recipientEmail, ambiguousRecipient));
        gmailBounceMocks.readGmailDeliveryFailures.mockReset();
        gmailBounceMocks.readGmailDeliveryFailureNoticesByIds.mockReset();
        gmailBounceMocks.readGmailAccountEmail.mockReset();
        gmailBounceMocks.findGmailSentMessageByRfcMessageId.mockReset();
        gmailBounceMocks.gmailSentMessageIdExists.mockReset();
        gmailBounceMocks.readGmailSentMessageById.mockReset();
      }
    });

    it("syncs and safely triages Gmail bounce notices without changing ambiguous or unrelated records", async () => {
      const recipientEmail = `${TEST_PREFIX}-bounce@example.test`;
      const gmailMessageId = `${TEST_PREFIX}-gmail-bounce`;
      const originalMessageId = `${TEST_PREFIX}-original@example.test`;
      const notice = {
        gmailMessageId,
        recipientEmail,
        recipientCount: 1,
        originalMessageId,
        originalSentAt: new Date(),
        receivedAt: new Date(),
        status: "5.4.1",
        reason: "Recipient address rejected",
      };
      const [sentLog] = await db.insert(venueOutreachEmailLogsTable).values({
        businessName: "Bounce Sync Exact Match",
        recipientEmail,
        template: "introduction",
        kind: "new_venue_outreach",
        deliveryStatus: "sent",
        gmailRfcMessageId: originalMessageId,
        sentAt: new Date(),
      }).returning({
        id: venueOutreachEmailLogsTable.id,
        businessName: venueOutreachEmailLogsTable.businessName,
        recipientEmail: venueOutreachEmailLogsTable.recipientEmail,
        createdAt: venueOutreachEmailLogsTable.createdAt,
        gmailRfcMessageId: venueOutreachEmailLogsTable.gmailRfcMessageId,
      });
      expect(sentLog).toBeDefined();
      gmailBounceMocks.readGmailDeliveryFailures.mockResolvedValue({
        messages: [notice],
        scannedCount: 1,
        truncated: false,
      });
      gmailBounceMocks.matchGmailBounceToOutreach.mockReturnValue({
        kind: "matched",
        candidate: sentLog,
      });

      try {
        const first = await request(app)
          .post("/api/admin/venue-owner/outreach/sync-gmail-bounces")
          .set("Cookie", adminCookieHeader(adminCredentialId))
          .send({ confirm: true });
        expect(first.status).toBe(200);
        expect(first.body).toMatchObject({ scannedCount: 1, matchedCount: 1, ambiguousCount: 0 });

        const [bounced] = await db.select().from(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.id, sentLog!.id));
        expect(bounced).toMatchObject({
          deliveryStatus: "bounced",
          gmailBounceMessageId: gmailMessageId,
          gmailBounceStatus: "5.4.1",
          gmailBounceReason: "Recipient address rejected",
          gmailRfcMessageId: originalMessageId,
        });

        gmailBounceMocks.matchGmailBounceToOutreach.mockClear();
        const second = await request(app)
          .post("/api/admin/venue-owner/outreach/sync-gmail-bounces")
          .set("Cookie", adminCookieHeader(adminCredentialId))
          .send({ confirm: true });
        expect(second.status).toBe(200);
        expect(second.body.matchedCount).toBe(0);
        expect(gmailBounceMocks.matchGmailBounceToOutreach).not.toHaveBeenCalled();
      } finally {
        await db.delete(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.id, sentLog!.id));
      }

      const ambiguousRecipient = `${TEST_PREFIX}-ambiguous@example.test`;
      const [firstCandidate, secondCandidate] = await db.insert(venueOutreachEmailLogsTable).values([
        {
          businessName: "Ambiguous Venue One",
          recipientEmail: ambiguousRecipient,
          template: "introduction",
          kind: "new_venue_outreach",
          deliveryStatus: "sent",
          sentAt: new Date(),
        },
        {
          businessName: "Ambiguous Venue Two",
          recipientEmail: ambiguousRecipient,
          template: "introduction",
          kind: "new_venue_outreach",
          deliveryStatus: "sent",
          sentAt: new Date(),
        },
      ]).returning({
        id: venueOutreachEmailLogsTable.id,
        businessName: venueOutreachEmailLogsTable.businessName,
      });
      gmailBounceMocks.readGmailDeliveryFailures.mockResolvedValue({
        messages: [{
          ...notice,
          gmailMessageId: `${TEST_PREFIX}-ambiguous-gmail-bounce`,
          recipientEmail: ambiguousRecipient,
          originalMessageId: null,
        }],
        scannedCount: 1,
        truncated: false,
      });
      gmailBounceMocks.matchGmailBounceToOutreach.mockReturnValue({
        kind: "ambiguous",
        candidates: [
          {
            ...firstCandidate!,
            recipientEmail: ambiguousRecipient,
            createdAt: new Date(),
            gmailRfcMessageId: null,
          },
          {
            ...secondCandidate!,
            recipientEmail: ambiguousRecipient,
            createdAt: new Date(),
            gmailRfcMessageId: null,
          },
        ],
      });
      try {
        const response = await request(app)
          .post("/api/admin/venue-owner/outreach/sync-gmail-bounces")
          .set("Cookie", adminCookieHeader(adminCredentialId))
          .send({ confirm: true });
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          matchedCount: 0,
          ambiguousCount: 1,
          ambiguousMatches: [{
            recipientEmail: ambiguousRecipient,
            candidates: [
              { businessName: "Ambiguous Venue One" },
              { businessName: "Ambiguous Venue Two" },
            ],
          }],
        });
        const rows = await db.select().from(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.recipientEmail, ambiguousRecipient));
        expect(rows.map((row) => row.deliveryStatus)).toEqual(["sent", "sent"]);
      } finally {
        await db.delete(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.recipientEmail, ambiguousRecipient));
      }

      const unmatchedNotice = {
        ...notice,
        gmailMessageId: `${TEST_PREFIX}-unmatched-gmail-bounce`,
        recipientEmail: `${TEST_PREFIX}-unmatched@example.test`,
        reason: "Mailbox unavailable",
      };
      const [unmatchedLog] = await db.insert(venueOutreachEmailLogsTable).values({
        businessName: "Unmatched Venue",
        recipientEmail: unmatchedNotice.recipientEmail,
        template: "introduction",
        kind: "new_venue_outreach",
        deliveryStatus: "sent",
        sentAt: new Date(),
      }).returning({ id: venueOutreachEmailLogsTable.id });
      try {
        gmailBounceMocks.readGmailDeliveryFailures.mockResolvedValue({
          messages: [unmatchedNotice],
          scannedCount: 1,
          truncated: false,
        });
        gmailBounceMocks.matchGmailBounceToOutreach.mockReturnValue({
          kind: "unmatched",
          reason: "no_eligible_send_candidate",
        });
        const unmatchedResponse = await request(app)
          .post("/api/admin/venue-owner/outreach/sync-gmail-bounces")
          .set("Cookie", adminCookieHeader(adminCredentialId))
          .send({ confirm: true });
        expect(unmatchedResponse.status).toBe(200);
        expect(unmatchedResponse.body).toMatchObject({
          unmatchedCount: 1,
          unmatchedNotices: [{
            gmailMessageId: unmatchedNotice.gmailMessageId,
            recipientEmail: unmatchedNotice.recipientEmail,
            status: "5.4.1",
            reason: "Mailbox unavailable",
            matchingReason: "no_eligible_send_candidate",
          }],
        });
        const [unchanged] = await db.select().from(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.id, unmatchedLog!.id));
        expect(unchanged).toMatchObject({
          deliveryStatus: "sent",
          gmailBounceMessageId: null,
        });
      } finally {
        await db.delete(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.id, unmatchedLog!.id));
      }

      const noHistoryNotice = {
        ...notice,
        gmailMessageId: `${TEST_PREFIX}-no-history-gmail-bounce`,
        recipientEmail: `${TEST_PREFIX}-external@example.test`,
        recipientCount: 1,
        recipientMismatch: false,
        originalMessageId: null,
        originalSentAt: null,
      };
      gmailBounceMocks.readGmailDeliveryFailures.mockResolvedValue({
        messages: [noHistoryNotice],
        scannedCount: 1,
        truncated: false,
      });
      gmailBounceMocks.matchGmailBounceToOutreach.mockReturnValue({
        kind: "unmatched",
        reason: "missing_original_message_id",
      });
      const noHistoryResponse = await request(app)
        .post("/api/admin/venue-owner/outreach/sync-gmail-bounces")
        .set("Cookie", adminCookieHeader(adminCredentialId))
        .send({ confirm: true });
      expect(noHistoryResponse.status).toBe(200);
      expect(noHistoryResponse.body).toMatchObject({
        matchedCount: 0,
        ambiguousCount: 0,
        unmatchedCount: 0,
        noHistoryCount: 1,
        unmatchedByReason: {
          missing_original_message_id: 0,
          no_eligible_send_candidate: 0,
          recipient_mismatch: 0,
          multiple_recipients: 0,
        },
        noHistoryNotices: [{
          gmailMessageId: noHistoryNotice.gmailMessageId,
          recipientEmail: noHistoryNotice.recipientEmail,
        }],
      });

      const expectedRecipient = `${TEST_PREFIX}-expected@example.test`;
      const wrongRecipient = `${TEST_PREFIX}-wrong@example.test`;
      const [wrongRecipientLog] = await db.insert(venueOutreachEmailLogsTable).values({
        businessName: "Wrong Recipient Candidate",
        recipientEmail: wrongRecipient,
        template: "introduction",
        kind: "new_venue_outreach",
        deliveryStatus: "sent",
        sentAt: new Date(),
      }).returning({ id: venueOutreachEmailLogsTable.id });
      const wrongRecipientNotice = {
        ...notice,
        gmailMessageId: `${TEST_PREFIX}-wrong-recipient-bounce`,
        recipientEmail: expectedRecipient,
        recipientCount: 1,
        recipientMismatch: false,
        originalMessageId: null,
      };
      try {
        gmailBounceMocks.readGmailDeliveryFailures.mockResolvedValue({
          messages: [wrongRecipientNotice],
          scannedCount: 1,
          truncated: false,
        });
        const response = await request(app)
          .put(`/api/admin/venue-owner/outreach/history/${wrongRecipientLog!.id}/bounce`)
          .set("Cookie", adminCookieHeader(adminCredentialId))
          .send({ gmailMessageId: wrongRecipientNotice.gmailMessageId, confirm: true });
        expect(response.status).toBe(409);
        const [unchanged] = await db.select().from(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.id, wrongRecipientLog!.id));
        expect(unchanged).toMatchObject({ deliveryStatus: "sent", gmailBounceMessageId: null });
      } finally {
        await db.delete(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.id, wrongRecipientLog!.id));
      }

      const messageIdRecipient = `${TEST_PREFIX}-message-id-mismatch@example.test`;
      const [messageIdLog] = await db.insert(venueOutreachEmailLogsTable).values({
        businessName: "Different Message ID Candidate",
        recipientEmail: messageIdRecipient,
        template: "introduction",
        kind: "new_venue_outreach",
        deliveryStatus: "sent",
        gmailRfcMessageId: `<${TEST_PREFIX}-stored@example.test>`,
        sentAt: new Date(),
      }).returning({ id: venueOutreachEmailLogsTable.id });
      const wrongMessageIdNotice = {
        ...notice,
        gmailMessageId: `${TEST_PREFIX}-wrong-message-id-bounce`,
        recipientEmail: messageIdRecipient,
        recipientCount: 1,
        recipientMismatch: false,
        originalMessageId: `<${TEST_PREFIX}-claimed@example.test>`,
      };
      try {
        gmailBounceMocks.readGmailDeliveryFailures.mockResolvedValue({
          messages: [wrongMessageIdNotice],
          scannedCount: 1,
          truncated: false,
        });
        const response = await request(app)
          .put(`/api/admin/venue-owner/outreach/history/${messageIdLog!.id}/bounce`)
          .set("Cookie", adminCookieHeader(adminCredentialId))
          .send({ gmailMessageId: wrongMessageIdNotice.gmailMessageId, confirm: true });
        expect(response.status).toBe(409);
        const [unchanged] = await db.select().from(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.id, messageIdLog!.id));
        expect(unchanged).toMatchObject({ deliveryStatus: "sent", gmailBounceMessageId: null });
      } finally {
        await db.delete(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.id, messageIdLog!.id));
      }
    });

    it("clears the retry and prior bounce rows after a recipient bounces again, then suppresses those Gmail notices", async () => {
      const recipientEmail = `${TEST_PREFIX}-repeat-bounce@example.test`;
      const oldBounceMessageId = `${TEST_PREFIX}-old-bounce-notice`;
      const retryBounceMessageId = `${TEST_PREFIX}-retry-bounce-notice`;
      const oldRfcMessageId = `<${TEST_PREFIX}-old-send@example.test>`;
      const retryRfcMessageId = `<${TEST_PREFIX}-retry-send@example.test>`;
      const oldSentAt = new Date(Date.now() - 60_000);
      const oldBouncedAt = new Date(Date.now() - 30_000);
      const retrySentAt = new Date();
      const [oldBounce] = await db.insert(venueOutreachEmailLogsTable).values({
        businessName: "Repeat Bounce Venue",
        recipientEmail,
        template: "introduction",
        kind: "new_venue_outreach",
        deliveryStatus: "bounced",
        gmailRfcMessageId: oldRfcMessageId,
        gmailBounceMessageId: oldBounceMessageId,
        sentAt: oldSentAt,
        bouncedAt: oldBouncedAt,
      }).returning({ id: venueOutreachEmailLogsTable.id });
      const [retrySend] = await db.insert(venueOutreachEmailLogsTable).values({
        businessName: "Repeat Bounce Venue",
        recipientEmail,
        template: "introduction",
        kind: "new_venue_outreach",
        deliveryStatus: "sent",
        retryOfLogId: oldBounce!.id,
        gmailRfcMessageId: retryRfcMessageId,
        sentAt: retrySentAt,
      }).returning({
        id: venueOutreachEmailLogsTable.id,
        businessName: venueOutreachEmailLogsTable.businessName,
        recipientEmail: venueOutreachEmailLogsTable.recipientEmail,
        createdAt: venueOutreachEmailLogsTable.createdAt,
        gmailRfcMessageId: venueOutreachEmailLogsTable.gmailRfcMessageId,
      });
      const oldNotice = {
        gmailMessageId: oldBounceMessageId,
        recipientEmail,
        recipientCount: 1,
        originalMessageId: oldRfcMessageId,
        originalSentAt: oldSentAt,
        receivedAt: oldBouncedAt,
        status: "5.4.1",
        reason: "Recipient address rejected",
      };
      const retryNotice = {
        ...oldNotice,
        gmailMessageId: retryBounceMessageId,
        originalMessageId: retryRfcMessageId,
        originalSentAt: retrySentAt,
        receivedAt: new Date(),
      };
      expect(oldBounce).toBeDefined();
      expect(retrySend).toBeDefined();

      try {
        gmailBounceMocks.readGmailDeliveryFailures.mockResolvedValue({
          messages: [oldNotice, retryNotice],
          scannedCount: 2,
          truncated: false,
        });
        gmailBounceMocks.matchGmailBounceToOutreach.mockReturnValue({
          kind: "matched",
          candidate: retrySend!,
        });

        const first = await request(app)
          .post("/api/admin/venue-owner/outreach/sync-gmail-bounces")
          .set("Cookie", adminCookieHeader(adminCredentialId))
          .send({ confirm: true });
        expect(first.status).toBe(200);
        expect(first.body).toMatchObject({
          matchedCount: 0,
          repeatBouncesClearedCount: 1,
          unmatchedCount: 0,
        });
        expect(await db.select().from(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.recipientEmail, recipientEmail))).toEqual([]);

        const tombstones = await db.select()
          .from(venueOutreachClearedBounceMessagesTable)
          .where(inArray(venueOutreachClearedBounceMessagesTable.gmailMessageId, [
            oldBounceMessageId,
            retryBounceMessageId,
          ]));
        expect(tombstones.map((row) => row.gmailMessageId).sort()).toEqual(
          [oldBounceMessageId, retryBounceMessageId].sort(),
        );

        gmailBounceMocks.matchGmailBounceToOutreach.mockClear();
        const second = await request(app)
          .post("/api/admin/venue-owner/outreach/sync-gmail-bounces")
          .set("Cookie", adminCookieHeader(adminCredentialId))
          .send({ confirm: true });
        expect(second.status).toBe(200);
        expect(second.body).toMatchObject({
          matchedCount: 0,
          repeatBouncesClearedCount: 0,
          unmatchedCount: 0,
        });
        expect(gmailBounceMocks.matchGmailBounceToOutreach).not.toHaveBeenCalled();
      } finally {
        await db.delete(venueOutreachEmailLogsTable)
          .where(inArray(venueOutreachEmailLogsTable.id, [oldBounce!.id, retrySend!.id]));
        await db.delete(venueOutreachClearedBounceMessagesTable)
          .where(inArray(venueOutreachClearedBounceMessagesTable.gmailMessageId, [
            oldBounceMessageId,
            retryBounceMessageId,
          ]));
        gmailBounceMocks.readGmailDeliveryFailures.mockReset();
        gmailBounceMocks.matchGmailBounceToOutreach.mockReset();
      }
    });

    it("does not clear an unrelated send merely because the same recipient bounced before", async () => {
      const recipientEmail = `${TEST_PREFIX}-unrelated-repeat@example.test`;
      const oldBounceMessageId = `${TEST_PREFIX}-unrelated-old-bounce`;
      const newBounceMessageId = `${TEST_PREFIX}-unrelated-new-bounce`;
      const oldRfcMessageId = `<${TEST_PREFIX}-unrelated-old-send@example.test>`;
      const newRfcMessageId = `<${TEST_PREFIX}-unrelated-new-send@example.test>`;
      const sentAt = new Date();
      const [oldBounce] = await db.insert(venueOutreachEmailLogsTable).values({
        businessName: "Unrelated Bounce Venue",
        recipientEmail,
        template: "introduction",
        kind: "new_venue_outreach",
        deliveryStatus: "bounced",
        gmailRfcMessageId: oldRfcMessageId,
        gmailBounceMessageId: oldBounceMessageId,
        sentAt: new Date(Date.now() - 60_000),
        bouncedAt: new Date(Date.now() - 30_000),
      }).returning({ id: venueOutreachEmailLogsTable.id });
      const [newSend] = await db.insert(venueOutreachEmailLogsTable).values({
        businessName: "Unrelated Bounce Venue",
        recipientEmail,
        template: "introduction",
        kind: "new_venue_outreach",
        deliveryStatus: "sent",
        gmailRfcMessageId: newRfcMessageId,
        sentAt,
      }).returning({
        id: venueOutreachEmailLogsTable.id,
        businessName: venueOutreachEmailLogsTable.businessName,
        recipientEmail: venueOutreachEmailLogsTable.recipientEmail,
        createdAt: venueOutreachEmailLogsTable.createdAt,
        gmailRfcMessageId: venueOutreachEmailLogsTable.gmailRfcMessageId,
      });
      const notice = {
        gmailMessageId: newBounceMessageId,
        recipientEmail,
        recipientCount: 1,
        originalMessageId: newRfcMessageId,
        originalSentAt: sentAt,
        receivedAt: new Date(),
        status: "5.4.1",
        reason: "Recipient address rejected",
      };

      try {
        gmailBounceMocks.readGmailDeliveryFailures.mockResolvedValue({
          messages: [{
            ...notice,
            gmailMessageId: oldBounceMessageId,
            originalMessageId: oldRfcMessageId,
          }, notice],
          scannedCount: 2,
          truncated: false,
        });
        gmailBounceMocks.matchGmailBounceToOutreach.mockReturnValue({
          kind: "matched",
          candidate: newSend!,
        });

        const response = await request(app)
          .post("/api/admin/venue-owner/outreach/sync-gmail-bounces")
          .set("Cookie", adminCookieHeader(adminCredentialId))
          .send({ confirm: true });
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          matchedCount: 1,
          repeatBouncesClearedCount: 0,
          unmatchedCount: 0,
        });
        const rows = await db.select().from(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.recipientEmail, recipientEmail));
        expect(rows).toHaveLength(2);
        expect(rows.map((row) => row.deliveryStatus)).toEqual(["bounced", "bounced"]);
      } finally {
        await db.delete(venueOutreachEmailLogsTable)
          .where(inArray(venueOutreachEmailLogsTable.id, [oldBounce!.id, newSend!.id]));
        gmailBounceMocks.readGmailDeliveryFailures.mockReset();
        gmailBounceMocks.matchGmailBounceToOutreach.mockReset();
      }
    });

    it("also clears repeat-bounce history when an admin links the notice manually", async () => {
      const recipientEmail = `${TEST_PREFIX}-manual-repeat-bounce@example.test`;
      const oldBounceMessageId = `${TEST_PREFIX}-manual-old-bounce-notice`;
      const retryBounceMessageId = `${TEST_PREFIX}-manual-retry-bounce-notice`;
      const oldRfcMessageId = `<${TEST_PREFIX}-manual-old-send@example.test>`;
      const retryRfcMessageId = `<${TEST_PREFIX}-manual-retry-send@example.test>`;
      const retrySentAt = new Date();
      const [oldBounce] = await db.insert(venueOutreachEmailLogsTable).values({
        businessName: "Manual Repeat Bounce Venue",
        recipientEmail,
        template: "introduction",
        kind: "new_venue_outreach",
        deliveryStatus: "bounced",
        gmailRfcMessageId: oldRfcMessageId,
        gmailBounceMessageId: oldBounceMessageId,
        sentAt: new Date(Date.now() - 60_000),
        bouncedAt: new Date(Date.now() - 30_000),
      }).returning({ id: venueOutreachEmailLogsTable.id });
      const [retrySend] = await db.insert(venueOutreachEmailLogsTable).values({
        businessName: "Manual Repeat Bounce Venue",
        recipientEmail,
        template: "introduction",
        kind: "new_venue_outreach",
        deliveryStatus: "sent",
        retryOfLogId: oldBounce!.id,
        gmailRfcMessageId: retryRfcMessageId,
        sentAt: retrySentAt,
      }).returning({ id: venueOutreachEmailLogsTable.id });
      const notice = {
        gmailMessageId: retryBounceMessageId,
        recipientEmail,
        recipientCount: 1,
        recipientMismatch: false,
        originalMessageId: retryRfcMessageId,
        originalSentAt: retrySentAt,
        receivedAt: new Date(),
        status: "5.4.1",
        reason: "Recipient address rejected",
      };

      try {
        gmailBounceMocks.readGmailDeliveryFailures.mockResolvedValue({
          messages: [notice],
          scannedCount: 1,
          truncated: false,
        });
        const response = await request(app)
          .put(`/api/admin/venue-owner/outreach/history/${retrySend!.id}/bounce`)
          .set("Cookie", adminCookieHeader(adminCredentialId))
          .send({ gmailMessageId: retryBounceMessageId, confirm: true });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          repeatBounceCleared: true,
          gmailBounceMessageId: retryBounceMessageId,
        });
        expect(await db.select().from(venueOutreachEmailLogsTable)
          .where(eq(venueOutreachEmailLogsTable.recipientEmail, recipientEmail))).toEqual([]);
        const tombstones = await db.select()
          .from(venueOutreachClearedBounceMessagesTable)
          .where(inArray(venueOutreachClearedBounceMessagesTable.gmailMessageId, [
            oldBounceMessageId,
            retryBounceMessageId,
          ]));
        expect(tombstones.map((row) => row.gmailMessageId).sort()).toEqual(
          [oldBounceMessageId, retryBounceMessageId].sort(),
        );
      } finally {
        await db.delete(venueOutreachEmailLogsTable)
          .where(inArray(venueOutreachEmailLogsTable.id, [oldBounce!.id, retrySend!.id]));
        await db.delete(venueOutreachClearedBounceMessagesTable)
          .where(inArray(venueOutreachClearedBounceMessagesTable.gmailMessageId, [
            oldBounceMessageId,
            retryBounceMessageId,
          ]));
        gmailBounceMocks.readGmailDeliveryFailures.mockReset();
        gmailBounceMocks.matchGmailBounceToOutreach.mockReset();
      }
    });
  },
);
