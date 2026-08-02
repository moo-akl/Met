/**
 * Venue Owner Portal — API routes
 *
 * POST   /venue-owner/register                     — claim a venue
 * GET    /venue-owner/me                            — owner's own profile
 * PUT    /venue-owner/me                            — update own profile
 * GET    /venue-owner/:placeId                      — public (approved only)
 *
 * POST   /venue-owner/me/events                    — create event
 * GET    /venue-owner/:placeId/events              — list events for venue
 * PUT    /venue-owner/me/events/:id                — update event
 * DELETE /venue-owner/me/events/:id               — delete event
 * POST   /venue-events/:id/rsvp                    — RSVP to an event
 * GET    /venue-events/:id/rsvp                    — caller's current RSVP
 *
 * POST   /venue-owner/me/rewards                  — create reward
 * GET    /venue-owner/:placeId/rewards             — list rewards for venue
 * PUT    /venue-owner/me/rewards/:id              — update reward
 * POST   /venue-owner/crown-reward-winners        — cron: pick winners
 *
 * POST   /venue-owner/me/announcements            — create announcement
 * GET    /venue-owner/:placeId/announcements      — list announcements
 * DELETE /venue-owner/me/announcements/:id        — delete announcement
 *
 * GET    /api/hubs/venue-owners                   — map layer GeoJSON-style points
 *
 * GET    /venue-owner/me/dashboard               — owner analytics
 *
 * GET    /admin/venue-owner/pending              — admin: list pending claims
 * POST   /admin/venue-owner/approve/:id          — admin: approve
 * POST   /admin/venue-owner/reject/:id           — admin: reject
 *
 * POST   /venue-owner/expire-pending-claims      — cron: release ghost-locked placeIds
 */

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import {
  eq,
  and,
  desc,
  gte,
  lt,
  sql,
  count,
  isNull,
  inArray,
  ne,
  or,
  ilike,
} from "drizzle-orm";
import {
  db,
  venueOwnerProfilesTable,
  venueApplicationHistoryTable,
  venueEventsTable,
  venueEventRsvpsTable,
  venueRewardsTable,
  venueAnnouncementsTable,
  hubCheckinsTable,
  profilesTable,
  venueAdminCredentialsTable,
} from "@workspace/db";
import { requireUid } from "../middlewares/requireUid";
import { createIpRateLimiter, createUserRateLimiter } from "../middlewares/rateLimit";
import { sendPush } from "../lib/push";
import { logger } from "../lib/logger";
import { z } from "zod/v4";
import crypto from "node:crypto";

const venueApplicationStatuses = [
  "draft",
  "submitted",
  "under_review",
  "changes_requested",
  "rejected",
  "resubmitted",
  "approved",
  "withdrawn",
  "expired",
] as const;
type VenueApplicationStatus = (typeof venueApplicationStatuses)[number];

const APPLICATION_STATUS_LABELS: Record<VenueApplicationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  changes_requested: "Changes requested",
  rejected: "Not approved",
  resubmitted: "Resubmitted",
  approved: "Approved",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

/**
 * Statuses where the application is sitting in the reviewer's queue. Every
 * admin decision transitions *out* of this set, which is what makes a repeated
 * or concurrent decision a no-op conflict rather than an overwrite.
 */
const REVIEWABLE_STATUSES = ["submitted", "under_review", "resubmitted"] as const;

/** Statuses where the applicant still holds the venue but owes us an update. */
const APPLICANT_ACTION_STATUSES = ["rejected", "changes_requested"] as const;

function isReviewable(status: string): boolean {
  return (REVIEWABLE_STATUSES as readonly string[]).includes(status);
}

const venueApplicationInputSchema = z.object({
  placeId: z.string().trim().min(1).max(255),
  placeName: z.string().trim().min(1).max(255),
  businessName: z.string().trim().min(1).max(255),
  lat: z.coerce.number().finite().gte(-90).lte(90),
  lng: z.coerce.number().finite().gte(-180).lte(180),
  tagline: z.string().trim().max(160).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  verificationDocUrl: z.string().trim().url().max(2000),
  registrationNotes: z.string().trim().max(500).optional().nullable(),
});

type VenueApplicationInput = z.infer<typeof venueApplicationInputSchema>;

const router: IRouter = Router();
const ADMIN_SESSION_COOKIE = "met_venue_admin";
const ADMIN_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

function deriveScryptKey(password: string, salt: string, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keyLength, { N: 16_384, r: 8, p: 1 }, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

function adminSessionOptions(req: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: req.secure || process.env["NODE_ENV"] === "production",
    signed: true,
    maxAge: ADMIN_SESSION_MAX_AGE_MS,
    path: "/api/admin/venue-owner",
  };
}

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

type AdminSession = { credentialId: number; sessionVersion: number; expiresAt: number };

function readAdminSession(req: Request): AdminSession | null {
  if (!process.env["SESSION_SECRET"]) return null;
  const raw = req.signedCookies?.[ADMIN_SESSION_COOKIE];
  if (typeof raw !== "string") return null;
  const [id, version, expiry] = raw.split(".");
  const credentialId = Number(id);
  const sessionVersion = Number(version);
  const expiresAt = Number(expiry);
  if (!Number.isInteger(credentialId) || !Number.isInteger(sessionVersion) ||
      !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return { credentialId, sessionVersion, expiresAt };
}

async function hasValidAdminSession(req: Request): Promise<AdminSession | null> {
  const session = readAdminSession(req);
  if (!session) return null;
  const [credential] = await db
    .select({ id: venueAdminCredentialsTable.id, sessionVersion: venueAdminCredentialsTable.sessionVersion })
    .from(venueAdminCredentialsTable)
    .where(eq(venueAdminCredentialsTable.id, session.credentialId))
    .limit(1);
  return credential?.sessionVersion === session.sessionVersion ? session : null;
}

async function requireAdminSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!process.env["SESSION_SECRET"]) {
    res.status(503).json({ message: "Admin sessions are not enabled" });
    return;
  }
  if (!(await hasValidAdminSession(req))) {
    res.status(401).json({ message: "Your admin session has expired. Unlock the dashboard again." });
    return;
  }
  next();
}

function adminSecretsMatch(submitted: string, expected: string): boolean {
  const submittedBuffer = Buffer.from(submitted);
  const expectedBuffer = Buffer.from(expected);
  return submittedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(submittedBuffer, expectedBuffer);
}

function hasStrongPassword(password: string): boolean {
  return password.length >= 12 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password);
}

async function hashAdminPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = await deriveScryptKey(password, salt, 64);
  return `scrypt$${salt}$${hash.toString("base64url")}`;
}

async function verifyAdminPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, salt, encodedHash] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !encodedHash) return false;
  const expected = Buffer.from(encodedHash, "base64url");
  const derived = await deriveScryptKey(password, salt, expected.length);
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

function issueAdminSession(req: Request, res: Response, credential: { id: number; sessionVersion: number }): void {
  const expiresAt = Date.now() + ADMIN_SESSION_MAX_AGE_MS;
  res.cookie(
    ADMIN_SESSION_COOKIE,
    `${credential.id}.${credential.sessionVersion}.${expiresAt}`,
    adminSessionOptions(req),
  );
  res.json({ authenticated: true, expiresAt: new Date(expiresAt).toISOString() });
}

/** Guards cron-only endpoints: X-Cron-Secret header must match CRON_SECRET env. */
function requireCronSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env["CRON_SECRET"];
  if (!secret) {
    res.status(503).json({ message: "Cron endpoints are not enabled" });
    return;
  }
  if (req.header("x-cron-secret") !== secret) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// Lockout policy
// ---------------------------------------------------------------------------

/** Number of consecutive wrong passwords before the credential is locked. */
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
/** How long the credential stays locked after reaching the threshold. */
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

const venueOwnerWriteLimit = createUserRateLimiter({
  windowMs: 60_000,
  max: 20,
  name: "venue-owner-write",
});

const venueOwnerReadLimit = createUserRateLimiter({
  windowMs: 60_000,
  max: 60,
  name: "venue-owner-read",
});

