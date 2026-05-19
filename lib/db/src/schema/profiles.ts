import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profilesTable = pgTable(
  "profiles",
  {
    uid: text("uid").primaryKey(),
    // Precomputed first-8-bytes-of-SHA-256(uid) as 16 lowercase hex chars.
    // Used by the BLE pipeline: each Met advertisement carries this hash
    // (8 raw bytes fit in a single BLE service-data field, and the device
    // doing the scan resolves the hash → uid via /api/ble/resolve).
    // Indexed for O(1) lookup in the resolve endpoint.
    uidHash: text("uid_hash").notNull().default(""),
    displayName: text("display_name").notNull(),
    photoUrl: text("photo_url"),
    bio: text("bio"),
    socials: jsonb("socials").$type<Record<string, string>>().default({}),
    // Ghost Mode: when false the user is hidden from other devices' nearby
    // queries (Firestore mirror sets isVisible to the same value). Default
    // true so existing rows are visible without an explicit migration.
    isVisible: boolean("is_visible").notNull().default(true),
    // Expo push token for remote notifications. Null until the device
    // registers via POST /api/profiles/me/push-token.
    pushToken: text("push_token"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uidHashIdx: index("profiles_uid_hash_idx").on(table.uidHash),
  }),
);

export const insertProfileSchema = createInsertSchema(profilesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const upsertProfileSchema = insertProfileSchema.partial({
  uid: true,
});

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;
