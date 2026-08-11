import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  real,
  jsonb,
  uniqueIndex,
  index,
  date,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// hub_checkins
// Logs each time a user is detected within 50 m of a Google Places venue.
// place_id is the canonical Google Places identifier (e.g. "ChIJ...").
// Raw coordinates are stored alongside for accuracy / fallback queries.
// ---------------------------------------------------------------------------
export const hubCheckinsTable = pgTable(
  "hub_checkins",
  {
    id: serial("id").primaryKey(),
    userUid: text("user_uid").notNull(),
    placeId: text("place_id").notNull(),
    placeName: text("place_name"),
    lat: text("lat"),
    lng: text("lng"),
    /**
     * How this visit was recorded:
     *   'proximity' — GPS/BLE detection only (no QR scan). Counts toward
     *                 the guest list but does not award streak points or
     *                 unlock reward eligibility.
     *   'qr_verified' — guest physically scanned the venue QR code. Full
     *                   leaderboard credit, streaks, and reward eligibility.
     */
    source: text("source").notNull().default("proximity"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userPlaceIdx: index("hub_checkins_user_place_idx").on(t.userUid, t.placeId),
    placeIdx: index("hub_checkins_place_idx").on(t.placeId),
    createdAtIdx: index("hub_checkins_created_at_idx").on(t.createdAt),
  }),
);

export const insertHubCheckinSchema = createInsertSchema(hubCheckinsTable).omit(
  { id: true, createdAt: true },
);

export type InsertHubCheckin = z.infer<typeof insertHubCheckinSchema>;
export type HubCheckin = typeof hubCheckinsTable.$inferSelect;

// ---------------------------------------------------------------------------
// user_stats
// One row per user. Created on first hub check-in or trust score event.
// hub_streaks: JSONB map of { [placeId]: consecutiveDayCount }
// trust_score: starts at 100, adjusted by peer reviews.
// ---------------------------------------------------------------------------
export const userStatsTable = pgTable("user_stats", {
  userUid: text("user_uid").primaryKey(),
  hubStreaks: jsonb("hub_streaks")
    .$type<Record<string, number>>()
    .notNull()
    .default({}),
  lastStreakUpdate: timestamp("last_streak_update", { withTimezone: true }),
  trustScore: integer("trust_score").notNull().default(100),
  communityStanding: real("community_standing"),
  // Community Impact Score fields — added for weighted peer-review system
  averageRating: numeric("average_rating", { precision: 3, scale: 2 })
    .notNull()
    .default("0"),
  reviewCount: integer("review_count").notNull().default(0),
  // Idempotency guard for the weekly-recap cron.  Stores the Monday 00:00 UTC
  // of the most-recent week for which a "Met Wrapped" push was dispatched.
  // The /cron/weekly-recap handler skips users whose lastWeeklyRecapAt falls
  // within the same ISO week, so retries and accidental double-fires are no-ops.
  lastWeeklyRecapAt: timestamp("last_weekly_recap_at", {
    withTimezone: true,
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertUserStatsSchema = createInsertSchema(userStatsTable).omit({
  updatedAt: true,
});

export type InsertUserStats = z.infer<typeof insertUserStatsSchema>;
export type UserStats = typeof userStatsTable.$inferSelect;

// ---------------------------------------------------------------------------
// profile_views
// Records when one user views another's profile.
// Used for "Vibe-Checked" FCM notifications (max 1 per 24 h per viewer/target
// pair — enforced at the application layer using createdAt).
// ---------------------------------------------------------------------------
export const profileViewsTable = pgTable(
  "profile_views",
  {
    id: serial("id").primaryKey(),
    viewerUid: text("viewer_uid").notNull(),
    targetUid: text("target_uid").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    viewerTargetIdx: index("profile_views_viewer_target_idx").on(
      t.viewerUid,
      t.targetUid,
    ),
    targetIdx: index("profile_views_target_idx").on(t.targetUid),
    createdAtIdx: index("profile_views_created_at_idx").on(t.createdAt),
  }),
);

export const insertProfileViewSchema = createInsertSchema(
  profileViewsTable,
).omit({ id: true, createdAt: true });

export type InsertProfileView = z.infer<typeof insertProfileViewSchema>;
export type ProfileView = typeof profileViewsTable.$inferSelect;

// ---------------------------------------------------------------------------
// reviews
// Peer tags submitted after a chat/encounter window closes.
// tag: short freeform label (e.g. "friendly", "respectful", "funny").
// Used to adjust receiver's trust_score in user_stats.
// ---------------------------------------------------------------------------
export const reviewsTable = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    reviewerUid: text("reviewer_uid").notNull(),
    receiverUid: text("receiver_uid").notNull(),
    // context: "chat" = review left from within chat screen;
    //          "meeting" = review left after physically meeting at a venue.
    // Each reviewer/receiver pair may have one review per context (max 2).
    context: text("context").notNull().default("chat"),
    // Legacy tag field — kept for backwards compat, not used in new reviews
    tag: text("tag").notNull().default("reviewed"),
    // Legacy scored dimensions — kept nullable for old rows
    courtesy: integer("courtesy"),
    communication: integer("communication"),
    reliability: integer("reliability"),
    // Community Impact Score fields
    starRating: integer("star_rating"), // 1–5
    vibeTags: jsonb("vibe_tags").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    reviewerReceiverContextUniq: uniqueIndex("reviews_reviewer_receiver_context_uniq").on(
      t.reviewerUid,
      t.receiverUid,
      t.context,
    ),
    receiverIdx: index("reviews_receiver_idx").on(t.receiverUid),
  }),
);

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviewsTable.$inferSelect;

