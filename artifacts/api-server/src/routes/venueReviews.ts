/**
 * Venue review routes
 *
 * POST /api/hubs/:placeId/review      — submit or update a star rating
 * GET  /api/hubs/:placeId/reviews     — list reviews + average for a venue
 * GET  /api/hubs/:placeId/my-review   — caller's own review for this venue
 *
 * Only users who have scanned the venue QR code (venueQrVerificationsTable)
 * are allowed to submit a review. Subsequent submissions update in place via
 * UPSERT on the (user_uid, place_id) unique index.
 */

import { Router, type IRouter } from "express";
import { and, avg, count, desc, eq, sql, inArray } from "drizzle-orm";
import {
  db,
  profilesTable,
  venueQrVerificationsTable,
  venueReviewsTable,
} from "@workspace/db";
import { requireUid } from "../middlewares/requireUid";
import { z } from "zod";

const router: IRouter = Router();

const reviewBodySchema = z.object({
  starRating: z.number().int().min(1).max(5),
  comment: z.string().max(500).nullable().optional(),
});

// ── POST /hubs/:placeId/review ─────────────────────────────────────────────

router.post(
  "/hubs/:placeId/review",
  requireUid,
  async (req, res): Promise<void> => {
    const { placeId } = req.params as { placeId: string };
    const uid = req.uid!;

    const parsed = reviewBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid review data" });
      return;
    }
    const { starRating, comment } = parsed.data;

    // Require at least one QR-verified check-in at this venue.
    const [verified] = await db
      .select({ id: venueQrVerificationsTable.id })
      .from(venueQrVerificationsTable)
      .where(
        and(
          eq(venueQrVerificationsTable.userUid, uid),
          eq(venueQrVerificationsTable.placeId, placeId),
        ),
      )
      .limit(1);

    if (!verified) {
      res.status(403).json({
        error: "You must scan the venue QR code before leaving a review",
      });
      return;
    }

    const [review] = await db
      .insert(venueReviewsTable)
      .values({ userUid: uid, placeId, starRating, comment: comment ?? null })
      .onConflictDoUpdate({
        target: [venueReviewsTable.userUid, venueReviewsTable.placeId],
        set: {
          starRating,
          comment: comment ?? null,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    res.json({ review });
  },
);

// ── GET /hubs/:placeId/reviews ─────────────────────────────────────────────
// Public endpoint — no authentication required. Any caller (guest or
// authenticated user) may view a venue's reviews and aggregate score.
//
// Optional query param:
//   starRating=1..5  — filter the returned list to only that star tier.
//                      The aggregate (averageRating, total, ratingCounts)
//                      always reflects the full venue, not the filtered page.

router.get(
  "/hubs/:placeId/reviews",
  async (req, res): Promise<void> => {
    const { placeId } = req.params as { placeId: string };

    // Parse optional starRating filter (1–5).
    const rawStar = req.query["starRating"];
    const starFilter =
      typeof rawStar === "string" && /^[1-5]$/.test(rawStar)
        ? parseInt(rawStar, 10)
        : null;

    // Compute venue-wide aggregate stats (always unfiltered).
    const [agg] = await db
      .select({
        total: count(),
        averageRating: avg(venueReviewsTable.starRating),
      })
      .from(venueReviewsTable)
      .where(eq(venueReviewsTable.placeId, placeId));

    const total = agg?.total ?? 0;
    const averageRating =
      total > 0 && agg?.averageRating != null
        ? Math.round(Number(agg.averageRating) * 10) / 10
        : null;

    // Per-rating counts across the whole venue (not page-limited).
    const countRows = await db
      .select({
        starRating: venueReviewsTable.starRating,
        cnt: count(),
      })
      .from(venueReviewsTable)
      .where(eq(venueReviewsTable.placeId, placeId))
      .groupBy(venueReviewsTable.starRating);

    const ratingCounts: Record<number, number> = {};
    for (const row of countRows) {
      ratingCounts[row.starRating] = row.cnt;
    }

    // Return the 20 most recent reviews, optionally filtered by star rating.
    const listWhere =
      starFilter !== null
        ? and(
            eq(venueReviewsTable.placeId, placeId),
            eq(venueReviewsTable.starRating, starFilter),
          )
        : eq(venueReviewsTable.placeId, placeId);

    const rows = await db
      .select({
        id: venueReviewsTable.id,
        starRating: venueReviewsTable.starRating,
        comment: venueReviewsTable.comment,
        createdAt: venueReviewsTable.createdAt,
        displayName: profilesTable.displayName,
        photoUrl: profilesTable.photoUrl,
      })
      .from(venueReviewsTable)
      .innerJoin(
        profilesTable,
        eq(venueReviewsTable.userUid, profilesTable.uid),
      )
      .where(listWhere)
      .orderBy(desc(venueReviewsTable.createdAt))
      .limit(20);

    res.json({ reviews: rows, averageRating, total, ratingCounts });
  },
);

// ── GET /hubs/:placeId/my-review ───────────────────────────────────────────

router.get(
  "/hubs/:placeId/my-review",
  requireUid,
  async (req, res): Promise<void> => {
    const { placeId } = req.params as { placeId: string };
    const uid = req.uid!;

    const [review] = await db
      .select()
      .from(venueReviewsTable)
      .where(
        and(
          eq(venueReviewsTable.userUid, uid),
          eq(venueReviewsTable.placeId, placeId),
        ),
      )
      .limit(1);

    res.json({ review: review ?? null });
  },
);

export default router;
