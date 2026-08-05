import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import crypto from "node:crypto";
import { and, count, desc, eq, gte, gt, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage";
import {
  db,
  venueApplicationHistoryTable,
  venueBusinessesTable,
  venueManagerRegistrationTokensTable,
  venueManagerSessionsTable,
  venueManagersTable,
  venueManagerTokensTable,
  venueMembershipAuditTable,
  venueMembershipsTable,
  venueOwnerProfilesTable,
  venueEventsTable,
  venueEventRsvpsTable,
  venueRewardsTable,
  venueAnnouncementsTable,
  hubCheckinsTable,
  profilesTable,
  venueQrVerificationsTable,
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
const contentRoles: readonly Role[] = ["owner", "manager", "editor"];
const rewardRoles: readonly Role[] = ["owner", "manager"];

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

function serializeEvent(event: typeof venueEventsTable.$inferSelect) {
  const { ownerUid: _ownerUid, ...serialized } = event;
  return serialized;
}

function serializeReward(reward: typeof venueRewardsTable.$inferSelect) {
  const { ownerUid: _ownerUid, winnerUid: _winnerUid, ...serialized } = reward;
  return serialized;
}

function serializeAnnouncement(announcement: typeof venueAnnouncementsTable.$inferSelect) {
  const { ownerUid: _ownerUid, ...serialized } = announcement;
  return serialized;
}

function validDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, max) || null;
}

async function businessWithProfile(businessId: number) {
  const [row] = await db.select({
    business: venueBusinessesTable,
    profile: venueOwnerProfilesTable,
  }).from(venueBusinessesTable)
    .innerJoin(venueOwnerProfilesTable, eq(venueBusinessesTable.venueOwnerProfileId, venueOwnerProfilesTable.id))
    .where(eq(venueBusinessesTable.id, businessId))
    .limit(1);
  return row ?? null;
}

function serializeBusiness(row: NonNullable<Awaited<ReturnType<typeof businessWithProfile>>>, role: Role) {
  return {
    businessId: row.business.id,
    placeId: row.business.placeId,
    legalName: row.business.legalName,
    placeName: row.profile.placeName,
    businessName: row.profile.businessName,
    tagline: row.profile.tagline,
    description: row.profile.description,
    coverPhotoUrl: row.profile.coverPhotoUrl,
    logoUrl: row.profile.logoUrl,
    phone: row.profile.phone,
    websiteUrl: row.profile.websiteUrl,
    publicEmail: row.profile.publicEmail,
    openingHours: row.profile.openingHours,
    role,
    isActive: row.business.isActive,
  };
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

router.get("/venue-manager/businesses", requireSession, async (req, res): Promise<void> => {
  const rows = await db.select({
    membership: venueMembershipsTable,
    business: venueBusinessesTable,
    profile: venueOwnerProfilesTable,
  }).from(venueMembershipsTable)
    .innerJoin(venueBusinessesTable, eq(venueMembershipsTable.businessId, venueBusinessesTable.id))
    .innerJoin(venueOwnerProfilesTable, eq(venueBusinessesTable.venueOwnerProfileId, venueOwnerProfilesTable.id))
    .where(and(
      eq(venueMembershipsTable.managerId, req.venueManagerSession!.managerId),
      eq(venueMembershipsTable.status, "active"),
      eq(venueBusinessesTable.isActive, true),
    ))
    .orderBy(venueOwnerProfilesTable.placeName);
  res.json({ businesses: rows.map((row) => serializeBusiness({ business: row.business, profile: row.profile }, row.membership.role as Role)) });
});

router.get("/venue-manager/businesses/:businessId", requireSession, async (req, res): Promise<void> => {
  const membership = await requireBusinessRole(req, res, roles);
  if (!membership) return;
  const row = await businessWithProfile(membership.businessId);
  if (!row) {
    res.status(404).json({ message: "Venue not found." });
    return;
  }
  res.json(serializeBusiness(row, membership.role));
});

router.patch("/venue-manager/businesses/:businessId", requireSession, requireCsrf, async (req, res): Promise<void> => {
  const membership = await requireBusinessRole(req, res, ["owner", "manager"]);
  if (!membership) return;
  const current = await businessWithProfile(membership.businessId);
  if (!current) {
    res.status(404).json({ message: "Venue not found." });
    return;
  }
  const businessName = optionalText(req.body?.businessName, 255);
  const tagline = optionalText(req.body?.tagline, 160);
  const description = optionalText(req.body?.description, 1000);
  const coverPhotoUrl = optionalText(req.body?.coverPhotoUrl, 2000);
  const logoUrl = optionalText(req.body?.logoUrl, 2000);
  const phone = optionalText(req.body?.phone, 60);
  const websiteUrl = optionalText(req.body?.websiteUrl, 2000);
  if (websiteUrl) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(websiteUrl);
    } catch {
      res.status(400).json({ message: "Website URL is not valid. Make sure it starts with https:// or http://." });
      return;
    }
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      res.status(400).json({ message: "Website URL must start with https:// or http://." });
      return;
    }
  }
  const publicEmail = optionalText(req.body?.publicEmail, 320);
  let openingHours: Record<string, { open: string; close: string } | null> | undefined;
  if (req.body?.openingHours !== undefined) {
    if (req.body.openingHours === null) {
      openingHours = undefined; // ignore explicit null — use existing value
    } else if (typeof req.body.openingHours !== "object" || Array.isArray(req.body.openingHours)) {
      res.status(400).json({ message: "openingHours must be an object." });
      return;
    } else {
      const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
      const validated: Record<string, { open: string; close: string } | null> = {};
      const TIME_RE = /^\d{2}:\d{2}$/;
      for (const day of days) {
        const v = (req.body.openingHours as Record<string, unknown>)[day];
        if (v === undefined) continue;
        if (v === null) { validated[day] = null; continue; }
        if (typeof v !== "object" || Array.isArray(v)) {
          res.status(400).json({ message: `openingHours.${day} must be an object with open/close or null.` });
          return;
        }
        const { open, close } = v as Record<string, unknown>;
        if (typeof open !== "string" || typeof close !== "string" || !TIME_RE.test(open) || !TIME_RE.test(close)) {
          res.status(400).json({ message: `openingHours.${day}.open and .close must be HH:MM strings (e.g. "09:00").` });
          return;
        }
        validated[day] = { open, close };
      }
      openingHours = validated;
    }
  }
  const patch = Object.fromEntries(Object.entries({ businessName, tagline, description, coverPhotoUrl, logoUrl, phone, websiteUrl, publicEmail, openingHours })
    .filter(([, value]) => value !== undefined));
  if (!Object.keys(patch).length) {
    res.status(400).json({ message: "Provide at least one business detail to update." });
    return;
  }
  const [profile] = await db.update(venueOwnerProfilesTable).set({ ...patch, updatedAt: new Date() })
    .where(eq(venueOwnerProfilesTable.id, current.profile.id)).returning();
  res.json(serializeBusiness({ business: current.business, profile: profile! }, membership.role));
});

