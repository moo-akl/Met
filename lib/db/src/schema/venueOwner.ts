import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  doublePrecision,
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

export const venueCategories = [
  "restaurant",
  "cafe",
  "bar",
  "shopping",
  "outdoors",
  "culture",
  "fitness",
  "education",
  "transit",
  "lodging",
  "other",
] as const;
export type VenueCategory = (typeof venueCategories)[number];

export type VenueCheckinMode = "open" | "qr_only";

export const venueOwnerProfilesTable = pgTable(
  "venue_owner_profiles",
  {
    id: serial("id").primaryKey(),
    ownerUid: text("owner_uid").notNull(),
    placeId: text("place_id").notNull(),
    placeName: text("place_name").notNull(),
    /** Business display name shown on the public profile. */
    businessName: text("business_name").notNull(),
    venueType: text("venue_type").$type<VenueCategory>().notNull().default("other"),
    venueTypeSource: text("venue_type_source").$type<"unclassified" | "google" | "manual">().notNull().default("unclassified"),
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
    /** QR-only is the safe default; owners can explicitly enable location check-ins. */
    checkInMode: text("check_in_mode")
      .$type<VenueCheckinMode>()
      .notNull()
      .default("qr_only"),
    /** URL or storage path of the submitted verification document. */
    verificationDocUrl: text("verification_doc_url"),
    /** Optional additional notes submitted during registration. */
    registrationNotes: text("registration_notes"),
    /** Contact email for web-portal applications (no Firebase UID available). */
    contactEmail: text("contact_email"),
    /** Contact name supplied by web-portal applicants. */
    contactName: text("contact_name"),
    /**
     * Verified Firebase account that submitted a native additional-venue
     * application. `ownerUid` stays unique and synthetic for each profile.
     */
    applicationApplicantUid: text("application_applicant_uid"),
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
    /** 'mobile' | 'web' | 'agent' — null for legacy rows. */
    applicationSource: text("application_source"),
    /** ID of the sales agent who registered this venue on behalf of the owner. */
    assignedAgentId: integer("assigned_agent_id"),
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
    applicantUidIdx: index("venue_owner_profiles_applicant_uid_idx").on(t.applicationApplicantUid),
    createdAtIdx: index("venue_owner_profiles_created_at_idx").on(t.createdAt),
  }),
);

/**
 * An opted-in activation clock. Existing venues have no row and are never
 * retrospectively suspended. A resend must not change either deadline.
 */
