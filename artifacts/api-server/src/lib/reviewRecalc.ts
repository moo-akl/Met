import { and, eq, isNotNull } from "drizzle-orm";
import { db, reviewsTable, userStatsTable } from "@workspace/db";

/**
 * Recomputes averageRating, reviewCount, and communityStanding for a single
 * user by reading all current review rows where receiverUid matches.
 *
 * Called after:
 *   - a new review is submitted (POST /api/reviews)
 *   - a connection is removed (POST /api/connections/remove) — so that reviews
 *     written during the connection are purged from the receiver's standing.
 *
 * Weight = reviewer trust_score / 100 (defaults to 1.0 when no stats row).
 * communityStanding normalises the weighted avg (1–5) to 0–100.
 */
export async function recalcUserRating(receiverUid: string): Promise<void> {
  const rawReviews = await db
    .select({
      starRating: reviewsTable.starRating,
      reviewerUid: reviewsTable.reviewerUid,
    })
    .from(reviewsTable)
    .where(
      and(
        eq(reviewsTable.receiverUid, receiverUid),
        isNotNull(reviewsTable.starRating),
      ),
    );
  // Drizzle chain objects are not iterable in test mocks — guard defensively.
  const starReviews = Array.isArray(rawReviews) ? rawReviews : [];

  let weightedSum = 0;
  let weightTotal = 0;
  for (const row of starReviews) {
    if (row.starRating === null) continue;
    const [rStats] = await db
      .select({ trustScore: userStatsTable.trustScore })
      .from(userStatsTable)
      .where(eq(userStatsTable.userUid, row.reviewerUid))
      .limit(1);
    const w = (rStats?.trustScore ?? 100) / 100;
    weightedSum += row.starRating * w;
    weightTotal += w;
  }

  const newAvgRating = weightTotal > 0 ? weightedSum / weightTotal : 0;
  const newReviewCount = starReviews.length;
  const communityStanding = newAvgRating > 0 ? ((newAvgRating - 1) / 4) * 100 : 0;

  const [statsRow] = await db
    .select()
    .from(userStatsTable)
    .where(eq(userStatsTable.userUid, receiverUid))
    .limit(1);

  if (statsRow) {
    await db
      .update(userStatsTable)
      .set({
        averageRating: String(parseFloat(newAvgRating.toFixed(2))),
        reviewCount: newReviewCount,
        communityStanding,
        updatedAt: new Date(),
      })
      .where(eq(userStatsTable.userUid, receiverUid));
  } else {
    await db.insert(userStatsTable).values({
      userUid: receiverUid,
      hubStreaks: {},
      trustScore: 100,
      averageRating: String(parseFloat(newAvgRating.toFixed(2))),
      reviewCount: newReviewCount,
      communityStanding,
    });
  }
}
