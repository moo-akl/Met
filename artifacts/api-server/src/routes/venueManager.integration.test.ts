/**
 * Venue manager account security — real-database integration tests.
 *
 * These flows depend on Postgres-enforced state (hashed session tokens,
 * one-time token consumption, membership uniqueness), so they run against
 * the actual database and the real Express app, exercising cookies and
 * CSRF headers exactly as a browser would.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import request from "supertest";
import { eq, inArray, like, sql } from "drizzle-orm";
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

const firebaseAuthStubs = vi.hoisted(() => ({
  getUser: vi.fn(),
  verifyIdToken: vi.fn(),
}));
const objectStorageStubs = vi.hoisted(() => ({
  deleteObjectEntityFile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../lib/objectStorage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/objectStorage")>();
  return {
    ...actual,
    ObjectStorageService: class extends actual.ObjectStorageService {
      deleteObjectEntityFile = objectStorageStubs.deleteObjectEntityFile;
    },
  };
});
vi.mock("../lib/firebaseAdmin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/firebaseAdmin")>();
  return { ...actual, adminAuth: () => firebaseAuthStubs };
});

// Rate limiting is covered by its own middleware tests; disabling it here
// keeps repeated failed-login scenarios deterministic.
vi.mock("../middlewares/rateLimit", () => ({
  createIpRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  createUserRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Tests supply a Firebase UID through a header while mocking Firebase Admin's
// user and ID-token verification calls.
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
const verifiedFirebaseEmails = new Map<string, string>();
const firebaseIdTokenIdentities = new Map<string, { uid: string; email: string }>();

function legacyPasswordHash(password: string): string {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1 });
  return `scrypt$${salt}$${hash.toString("base64url")}`;
}

async function createLegacyManager(name: string) {
  const [manager] = await db.insert(venueManagersTable).values({
    email: email(name),
    displayName: `Legacy ${name}`,
    passwordHash: legacyPasswordHash(STRONG),
  }).returning();
  return manager!;
}

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

  beforeAll(() => {
    firebaseAuthStubs.getUser.mockImplementation(async (uid: string) => {
      const userEmail = verifiedFirebaseEmails.get(uid);
      if (!userEmail) throw new Error("Firebase user not found");
      return { uid, email: userEmail, emailVerified: true };
    });
    firebaseAuthStubs.verifyIdToken.mockImplementation(async (token: string) => {
      const identity = firebaseIdTokenIdentities.get(token);
      if (!identity) throw new Error("Invalid Firebase ID token");
      return { ...identity, email_verified: true };
    });
  });

  /** Claim an owner account for a fresh business; returns an authed agent. */
  async function claimOwner(name: string) {
    const { profile, business } = await makeBusiness(name);
    verifiedFirebaseEmails.set(profile.ownerUid, email(name));
    const agent = request.agent(app);
    const res = await agent.post("/api/venue-manager/claim")
      .set("x-test-uid", profile.ownerUid)
      .send({
        email: email(name), displayName: `Owner ${name}`, password: STRONG,
        acceptedTermsVersion: "venue-2026-09",
      });
    expect(res.status).toBe(200);
    return { agent, csrf: res.body.csrfToken as string, business, profile };
  }

  async function acceptFirebaseInvitation(token: string, name: string, displayName: string) {
    const uid = `${PREFIX}-firebase-${name}`;
    const idToken = `${PREFIX}-id-token-${name}`;
    firebaseIdTokenIdentities.set(idToken, { uid, email: email(name) });
    const agent = request.agent(app);
    const response = await agent.post("/api/venue-manager/invitations/accept/firebase").send({
      token,
      idToken,
      displayName,
      acceptedTermsVersion: "venue-2026-09",
    });
    return { agent, response, uid };
  }

  it("rejects invalid credentials and never reveals which field failed", async () => {
    const res = await api().post("/api/venue-manager/session")
      .send({ email: email("nobody"), password: "WrongPassword1" });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid email or password.");
  });

  it("locks the account after repeated failed logins", async () => {
    await createLegacyManager("lockout");
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

    const { agent: invitee, response: accepted } = await acceptFirebaseInvitation(token, "invitee", "New Manager");
    expect(accepted.status).toBe(200);

    // One-time token: a second acceptance must fail.
    const replay = await api().post("/api/venue-manager/invitations/accept/firebase")
      .send({
        token, idToken: `${PREFIX}-id-token-invitee`,
        displayName: "Imposter", acceptedTermsVersion: "venue-2026-09",
      });
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
    await createLegacyManager("pwchange");
    const agent = request.agent(app);
    const initialLogin = await agent.post("/api/venue-manager/session")
      .send({ email: email("pwchange"), password: STRONG });
    expect(initialLogin.status).toBe(200);
    const session = await agent.get("/api/venue-manager/session");
    const csrf = session.body.csrfToken as string;
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
    const recoveree = await createLegacyManager("recoveree");
    await db.insert(venueMembershipsTable).values({
      businessId: business.id, managerId: recoveree.id, role: "editor", status: "active",
      acceptedAt: new Date(),
    });
    const invitee = request.agent(app);
    const initialLogin = await invitee.post("/api/venue-manager/session")
      .send({ email: email("recoveree"), password: STRONG });
    expect(initialLogin.status).toBe(200);
    const managerRow = recoveree;

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
    const { agent: invitee, response: accepted } = await acceptFirebaseInvitation(
      invite.body.invitationToken as string, "demotee", "Demotee",
    );
    expect(accepted.status).toBe(200);
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

  it("legacy password-only registration is disabled for staff-invite tokens", async () => {
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

    // Legacy password-only registration is rejected; Firebase enrollment is
    // covered by venueManagerFirebase.test.ts.
    const registerRes = await api().post("/api/venue-manager/register").send({
      token: rawToken,
      email: email("staff-invite-member"),
      displayName: "New Staff Member",
      password: STRONG,
      acceptedTermsVersion: "venue-2026-09",
    });
    expect(registerRes.status).toBe(410);

    // The legacy token is not consumed by the disabled endpoint.
    const replayRes = await api().post("/api/venue-manager/register").send({
      token: rawToken,
      email: email("staff-invite-replay"),
      displayName: "Replay Attacker",
      password: STRONG,
    });
    expect(replayRes.status).toBe(410);
  });

  it("Firebase claim requires the approved owner and cannot be duplicated", async () => {
    const { profile } = await claimOwner("claimed");

    const strangerUid = `${PREFIX}-uid-not-an-owner`;
    verifiedFirebaseEmails.set(strangerUid, email("stranger"));
    const stranger = await api().post("/api/venue-manager/claim")
      .set("x-test-uid", strangerUid)
      .send({
        email: email("stranger"), displayName: "Stranger", password: STRONG,
        acceptedTermsVersion: "venue-2026-09",
      });
    expect(stranger.status).toBe(403);

    const duplicate = await api().post("/api/venue-manager/claim")
      .set("x-test-uid", profile.ownerUid)
      .send({
        email: email("claimed"), displayName: "Owner again", password: STRONG,
        acceptedTermsVersion: "venue-2026-09",
      });
    expect(duplicate.status).toBe(200);
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
      const { agent: firebaseMgr, response: accepted } = await acceptFirebaseInvitation(
        invite.body.invitationToken as string, "qr-mgr", "Manager",
      );
      expect(accepted.status).toBe(200);
      const mgrCsrf = accepted.body.csrfToken as string;

      const res = await firebaseMgr
        .post(`/api/venue-manager/businesses/${business.id}/qr-code/regenerate`)
        .set("x-csrf-token", mgrCsrf);
      expect(res.status).toBe(403);
    });
  });

  describe("QR poster design settings", () => {
    const design = {
      heading: "Check in here",
      subheading: "Meet your next favorite person",
      footer: "Scan to check in",
      fontFamily: "serif" as const,
      titleFontSize: 42,
      bodyFontSize: 20,
      textColor: "#183c2f",
      accentColor: "#26735a",
      backgroundColor: "#f8f7ef",
      qrForegroundColor: "#183c2f",
      logoUrl: null,
      imageUrl: "https://example.com/poster-image.jpg",
      decorativeImages: [
        {
          id: "corner-flower",
          url: "https://example.com/corner-flower.png",
          position: { x: 10.5, y: 74, width: 15, height: 18 },
        },
        {
          id: "corner-leaf",
          url: "https://example.com/corner-leaf.png",
          position: { x: 89.5, y: 74, width: 15, height: 18 },
        },
      ],
      imagePositions: {
        logo: { x: 43, y: 7, width: 25, height: 6 },
        decoration: { x: 10.5, y: 74, width: 15, height: 18 },
      },
      textPositions: {
        brandMark: { x: 43, y: 7 },
        brandLabel: { x: 56, y: 7, fontSize: 12, width: 42 },
        venueName: { x: 50, y: 27 },
        heading: { x: 50, y: 36 },
        subheading: { x: 50, y: 44 },
        footer: { x: 50, y: 95 },
      },
      textContent: { brandLabel: "CEDAR HOUSE SOCIAL", venueName: "Cedar House" },
      textBoxes: [{
        id: "custom-welcome",
        text: "Find your people",
        x: 50,
        y: 47,
        fontSize: 20,
        color: "#26735a",
        align: "center" as const,
        width: 44,
      }],
    };

    it("saves valid settings across reloads without changing the venue check-in URL", async () => {
      objectStorageStubs.deleteObjectEntityFile.mockClear().mockResolvedValue(undefined);
      const { agent, csrf, business } = await claimOwner("poster-save");
      const beforeQr = await agent.get(`/api/venue-manager/businesses/${business.id}/qr-code`);
      expect(beforeQr.status).toBe(200);

      const saved = await agent.patch(`/api/venue-manager/businesses/${business.id}`)
        .set("x-csrf-token", csrf)
        .send({ qrPosterDesign: design });
      expect(saved.status).toBe(200);
      expect(saved.body.qrPosterDesign).toEqual(design);

      // A fresh detail request represents the editor loading after a reload.
      const reloaded = await agent.get(`/api/venue-manager/businesses/${business.id}`);
      expect(reloaded.status).toBe(200);
      expect(reloaded.body.qrPosterDesign).toEqual(design);

      const afterQr = await agent.get(`/api/venue-manager/businesses/${business.id}/qr-code`);
      expect(afterQr.status).toBe(200);
      expect(afterQr.body.qrToken).toBe(beforeQr.body.qrToken);
      expect(afterQr.body.qrUrl).toBe(beforeQr.body.qrUrl);
    });

    it("keeps a replaced poster image when a venue profile still references it", async () => {
      objectStorageStubs.deleteObjectEntityFile.mockClear().mockResolvedValue(undefined);
      const { agent, csrf, business, profile } = await claimOwner("poster-shared-image");
      const oldPosterImage = `/api/storage/objects/uploads/5c2a6b71-f6b8-42ee-832c-${String(business.id).padStart(12, "0")}`;
      const oldDesign = { ...design, logoUrl: oldPosterImage };
      await db.update(venueBusinessesTable).set({ qrPosterDesign: oldDesign })
        .where(eq(venueBusinessesTable.id, business.id));
      await db.update(venueOwnerProfilesTable).set({ coverPhotoUrl: oldPosterImage })
        .where(eq(venueOwnerProfilesTable.id, profile.id));

      const saved = await agent.patch(`/api/venue-manager/businesses/${business.id}`)
        .set("x-csrf-token", csrf)
        .send({
          qrPosterDesign: {
            ...oldDesign,
            logoUrl: null,
            decorativeImages: [{
              id: "shared-decoration",
              url: oldPosterImage,
              position: { x: 10.5, y: 74, width: 15, height: 18 },
            }],
          },
        });

      expect(saved.status).toBe(200);
      expect(objectStorageStubs.deleteObjectEntityFile).not.toHaveBeenCalled();
    });

    it("deletes an unreferenced poster image after a successful save", async () => {
      objectStorageStubs.deleteObjectEntityFile.mockReset().mockResolvedValue(undefined);
      const { agent, csrf, business } = await claimOwner("poster-cleanup-success");
      const oldPosterImage = `/api/storage/objects/uploads/5c2a6b71-f6b8-42ee-832c-${String(business.id).padStart(12, "0")}`;
      const oldDesign = { ...design, logoUrl: oldPosterImage };
      await db.update(venueBusinessesTable).set({ qrPosterDesign: oldDesign })
        .where(eq(venueBusinessesTable.id, business.id));

      const saved = await agent.patch(`/api/venue-manager/businesses/${business.id}`)
        .set("x-csrf-token", csrf)
        .send({ qrPosterDesign: { ...oldDesign, logoUrl: null } });

      expect(saved.status).toBe(200);
      expect(objectStorageStubs.deleteObjectEntityFile).toHaveBeenCalledExactlyOnceWith(
        oldPosterImage.replace("/api/storage", ""),
      );
    });

    it("discards an unreferenced uploaded image", async () => {
      objectStorageStubs.deleteObjectEntityFile.mockReset().mockResolvedValue(undefined);
      const { agent, csrf, business } = await claimOwner("poster-discard-unused");
      const objectPath = "/objects/uploads/f02fd82c-6379-4d86-bf4f-5821fe7bb2a2";

      const discarded = await agent.post(`/api/venue-manager/businesses/${business.id}/images/discard`)
        .set("x-csrf-token", csrf)
        .send({ objectPath });

      expect(discarded.status).toBe(200);
      expect(discarded.body).toEqual({ deleted: true, referenced: false });
      expect(objectStorageStubs.deleteObjectEntityFile).toHaveBeenCalledExactlyOnceWith(objectPath);
    });

    it("does not discard an uploaded image that has become a venue profile reference", async () => {
      objectStorageStubs.deleteObjectEntityFile.mockReset().mockResolvedValue(undefined);
      const { agent, csrf, business, profile } = await claimOwner("poster-discard-shared");
      const objectPath = "/objects/uploads/f02fd82c-6379-4d86-bf4f-5821fe7bb2a2";
      const imageUrl = `/api/storage${objectPath}`;
      await db.update(venueOwnerProfilesTable).set({ logoUrl: imageUrl })
        .where(eq(venueOwnerProfilesTable.id, profile.id));

      const discarded = await agent.post(`/api/venue-manager/businesses/${business.id}/images/discard`)
        .set("x-csrf-token", csrf)
        .send({ objectPath });

      expect(discarded.status).toBe(200);
      expect(discarded.body).toEqual({ deleted: false, referenced: true });
      expect(objectStorageStubs.deleteObjectEntityFile).not.toHaveBeenCalled();
    });

    it("does not discard an image referenced by another venue poster", async () => {
      objectStorageStubs.deleteObjectEntityFile.mockReset().mockResolvedValue(undefined);
      const { agent, csrf, business } = await claimOwner("poster-discard-other-poster");
      const { business: otherBusiness } = await makeBusiness("poster-discard-other-poster-ref");
      const objectPath = "/objects/uploads/f02fd82c-6379-4d86-bf4f-5821fe7bb2a2";
      const imageUrl = `/api/storage${objectPath}`;
      await db.update(venueBusinessesTable).set({
        qrPosterDesign: {
          ...design,
          imageUrl: null,
          decorativeImages: [{
            id: "other-venue-decoration",
            url: imageUrl,
            position: { x: 10.5, y: 74, width: 15, height: 18 },
          }],
        },
      }).where(eq(venueBusinessesTable.id, otherBusiness.id));

      const discarded = await agent.post(`/api/venue-manager/businesses/${business.id}/images/discard`)
        .set("x-csrf-token", csrf)
        .send({ objectPath });

      expect(discarded.status).toBe(200);
      expect(discarded.body).toEqual({ deleted: false, referenced: true });
      expect(objectStorageStubs.deleteObjectEntityFile).not.toHaveBeenCalled();
    });

    it("rejects discard paths outside uploaded image objects", async () => {
      const { agent, csrf, business } = await claimOwner("poster-discard-invalid");
      const discarded = await agent.post(`/api/venue-manager/businesses/${business.id}/images/discard`)
        .set("x-csrf-token", csrf)
        .send({ objectPath: "/objects/uploads/../../other/object" });

      expect(discarded.status).toBe(400);
      expect(objectStorageStubs.deleteObjectEntityFile).not.toHaveBeenCalled();
    });

    it("keeps a successful poster save when deleting an unused old image fails", async () => {
      objectStorageStubs.deleteObjectEntityFile.mockReset().mockRejectedValueOnce(new Error("storage unavailable"));
      const { agent, csrf, business } = await claimOwner("poster-cleanup-failure");
      const oldPosterImage = `/api/storage/objects/uploads/5c2a6b71-f6b8-42ee-832c-${String(business.id).padStart(12, "0")}`;
      const oldDesign = { ...design, logoUrl: oldPosterImage };
      await db.update(venueBusinessesTable).set({ qrPosterDesign: oldDesign })
        .where(eq(venueBusinessesTable.id, business.id));

      const saved = await agent.patch(`/api/venue-manager/businesses/${business.id}`)
        .set("x-csrf-token", csrf)
        .send({ qrPosterDesign: { ...oldDesign, logoUrl: null } });

      expect(saved.status).toBe(200);
      expect(saved.body.qrPosterDesign.logoUrl).toBeNull();
      const reloaded = await agent.get(`/api/venue-manager/businesses/${business.id}`);
      expect(reloaded.body.qrPosterDesign.logoUrl).toBeNull();
      expect(objectStorageStubs.deleteObjectEntityFile).toHaveBeenCalledExactlyOnceWith(
        oldPosterImage.replace("/api/storage", ""),
      );
    });

    it.each([
      ["text beyond the allowed length", { heading: "x".repeat(101) }],
      ["an unsupported font", { fontFamily: "comic" }],
      ["a low-contrast QR color", { qrForegroundColor: "#eeeeee" }],
      ["an unsafe image URL", { imageUrl: "javascript:alert(1)" }],
      ["an out-of-range title size", { titleFontSize: 100 }],
      ["an invalid custom text layer", { textBoxes: [{ id: "bad", text: "Hello", x: 500, y: 50, fontSize: 18, color: "#183c2f", align: "center" }] }],
      ["text inside the protected QR area", { textBoxes: [{ id: "over-code", text: "Hello", x: 50, y: 70, fontSize: 18, color: "#183c2f", align: "center" }] }],
      ["an image inside the protected QR area", { imagePositions: { logo: { x: 50, y: 70, width: 20, height: 10 } } }],
      ["an image extending beyond the poster edge", { imagePositions: { decoration: { x: 98, y: 30, width: 15, height: 18 } } }],
      ["a decorative image inside the protected QR area", { decorativeImages: [{ id: "unsafe-zone", url: "https://example.com/image.png", position: { x: 50, y: 70, width: 10, height: 10 } }] }],
      ["a decorative image extending beyond the poster edge", { decorativeImages: [{ id: "unsafe-edge", url: "https://example.com/image.png", position: { x: 95, y: 70, width: 20, height: 10 } }] }],
      ["duplicate decorative image identifiers", { decorativeImages: [
        { id: "same", url: "https://example.com/one.png", position: { x: 10.5, y: 74, width: 15, height: 18 } },
        { id: "same", url: "https://example.com/two.png", position: { x: 89.5, y: 74, width: 15, height: 18 } },
      ] }],
    ])("rejects invalid poster designs containing %s", async (_reason, override) => {
      const { agent, csrf, business } = await claimOwner(`poster-invalid-${String(_reason).replaceAll(" ", "-")}`);
      const invalid = { ...design, ...override };

      const response = await agent.patch(`/api/venue-manager/businesses/${business.id}`)
        .set("x-csrf-token", csrf)
        .send({ qrPosterDesign: invalid });

      expect(response.status).toBe(400);
      const reloaded = await agent.get(`/api/venue-manager/businesses/${business.id}`);
      expect(reloaded.status).toBe(200);
      expect(reloaded.body.qrPosterDesign).toBeNull();
    });

    it("keeps poster settings isolated between venues", async () => {
      const firstVenue = await claimOwner("poster-isolation-first");
      const secondVenue = await claimOwner("poster-isolation-second");

      const saved = await firstVenue.agent.patch(`/api/venue-manager/businesses/${firstVenue.business.id}`)
        .set("x-csrf-token", firstVenue.csrf)
        .send({ qrPosterDesign: design });
      expect(saved.status).toBe(200);

      const firstReload = await firstVenue.agent.get(`/api/venue-manager/businesses/${firstVenue.business.id}`);
      const secondReload = await secondVenue.agent.get(`/api/venue-manager/businesses/${secondVenue.business.id}`);
      expect(firstReload.body.qrPosterDesign).toEqual(design);
      expect(secondReload.body.qrPosterDesign).toBeNull();
    });

    it("lets an editor save poster settings but blocks business profile changes", async () => {
      const { agent: owner, csrf, business } = await claimOwner("poster-editor");
      const invitation = await owner.post(`/api/venue-manager/businesses/${business.id}/invitations`)
        .set("x-csrf-token", csrf)
        .send({ email: email("poster-editor-member"), role: "editor" });
      expect(invitation.status).toBe(201);

      const { agent: editor, response: accepted } = await acceptFirebaseInvitation(
        invitation.body.invitationToken as string, "poster-editor-member", "Poster Editor",
      );
      expect(accepted.status).toBe(200);
      const editorCsrf = accepted.body.csrfToken as string;

      const beforeQr = await editor.get(`/api/venue-manager/businesses/${business.id}/qr-code`);
      const save = await editor.patch(`/api/venue-manager/businesses/${business.id}`)
        .set("x-csrf-token", editorCsrf)
        .send({ qrPosterDesign: design });
      expect(save.status).toBe(200);
      expect(save.body.qrPosterDesign).toEqual(design);

      const profileChange = await editor.patch(`/api/venue-manager/businesses/${business.id}`)
        .set("x-csrf-token", editorCsrf)
        .send({ businessName: "Unauthorized change" });
      expect(profileChange.status).toBe(403);

      const reloaded = await editor.get(`/api/venue-manager/businesses/${business.id}`);
      expect(reloaded.body.businessName).toBe(`Business poster-editor`);
      expect(reloaded.body.qrPosterDesign).toEqual(design);
      const afterQr = await editor.get(`/api/venue-manager/businesses/${business.id}/qr-code`);
      expect(afterQr.body.qrToken).toBe(beforeQr.body.qrToken);
      expect(afterQr.body.qrUrl).toBe(beforeQr.body.qrUrl);
    });
  });
});
