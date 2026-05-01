import {
  pgTable,
  text,
  timestamp,
  doublePrecision,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const presenceTable = pgTable(
  "presence",
  {
    uid: text("uid").primaryKey(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    accuracyM: doublePrecision("accuracy_m"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    updatedAtIdx: index("presence_updated_at_idx").on(t.updatedAt),
  }),
);

export const insertPresenceSchema = createInsertSchema(presenceTable).omit({
  updatedAt: true,
});

export type InsertPresence = z.infer<typeof insertPresenceSchema>;
export type Presence = typeof presenceTable.$inferSelect;