// ---------------------------------------------------------------------------
// monthly_champions
// One row per (place_id, month). Populated by a cron job on the 1st of each
// month — stores the top-ranked visitor(s) for the previous month.
// month: the first calendar day of the month being crowned (e.g. "2026-07-01").
// ---------------------------------------------------------------------------
export const monthlyChampionsTable = pgTable(
  "monthly_champions",
  {
    id: serial("id").primaryKey(),
    placeId: text("place_id").notNull(),
    placeName: text("place_name"),
    userUid: text("user_uid").notNull(),
    month: date("month").notNull(),
    rank: integer("rank").notNull().default(1),
    checkinCount: integer("checkin_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    placeMonthRankUniq: uniqueIndex("monthly_champions_place_month_rank_uniq").on(
      t.placeId,
      t.month,
      t.rank,
    ),
    userIdx: index("monthly_champions_user_idx").on(t.userUid),
    placeMonthIdx: index("monthly_champions_place_month_idx").on(
      t.placeId,
      t.month,
    ),
  }),
);

export const insertMonthlyChampionSchema = createInsertSchema(
  monthlyChampionsTable,
).omit({ id: true, createdAt: true });

export type InsertMonthlyChampion = z.infer<typeof insertMonthlyChampionSchema>;
export type MonthlyChampion = typeof monthlyChampionsTable.$inferSelect;

// ---------------------------------------------------------------------------
// user_reports
// Postgres mirror of abuse/safety reports (primary copy is in Firestore).
// Storing in Postgres lets us efficiently count reports per reported user
// and trigger automated trust-score penalties server-side.
// ---------------------------------------------------------------------------
export const userReportsTable = pgTable(
  "user_reports",
  {
    id: serial("id").primaryKey(),
    reporterUid: text("reporter_uid").notNull(),
    reportedUid: text("reported_uid").notNull(),
    reason: text("reason").notNull(),
    firestoreId: text("firestore_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    reportedIdx: index("user_reports_reported_idx").on(t.reportedUid),
    reporterIdx: index("user_reports_reporter_idx").on(t.reporterUid),
    // One report per reporter→reported pair prevents vote-stuffing.
    reporterReportedUniq: uniqueIndex("user_reports_reporter_reported_uniq").on(
      t.reporterUid,
      t.reportedUid,
    ),
  }),
);