export const venueActivationPoliciesTable = pgTable(
  "venue_activation_policies",
  {
    id: serial("id").primaryKey(),
    profileId: integer("profile_id").notNull(),
    firstInvitationSentAt: timestamp("first_invitation_sent_at", { withTimezone: true }),
    registrationDeadline: timestamp("registration_deadline", { withTimezone: true }),
    registeredAt: timestamp("registered_at", { withTimezone: true }),
    qrDeadline: timestamp("qr_deadline", { withTimezone: true }),
    reminder5AttemptedAt: timestamp("reminder_5_attempted_at", { withTimezone: true }),
    reminder10AttemptedAt: timestamp("reminder_10_attempted_at", { withTimezone: true }),
    reminder5SentAt: timestamp("reminder_5_sent_at", { withTimezone: true }),
    reminder10SentAt: timestamp("reminder_10_sent_at", { withTimezone: true }),
    unlistedAt: timestamp("unlisted_at", { withTimezone: true }),
    removalReason: text("removal_reason").$type<"registration" | "qr_checkins" | null>(),
    exempt: boolean("exempt").notNull().default(false),
    exceptionReason: text("exception_reason"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileUniq: uniqueIndex("venue_activation_policies_profile_uniq").on(t.profileId),
    registrationDeadlineIdx: index("venue_activation_registration_deadline_idx").on(t.registrationDeadline),
    qrDeadlineIdx: index("venue_activation_qr_deadline_idx").on(t.qrDeadline),
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

/**
 * One-time pre-approval application invitations. Only the token hash is stored;
 * the recipient can choose a venue when submitting their application.
 */
export const venueApplicationInviteTokensTable = pgTable(
  "venue_application_invite_tokens",
  {
    id: serial("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    invitedEmail: text("invited_email").notNull(),
    businessName: text("business_name").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    applicationId: integer("application_id").references(
      () => venueOwnerProfilesTable.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tokenHashUniq: uniqueIndex("venue_application_invite_token_hash_uniq").on(t.tokenHash),
    applicationIdUniq: uniqueIndex("venue_application_invite_application_uniq").on(t.applicationId),
    inviteEmailIdx: index("venue_application_invite_email_idx").on(t.invitedEmail),
    expiresAtIdx: index("venue_application_invite_expires_at_idx").on(t.expiresAt),
  }),
);

export type VenueApplicationInviteToken =
  typeof venueApplicationInviteTokensTable.$inferSelect;

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
// sales_agents
// Internal sales team members who register venues on behalf of owners.
// ---------------------------------------------------------------------------
export const salesAgentsTable = pgTable(
  "sales_agents",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    sessionVersion: integer("session_version").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailUniq: uniqueIndex("sales_agents_email_uniq").on(t.email),
    isActiveIdx: index("sales_agents_is_active_idx").on(t.isActive),
  }),
);

export type SalesAgent = typeof salesAgentsTable.$inferSelect;

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
    /** Uploaded event gallery photos; imageUrl remains the first-photo compatibility field. */
    galleryPhotos: text("gallery_photos")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    /** Gallery references and stored images are removed after this time. */
    photosExpireAt: timestamp("photos_expire_at", { withTimezone: true }),
    /** Optional public event-specific contact details. */
    contactPhone: text("contact_phone"),
    websiteUrl: text("website_url"),
    publicEmail: text("public_email"),
    /** ISO-8601 datetime when the event begins. */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    /** ISO-8601 datetime when the event ends (optional). */
    endsAt: timestamp("ends_at", { withTimezone: true }),
    /** Maximum attendees (null = unlimited). */
    capacityLimit: integer("capacity_limit"),
    /** Hours before start when RSVP reminder pushes should be sent. */
    reminderOffsetsHours: integer("reminder_offsets_hours")
      .array()
      .notNull()
      .default(sql`ARRAY[]::integer[]`),
    /** Public events appear in the Events feed; invite-only events require an explicit invite. */
    visibility: text("visibility").notNull().default("public"),
    /** Met users selected by the venue from its visitor list for invite-only events. */
    inviteeUids: text("invitee_uids").array().notNull().default(sql`ARRAY[]::text[]`),
    /** SHA-256 lookup digest; the bearer token itself is encrypted at rest. */
    inviteTokenHash: text("invite_token_hash"),
    inviteTokenEncrypted: text("invite_token_encrypted"),
    invitePasscodeSalt: text("invite_passcode_salt"),
    invitePasscodeHash: text("invite_passcode_hash"),
    checkinTokenHash: text("checkin_token_hash"),
    checkinTokenEncrypted: text("checkin_token_encrypted"),
    /** Denormalized going+maybe RSVP count — updated on each RSVP change. */
    rsvpCount: integer("rsvp_count").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(true),
    /** Hidden by a moderator (admin) after a content report. Not shown to guests. */
    isHidden: boolean("is_hidden").notNull().default(false),
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
    inviteTokenHashUniq: uniqueIndex("venue_events_invite_token_hash_uniq").on(
      t.inviteTokenHash,
    ),
    checkinTokenHashUniq: uniqueIndex("venue_events_checkin_token_hash_uniq").on(
      t.checkinTokenHash,
    ),
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
// community_events
// Events created by Met members. Venue events remain in venue_events so their
// existing ownership, moderation, and RSVP behavior is unchanged.
// ---------------------------------------------------------------------------
export const communityEventsTable = pgTable(
  "community_events",
  {
    id: serial("id").primaryKey(),
    ownerUid: text("owner_uid").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    contactPhone: text("contact_phone"),
    websiteUrl: text("website_url"),
    publicEmail: text("public_email"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    location: text("location"),
    locationPlaceId: text("location_place_id"),
    locationLatitude: doublePrecision("location_latitude"),
    locationLongitude: doublePrecision("location_longitude"),
    /** 'public' or 'invite_only' */
    visibility: text("visibility").notNull().default("public"),
    /** Ongoing cadence for invite-only friend plans. */
    repeatFrequency: text("repeat_frequency").$type<"daily" | "weekly" | "monthly" | null>(),
    recurrenceTimeZone: text("recurrence_time_zone").notNull().default("UTC"),
    /** The creator's original local day, so monthly plans do not drift after short months. */
    recurrenceDayOfMonth: integer("recurrence_day_of_month"),
    galleryPhotos: text("gallery_photos")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    photosExpireAt: timestamp("photos_expire_at", { withTimezone: true }),
    joinApprovalRequired: boolean("join_approval_required").notNull().default(false),
    /** Explorer-only plans are private and visible only to qualifying members. */
    verifiedExplorersOnly: boolean("verified_explorers_only").notNull().default(false),
    /** Explicitly invited Met matches for invite-only events. */
    inviteeUids: text("invitee_uids").array().notNull().default(sql`ARRAY[]::text[]`),
    /** SHA-256 lookup digest; the bearer token itself is encrypted at rest. */
    inviteTokenHash: text("invite_token_hash"),
    inviteTokenEncrypted: text("invite_token_encrypted"),
    invitePasscodeSalt: text("invite_passcode_salt"),
    invitePasscodeHash: text("invite_passcode_hash"),
    checkinTokenHash: text("checkin_token_hash"),
    checkinTokenEncrypted: text("checkin_token_encrypted"),
    ratingPromptSentAt: timestamp("rating_prompt_sent_at", { withTimezone: true }),
    isHidden: boolean("is_hidden").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ownerUidIdx: index("community_events_owner_uid_idx").on(t.ownerUid),
    startsAtIdx: index("community_events_starts_at_idx").on(t.startsAt),
    visibilityIdx: index("community_events_visibility_idx").on(t.visibility),
    inviteTokenHashUniq: uniqueIndex("community_events_invite_token_hash_uniq").on(
      t.inviteTokenHash,
    ),
    checkinTokenHashUniq: uniqueIndex("community_events_checkin_token_hash_uniq").on(
      t.checkinTokenHash,
    ),
  }),
);

export const communityEventPlanMessagesTable = pgTable(
  "community_event_plan_messages",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => communityEventsTable.id, { onDelete: "cascade" }),
    senderUid: text("sender_uid").notNull(),
    message: text("message").notNull(),
    mediaType: text("media_type"),
    mediaObjectPath: text("media_object_path"),
    audioDurationMs: integer("audio_duration_ms"),
    mediaExpiresAt: timestamp("media_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    eventCreatedIdx: index("community_event_plan_messages_event_created_idx").on(
      t.eventId,
      t.createdAt,
    ),
    mediaExpiryIdx: index("community_event_plan_messages_media_expiry_idx").on(
      t.mediaExpiresAt,
    ),
    mediaObjectPathUnique: uniqueIndex("community_event_plan_messages_media_path_uniq").on(
      t.mediaObjectPath,
    ),
  }),
);

