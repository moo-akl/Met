import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  jsonb,
  uniqueIndex,
  index,
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
    tag: text("tag").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    reviewerReceiverUniq: uniqueIndex("reviews_reviewer_receiver_uniq").on(
      t.reviewerUid,
      t.receiverUid,
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
