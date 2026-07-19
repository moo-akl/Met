/**
 * Business Partner routes
 *
 * GET  /api/business/:placeId        — get business profile + events by hub place ID
 * POST /api/business                 — create a new business profile
 * PUT  /api/business/:id             — update business profile (owner only)
 * POST /api/business/:id/events      — create an event
 * GET  /api/business/:id/events      — list events (upcoming first)
 * PUT  /api/business/:id/events/:eventId — update an event (owner only)
 * DELETE /api/business/:id/events/:eventId — delete an event (owner only)
 * POST /api/business/:id/reviews     — create/upsert a business review
 * GET  /api/business/:id/reviews     — list reviews with avg rating
 * GET  /api/business/:id/my-checkin  — whether the caller has ever checked in at this hub
 */

import { Router, type IRouter } from "express";
import { eq, and, desc, asc, avg, count, sql, gte } from "drizzle-orm";
import {
  db,
  businessProfilesTable,
  businessEventsTable,
  businessReviewsTable,
  hubCheckinsTable,
} from "@workspace/db";
import { requireUid } from "../middlewares/requireUid";
import { logger } from "../lib/logger";
import { z } from "zod/v4";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const CreateBusinessBody = z.object({
  placeId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  logoUrl: z.string().url().optional(),
  mediaUrls: z.array(z.string().url()).max(6).optional(),
  salesAgentId: z.string().optional(),
});

const UpdateBusinessBody = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).optional(),
  logoUrl: z.string().url().nullable().optional(),
  mediaUrls: z.array(z.string().url()).max(6).optional(),
  salesAgentId: z.string().nullable().optional(),
});

const CreateEventBody = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

const UpdateEventBody = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url().nullable().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

const CreateReviewBody = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getBusinessById(businessId: string) {
  const [biz] = await db
    .select()
    .from(businessProfilesTable)
    .where(eq(businessProfilesTable.businessId, businessId))
    .limit(1);
  return biz ?? null;
}

async function getEventsForBusiness(businessId: string) {
  return db
    .select()
    .from(businessEventsTable)
    .where(eq(businessEventsTable.businessId, businessId))
    .orderBy(
      // Upcoming events (start_time >= NOW) appear first, sorted soonest first.
      // Past events appear after, sorted most-recently-started first.
      sql`CASE WHEN ${businessEventsTable.startTime} >= NOW() THEN 0 ELSE 1 END`,
      sql`CASE WHEN ${businessEventsTable.startTime} >= NOW() THEN ${businessEventsTable.startTime} END NULLS LAST`,
      desc(businessEventsTable.startTime),
    )
    .limit(50);
}

// ---------------------------------------------------------------------------
// GET /api/business/places-search?q=...
// Proxy for Google Places Text Search. Returns up to 5 place suggestions.
// Requires the authenticated user (requireUid). Does not require admin.
// ---------------------------------------------------------------------------

router.get(
  "/business/places-search",
  requireUid,
  async (req, res): Promise<void> => {
    const q = String(req.query["q"] ?? "").trim();
    if (!q) {
      res.status(400).json({ message: "q param required" });
      return;
    }
    const apiKey = process.env["GOOGLE_API_KEY"];
    if (!apiKey) {
      res.json({ places: [] });
      return;
    }
    try {
      const resp = await fetch(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
          },
          body: JSON.stringify({ textQuery: q, maxResultCount: 5 }),
        },
      );
      if (!resp.ok) {
        res.json({ places: [] });
        return;
      }
      const data = (await resp.json()) as {
        places?: Array<{ id?: string; displayName?: { text?: string }; formattedAddress?: string }>;
      };
      const places = (data.places ?? []).map((p) => ({
        placeId: p.id ?? "",
        name: p.displayName?.text ?? "Unknown",
        address: p.formattedAddress ?? "",
      }));
      res.json({ places });
    } catch {
      res.json({ places: [] });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/business/mine
// Returns all business profiles owned by the authenticated user (with events).
// Must be registered BEFORE GET /api/business/:placeId to avoid Express
// matching "mine" as a :placeId param.
// ---------------------------------------------------------------------------

router.get(
  "/business/mine",
  requireUid,
  async (req, res): Promise<void> => {
    const uid = req.uid!;
    const businesses = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.ownerId, uid))
      .orderBy(asc(businessProfilesTable.createdAt));

    const withEvents = await Promise.all(
      businesses.map(async (biz) => ({
        ...biz,
        events: await getEventsForBusiness(biz.businessId),
      })),
    );

    res.json({ businesses: withEvents });
  },
);

// ---------------------------------------------------------------------------
// GET /api/business/:placeId
// Returns the active business profile (with upcoming events) for a hub.
// Open to any authenticated user.
// ---------------------------------------------------------------------------

router.get(
  "/business/:placeId",
  requireUid,
  async (req, res): Promise<void> => {
    const { placeId } = req.params as { placeId: string };

    const [biz] = await db
      .select()
      .from(businessProfilesTable)
      .where(eq(businessProfilesTable.placeId, placeId))
      .limit(1);

    if (!biz) {
      res.status(404).json({ message: "No business profile for this hub" });
      return;
    }

    const events = await getEventsForBusiness(biz.businessId);

    res.json({ ...biz, events });
  },
);