const venueOwnerPlaceSearchLimit = createUserRateLimiter({
  windowMs: 60_000,
  max: 20,
  name: "venue-owner-place-search",
});
const venueAdminAuthLimit = createIpRateLimiter({
  windowMs: 15 * 60_000,
  max: 10,
  name: "venue-admin-auth",
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeApplicationProfile(
  profile: typeof venueOwnerProfilesTable.$inferSelect,
) {
  return {
    ...profile,
    status: profile.applicationStatus,
    statusLabel: APPLICATION_STATUS_LABELS[profile.applicationStatus],
  };
}

type HistoryEventType = typeof venueApplicationHistoryTable.$inferInsert["eventType"];

/** Minimal surface shared by `db` and a Drizzle transaction handle. */
type DbExecutor = Pick<typeof db, "insert">;

async function appendApplicationHistory(
  input: {
    venueOwnerProfileId: number;
    eventType: HistoryEventType;
    fromStatus?: VenueApplicationStatus | null;
    toStatus?: VenueApplicationStatus | null;
    actorRole: "applicant" | "admin" | "system";
    actorUid?: string | null;
    applicantMessage?: string | null;
    internalNote?: string | null;
    metadata?: Record<string, unknown> | null;
  },
  executor: DbExecutor = db,
): Promise<void> {
  await executor.insert(venueApplicationHistoryTable).values({
    ...input,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    actorUid: input.actorUid ?? null,
    applicantMessage: input.applicantMessage ?? null,
    internalNote: input.internalNote ?? null,
    metadata: input.metadata ?? null,
  });
}

async function placeIsClaimedByAnotherOwner(placeId: string, ownerUid: string): Promise<boolean> {
  const conflict = await db
    .select({ id: venueOwnerProfilesTable.id })
    .from(venueOwnerProfilesTable)
    .where(
      and(
        eq(venueOwnerProfilesTable.placeId, placeId),
        ne(venueOwnerProfilesTable.ownerUid, ownerUid),
        ne(venueOwnerProfilesTable.applicationStatus, "withdrawn"),
        ne(venueOwnerProfilesTable.applicationStatus, "expired"),
      ),
    )
    .limit(1);
  return conflict.length > 0;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

async function getApplicationHistoryForApplicant(profileId: number) {
  return db
    .select({
      id: venueApplicationHistoryTable.id,
      eventType: venueApplicationHistoryTable.eventType,
      fromStatus: venueApplicationHistoryTable.fromStatus,
      toStatus: venueApplicationHistoryTable.toStatus,
      applicantMessage: venueApplicationHistoryTable.applicantMessage,
      createdAt: venueApplicationHistoryTable.createdAt,
    })
    .from(venueApplicationHistoryTable)
    .where(eq(venueApplicationHistoryTable.venueOwnerProfileId, profileId))
    .orderBy(venueApplicationHistoryTable.createdAt);
}

/** Recalculate and update the denormalized rsvpCount on a venue event. */
async function syncRsvpCount(eventId: number): Promise<void> {
  const result = await db
    .select({ cnt: count() })
    .from(venueEventRsvpsTable)
    .where(
      and(
        eq(venueEventRsvpsTable.eventId, eventId),
        ne(venueEventRsvpsTable.status, "not_going"),
      ),
    );
  const cnt = result[0]?.cnt ?? 0;
  await db
    .update(venueEventsTable)
    .set({ rsvpCount: Number(cnt), updatedAt: new Date() })
    .where(eq(venueEventsTable.id, eventId));
}

// ---------------------------------------------------------------------------
// Phase 1 — Registration & Profile
// ---------------------------------------------------------------------------

interface VenueSearchPlace {
  placeId: string;
  placeName: string;
  address: string | null;
  category: string | null;
  googleMapsUri: string | null;
  lat: number;
  lng: number;
}

async function searchGoogleVenues(
  query: string,
  latitude?: number,
  longitude?: number,
): Promise<VenueSearchPlace[]> {
  const apiKey = process.env["GOOGLE_API_KEY"];
  if (!apiKey) throw new Error("Google Places search is not configured");

  const body: Record<string, unknown> = { textQuery: query, maxResultCount: 8 };
  if (latitude != null && longitude != null) {
    body.locationBias = {
      circle: { center: { latitude, longitude }, radius: 30_000 },
    };
  }
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.primaryTypeDisplayName,places.googleMapsUri,places.location",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    logger.warn({ status: response.status }, "Venue Google Places search failed");
    throw new Error("Google Places search is temporarily unavailable");
  }
  const payload = (await response.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      primaryTypeDisplayName?: { text?: string };
      googleMapsUri?: string;
      location?: { latitude?: number; longitude?: number };
    }>;
  };
  return (payload.places ?? [])
    .filter((place) => place.id && place.displayName?.text && place.location?.latitude != null && place.location?.longitude != null)
    .map((place) => ({
      placeId: place.id!,
      placeName: place.displayName!.text!,
      address: place.formattedAddress ?? null,
      category: place.primaryTypeDisplayName?.text ?? null,
      googleMapsUri: place.googleMapsUri ?? null,
      lat: place.location!.latitude!,
      lng: place.location!.longitude!,
    }));
}

router.get(
  "/venue-owner/places/search",
  requireUid,
  venueOwnerPlaceSearchLimit,
  async (req: Request, res: Response): Promise<void> => {
    const query = typeof req.query["query"] === "string" ? req.query["query"].trim() : "";
    const latitude = typeof req.query["lat"] === "string" ? Number(req.query["lat"]) : undefined;
    const longitude = typeof req.query["lng"] === "string" ? Number(req.query["lng"]) : undefined;
    if (query.length < 2) {
      res.status(400).json({ message: "Enter at least two characters to search" });
      return;
    }
    if ((latitude != null && !Number.isFinite(latitude)) || (longitude != null && !Number.isFinite(longitude))) {
      res.status(400).json({ message: "Invalid location bias" });
      return;
    }
    try {
      const places = await searchGoogleVenues(query, latitude, longitude);
      res.json({ places });
    } catch (error) {
      res.status(503).json({ message: (error as Error).message });
    }
  },
);

/**
 * POST /venue-owner/register
 * Body: { placeId, placeName, businessName, lat?, lng?, tagline?, description?,
 *         verificationDocUrl?, registrationNotes? }
 */
router.post(
  "/venue-owner/register",
  requireUid,
  venueOwnerWriteLimit,
  async (req: Request, res: Response) => {
    const uid = req.uid!;
    const parsed = venueApplicationInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      return;
    }
    const data = parsed.data;

    // Check if ownerUid already has a profile
    const existing = await db
      .select({ id: venueOwnerProfilesTable.id })
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.ownerUid, uid))
      .limit(1);
    if (existing.length > 0) {
      res.status(409).json({ message: "You already have a venue owner profile" });
      return;
    }

    if (await placeIsClaimedByAnotherOwner(data.placeId, uid)) {
      res.status(409).json({ message: "This venue is already claimed" });
      return;
    }

    try {
      const now = new Date();
      const [profile] = await db
        .insert(venueOwnerProfilesTable)
        .values({
          ownerUid: uid,
          placeId: data.placeId,
          placeName: data.placeName,
          businessName: data.businessName,
          lat: String(data.lat),
          lng: String(data.lng),
          tagline: data.tagline ?? null,
          description: data.description ?? null,
          verificationDocUrl: data.verificationDocUrl,
          registrationNotes: data.registrationNotes ?? null,
          applicationStatus: "submitted",
          submittedAt: now,
          isApproved: false,
          isVerified: false,
        })
        .returning();
      await appendApplicationHistory({
        venueOwnerProfileId: profile.id,
        eventType: "submitted",
        toStatus: "submitted",
        actorRole: "applicant",
        actorUid: uid,
        applicantMessage: "Application submitted for review.",
      });
      res.status(201).json({ profile: serializeApplicationProfile(profile) });
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ message: "This venue is already claimed" });
        return;
      }
      throw error;
    }
  },
);

/**
 * GET /venue-owner/me
 */
router.get(
  "/venue-owner/me",
  requireUid,
  venueOwnerReadLimit,
  async (req: Request, res: Response) => {
    const uid = req.uid!;
    const [profile] = await db
      .select()
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.ownerUid, uid))
      .limit(1);
    if (!profile) {
      res.status(404).json({ message: "No venue owner profile found" });
      return;
    }
    res.json({ profile: serializeApplicationProfile(profile) });
  },
);

/**
 * GET /venue-owner/me/application
 * The authoritative applicant-safe lifecycle response. Internal reviewer notes
 * are intentionally excluded from the history returned here.
 */
router.get(
  "/venue-owner/me/application",
  requireUid,
  venueOwnerReadLimit,
  async (req: Request, res: Response): Promise<void> => {
    const [profile] = await db
      .select()
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.ownerUid, req.uid!))
      .limit(1);
    if (!profile) {
      res.status(404).json({ message: "No venue application found" });
      return;
    }
    const history = await getApplicationHistoryForApplicant(profile.id);
    res.json({ application: serializeApplicationProfile(profile), history });
  },
);

/**
 * POST /venue-owner/reapply
 * Allows a rejected applicant to update their submission and re-enter the review queue.
 * Only permitted when the caller has an existing profile with isApproved=false and a
 * rejectionReason set.
 */
router.post(
  "/venue-owner/reapply",
  requireUid,
  venueOwnerWriteLimit,
  async (req: Request, res: Response) => {
    const uid = req.uid!;

    const parsed = venueApplicationInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      return;
    }
    const data = parsed.data;

    const [existing] = await db
      .select({
        id: venueOwnerProfilesTable.id,
        applicationStatus: venueOwnerProfilesTable.applicationStatus,
      })
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.ownerUid, uid))
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: "No venue owner profile found" });
      return;
    }
    if (!(APPLICANT_ACTION_STATUSES as readonly string[]).includes(existing.applicationStatus)) {
      res.status(409).json({
        message: "Only an application that was declined or sent back for changes can be resubmitted.",
      });
      return;
    }
    const previousStatus = existing.applicationStatus as VenueApplicationStatus;
    if (await placeIsClaimedByAnotherOwner(data.placeId, uid)) {
      res.status(409).json({ message: "This venue is already claimed" });
      return;
    }
    try {
      const now = new Date();
      const [profile] = await db
        .update(venueOwnerProfilesTable)
        .set({
          placeId: data.placeId,
          placeName: data.placeName,
          businessName: data.businessName,
          lat: String(data.lat),
          lng: String(data.lng),
          tagline: data.tagline ?? null,
          description: data.description ?? null,
          verificationDocUrl: data.verificationDocUrl,
          registrationNotes: data.registrationNotes ?? null,
          rejectionReason: null,
          applicationStatus: "resubmitted",
          submittedAt: now,
          reviewedAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(venueOwnerProfilesTable.ownerUid, uid),
            inArray(venueOwnerProfilesTable.applicationStatus, [...APPLICANT_ACTION_STATUSES]),
          ),
        )
        .returning();
      if (!profile) {
        res.status(409).json({
          message: "This application changed while you were updating it. Refresh to see its current status.",
        });
        return;
      }
      await appendApplicationHistory({
        venueOwnerProfileId: profile.id,
        eventType: "resubmitted",
        fromStatus: previousStatus,
        toStatus: "resubmitted",
        actorRole: "applicant",
        actorUid: uid,
        applicantMessage: "Updated application resubmitted for review.",
      });
      res.json({ profile: serializeApplicationProfile(profile) });
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ message: "This venue is already claimed" });
        return;
      }
      throw error;
    }
  },
);

