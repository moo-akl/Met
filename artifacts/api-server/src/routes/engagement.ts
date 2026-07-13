/**
 * Engagement & Retention routes — Phase 2
 *
 * POST /api/hubs/checkin          — resolve coords → Google Places, log check-in, update streak
 * GET  /api/hubs/:placeId/leaderboard — top users by check-in count at a venue
 * POST /api/profile-views         — record a profile view + fire "vibe-checked" push (24 h dedup)
 * POST /api/reviews               — submit a peer tag, adjust receiver trust score
 * GET  /api/users/:uid/stats      — hub_streaks + trust_score for any user
 */

import { Router, type IRouter } from "express";
import { eq, and, desc, gte, sql, count, lt, isNull, isNotNull, or, avg } from "drizzle-orm";
import {
  db,
  hubCheckinsTable,
  userStatsTable,
  profileViewsTable,
  reviewsTable,
  profilesTable,
  monthlyChampionsTable,
  subscriptionsTable,
} from "@workspace/db";
import { requireUid } from "../middlewares/requireUid";
import { createUserRateLimiter } from "../middlewares/rateLimit";
import { sendPush } from "../lib/push";
import { logger } from "../lib/logger";
import { getVerifiedTier } from "../lib/revenueCat";
import { z } from "zod/v4";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

const checkinLimit = createUserRateLimiter({
  windowMs: 60_000,
  max: 20,
  name: "user-checkin",
});

const profileViewLimit = createUserRateLimiter({
  windowMs: 60_000,
  max: 60,
  name: "user-profile-view",
});

const reviewWriteLimit = createUserRateLimiter({
  windowMs: 60_000,
  max: 10,
  name: "user-review-write",
});

// ---------------------------------------------------------------------------
// Google Places helpers
// ---------------------------------------------------------------------------

interface PlacesResult {
  placeId: string;
  displayName: string;
}

/**
 * Calls Google Places Nearby Search (New) API to find the nearest venue
 * within 50 m of the given coordinates. Returns null if none found or if
 * the API key is not configured.
 */
