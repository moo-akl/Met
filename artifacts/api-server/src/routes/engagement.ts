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
import { eq, and, desc, gte, sql, count } from "drizzle-orm";
import {
  db,
  hubCheckinsTable,
  userStatsTable,
  profileViewsTable,
  reviewsTable,
  profilesTable,
} from "@workspace/db";
import { requireUid } from "../middlewares/requireUid";
import { createUserRateLimiter } from "../middlewares/rateLimit";
import { sendPush } from "../lib/push";
import { logger } from "../lib/logger";
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
// GET /api/hubs/:placeId/leaderboard
// Returns top 20 users by total check-in count at a given place.
// ---------------------------------------------------------------------------

router.get(
  "/hubs/:placeId/leaderboard",
  requireUid,
  async (req, res): Promise<void> => {
    const { placeId } = req.params as { placeId: string };

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
      .where(eq(hubCheckinsTable.placeId, placeId))
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
  tag: z.string().min(1).max(50),
});

router.post(
  "/reviews",
  requireUid,
  reviewWriteLimit,
  async (req, res): Promise<void> => {
    const reviewerUid = req.uid!;
    const parsed = ReviewBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "receiverUid and tag are required" });
      return;
    }
    const { receiverUid, tag } = parsed.data;

    if (reviewerUid === receiverUid) {
      res.status(400).json({ message: "Cannot review yourself" });
      return;
    }

    try {
      await db.insert(reviewsTable).values({ reviewerUid, receiverUid, tag });
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "";
      if (msg.includes("reviews_reviewer_receiver_uniq")) {
        res
          .status(409)
          .json({ message: "You have already reviewed this user" });
        return;
      }
      throw err;
    }

    // Adjust trust score based on tag sentiment
    const tagLower = tag.toLowerCase();
    const delta = POSITIVE_TAGS.has(tagLower)
      ? 2
      : NEGATIVE_TAGS.has(tagLower)
        ? -5
        : 0;

    if (delta !== 0) {
      const [existing] = await db
        .select()
        .from(userStatsTable)
        .where(eq(userStatsTable.userUid, receiverUid))
        .limit(1);

      const now = new Date();
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

    res.json({ recorded: true });
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

export default router;