router.post(
  "/venue-owner/me/application/withdraw",
  requireUid,
  venueOwnerWriteLimit,
  async (req: Request, res: Response): Promise<void> => {
    const uid = req.uid!;
    const [existing] = await db
      .select()
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.ownerUid, uid))
      .limit(1);
    if (!existing) {
      res.status(404).json({ message: "No venue application found" });
      return;
    }
    if (!isReviewable(existing.applicationStatus)) {
      res.status(409).json({ message: "This application cannot be withdrawn in its current state" });
      return;
    }
    const now = new Date();
    const [profile] = await db
      .update(venueOwnerProfilesTable)
      .set({ applicationStatus: "withdrawn", withdrawnAt: now, updatedAt: now })
      .where(eq(venueOwnerProfilesTable.id, existing.id))
      .returning();
    await appendApplicationHistory({
      venueOwnerProfileId: profile.id,
      eventType: "withdrawn",
      fromStatus: existing.applicationStatus,
      toStatus: "withdrawn",
      actorRole: "applicant",
      actorUid: uid,
      applicantMessage: "Application withdrawn.",
    });
    res.json({ application: serializeApplicationProfile(profile) });
  },
);

/**
 * PUT /venue-owner/me
 * Body: { businessName?, tagline?, description?, coverPhotoUrl?, logoUrl? }
 */
router.put(
  "/venue-owner/me",
  requireUid,
  venueOwnerWriteLimit,
  async (req: Request, res: Response) => {
    const uid = req.uid!;
    const schema = z.object({
      businessName: z.string().min(1).optional(),
      tagline: z.string().max(160).optional().nullable(),
      description: z.string().max(1000).optional().nullable(),
      coverPhotoUrl: z.string().url().optional().nullable(),
      logoUrl: z.string().url().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      return;
    }

    const [profile] = await db
      .select({ id: venueOwnerProfilesTable.id })
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.ownerUid, uid))
      .limit(1);
    if (!profile) {
      res.status(404).json({ message: "No venue owner profile found" });
      return;
    }

    const [updated] = await db
      .update(venueOwnerProfilesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(venueOwnerProfilesTable.ownerUid, uid))
      .returning();

    res.json({ profile: updated });
  },
);

/**
 * GET /venue-owner/:placeId  (public — approved only)
 */
router.get(
  "/venue-owner/:placeId",
  requireUid,
  venueOwnerReadLimit,
  async (req: Request, res: Response) => {
    const { placeId } = req.params as { placeId: string };
    const [profile] = await db
      .select()
      .from(venueOwnerProfilesTable)
      .where(
        and(
          eq(venueOwnerProfilesTable.placeId, placeId),
          eq(venueOwnerProfilesTable.isApproved, true),
        ),
      )
      .limit(1);
    if (!profile) {
      res.status(404).json({ message: "No approved venue profile found for this place" });
      return;
    }
    res.json({ profile });
  },
);

// ---------------------------------------------------------------------------
// Phase 1 — Events
// ---------------------------------------------------------------------------

/**
 * POST /venue-owner/me/events
 */
router.post(
  "/venue-owner/me/events",
  requireUid,
  venueOwnerWriteLimit,
  async (req: Request, res: Response) => {
    const uid = req.uid!;
    const schema = z.object({
      title: z.string().min(1).max(120),
      description: z.string().max(2000).optional().nullable(),
      imageUrl: z.string().url().optional().nullable(),
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime().optional().nullable(),
      capacityLimit: z.number().int().positive().optional().nullable(),
      isPublished: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      return;
    }

    const [ownerProfile] = await db
      .select({ placeId: venueOwnerProfilesTable.placeId, isApproved: venueOwnerProfilesTable.isApproved })
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.ownerUid, uid))
      .limit(1);
    if (!ownerProfile?.isApproved) {
      res.status(403).json({ message: "Your venue must be approved before creating events" });
      return;
    }

    const [event] = await db
      .insert(venueEventsTable)
      .values({
        ownerUid: uid,
        placeId: ownerProfile.placeId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        imageUrl: parsed.data.imageUrl ?? null,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        capacityLimit: parsed.data.capacityLimit ?? null,
        isPublished: parsed.data.isPublished ?? true,
      })
      .returning();

    res.status(201).json({ event });
  },
);

/**
 * GET /venue-owner/:placeId/events
 */
router.get(
  "/venue-owner/:placeId/events",
  requireUid,
  venueOwnerReadLimit,
  async (req: Request, res: Response) => {
    const { placeId } = req.params as { placeId: string };
    const events = await db
      .select()
      .from(venueEventsTable)
      .where(
        and(
          eq(venueEventsTable.placeId, placeId),
          eq(venueEventsTable.isPublished, true),
        ),
      )
      .orderBy(desc(venueEventsTable.startsAt));
    res.json({ events });
  },
);

/**
 * PUT /venue-owner/me/events/:id
 */
router.put(
  "/venue-owner/me/events/:id",
  requireUid,
  venueOwnerWriteLimit,
  async (req: Request, res: Response) => {
    const uid = req.uid!;
    const eventId = parseInt(String(req.params["id"] ?? ""), 10);
    if (isNaN(eventId)) {
      res.status(400).json({ message: "Invalid event id" });
      return;
    }

    const [existing] = await db
      .select()
      .from(venueEventsTable)
      .where(and(eq(venueEventsTable.id, eventId), eq(venueEventsTable.ownerUid, uid)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ message: "Event not found or not owned by you" });
      return;
    }

    const schema = z.object({
      title: z.string().min(1).max(120).optional(),
      description: z.string().max(2000).optional().nullable(),
      imageUrl: z.string().url().optional().nullable(),
      startsAt: z.string().datetime().optional(),
      endsAt: z.string().datetime().optional().nullable(),
      capacityLimit: z.number().int().positive().optional().nullable(),
      isPublished: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      return;
    }

    const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.title !== undefined) updatePayload["title"] = parsed.data.title;
    if (parsed.data.description !== undefined) updatePayload["description"] = parsed.data.description;
    if (parsed.data.imageUrl !== undefined) updatePayload["imageUrl"] = parsed.data.imageUrl;
    if (parsed.data.startsAt !== undefined) updatePayload["startsAt"] = new Date(parsed.data.startsAt);
    if (parsed.data.endsAt !== undefined) updatePayload["endsAt"] = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
    if (parsed.data.capacityLimit !== undefined) updatePayload["capacityLimit"] = parsed.data.capacityLimit;
    if (parsed.data.isPublished !== undefined) updatePayload["isPublished"] = parsed.data.isPublished;

    const [updated] = await db
      .update(venueEventsTable)
      .set(updatePayload)
      .where(eq(venueEventsTable.id, eventId))
      .returning();

    res.json({ event: updated });
  },
);

/**
 * DELETE /venue-owner/me/events/:id
 */
router.delete(
  "/venue-owner/me/events/:id",
  requireUid,
  venueOwnerWriteLimit,
  async (req: Request, res: Response) => {
    const uid = req.uid!;
    const eventId = parseInt(String(req.params["id"] ?? ""), 10);
    if (isNaN(eventId)) {
      res.status(400).json({ message: "Invalid event id" });
      return;
    }

    const [existing] = await db
      .select({ id: venueEventsTable.id })
      .from(venueEventsTable)
      .where(and(eq(venueEventsTable.id, eventId), eq(venueEventsTable.ownerUid, uid)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ message: "Event not found or not owned by you" });
      return;
    }

    // Cascade delete RSVPs then the event
    await db.delete(venueEventRsvpsTable).where(eq(venueEventRsvpsTable.eventId, eventId));
    await db.delete(venueEventsTable).where(eq(venueEventsTable.id, eventId));

    res.json({ success: true });
  },
);

/**
 * POST /venue-events/:id/rsvp
 * Body: { status: 'going' | 'maybe' | 'not_going' }
 */
