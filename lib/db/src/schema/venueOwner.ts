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
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// venue_owner_profiles
// A profile is the current, mutable venue application. `applicationStatus`
// is the source of truth; the older approval fields remain populated during
// migration so existing public venue, event, reward, and map code continues
// to behave correctly.
// ---------------------------------------------------------------------------
export const venueApplicationStatuses = [
  "draft",
  "submitted",
  "under_review",
  /** Reviewer handed the application back for edits; applicant may resubmit. */
  "changes_requested",
  "rejected",
  "resubmitted",
  "approved",
  "withdrawn",
  "expired",
] as const;

export type VenueApplicationStatus = (typeof venueApplicationStatuses)[number];

export const venueApplicationHistoryEventTypes = [
  "draft_saved",
  "submitted",
  "under_review",
  "changes_requested",
  "rejected",
  "resubmitted",
  "approved",
  "withdrawn",
  "expired",
  "review_note_added",
  "email_sent",
  "removal_requested",
] as const;

export type VenueApplicationHistoryEventType =
  (typeof venueApplicationHistoryEventTypes)[number];

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
    /** Contact email for web-portal applications (no Firebase UID available). */
    contactEmail: text("contact_email"),
    /** Contact name supplied by web-portal applicants. */
    contactName: text("contact_name"),
    /** Publicly displayed phone number for the venue. */
    phone: text("phone"),
    /** Publicly displayed venue website URL. */
    websiteUrl: text("website_url"),
    /** Publicly displayed contact / booking email for the venue. */
    publicEmail: text("public_email"),
    /**
     * Opening hours per day as JSONB.
     * Shape: { monday?: { open: "HH:MM", close: "HH:MM" } | null, … }
     * A null value for a day means closed; omitted day means unknown.
     */
    openingHours: jsonb("opening_hours").$type<Record<string, { open: string; close: string } | null>>(),
    /** 'mobile' | 'web' — null for legacy rows. */
    applicationSource: text("application_source"),
    /**
     * Stable token embedded in the venue's check-in QR code URL.
     * Automatically generated on venue approval; can be rotated by the owner
     * via the venue manager portal if the code is compromised.
     */
    qrToken: uuid("qr_token").unique(),
    isApproved: boolean("is_approved").notNull().default(false),
    isVerified: boolean("is_verified").notNull().default(false),
    /** Admin-supplied rejection reason. Surfaced to owner so they can re-apply. */
    rejectionReason: text("rejection_reason"),
    /**
     * Explicit lifecycle source of truth. Existing rows are backfilled from
     * approval/rejection fields during schema rollout.
     */
    applicationStatus: text("application_status")
      .$type<VenueApplicationStatus>()
      .notNull()
      .default("submitted"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ownerUidUniq: uniqueIndex("venue_owner_profiles_owner_uid_uniq").on(t.ownerUid),
    /**
     * Only an *active* claim reserves a place. Terminal applications
     * (`withdrawn`, `expired`) intentionally release the venue so another owner
     * — or the same owner — can claim it again. A global unique index here
     * would contradict the lifecycle and make reclaim impossible.
     */
    activePlaceIdUniq: uniqueIndex("venue_owner_profiles_active_place_id_uniq")
      .on(t.placeId)
      .where(sql`${t.applicationStatus} NOT IN ('withdrawn', 'expired')`),
    isApprovedIdx: index("venue_owner_profiles_is_approved_idx").on(t.isApproved),
    applicationStatusIdx: index("venue_owner_profiles_application_status_idx").on(
      t.applicationStatus,
    ),
    createdAtIdx: index("venue_owner_profiles_created_at_idx").on(t.createdAt),
  }),
);

export const insertVenueOwnerProfileSchema = createInsertSchema(
  venueOwnerProfilesTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertVenueOwnerProfile = z.infer<typeof insertVenueOwnerProfileSchema>;
export type VenueOwnerProfile = typeof venueOwnerProfilesTable.$inferSelect;

// ---------------------------------------------------------------------------
// venue_application_history
// Append-only audit log for every applicant and reviewer lifecycle action.
// `actorUid` is populated for applicant-originated events. Admin activity is
// represented by `actorRole = admin` without storing a shared admin secret.
// ---------------------------------------------------------------------------
export const venueApplicationHistoryTable = pgTable(
  "venue_application_history",
  {
    id: serial("id").primaryKey(),
    venueOwnerProfileId: integer("venue_owner_profile_id").notNull(),
    eventType: text("event_type")
      .$type<VenueApplicationHistoryEventType>()
      .notNull(),
    fromStatus: text("from_status").$type<VenueApplicationStatus>(),
    toStatus: text("to_status").$type<VenueApplicationStatus>(),
    actorRole: text("actor_role").notNull(),
    actorUid: text("actor_uid"),
    /** Visible to the applicant for decision events; null for internal notes. */
    applicantMessage: text("applicant_message"),
    /** Review-only context, never returned by applicant status APIs. */
    internalNote: text("internal_note"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    profileCreatedAtIdx: index("venue_application_history_profile_created_at_idx").on(
      t.venueOwnerProfileId,
      t.createdAt,
    ),
    eventTypeIdx: index("venue_application_history_event_type_idx").on(t.eventType),
  }),
);

export type VenueApplicationHistoryEntry =
  typeof venueApplicationHistoryTable.$inferSelect;

// ---------------------------------------------------------------------------
// venue_admin_credentials
// There is deliberately one credential for the private review workspace.
// Password material is represented only by an scrypt hash; it is never
// selected into API responses.
// ---------------------------------------------------------------------------
export const venueAdminCredentialsTable = pgTable("venue_admin_credentials", {
  id: serial("id").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  /** Incrementing this value invalidates every previously issued session. */
  sessionVersion: integer("session_version").notNull().default(1),
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  /** Running count of consecutive failed sign-in attempts. Reset to 0 on success. */
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  /** When set and in the future, sign-in is rejected regardless of password. */
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type VenueAdminCredential = typeof venueAdminCredentialsTable.$inferSelect;

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
