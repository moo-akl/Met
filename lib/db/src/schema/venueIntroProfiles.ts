import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const venueIntroProfilesTable = pgTable("venue_intro_profiles", {
  key: text("key").primaryKey(),
  venueName: text("venue_name").notNull(),
  venueNameKey: text("venue_name_key").notNull(),
  coverCopy: text("cover_copy").notNull(),
  slide2Heading: text("slide2_heading").notNull(),
  slide2Copy: text("slide2_copy").notNull(),
  slide3Heading: text("slide3_heading").notNull(),
  slide3Copy: text("slide3_copy").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  venueNameKeyUnique: uniqueIndex("venue_intro_profiles_venue_name_key_unique").on(
    table.venueNameKey,
  ),
}));

export const insertVenueIntroProfileSchema = createInsertSchema(
  venueIntroProfilesTable,
).omit({ createdAt: true, updatedAt: true });

export type InsertVenueIntroProfile = z.infer<typeof insertVenueIntroProfileSchema>;
export type VenueIntroProfileRecord = typeof venueIntroProfilesTable.$inferSelect;