async function findNearbyPlace(
  lat: number,
  lng: number,
): Promise<PlacesResult | null> {
  const apiKey = process.env["GOOGLE_API_KEY"];
  if (!apiKey) {
    logger.warn("GOOGLE_API_KEY not set — skipping Places lookup");
    return null;
  }

  try {
    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchNearby",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.location",
        },
        body: JSON.stringify({
          includedTypes: [
            "restaurant",
            "cafe",
            "bar",
            "library",
            "gym",
            "university",
            "shopping_mall",
            "park",
            "museum",
            "movie_theater",
            "transit_station",
          ],
          maxResultCount: 1,
          locationRestriction: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: 50,
            },
          },
          rankPreference: "DISTANCE",
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      logger.warn(
        { status: res.status, body: text.slice(0, 200) },
        "Google Places API error",
      );
      return null;
    }

    const data = (await res.json()) as {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
      }>;
    };

    const place = data.places?.[0];
    if (!place?.id) return null;

    return {
      placeId: place.id,
      displayName: place.displayName?.text ?? "Unknown place",
    };
  } catch (err) {
    logger.warn(
      { err: (err as Error)?.message },
      "Google Places API request failed",
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Streak helpers
// ---------------------------------------------------------------------------

/**
 * Returns the updated streak count for a place given the last check-in date.
 *
 * Rules:
 *   - Same calendar day  → no change (already checked in today)
 *   - Previous day       → increment by 1
 *   - Gap > 1 day        → reset to 1
 */
function computeNewStreak(
  currentStreak: number,
  lastCheckinDate: Date | null,
  today: Date,
): { streak: number; changed: boolean } {
  if (!lastCheckinDate) return { streak: 1, changed: true };

  const todayDay = today.toISOString().slice(0, 10);
  const lastDay = lastCheckinDate.toISOString().slice(0, 10);

  if (todayDay === lastDay) return { streak: currentStreak, changed: false };

  const diffMs = today.getTime() - lastCheckinDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return { streak: currentStreak + 1, changed: true };
  }
  // gap > 1 day → reset
  return { streak: 1, changed: true };
}

// ---------------------------------------------------------------------------
// POST /api/hubs/checkin
// ---------------------------------------------------------------------------

const CheckinBody = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

router.post(
  "/hubs/checkin",
  requireUid,
  checkinLimit,
  async (req, res): Promise<void> => {
    const uid = req.uid!;
    const parsed = CheckinBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "lat and lng are required" });
      return;
    }
    const { lat, lng } = parsed.data;

    // Resolve coordinates → place via Google Places
    const place = await findNearbyPlace(lat, lng);
    if (!place) {
      res
        .status(404)
        .json({ message: "No recognised venue found within 50 m" });
      return;
    }

    const now = new Date();

    // Insert the check-in row
    await db.insert(hubCheckinsTable).values({
      userUid: uid,
      placeId: place.placeId,
      placeName: place.displayName,
      lat: String(lat),
      lng: String(lng),
    });

    // Upsert user_stats streak for this place
    const [stats] = await db
      .select()
      .from(userStatsTable)
      .where(eq(userStatsTable.userUid, uid))
      .limit(1);

    const prevStreaks = (stats?.hubStreaks ?? {}) as Record<string, number>;
    const prevStreak = prevStreaks[place.placeId] ?? 0;

    // Find the last check-in at this place (before now) to compute streak
    const [lastCheckinRow] = await db
      .select({ createdAt: hubCheckinsTable.createdAt })
      .from(hubCheckinsTable)
      .where(
        and(
          eq(hubCheckinsTable.userUid, uid),
          eq(hubCheckinsTable.placeId, place.placeId),
        ),
      )
      .orderBy(desc(hubCheckinsTable.createdAt))
      .limit(2); // first row is the one we just inserted

    // We inserted above, so fetch the second-most-recent for streak logic
    const [, prevCheckinRow] = await db
      .select({ createdAt: hubCheckinsTable.createdAt })
      .from(hubCheckinsTable)
      .where(
        and(
          eq(hubCheckinsTable.userUid, uid),
          eq(hubCheckinsTable.placeId, place.placeId),
        ),
      )
      .orderBy(desc(hubCheckinsTable.createdAt))
      .offset(1)
      .limit(1);

    const { streak } = computeNewStreak(
      prevStreak,
      prevCheckinRow?.createdAt ?? null,
      now,
    );

    const newStreaks = { ...prevStreaks, [place.placeId]: streak };

    if (stats) {
      await db
        .update(userStatsTable)
        .set({ hubStreaks: newStreaks, lastStreakUpdate: now, updatedAt: now })
        .where(eq(userStatsTable.userUid, uid));
    } else {
      await db.insert(userStatsTable).values({
        userUid: uid,
        hubStreaks: newStreaks,
        lastStreakUpdate: now,
        trustScore: 100,
      });
    }

    res.json({
      placeId: place.placeId,
      placeName: place.displayName,
      streak,
    });
  },
);

// ---------------------------------------------------------------------------
// GET /api/hubs/:placeId/leaderboard?period=all_time|current_month
// Returns top 20 users by check-in count at a given place.
// period defaults to "all_time".
// ---------------------------------------------------------------------------

