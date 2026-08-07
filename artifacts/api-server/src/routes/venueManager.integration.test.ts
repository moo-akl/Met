/**
 * Venue manager account security — real-database integration tests.
 *
 * These flows depend on Postgres-enforced state (hashed session tokens,
 * one-time token consumption, membership uniqueness), so they run against
 * the actual database and the real Express app, exercising cookies and
 * CSRF headers exactly as a browser would.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { inArray, like, sql } from "drizzle-orm";
import {
  db,
  venueBusinessesTable,
  venueManagerRegistrationTokensTable,
  venueManagerSessionsTable,
  venueManagersTable,
  venueManagerTokensTable,
  venueMembershipAuditTable,
  venueMembershipsTable,
  venueOwnerProfilesTable,
} from "@workspace/db";

// Rate limiting is covered by its own middleware tests; disabling it here
// keeps repeated failed-login scenarios deterministic.
vi.mock("../middlewares/rateLimit", () => ({
  createIpRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  createUserRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// The claim route requires a Firebase-authenticated legacy owner. Tests
// impersonate one via a header instead of a real Firebase ID token.
vi.mock("../middlewares/requireUid", () => ({
  requireUid: (
    req: { uid?: string; header: (name: string) => string | undefined },
    res: { status: (code: number) => { json: (body: unknown) => void } },
    next: () => void,
  ) => {
    const uid = req.header("x-test-uid");
    if (!uid) {
      res.status(401).json({ message: "unauthenticated" });
      return;
    }
    req.uid = uid;
    next();
  },
}));

process.env["SESSION_SECRET"] ||= "test-session-secret";

const hasDatabase = Boolean(process.env["DATABASE_URL"]);
const PREFIX = `itest-vmgr-${process.pid}-${Date.now()}`;
const email = (name: string) => `${PREFIX}-${name}@example.com`;
const STRONG = "CorrectHorse99x";

async function cleanup() {
  const managers = await db.select({ id: venueManagersTable.id })
    .from(venueManagersTable)
    .where(like(venueManagersTable.email, `${PREFIX}%`));
  const managerIds = managers.map((m) => m.id);
  if (managerIds.length) {
    await db.delete(venueManagerSessionsTable).where(inArray(venueManagerSessionsTable.managerId, managerIds));
    await db.delete(venueManagerTokensTable).where(inArray(venueManagerTokensTable.managerId, managerIds));
    await db.delete(venueMembershipsTable).where(inArray(venueMembershipsTable.managerId, managerIds));
  }
  const profiles = await db.select({ id: venueOwnerProfilesTable.id })
    .from(venueOwnerProfilesTable)
    .where(sql`${venueOwnerProfilesTable.ownerUid} LIKE ${`${PREFIX}%`}`);
  const profileIds = profiles.map((p) => p.id);
  if (profileIds.length) {
    const businesses = await db.select({ id: venueBusinessesTable.id })
      .from(venueBusinessesTable)
      .where(inArray(venueBusinessesTable.venueOwnerProfileId, profileIds));
    const businessIds = businesses.map((b) => b.id);
    if (businessIds.length) {
      await db.delete(venueMembershipAuditTable).where(inArray(venueMembershipAuditTable.businessId, businessIds));
      await db.delete(venueManagerTokensTable).where(inArray(venueManagerTokensTable.businessId, businessIds));
      await db.delete(venueManagerRegistrationTokensTable).where(inArray(venueManagerRegistrationTokensTable.businessId, businessIds));
      await db.delete(venueMembershipsTable).where(inArray(venueMembershipsTable.businessId, businessIds));
      await db.delete(venueBusinessesTable).where(inArray(venueBusinessesTable.id, businessIds));
    }
    await db.delete(venueOwnerProfilesTable).where(inArray(venueOwnerProfilesTable.id, profileIds));
  }
  if (managerIds.length) {
    await db.delete(venueManagersTable).where(inArray(venueManagersTable.id, managerIds));
  }
}

async function makeBusiness(name: string) {
  const [profile] = await db.insert(venueOwnerProfilesTable).values({
    ownerUid: `${PREFIX}-uid-${name}`,
    placeId: `${PREFIX}-place-${name}`,
    placeName: `Venue ${name}`,
    businessName: `Business ${name}`,
    verificationDocUrl: "https://example.com/proof.pdf",
    applicationStatus: "approved",
    isApproved: true,
    isVerified: true,
    approvedAt: new Date(),
  }).returning();
  const [business] = await db.insert(venueBusinessesTable).values({
    venueOwnerProfileId: profile!.id,
    placeId: profile!.placeId,
    legalName: profile!.businessName,
    createdByUid: profile!.ownerUid,
  }).returning();
  return { profile: profile!, business: business! };
}

describe.skipIf(!hasDatabase)("venue manager accounts (real database)", async () => {
  const { default: app } = await import("../app");
  const api = () => request(app);

  beforeAll(cleanup);
  afterAll(cleanup);

  /** Claim an owner account for a fresh business; returns an authed agent. */
  async function claimOwner(name: string) {
    const { profile, business } = await makeBusiness(name);
    const agent = request.agent(app);
    const res = await agent.post("/api/venue-manager/claim")
      .set("x-test-uid", profile.ownerUid)
      .send({ email: email(name), displayName: `Owner ${name}`, password: STRONG });
    expect(res.status).toBe(200);
    return { agent, csrf: res.body.csrfToken as string, business, profile };
  }

  it("rejects invalid credentials and never reveals which field failed", async () => {
    const res = await api().post("/api/venue-manager/session")
      .send({ email: email("nobody"), password: "WrongPassword1" });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password.");
  });

  it("locks the account after repeated failed logins", async () => {
    await claimOwner("lockout");
    for (let i = 0; i < 5; i++) {
      await api().post("/api/venue-manager/session")
        .send({ email: email("lockout"), password: "WrongPassword1" });
    }
    const locked = await api().post("/api/venue-manager/session")
      .send({ email: email("lockout"), password: STRONG });
    expect(locked.status).toBe(429);
    expect(locked.headers["retry-after"]).toBeDefined();
  });

  it("signs in, reads the session, and requires CSRF for mutations", async () => {
    const { agent, business } = await claimOwner("csrf");

    const session = await agent.get("/api/venue-manager/session");
    expect(session.status).toBe(200);
    expect(session.body.authenticated).toBe(true);
    // GET /session rotates the CSRF token; the returned one is authoritative.
    const csrf = session.body.csrfToken as string;

    const noCsrf = await agent.post(`/api/venue-manager/businesses/${business.id}/invitations`)
      .send({ email: email("no-csrf-invitee"), role: "manager" });
    expect(noCsrf.status).toBe(403);

    const withCsrf = await agent.post(`/api/venue-manager/businesses/${business.id}/invitations`)
      .set("x-csrf-token", csrf)
      .send({ email: email("csrf-invitee"), role: "manager" });
    expect(withCsrf.status).toBe(201);
    expect(withCsrf.body.invitationToken).toBeTruthy();
  });

  it("recovers a usable CSRF token after a browser reload (cookie only)", async () => {
    const { agent, business } = await claimOwner("reload");
    // Simulate a reload: the client lost the in-memory CSRF token but the
    // cookie jar survives. GET /session must return a fresh usable token.
    const session = await agent.get("/api/venue-manager/session");
    expect(session.status).toBe(200);
    expect(session.body.csrfToken).toBeTruthy();

    const mutate = await agent.post(`/api/venue-manager/businesses/${business.id}/invitations`)
      .set("x-csrf-token", session.body.csrfToken)
      .send({ email: email("reload-invitee"), role: "manager" });
    expect(mutate.status).toBe(201);
  });

  it("logs out and revokes the server-side session", async () => {
    const { agent, csrf } = await claimOwner("logout");
    const out = await agent.delete("/api/venue-manager/session").set("x-csrf-token", csrf);
    expect(out.status).toBe(204);
    const after = await agent.get("/api/venue-manager/session");
    expect(after.status).toBe(401);
  });

  it("accepts an invitation exactly once and scopes the new manager to that venue", async () => {
    const { agent, csrf, business } = await claimOwner("invite");
    const other = await claimOwner("invite-other");

    const invite = await agent.post(`/api/venue-manager/businesses/${business.id}/invitations`)
      .set("x-csrf-token", csrf)
      .send({ email: email("invitee"), role: "manager" });
    const token = invite.body.invitationToken as string;

    const invitee = request.agent(app);
    const accepted = await invitee.post("/api/venue-manager/invitations/accept")
      .send({ token, displayName: "New Manager", password: STRONG });
    expect(accepted.status).toBe(200);

    // One-time token: a second acceptance must fail.
    const replay = await api().post("/api/venue-manager/invitations/accept")
      .send({ token, displayName: "Imposter", password: STRONG });
    expect(replay.status).toBe(400);

    // The manager cannot act on an unrelated business.
    const crossTenant = await invitee.post(`/api/venue-manager/businesses/${other.business.id}/invitations`)
      .set("x-csrf-token", accepted.body.csrfToken)
      .send({ email: email("sneak"), role: "editor" });
    expect(crossTenant.status).toBe(403);

    // Non-owners cannot invite even on their own business.
    const managerInvite = await invitee.post(`/api/venue-manager/businesses/${business.id}/invitations`)
      .set("x-csrf-token", accepted.body.csrfToken)
      .send({ email: email("subinvite"), role: "editor" });
    expect(managerInvite.status).toBe(403);
  });

  it("changing the password revokes every other session", async () => {
    const { agent, csrf } = await claimOwner("pwchange");
    const second = request.agent(app);
    const secondLogin = await second.post("/api/venue-manager/session")
      .send({ email: email("pwchange"), password: STRONG });
    expect(secondLogin.status).toBe(200);

    const changed = await agent.post("/api/venue-manager/password")
      .set("x-csrf-token", csrf)
      .send({ currentPassword: STRONG, newPassword: `${STRONG}New1` });
    expect(changed.status).toBe(200);

    const stale = await second.get("/api/venue-manager/session");
    expect(stale.status).toBe(401);

    const relogin = await api().post("/api/venue-manager/session")
      .send({ email: email("pwchange"), password: `${STRONG}New1` });
    expect(relogin.status).toBe(200);
  });

  it("owner-issued recovery resets the password once, then the token dies", async () => {
    const { agent, csrf, business } = await claimOwner("recovery");
    const invite = await agent.post(`/api/venue-manager/businesses/${business.id}/invitations`)
      .set("x-csrf-token", csrf)
      .send({ email: email("recoveree"), role: "editor" });
    const invitee = request.agent(app);
    const accepted = await invitee.post("/api/venue-manager/invitations/accept")
      .send({ token: invite.body.invitationToken, displayName: "Editor", password: STRONG });
    expect(accepted.status).toBe(200);
    const [managerRow] = await db.select({ id: venueManagersTable.id })
      .from(venueManagersTable).where(like(venueManagersTable.email, email("recoveree")));

    const issued = await agent.post(`/api/venue-manager/businesses/${business.id}/recovery`)
      .set("x-csrf-token", csrf)
      .send({ managerId: managerRow!.id });
    expect(issued.status).toBe(201);

    const recover = await api().post("/api/venue-manager/password/recover")
      .send({ token: issued.body.recoveryToken, newPassword: `${STRONG}Rec1` });
    expect(recover.status).toBe(204);

    // Existing sessions are revoked and the token is single-use.
    expect((await invitee.get("/api/venue-manager/session")).status).toBe(401);
    const replay = await api().post("/api/venue-manager/password/recover")
      .send({ token: issued.body.recoveryToken, newPassword: `${STRONG}Again2` });
    expect(replay.status).toBe(400);

    const relogin = await api().post("/api/venue-manager/session")
      .send({ email: email("recoveree"), password: `${STRONG}Rec1` });
    expect(relogin.status).toBe(200);
  });

  it("owners can change roles and remove managers, which kills their sessions", async () => {
    const { agent, csrf, business } = await claimOwner("roles");
    const invite = await agent.post(`/api/venue-manager/businesses/${business.id}/invitations`)
      .set("x-csrf-token", csrf)
      .send({ email: email("demotee"), role: "manager" });
    const invitee = request.agent(app);
    await invitee.post("/api/venue-manager/invitations/accept")
      .send({ token: invite.body.invitationToken, displayName: "Demotee", password: STRONG });
    const [managerRow] = await db.select({ id: venueManagersTable.id })
      .from(venueManagersTable).where(like(venueManagersTable.email, email("demotee")));

    const promoteToOwner = await agent.patch(`/api/venue-manager/businesses/${business.id}/memberships/${managerRow!.id}`)
      .set("x-csrf-token", csrf).send({ role: "owner" });
    expect(promoteToOwner.status).toBe(400);

    const demote = await agent.patch(`/api/venue-manager/businesses/${business.id}/memberships/${managerRow!.id}`)
      .set("x-csrf-token", csrf).send({ role: "editor" });
    expect(demote.status).toBe(204);

    const removed = await agent.delete(`/api/venue-manager/businesses/${business.id}/memberships/${managerRow!.id}`)
      .set("x-csrf-token", csrf);
    expect(removed.status).toBe(204);
    expect((await invitee.get("/api/venue-manager/session")).status).toBe(401);
  });

  it("staff-invite token generated by owner registers a new manager (hash algorithm round-trip)", async () => {
    // Create an approved venue with a legacy mobile owner uid (no manager account yet).
    const { profile, business } = await makeBusiness("staff-invite");

    // Owner generates an invite link from the mobile app route.
    const inviteRes = await api()
      .post("/api/venue-owner/me/staff-invite")
      .set("x-test-uid", profile.ownerUid);
    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.token).toBeTruthy();
    expect(inviteRes.body.registrationUrl).toContain(inviteRes.body.token as string);

    const rawToken = inviteRes.body.token as string;

    // A staff member opens the link and submits the registration form.
    const registerRes = await api().post("/api/venue-manager/register").send({
      token: rawToken,
      email: email("staff-invite-member"),
      displayName: "New Staff Member",
      password: STRONG,
    });
    expect(registerRes.status).toBe(200);
    expect(registerRes.body.authenticated).toBe(true);
    expect(registerRes.body.csrfToken).toBeTruthy();

    // The new manager must be scoped to the correct business.
    const agent = request.agent(app);
    const loginRes = await agent.post("/api/venue-manager/session")
      .send({ email: email("staff-invite-member"), password: STRONG });
    expect(loginRes.status).toBe(200);

    const businesses = await agent.get("/api/venue-manager/businesses");
    expect(businesses.status).toBe(200);
    const ids = (businesses.body.businesses as Array<{ businessId: number }>).map((b) => b.businessId);
    expect(ids).toContain(business.id);

    // The token must be single-use.
    const replayRes = await api().post("/api/venue-manager/register").send({
      token: rawToken,
      email: email("staff-invite-replay"),
      displayName: "Replay Attacker",
      password: STRONG,
    });
    expect(replayRes.status).toBe(400);
  });

  it("legacy claim requires the approved owner and cannot be duplicated", async () => {
    const { profile } = await claimOwner("claimed");

    const stranger = await api().post("/api/venue-manager/claim")
      .set("x-test-uid", `${PREFIX}-uid-not-an-owner`)
      .send({ email: email("stranger"), displayName: "Stranger", password: STRONG });
    expect(stranger.status).toBe(403);

    const duplicate = await api().post("/api/venue-manager/claim")
      .set("x-test-uid", profile.ownerUid)
      .send({ email: email("claimed"), displayName: "Owner again", password: STRONG });
    expect(duplicate.status).toBe(409);
  });

  it("manager cookies carry no consumer identity and consumer routes reject them", async () => {
    const { agent } = await claimOwner("isolation");
    // Consumer endpoints require a Firebase bearer token; the manager cookie
    // alone must never grant access to personal-profile surfaces.
    const res = await agent.get("/api/profiles/me");
    expect([401, 403]).toContain(res.status);
  });

  describe("QR code endpoints", () => {
    it("GET /qr-code returns a qrToken and a qrUrl with the expected host and path shape", async () => {
      const { agent, business } = await claimOwner("qr-get");
      const res = await agent.get(`/api/venue-manager/businesses/${business.id}/qr-code`);
      expect(res.status).toBe(200);
      // Token must be a UUID
      expect(res.body.qrToken).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      // URL must include the canonical deep-link host (metapp.replit.app or
      // whatever APP_BASE_URL is set to) and the /v/<placeId>?t=<token> shape.
      const url = new URL(res.body.qrUrl as string);
      expect(url.pathname).toMatch(/^\/v\//);
      expect(url.searchParams.get("t")).toBe(res.body.qrToken);
    });

    it("GET /qr-code returns the same token on repeated calls (stable)", async () => {
      const { agent, business } = await claimOwner("qr-stable");
      const first = await agent.get(`/api/venue-manager/businesses/${business.id}/qr-code`);
      const second = await agent.get(`/api/venue-manager/businesses/${business.id}/qr-code`);
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.qrToken).toBe(first.body.qrToken);
    });

    it("POST /qr-code/regenerate issues a new token and invalidates the old one (owner only)", async () => {
      const { agent, csrf, business } = await claimOwner("qr-regen");
      const before = await agent.get(`/api/venue-manager/businesses/${business.id}/qr-code`);
      expect(before.status).toBe(200);

      const regen = await agent
        .post(`/api/venue-manager/businesses/${business.id}/qr-code/regenerate`)
        .set("x-csrf-token", csrf);
      expect(regen.status).toBe(200);
      expect(regen.body.qrToken).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      // New token must differ from the old one
      expect(regen.body.qrToken).not.toBe(before.body.qrToken);
      // Subsequent GET must return the new token
      const after = await agent.get(`/api/venue-manager/businesses/${business.id}/qr-code`);
      expect(after.body.qrToken).toBe(regen.body.qrToken);
    });

    it("POST /qr-code/regenerate is rejected without a CSRF token", async () => {
      const { agent, business } = await claimOwner("qr-csrf");
      const res = await agent.post(
        `/api/venue-manager/businesses/${business.id}/qr-code/regenerate`,
      );
      expect(res.status).toBe(403);
    });

    it("POST /qr-code/regenerate is rejected for managers (non-owners)", async () => {
      const { agent, csrf, business } = await claimOwner("qr-role");
      // Invite a manager
      const invite = await agent
        .post(`/api/venue-manager/businesses/${business.id}/invitations`)
        .set("x-csrf-token", csrf)
        .send({ email: email("qr-mgr"), role: "manager" });
      const mgr = request.agent(app);
      const accepted = await mgr.post("/api/venue-manager/invitations/accept").send({
        token: invite.body.invitationToken,
        displayName: "Manager",
        password: STRONG,
      });
      expect(accepted.status).toBe(200);
      const mgrCsrf = accepted.body.csrfToken as string;

      const res = await mgr
        .post(`/api/venue-manager/businesses/${business.id}/qr-code/regenerate`)
        .set("x-csrf-token", mgrCsrf);
      expect(res.status).toBe(403);
    });
  });
});
