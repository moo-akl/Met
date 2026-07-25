import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// venue_owner_profiles
// One row per approved venue owner. ownerUid + placeId each carry a unique
// constraint — a single user may only claim one venue, and each venue may
// only be owned by one user.
//
// Approval flow:
//   1. User submits registration → isApproved=false, isVerified=false.
//   2. Admin reviews docs → sets isApproved=true, isVerified=true.
//   3. If no admin action within 14 days the cron endpoint cleans up the
//      pending row so the placeId becomes available again.
// ---------------------------------------------------------------------------
export const venueOwnerProfilesTable = pgTable(
  "venue_owner_profiles",
  {
    id: serial("id").primaryKey(),
    ownerUid: text("owner_uid").notNull(),
    placeId: text("place_id").notNull(),
    placeName: text("place_name").notNull(),
    /** Business display name shown on the public profile. */
    businessName: text("business_name").notNull(),
    tagline: text("tagline"),
    description: text("description"),
    /** URL of the venue's cover/hero photo in Firebase Storage. */
    coverPhotoUrl: text("cover_photo_url"),
    /** URL of the venue's logo in Firebase Storage. */
    logoUrl: text("logo_url"),
    /** Raw lat from Google Places (stored for map layer). */
    lat: text("lat"),
    /** Raw lng from Google Places (stored for map layer). */
    lng: text("lng"),
    /** URL or storage path of the submitted verification document. */
    verificationDocUrl: text("verification_doc_url"),
    /** Optional additional notes submitted during registration. */
    registrationNotes: text("registration_notes"),
    isApproved: boolean("is_approved").notNull().default(false),
    isVerified: boolean("is_verified").notNull().default(false),
    /** Admin-supplied rejection reason. Surfaced to owner so they can re-apply. */
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ownerUidUniq: uniqueIndex("venue_owner_profiles_owner_uid_uniq").on(t.ownerUid),
    placeIdUniq: uniqueIndex("venue_owner_profiles_place_id_uniq").on(t.placeId),
    isApprovedIdx: index("venue_owner_profiles_is_approved_idx").on(t.isApproved),
    createdAtIdx: index("venue_owner_profiles_created_at_idx").on(t.createdAt),
  }),
);

export const insertVenueOwnerProfileSchema = createInsertSchema(
  venueOwnerProfilesTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertVenueOwnerProfile = z.infer<typeof insertVenueOwnerProfileSchema>;
export type VenueOwnerProfile = typeof venueOwnerProfilesTable.$inferSelect;

// ---------------------------------------------------------------------------
// venue_events
// Events created by an approved venue owner for their venue.
// RSVP counts are maintained in venue_event_rsvps; the denormed rsvpCount
// here is updated by a trigger / cron for display queries.
// ---------------------------------------------------------------------------
export const venueEventsTable = pgTable(
  "venue_events",
  {
    id: serial("id").primaryKey(),
    ownerUid: text("owner_uid").notNull(),
    placeId: text("place_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    /** Cover image URL (Firebase Storage). */
    imageUrl: text("image_url"),
    /** ISO-8601 datetime when the event begins. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    /** ISO-8601 datetime when the event ends (optional). */
    endsAt: timestamp("ends_at", { withTimezone: true }),
    /** Maximum attendees (null = unlimited). */
    capacityLimit: integer("capacity_limit"),
    /** Denormalized going+maybe RSVP count — updated on each RSVP change. */
    rsvpCount: integer("rsvp_count").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ownerUidIdx: index("venue_events_owner_uid_idx").on(t.ownerUid),
    placeIdIdx: index("venue_events_place_id_idx").on(t.placeId),
    startsAtIdx: index("venue_events_starts_at_idx").on(t.startsAt),
  }),
);

export const insertVenueEventSchema = createInsertSchema(venueEventsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  rsvpCount: true,
});

export type InsertVenueEvent = z.infer<typeof insertVenueEventSchema>;
export type VenueEvent = typeof venueEventsTable.$inferSelect;