export type UserReport = typeof userReportsTable.$inferSelect;

// ---------------------------------------------------------------------------
// venue_content_reports
// Abuse/safety reports filed by guests against venue-generated content
// (events, announcements). Primary copy goes to Firestore; this Postgres
// mirror lets admins query, count, and bulk-action flagged content.
//
// entityType: 'event' | 'announcement' | 'venue'
// entityId:   the integer PK of the offending row (or 0 for 'venue')
// placeId:    the venue's Google Places ID (always set; used for lookup)
// ---------------------------------------------------------------------------
export const venueContentReportsTable = pgTable(
  "venue_content_reports",
  {
    id: serial("id").primaryKey(),
    reporterUid: text("reporter_uid").notNull(),
    entityType: text("entity_type").notNull(), // 'event' | 'announcement' | 'venue'
    entityId: integer("entity_id").notNull().default(0),
    placeId: text("place_id").notNull(),
    reason: text("reason").notNull(),
    firestoreId: text("firestore_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    placeIdx: index("venue_content_reports_place_idx").on(t.placeId),
    entityIdx: index("venue_content_reports_entity_idx").on(t.entityType, t.entityId),
    reporterIdx: index("venue_content_reports_reporter_idx").on(t.reporterUid),
    // One report per reporter per entity — prevents vote-stuffing.
    uniq: uniqueIndex("venue_content_reports_reporter_entity_uniq").on(
      t.reporterUid,
      t.entityType,
      t.entityId,
    ),
  }),
);

export type VenueContentReport = typeof venueContentReportsTable.$inferSelect;

// ---------------------------------------------------------------------------
// subscriptions
// Server-side record of a user's subscription tier. Written by the client
// after a successful RevenueCat purchase (or manually by the dev toggle for
// testing). The server uses this to enforce server-side benefits such as the
// profile-view limit and the radar spotlight flag.
// ---------------------------------------------------------------------------
export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userUid: text("user_uid").notNull().unique(),
  tier: text("tier").notNull().default("free"),   // 'free' | 'plus' | 'pro'
  status: text("status").notNull().default("inactive"), // 'active' | 'inactive'
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Subscription = typeof subscriptionsTable.$inferSelect;

// ---------------------------------------------------------------------------
// venue_qr_verifications
// Records when a user scans the venue's entrance QR code to prove physical
// presence and unlock reward eligibility for their current check-in session.
// One row per (user, placeId) scan event; multiple rows allowed across days.
// The server gates reward eligibility on whether a row exists within the same
// 4-hour cooldown window as the user's latest hub check-in.
// ---------------------------------------------------------------------------
export const venueQrVerificationsTable = pgTable(
  "venue_qr_verifications",
  {
    id: serial("id").primaryKey(),
    userUid: text("user_uid").notNull(),
    placeId: text("place_id").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userPlaceIdx: index("venue_qr_verifications_user_place_idx").on(
      t.userUid,
      t.placeId,
    ),
    verifiedAtIdx: index("venue_qr_verifications_verified_at_idx").on(
      t.verifiedAt,
    ),
  }),
);

export type VenueQrVerification = typeof venueQrVerificationsTable.$inferSelect;

// ---------------------------------------------------------------------------
// venue_reviews
// Guests leave a 1–5 star rating (+ optional comment) for a venue after
// proving physical presence via QR scan. One review per (user, placeId);
// subsequent submissions update in place (UPSERT on the unique index).
// ---------------------------------------------------------------------------
export const venueReviewsTable = pgTable(
  "venue_reviews",
  {
    id: serial("id").primaryKey(),
    userUid: text("user_uid").notNull(),
    placeId: text("place_id").notNull(),
    starRating: integer("star_rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueUserPlace: uniqueIndex("venue_reviews_user_place_idx").on(
      t.userUid,
      t.placeId,
    ),
    placeIdx: index("venue_reviews_place_idx").on(t.placeId),
  }),
);

export type VenueReview = typeof venueReviewsTable.$inferSelect;