router.post(
  "/venue-events/:id/rsvp",
  requireUid,
  venueOwnerWriteLimit,
  async (req: Request, res: Response) => {
    const uid = req.uid!;
    const eventId = parseInt(String(req.params["id"] ?? ""), 10);
    if (isNaN(eventId)) {
      res.status(400).json({ message: "Invalid event id" });
      return;
    }

    const schema = z.object({
      status: z.enum(["going", "maybe", "not_going"]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      return;
    }

    const [event] = await db
      .select({ id: venueEventsTable.id })
      .from(venueEventsTable)
      .where(eq(venueEventsTable.id, eventId))
      .limit(1);
    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    // Upsert RSVP
    await db
      .insert(venueEventRsvpsTable)
      .values({ eventId, userUid: uid, status: parsed.data.status })
      .onConflictDoUpdate({
        target: [venueEventRsvpsTable.eventId, venueEventRsvpsTable.userUid],
        set: { status: parsed.data.status, updatedAt: new Date() },
      });

    await syncRsvpCount(eventId);

    res.json({ success: true, status: parsed.data.status });
  },
);

/**
 * GET /venue-events/:id/rsvp
 */
router.get(
  "/venue-events/:id/rsvp",
  requireUid,
  venueOwnerReadLimit,
  async (req: Request, res: Response) => {
    const uid = req.uid!;
    const eventId = parseInt(String(req.params["id"] ?? ""), 10);
    if (isNaN(eventId)) {
      res.status(400).json({ message: "Invalid event id" });
      return;
    }
    const [rsvp] = await db
      .select()
      .from(venueEventRsvpsTable)
      .where(and(eq(venueEventRsvpsTable.eventId, eventId), eq(venueEventRsvpsTable.userUid, uid)))
      .limit(1);
    res.json({ rsvp: rsvp ?? null });
  },
);

// ---------------------------------------------------------------------------
// Phase 1 — Rewards
// ---------------------------------------------------------------------------

/**
 * POST /venue-owner/me/rewards
 */
router.post(
  "/venue-owner/me/rewards",
  requireUid,
  venueOwnerWriteLimit,
  async (req: Request, res: Response) => {
    const uid = req.uid!;
    const schema = z.object({
      title: z.string().min(1).max(120),
      description: z.string().max(2000).optional().nullable(),
      prizeDescription: z.string().min(1).max(200),
      rewardType: z.enum(["free_drink", "discount", "experience", "custom"]).optional(),
      status: z.enum(["draft", "active"]).optional(),
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      venueTimezone: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      return;
    }

    const [ownerProfile] = await db
      .select({ placeId: venueOwnerProfilesTable.placeId, isApproved: venueOwnerProfilesTable.isApproved })
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.ownerUid, uid))
      .limit(1);
    if (!ownerProfile?.isApproved) {
      res.status(403).json({ message: "Your venue must be approved before creating rewards" });
      return;
    }

    const [reward] = await db
      .insert(venueRewardsTable)
      .values({
        ownerUid: uid,
        placeId: ownerProfile.placeId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        prizeDescription: parsed.data.prizeDescription,
        rewardType: parsed.data.rewardType ?? "custom",
        status: parsed.data.status ?? "draft",
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        venueTimezone: parsed.data.venueTimezone ?? "UTC",
      })
      .returning();

    res.status(201).json({ reward });
  },
);

/**
 * GET /venue-owner/:placeId/rewards
 */
router.get(
  "/venue-owner/:placeId/rewards",
  requireUid,
  venueOwnerReadLimit,
  async (req: Request, res: Response) => {
    const { placeId } = req.params as { placeId: string };
    const rewards = await db
      .select()
      .from(venueRewardsTable)
      .where(
        and(
          eq(venueRewardsTable.placeId, placeId),
          ne(venueRewardsTable.status, "cancelled"),
        ),
      )
      .orderBy(desc(venueRewardsTable.createdAt));
    res.json({ rewards });
  },
);

/**
 * PUT /venue-owner/me/rewards/:id
 */
router.put(
  "/venue-owner/me/rewards/:id",
  requireUid,
  venueOwnerWriteLimit,
  async (req: Request, res: Response) => {
    const uid = req.uid!;
    const rewardId = parseInt(String(req.params["id"] ?? ""), 10);
    if (isNaN(rewardId)) {
      res.status(400).json({ message: "Invalid reward id" });
      return;
    }

    const [existing] = await db
      .select()
      .from(venueRewardsTable)
      .where(and(eq(venueRewardsTable.id, rewardId), eq(venueRewardsTable.ownerUid, uid)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ message: "Reward not found or not owned by you" });
      return;
    }

    const schema = z.object({
      title: z.string().min(1).max(120).optional(),
      description: z.string().max(2000).optional().nullable(),
      prizeDescription: z.string().min(1).max(200).optional(),
      rewardType: z.enum(["free_drink", "discount", "experience", "custom"]).optional(),
      status: z.enum(["draft", "active", "cancelled"]).optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      venueTimezone: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      return;
    }

    const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
    const d = parsed.data;
    if (d.title !== undefined) updatePayload["title"] = d.title;
    if (d.description !== undefined) updatePayload["description"] = d.description;
    if (d.prizeDescription !== undefined) updatePayload["prizeDescription"] = d.prizeDescription;
    if (d.rewardType !== undefined) updatePayload["rewardType"] = d.rewardType;
    if (d.status !== undefined) updatePayload["status"] = d.status;
    if (d.startDate !== undefined) updatePayload["startDate"] = new Date(d.startDate);
    if (d.endDate !== undefined) updatePayload["endDate"] = new Date(d.endDate);
    if (d.venueTimezone !== undefined) updatePayload["venueTimezone"] = d.venueTimezone;

    const [updated] = await db
      .update(venueRewardsTable)
      .set(updatePayload)
      .where(eq(venueRewardsTable.id, rewardId))
      .returning();

    res.json({ reward: updated });
  },
);

/**
 * POST /venue-owner/crown-reward-winners
 * Cron endpoint — protected by X-Cron-Secret header.
 *
 * Finds all active rewards where endDate < now, picks the top check-in
 * user over the reward period as winner, sends FCM push to both winner
 * and venue owner, and marks the reward as completed.
 *
 * Timezone-safe: uses the reward's venueTimezone field when comparing
 * endDate against the current local time at the venue, preventing
 * premature or delayed winner selections near midnight boundaries.
 */
router.post(
  "/venue-owner/crown-reward-winners",
  requireCronSecret,
  async (_req: Request, res: Response) => {
    const now = new Date();

    // Find active rewards whose endDate is in the past
    const expiredRewards = await db
      .select()
      .from(venueRewardsTable)
      .where(
        and(
          eq(venueRewardsTable.status, "active"),
          lt(venueRewardsTable.endDate, now),
          isNull(venueRewardsTable.winnerUid),
        ),
      );

    const results: Array<{
      rewardId: number;
      placeId: string;
      winner: string | null;
      skipped?: boolean;
      reason?: string;
    }> = [];

    for (const reward of expiredRewards) {
      try {
        // Timezone-safe check: verify the endDate has truly passed in the
        // venue's local timezone. This guards against cron running slightly
        // early relative to a venue in a timezone behind UTC.
        const venueNow = new Date(
          now.toLocaleString("en-US", { timeZone: reward.venueTimezone ?? "UTC" }),
        );
        const venueEnd = new Date(
          reward.endDate.toLocaleString("en-US", { timeZone: reward.venueTimezone ?? "UTC" }),
        );
        if (venueNow < venueEnd) {
          results.push({ rewardId: reward.id, placeId: reward.placeId, winner: null, skipped: true, reason: "not_ended_in_venue_tz" });
          continue;
        }

        // Top check-in user during the reward period
        const topUsers = await db
          .select({
            userUid: hubCheckinsTable.userUid,
            cnt: count(hubCheckinsTable.id),
          })
          .from(hubCheckinsTable)
          .where(
            and(
              eq(hubCheckinsTable.placeId, reward.placeId),
              gte(hubCheckinsTable.createdAt, reward.startDate),
              lt(hubCheckinsTable.createdAt, reward.endDate),
            ),
          )
          .groupBy(hubCheckinsTable.userUid)
          .orderBy(desc(count(hubCheckinsTable.id)))
          .limit(1);

        if (topUsers.length === 0 || !topUsers[0]) {
          // No check-ins during the period — mark completed with no winner
          await db
            .update(venueRewardsTable)
            .set({ status: "completed", updatedAt: new Date() })
            .where(eq(venueRewardsTable.id, reward.id));
          results.push({ rewardId: reward.id, placeId: reward.placeId, winner: null, reason: "no_checkins" });
          continue;
        }

        const winnerUid = topUsers[0].userUid;

        await db
          .update(venueRewardsTable)
          .set({
            winnerUid,
            winnerSelectedAt: new Date(),
            status: "completed",
            updatedAt: new Date(),
          })
          .where(eq(venueRewardsTable.id, reward.id));

        // Fetch display name for push notification
        const [winnerProfile] = await db
          .select({ displayName: profilesTable.displayName })
          .from(profilesTable)
          .where(eq(profilesTable.uid, winnerUid))
          .limit(1);

        const winnerName = winnerProfile?.displayName ?? "Someone";

        // Push to winner
        try {
          await sendPush(winnerUid, {
            title: "🏆 You won a reward!",
            body: `You've been crowned as the winner of "${reward.title}" at a venue you've been visiting. Come claim your prize!`,
            data: {
              type: "venue_reward_winner",
              rewardId: String(reward.id),
              placeId: reward.placeId,
            },
          });
        } catch (pushErr) {
          logger.warn({ err: pushErr, winnerUid }, "Failed to push reward win to winner");
        }

        // Push to venue owner
        try {
          await sendPush(reward.ownerUid, {
            title: "🎉 Winner selected!",
            body: `${winnerName} was selected as the winner of your reward "${reward.title}". Time to reach out!`,
            data: {
              type: "venue_reward_owner_notification",
              rewardId: String(reward.id),
              winnerUid,
            },
          });
        } catch (pushErr) {
          logger.warn({ err: pushErr, ownerUid: reward.ownerUid }, "Failed to push reward win to venue owner");
        }

        results.push({ rewardId: reward.id, placeId: reward.placeId, winner: winnerUid });
      } catch (err) {
        logger.error({ err, rewardId: reward.id }, "Error crowning reward winner");
        results.push({ rewardId: reward.id, placeId: reward.placeId, winner: null, reason: "error" });
      }
    }

    res.json({ processed: results.length, results });
  },
);

// ---------------------------------------------------------------------------
// Phase 1 — Announcements
// ---------------------------------------------------------------------------

/**
 * POST /venue-owner/me/announcements
 */
router.post(
  "/venue-owner/me/announcements",
  requireUid,
  venueOwnerWriteLimit,
  async (req: Request, res: Response) => {
    const uid = req.uid!;
    const schema = z.object({
      title: z.string().min(1).max(120),
      body: z.string().min(1).max(2000),
      imageUrl: z.string().url().optional().nullable(),
      isPinned: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
      return;
    }

    const [ownerProfile] = await db
      .select({ placeId: venueOwnerProfilesTable.placeId, isApproved: venueOwnerProfilesTable.isApproved })
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.ownerUid, uid))
      .limit(1);
    if (!ownerProfile?.isApproved) {
      res.status(403).json({ message: "Your venue must be approved before posting announcements" });
      return;
    }

    // If pinning, unpin all existing announcements for this venue first
    if (parsed.data.isPinned) {
      await db
        .update(venueAnnouncementsTable)
        .set({ isPinned: false, updatedAt: new Date() })
        .where(eq(venueAnnouncementsTable.placeId, ownerProfile.placeId));
    }

    const [announcement] = await db
      .insert(venueAnnouncementsTable)
      .values({
        ownerUid: uid,
        placeId: ownerProfile.placeId,
        title: parsed.data.title,
        body: parsed.data.body,
        imageUrl: parsed.data.imageUrl ?? null,
        isPinned: parsed.data.isPinned ?? false,
      })
      .returning();

    res.status(201).json({ announcement });
  },
);