export const communityEventPlanMediaUploadsTable = pgTable(
  "community_event_plan_media_uploads",
  {
    objectPath: text("object_path").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => communityEventsTable.id, { onDelete: "cascade" }),
    ownerUid: text("owner_uid").notNull(),
    mediaType: text("media_type").notNull(),
    contentType: text("content_type").notNull(),
    maxBytes: integer("max_bytes").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    expiryIdx: index("community_event_plan_media_uploads_expiry_idx").on(
      t.expiresAt,
    ),
  }),
);

export const communityEventPlanNotificationPreferencesTable = pgTable(
  "community_event_plan_notification_preferences",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => communityEventsTable.id, { onDelete: "cascade" }),
    userUid: text("user_uid").notNull(),
    muted: boolean("muted").notNull().default(false),
    lastReadMessageId: integer("last_read_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    eventUserUniq: uniqueIndex(
      "community_event_plan_notification_preferences_event_user_uniq",
    ).on(t.eventId, t.userUid),
  }),
);

export const communityEventRsvpsTable = pgTable(
  "community_event_rsvps",
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
    eventUserUniq: uniqueIndex("community_event_rsvps_event_user_uniq").on(
      t.eventId,
      t.userUid,
    ),
    eventIdIdx: index("community_event_rsvps_event_id_idx").on(t.eventId),
    userUidIdx: index("community_event_rsvps_user_uid_idx").on(t.userUid),
  }),
);

export const communityEventJoinRequestsTable = pgTable(
  "community_event_join_requests",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => communityEventsTable.id, { onDelete: "cascade" }),
    userUid: text("user_uid").notNull(),
    status: text("status")
      .$type<"pending" | "accepted" | "declined" | "withdrawn">()
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => ({
    eventUserUniq: uniqueIndex("community_event_join_requests_event_user_uniq").on(
      t.eventId,
      t.userUid,
    ),
    eventStatusCreatedIdx: index(
      "community_event_join_requests_event_status_created_idx",
    ).on(t.eventId, t.status, t.createdAt),
    userStatusIdx: index("community_event_join_requests_user_status_idx").on(
      t.userUid,
      t.status,
    ),
  }),
);