router.get("/venue-manager/businesses/:businessId/events", requireSession, async (req, res): Promise<void> => {
  const membership = await requireBusinessRole(req, res, roles);
  if (!membership) return;
  const business = await businessWithProfile(membership.businessId);
  if (!business) return void res.status(404).json({ message: "Venue not found." });
  const events = await db.select().from(venueEventsTable)
    .where(eq(venueEventsTable.placeId, business.business.placeId))
    .orderBy(desc(venueEventsTable.startsAt));
  res.json({ events: events.map(serializeEvent) });
});

router.post("/venue-manager/businesses/:businessId/events", requireSession, requireCsrf, async (req, res): Promise<void> => {
  const membership = await requireBusinessRole(req, res, contentRoles);
  if (!membership) return;
  const business = await businessWithProfile(membership.businessId);
  const title = optionalText(req.body?.title, 120);
  const startsAt = validDate(req.body?.startsAt);
  if (!business || !title || !startsAt) return void res.status(400).json({ message: "An event title and start time are required." });
  const endsAt = req.body?.endsAt === null ? null : validDate(req.body?.endsAt);
  if (req.body?.endsAt !== undefined && req.body?.endsAt !== null && !endsAt) return void res.status(400).json({ message: "Use a valid event end time." });
  const capacityLimit = req.body?.capacityLimit === undefined ? undefined : req.body?.capacityLimit === null ? null : Number(req.body?.capacityLimit);
  if (capacityLimit !== undefined && capacityLimit !== null && (!Number.isInteger(capacityLimit) || capacityLimit < 1)) return void res.status(400).json({ message: "Capacity must be a positive whole number." });
  const [event] = await db.insert(venueEventsTable).values({
    ownerUid: business.profile.ownerUid, placeId: business.business.placeId, title, startsAt, endsAt,
    description: optionalText(req.body?.description, 2000) ?? null, imageUrl: optionalText(req.body?.imageUrl, 2000) ?? null,
    capacityLimit, isPublished: req.body?.isPublished !== false,
  }).returning();
  res.status(201).json({ event: serializeEvent(event!) });
});