/**
 * GET /venue-owner/:placeId/announcements
 */
router.get(
  "/venue-owner/:placeId/announcements",
  requireUid,
  venueOwnerReadLimit,
  async (req: Request, res: Response) => {
    const { placeId } = req.params as { placeId: string };
    const announcements = await db
      .select()
      .from(venueAnnouncementsTable)
      .where(eq(venueAnnouncementsTable.placeId, placeId))
      .orderBy(desc(venueAnnouncementsTable.isPinned), desc(venueAnnouncementsTable.createdAt));
    res.json({ announcements });
  },
);

/**
 * DELETE /venue-owner/me/announcements/:id
 */
router.delete(
  "/venue-owner/me/announcements/:id",
  requireUid,
  venueOwnerWriteLimit,
  async (req: Request, res: Response) => {
    const uid = req.uid!;
    const announcementId = parseInt(String(req.params["id"] ?? ""), 10);
    if (isNaN(announcementId)) {
      res.status(400).json({ message: "Invalid announcement id" });
      return;
    }

    const [existing] = await db
      .select({ id: venueAnnouncementsTable.id })
      .from(venueAnnouncementsTable)
      .where(
        and(
          eq(venueAnnouncementsTable.id, announcementId),
          eq(venueAnnouncementsTable.ownerUid, uid),
        ),
      )
      .limit(1);
    if (!existing) {
      res.status(404).json({ message: "Announcement not found or not owned by you" });
      return;
    }

    await db.delete(venueAnnouncementsTable).where(eq(venueAnnouncementsTable.id, announcementId));
    res.json({ success: true });
  },
);

// ---------------------------------------------------------------------------
// Phase 2 — Map layer endpoint
// ---------------------------------------------------------------------------

/**
 * GET /api/hubs/venue-owners
 * Returns approved+verified venue owner locations as a GeoJSON-style points
 * array suitable for the map layer. Includes flags for active rewards/events.
 */
router.get(
  "/api/hubs/venue-owners",
  requireUid,
  venueOwnerReadLimit,
  async (_req: Request, res: Response) => {
    const now = new Date();

    const profiles = await db
      .select()
      .from(venueOwnerProfilesTable)
      .where(
        and(
          eq(venueOwnerProfilesTable.isApproved, true),
          eq(venueOwnerProfilesTable.isVerified, true),
        ),
      );

    const points = await Promise.all(
      profiles.map(async (p) => {
        // Check for active reward
        const activeRewards = await db
          .select({ id: venueRewardsTable.id })
          .from(venueRewardsTable)
          .where(
            and(
              eq(venueRewardsTable.placeId, p.placeId),
              eq(venueRewardsTable.status, "active"),
              lt(venueRewardsTable.startDate, now),
              gte(venueRewardsTable.endDate, now),
            ),
          )
          .limit(1);

        // Check for upcoming events
        const upcomingEvents = await db
          .select({ id: venueEventsTable.id })
          .from(venueEventsTable)
          .where(
            and(
              eq(venueEventsTable.placeId, p.placeId),
              eq(venueEventsTable.isPublished, true),
              gte(venueEventsTable.startsAt, now),
            ),
          )
          .limit(1);

        return {
          placeId: p.placeId,
          placeName: p.placeName,
          businessName: p.businessName,
          tagline: p.tagline,
          logoUrl: p.logoUrl,
          lat: p.lat ? parseFloat(p.lat) : null,
          lng: p.lng ? parseFloat(p.lng) : null,
          hasActiveReward: activeRewards.length > 0,
          hasUpcomingEvent: upcomingEvents.length > 0,
        };
      }),
    );

    // Filter out venues without valid coordinates
    const validPoints = points.filter((p) => p.lat !== null && p.lng !== null);
    res.json({ venues: validPoints });
  },
);

// ---------------------------------------------------------------------------
// Phase 5 — Owner Dashboard Analytics
// ---------------------------------------------------------------------------

/**
 * GET /venue-owner/me/dashboard
 * Returns:
 *   - check-in trend for the last 30 days (daily buckets)
 *   - top 5 visitors this month
 *   - RSVP counts per event
 *   - active reward status
 */
router.get(
  "/venue-owner/me/dashboard",
  requireUid,
  venueOwnerReadLimit,
  async (req: Request, res: Response) => {
    const uid = req.uid!;
    const [ownerProfile] = await db
      .select()
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.ownerUid, uid))
      .limit(1);

    if (!ownerProfile?.isApproved) {
      res.status(403).json({ message: "Approved venue profile required" });
      return;
    }

    const placeId = ownerProfile.placeId;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Check-in trend — group by day (last 30 days)
    const trendRows = await db
      .select({
        day: sql<string>`DATE(${hubCheckinsTable.createdAt})`,
        count: count(hubCheckinsTable.id),
      })
      .from(hubCheckinsTable)
      .where(
        and(
          eq(hubCheckinsTable.placeId, placeId),
          gte(hubCheckinsTable.createdAt, thirtyDaysAgo),
        ),
      )
      .groupBy(sql`DATE(${hubCheckinsTable.createdAt})`)
      .orderBy(sql`DATE(${hubCheckinsTable.createdAt})`);

    // Top 5 visitors this month
    const topVisitors = await db
      .select({
        userUid: hubCheckinsTable.userUid,
        checkinCount: count(hubCheckinsTable.id),
      })
      .from(hubCheckinsTable)
      .where(
        and(
          eq(hubCheckinsTable.placeId, placeId),
          gte(hubCheckinsTable.createdAt, monthStart),
        ),
      )
      .groupBy(hubCheckinsTable.userUid)
      .orderBy(desc(count(hubCheckinsTable.id)))
      .limit(5);

    // Fetch display names for top visitors
    const topVisitorUids = topVisitors.map((v) => v.userUid);
    const visitorProfiles =
      topVisitorUids.length > 0
        ? await db
            .select({ uid: profilesTable.uid, displayName: profilesTable.displayName, photoUrl: profilesTable.photoUrl })
            .from(profilesTable)
            .where(sql`${profilesTable.uid} = ANY(${topVisitorUids})`)
        : [];
    const profileMap = Object.fromEntries(visitorProfiles.map((p) => [p.uid, p]));

    const topVisitorsEnriched = topVisitors.map((v) => ({
      userUid: v.userUid,
      displayName: profileMap[v.userUid]?.displayName ?? "Unknown",
      photoUrl: profileMap[v.userUid]?.photoUrl ?? null,
      checkinCount: Number(v.checkinCount),
    }));

    // RSVP counts per upcoming event
    const upcomingEvents = await db
      .select()
      .from(venueEventsTable)
      .where(
        and(
          eq(venueEventsTable.ownerUid, uid),
          gte(venueEventsTable.startsAt, now),
          eq(venueEventsTable.isPublished, true),
        ),
      )
      .orderBy(venueEventsTable.startsAt);

    const eventRsvpCounts = await Promise.all(
      upcomingEvents.map(async (e) => {
        const rsvpRows = await db
          .select({ status: venueEventRsvpsTable.status, cnt: count(venueEventRsvpsTable.id) })
          .from(venueEventRsvpsTable)
          .where(eq(venueEventRsvpsTable.eventId, e.id))
          .groupBy(venueEventRsvpsTable.status);

        const going = rsvpRows.find((r) => r.status === "going")?.cnt ?? 0;
        const maybe = rsvpRows.find((r) => r.status === "maybe")?.cnt ?? 0;

        return {
          eventId: e.id,
          title: e.title,
          startsAt: e.startsAt,
          going: Number(going),
          maybe: Number(maybe),
        };
      }),
    );

    // Active reward
    const [activeReward] = await db
      .select()
      .from(venueRewardsTable)
      .where(
        and(
          eq(venueRewardsTable.placeId, placeId),
          eq(venueRewardsTable.status, "active"),
          lt(venueRewardsTable.startDate, now),
          gte(venueRewardsTable.endDate, now),
        ),
      )
      .limit(1);

    res.json({
      placeId,
      placeName: ownerProfile.placeName,
      businessName: ownerProfile.businessName,
      checkInTrend: trendRows.map((r) => ({ day: r.day, count: Number(r.count) })),
      topVisitors: topVisitorsEnriched,
      eventRsvpCounts,
      activeReward: activeReward ?? null,
    });
  },
);

