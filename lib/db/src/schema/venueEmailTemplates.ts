import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Overrides and custom templates for manual admin emails; deletion retains audit history. */
export const venueEmailTemplatesTable = pgTable("venue_email_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  format: text("format").$type<"text" | "html">().notNull().default("text"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
