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
  ne,
} from "drizzle-orm";
import {
  db,
  venueOwnerProfilesTable,
  venueEventsTable,
  venueEventRsvpsTable,
  venueRewardsTable,
  venueAnnouncementsTable,
  hubCheckinsTable,
  profilesTable,
} from "@workspace/db";
import { requireUid } from "../middlewares/requireUid";
import { createUserRateLimiter } from "../middlewares/rateLimit";
import { sendPush } from "../lib/push";
import { logger } from "../lib/logger";
import { z } from "zod/v4";
import crypto from "node:crypto";

const router: IRouter = Router();
const ADMIN_SESSION_COOKIE = "met_venue_admin";
const ADMIN_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

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

/** Guards admin-only endpoints: X-Admin-Secret header must match ADMIN_SECRET env. */
function requireAdminSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env["ADMIN_SECRET"];
  if (!secret) {
    res.status(503).json({ message: "Admin endpoints are not enabled" });
    return;
  }
  if (req.header("x-admin-secret") !== secret) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

function hasValidAdminSession(req: Request): boolean {
  if (!process.env["SESSION_SECRET"]) return false;
  const rawExpiry = req.signedCookies?.[ADMIN_SESSION_COOKIE];
  const expiresAt = typeof rawExpiry === "string" ? Number(rawExpiry) : NaN;
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function requireAdminSession(req: Request, res: Response, next: NextFunction): void {
  if (!process.env["SESSION_SECRET"]) {
    res.status(503).json({ message: "Admin sessions are not enabled" });
    return;
  }
  if (!hasValidAdminSession(req)) {
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

    const schema = z.object({
      placeId: z.string().min(1),
      placeName: z.string().min(1),
      businessName: z.string().min(1),
      lat: z.string().optional(),
      lng: z.string().optional(),
      tagline: z.string().max(160).optional(),
      description: z.string().max(1000).optional(),
      verificationDocUrl: z.string().url().optional(),
      registrationNotes: z.string().max(500).optional(),
    });

    const parsed = schema.safeParse(req.body);
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

    // Check if placeId is already claimed (any non-expired profile)
    const placeConflict = await db
      .select({ id: venueOwnerProfilesTable.id })
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.placeId, data.placeId))
      .limit(1);
    if (placeConflict.length > 0) {
      res.status(409).json({ message: "This venue is already claimed" });
      return;
    }

    const [profile] = await db
      .insert(venueOwnerProfilesTable)
      .values({
        ownerUid: uid,
        placeId: data.placeId,
        placeName: data.placeName,
        businessName: data.businessName,
        lat: data.lat,
        lng: data.lng,
        tagline: data.tagline ?? null,
        description: data.description ?? null,
        verificationDocUrl: data.verificationDocUrl ?? null,
        registrationNotes: data.registrationNotes ?? null,
        isApproved: false,
        isVerified: false,
      })
      .returning();

    res.status(201).json({ profile });
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
    res.json({ profile });
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
 * Deletes pending (unapproved) venue owner profiles older than 14 days so
 * the locked placeId is released back into the pool.
 */
router.post(
  "/venue-owner/expire-pending-claims",
  requireCronSecret,
  async (_req: Request, res: Response) => {
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const expired = await db
      .select({ id: venueOwnerProfilesTable.id, placeId: venueOwnerProfilesTable.placeId })
      .from(venueOwnerProfilesTable)
      .where(
        and(
          eq(venueOwnerProfilesTable.isApproved, false),
          lt(venueOwnerProfilesTable.createdAt, cutoff),
        ),
      );

    if (expired.length > 0) {
      const ids = expired.map((e) => e.id);
      await db
        .delete(venueOwnerProfilesTable)
        .where(sql`${venueOwnerProfilesTable.id} = ANY(${ids})`);
    }

    logger.info({ count: expired.length }, "Expired pending venue owner claims");
    res.json({ expired: expired.length, placeIds: expired.map((e) => e.placeId) });
  },
);

// ---------------------------------------------------------------------------
// Admin endpoints
// ---------------------------------------------------------------------------

/**
 * POST /admin/venue-owner/session
 * Validates the server-held admin credential, then stores only a signed expiry
 * timestamp in an HttpOnly cookie. The credential never reaches browser storage.
 */
router.post(
  "/admin/venue-owner/session",
  async (req: Request, res: Response): Promise<void> => {
    const schema = z.object({ secret: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    const expected = process.env["ADMIN_SECRET"];

    if (!expected) {
      res.status(503).json({ message: "Admin endpoints are not enabled" });
      return;
    }
    if (!process.env["SESSION_SECRET"]) {
      res.status(503).json({ message: "Admin sessions are not enabled" });
      return;
    }
    if (!parsed.success || !adminSecretsMatch(parsed.data.secret, expected)) {
      res.status(401).json({ message: "Invalid admin credential" });
      return;
    }

    const expiresAt = Date.now() + ADMIN_SESSION_MAX_AGE_MS;
    res.cookie(ADMIN_SESSION_COOKIE, String(expiresAt), adminSessionOptions(req));
    res.json({ authenticated: true, expiresAt: new Date(expiresAt).toISOString() });
  },
);

/**
 * GET /admin/venue-owner/session
 */
router.get(
  "/admin/venue-owner/session",
  (req: Request, res: Response): void => {
    if (!hasValidAdminSession(req)) {
      res.status(401).json({ message: "No active admin session" });
      return;
    }
    const expiresAt = Number(req.signedCookies?.[ADMIN_SESSION_COOKIE]);
    res.json({ authenticated: true, expiresAt: new Date(expiresAt).toISOString() });
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

/**
 * GET /admin/venue-owner/applications
 */
router.get(
  "/admin/venue-owner/applications",
  requireAdminSession,
  async (_req: Request, res: Response): Promise<void> => {
    const pending = await db
      .select()
      .from(venueOwnerProfilesTable)
      .where(and(eq(venueOwnerProfilesTable.isApproved, false), isNull(venueOwnerProfilesTable.rejectionReason)))
      .orderBy(venueOwnerProfilesTable.createdAt);
    res.json({ pending });
  },
);

/**
 * POST /admin/venue-owner/applications/:id/approve
 */
router.post(
  "/admin/venue-owner/applications/:id/approve",
  requireAdminSession,
  async (req: Request, res: Response): Promise<void> => {
    const profileId = parseInt(String(req.params["id"] ?? ""), 10);
    if (isNaN(profileId)) {
      res.status(400).json({ message: "Invalid profile id" });
      return;
    }

    const [existing] = await db
      .select()
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.id, profileId))
      .limit(1);
    if (!existing) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    const [updated] = await db
      .update(venueOwnerProfilesTable)
      .set({ isApproved: true, isVerified: true, rejectionReason: null, updatedAt: new Date() })
      .where(eq(venueOwnerProfilesTable.id, profileId))
      .returning();

    try {
      await sendPush(existing.ownerUid, {
        title: "Venue approved",
        body: `Your venue "${existing.businessName}" has been approved. You can now create events, rewards, and announcements.`,
        data: { type: "venue_owner_approved", placeId: existing.placeId },
      });
    } catch {
      req.log?.warn({ profileId }, "Venue approval notification could not be delivered");
    }

    res.json({ profile: updated });
  },
);

/**
 * POST /admin/venue-owner/applications/:id/reject
 */
router.post(
  "/admin/venue-owner/applications/:id/reject",
  requireAdminSession,
  async (req: Request, res: Response): Promise<void> => {
    const profileId = parseInt(String(req.params["id"] ?? ""), 10);
    const parsed = z.object({ reason: z.string().trim().min(3).max(500) }).safeParse(req.body);
    if (isNaN(profileId)) {
      res.status(400).json({ message: "Invalid profile id" });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ message: "A rejection reason of at least 3 characters is required" });
      return;
    }

    const [existing] = await db
      .select()
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.id, profileId))
      .limit(1);
    if (!existing) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    const [updated] = await db
      .update(venueOwnerProfilesTable)
      .set({ isApproved: false, rejectionReason: parsed.data.reason, updatedAt: new Date() })
      .where(eq(venueOwnerProfilesTable.id, profileId))
      .returning();

    try {
      await sendPush(existing.ownerUid, {
        title: "Venue application update",
        body: `Your venue application for "${existing.businessName}" was not approved. Reason: ${parsed.data.reason}`,
        data: { type: "venue_owner_rejected", placeId: existing.placeId },
      });
    } catch {
      req.log?.warn({ profileId }, "Venue rejection notification could not be delivered");
    }

    res.json({ profile: updated });
  },
);

