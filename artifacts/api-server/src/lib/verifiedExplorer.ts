import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db, hubCheckinsTable, reviewsTable } from "@workspace/db";

export const VERIFIED_EXPLORER_REQUIREMENTS = {
  distinctVenues: 5,
  positiveMeetingReviews: 10,
} as const;

export type VerifiedExplorerStatus = {
  isVerifiedExplorer: boolean;
  distinctVenues: number;
  positiveMeetingReviews: number;
  requirements: typeof VERIFIED_EXPLORER_REQUIREMENTS;
};

export function buildVerifiedExplorerStatus(
  counts: Omit<VerifiedExplorerStatus, "isVerifiedExplorer" | "requirements">,
): VerifiedExplorerStatus {
  return {
    ...counts,
    isVerifiedExplorer:
      counts.distinctVenues >= VERIFIED_EXPLORER_REQUIREMENTS.distinctVenues &&
      counts.positiveMeetingReviews >= VERIFIED_EXPLORER_REQUIREMENTS.positiveMeetingReviews,
    requirements: VERIFIED_EXPLORER_REQUIREMENTS,
  };
}

/**
 * Explorer status is a transparent checklist, not a weighted score. Every
 * server-recorded venue check-in source counts, including QR, but QR is not
 * required. Counts are cumulative. Meeting reviews are only writable after the
 * existing encounter and co-location checks in POST /reviews.
 */
export async function getVerifiedExplorerStatuses(
  userUids: readonly string[],
): Promise<Map<string, VerifiedExplorerStatus>> {
  const uids = [...new Set(userUids.filter(Boolean))];
  if (uids.length === 0) return new Map();

  const [venueRows, reviewRows] = await Promise.all([
    db
      .select({
        userUid: hubCheckinsTable.userUid,
        count: sql<number>`COUNT(DISTINCT ${hubCheckinsTable.placeId})::int`,
      })
      .from(hubCheckinsTable)
      .where(inArray(hubCheckinsTable.userUid, uids))
      .groupBy(hubCheckinsTable.userUid),
    db
      .select({
        userUid: reviewsTable.receiverUid,
        count: sql<number>`COUNT(DISTINCT ${reviewsTable.reviewerUid})::int`,
      })
      .from(reviewsTable)
      .where(and(
        inArray(reviewsTable.receiverUid, uids),
        eq(reviewsTable.context, "meeting"),
        gte(reviewsTable.starRating, 4),
      ))
      .groupBy(reviewsTable.receiverUid),
  ]);

  const venueCounts = new Map(venueRows.map((row) => [row.userUid, Number(row.count)]));
  const reviewCounts = new Map(reviewRows.map((row) => [row.userUid, Number(row.count)]));
  return new Map(uids.map((uid) => [uid, buildVerifiedExplorerStatus({
    distinctVenues: venueCounts.get(uid) ?? 0,
    positiveMeetingReviews: reviewCounts.get(uid) ?? 0,
  })]));
}