router.patch("/venue-manager/businesses/:businessId/events/:eventId", requireSession, requireCsrf, async (req, res): Promise<void> => {
  const membership = await requireBusinessRole(req, res, contentRoles);
  if (!membership) return;
  const business = await businessWithProfile(membership.businessId);
  const eventId = Number(req.params["eventId"]);
  if (!business || !Number.isInteger(eventId)) return void res.status(400).json({ message: "Invalid event." });
  const [existing] = await db.select().from(venueEventsTable).where(and(eq(venueEventsTable.id, eventId), eq(venueEventsTable.placeId, business.business.placeId))).limit(1);
  if (!existing) return void res.status(404).json({ message: "Event not found." });
  const title = optionalText(req.body?.title, 120);
  const startsAt = req.body?.startsAt === undefined ? undefined : validDate(req.body.startsAt);
  const endsAt = req.body?.endsAt === undefined ? undefined : req.body.endsAt === null ? null : validDate(req.body.endsAt);
  if ((req.body?.startsAt !== undefined && !startsAt) || (req.body?.endsAt !== undefined && req.body.endsAt !== null && !endsAt)) return void res.status(400).json({ message: "Use valid event dates." });
  const capacityLimit = req.body?.capacityLimit === undefined ? undefined : req.body.capacityLimit === null ? null : Number(req.body.capacityLimit);
  if (capacityLimit !== undefined && capacityLimit !== null && (!Number.isInteger(capacityLimit) || capacityLimit < 1)) return void res.status(400).json({ message: "Capacity must be a positive whole number." });
  const patch = Object.fromEntries(Object.entries({ title, startsAt, endsAt, capacityLimit, description: optionalText(req.body?.description, 2000), imageUrl: optionalText(req.body?.imageUrl, 2000), isPublished: typeof req.body?.isPublished === "boolean" ? req.body.isPublished : undefined }).filter(([, value]) => value !== undefined));
  const [event] = await db.update(venueEventsTable).set({ ...patch, updatedAt: new Date() }).where(eq(venueEventsTable.id, eventId)).returning();
  res.json({ event: serializeEvent(event!) });
});

router.delete("/venue-manager/businesses/:businessId/events/:eventId", requireSession, requireCsrf, async (req, res): Promise<void> => {
  const membership = await requireBusinessRole(req, res, contentRoles);
  if (!membership) return;
  const business = await businessWithProfile(membership.businessId);
  const eventId = Number(req.params["eventId"]);
  if (!business || !Number.isInteger(eventId)) return void res.status(400).json({ message: "Invalid event." });
  const deleted = await db.delete(venueEventsTable).where(and(eq(venueEventsTable.id, eventId), eq(venueEventsTable.placeId, business.business.placeId))).returning({ id: venueEventsTable.id });
  if (!deleted.length) return void res.status(404).json({ message: "Event not found." });
  res.status(204).end();
});

router.get("/venue-manager/businesses/:businessId/rewards", requireSession, async (req, res): Promise<void> => {
  const membership = await requireBusinessRole(req, res, roles);
  if (!membership) return;
  const business = await businessWithProfile(membership.businessId);
  if (!business) return void res.status(404).json({ message: "Venue not found." });
  const rewards = await db.select().from(venueRewardsTable)
    .where(eq(venueRewardsTable.placeId, business.business.placeId))
    .orderBy(desc(venueRewardsTable.createdAt));
  res.json({ rewards: rewards.map(serializeReward) });
});

router.post("/venue-manager/businesses/:businessId/rewards", requireSession, requireCsrf, async (req, res): Promise<void> => {
  const membership = await requireBusinessRole(req, res, rewardRoles);
  if (!membership) return;
  const business = await businessWithProfile(membership.businessId);
  const title = optionalText(req.body?.title, 120);
  const prizeDescription = optionalText(req.body?.prizeDescription, 200);
  const startDate = validDate(req.body?.startDate);
  const endDate = validDate(req.body?.endDate);
  if (!business || !title || !prizeDescription || !startDate || !endDate || endDate <= startDate) return void res.status(400).json({ message: "Use a title, prize, and valid reward dates." });
  const rewardType = ["free_drink", "discount", "experience", "custom"].includes(req.body?.rewardType) ? req.body.rewardType : "custom";
  const status = req.body?.status === "active" ? "active" : "draft";
  const [reward] = await db.insert(venueRewardsTable).values({
    ownerUid: business.profile.ownerUid, placeId: business.business.placeId, title, prizeDescription, startDate, endDate,
    description: optionalText(req.body?.description, 2000) ?? null, rewardType, status,
    venueTimezone: optionalText(req.body?.venueTimezone, 100) ?? "UTC",
  }).returning();
  res.status(201).json({ reward: serializeReward(reward!) });
});

