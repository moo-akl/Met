import {
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Reveal requests are the consent contract between two users. They live
// server-side because the recipient needs to receive them on their own
// device — we cannot store this on the sender's phone alone.
//
// Status lifecycle:
//   pending  — sender hit "Send reveal request"; recipient hasn't acted
//   accepted — recipient hit "Accept"; both sides become "connected"
//   declined — recipient hit "Not now"; sender silently reverts to neutral
//
// One row per (sender, recipient) pair. Re-sending after a decline /
// expiry upserts the same row back to "pending" with a fresh createdAt.
export const revealRequestsTable = pgTable(
  "reveal_requests",
  {
    id: serial("id").primaryKey(),
    senderUid: text("sender_uid").notNull(),
    recipientUid: text("recipient_uid").notNull(),
    // Optional personal note attached at send time. 240 char ceiling
    // mirrors the client-side `maxLength` on the reveal sheet input.
    message: text("message"),
    // Plain text rather than a pg enum so future statuses (e.g.
    // "expired", "blocked") don't require a migration.
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Stamped when the recipient acts (accept/decline). Null while pending.
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    // Quality-threshold fields for review gating.
    // messageCount is incremented server-side each time either participant sends
    // a message; used to surface the review prompt only after ≥10 exchanges.
    messageCount: integer("message_count").notNull().default(0),
    // Set to true when either participant confirms "We met in real life".
    hasMetInRealLife: boolean("has_met_in_real_life").notNull().default(false),
  },
  (t) => ({
    senderRecipientUniq: uniqueIndex("reveals_sender_recipient_uniq").on(
      t.senderUid,
      t.recipientUid,
    ),
    // Inbox / outbox queries scan by (uid, status) — index both directions.
    recipientStatusIdx: index("reveals_recipient_status_idx").on(
      t.recipientUid,
      t.status,
    ),
    senderStatusIdx: index("reveals_sender_status_idx").on(
      t.senderUid,
      t.status,
    ),
  }),
);

export const insertRevealRequestSchema = createInsertSchema(
  revealRequestsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  respondedAt: true,
});

export type InsertRevealRequest = z.infer<typeof insertRevealRequestSchema>;
export type RevealRequest = typeof revealRequestsTable.$inferSelect;
