import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// trophies
// One row per (hub_id, month_year, rank_achieved).
// Populated by the monthly crown job — top 3 visitors per hub each month.
// month_year: "YYYY-MM" (e.g. "2026-07")
// rank_achieved: 1, 2, or 3
// trophy_type: "Gold" | "Silver" | "Bronze"
// ---------------------------------------------------------------------------
export const trophiesTable = pgTable(
  "trophies",
  {
    id: serial("id").primaryKey(),
    userUid: text("user_uid").notNull(),
    hubId: text("hub_id").notNull(),
    hubName: text("hub_name"),
    monthYear: text("month_year").notNull(),
    rankAchieved: integer("rank_achieved").notNull(),
    trophyType: text("trophy_type").notNull(),
    awardedAt: timestamp("awarded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("trophies_user_idx").on(t.userUid),
    hubMonthRankUniq: uniqueIndex("trophies_hub_month_rank_uniq").on(
      t.hubId,
      t.monthYear,
      t.rankAchieved,
    ),
  }),
);

export const insertTrophySchema = createInsertSchema(trophiesTable).omit({
  id: true,
  awardedAt: true,
});

export type InsertTrophy = z.infer<typeof insertTrophySchema>;
export type Trophy = typeof trophiesTable.$inferSelect;