router.get(
  "/hubs/:placeId/leaderboard",
  requireUid,
  async (req, res): Promise<void> => {
    const { placeId } = req.params as { placeId: string };
    const period =
      req.query["period"] === "current_month" ? "current_month" : "all_time";

    // For current_month, filter to rows from start of this month (UTC).
    const monthStart =
      period === "current_month"
        ? new Date(
            Date.UTC(
              new Date().getUTCFullYear(),
              new Date().getUTCMonth(),
              1,
            ),
          )
        : null;

    const rows = await db
      .select({
        userUid: hubCheckinsTable.userUid,
        checkinCount: count(hubCheckinsTable.id).as("checkin_count"),
        displayName: profilesTable.displayName,
        photoUrl: profilesTable.photoUrl,
      })
      .from(hubCheckinsTable)
      .leftJoin(
        profilesTable,
        eq(profilesTable.uid, hubCheckinsTable.userUid),
      )
      .where(
        monthStart
          ? and(
              eq(hubCheckinsTable.placeId, placeId),
              gte(hubCheckinsTable.createdAt, monthStart),
            )
          : eq(hubCheckinsTable.placeId, placeId),
      )
      .groupBy(
        hubCheckinsTable.userUid,
        profilesTable.displayName,
        profilesTable.photoUrl,
      )
      .orderBy(desc(sql`count(${hubCheckinsTable.id})`))
      .limit(20);

    res.json(
      rows.map((r, i) => ({
        rank: i + 1,
        uid: r.userUid,
        displayName: r.displayName ?? "Unknown",
        photoUrl: r.photoUrl ?? null,
        checkinCount: Number(r.checkinCount),
      })),
    );
  },
);

// ---------------------------------------------------------------------------
// GET /api/users/:uid/champion-badges
// Returns all past monthly championship wins for a user (used for badge display).
// ---------------------------------------------------------------------------

router.get(
  "/users/:uid/champion-badges",
  requireUid,
  async (req, res): Promise<void> => {
    const { uid } = req.params as { uid: string };

    const badges = await db
      .select({
        placeId: monthlyChampionsTable.placeId,
        placeName: monthlyChampionsTable.placeName,
        month: monthlyChampionsTable.month,
        rank: monthlyChampionsTable.rank,
        checkinCount: monthlyChampionsTable.checkinCount,
      })
      .from(monthlyChampionsTable)
      .where(
        and(
          eq(monthlyChampionsTable.userUid, uid),
          eq(monthlyChampionsTable.rank, 1),
        ),
      )
      .orderBy(desc(monthlyChampionsTable.month))
      .limit(24); // up to 2 years of history

    res.json(badges);
  },
);

// ---------------------------------------------------------------------------
// POST /api/hubs/crown-monthly-champions
// Internal endpoint — called by the cron job on the 1st of each month.
// Identifies top visitor(s) for the previous month across all hubs and inserts
// them into monthly_champions. Protected by a shared secret header.
// ---------------------------------------------------------------------------

router.post(
  "/hubs/crown-monthly-champions",
  async (req, res): Promise<void> => {
    const secret = process.env["CRON_SECRET"];
    if (!secret || req.headers["x-cron-secret"] !== secret) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Determine the previous month window.
    const now = new Date();
    const prevMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    );
    const prevMonthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    // ISO date string for the month column: "YYYY-MM-01"
    const monthStr = prevMonthStart.toISOString().slice(0, 10);

    // Aggregate check-ins per (placeId, userUid) for the previous month.
    const rankings = await db
      .select({
        placeId: hubCheckinsTable.placeId,
        placeName: hubCheckinsTable.placeName,
        userUid: hubCheckinsTable.userUid,
        checkinCount: count(hubCheckinsTable.id).as("checkin_count"),
      })
      .from(hubCheckinsTable)
      .where(
        and(
          gte(hubCheckinsTable.createdAt, prevMonthStart),
          lt(hubCheckinsTable.createdAt, prevMonthEnd),
        ),
      )
      .groupBy(
        hubCheckinsTable.placeId,
        hubCheckinsTable.placeName,
        hubCheckinsTable.userUid,
      )
      .orderBy(
        hubCheckinsTable.placeId,
        desc(sql`count(${hubCheckinsTable.id})`),
      );

    if (rankings.length === 0) {
      res.json({ crowned: 0, month: monthStr });
      return;
    }

    // Pick the top user per place (rank 1 only).
    const championsMap = new Map<
      string,
      { placeId: string; placeName: string | null; userUid: string; checkinCount: number }
    >();
    for (const row of rankings) {
      if (!championsMap.has(row.placeId)) {
        championsMap.set(row.placeId, {
          placeId: row.placeId,
          placeName: row.placeName ?? null,
          userUid: row.userUid,
          checkinCount: Number(row.checkinCount),
        });
      }
    }

    const toInsert = Array.from(championsMap.values());

    // Upsert: if a champion row already exists for this place+month (e.g. job
    // re-run), skip rather than error.
    let crowned = 0;
    for (const champ of toInsert) {
      try {
        await db
          .insert(monthlyChampionsTable)
          .values({
            placeId: champ.placeId,
            placeName: champ.placeName,
            userUid: champ.userUid,
            month: monthStr,
            rank: 1,
            checkinCount: champ.checkinCount,
          })
          .onConflictDoNothing();
        crowned++;
      } catch (err) {
        logger.warn({ err, placeId: champ.placeId }, "champion insert skipped");
      }
    }

    logger.info({ crowned, month: monthStr }, "Monthly champions crowned");
    res.json({ crowned, month: monthStr });
  },
);

