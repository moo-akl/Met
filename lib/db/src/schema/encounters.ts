import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const encountersTable = pgTable(
  "encounters",
  {
    id: serial("id").primaryKey(),
    observerUid: text("observer_uid").notNull(),
    observedUid: text("observed_uid").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    encounterCount: integer("encounter_count").notNull().default(1),
    lastRssi: integer("last_rssi"),
  },
  (t) => ({
    observerObservedUnique: uniqueIndex("encounters_observer_observed_uniq").on(
      t.observerUid,
      t.observedUid,
    ),
  }),
);

export const insertEncounterSchema = createInsertSchema(encountersTable).omit({
  id: true,
  firstSeenAt: true,
  lastSeenAt: true,
  encounterCount: true,
});

export type InsertEncounter = z.infer<typeof insertEncounterSchema>;
export type Encounter = typeof encountersTable.$inferSelect;