router.patch("/venue-manager/businesses/:businessId/rewards/:rewardId", requireSession, requireCsrf, async (req, res): Promise<void> => {
  const membership = await requireBusinessRole(req, res, rewardRoles);
  if (!membership) return;
  const business = await businessWithProfile(membership.businessId);
  const rewardId = Number(req.params["rewardId"]);
  if (!business || !Number.isInteger(rewardId)) return void res.status(400).json({ message: "Invalid reward." });
  const [existing] = await db.select().from(venueRewardsTable).where(and(eq(venueRewardsTable.id, rewardId), eq(venueRewardsTable.placeId, business.business.placeId))).limit(1);
  if (!existing) return void res.status(404).json({ message: "Reward not found." });
  const startDate = req.body?.startDate === undefined ? undefined : validDate(req.body.startDate);
  const endDate = req.body?.endDate === undefined ? undefined : validDate(req.body.endDate);
  if ((req.body?.startDate !== undefined && !startDate) || (req.body?.endDate !== undefined && !endDate)) return void res.status(400).json({ message: "Use valid reward dates." });
  const candidateStart = startDate ?? existing.startDate;
  const candidateEnd = endDate ?? existing.endDate;
  if (candidateEnd <= candidateStart) return void res.status(400).json({ message: "Reward must end after it starts." });
  const rewardType = req.body?.rewardType === undefined ? undefined : ["free_drink", "discount", "experience", "custom"].includes(req.body.rewardType) ? req.body.rewardType : null;
  const status = req.body?.status === undefined ? undefined : ["draft", "active", "cancelled"].includes(req.body.status) ? req.body.status : null;
  if (rewardType === null || status === null) return void res.status(400).json({ message: "Invalid reward type or status." });
  const patch = Object.fromEntries(Object.entries({
    title: optionalText(req.body?.title, 120), description: optionalText(req.body?.description, 2000),
    prizeDescription: optionalText(req.body?.prizeDescription, 200), startDate, endDate, rewardType, status,
    venueTimezone: optionalText(req.body?.venueTimezone, 100),
  }).filter(([, value]) => value !== undefined));
  const [reward] = await db.update(venueRewardsTable).set({ ...patch, updatedAt: new Date() }).where(eq(venueRewardsTable.id, rewardId)).returning();
  res.json({ reward: serializeReward(reward!) });
});

router.get("/venue-manager/businesses/:businessId/announcements", requireSession, async (req, res): Promise<void> => {
  const membership = await requireBusinessRole(req, res, roles);
  if (!membership) return;
  const business = await businessWithProfile(membership.businessId);
  if (!business) return void res.status(404).json({ message: "Venue not found." });
  const announcements = await db.select().from(venueAnnouncementsTable)
    .where(eq(venueAnnouncementsTable.placeId, business.business.placeId))
    .orderBy(desc(venueAnnouncementsTable.isPinned), desc(venueAnnouncementsTable.createdAt));
  res.json({ announcements: announcements.map(serializeAnnouncement) });
});

router.post("/venue-manager/businesses/:businessId/announcements", requireSession, requireCsrf, async (req, res): Promise<void> => {
  const membership = await requireBusinessRole(req, res, contentRoles);
  if (!membership) return;
  const business = await businessWithProfile(membership.businessId);
  const title = optionalText(req.body?.title, 120);
  const body = optionalText(req.body?.body, 2000);
  if (!business || !title || !body) return void res.status(400).json({ message: "An announcement title and message are required." });
  const isPinned = req.body?.isPinned === true;
  if (isPinned) await db.update(venueAnnouncementsTable).set({ isPinned: false, updatedAt: new Date() }).where(eq(venueAnnouncementsTable.placeId, business.business.placeId));
  const [announcement] = await db.insert(venueAnnouncementsTable).values({
    ownerUid: business.profile.ownerUid, placeId: business.business.placeId, title, body, isPinned,
    imageUrl: optionalText(req.body?.imageUrl, 2000) ?? null,
  }).returning();
  res.status(201).json({ announcement: serializeAnnouncement(announcement!) });
});

