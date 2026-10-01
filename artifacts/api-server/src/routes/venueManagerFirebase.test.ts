import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { and, eq, inArray, like, or, sql } from "drizzle-orm";
import {
  db,
  venueAnnouncementsTable,
  venueBusinessesTable,
  venueEventsTable,
  venueManagerRegistrationTokensTable,
  venueManagerSessionsTable,
  venueManagerTokensTable,
  venueManagersTable,
  venueMembershipAuditTable,
  venueMembershipsTable,
  venueOwnerProfilesTable,
  venueRewardsTable,
} from "@workspace/db";

const verifyIdToken = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());
const getUserByEmail = vi.hoisted(() => vi.fn());

vi.mock("../lib/firebaseAdmin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/firebaseAdmin")>();
  return { ...actual, adminAuth: () => ({ verifyIdToken, getUser, getUserByEmail }) };
});
vi.mock("../middlewares/rateLimit", () => ({
  createIpRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  createUserRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
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
const hasFirebaseUidColumn = hasDatabase
  ? await db.execute(sql`SELECT 1 FROM information_schema.columns WHERE table_name = 'venue_managers' AND column_name = 'firebase_uid'`)
    .then((result) => result.rows.length > 0)
    .catch(() => false)
  : false;
const PREFIX = `fb-vmgr-${process.pid}-${Date.now()}`;
const EMAIL = `${PREFIX}@example.com`;
const LEGACY_PASSWORD = "CorrectHorse99x";
const UID = `firebase-${PREFIX}`;
const ID_TOKEN = `id-token-${PREFIX}`;

function legacyPasswordHash(password: string): string {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1 });
  return `scrypt$${salt}$${hash.toString("base64url")}`;
}

async function cleanup() {
  const managers = await db.select({ id: venueManagersTable.id }).from(venueManagersTable)
    .where(like(venueManagersTable.email, `${PREFIX}%`));
  const managerIds = managers.map(({ id }) => id);
  if (managerIds.length) {
    await db.delete(venueManagerSessionsTable).where(inArray(venueManagerSessionsTable.managerId, managerIds));
    await db.delete(venueMembershipsTable).where(inArray(venueMembershipsTable.managerId, managerIds));
  }
  const profiles = await db.select({ id: venueOwnerProfilesTable.id }).from(venueOwnerProfilesTable)
    .where(or(
      sql`${venueOwnerProfilesTable.ownerUid} LIKE ${`admin:${PREFIX}%`}`,
      like(venueOwnerProfilesTable.placeId, `${PREFIX}%`),
    ));
  const profileIds = profiles.map(({ id }) => id);
  if (profileIds.length) {
    const businesses = await db.select({ id: venueBusinessesTable.id, placeId: venueBusinessesTable.placeId })
      .from(venueBusinessesTable).where(inArray(venueBusinessesTable.venueOwnerProfileId, profileIds));
    const businessIds = businesses.map(({ id }) => id);
    const placeIds = businesses.map(({ placeId }) => placeId);
    if (businessIds.length) {
      await db.delete(venueMembershipAuditTable).where(inArray(venueMembershipAuditTable.businessId, businessIds));
      await db.delete(venueManagerRegistrationTokensTable).where(inArray(venueManagerRegistrationTokensTable.businessId, businessIds));
      await db.delete(venueManagerTokensTable).where(inArray(venueManagerTokensTable.businessId, businessIds));
      await db.delete(venueMembershipsTable).where(inArray(venueMembershipsTable.businessId, businessIds));
      await db.delete(venueBusinessesTable).where(inArray(venueBusinessesTable.id, businessIds));
    }
    if (placeIds.length) {
      await db.delete(venueEventsTable).where(inArray(venueEventsTable.placeId, placeIds));
      await db.delete(venueRewardsTable).where(inArray(venueRewardsTable.placeId, placeIds));
      await db.delete(venueAnnouncementsTable).where(inArray(venueAnnouncementsTable.placeId, placeIds));
    }
    await db.delete(venueOwnerProfilesTable).where(inArray(venueOwnerProfilesTable.id, profileIds));
  }
  if (managerIds.length) await db.delete(venueManagersTable).where(inArray(venueManagersTable.id, managerIds));
}

describe.skipIf(!hasFirebaseUidColumn)("venue manager Firebase identity", () => {
  let app: typeof import("../app").default;
  beforeAll(async () => {
    ({ default: app } = await import("../app"));
    verifyIdToken.mockImplementation(async (token: string) => {
      if (token !== ID_TOKEN) throw new Error("bad token");
      return { uid: UID, email: EMAIL, email_verified: true };
    });
    await cleanup();
  });
  afterAll(cleanup);

  it("denies email-match-only sessions and requires the legacy password to link", async () => {
    const [manager] = await db.insert(venueManagersTable).values({
      email: EMAIL, displayName: "Legacy Owner", passwordHash: legacyPasswordHash(LEGACY_PASSWORD),
    }).returning();
    const api = request(app);
    const emailOnly = await api.post("/api/venue-manager/session/firebase").send({ idToken: ID_TOKEN });
    expect(emailOnly.status).toBe(409);
    expect(emailOnly.body.code).toBe("link_required");

    const wrongPassword = await api.post("/api/venue-manager/link/firebase")
      .send({ idToken: ID_TOKEN, legacyPassword: "WrongPassword99" });
    expect(wrongPassword.status).toBe(401);
    const [stillUnlinked] = await db.select({ firebaseUid: venueManagersTable.firebaseUid })
      .from(venueManagersTable).where(eq(venueManagersTable.id, manager!.id));
    expect(stillUnlinked?.firebaseUid).toBeNull();

    const linked = await api.post("/api/venue-manager/link/firebase")
      .send({ idToken: ID_TOKEN, legacyPassword: LEGACY_PASSWORD });
    expect(linked.status).toBe(200);
    const [bound] = await db.select({ firebaseUid: venueManagersTable.firebaseUid })
      .from(venueManagersTable).where(eq(venueManagersTable.id, manager!.id));
    expect(bound?.firebaseUid).toBe(UID);
    expect((await api.post("/api/venue-manager/session/firebase").send({ idToken: ID_TOKEN })).status).toBe(200);
    expect((await api.post("/api/venue-manager/session").send({ email: EMAIL, password: LEGACY_PASSWORD })).status).toBe(409);
  });

  it("migrates only the synthetic venue owner's scoped content and revokes prior sessions", async () => {
    const managerEmail = `${PREFIX}-migration@example.com`;
    const managerUid = `${UID}-migration`;
    const [manager] = await db.insert(venueManagersTable).values({
      email: managerEmail, displayName: "Migration Owner", passwordHash: legacyPasswordHash(LEGACY_PASSWORD),
    }).returning();
    const oldOwnerUid = `admin:${PREFIX}-synthetic`;
    const placeId = `${PREFIX}-migration-place`;
    const [profile] = await db.insert(venueOwnerProfilesTable).values({
      ownerUid: oldOwnerUid, placeId, placeName: "Migration Venue", businessName: "Migration Venue",
      contactEmail: managerEmail, verificationDocUrl: "https://example.com/verification.pdf",
      applicationStatus: "approved", isApproved: true, isVerified: true, approvedAt: new Date(),
    }).returning();
    const [business] = await db.insert(venueBusinessesTable).values({
      venueOwnerProfileId: profile!.id, placeId, legalName: "Migration Venue", createdByUid: oldOwnerUid,
    }).returning();
    await db.insert(venueMembershipsTable).values({
      businessId: business!.id, managerId: manager!.id, role: "owner", status: "active", acceptedAt: new Date(),
    });
    const now = new Date();
    await db.insert(venueEventsTable).values({
      ownerUid: oldOwnerUid, placeId, title: "Migrated", startsAt: now,
    });
    await db.insert(venueRewardsTable).values({
      ownerUid: oldOwnerUid, placeId, title: "Reward", prizeDescription: "Prize",
      startDate: now, endDate: new Date(now.getTime() + 86_400_000), winnerUid: `${PREFIX}-guest-winner`,
    });
    await db.insert(venueAnnouncementsTable).values({
      ownerUid: oldOwnerUid, placeId, title: "Announcement", body: "Body",
    });

    const oldAgent = request.agent(app);
    const oldSession = await oldAgent.post("/api/venue-manager/session")
      .send({ email: managerEmail, password: LEGACY_PASSWORD });
    expect(oldSession.status).toBe(200);
    const idToken = `${ID_TOKEN}-migration`;
    verifyIdToken.mockImplementation(async (token: string) => token === idToken
      ? { uid: managerUid, email: managerEmail, email_verified: true }
      : Promise.reject(new Error("bad token")));
    const link = await request(app).post("/api/venue-manager/link/firebase")
      .send({ idToken, legacyPassword: LEGACY_PASSWORD });
    expect(link.status).toBe(200);
    expect((await oldAgent.get("/api/venue-manager/session")).status).toBe(401);

    const [migratedProfile] = await db.select().from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.id, profile!.id));
    const [migratedBusiness] = await db.select().from(venueBusinessesTable)
      .where(eq(venueBusinessesTable.id, business!.id));
    const [migratedEvent] = await db.select().from(venueEventsTable).where(eq(venueEventsTable.placeId, placeId));
    const [migratedReward] = await db.select().from(venueRewardsTable).where(eq(venueRewardsTable.placeId, placeId));
    const [migratedAnnouncement] = await db.select().from(venueAnnouncementsTable).where(eq(venueAnnouncementsTable.placeId, placeId));
    expect(migratedProfile?.ownerUid).toBe(managerUid);
    expect(migratedBusiness?.createdByUid).toBe(oldOwnerUid);
    expect(migratedEvent?.ownerUid).toBe(managerUid);
    expect(migratedReward?.ownerUid).toBe(managerUid);
    expect(migratedReward?.winnerUid).toBe(`${PREFIX}-guest-winner`);
    expect(migratedAnnouncement?.ownerUid).toBe(managerUid);
    const [membership] = await db.select().from(venueMembershipsTable)
      .where(and(eq(venueMembershipsTable.businessId, business!.id), eq(venueMembershipsTable.role, "owner")));
    expect(membership?.uid).toBe(managerUid);
  });

  it("rejects invalid tokens and prevents Firebase UID email mismatches", async () => {
    expect((await request(app).post("/api/venue-manager/session/firebase").send({ idToken: "invalid" })).status).toBe(401);
    const collisionEmail = `${PREFIX}-uid-collision@example.com`;
    await db.insert(venueManagersTable).values({
      email: collisionEmail,
      displayName: "Other Legacy Manager",
      passwordHash: legacyPasswordHash(LEGACY_PASSWORD),
    });
    const conflictingUid = `${UID}-already-linked`;
    await db.insert(venueManagersTable).values({
      email: `${PREFIX}-uid-owner@example.com`,
      firebaseUid: conflictingUid,
      displayName: "Already Linked Manager",
      passwordHash: legacyPasswordHash(LEGACY_PASSWORD),
    });
    const mismatchToken = `${ID_TOKEN}-mismatch`;
    verifyIdToken.mockImplementation(async (token: string) => token === mismatchToken
      ? { uid: conflictingUid, email: collisionEmail, email_verified: true }
      : Promise.reject(new Error("bad token")));
    const result = await request(app).post("/api/venue-manager/link/firebase")
      .send({ idToken: mismatchToken, legacyPassword: LEGACY_PASSWORD });
    expect(result.status).toBe(409);
  });

  it("registers the invited Firebase identity once and binds its synthetic owner venue", async () => {
    const ownerEmail = `${PREFIX}-registration@example.com`;
    const publicEmail = `${PREFIX}-public-contact@example.com`;
    const ownerUid = `${UID}-registration`;
    const placeId = `${PREFIX}-registration-place`;
    const rawToken = `${PREFIX}-registration-token`;
    const [profile] = await db.insert(venueOwnerProfilesTable).values({
      ownerUid: `admin:${PREFIX}-registration-synthetic`,
      placeId,
      placeName: "Registration Venue",
      businessName: "Registration Venue",
      contactEmail: publicEmail,
      verificationDocUrl: "https://example.com/verification.pdf",
      applicationStatus: "approved",
      isApproved: true,
      isVerified: true,
      approvedAt: new Date(),
    }).returning();
    const [business] = await db.insert(venueBusinessesTable).values({
      venueOwnerProfileId: profile!.id, placeId, legalName: "Registration Venue",
      createdByUid: profile!.ownerUid,
    }).returning();
    await db.insert(venueManagerRegistrationTokensTable).values({
      businessId: business!.id,
      tokenHash: crypto.createHash("sha256").update(rawToken).digest("base64url"),
      invitedEmail: ownerEmail,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const idToken = `${ID_TOKEN}-registration`;
    const wrongEmailToken = `${idToken}-wrong-email`;
    verifyIdToken.mockImplementation(async (token: string) => {
      if (token === wrongEmailToken) {
        return { uid: `${ownerUid}-wrong`, email: publicEmail, email_verified: true };
      }
      if (token !== idToken) throw new Error("bad token");
      return { uid: ownerUid, email: ownerEmail, email_verified: true };
    });
    const payload = {
      token: rawToken, idToken, displayName: "Registration Owner", acceptedTermsVersion: "venue-2026-09",
    };
    const api = request(app);
    const registered = await api.post("/api/venue-manager/register/firebase")
      .send({ ...payload, idToken: wrongEmailToken });
    expect(registered.status).toBe(403);
    const success = await api.post("/api/venue-manager/register/firebase").send(payload);
    expect(success.status).toBe(200);
    expect(success.body.authenticated).toBe(true);
    expect((await api.post("/api/venue-manager/register/firebase").send(payload)).status).toBe(400);

    const [manager] = await db.select().from(venueManagersTable)
      .where(eq(venueManagersTable.firebaseUid, ownerUid));
    expect(manager?.email).toBe(ownerEmail);
    const [boundProfile] = await db.select().from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.id, profile!.id));
    expect(boundProfile?.ownerUid).toBe(ownerUid);
    expect(boundProfile?.contactEmail).toBe(publicEmail);
    const [membership] = await db.select().from(venueMembershipsTable).where(and(
      eq(venueMembershipsTable.businessId, business!.id),
      eq(venueMembershipsTable.managerId, manager!.id),
    ));
    expect(membership?.role).toBe("owner");
    expect(membership?.status).toBe("active");
  });

  it("adds separately approved web applications to the same verified Firebase manager account", async () => {
    const ownerEmail = `${PREFIX}-branches@example.com`;
    const ownerUid = `${UID}-branches`;
    const idToken = `${ID_TOKEN}-branches`;
    const wrongEmailToken = `${idToken}-wrong-email`;
    const branches = [];

    for (const branch of ["north", "south"]) {
      const syntheticUid = `web:${PREFIX}-${branch}`;
      const placeId = `${PREFIX}-${branch}-place`;
      const [profile] = await db.insert(venueOwnerProfilesTable).values({
        ownerUid: syntheticUid,
        placeId,
        placeName: `${branch} branch`,
        businessName: `${branch} branch`,
        contactEmail: ownerEmail,
        verificationDocUrl: "https://example.com/verification.pdf",
        applicationStatus: "approved",
        isApproved: true,
        isVerified: true,
        approvedAt: new Date(),
      }).returning();
      const [business] = await db.insert(venueBusinessesTable).values({
        venueOwnerProfileId: profile!.id,
        placeId,
        legalName: `${branch} branch`,
        createdByUid: syntheticUid,
      }).returning();
      await db.insert(venueMembershipsTable).values({
        businessId: business!.id,
        uid: syntheticUid,
        managerId: null,
        role: "owner",
        status: "active",
      });
      const rawToken = `${PREFIX}-${branch}-registration-token`;
      await db.insert(venueManagerRegistrationTokensTable).values({
        businessId: business!.id,
        tokenHash: crypto.createHash("sha256").update(rawToken).digest("base64url"),
        invitedEmail: ownerEmail,
        expiresAt: new Date(Date.now() + 60_000),
      });
      branches.push({ branch, profile: profile!, business: business!, rawToken, syntheticUid });
    }

    verifyIdToken.mockImplementation(async (token: string) => {
      if (token === wrongEmailToken) {
        return { uid: `${ownerUid}-wrong`, email: `${PREFIX}-wrong-branches@example.com`, email_verified: true };
      }
      if (token === idToken) return { uid: ownerUid, email: ownerEmail, email_verified: true };
      throw new Error("bad token");
    });

    const api = request(app);
    const payload = {
      idToken,
      displayName: "Branch Manager",
      acceptedTermsVersion: "venue-2026-09",
    };
    const [first, second] = branches;
    const wrongIdentity = await api.post("/api/venue-manager/register/firebase").send({
      ...payload,
      token: second!.rawToken,
      idToken: wrongEmailToken,
    });
    expect(wrongIdentity.status).toBe(403);

    const firstRegistration = await api.post("/api/venue-manager/register/firebase").send({
      ...payload,
      token: first!.rawToken,
    });
    expect(firstRegistration.status).toBe(200);
    const [manager] = await db.select().from(venueManagersTable)
      .where(eq(venueManagersTable.firebaseUid, ownerUid));

    const secondRegistration = await api.post("/api/venue-manager/register/firebase").send({
      ...payload,
      token: second!.rawToken,
    });
    expect(secondRegistration.status).toBe(200);
    const [sameManager] = await db.select().from(venueManagersTable)
      .where(eq(venueManagersTable.firebaseUid, ownerUid));
    expect(sameManager?.id).toBe(manager?.id);
    const setCookieHeader = secondRegistration.headers["set-cookie"];
    const sessionCookies = (Array.isArray(setCookieHeader)
      ? setCookieHeader
      : setCookieHeader
        ? [setCookieHeader]
        : [])
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
    expect(sessionCookies).toBeTruthy();
    const visibleBranches = await request(app)
      .get("/api/venue-manager/businesses")
      .set("Cookie", sessionCookies!);
    expect(visibleBranches.status).toBe(200);
    expect(visibleBranches.body.businesses.map((item: { businessName: string }) => item.businessName).sort())
      .toEqual(["north branch", "south branch"]);
    getUserByEmail.mockResolvedValue({
      uid: ownerUid,
      email: ownerEmail,
      emailVerified: true,
    });
    const linkedAccount = await request(app)
      .get("/api/venue-manager/me/met-profile")
      .set("Cookie", sessionCookies!);
    expect(linkedAccount.status).toBe(200);
    expect(linkedAccount.body).toMatchObject({
      linked: true,
      firebaseAccountLinked: true,
      email: ownerEmail,
    });

    for (const branch of branches) {
      const [profile] = await db.select().from(venueOwnerProfilesTable)
        .where(eq(venueOwnerProfilesTable.id, branch.profile.id));
      expect(profile?.ownerUid).toBe(branch.syntheticUid);
      const [membership] = await db.select().from(venueMembershipsTable).where(and(
        eq(venueMembershipsTable.businessId, branch.business.id),
        eq(venueMembershipsTable.managerId, manager!.id),
      ));
      expect(membership?.role).toBe("owner");
      expect(membership?.status).toBe("active");
      expect(membership?.uid).toBeNull();
    }

    expect((await api.post("/api/venue-manager/register/firebase").send({
      ...payload,
      token: first!.rawToken,
    })).status).toBe(400);
  });

  it("accepts a Firebase invitation only for its email and consumes it once", async () => {
    const creatorEmail = EMAIL;
    const [creator] = await db.select({ id: venueManagersTable.id }).from(venueManagersTable)
      .where(eq(venueManagersTable.email, creatorEmail)).limit(1);
    const invitedEmail = `${PREFIX}-invite@example.com`;
    const invitedUid = `${UID}-invite`;
    const placeId = `${PREFIX}-invite-place`;
    const [profile] = await db.insert(venueOwnerProfilesTable).values({
      ownerUid: `admin:${PREFIX}-invite-synthetic`, placeId, placeName: "Invite Venue",
      businessName: "Invite Venue", verificationDocUrl: "https://example.com/proof.pdf",
      applicationStatus: "approved", isApproved: true, isVerified: true, approvedAt: new Date(),
    }).returning();
    const [business] = await db.insert(venueBusinessesTable).values({
      venueOwnerProfileId: profile!.id, placeId, legalName: "Invite Venue", createdByUid: profile!.ownerUid,
    }).returning();
    const rawToken = `${PREFIX}-invite-token`;
    await db.insert(venueManagerTokensTable).values({
      businessId: business!.id, email: invitedEmail, role: "manager",
      tokenHash: crypto.createHash("sha256").update(rawToken).digest("base64url"),
      purpose: "invite", expiresAt: new Date(Date.now() + 60_000), createdByManagerId: creator!.id,
    });
    const idToken = `${ID_TOKEN}-invite`;
    const wrongEmailToken = `${idToken}-wrong`;
    verifyIdToken.mockImplementation(async (token: string) => {
      if (token === idToken) return { uid: invitedUid, email: invitedEmail, email_verified: true };
      if (token === wrongEmailToken) return { uid: `${invitedUid}-wrong`, email: "wrong@example.com", email_verified: true };
      throw new Error("bad token");
    });
    const payload = {
      token: rawToken, idToken, displayName: "Invited Manager", acceptedTermsVersion: "venue-2026-09",
    };
    const api = request(app);
    expect((await api.post("/api/venue-manager/invitations/accept/firebase")
      .send({ ...payload, idToken: wrongEmailToken })).status).toBe(403);
    expect((await api.post("/api/venue-manager/invitations/accept/firebase").send(payload)).status).toBe(200);
    expect((await api.post("/api/venue-manager/invitations/accept/firebase").send(payload)).status).toBe(400);
    const [manager] = await db.select().from(venueManagersTable)
      .where(eq(venueManagersTable.firebaseUid, invitedUid));
    const [membership] = await db.select().from(venueMembershipsTable).where(and(
      eq(venueMembershipsTable.businessId, business!.id), eq(venueMembershipsTable.managerId, manager!.id),
    ));
    expect(manager?.email).toBe(invitedEmail);
    expect(membership?.status).toBe("active");
    expect(membership?.role).toBe("manager");
  });

  it("claim binds the verified Firebase email and creates no password sign-in", async () => {
    const claimUid = `${UID}-claim`;
    const verifiedEmail = `${PREFIX}-verified-claim@example.com`;
    const placeId = `${PREFIX}-claim-place`;
    const [profile] = await db.insert(venueOwnerProfilesTable).values({
      ownerUid: claimUid,
      placeId,
      placeName: "Claim Venue",
      businessName: "Claim Venue",
      verificationDocUrl: "https://example.com/proof.pdf",
      applicationStatus: "approved",
      isApproved: true,
      isVerified: true,
      approvedAt: new Date(),
    }).returning();
    const [business] = await db.insert(venueBusinessesTable).values({
      venueOwnerProfileId: profile!.id,
      placeId,
      legalName: "Claim Venue",
      createdByUid: claimUid,
    }).returning();
    getUser.mockImplementation(async (uid: string) => {
      if (uid !== claimUid) throw new Error("user not found");
      return { uid, email: verifiedEmail, emailVerified: true };
    });
    const api = request(app);
    const mismatch = await api.post("/api/venue-manager/claim")
      .set("x-test-uid", claimUid)
      .send({
        email: "attacker@example.com", displayName: "Claim Owner", password: LEGACY_PASSWORD,
        acceptedTermsVersion: "venue-2026-09",
      });
    expect(mismatch.status).toBe(403);
    getUser.mockResolvedValueOnce({ uid: claimUid, email: verifiedEmail, emailVerified: false });
    const unverified = await api.post("/api/venue-manager/claim")
      .set("x-test-uid", claimUid)
      .send({
        email: verifiedEmail, displayName: "Claim Owner", password: LEGACY_PASSWORD,
        acceptedTermsVersion: "venue-2026-09",
      });
    expect(unverified.status).toBe(403);
    expect((await db.select().from(venueManagersTable).where(eq(venueManagersTable.firebaseUid, claimUid))).length).toBe(0);

    const noTerms = await api.post("/api/venue-manager/claim")
      .set("x-test-uid", claimUid)
      .send({ email: verifiedEmail, displayName: "Claim Owner", password: LEGACY_PASSWORD });
    expect(noTerms.status).toBe(400);
    expect((await db.select().from(venueManagersTable).where(eq(venueManagersTable.firebaseUid, claimUid))).length).toBe(0);

    const claimed = await api.post("/api/venue-manager/claim")
      .set("x-test-uid", claimUid)
      .send({
        email: verifiedEmail, displayName: "Claim Owner", password: LEGACY_PASSWORD,
        acceptedTermsVersion: "venue-2026-09",
      });
    expect(claimed.status).toBe(200);
    const [manager] = await db.select().from(venueManagersTable).where(eq(venueManagersTable.firebaseUid, claimUid));
    expect(manager?.email).toBe(verifiedEmail);
    expect(manager?.legalVersion).toBe("venue-2026-09");
    expect(manager?.legalAcceptedAt).toBeInstanceOf(Date);
    expect((await api.post("/api/venue-manager/session")
      .send({ email: verifiedEmail, password: LEGACY_PASSWORD })).status).toBe(409);
    expect((await api.post(`/api/venue-manager/register`)
      .send({ token: "unused", email: verifiedEmail, password: LEGACY_PASSWORD })).status).toBe(410);
    expect((await api.post("/api/venue-manager/invitations/accept")
      .send({ token: "unused", email: verifiedEmail, password: LEGACY_PASSWORD })).status).toBe(410);
    await db.update(venueManagersTable).set({ legalVersion: "older-version", legalAcceptedAt: new Date(0) })
      .where(eq(venueManagersTable.id, manager!.id));
    const termsMissingForExisting = await api.post("/api/venue-manager/claim")
      .set("x-test-uid", claimUid)
      .send({ email: verifiedEmail, displayName: "Claim Owner", password: LEGACY_PASSWORD });
    expect(termsMissingForExisting.status).toBe(400);
    const [unchangedConsent] = await db.select().from(venueManagersTable)
      .where(eq(venueManagersTable.id, manager!.id));
    expect(unchangedConsent?.legalVersion).toBe("older-version");
    const renewedConsent = await api.post("/api/venue-manager/claim")
      .set("x-test-uid", claimUid)
      .send({
        email: verifiedEmail, displayName: "Claim Owner", password: LEGACY_PASSWORD,
        acceptedTermsVersion: "venue-2026-09",
      });
    expect(renewedConsent.status).toBe(200);
    const [updatedConsent] = await db.select().from(venueManagersTable)
      .where(eq(venueManagersTable.id, manager!.id));
    expect(updatedConsent?.legalVersion).toBe("venue-2026-09");
    expect(updatedConsent?.legalAcceptedAt?.getTime()).toBeGreaterThan(0);
    expect(business).toBeTruthy();
  });

  it("never revives revoked owner memberships during claim", async () => {
    const claimUid = `${UID}-revoked`;
    const claimEmail = `${PREFIX}-revoked@example.com`;
    const placeId = `${PREFIX}-revoked-place`;
    const [manager] = await db.insert(venueManagersTable).values({
      email: claimEmail,
      firebaseUid: claimUid,
      displayName: "Previously Revoked",
      passwordHash: legacyPasswordHash(LEGACY_PASSWORD),
    }).returning();
    const [profile] = await db.insert(venueOwnerProfilesTable).values({
      ownerUid: claimUid,
      placeId,
      placeName: "Revoked Venue",
      businessName: "Revoked Venue",
      verificationDocUrl: "https://example.com/proof.pdf",
      applicationStatus: "approved",
      isApproved: true,
      isVerified: true,
      approvedAt: new Date(),
    }).returning();
    const [business] = await db.insert(venueBusinessesTable).values({
      venueOwnerProfileId: profile!.id, placeId, legalName: "Revoked Venue", createdByUid: claimUid,
    }).returning();
    const [membership] = await db.insert(venueMembershipsTable).values({
      businessId: business!.id, managerId: manager!.id, uid: claimUid,
      role: "owner", status: "revoked", revokedAt: new Date(),
    }).returning();
    getUser.mockResolvedValue({ uid: claimUid, email: claimEmail, emailVerified: true });
    const result = await request(app).post("/api/venue-manager/claim")
      .set("x-test-uid", claimUid)
      .send({
        email: claimEmail, displayName: "Previously Revoked", acceptedTermsVersion: "venue-2026-09",
      });
    expect(result.status).toBe(403);
    const [stillRevoked] = await db.select().from(venueMembershipsTable)
      .where(eq(venueMembershipsTable.id, membership!.id));
    expect(stillRevoked?.status).toBe("revoked");
  });

  it("rejects claim when a different manager owns the venue", async () => {
    const claimUid = `${UID}-owner-collision`;
    const claimEmail = `${PREFIX}-collision-claim@example.com`;
    const placeId = `${PREFIX}-active-owner-collision-place`;
    const [currentOwner] = await db.insert(venueManagersTable).values({
      email: `${PREFIX}-current-owner@example.com`,
      firebaseUid: `${claimUid}-current-owner`,
      displayName: "Current Owner",
      passwordHash: legacyPasswordHash(LEGACY_PASSWORD),
    }).returning();
    const [profile] = await db.insert(venueOwnerProfilesTable).values({
      ownerUid: claimUid,
      placeId,
      placeName: "Active Owner Venue",
      businessName: "Active Owner Venue",
      verificationDocUrl: "https://example.com/proof.pdf",
      applicationStatus: "approved",
      isApproved: true,
      isVerified: true,
      approvedAt: new Date(),
    }).returning();
    const [business] = await db.insert(venueBusinessesTable).values({
      venueOwnerProfileId: profile!.id, placeId, legalName: "Active Owner Venue", createdByUid: claimUid,
    }).returning();
    await db.insert(venueMembershipsTable).values({
      businessId: business!.id, managerId: currentOwner!.id, uid: `${claimUid}-current-owner`,
      role: "owner", status: "active", acceptedAt: new Date(),
    });
    getUser.mockResolvedValue({ uid: claimUid, email: claimEmail, emailVerified: true });
    const result = await request(app).post("/api/venue-manager/claim")
      .set("x-test-uid", claimUid)
      .send({
        email: claimEmail, displayName: "Imposter", acceptedTermsVersion: "venue-2026-09",
      });
    expect(result.status).toBe(409);
    expect((await db.select().from(venueManagersTable)
      .where(eq(venueManagersTable.firebaseUid, claimUid))).length).toBe(0);
  });
});