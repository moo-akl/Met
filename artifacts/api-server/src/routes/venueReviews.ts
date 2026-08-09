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
import { and, desc, eq, sql } from "drizzle-orm";
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

router.get(
  "/hubs/:placeId/reviews",
  requireUid,
  async (req, res): Promise<void> => {
    const { placeId } = req.params as { placeId: string };

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
      .where(eq(venueReviewsTable.placeId, placeId))
      .orderBy(desc(venueReviewsTable.createdAt))
      .limit(20);

    const total = rows.length;
    const averageRating =
      total > 0
        ? Math.round(
            (rows.reduce((s, r) => s + r.starRating, 0) / total) * 10,
          ) / 10
        : null;

    res.json({ reviews: rows, averageRating, total });
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
