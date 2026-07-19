import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
  integer,
  serial,
  uniqueIndex,
  uuid,
  foreignKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

// ---------------------------------------------------------------------------
// business_profiles
// One row per registered Business Partner. Linked to a Google Places venue
// via place_id. is_active_subscription is toggled by the RevenueCat webhook.
// ---------------------------------------------------------------------------
export const businessProfilesTable = pgTable(
  "business_profiles",
  {
    businessId: uuid("business_id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => profilesTable.uid, { onDelete: "cascade" }),
    placeId: text("place_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    logoUrl: text("logo_url"),
    mediaUrls: jsonb("media_urls").$type<string[]>().notNull().default([]),
    isActiveSubscription: boolean("is_active_subscription")
      .notNull()
      .default(false),
    subscriptionEndDate: timestamp("subscription_end_date", {
      withTimezone: true,
    }),
    salesAgentId: text("sales_agent_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ownerIdx: index("business_profiles_owner_idx").on(t.ownerId),
    placeIdx: index("business_profiles_place_idx").on(t.placeId),
    salesAgentIdx: index("business_profiles_sales_agent_idx").on(t.salesAgentId),
  }),
);

export const insertBusinessProfileSchema = createInsertSchema(
  businessProfilesTable,
).omit({ businessId: true, createdAt: true, updatedAt: true });

export type InsertBusinessProfile = z.infer<typeof insertBusinessProfileSchema>;
export type BusinessProfile = typeof businessProfilesTable.$inferSelect;

// ---------------------------------------------------------------------------
// business_events
// Events created by a business owner. start_time / end_time define the
// event window. Shown in the Enhanced Hub View on the mobile app.
// ---------------------------------------------------------------------------
export const businessEventsTable = pgTable(
  "business_events",
  {
    eventId: serial("event_id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessProfilesTable.businessId, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    businessIdx: index("business_events_business_idx").on(t.businessId),
    startTimeIdx: index("business_events_start_time_idx").on(t.startTime),
  }),
);

export const insertBusinessEventSchema = createInsertSchema(
  businessEventsTable,
).omit({ eventId: true, createdAt: true });

export type InsertBusinessEvent = z.infer<typeof insertBusinessEventSchema>;
export type BusinessEvent = typeof businessEventsTable.$inferSelect;

// ---------------------------------------------------------------------------
// business_reviews
// Reviews left by users about a business hub. One review per user per
// business (upsert on conflict). rating is 1–5.
// ---------------------------------------------------------------------------
export const businessReviewsTable = pgTable(
  "business_reviews",
  {
    reviewId: serial("review_id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businessProfilesTable.businessId, { onDelete: "cascade" }),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => profilesTable.uid, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    businessReviewerUniq: uniqueIndex("business_reviews_business_reviewer_uniq").on(
      t.businessId,
      t.reviewerId,
    ),
    businessIdx: index("business_reviews_business_idx").on(t.businessId),
  }),
);

export const insertBusinessReviewSchema = createInsertSchema(
  businessReviewsTable,
).omit({ reviewId: true, createdAt: true });

export type InsertBusinessReview = z.infer<typeof insertBusinessReviewSchema>;
export type BusinessReview = typeof businessReviewsTable.$inferSelect;