// ---------------------------------------------------------------------------
// POST /api/profile-views
// Records a profile view and fires a "vibe-checked" push if 24 h have elapsed
// since the last notification to the same target from the same viewer.
// ---------------------------------------------------------------------------

const ProfileViewBody = z.object({
  targetUid: z.string().min(1),
});

// 24 h in ms
const VIBE_CHECKED_COOLDOWN_MS = 24 * 60 * 60 * 1000;

router.post(
  "/profile-views",
  requireUid,
  profileViewLimit,
  async (req, res): Promise<void> => {
    const viewerUid = req.uid!;
    const parsed = ProfileViewBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "targetUid is required" });
      return;
    }
    const { targetUid } = parsed.data;

    if (viewerUid === targetUid) {
      res.status(400).json({ message: "Cannot view own profile" });
      return;
    }

    // ---------------------------------------------------------------------------
    // Free-tier view limit: 3 unique profiles per rolling 24 h window.
    // Plus/Pro subscribers are exempt. Look up the viewer's subscription row;
    // absent = free.
    // ---------------------------------------------------------------------------
    const [viewerSub] = await db
      .select({ tier: subscriptionsTable.tier, status: subscriptionsTable.status })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userUid, viewerUid))
      .limit(1);

    const viewerTier = viewerSub?.tier ?? "free";
    const isSubscribed =
      (viewerTier === "plus" || viewerTier === "pro") &&
      viewerSub?.status === "active";

    if (!isSubscribed) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);

      const [{ todayCount }] = await db
        .select({ todayCount: count() })
        .from(profileViewsTable)
        .where(
          and(
            eq(profileViewsTable.viewerUid, viewerUid),
            gte(profileViewsTable.createdAt, dayStart),
          ),
        );

      const FREE_DAILY_VIEW_LIMIT = 3;
      if (todayCount >= FREE_DAILY_VIEW_LIMIT) {
        res.status(402).json({
          limitReached: true,
          tier: viewerTier,
          message: "Daily profile view limit reached. Upgrade to Met Plus for unlimited views.",
        });
        return;
      }
    }

    // Insert the view row
    await db.insert(profileViewsTable).values({ viewerUid, targetUid });

    // Check whether we've sent a push to this target from this viewer in
    // the last 24 h by looking at the most-recent view row.
    const cutoff = new Date(Date.now() - VIBE_CHECKED_COOLDOWN_MS);
    const [recentView] = await db
      .select({ id: profileViewsTable.id })
      .from(profileViewsTable)
      .where(
        and(
          eq(profileViewsTable.viewerUid, viewerUid),
          eq(profileViewsTable.targetUid, targetUid),
          gte(profileViewsTable.createdAt, cutoff),
        ),
      )
      .orderBy(desc(profileViewsTable.createdAt))
      .limit(2); // first row = the one we just inserted; second = previous

    // Fetch the second row (the previous view within 24 h)
    const [, prevView] = await db
      .select({ id: profileViewsTable.id })
      .from(profileViewsTable)
      .where(
        and(
          eq(profileViewsTable.viewerUid, viewerUid),
          eq(profileViewsTable.targetUid, targetUid),
          gte(profileViewsTable.createdAt, cutoff),
        ),
      )
      .orderBy(desc(profileViewsTable.createdAt))
      .offset(1)
      .limit(1);

    // Only send push if no previous view from this viewer to this target in 24 h
    const pushSent = !prevView;

    if (pushSent) {
      const [target] = await db
        .select({
          pushToken: profilesTable.pushToken,
          notificationPrefs: profilesTable.notificationPrefs,
        })
        .from(profilesTable)
        .where(eq(profilesTable.uid, targetUid))
        .limit(1);

      const prefs = target?.notificationPrefs as
        | { notifyNewEncounters?: boolean; notifyReencounter?: boolean; notifyChat?: boolean }
        | null
        | undefined;

      // Use notifyNewEncounters as the gate for discovery-type pushes
      if (target?.pushToken && prefs?.notifyNewEncounters !== false) {
        await sendPush(target.pushToken, {
          title: "Someone's checking you out 👀",
          body: "Someone viewed your profile. Say hi?",
          data: { type: "encounter", fromUid: viewerUid },
        });
      }
    }

    res.json({ recorded: true, pushSent });
  },
);