/**
 * GET /admin/venue-owner/pending
 */
router.get(
  "/admin/venue-owner/pending",
  requireAdminSecret,
  async (_req: Request, res: Response) => {
    const pending = await db
      .select()
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.isApproved, false))
      .orderBy(venueOwnerProfilesTable.createdAt);
    res.json({ pending });
  },
);

/**
 * POST /admin/venue-owner/approve/:id
 */
router.post(
  "/admin/venue-owner/approve/:id",
  requireAdminSecret,
  async (req: Request, res: Response) => {
    const profileId = parseInt(String(req.params["id"] ?? ""), 10);
    if (isNaN(profileId)) {
      res.status(400).json({ message: "Invalid profile id" });
      return;
    }

    const [existing] = await db
      .select()
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.id, profileId))
      .limit(1);
    if (!existing) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    const [updated] = await db
      .update(venueOwnerProfilesTable)
      .set({ isApproved: true, isVerified: true, rejectionReason: null, updatedAt: new Date() })
      .where(eq(venueOwnerProfilesTable.id, profileId))
      .returning();

    // Notify the owner
    try {
      await sendPush(existing.ownerUid, {
        title: "✅ Venue approved!",
        body: `Your venue "${existing.businessName}" has been approved. You can now create events, rewards, and announcements.`,
        data: { type: "venue_owner_approved", placeId: existing.placeId },
      });
    } catch {}

    res.json({ profile: updated });
  },
);

/**
 * POST /admin/venue-owner/reject/:id
 * Body: { reason?: string }
 */
router.post(
  "/admin/venue-owner/reject/:id",
  requireAdminSecret,
  async (req: Request, res: Response) => {
    const profileId = parseInt(String(req.params["id"] ?? ""), 10);
    if (isNaN(profileId)) {
      res.status(400).json({ message: "Invalid profile id" });
      return;
    }

    const [existing] = await db
      .select()
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.id, profileId))
      .limit(1);
    if (!existing) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    const reason = typeof req.body?.reason === "string" ? req.body.reason : "Your application did not meet our requirements.";

    const [updated] = await db
      .update(venueOwnerProfilesTable)
      .set({ isApproved: false, rejectionReason: reason, updatedAt: new Date() })
      .where(eq(venueOwnerProfilesTable.id, profileId))
      .returning();

    // Notify the owner
    try {
      await sendPush(existing.ownerUid, {
        title: "Venue application update",
        body: `Your venue application for "${existing.businessName}" was not approved. Reason: ${reason}`,
        data: { type: "venue_owner_rejected", placeId: existing.placeId },
      });
    } catch {}

    res.json({ profile: updated });
  },
);

export default router;
