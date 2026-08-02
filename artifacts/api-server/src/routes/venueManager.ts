import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import crypto from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import {
  db,
  venueBusinessesTable,
  venueManagerSessionsTable,
  venueManagersTable,
  venueManagerTokensTable,
  venueMembershipAuditTable,
  venueMembershipsTable,
  venueOwnerProfilesTable,
  type VenueMembershipRole,
} from "@workspace/db";
import { createIpRateLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();
const COOKIE = "met_venue_manager";
const CSRF_HEADER = "x-csrf-token";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RECOVERY_TTL_MS = 30 * 60 * 1000;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000;
const roles = ["owner", "manager", "editor"] as const;
type Role = (typeof roles)[number];

const authLimit = createIpRateLimiter({
  windowMs: 15 * 60_000,
  max: 10,
  name: "venue-manager-auth",
});

function passwordIsStrong(password: string): boolean {
  return password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashOpaque(value: string): string {
  return crypto.createHash("sha256").update(value).digest("base64url");
}

function randomToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function deriveScryptKey(password: string, salt: string, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keyLength, { N: 16_384, r: 8, p: 1 }, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = await deriveScryptKey(password, salt, 64);
  return `scrypt$${salt}$${hash.toString("base64url")}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, salt, encodedHash] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !encodedHash) return false;
  const expected = Buffer.from(encodedHash, "base64url");
  const derived = await deriveScryptKey(password, salt, expected.length);
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

function cookieOptions(req: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: req.secure || process.env["NODE_ENV"] === "production",
    signed: true,
    maxAge: SESSION_TTL_MS,
    path: "/api/venue-manager",
  };
}

type ManagerSession = {
  sessionId: number;
  managerId: number;
  csrfToken: string;
  expiresAt: Date;
};

async function getSession(req: Request): Promise<ManagerSession | null> {
  const token = req.signedCookies?.[COOKIE];
  if (typeof token !== "string") return null;
  const [session] = await db
    .select()
    .from(venueManagerSessionsTable)
    .where(and(
      eq(venueManagerSessionsTable.tokenHash, hashOpaque(token)),
      isNull(venueManagerSessionsTable.revokedAt),
      gt(venueManagerSessionsTable.expiresAt, new Date()),
    ))
    .limit(1);
  if (!session) return null;
  const manager = await db.select({ id: venueManagersTable.id })
    .from(venueManagersTable).where(eq(venueManagersTable.id, session.managerId)).limit(1);
  if (!manager[0]) return null;
  return {
    sessionId: session.id,
    managerId: session.managerId,
    csrfToken: session.csrfTokenHash,
    expiresAt: session.expiresAt,
  };
}

async function requireSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await getSession(req);
  if (!session) {
    res.status(401).json({ message: "Your venue manager session has expired. Sign in again." });
    return;
  }
  req.venueManagerSession = session;
  next();
}

function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const submitted = req.header(CSRF_HEADER);
  const session = req.venueManagerSession;
  if (!session || !submitted || !crypto.timingSafeEqual(Buffer.from(hashOpaque(submitted)), Buffer.from(session.csrfToken))) {
    res.status(403).json({ message: "Your security token is missing or invalid. Refresh and try again." });
    return;
  }
  next();
}

declare global {
  namespace Express {
    interface Request {
      venueManagerSession?: ManagerSession;
    }
  }
}

async function issueSession(req: Request, res: Response, managerId: number): Promise<void> {
  const rawToken = randomToken();
  const csrfToken = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const [session] = await db.insert(venueManagerSessionsTable).values({
    managerId,
    tokenHash: hashOpaque(rawToken),
    csrfTokenHash: hashOpaque(csrfToken),
    expiresAt,
  }).returning();
  if (!session) throw new Error("Unable to create venue manager session");
  res.cookie(COOKIE, rawToken, cookieOptions(req));
  res.json({ authenticated: true, csrfToken, expiresAt: expiresAt.toISOString() });
}

async function activeMembership(managerId: number, businessId: number, permitted: readonly Role[]): Promise<{
  id: number; businessId: number; role: Role; status: string;
} | null> {
  const [membership] = await db.select().from(venueMembershipsTable).where(and(
    eq(venueMembershipsTable.managerId, managerId),
    eq(venueMembershipsTable.businessId, businessId),
    eq(venueMembershipsTable.status, "active"),
  )).limit(1);
  if (!membership || !permitted.includes(membership.role)) return null;
  const [business] = await db.select({ id: venueBusinessesTable.id, isActive: venueBusinessesTable.isActive })
    .from(venueBusinessesTable).where(eq(venueBusinessesTable.id, businessId)).limit(1);
  return business?.isActive ? membership as { id: number; businessId: number; role: Role; status: string } : null;
}

async function requireBusinessRole(req: Request, res: Response, permitted: readonly Role[]): Promise<{
  id: number; businessId: number; role: Role; status: string;
} | null> {
  const businessId = Number(req.params["businessId"]);
  if (!Number.isInteger(businessId) || businessId < 1) {
    res.status(400).json({ message: "Invalid business id" });
    return null;
  }
  const membership = await activeMembership(req.venueManagerSession!.managerId, businessId, permitted);
  if (!membership) {
    res.status(403).json({ message: "You are not authorized to manage this venue." });
    return null;
  }
  return membership;
}

router.post("/venue-manager/session", authLimit, async (req, res): Promise<void> => {
  const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) {
    res.status(400).json({ message: "Email and password are required." });
    return;
  }
  const [manager] = await db.select().from(venueManagersTable).where(eq(venueManagersTable.email, email)).limit(1);
  if (!manager || (manager.lockedUntil && manager.lockedUntil > new Date())) {
    if (manager?.lockedUntil) res.set("Retry-After", String(Math.ceil((manager.lockedUntil.getTime() - Date.now()) / 1000)));
    res.status(manager?.lockedUntil ? 429 : 401).json({ message: manager?.lockedUntil ? "This account is temporarily locked." : "Invalid email or password." });
    return;
  }
  if (!(await verifyPassword(password, manager.passwordHash))) {
    const attempts = manager.failedLoginAttempts + 1;
    await db.update(venueManagersTable).set({
      failedLoginAttempts: attempts,
      lockedUntil: attempts >= MAX_FAILED_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
      updatedAt: new Date(),
    }).where(eq(venueManagersTable.id, manager.id));
    res.status(401).json({ message: "Invalid email or password." });
    return;
  }
  await db.update(venueManagersTable).set({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(venueManagersTable.id, manager.id));
  await issueSession(req, res, manager.id);
});

// The CSRF token is never stored client-readable server-side (only its hash),
// so a page reload cannot recover it. Rotate and return a fresh token here so
// a valid cookie session can always bootstrap mutations without re-login.
router.get("/venue-manager/session", requireSession, async (req, res): Promise<void> => {
  const csrfToken = randomToken();
  await db.update(venueManagerSessionsTable)
    .set({ csrfTokenHash: hashOpaque(csrfToken) })
    .where(eq(venueManagerSessionsTable.id, req.venueManagerSession!.sessionId));
  res.json({ authenticated: true, csrfToken, expiresAt: req.venueManagerSession!.expiresAt.toISOString() });
});

router.delete("/venue-manager/session", requireSession, requireCsrf, async (req, res) => {
  await db.update(venueManagerSessionsTable).set({ revokedAt: new Date() })
    .where(eq(venueManagerSessionsTable.id, req.venueManagerSession!.sessionId));
  res.clearCookie(COOKIE, cookieOptions(req));
  res.status(204).end();
});

router.post("/venue-manager/invitations/accept", authLimit, async (req, res): Promise<void> => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim().slice(0, 120) : "";
  if (!token || !passwordIsStrong(password) || !displayName) {
    res.status(400).json({ message: "Use a valid invitation, name, and strong password." });
    return;
  }
  const [invite] = await db.select().from(venueManagerTokensTable).where(and(
    eq(venueManagerTokensTable.tokenHash, hashOpaque(token)),
    eq(venueManagerTokensTable.purpose, "invite"),
    isNull(venueManagerTokensTable.consumedAt),
    gt(venueManagerTokensTable.expiresAt, new Date()),
  )).limit(1);
  if (!invite) {
    res.status(400).json({ message: "This invitation is invalid or has expired." });
    return;
  }
  const [existing] = await db.select().from(venueManagersTable).where(eq(venueManagersTable.email, invite.email)).limit(1);
  if (existing) {
    res.status(409).json({ message: "This email already has a venue manager account." });
    return;
  }
  const [manager] = await db.insert(venueManagersTable).values({
    email: invite.email, displayName, passwordHash: await hashPassword(password),
  }).returning();
  if (!manager) throw new Error("Unable to create manager");
  await db.transaction(async (tx) => {
    await tx.insert(venueMembershipsTable).values({
      businessId: invite.businessId, managerId: manager.id, role: invite.role, status: "active", acceptedAt: new Date(),
    });
    await tx.update(venueManagerTokensTable).set({ consumedAt: new Date(), managerId: manager.id })
      .where(eq(venueManagerTokensTable.id, invite.id));
    await tx.insert(venueMembershipAuditTable).values({
      businessId: invite.businessId, eventType: "granted", subjectUid: invite.email,
      toRole: invite.role, toStatus: "active", metadata: JSON.stringify({ managerId: manager.id }),
    });
  });
  await issueSession(req, res, manager.id);
});

router.post("/venue-manager/password/recover", authLimit, async (req, res): Promise<void> => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const password = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  if (!token || !passwordIsStrong(password)) {
    res.status(400).json({ message: "Use a valid recovery link and strong password." });
    return;
  }
  const [recovery] = await db.select().from(venueManagerTokensTable).where(and(
    eq(venueManagerTokensTable.tokenHash, hashOpaque(token)), eq(venueManagerTokensTable.purpose, "recovery"),
    isNull(venueManagerTokensTable.consumedAt), gt(venueManagerTokensTable.expiresAt, new Date()),
  )).limit(1);
  if (!recovery?.managerId) {
    res.status(400).json({ message: "This recovery link is invalid or has expired." });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.update(venueManagersTable).set({
      passwordHash: await hashPassword(password), sessionVersion: 2, failedLoginAttempts: 0, lockedUntil: null,
      passwordChangedAt: new Date(), updatedAt: new Date(),
    }).where(eq(venueManagersTable.id, recovery.managerId!));
    await tx.update(venueManagerSessionsTable).set({ revokedAt: new Date() })
      .where(eq(venueManagerSessionsTable.managerId, recovery.managerId!));
    await tx.update(venueManagerTokensTable).set({ consumedAt: new Date() }).where(eq(venueManagerTokensTable.id, recovery.id));
  });
  res.status(204).end();
});

router.post("/venue-manager/password", requireSession, requireCsrf, async (req, res): Promise<void> => {
  const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  if (!passwordIsStrong(newPassword)) {
    res.status(400).json({ message: "Use a password with at least 12 characters, uppercase, lowercase, and a number." });
    return;
  }
  const [manager] = await db.select().from(venueManagersTable).where(eq(venueManagersTable.id, req.venueManagerSession!.managerId)).limit(1);
  if (!manager) {
    res.status(401).json({ message: "Your session has expired." });
    return;
  }
  if (!(await verifyPassword(currentPassword, manager.passwordHash))) {
    res.status(401).json({ message: "Current password is incorrect." });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.update(venueManagersTable).set({ passwordHash: await hashPassword(newPassword), sessionVersion: manager.sessionVersion + 1, passwordChangedAt: new Date(), updatedAt: new Date() }).where(eq(venueManagersTable.id, manager.id));
    await tx.update(venueManagerSessionsTable).set({ revokedAt: new Date() }).where(eq(venueManagerSessionsTable.managerId, manager.id));
  });
  await issueSession(req, res, manager.id);
});

router.post("/venue-manager/businesses/:businessId/invitations", requireSession, requireCsrf, async (req, res): Promise<void> => {
  const membership = await requireBusinessRole(req, res, ["owner"]);
  if (!membership) return;
  const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
  const role = req.body?.role as Role;
  if (!email || !roles.includes(role) || role === "owner") {
    res.status(400).json({ message: "Use an email and a manager or editor role." });
    return;
  }
  const token = randomToken();
  await db.insert(venueManagerTokensTable).values({
    businessId: membership.businessId, email, role, tokenHash: hashOpaque(token), purpose: "invite",
    expiresAt: new Date(Date.now() + INVITATION_TTL_MS), createdByManagerId: req.venueManagerSession!.managerId,
  });
  // Delivery belongs to the portal launch; return the one-time URL only to the owner for secure delivery.
  res.status(201).json({ invitationToken: token, expiresAt: new Date(Date.now() + INVITATION_TTL_MS).toISOString() });
});

router.post("/venue-manager/businesses/:businessId/recovery", requireSession, requireCsrf, async (req, res): Promise<void> => {
  const membership = await requireBusinessRole(req, res, ["owner"]);
  if (!membership) return;
  const managerId = Number(req.body?.managerId);
  const target = await activeMembership(managerId, membership.businessId, roles);
  if (!target) {
    res.status(404).json({ message: "Manager not found for this venue." });
    return;
  }
  const [manager] = await db.select().from(venueManagersTable).where(eq(venueManagersTable.id, managerId)).limit(1);
  if (!manager) {
    res.status(404).json({ message: "Manager not found." });
    return;
  }
  const token = randomToken();
  await db.insert(venueManagerTokensTable).values({
    managerId, businessId: membership.businessId, email: manager.email, role: target.role,
    tokenHash: hashOpaque(token), purpose: "recovery", expiresAt: new Date(Date.now() + RECOVERY_TTL_MS),
    createdByManagerId: req.venueManagerSession!.managerId,
  });
  res.status(201).json({ recoveryToken: token, expiresAt: new Date(Date.now() + RECOVERY_TTL_MS).toISOString() });
});

router.patch("/venue-manager/businesses/:businessId/memberships/:managerId", requireSession, requireCsrf, async (req, res): Promise<void> => {
  const actor = await requireBusinessRole(req, res, ["owner"]);
  if (!actor) return;
  const managerId = Number(req.params["managerId"]);
  const role = req.body?.role as Role;
  if (!Number.isInteger(managerId) || !roles.includes(role) || role === "owner") {
    res.status(400).json({ message: "Only manager and editor roles can be assigned." });
    return;
  }
  const target = await activeMembership(managerId, actor.businessId, roles);
  if (!target) {
    res.status(404).json({ message: "Manager not found for this venue." });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.update(venueMembershipsTable).set({ role, updatedAt: new Date() }).where(eq(venueMembershipsTable.id, target.id));
    await tx.insert(venueMembershipAuditTable).values({ businessId: actor.businessId, membershipId: target.id, eventType: "role_changed", subjectUid: String(managerId), fromRole: target.role, toRole: role, actorUid: null, metadata: JSON.stringify({ actorManagerId: req.venueManagerSession!.managerId }) });
  });
  res.status(204).end();
});

router.delete("/venue-manager/businesses/:businessId/memberships/:managerId", requireSession, requireCsrf, async (req, res): Promise<void> => {
  const actor = await requireBusinessRole(req, res, ["owner"]);
  if (!actor) return;
  const managerId = Number(req.params["managerId"]);
  const target = await activeMembership(managerId, actor.businessId, ["manager", "editor"]);
  if (!target) {
    res.status(404).json({ message: "Manager not found for this venue." });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.update(venueMembershipsTable).set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() }).where(eq(venueMembershipsTable.id, target.id));
    await tx.update(venueManagerSessionsTable).set({ revokedAt: new Date() }).where(eq(venueManagerSessionsTable.managerId, managerId));
    await tx.insert(venueMembershipAuditTable).values({ businessId: actor.businessId, membershipId: target.id, eventType: "revoked", subjectUid: String(managerId), fromRole: target.role, fromStatus: "active", toStatus: "revoked", metadata: JSON.stringify({ actorManagerId: req.venueManagerSession!.managerId }) });
  });
  res.status(204).end();
});

/**
 * Legacy approved owners authenticate with Firebase just once to claim their
 * business-only account. The consumer account remains intact and is never
 * mixed into the manager credential.
 */
export function createVenueManagerClaimRouter(requireUid: (req: Request, res: Response, next: NextFunction) => void): IRouter {
  const claimRouter: IRouter = Router();
  claimRouter.post("/venue-manager/claim", requireUid, async (req, res): Promise<void> => {
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
    const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim().slice(0, 120) : "";
    if (!email || !displayName || !passwordIsStrong(password)) {
      res.status(400).json({ message: "Use an email, name, and strong password." });
      return;
    }
    const [profile] = await db.select().from(venueOwnerProfilesTable).where(and(eq(venueOwnerProfilesTable.ownerUid, req.uid!), eq(venueOwnerProfilesTable.isApproved, true), eq(venueOwnerProfilesTable.applicationStatus, "approved"))).limit(1);
    if (!profile) {
      res.status(403).json({ message: "Only the current approved venue owner can claim this business." });
      return;
    }
    const [business] = await db.select().from(venueBusinessesTable).where(eq(venueBusinessesTable.venueOwnerProfileId, profile.id)).limit(1);
    if (!business) {
      res.status(409).json({ message: "This venue is still being prepared. Try again shortly." });
      return;
    }
    const [exists] = await db.select({ id: venueManagersTable.id }).from(venueManagersTable).where(eq(venueManagersTable.email, email)).limit(1);
    if (exists) {
      res.status(409).json({ message: "This email already has a venue manager account." });
      return;
    }
    const [manager] = await db.insert(venueManagersTable).values({ email, displayName, passwordHash: await hashPassword(password) }).returning();
    if (!manager) throw new Error("Unable to create manager");
    await db.transaction(async (tx) => {
      await tx.insert(venueMembershipsTable).values({ businessId: business.id, managerId: manager.id, role: "owner", status: "active", acceptedAt: new Date() });
      await tx.insert(venueMembershipAuditTable).values({ businessId: business.id, eventType: "granted", subjectUid: email, toRole: "owner", toStatus: "active", metadata: JSON.stringify({ source: "legacy_owner_claim", legacyUid: req.uid }) });
    });
    await issueSession(req, res, manager.id);
  });
  return claimRouter;
}

export default router;