export const communityEventHostRatingsTable = pgTable(
  "community_event_host_ratings",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => communityEventsTable.id, { onDelete: "cascade" }),
    reviewerUid: text("reviewer_uid").notNull(),
    rating: integer("rating").notNull(),
    reviewText: text("review_text"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    eventReviewerUniq: uniqueIndex(
      "community_event_host_ratings_event_reviewer_uniq",
    ).on(t.eventId, t.reviewerUid),
    eventIdx: index("community_event_host_ratings_event_idx").on(t.eventId),
  }),
);

export const venueEventReviewsTable = pgTable(
  "venue_event_reviews",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => venueEventsTable.id, { onDelete: "cascade" }),
    reviewerUid: text("reviewer_uid").notNull(),
    rating: integer("rating").notNull(),
    reviewText: text("review_text"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    eventReviewerUniq: uniqueIndex("venue_event_reviews_event_reviewer_uniq").on(
      t.eventId,
      t.reviewerUid,
    ),
    eventIdx: index("venue_event_reviews_event_idx").on(t.eventId),
  }),
);

/**
 * Verified event attendance. RSVP state is deliberately separate: this table
 * is written only after an event QR scan or an on-site location check.
 * eventType/eventId are polymorphic so the same list API can cover both event
 * products without copying guest identity data into either event table.
 */
export const eventAttendanceTable = pgTable(
  "event_attendance",
  {
    id: serial("id").primaryKey(),
    eventType: text("event_type").notNull(),
    eventId: integer("event_id").notNull(),
    userUid: text("user_uid").notNull(),
    checkInMethod: text("check_in_method").notNull(),
    checkedInByUid: text("checked_in_by_uid"),
    manualReason: text("manual_reason"),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    attendeeUnique: uniqueIndex("event_attendance_event_attendee_uniq").on(
      t.eventType,
      t.eventId,
      t.userUid,
    ),
    eventIdx: index("event_attendance_event_idx").on(t.eventType, t.eventId),
    userIdx: index("event_attendance_user_idx").on(t.userUid),
  }),
);

export const eventAttendanceCorrectionsTable = pgTable(
  "event_attendance_corrections",
  {
    id: serial("id").primaryKey(),
    eventType: text("event_type").notNull(),
    eventId: integer("event_id").notNull(),
    userUid: text("user_uid").notNull(),
    actorUid: text("actor_uid").notNull(),
    action: text("action").$type<"manual_check_in" | "undo_check_in">().notNull(),
    previousMethod: text("previous_method"),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    eventIdx: index("event_attendance_corrections_event_idx").on(t.eventType, t.eventId, t.createdAt),
    attendeeIdx: index("event_attendance_corrections_attendee_idx").on(t.eventType, t.eventId, t.userUid, t.createdAt),
  }),
);

export const venueEventNotificationRunsTable = pgTable(
  "venue_event_notification_runs",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull(),
    kind: text("kind").$type<"event_update" | "reminder_24h" | "reminder_2h">().notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    status: text("status").$type<"sending" | "sent" | "partial" | "failed">().notNull().default("sending"),
    recipientCount: integer("recipient_count").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    runUnique: uniqueIndex("venue_event_notification_runs_event_kind_schedule_uniq").on(t.eventId, t.kind, t.scheduledFor),
    eventIdx: index("venue_event_notification_runs_event_idx").on(t.eventId, t.startedAt),
  }),
);

export type CommunityEvent = typeof communityEventsTable.$inferSelect;
export type CommunityEventPlanMessage = typeof communityEventPlanMessagesTable.$inferSelect;
export type CommunityEventPlanNotificationPreference =
  typeof communityEventPlanNotificationPreferencesTable.$inferSelect;
export type CommunityEventRsvp = typeof communityEventRsvpsTable.$inferSelect;
export type CommunityEventJoinRequest =
  typeof communityEventJoinRequestsTable.$inferSelect;

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
    /** Hidden by a moderator (admin) after a content report. Not shown to guests. */
    isHidden: boolean("is_hidden").notNull().default(false),
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
