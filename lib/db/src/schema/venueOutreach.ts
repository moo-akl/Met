import { createInsertSchema } from "drizzle-zod";
import { date, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { venueManagerRegistrationTokensTable } from "./venueBusiness";
import {
  venueApplicationInviteTokensTable,
  venueOwnerProfilesTable,
} from "./venueOwner";

/**
 * Durable send log for venue outreach and owner invitations. This is separate
 * from application history because pre-approval outreach can happen before a
 * venue application/profile exists.
 */
export const venueOutreachEmailLogsTable = pgTable(
  "venue_outreach_email_logs",
  {
    id: serial("id").primaryKey(),
    venueOwnerProfileId: integer("venue_owner_profile_id").references(
      () => venueOwnerProfilesTable.id,
      { onDelete: "set null" },
    ),
    applicationInviteTokenId: integer("application_invite_token_id").references(
      () => venueApplicationInviteTokensTable.id,
      { onDelete: "set null" },
    ),
    registrationTokenId: integer("registration_token_id").references(
      () => venueManagerRegistrationTokensTable.id,
      { onDelete: "set null" },
    ),
    // The bounced outreach row explicitly retried by this send. A nullable
    // integer avoids coupling log cleanup to a self-referencing FK.
    retryOfLogId: integer("retry_of_log_id"),
    placeId: text("place_id"),
    businessName: text("business_name").notNull(),
    recipientEmail: text("recipient_email").notNull(),
    template: text("template").notNull(),
    templateName: text("template_name"),
    kind: text("kind")
      .$type<"new_venue_outreach" | "contact_request" | "registration_invite" | "manager_announcement">()
      .notNull(),
    deliveryStatus: text("delivery_status")
      .$type<"sending" | "sent" | "delivery_uncertain" | "failed" | "bounced">()
      .notNull(),
    gmailRfcMessageId: text("gmail_rfc_message_id"),
    gmailThreadId: text("gmail_thread_id"),
    gmailReplyAt: timestamp("gmail_reply_at", { withTimezone: true }),
    gmailReplyMessageId: text("gmail_reply_message_id"),
    gmailReplyClassification: text("gmail_reply_classification")
      .$type<"interested" | "rejected" | "other" | "uncertain">(),
    gmailReplyClassificationVersion: integer("gmail_reply_classification_version")
      .notNull()
      .default(1),
    gmailBounceMessageId: text("gmail_bounce_message_id"),
    gmailBounceStatus: text("gmail_bounce_status"),
    gmailBounceReason: text("gmail_bounce_reason"),
    bouncedAt: timestamp("bounced_at", { withTimezone: true }),
    actorUid: text("actor_uid"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    profileCreatedAtIdx: index("venue_outreach_email_logs_profile_created_at_idx").on(
      t.venueOwnerProfileId,
      t.createdAt,
    ),
    recipientCreatedAtIdx: index("venue_outreach_email_logs_recipient_created_at_idx").on(
      t.recipientEmail,
      t.createdAt,
    ),
    inviteTokenIdx: index("venue_outreach_email_logs_invite_token_idx").on(
      t.applicationInviteTokenId,
    ),
    registrationTokenIdx: index("venue_outreach_email_logs_registration_token_idx").on(
      t.registrationTokenId,
    ),
    retryOfLogIdx: index("venue_outreach_email_logs_retry_of_log_idx").on(t.retryOfLogId),
    gmailRfcMessageIdUnique: uniqueIndex("venue_outreach_email_logs_gmail_rfc_message_id_uniq")
      .on(t.gmailRfcMessageId),
    gmailBounceMessageIdUnique: uniqueIndex("venue_outreach_email_logs_gmail_bounce_message_id_uniq")
      .on(t.gmailBounceMessageId),
  }),
);

/**
 * Addresses explicitly blocked by a Venue Admin from future outreach. Keeping
 * this independent of send history preserves the audit trail when an address
 * is no longer eligible for future messages.
 */
export const venueOutreachEmailSuppressionsTable = pgTable("venue_outreach_email_suppressions", {
  email: text("email").primaryKey(),
  actorUid: text("actor_uid"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Stores only Gmail message IDs for repeat-bounce notices whose Venue Admin
 * history was cleared, so later syncs do not surface those notices again.
 */
export const venueOutreachClearedBounceMessagesTable = pgTable(
  "venue_outreach_cleared_bounce_messages",
  {
    gmailMessageId: text("gmail_message_id").primaryKey(),
    clearedAt: timestamp("cleared_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const insertVenueOutreachClearedBounceMessageSchema = createInsertSchema(
  venueOutreachClearedBounceMessagesTable,
).omit({ clearedAt: true });
export type InsertVenueOutreachClearedBounceMessage = z.infer<
  typeof insertVenueOutreachClearedBounceMessageSchema
>;
export type VenueOutreachClearedBounceMessage =
  typeof venueOutreachClearedBounceMessagesTable.$inferSelect;

export const insertVenueOutreachEmailSuppressionSchema = createInsertSchema(
  venueOutreachEmailSuppressionsTable,
).omit({ createdAt: true, updatedAt: true });
export type InsertVenueOutreachEmailSuppression = z.infer<
  typeof insertVenueOutreachEmailSuppressionSchema
>;
export type VenueOutreachEmailSuppression =
  typeof venueOutreachEmailSuppressionsTable.$inferSelect;

export const insertVenueOutreachEmailLogSchema = createInsertSchema(
  venueOutreachEmailLogsTable,
).omit({ id: true, createdAt: true });

export type InsertVenueOutreachEmailLog = z.infer<
  typeof insertVenueOutreachEmailLogSchema
>;
export type VenueOutreachEmailLog =
  typeof venueOutreachEmailLogsTable.$inferSelect;

/**
 * One durable next-contact plan per venue/prospect worklist group. This stays
 * independent of email logs so resending an invitation cannot erase follow-up
 * details, including for prospects that have not created a venue profile yet.
 */
export const venueOutreachFollowUpsTable = pgTable(
  "venue_outreach_follow_ups",
  {
    id: serial("id").primaryKey(),
    venueKey: text("venue_key").notNull(),
    nextActionNote: text("next_action_note"),
    nextActionDueDate: date("next_action_due_date", { mode: "string" }),
    manualInterestLevel: text("manual_interest_level")
      .$type<"top_interest" | "interest" | "no_interest">(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    venueKeyUniq: uniqueIndex("venue_outreach_follow_ups_venue_key_uniq").on(t.venueKey),
    dueDateIdx: index("venue_outreach_follow_ups_due_date_idx").on(t.nextActionDueDate),
  }),
);

export type VenueOutreachFollowUp = typeof venueOutreachFollowUpsTable.$inferSelect;

/**
 * Append-only audit trail for an admin's manual confirmation that a venue
 * replied, including an explicit undo when the confirmation was mistaken.
 */
export const venueOutreachManualReplyEventsTable = pgTable(
  "venue_outreach_manual_reply_events",
  {
    id: serial("id").primaryKey(),
    venueKey: text("venue_key").notNull(),
    action: text("action")
      .$type<"mark_replied" | "undo_mark">()
      .notNull(),
    actorUid: text("actor_uid").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    venueCreatedIdx: index("venue_outreach_manual_reply_events_venue_created_idx")
      .on(t.venueKey, t.createdAt, t.id),
  }),
);

export const insertVenueOutreachManualReplyEventSchema = createInsertSchema(
  venueOutreachManualReplyEventsTable,
).omit({ id: true, createdAt: true });
export type InsertVenueOutreachManualReplyEvent = z.infer<
  typeof insertVenueOutreachManualReplyEventSchema
>;
export type VenueOutreachManualReplyEvent =
  typeof venueOutreachManualReplyEventsTable.$inferSelect;