// ---------------------------------------------------------------------------
// venue_event_rsvps
// One row per (eventId, userUid) pair. Status is one of going / maybe / not_going.
// ---------------------------------------------------------------------------
export const venueEventRsvpsTable = pgTable(
  "venue_event_rsvps",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull(),
    userUid: text("user_uid").notNull(),
    /** 'going' | 'maybe' | 'not_going' */
    status: text("status").notNull().default("going"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    eventUserUniq: uniqueIndex("venue_event_rsvps_event_user_uniq").on(
      t.eventId,
      t.userUid,
    ),
    eventIdIdx: index("venue_event_rsvps_event_id_idx").on(t.eventId),
    userUidIdx: index("venue_event_rsvps_user_uid_idx").on(t.userUid),
  }),
);

export const insertVenueEventRsvpSchema = createInsertSchema(
  venueEventRsvpsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertVenueEventRsvp = z.infer<typeof insertVenueEventRsvpSchema>;
export type VenueEventRsvp = typeof venueEventRsvpsTable.$inferSelect;

// ---------------------------------------------------------------------------
// venue_rewards
// Prize campaigns created by venue owners.
// rewardType: 'free_drink' | 'discount' | 'experience' | 'custom'
// Status lifecycle: draft → active → completed / cancelled
// winnerUid: set by the cron endpoint (crown-reward-winners) when endDate passes.
// ---------------------------------------------------------------------------
export const venueRewardsTable = pgTable(
  "venue_rewards",
  {
    id: serial("id").primaryKey(),
    ownerUid: text("owner_uid").notNull(),
    placeId: text("place_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    /** Short prize label shown in the banner, e.g. "Free cocktail for #1 check-in". */
    prizeDescription: text("prize_description").notNull(),
    /** 'free_drink' | 'discount' | 'experience' | 'custom' */
    rewardType: text("reward_type").notNull().default("custom"),
    /** 'draft' | 'active' | 'completed' | 'cancelled' */
    status: text("status").notNull().default("draft"),
    /** Campaign start — must be in the future when created. */
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    /** Campaign end — winner selection runs after this datetime. */
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    /** UID of the selected winner. Null until the cron picks a winner. */
    winnerUid: text("winner_uid"),
    /** ISO timestamp when the winner was selected. */
    winnerSelectedAt: timestamp("winner_selected_at", { withTimezone: true }),
    /** Optional IANA timezone for the venue (e.g. "America/New_York"). Used by the cron to avoid TZ-boundary issues. */
    venueTimezone: text("venue_timezone").notNull().default("UTC"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ownerUidIdx: index("venue_rewards_owner_uid_idx").on(t.ownerUid),
    placeIdIdx: index("venue_rewards_place_id_idx").on(t.placeId),
    statusIdx: index("venue_rewards_status_idx").on(t.status),
    endDateIdx: index("venue_rewards_end_date_idx").on(t.endDate),
  }),
);

export const insertVenueRewardSchema = createInsertSchema(venueRewardsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  winnerUid: true,
  winnerSelectedAt: true,
});

export type InsertVenueReward = z.infer<typeof insertVenueRewardSchema>;
export type VenueReward = typeof venueRewardsTable.$inferSelect;

// ---------------------------------------------------------------------------
// venue_announcements
// Short news / updates posted by venue owners. Supports pinning (max 1 pinned).
// ---------------------------------------------------------------------------
export const venueAnnouncementsTable = pgTable(
  "venue_announcements",
  {
    id: serial("id").primaryKey(),
    ownerUid: text("owner_uid").notNull(),
    placeId: text("place_id").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** Optional image URL (Firebase Storage). */
    imageUrl: text("image_url"),
    /** Pinned announcements are always shown first. At most one per venue. */
    isPinned: boolean("is_pinned").notNull().default(false),
    /** Extra metadata (links, tags, etc.) — open-ended JSONB for extensibility. */
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ownerUidIdx: index("venue_announcements_owner_uid_idx").on(t.ownerUid),
    placeIdIdx: index("venue_announcements_place_id_idx").on(t.placeId),
    createdAtIdx: index("venue_announcements_created_at_idx").on(t.createdAt),
  }),
);

export const insertVenueAnnouncementSchema = createInsertSchema(
  venueAnnouncementsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertVenueAnnouncement = z.infer<typeof insertVenueAnnouncementSchema>;
export type VenueAnnouncement = typeof venueAnnouncementsTable.$inferSelect;