// ---------------------------------------------------------------------------
// Auto-expiry cron — Phase 1 Enhancement
// ---------------------------------------------------------------------------

/**
 * POST /venue-owner/expire-pending-claims
 * Cron endpoint (X-Cron-Secret required).
 * Expires stale applications older than 14 days. Records remain for audit
 * history, while expired place IDs become available for a future claim.
 */
router.post(
  "/venue-owner/expire-pending-claims",
  requireCronSecret,
  async (_req: Request, res: Response) => {
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const expired = await db
      .select({
        id: venueOwnerProfilesTable.id,
        placeId: venueOwnerProfilesTable.placeId,
        applicationStatus: venueOwnerProfilesTable.applicationStatus,
      })
      .from(venueOwnerProfilesTable)
      .where(
        and(
          lt(venueOwnerProfilesTable.submittedAt, cutoff),
          sql`${venueOwnerProfilesTable.applicationStatus} IN ('submitted', 'under_review', 'resubmitted')`,
        ),
      );

    if (expired.length > 0) {
      const ids = expired.map((e) => e.id);
      await db
        .update(venueOwnerProfilesTable)
        .set({
          applicationStatus: "expired",
          expiredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(sql`${venueOwnerProfilesTable.id} = ANY(${ids})`);
      await Promise.all(
        expired.map((application) =>
          appendApplicationHistory({
            venueOwnerProfileId: application.id,
            eventType: "expired",
            fromStatus: application.applicationStatus,
            toStatus: "expired",
            actorRole: "system",
            applicantMessage: "Application expired because it was not reviewed in time.",
          }),
        ),
      );
    }

    logger.info({ count: expired.length }, "Expired pending venue owner claims");
    res.json({ expired: expired.length, placeIds: expired.map((e) => e.placeId) });
  },
);

// ---------------------------------------------------------------------------
// Admin endpoints
// ---------------------------------------------------------------------------

/** Returns only state needed to choose the unlock or bootstrap screen. */
router.get(
  "/admin/venue-owner/setup",
  async (_req: Request, res: Response): Promise<void> => {
    const [credential] = await db
      .select({ id: venueAdminCredentialsTable.id })
      .from(venueAdminCredentialsTable)
      .limit(1);
    // Normal sign-in only needs the session secret; the bootstrap secret is
    // only required while setup (or recovery) is still pending.
    const sessionReady = Boolean(process.env["SESSION_SECRET"]);
    res.json({
      setupRequired: !credential,
      serverConfigured: credential ? sessionReady : sessionReady && Boolean(process.env["ADMIN_SECRET"]),
    });
  },
);

/**
 * First setup is guarded by the deployment-only bootstrap secret. It becomes
 * unavailable as soon as a credential exists.
 */
router.post(
  "/admin/venue-owner/setup",
  venueAdminAuthLimit,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = z.object({
      bootstrapCode: z.string().min(1),
      password: z.string().min(12).max(256),
    }).safeParse(req.body);
    if (!process.env["SESSION_SECRET"] || !process.env["ADMIN_SECRET"]) {
      res.status(503).json({ message: "Venue Admin setup is not configured on the server." });
      return;
    }
    if (!parsed.success || !hasStrongPassword(parsed.data.password) ||
        !adminSecretsMatch(parsed.data.bootstrapCode, process.env["ADMIN_SECRET"])) {
      res.status(401).json({ message: "Setup could not be verified. Check the bootstrap code and password requirements." });
      return;
    }
    const [existing] = await db.select({ id: venueAdminCredentialsTable.id })
      .from(venueAdminCredentialsTable).limit(1);
    if (existing) {
      res.status(409).json({ message: "A Venue Admin password is already configured. Sign in or use the recovery form." });
      return;
    }
    const passwordHash = await hashAdminPassword(parsed.data.password);
    const [credential] = await db.insert(venueAdminCredentialsTable)
      .values({ passwordHash })
      .returning({ id: venueAdminCredentialsTable.id, sessionVersion: venueAdminCredentialsTable.sessionVersion });
    issueAdminSession(req, res, credential);
  },
);

/** Starts a session from the managed server-side password. */
router.post(
  "/admin/venue-owner/session",
  venueAdminAuthLimit,
  async (req: Request, res: Response): Promise<void> => {
    const schema = z.object({ password: z.string().min(1).max(256) });
    const parsed = schema.safeParse(req.body);
    if (!process.env["SESSION_SECRET"]) {
      res.status(503).json({ message: "Venue Admin sessions are not configured on the server." });
      return;
    }
    const [credential] = await db.select()
      .from(venueAdminCredentialsTable)
      .limit(1);
    if (!credential) {
      res.status(428).json({ message: "Venue Admin needs its first password set up before anyone can sign in." });
      return;
    }

    // Per-credential lockout check (independent of IP-based rate limiting).
    if (credential.lockedUntil && credential.lockedUntil > new Date()) {
      const retryAfterSec = Math.ceil((credential.lockedUntil.getTime() - Date.now()) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({
        message: "Too many failed sign-in attempts. The account is temporarily locked. Try again later.",
      });
      return;
    }

    if (!parsed.success || !(await verifyAdminPassword(parsed.data.password, credential.passwordHash))) {
      const attempts = (credential.failedLoginAttempts ?? 0) + 1;
      const lockedUntil = attempts >= MAX_FAILED_LOGIN_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_DURATION_MS)
        : null;
      await db.update(venueAdminCredentialsTable)
        .set({ failedLoginAttempts: attempts, lockedUntil, updatedAt: new Date() })
        .where(eq(venueAdminCredentialsTable.id, credential.id));
      res.status(401).json({ message: "Incorrect password. Try again or use password recovery." });
      return;
    }

    // Successful sign-in: clear the failure counter and issue a session.
    await db.update(venueAdminCredentialsTable)
      .set({ lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
      .where(eq(venueAdminCredentialsTable.id, credential.id));
    issueAdminSession(req, res, credential);
  },
);

/**
 * GET /admin/venue-owner/session
 */
router.get(
  "/admin/venue-owner/session",
  async (req: Request, res: Response): Promise<void> => {
    const session = await hasValidAdminSession(req);
    if (!session) {
      res.status(401).json({ message: "No active admin session" });
      return;
    }
    res.json({ authenticated: true, expiresAt: new Date(session.expiresAt).toISOString() });
  },
);

/**
 * DELETE /admin/venue-owner/session
 */
router.delete(
  "/admin/venue-owner/session",
  (req: Request, res: Response): void => {
    res.clearCookie(ADMIN_SESSION_COOKIE, adminSessionOptions(req));
    res.status(204).send();
  },
);

/** Authenticated password change. The session version rotation revokes all old cookies. */
router.post(
  "/admin/venue-owner/password",
  requireAdminSession,
  venueAdminAuthLimit,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = z.object({
      currentPassword: z.string().min(1).max(256),
      newPassword: z.string().min(12).max(256),
    }).safeParse(req.body);
    if (!parsed.success || !hasStrongPassword(parsed.data.newPassword)) {
      res.status(400).json({ message: "Use a password with at least 12 characters, including upper-case, lower-case, and a number." });
      return;
    }
    const session = readAdminSession(req)!;
    const [credential] = await db.select().from(venueAdminCredentialsTable)
      .where(eq(venueAdminCredentialsTable.id, session.credentialId)).limit(1);
    if (!credential || !(await verifyAdminPassword(parsed.data.currentPassword, credential.passwordHash))) {
      res.status(401).json({ message: "Your current password is incorrect." });
      return;
    }
    const passwordHash = await hashAdminPassword(parsed.data.newPassword);
    const nextVersion = credential.sessionVersion + 1;
    await db.update(venueAdminCredentialsTable).set({
      passwordHash, sessionVersion: nextVersion, passwordChangedAt: new Date(), updatedAt: new Date(),
    }).where(eq(venueAdminCredentialsTable.id, credential.id));
    issueAdminSession(req, res, { id: credential.id, sessionVersion: nextVersion });
  },
);

/**
 * Emergency recovery remains deployment-secret protected rather than exposing
 * an unauthenticated reset channel with no configured delivery mechanism.
 */
router.post(
  "/admin/venue-owner/password/recover",
  venueAdminAuthLimit,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = z.object({
      bootstrapCode: z.string().min(1),
      newPassword: z.string().min(12).max(256),
    }).safeParse(req.body);
    const bootstrapSecret = process.env["ADMIN_SECRET"];
    if (!bootstrapSecret) {
      res.status(503).json({ message: "Password recovery is not configured on the server." });
      return;
    }
    if (!parsed.success || !hasStrongPassword(parsed.data.newPassword) ||
        !adminSecretsMatch(parsed.data.bootstrapCode, bootstrapSecret)) {
      res.status(401).json({ message: "Recovery could not be verified. Check the recovery code and password requirements." });
      return;
    }
    const [credential] = await db.select().from(venueAdminCredentialsTable).limit(1);
    if (!credential) {
      res.status(428).json({ message: "Set up the first Venue Admin password before using recovery." });
      return;
    }
    const passwordHash = await hashAdminPassword(parsed.data.newPassword);
    await db.update(venueAdminCredentialsTable).set({
      passwordHash,
      sessionVersion: credential.sessionVersion + 1,
      passwordChangedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(venueAdminCredentialsTable.id, credential.id));
    res.status(204).send();
  },
);

/**
 * Applies a reviewer decision as a single conditional update plus an
 * append-only history row.
 *
 * The UPDATE carries its own `status IN (allowedFrom)` predicate, so two
 * reviewers acting on the same application race at the database rather than in
 * route code: the first decision matches, the second matches zero rows and is
 * reported as a conflict instead of silently overwriting a newer decision.
 */
type TransitionResult =
  | { ok: true; profile: typeof venueOwnerProfilesTable.$inferSelect; fromStatus: VenueApplicationStatus }
  | { ok: false; status: 404 | 409; message: string; currentStatus?: VenueApplicationStatus };

async function transitionApplication(input: {
  profileId: number;
  allowedFrom: readonly VenueApplicationStatus[];
  expectedStatus?: VenueApplicationStatus | undefined;
  toStatus: VenueApplicationStatus;
  eventType: HistoryEventType;
  patch: Partial<typeof venueOwnerProfilesTable.$inferInsert>;
  applicantMessage?: string | null;
  internalNote?: string | null;
  conflictMessage: string;
}): Promise<TransitionResult> {
  const [existing] = await db
    .select()
    .from(venueOwnerProfilesTable)
    .where(eq(venueOwnerProfilesTable.id, input.profileId))
    .limit(1);
  if (!existing) {
    return { ok: false, status: 404, message: "Application not found" };
  }

  const currentStatus = existing.applicationStatus as VenueApplicationStatus;

  // Optimistic concurrency: the reviewer decided while looking at a specific
  // state. If it moved underneath them, make them re-read before deciding.
  if (input.expectedStatus && input.expectedStatus !== currentStatus) {
    return {
      ok: false,
      status: 409,
      message: `This application changed to "${APPLICATION_STATUS_LABELS[currentStatus]}" while you were reviewing it. Refresh to see the latest decision.`,
      currentStatus,
    };
  }
  if (!input.allowedFrom.includes(currentStatus)) {
    return { ok: false, status: 409, message: input.conflictMessage, currentStatus };
  }

  const now = new Date();
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(venueOwnerProfilesTable)
      .set({ ...input.patch, applicationStatus: input.toStatus, updatedAt: now })
      .where(
        and(
          eq(venueOwnerProfilesTable.id, input.profileId),
          inArray(venueOwnerProfilesTable.applicationStatus, [...input.allowedFrom]),
        ),
      )
      .returning();
    if (!row) return null;

    await appendApplicationHistory(
      {
        venueOwnerProfileId: row.id,
        eventType: input.eventType,
        fromStatus: currentStatus,
        toStatus: input.toStatus,
        actorRole: "admin",
        applicantMessage: input.applicantMessage ?? null,
        internalNote: input.internalNote ?? null,
      },
      tx,
    );
    return row;
  });

  if (!updated) {
    return { ok: false, status: 409, message: input.conflictMessage, currentStatus };
  }
  return { ok: true, profile: updated, fromStatus: currentStatus };
}