// ---------------------------------------------------------------------------
// POST /api/reviews
// Submits a peer tag. Adjusts the receiver's trust score (+2 positive / -5 negative).
// One review per reviewer/receiver pair (enforced by unique index).
// ---------------------------------------------------------------------------

const POSITIVE_TAGS = new Set([
  "friendly",
  "respectful",
  "funny",
  "interesting",
  "helpful",
  "kind",
  "trustworthy",
  "creative",
  "fun",
  "genuine",
]);

const NEGATIVE_TAGS = new Set([
  "rude",
  "spam",
  "inappropriate",
  "disrespectful",
  "creepy",
]);

const ReviewBody = z.object({
  receiverUid: z.string().min(1),
  tag: z.string().min(1).max(50).optional().default("reviewed"),
  courtesy: z.number().int().min(1).max(5).optional(),
  communication: z.number().int().min(1).max(5).optional(),
  reliability: z.number().int().min(1).max(5).optional(),
});

router.post(
  "/reviews",
  requireUid,
  reviewWriteLimit,
  async (req, res): Promise<void> => {
    const reviewerUid = req.uid!;
    const parsed = ReviewBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "receiverUid is required" });
      return;
    }
    const { receiverUid, tag, courtesy, communication, reliability } = parsed.data;

    if (reviewerUid === receiverUid) {
      res.status(400).json({ message: "Cannot review yourself" });
      return;
    }

    try {
      await db.insert(reviewsTable).values({
        reviewerUid,
        receiverUid,
        tag,
        courtesy: courtesy ?? null,
        communication: communication ?? null,
        reliability: reliability ?? null,
      });
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "";
      if (msg.includes("reviews_reviewer_receiver_uniq")) {
        // Allow updating scores on an existing review (upsert approach)
        if (courtesy !== undefined || communication !== undefined || reliability !== undefined) {
          await db
            .update(reviewsTable)
            .set({
              courtesy: courtesy ?? null,
              communication: communication ?? null,
              reliability: reliability ?? null,
            })
            .where(
              and(
                eq(reviewsTable.reviewerUid, reviewerUid),
                eq(reviewsTable.receiverUid, receiverUid),
              ),
            );
        } else {
          res.status(409).json({ message: "You have already reviewed this user" });
          return;
        }
      } else {
        throw err;
      }
    }

    // Adjust trust score based on tag sentiment (legacy path)
    const tagLower = tag.toLowerCase();
    const delta = POSITIVE_TAGS.has(tagLower)
      ? 2
      : NEGATIVE_TAGS.has(tagLower)
        ? -5
        : 0;

    const now = new Date();

    if (delta !== 0) {
      const [existing] = await db
        .select()
        .from(userStatsTable)
        .where(eq(userStatsTable.userUid, receiverUid))
        .limit(1);

      if (existing) {
        const newScore = Math.max(0, Math.min(200, existing.trustScore + delta));
        await db
          .update(userStatsTable)
          .set({ trustScore: newScore, updatedAt: now })
          .where(eq(userStatsTable.userUid, receiverUid));
      } else {
        await db.insert(userStatsTable).values({
          userUid: receiverUid,
          hubStreaks: {},
          trustScore: Math.max(0, 100 + delta),
        });
      }
    }

    // Recompute community_standing from all scored reviews for this user.
    if (courtesy !== undefined || communication !== undefined || reliability !== undefined) {
      const scoredReviews = await db
        .select({
          courtesy: reviewsTable.courtesy,
          communication: reviewsTable.communication,
          reliability: reviewsTable.reliability,
        })
        .from(reviewsTable)
        .where(
          and(
            eq(reviewsTable.receiverUid, receiverUid),
            isNotNull(reviewsTable.courtesy),
          ),
        );

      if (scoredReviews.length > 0) {
        const avgC =
          scoredReviews.reduce((s, r) => s + (r.courtesy ?? 0), 0) /
          scoredReviews.length;
        const avgCom =
          scoredReviews.reduce((s, r) => s + (r.communication ?? 0), 0) /
          scoredReviews.length;
        const avgR =
          scoredReviews.reduce((s, r) => s + (r.reliability ?? 0), 0) /
          scoredReviews.length;
        // Normalize 1–5 average to 0–100 index: 1→0, 5→100
        const communityStanding =
          (((avgC + avgCom + avgR) / 3 - 1) / 4) * 100;

        const [statsRow] = await db
          .select()
          .from(userStatsTable)
          .where(eq(userStatsTable.userUid, receiverUid))
          .limit(1);

        if (statsRow) {
          await db
            .update(userStatsTable)
            .set({ communityStanding, updatedAt: now })
            .where(eq(userStatsTable.userUid, receiverUid));
        } else {
          await db.insert(userStatsTable).values({
            userUid: receiverUid,
            hubStreaks: {},
            trustScore: 100,
            communityStanding,
          });
        }
      }
    }

    res.json({ recorded: true });
  },
);