router.delete("/venue-manager/businesses/:businessId/announcements/:announcementId", requireSession, requireCsrf, async (req, res): Promise<void> => {
  const membership = await requireBusinessRole(req, res, contentRoles);
  if (!membership) return;
  const business = await businessWithProfile(membership.businessId);
  const announcementId = Number(req.params["announcementId"]);
  if (!business || !Number.isInteger(announcementId)) return void res.status(400).json({ message: "Invalid announcement." });
  const deleted = await db.delete(venueAnnouncementsTable).where(and(eq(venueAnnouncementsTable.id, announcementId), eq(venueAnnouncementsTable.placeId, business.business.placeId))).returning({ id: venueAnnouncementsTable.id });
  if (!deleted.length) return void res.status(404).json({ message: "Announcement not found." });
  res.status(204).end();
});

router.get("/venue-manager/businesses/:businessId/members", requireSession, async (req, res): Promise<void> => {
  const membership = await requireBusinessRole(req, res, ["owner"]);
  if (!membership) return;
  const members = await db.select({
    managerId: venueManagersTable.id, email: venueManagersTable.email, displayName: venueManagersTable.displayName,
    role: venueMembershipsTable.role, status: venueMembershipsTable.status, acceptedAt: venueMembershipsTable.acceptedAt,
  }).from(venueMembershipsTable).innerJoin(venueManagersTable, eq(venueMembershipsTable.managerId, venueManagersTable.id))
    .where(and(eq(venueMembershipsTable.businessId, membership.businessId), eq(venueMembershipsTable.status, "active")))
    .orderBy(venueManagersTable.displayName);
  res.json({ members });
});

// ---------------------------------------------------------------------------
// QR code endpoints
// ---------------------------------------------------------------------------

/**
 * Canonical deep-link host for the Met app (must match AASA and Android
 * intentFilter configuration).  APP_BASE_URL must be set in production;
 * the fallback is the known app-link host so local dev still produces
 * scannable URLs while avoiding a silent wrong-host regression.
 */
const QR_BASE_URL =
  process.env["APP_BASE_URL"] ?? "https://metapp.replit.app";

if (!process.env["APP_BASE_URL"] && process.env["NODE_ENV"] === "production") {
  // Loud warning at startup so ops catches misconfiguration immediately.
  console.error(
    "[venueManager] WARNING: APP_BASE_URL is not set in production. " +
      "QR codes will use the fallback host https://metapp.replit.app — " +
      "set APP_BASE_URL to silence this warning.",
  );
}

function generateQrUrl(placeId: string, qrToken: string): string {
  return `${QR_BASE_URL}/v/${placeId}?t=${qrToken}`;
}

router.get("/venue-manager/businesses/:businessId/qr-code", requireSession, async (req, res): Promise<void> => {
  const membership = await requireBusinessRole(req, res, roles);
  if (!membership) return;
  const row = await businessWithProfile(membership.businessId);
  if (!row) return void res.status(404).json({ message: "Venue not found." });
  if (!row.profile.qrToken) {
    // Auto-generate a token if one was never set (e.g. pre-existing approved venues)
    const newToken = crypto.randomUUID();
    await db.update(venueOwnerProfilesTable).set({ qrToken: newToken, updatedAt: new Date() })
      .where(eq(venueOwnerProfilesTable.id, row.profile.id));
    res.json({ qrToken: newToken, qrUrl: generateQrUrl(row.business.placeId, newToken) });
    return;
  }
  res.json({ qrToken: row.profile.qrToken, qrUrl: generateQrUrl(row.business.placeId, row.profile.qrToken) });
});

router.post("/venue-manager/businesses/:businessId/qr-code/regenerate", requireSession, requireCsrf, async (req, res): Promise<void> => {
  const membership = await requireBusinessRole(req, res, ["owner"]);
  if (!membership) return;
  const row = await businessWithProfile(membership.businessId);
  if (!row) return void res.status(404).json({ message: "Venue not found." });
  const newToken = crypto.randomUUID();
  await db.update(venueOwnerProfilesTable).set({ qrToken: newToken, updatedAt: new Date() })
    .where(eq(venueOwnerProfilesTable.id, row.profile.id));
  res.json({ qrToken: newToken, qrUrl: generateQrUrl(row.business.placeId, newToken) });
});