function parseProfileId(raw: unknown): number | null {
  const id = Number.parseInt(String(raw ?? ""), 10);
  return Number.isNaN(id) || id < 1 ? null : id;
}

async function notifyApplicant(
  req: Request,
  profile: typeof venueOwnerProfilesTable.$inferSelect,
  payload: { title: string; body: string; type: string },
): Promise<void> {
  try {
    await sendPush(profile.ownerUid, {
      title: payload.title,
      body: payload.body,
      data: { type: payload.type, placeId: profile.placeId },
    });
  } catch {
    req.log?.warn(
      { profileId: profile.id, type: payload.type },
      "Venue review notification could not be delivered",
    );
  }
}

const reviewNoteSchema = z.string().trim().min(1).max(1000);

const adminListQuerySchema = z.object({
  status: z.string().trim().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  search: z.string().trim().max(120).optional(),
});

/**
 * GET /admin/venue-owner/applications
 * Query: ?status=submitted,under_review | ?status=all &from=ISO &to=ISO
 *        &search=business-or-place
 *
 * Defaults to the review queue (applications actually awaiting a decision) so
 * the portal never presents an already-decided application as actionable.
 */
router.get(
  "/admin/venue-owner/applications",
  requireAdminSession,
  async (req: Request, res: Response): Promise<void> => {
    const parsedQuery = adminListQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      res.status(400).json({ message: "Invalid filters" });
      return;
    }
    const { status, from, to, search } = parsedQuery.data;

    let statuses: VenueApplicationStatus[] = [...REVIEWABLE_STATUSES];
    if (status && status !== "queue") {
      if (status === "all") {
        statuses = [...venueApplicationStatuses];
      } else {
        const requested = status.split(",").map((value) => value.trim()).filter(Boolean);
        const invalid = requested.filter(
          (value) => !(venueApplicationStatuses as readonly string[]).includes(value),
        );
        if (invalid.length > 0 || requested.length === 0) {
          res.status(400).json({ message: `Unknown application status: ${invalid.join(", ") || "(none)"}` });
          return;
        }
        statuses = requested as VenueApplicationStatus[];
      }
    }

    const filters = [inArray(venueOwnerProfilesTable.applicationStatus, statuses)];
    if (from) {
      const fromDate = new Date(from);
      if (Number.isNaN(fromDate.getTime())) {
        res.status(400).json({ message: "Invalid 'from' date" });
        return;
      }
      filters.push(gte(venueOwnerProfilesTable.submittedAt, fromDate));
    }
    if (to) {
      const toDate = new Date(to);
      if (Number.isNaN(toDate.getTime())) {
        res.status(400).json({ message: "Invalid 'to' date" });
        return;
      }
      filters.push(lt(venueOwnerProfilesTable.submittedAt, toDate));
    }
    if (search) {
      const pattern = `%${search.replace(/[%_\\]/g, "\\$&")}%`;
      filters.push(
        or(
          ilike(venueOwnerProfilesTable.businessName, pattern),
          ilike(venueOwnerProfilesTable.placeName, pattern),
          ilike(venueOwnerProfilesTable.placeId, pattern),
          ilike(venueOwnerProfilesTable.ownerUid, pattern),
          sql`CAST(${venueOwnerProfilesTable.id} AS TEXT) ILIKE ${pattern}`,
        )!,
      );
    }

    const applications = await db
      .select()
      .from(venueOwnerProfilesTable)
      .where(and(...filters))
      .orderBy(desc(venueOwnerProfilesTable.submittedAt));

    const countRows = await db
      .select({ status: venueOwnerProfilesTable.applicationStatus, total: count() })
      .from(venueOwnerProfilesTable)
      .groupBy(venueOwnerProfilesTable.applicationStatus);

    const counts: Record<string, number> = {};
    for (const row of countRows ?? []) {
      counts[row.status] = Number(row.total);
    }

    res.json({
      applications: applications.map(serializeApplicationProfile),
      counts,
    });
  },
);

/**
 * GET /admin/venue-owner/applications/:id
 * Full reviewer view: current application plus the complete audit trail,
 * including internal notes that are never exposed to the applicant.
 */
router.get(
  "/admin/venue-owner/applications/:id",
  requireAdminSession,
  async (req: Request, res: Response): Promise<void> => {
    const profileId = parseProfileId(req.params["id"]);
    if (profileId === null) {
      res.status(400).json({ message: "Invalid profile id" });
      return;
    }
    const [profile] = await db
      .select()
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.id, profileId))
      .limit(1);
    if (!profile) {
      res.status(404).json({ message: "Application not found" });
      return;
    }
    const history = await db
      .select()
      .from(venueApplicationHistoryTable)
      .where(eq(venueApplicationHistoryTable.venueOwnerProfileId, profileId))
      .orderBy(venueApplicationHistoryTable.createdAt);

    res.json({
      application: serializeApplicationProfile(profile),
      history: (history ?? []).map((entry) => ({
        id: entry.id,
        eventType: entry.eventType,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        actorRole: entry.actorRole,
        actorUid: entry.actorUid,
        applicantMessage: entry.applicantMessage,
        internalNote: entry.internalNote,
        createdAt: entry.createdAt,
      })),
    });
  },
);