// ---------------------------------------------------------------------------
// GET /api/users/:uid/review-summary
// Returns aggregated category scores for a user's received reviews.
// hasEnough=false when fewer than 3 scored reviews exist.
// ---------------------------------------------------------------------------

router.get(
  "/users/:uid/review-summary",
  requireUid,
  async (req, res): Promise<void> => {
    const { uid } = req.params as { uid: string };

    const reviews = await db
      .select({
        courtesy: reviewsTable.courtesy,
        communication: reviewsTable.communication,
        reliability: reviewsTable.reliability,
      })
      .from(reviewsTable)
      .where(
        and(
          eq(reviewsTable.receiverUid, uid),
          isNotNull(reviewsTable.courtesy),
        ),
      );

    const reviewCount = reviews.length;

    if (reviewCount < 3) {
      res.json({ count: reviewCount, hasEnough: false });
      return;
    }

    const avgCourtesy =
      reviews.reduce((s, r) => s + (r.courtesy ?? 0), 0) / reviewCount;
    const avgCommunication =
      reviews.reduce((s, r) => s + (r.communication ?? 0), 0) / reviewCount;
    const avgReliability =
      reviews.reduce((s, r) => s + (r.reliability ?? 0), 0) / reviewCount;
    // Normalize 1–5 average to 0–100 index: 1→0, 5→100
    const communityStanding =
      (((avgCourtesy + avgCommunication + avgReliability) / 3 - 1) / 4) * 100;

    const round1 = (n: number) => Math.round(n * 10) / 10;

    res.json({
      count: reviewCount,
      hasEnough: true,
      averageCourtesy: round1(avgCourtesy),
      averageCommunication: round1(avgCommunication),
      averageReliability: round1(avgReliability),
      communityStanding: round1(communityStanding),
    });
  },
);