// ---------------------------------------------------------------------------
// POST /api/business
// Create a new business profile. The authenticated user becomes the owner.
// ---------------------------------------------------------------------------

router.post(
  "/business",
  requireUid,
  async (req, res): Promise<void> => {
    const uid = req.uid!;
    const parsed = CreateBusinessBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request body", errors: parsed.error.issues });
      return;
    }

    const { placeId, name, description, logoUrl, mediaUrls, salesAgentId } = parsed.data;

    // One business per owner per place
    const [existing] = await db
      .select({ businessId: businessProfilesTable.businessId })
      .from(businessProfilesTable)
      .where(
        and(
          eq(businessProfilesTable.ownerId, uid),
          eq(businessProfilesTable.placeId, placeId),
        ),
      )
      .limit(1);

    if (existing) {
      res.status(409).json({ message: "You already have a business registered at this hub" });
      return;
    }

    const [created] = await db
      .insert(businessProfilesTable)
      .values({
        ownerId: uid,
        placeId,
        name,
        description,
        logoUrl,
        mediaUrls: mediaUrls ?? [],
        salesAgentId,
      })
      .returning();

    logger.info({ uid, businessId: created?.businessId, placeId }, "Business profile created");
    res.status(201).json(created);
  },
);

// ---------------------------------------------------------------------------
// PUT /api/business/:id
// Update name, description, logo, media, and salesAgentId. Owner only.
// ---------------------------------------------------------------------------

router.put(
  "/business/:id",
  requireUid,
  async (req, res): Promise<void> => {
    const uid = req.uid!;
    const { id } = req.params as { id: string };

    const biz = await getBusinessById(id);
    if (!biz) {
      res.status(404).json({ message: "Business not found" });
      return;
    }
    if (biz.ownerId !== uid) {
      res.status(403).json({ message: "Not the business owner" });
      return;
    }

    const parsed = UpdateBusinessBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request body", errors: parsed.error.issues });
      return;
    }

    const updates: Partial<typeof biz> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.logoUrl !== undefined) updates.logoUrl = parsed.data.logoUrl ?? null;
    if (parsed.data.mediaUrls !== undefined) updates.mediaUrls = parsed.data.mediaUrls;
    if (parsed.data.salesAgentId !== undefined) updates.salesAgentId = parsed.data.salesAgentId ?? null;

    const [updated] = await db
      .update(businessProfilesTable)
      .set(updates)
      .where(eq(businessProfilesTable.businessId, id))
      .returning();

    res.json(updated);
  },
);

// ---------------------------------------------------------------------------
// GET /api/business/:id/events
// List events for a business, upcoming first.
// ---------------------------------------------------------------------------

router.get(
  "/business/:id/events",
  requireUid,
  async (req, res): Promise<void> => {
    const { id } = req.params as { id: string };

    const biz = await getBusinessById(id);
    if (!biz) {
      res.status(404).json({ message: "Business not found" });
      return;
    }

    const events = await getEventsForBusiness(id);
    res.json({ events });
  },
);

// ---------------------------------------------------------------------------
// POST /api/business/:id/events
// Create an event. Owner only.
// ---------------------------------------------------------------------------

router.post(
  "/business/:id/events",
  requireUid,
  async (req, res): Promise<void> => {
    const uid = req.uid!;
    const { id } = req.params as { id: string };

    const biz = await getBusinessById(id);
    if (!biz) {
      res.status(404).json({ message: "Business not found" });
      return;
    }
    if (biz.ownerId !== uid) {
      res.status(403).json({ message: "Not the business owner" });
      return;
    }

    const parsed = CreateEventBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request body", errors: parsed.error.issues });
      return;
    }

    const { title, description, imageUrl, startTime, endTime } = parsed.data;

    if (new Date(endTime) <= new Date(startTime)) {
      res.status(400).json({ message: "endTime must be after startTime" });
      return;
    }

    const [event] = await db
      .insert(businessEventsTable)
      .values({
        businessId: id,
        title,
        description,
        imageUrl,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
      })
      .returning();

    res.status(201).json(event);
  },
);

// ---------------------------------------------------------------------------
// PUT /api/business/:id/events/:eventId
// Update an event. Owner only.
// ---------------------------------------------------------------------------