/**
 * POST /admin/venue-owner/applications/:id/start-review
 * Claims an application so the queue shows it is actively being looked at.
 */
router.post(
  "/admin/venue-owner/applications/:id/start-review",
  requireAdminSession,
  async (req: Request, res: Response): Promise<void> => {
    const profileId = parseProfileId(req.params["id"]);
    if (profileId === null) {
      res.status(400).json({ message: "Invalid profile id" });
      return;
    }
    const parsed = z
      .object({ internalNote: reviewNoteSchema.optional() })
      .safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid input" });
      return;
    }

    const result = await transitionApplication({
      profileId,
      allowedFrom: ["submitted", "resubmitted"],
      toStatus: "under_review",
      eventType: "under_review",
      patch: {},
      internalNote: parsed.data.internalNote ?? null,
      conflictMessage: "This application is no longer waiting to be picked up",
    });
    if (!result.ok) {
      res.status(result.status).json({ message: result.message, currentStatus: result.currentStatus });
      return;
    }
    res.json({ profile: serializeApplicationProfile(result.profile) });
  },
);

/**
 * POST /admin/venue-owner/applications/:id/approve
 */
router.post(
  "/admin/venue-owner/applications/:id/approve",
  requireAdminSession,
  async (req: Request, res: Response): Promise<void> => {
    const profileId = parseProfileId(req.params["id"]);
    if (profileId === null) {
      res.status(400).json({ message: "Invalid profile id" });
      return;
    }
    const parsed = z
      .object({
        internalNote: reviewNoteSchema.optional(),
        expectedStatus: z.enum(venueApplicationStatuses).optional(),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid input" });
      return;
    }

    const now = new Date();
    const result = await transitionApplication({
      profileId,
      allowedFrom: REVIEWABLE_STATUSES,
      expectedStatus: parsed.data.expectedStatus,
      toStatus: "approved",
      eventType: "approved",
      patch: {
        isApproved: true,
        isVerified: true,
        rejectionReason: null,
        reviewedAt: now,
        approvedAt: now,
      },
      applicantMessage: "Your venue application has been approved.",
      internalNote: parsed.data.internalNote ?? null,
      conflictMessage: "This application is no longer awaiting review",
    });
    if (!result.ok) {
      res.status(result.status).json({ message: result.message, currentStatus: result.currentStatus });
      return;
    }

    await notifyApplicant(req, result.profile, {
      title: "Venue approved",
      body: `Your venue "${result.profile.businessName}" has been approved. You can now create events, rewards, and announcements.`,
      type: "venue_owner_approved",
    });

    res.json({ profile: serializeApplicationProfile(result.profile) });
  },
);

/**
 * POST /admin/venue-owner/applications/:id/reject
 */
router.post(
  "/admin/venue-owner/applications/:id/reject",
  requireAdminSession,
  async (req: Request, res: Response): Promise<void> => {
    const profileId = parseProfileId(req.params["id"]);
    if (profileId === null) {
      res.status(400).json({ message: "Invalid profile id" });
      return;
    }
    const parsed = z
      .object({
        reason: z.string().trim().min(3).max(500),
        internalNote: reviewNoteSchema.optional(),
        expectedStatus: z.enum(venueApplicationStatuses).optional(),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ message: "A rejection reason of at least 3 characters is required" });
      return;
    }

    const now = new Date();
    const result = await transitionApplication({
      profileId,
      allowedFrom: REVIEWABLE_STATUSES,
      expectedStatus: parsed.data.expectedStatus,
      toStatus: "rejected",
      eventType: "rejected",
      patch: {
        isApproved: false,
        isVerified: false,
        rejectionReason: parsed.data.reason,
        reviewedAt: now,
        rejectedAt: now,
      },
      applicantMessage: parsed.data.reason,
      internalNote: parsed.data.internalNote ?? null,
      conflictMessage: "This application is no longer awaiting review",
    });
    if (!result.ok) {
      res.status(result.status).json({ message: result.message, currentStatus: result.currentStatus });
      return;
    }

    await notifyApplicant(req, result.profile, {
      title: "Venue application update",
      body: `Your venue application for "${result.profile.businessName}" was not approved. Reason: ${parsed.data.reason}`,
      type: "venue_owner_rejected",
    });

    res.json({ profile: serializeApplicationProfile(result.profile) });
  },
);

/**
 * POST /admin/venue-owner/applications/:id/request-changes
 * Hands the application back to the applicant without burning the claim: the
 * venue stays reserved for them while they fix what the reviewer flagged.
 */
router.post(
  "/admin/venue-owner/applications/:id/request-changes",
  requireAdminSession,
  async (req: Request, res: Response): Promise<void> => {
    const profileId = parseProfileId(req.params["id"]);
    if (profileId === null) {
      res.status(400).json({ message: "Invalid profile id" });
      return;
    }
    const parsed = z
      .object({
        message: z.string().trim().min(3).max(500),
        internalNote: reviewNoteSchema.optional(),
        expectedStatus: z.enum(venueApplicationStatuses).optional(),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        message: "Tell the applicant what to change (at least 3 characters)",
      });
      return;
    }

    const result = await transitionApplication({
      profileId,
      allowedFrom: REVIEWABLE_STATUSES,
      expectedStatus: parsed.data.expectedStatus,
      toStatus: "changes_requested",
      eventType: "changes_requested",
      patch: {
        isApproved: false,
        isVerified: false,
        rejectionReason: parsed.data.message,
        reviewedAt: new Date(),
      },
      applicantMessage: parsed.data.message,
      internalNote: parsed.data.internalNote ?? null,
      conflictMessage: "This application is no longer awaiting review",
    });
    if (!result.ok) {
      res.status(result.status).json({ message: result.message, currentStatus: result.currentStatus });
      return;
    }

    await notifyApplicant(req, result.profile, {
      title: "Update needed for your venue application",
      body: `We need a change before approving "${result.profile.businessName}": ${parsed.data.message}`,
      type: "venue_owner_changes_requested",
    });

    res.json({ profile: serializeApplicationProfile(result.profile) });
  },
);

/**
 * POST /admin/venue-owner/applications/:id/withdraw
 * Administrative withdrawal (duplicate submission, applicant asked by email,
 * spam). Terminal, and releases the venue for a future claim.
 */
router.post(
  "/admin/venue-owner/applications/:id/withdraw",
  requireAdminSession,
  async (req: Request, res: Response): Promise<void> => {
    const profileId = parseProfileId(req.params["id"]);
    if (profileId === null) {
      res.status(400).json({ message: "Invalid profile id" });
      return;
    }
    const parsed = z
      .object({
        reason: z.string().trim().min(3).max(500),
        internalNote: reviewNoteSchema.optional(),
        expectedStatus: z.enum(venueApplicationStatuses).optional(),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ message: "A withdrawal reason of at least 3 characters is required" });
      return;
    }

    const result = await transitionApplication({
      profileId,
      allowedFrom: [...REVIEWABLE_STATUSES, "changes_requested"],
      expectedStatus: parsed.data.expectedStatus,
      toStatus: "withdrawn",
      eventType: "withdrawn",
      patch: {
        isApproved: false,
        isVerified: false,
        withdrawnAt: new Date(),
      },
      applicantMessage: parsed.data.reason,
      internalNote: parsed.data.internalNote ?? null,
      conflictMessage: "This application can no longer be withdrawn",
    });
    if (!result.ok) {
      res.status(result.status).json({ message: result.message, currentStatus: result.currentStatus });
      return;
    }

    await notifyApplicant(req, result.profile, {
      title: "Venue application withdrawn",
      body: `Your venue application for "${result.profile.businessName}" was withdrawn. Reason: ${parsed.data.reason}`,
      type: "venue_owner_withdrawn",
    });

    res.json({ profile: serializeApplicationProfile(result.profile) });
  },
);

/**
 * POST /admin/venue-owner/applications/:id/notes
 * Records an internal reviewer note without changing the application state.
 * Never surfaced to the applicant.
 */
router.post(
  "/admin/venue-owner/applications/:id/notes",
  requireAdminSession,
  async (req: Request, res: Response): Promise<void> => {
    const profileId = parseProfileId(req.params["id"]);
    if (profileId === null) {
      res.status(400).json({ message: "Invalid profile id" });
      return;
    }
    const parsed = z.object({ internalNote: reviewNoteSchema }).safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ message: "An internal note is required" });
      return;
    }

    const [profile] = await db
      .select()
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.id, profileId))
      .limit(1);
    if (!profile) {
      res.status(404).json({ message: "Application not found" });
      return;
    }

    await appendApplicationHistory({
      venueOwnerProfileId: profile.id,
      eventType: "review_note_added",
      fromStatus: profile.applicationStatus as VenueApplicationStatus,
      toStatus: profile.applicationStatus as VenueApplicationStatus,
      actorRole: "admin",
      internalNote: parsed.data.internalNote,
    });

    res.status(201).json({ profile: serializeApplicationProfile(profile) });
  },
);

export default router;
