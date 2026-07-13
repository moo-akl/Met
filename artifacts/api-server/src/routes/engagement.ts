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
import { eq, and, desc, gte, sql, count, lt, isNull, isNotNull, or, avg, inArray } from "drizzle-orm";
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
  /** Straight-line distance from the queried point (haversine, rounded to m). */
  distanceM: number;
}

/** Haversine great-circle distance in metres between two WGS-84 coordinates. */
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

const INCLUDED_PLACE_TYPES = [
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
];

/**
 * Calls Google Places Nearby Search (New) API to return up to `maxResults`
 * venues within 50 m of the given coordinates, ordered by distance.
 * Returns an empty array if none are found or if the API key is not set.
 */
async function findNearbyPlaces(
  lat: number,
  lng: number,
  maxResults = 5,
): Promise<PlacesResult[]> {
  const apiKey = process.env["GOOGLE_API_KEY"];
  if (!apiKey) {
    logger.warn("GOOGLE_API_KEY not set — skipping Places lookup");
    return [];
  }

  try {
    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchNearby",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.id,places.displayName,places.location",
        },
        body: JSON.stringify({
          includedTypes: INCLUDED_PLACE_TYPES,
          maxResultCount: maxResults,
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
      return [];
    }

    const data = (await res.json()) as {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        location?: { latitude?: number; longitude?: number };
      }>;
    };

    return (data.places ?? [])
      .filter((p) => !!p.id)
      .map((p) => ({
        placeId: p.id!,
        displayName: p.displayName?.text ?? "Unknown place",
        distanceM:
          p.location?.latitude != null && p.location?.longitude != null
            ? haversineMeters(lat, lng, p.location.latitude, p.location.longitude)
            : 0,
      }));
  } catch (err) {
    logger.warn(
      { err: (err as Error)?.message },
      "Google Places API request failed",
    );
    return [];
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

// 4-hour cooldown per (user, place) to prevent streak/leaderboard farming.
const CHECKIN_COOLDOWN_MS = 4 * 60 * 60 * 1000;

const CheckinBody = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** When provided, skips the Google Places lookup and uses this venue directly. */
  placeId: z.string().optional(),
  /** Human-readable venue name supplied alongside an explicit placeId. */
  placeName: z.string().optional(),
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

    // Resolve place: use the explicit placeId when the client already made a
    // /nearby call and the user picked from the multi-venue modal; otherwise
    // auto-resolve from GPS coords (single-venue path).
    let place: { placeId: string; displayName: string } | null;
    if (parsed.data.placeId) {
      place = {
        placeId: parsed.data.placeId,
        displayName: parsed.data.placeName ?? "Unknown place",
      };
    } else {
      const nearby = await findNearbyPlaces(lat, lng, 1);
      place = nearby[0] ?? null;
    }
    if (!place) {
      res
        .status(404)
        .json({ message: "No recognised venue found within 50 m" });
      return;
    }

    const now = new Date();

    // ---------------------------------------------------------------------------
    // Anti-spam cooldown: reject if the user checked in at this exact venue
    // within the past 4 hours. Back-to-back check-ins at *different* venues are
    // not affected (cooldown is per (user, place_id)).
    // ---------------------------------------------------------------------------
    const cooldownCutoff = new Date(now.getTime() - CHECKIN_COOLDOWN_MS);
    const [recentCheckin] = await db
      .select({ createdAt: hubCheckinsTable.createdAt })
      .from(hubCheckinsTable)
      .where(
        and(
          eq(hubCheckinsTable.userUid, uid),
          eq(hubCheckinsTable.placeId, place.placeId),
          gte(hubCheckinsTable.createdAt, cooldownCutoff),
        ),
      )
      .orderBy(desc(hubCheckinsTable.createdAt))
      .limit(1);

    if (recentCheckin) {
      const remainingMs =
        recentCheckin.createdAt.getTime() + CHECKIN_COOLDOWN_MS - now.getTime();
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
      res.status(403).json({ error: "cooldown", remainingMinutes });
      return;
    }

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
// GET /api/hubs/nearby?lat=&lng=
// Returns all recognised venues within 50 m (up to 5), ordered by distance.
// The frontend calls this first; if > 1 venue is returned it shows the
// SelectVenueModal so the user can pick before confirming a check-in.
// NOTE: this route MUST be registered before GET /hubs/:placeId/leaderboard
// so Express doesn't match "nearby" as a :placeId param.
// ---------------------------------------------------------------------------

router.get(
  "/hubs/nearby",
  requireUid,
  async (req, res): Promise<void> => {
    const lat = parseFloat(String(req.query["lat"]));
    const lng = parseFloat(String(req.query["lng"]));
    if (
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      res
        .status(400)
        .json({ message: "lat and lng query params are required (valid numbers)" });
      return;
    }

    const venues = await findNearbyPlaces(lat, lng, 5);
    if (venues.length === 0) {
      res
        .status(404)
        .json({ message: "No recognised venues found within 50 m" });
      return;
    }

    res.json({ venues });
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

const ALLOWED_VIBE_TAGS = new Set([
  "kind",
  "reliable",
  "open",
  "funny",
  "professional",
]);

const ReviewBody = z.object({
  receiverUid: z.string().min(1),
  starRating: z.number().int().min(1).max(5),
  vibeTags: z.array(z.string().max(30)).max(5).optional().default([]),
});

// Co-location window — both users must have checked in to the same place
// within the last CO_LOCATION_WINDOW_MS milliseconds.
const CO_LOCATION_WINDOW_MS = 24 * 60 * 60 * 1000;
// Each hub check-in is modelled as a session lasting CO_SESSION_DURATION_MS
// from the check-in timestamp (hub_checkins has no explicit checkout column).
// This lets us compute real interval overlap between two users' sessions.
const CO_SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 h assumed session
// Minimum cumulative interval overlap required to permit a review.
const CO_MIN_OVERLAP_MS = 30 * 60 * 1000; // 30 min

router.post(
  "/reviews",
  requireUid,
  reviewWriteLimit,
  async (req, res): Promise<void> => {
    const reviewerUid = req.uid!;
    const parsed = ReviewBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "starRating (1–5) and receiverUid are required" });
      return;
    }
    const { receiverUid, starRating, vibeTags } = parsed.data;

    if (reviewerUid === receiverUid) {
      res.status(400).json({ message: "Cannot review yourself" });
      return;
    }

    // Sanitise vibeTags — only allow known tag values
    const sanitisedVibeTags = vibeTags.filter((t) => ALLOWED_VIBE_TAGS.has(t));

    // ---------------------------------------------------------------------------
    // Co-location validation — strictly enforced, no fail-open.
    //
    // Requires that the reviewer and receiver have a cumulative session overlap
    // of at least CO_MIN_OVERLAP_MS (30 min) at the same place_id within the
    // last CO_LOCATION_WINDOW_MS (24 h).
    //
    // hub_checkins has no explicit checkout column, so each check-in is modelled
    // as a session of length CO_SESSION_DURATION_MS starting at createdAt.
    // Interval intersections are computed in memory from the fetched rows.
    // ---------------------------------------------------------------------------
    const windowStart = new Date(Date.now() - CO_LOCATION_WINDOW_MS);

    // 1. Fetch reviewer's check-ins with timestamps within the window.
    const reviewerCheckins = await db
      .select({
        placeId: hubCheckinsTable.placeId,
        createdAt: hubCheckinsTable.createdAt,
      })
      .from(hubCheckinsTable)
      .where(
        and(
          eq(hubCheckinsTable.userUid, reviewerUid),
          gte(hubCheckinsTable.createdAt, windowStart),
        ),
      );
    const reviewerPlaceIds = [...new Set(reviewerCheckins.map((r) => r.placeId))];

    // 2. Reviewer must have at least one recent check-in.
    if (reviewerPlaceIds.length === 0) {
      res.status(403).json({
        message: "co_location_required",
        detail: "You can only review someone you were at the same place as recently.",
      });
      return;
    }

    // 3. Fetch receiver's check-ins at the same venue(s) within the window.
    const receiverCheckins = await db
      .select({
        placeId: hubCheckinsTable.placeId,
        createdAt: hubCheckinsTable.createdAt,
      })
      .from(hubCheckinsTable)
      .where(
        and(
          eq(hubCheckinsTable.userUid, receiverUid),
          gte(hubCheckinsTable.createdAt, windowStart),
          inArray(hubCheckinsTable.placeId, reviewerPlaceIds),
        ),
      );

    if (receiverCheckins.length === 0) {
      res.status(403).json({
        message: "co_location_required",
        detail: "You can only review someone you were at the same place as recently.",
      });
      return;
    }

    // 4. Build [start, end) session intervals per place for the reviewer.
    type Interval = { start: number; end: number };
    const reviewerByPlace = new Map<string, Interval[]>();
    for (const rc of reviewerCheckins) {
      const start = rc.createdAt.getTime();
      const list = reviewerByPlace.get(rc.placeId) ?? [];
      list.push({ start, end: start + CO_SESSION_DURATION_MS });
      reviewerByPlace.set(rc.placeId, list);
    }

    // 5. Compute cumulative overlap across all shared venues.
    //    Each (reviewer session, receiver session) pair contributes the length
    //    of their intersection, capped so double-counted segments don't inflate
    //    the total beyond what a real visit could produce.
    let totalOverlapMs = 0;
    for (const rv of receiverCheckins) {
      const reviewerIntervals = reviewerByPlace.get(rv.placeId) ?? [];
      const rvStart = rv.createdAt.getTime();
      const rvEnd = rvStart + CO_SESSION_DURATION_MS;
      for (const ri of reviewerIntervals) {
        const overlapStart = Math.max(ri.start, rvStart);
        const overlapEnd = Math.min(ri.end, rvEnd);
        if (overlapEnd > overlapStart) {
          totalOverlapMs += overlapEnd - overlapStart;
        }
      }
    }

    // 6. Enforce the minimum co-presence threshold.
    if (totalOverlapMs < CO_MIN_OVERLAP_MS) {
      res.status(403).json({
        message: "co_location_required",
        detail: "You can only review someone you were at the same place as recently.",
      });
      return;
    }

    const now = new Date();

    // ---------------------------------------------------------------------------
    // Upsert the review row
    // ---------------------------------------------------------------------------
    try {
      await db.insert(reviewsTable).values({
        reviewerUid,
        receiverUid,
        starRating,
        vibeTags: sanitisedVibeTags,
      });
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "";
      if (msg.includes("reviews_reviewer_receiver_uniq")) {
        await db
          .update(reviewsTable)
          .set({ starRating, vibeTags: sanitisedVibeTags })
          .where(
            and(
              eq(reviewsTable.reviewerUid, reviewerUid),
              eq(reviewsTable.receiverUid, receiverUid),
            ),
          );
      } else {
        throw err;
      }
    }

    // ---------------------------------------------------------------------------
    // Recompute weighted average rating for receiver.
    // Weight = reviewer's trust_score / 100 (default weight 1.0 when no stats).
    // ---------------------------------------------------------------------------
    const starReviews = await db
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
    // Normalize weighted avg (1–5) → community_standing (0–100)
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
          updatedAt: now,
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
        starRating: reviewsTable.starRating,
        vibeTags: reviewsTable.vibeTags,
        reviewerUid: reviewsTable.reviewerUid,
      })
      .from(reviewsTable)
      .where(
        and(
          eq(reviewsTable.receiverUid, uid),
          isNotNull(reviewsTable.starRating),
        ),
      );

    const reviewCount = reviews.length;

    if (reviewCount < 3) {
      res.json({ count: reviewCount, hasEnough: false });
      return;
    }

    // Weighted average rating using reviewer trust scores
    let weightedSum = 0;
    let weightTotal = 0;
    for (const row of reviews) {
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
    const avgRating = weightTotal > 0 ? weightedSum / weightTotal : 0;
    const communityStanding = avgRating > 0 ? ((avgRating - 1) / 4) * 100 : 0;

    // Aggregate vibe tags across all reviews
    const vibeTagCounts: Record<string, number> = {};
    for (const row of reviews) {
      const tags = (row.vibeTags as string[] | null) ?? [];
      for (const tag of tags) {
        vibeTagCounts[tag] = (vibeTagCounts[tag] ?? 0) + 1;
      }
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;

    res.json({
      count: reviewCount,
      hasEnough: true,
      averageRating: round2(avgRating),
      vibeTags: vibeTagCounts,
      communityStanding: Math.round(communityStanding),
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
      averageRating: parseFloat((stats?.averageRating as string | null | undefined) ?? "0"),
      reviewCount: stats?.reviewCount ?? 0,
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
