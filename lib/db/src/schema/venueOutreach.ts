import { createInsertSchema } from "drizzle-zod";
import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
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
    businessName: text("business_name").notNull(),
    recipientEmail: text("recipient_email").notNull(),
    template: text("template").notNull(),
    kind: text("kind")
      .$type<"new_venue_outreach" | "contact_request" | "registration_invite">()
      .notNull(),
    deliveryStatus: text("delivery_status")
      .$type<"sending" | "sent" | "delivery_uncertain" | "failed">()
      .notNull(),
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
  }),
);

export const insertVenueOutreachEmailLogSchema = createInsertSchema(
  venueOutreachEmailLogsTable,
).omit({ id: true, createdAt: true });

export type InsertVenueOutreachEmailLog = z.infer<
  typeof insertVenueOutreachEmailLogSchema
>;
export type VenueOutreachEmailLog =
  typeof venueOutreachEmailLogsTable.$inferSelect;