// ---------------------------------------------------------------------------
// GET /api/users/:uid/stats
// Returns hub_streaks and trust_score for any user.
// ---------------------------------------------------------------------------

router.get(
  "/users/:uid/stats",
  requireUid,
  async (req, res): Promise<void> => {
    const { uid } = req.params as { uid: string };

    const [stats] = await db
      .select()
      .from(userStatsTable)
      .where(eq(userStatsTable.userUid, uid))
      .limit(1);

    res.json({
      userUid: uid,
      hubStreaks: (stats?.hubStreaks ?? {}) as Record<string, number>,
      trustScore: stats?.trustScore ?? 100,
      lastStreakUpdate: stats?.lastStreakUpdate?.toISOString() ?? null,
    });
  },
);

// ---------------------------------------------------------------------------
// GET /api/user/subscription
// Returns the server-side subscription record for the authenticated user.
// ---------------------------------------------------------------------------
router.get(
  "/user/subscription",
  requireUid,
  async (req, res): Promise<void> => {
    const uid = req.uid!;
    const [sub] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userUid, uid))
      .limit(1);

    res.json({
      userUid: uid,
      tier: sub?.tier ?? "free",
      status: sub?.status ?? "inactive",
      expiryDate: sub?.expiryDate?.toISOString() ?? null,
    });
  },
);

// ---------------------------------------------------------------------------
// POST /api/user/subscription
// Syncs the authenticated user's RevenueCat tier to Postgres. The tier is
// verified server-side via RevenueCat's API — the client-submitted value is
// used only as a hint/fallback when the RC connector is unavailable.
// ---------------------------------------------------------------------------
const SyncSubscriptionBody = z.object({
  tier: z.enum(["free", "plus", "pro"]),
  status: z.enum(["active", "inactive"]),
  expiryDate: z.string().nullable().optional(),
});

router.post(
  "/user/subscription",
  requireUid,
  async (req, res): Promise<void> => {
    const uid = req.uid!;
    const parsed = SyncSubscriptionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid subscription body", errors: parsed.error.flatten() });
      return;
    }
    const { expiryDate } = parsed.data;

    // Verify the tier server-side using the RevenueCat API. This ensures a
    // user cannot self-upgrade by crafting a POST with tier:"pro". If RC is
    // unavailable, getVerifiedTier falls back to "free" (safe default).
    const tier = await getVerifiedTier(uid);
    const status = tier === "free" ? "inactive" : "active";

    await db
      .insert(subscriptionsTable)
      .values({
        userUid: uid,
        tier,
        status,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: subscriptionsTable.userUid,
        set: {
          tier,
          status,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          updatedAt: new Date(),
        },
      });

    res.json({ success: true });
  },
);

// ---------------------------------------------------------------------------
// POST /api/dev/set-tier  (development only)
// Manually override a user's tier in the subscriptions table for testing.
// Disabled in production.
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV !== "production") {
  const DevSetTierBody = z.object({
    tier: z.enum(["free", "plus", "pro"]),
  });

  router.post(
    "/dev/set-tier",
    requireUid,
    async (req, res): Promise<void> => {
      const uid = req.uid!;
      const parsed = DevSetTierBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "tier must be free | plus | pro" });
        return;
      }
      const { tier } = parsed.data;
      const isActive = tier !== "free";
      await db
        .insert(subscriptionsTable)
        .values({
          userUid: uid,
          tier,
          status: isActive ? "active" : "inactive",
          expiryDate: null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: subscriptionsTable.userUid,
          set: {
            tier,
            status: isActive ? "active" : "inactive",
            expiryDate: null,
            updatedAt: new Date(),
          },
        });

      res.json({ success: true, tier });
    },
  );
}

export default router;