router.put(
  "/business/:id/events/:eventId",
  requireUid,
  async (req, res): Promise<void> => {
    const uid = req.uid!;
    const { id, eventId } = req.params as { id: string; eventId: string };

    const biz = await getBusinessById(id);
    if (!biz) {
      res.status(404).json({ message: "Business not found" });
      return;
    }
    if (biz.ownerId !== uid) {
      res.status(403).json({ message: "Not the business owner" });
      return;
    }

    const parsed = UpdateEventBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request body", errors: parsed.error.issues });
      return;
    }

    const { title, description, imageUrl, startTime, endTime } = parsed.data;

    if (startTime && endTime && new Date(endTime) <= new Date(startTime)) {
      res.status(400).json({ message: "endTime must be after startTime" });
      return;
    }

    const updateValues: Record<string, unknown> = {};
    if (title !== undefined) updateValues["title"] = title;
    if (description !== undefined) updateValues["description"] = description;
    if (imageUrl !== undefined) updateValues["imageUrl"] = imageUrl;
    if (startTime !== undefined) updateValues["startTime"] = new Date(startTime);
    if (endTime !== undefined) updateValues["endTime"] = new Date(endTime);

    if (Object.keys(updateValues).length === 0) {
      res.status(400).json({ message: "No fields to update" });
      return;
    }

    const [updated] = await db
      .update(businessEventsTable)
      .set(updateValues)
      .where(
        and(
          eq(businessEventsTable.eventId, parseInt(eventId, 10)),
          eq(businessEventsTable.businessId, id),
        ),
      )
      .returning();

    if (!updated) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    res.json(updated);
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/business/:id/events/:eventId
// Delete an event. Owner only.
// ---------------------------------------------------------------------------

router.delete(
  "/business/:id/events/:eventId",
  requireUid,
  async (req, res): Promise<void> => {
    const uid = req.uid!;
    const { id, eventId } = req.params as { id: string; eventId: string };

    const biz = await getBusinessById(id);
    if (!biz) {
      res.status(404).json({ message: "Business not found" });
      return;
    }
    if (biz.ownerId !== uid) {
      res.status(403).json({ message: "Not the business owner" });
      return;
    }

    await db
      .delete(businessEventsTable)
      .where(
        and(
          eq(businessEventsTable.eventId, parseInt(eventId, 10)),
          eq(businessEventsTable.businessId, id),
        ),
      );

    res.json({ deleted: true });
  },
);

// ---------------------------------------------------------------------------
// GET /api/business/:id/reviews
// List reviews with average rating (paginated, 20 per page).
// ---------------------------------------------------------------------------

router.get(
  "/business/:id/reviews",
  requireUid,
  async (req, res): Promise<void> => {
    const { id } = req.params as { id: string };
    const page = Math.max(1, parseInt(String(req.query["page"] ?? "1"), 10));
    const limit = 20;
    const offset = (page - 1) * limit;

    const biz = await getBusinessById(id);
    if (!biz) {
      res.status(404).json({ message: "Business not found" });
      return;
    }

    const [{ avgRating, totalReviews }] = await db
      .select({
        avgRating: avg(businessReviewsTable.rating),
        totalReviews: count(businessReviewsTable.reviewId),
      })
      .from(businessReviewsTable)
      .where(eq(businessReviewsTable.businessId, id));

    const reviews = await db
      .select()
      .from(businessReviewsTable)
      .where(eq(businessReviewsTable.businessId, id))
      .orderBy(desc(businessReviewsTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      averageRating: avgRating ? parseFloat(avgRating) : null,
      totalReviews: Number(totalReviews),
      page,
      reviews,
    });
  },
);

// ---------------------------------------------------------------------------
// GET /api/business/:id/my-checkin
// Returns whether the authenticated caller has ever checked in at this
// business hub (i.e. any row in hub_checkins for (userUid, placeId)).
// ---------------------------------------------------------------------------

router.get(
  "/business/:id/my-checkin",
  requireUid,
  async (req, res): Promise<void> => {
    const uid = req.uid!;
    const { id } = req.params as { id: string };

    const biz = await getBusinessById(id);
    if (!biz) {
      res.status(404).json({ message: "Business not found" });
      return;
    }

    const [row] = await db
      .select({ id: hubCheckinsTable.id })
      .from(hubCheckinsTable)
      .where(
        and(
          eq(hubCheckinsTable.userUid, uid),
          eq(hubCheckinsTable.placeId, biz.placeId),
        ),
      )
      .limit(1);

    res.json({ hasCheckedIn: row !== undefined });
  },
);

// ---------------------------------------------------------------------------
// POST /api/business/:id/reviews
// Upsert a review. One per user per business.
// ---------------------------------------------------------------------------

router.post(
  "/business/:id/reviews",
  requireUid,
  async (req, res): Promise<void> => {
    const uid = req.uid!;
    const { id } = req.params as { id: string };

    const biz = await getBusinessById(id);
    if (!biz) {
      res.status(404).json({ message: "Business not found" });
      return;
    }

    if (biz.ownerId === uid) {
      res.status(403).json({ message: "Business owners cannot review their own hub" });
      return;
    }

    const parsed = CreateReviewBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid request body", errors: parsed.error.issues });
      return;
    }

    const { rating, comment } = parsed.data;

    const [review] = await db
      .insert(businessReviewsTable)
      .values({ businessId: id, reviewerId: uid, rating, comment })
      .onConflictDoUpdate({
        target: [businessReviewsTable.businessId, businessReviewsTable.reviewerId],
        set: {
          rating,
          comment,
          createdAt: sql`now()`,
        },
      })
      .returning();

    res.json(review);
  },
);

export default router;