router.get("/venue-manager/businesses/:businessId/dashboard", requireSession, async (req, res): Promise<void> => {
  const membership = await requireBusinessRole(req, res, roles);
  if (!membership) return;
  const business = await businessWithProfile(membership.businessId);
  if (!business) return void res.status(404).json({ message: "Venue not found." });
  const placeId = business.business.placeId;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [checkInTrend, topVisitorRows, eventRsvpRows, activeRewardRows, qrTodayRows, qrTrendRows] = await Promise.all([
    db.select({ day: sql<string>`DATE(${hubCheckinsTable.createdAt})`, count: count(hubCheckinsTable.id) })
      .from(hubCheckinsTable).where(and(eq(hubCheckinsTable.placeId, placeId), gte(hubCheckinsTable.createdAt, thirtyDaysAgo)))
      .groupBy(sql`DATE(${hubCheckinsTable.createdAt})`).orderBy(sql`DATE(${hubCheckinsTable.createdAt})`),
    db.select({ userUid: hubCheckinsTable.userUid, displayName: profilesTable.displayName, photoUrl: profilesTable.photoUrl, checkinCount: count(hubCheckinsTable.id) })
      .from(hubCheckinsTable).leftJoin(profilesTable, eq(hubCheckinsTable.userUid, profilesTable.uid))
      .where(and(eq(hubCheckinsTable.placeId, placeId), gte(hubCheckinsTable.createdAt, monthStart)))
      .groupBy(hubCheckinsTable.userUid, profilesTable.displayName, profilesTable.photoUrl).orderBy(desc(count(hubCheckinsTable.id))).limit(5),
    db.select({ eventId: venueEventsTable.id, title: venueEventsTable.title, startsAt: venueEventsTable.startsAt, going: sql<number>`COUNT(*) FILTER (WHERE ${venueEventRsvpsTable.status} = 'going')`, maybe: sql<number>`COUNT(*) FILTER (WHERE ${venueEventRsvpsTable.status} = 'maybe')` })
      .from(venueEventsTable).leftJoin(venueEventRsvpsTable, eq(venueEventsTable.id, venueEventRsvpsTable.eventId))
      .where(and(eq(venueEventsTable.placeId, placeId), eq(venueEventsTable.isPublished, true), gte(venueEventsTable.startsAt, now)))
      .groupBy(venueEventsTable.id).orderBy(venueEventsTable.startsAt).limit(5),
    db.select().from(venueRewardsTable).where(and(eq(venueRewardsTable.placeId, placeId), eq(venueRewardsTable.status, "active"), lt(venueRewardsTable.startDate, now), gte(venueRewardsTable.endDate, now))).limit(1),
    db.select({ distinctUsers: sql<number>`COUNT(DISTINCT ${venueQrVerificationsTable.userUid})` })
      .from(venueQrVerificationsTable)
      .where(and(eq(venueQrVerificationsTable.placeId, placeId), gte(venueQrVerificationsTable.verifiedAt, todayStart))),
    db.select({ day: sql<string>`DATE(${venueQrVerificationsTable.verifiedAt})`, count: sql<number>`COUNT(DISTINCT ${venueQrVerificationsTable.userUid})` })
      .from(venueQrVerificationsTable)
      .where(and(eq(venueQrVerificationsTable.placeId, placeId), gte(venueQrVerificationsTable.verifiedAt, sevenDaysAgo)))
      .groupBy(sql`DATE(${venueQrVerificationsTable.verifiedAt})`)
      .orderBy(sql`DATE(${venueQrVerificationsTable.verifiedAt})`),
  ]);
  res.json({
    checkInTrend: checkInTrend.map((row) => ({ day: row.day, count: Number(row.count) })),
    topVisitors: topVisitorRows.map((row) => ({ ...row, displayName: row.displayName ?? "Met member", checkinCount: Number(row.checkinCount) })),
    eventRsvpCounts: eventRsvpRows.map((row) => ({ ...row, going: Number(row.going), maybe: Number(row.maybe) })),
    activeReward: activeRewardRows[0] ? serializeReward(activeRewardRows[0]) : null,
    qrVerificationsToday: Number(qrTodayRows[0]?.distinctUsers ?? 0),
    qrVerificationsTrend: qrTrendRows.map((row) => ({ day: row.day, count: Number(row.count) })),
  });
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

/**
 * POST /venue-manager/register
 * First-time owner registration using a token generated by the admin portal.
 * Creates a manager credential and an owner membership, then issues a session
 * so the owner lands directly in the portal.
 */
router.post("/venue-manager/register", authLimit, async (req, res): Promise<void> => {
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  const email = typeof req.body?.email === "string" ? normalizeEmail(req.body.email) : "";
  const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim().slice(0, 120) : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!token || !email || !displayName || !passwordIsStrong(password)) {
    res.status(400).json({ message: "Provide a registration token, email, name, and a strong password (12+ chars, upper, lower, number)." });
    return;
  }
  const tokenHash = crypto.createHash("sha256").update(token).digest("base64url");
  const [reg] = await db
    .select()
    .from(venueManagerRegistrationTokensTable)
    .where(
      and(
        eq(venueManagerRegistrationTokensTable.tokenHash, tokenHash),
        isNull(venueManagerRegistrationTokensTable.consumedAt),
        gt(venueManagerRegistrationTokensTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!reg) {
    res.status(400).json({ message: "This registration link is invalid or has expired." });
    return;
  }
  const [business] = await db
    .select({
      id: venueBusinessesTable.id,
      isActive: venueBusinessesTable.isActive,
      venueOwnerProfileId: venueBusinessesTable.venueOwnerProfileId,
    })
    .from(venueBusinessesTable)
    .where(eq(venueBusinessesTable.id, reg.businessId))
    .limit(1);
  if (!business?.isActive) {
    res.status(409).json({ message: "This venue is no longer active." });
    return;
  }
  const [existingManager] = await db
    .select({ id: venueManagersTable.id })
    .from(venueManagersTable)
    .where(eq(venueManagersTable.email, email))
    .limit(1);
  if (existingManager) {
    // Check whether this account is orphaned (created but the transaction
    // that attached a membership failed). If it has no memberships it is
    // safe to delete and let the registration proceed.
    const [membership] = await db
      .select({ id: venueMembershipsTable.id })
      .from(venueMembershipsTable)
      .where(eq(venueMembershipsTable.managerId, existingManager.id))
      .limit(1);
    if (membership) {
      res.status(409).json({ message: "An account with this email already exists. Sign in instead." });
      return;
    }
    // Orphaned account — remove it so the registration can proceed cleanly.
    await db.delete(venueManagersTable).where(eq(venueManagersTable.id, existingManager.id));
  }
  // Hash password before entering the transaction so a slow bcrypt round
  // doesn't hold the DB connection open unnecessarily.
  const passwordHash = await hashPassword(password);
  // All writes are inside one transaction so a failure at any step rolls
  // everything back atomically — no orphaned manager rows on retry.
  const manager = await db.transaction(async (tx) => {
    // Remove any stale active-owner memberships for this business whose
    // manager account has been deleted or was never set (null). These
    // accumulate when a prior registration attempt partially succeeded
    // and would cause a unique-constraint violation on the insert below.
    await tx.delete(venueMembershipsTable).where(
      and(
        eq(venueMembershipsTable.businessId, business.id),
        eq(venueMembershipsTable.role, "owner"),
        eq(venueMembershipsTable.status, "active"),
        or(
          isNull(venueMembershipsTable.managerId),
          notInArray(
            venueMembershipsTable.managerId,
            tx.select({ id: venueManagersTable.id }).from(venueManagersTable),
          ),
        ),
      ),
    );
    const [mgr] = await tx
      .insert(venueManagersTable)
      .values({ email, displayName, passwordHash })
      .returning();
    if (!mgr) throw new Error("Failed to create manager account");
    await tx.insert(venueMembershipsTable).values({
      businessId: business.id,
      managerId: mgr.id,
      role: "owner",
      status: "active",
      acceptedAt: new Date(),
    });
    await tx.insert(venueMembershipAuditTable).values({
      businessId: business.id,
      eventType: "granted",
      subjectUid: email,
      toRole: "owner",
      toStatus: "active",
      metadata: JSON.stringify({ source: "portal_registration", managerId: mgr.id }),
    });
    await tx
      .update(venueManagerRegistrationTokensTable)
      .set({ consumedAt: new Date() })
      .where(eq(venueManagerRegistrationTokensTable.id, reg.id));
    // Keep the venue owner profile's contact email in sync with the address
    // the owner chose when creating their Venue Manager account.
    await tx
      .update(venueOwnerProfilesTable)
      .set({ contactEmail: email, updatedAt: new Date() })
      .where(eq(venueOwnerProfilesTable.id, business.venueOwnerProfileId));
    return mgr;
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

router.post("/venue-manager/businesses/:businessId/removal-request", requireSession, requireCsrf, async (req, res): Promise<void> => {
  const membership = await requireBusinessRole(req, res, ["owner"]);
  if (!membership) return;
  const current = await businessWithProfile(membership.businessId);
  if (!current) {
    res.status(404).json({ message: "Venue not found." });
    return;
  }
  const reason = optionalText(req.body?.reason, 2000) ?? null;
  // Record the removal request in the application history so admins can action it.
  // actorRole "applicant" maps to the venue-owner side (same as all applicant-initiated events).
  await db.insert(venueApplicationHistoryTable).values({
    venueOwnerProfileId: current.profile.id,
    eventType: "removal_requested",
    fromStatus: current.profile.applicationStatus,
    actorRole: "applicant",
    applicantMessage: reason,
    metadata: { managerId: req.venueManagerSession!.managerId, businessId: membership.businessId },
  });
  res.status(201).json({ message: "Your removal request has been received. Our team will follow up within 2–3 business days." });
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

const objectStorageService = new ObjectStorageService();

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

/**
 * Validates the first bytes of a buffer against known image magic bytes.
 * JPEG: FF D8 FF
 * PNG:  89 50 4E 47 0D 0A 1A 0A
 * GIF:  47 49 46 38 (GIF8)
 * WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50 (RIFF????WEBP)
 */
export function isAllowedImageMagicBytes(bytes: Buffer): boolean {
  if (bytes.length < 4) return false;
  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
  // GIF
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true;
  // WebP (RIFF????WEBP — needs 12 bytes)
  if (bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return true;
  return false;
}

router.post("/venue-manager/businesses/:businessId/images/upload", requireSession, requireCsrf, async (req, res): Promise<void> => {
  const membership = await requireBusinessRole(req, res, ["owner", "manager"]);
  if (!membership) return;
  const contentType = typeof req.body?.contentType === "string" ? req.body.contentType : "";
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType)) {
    res.status(400).json({ message: "Only JPEG, PNG, WebP, or GIF images are allowed." });
    return;
  }
  // The contentType is bound into the presigned URL so GCS enforces the Content-Type header on PUT.
  const uploadURL = await objectStorageService.getObjectEntityUploadURL(contentType);
  const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
  res.json({ uploadURL, objectPath });
});

router.post("/venue-manager/businesses/:businessId/images/confirm", requireSession, requireCsrf, async (req, res): Promise<void> => {
  const membership = await requireBusinessRole(req, res, ["owner", "manager"]);
  if (!membership) return;
  const objectPath = typeof req.body?.objectPath === "string" ? req.body.objectPath : "";
  // objectPath must be a normalized path returned by the upload endpoint: /objects/uploads/<uuid>
  // Reject traversal attempts (e.g. /objects/uploads/../../etc/passwd).
  if (!objectPath.startsWith("/objects/uploads/") || objectPath.includes("..")) {
    res.status(400).json({ message: "Invalid object path." });
    return;
  }
  let objectFile;
  try {
    objectFile = await objectStorageService.getObjectEntityFile(objectPath);
  } catch {
    res.status(404).json({ message: "Uploaded file not found. Please retry the upload." });
    return;
  }
  // Download the first 16 bytes and check against known image magic bytes.
  const magicBytes = await objectStorageService.getObjectMagicBytes(objectFile, 16);
  if (!isAllowedImageMagicBytes(magicBytes)) {
    // Delete the rejected object so it doesn't accumulate in storage.
    await objectFile.delete().catch(() => undefined);
    res.status(422).json({ message: "File does not appear to be a valid image. Please upload a JPEG, PNG, WebP, or GIF." });
    return;
  }
  res.json({ url: `/api/storage${objectPath}` });
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
      // If the account has no memberships it was orphaned by a failed
      // transaction — delete it so the owner can retry cleanly.
      const [membership] = await db.select({ id: venueMembershipsTable.id }).from(venueMembershipsTable).where(eq(venueMembershipsTable.managerId, exists.id)).limit(1);
      if (membership) {
        res.status(409).json({ message: "This email already has a venue manager account." });
        return;
      }
      await db.delete(venueManagersTable).where(eq(venueManagersTable.id, exists.id));
    }
    const passwordHash = await hashPassword(password);
    const manager = await db.transaction(async (tx) => {
      const [mgr] = await tx.insert(venueManagersTable).values({ email, displayName, passwordHash }).returning();
      if (!mgr) throw new Error("Unable to create manager");
      await tx.insert(venueMembershipsTable).values({ businessId: business.id, managerId: mgr.id, role: "owner", status: "active", acceptedAt: new Date() });
      await tx.insert(venueMembershipAuditTable).values({ businessId: business.id, eventType: "granted", subjectUid: email, toRole: "owner", toStatus: "active", metadata: JSON.stringify({ source: "legacy_owner_claim", legacyUid: req.uid }) });
      // Keep the venue owner profile's contact email in sync with the address
      // the owner chose when creating their Venue Manager account.
      await tx.update(venueOwnerProfilesTable).set({ contactEmail: email, updatedAt: new Date() }).where(eq(venueOwnerProfilesTable.id, profile.id));
      return mgr;
    });
    await issueSession(req, res, manager.id);
  });
  return claimRouter;
}

export default router;