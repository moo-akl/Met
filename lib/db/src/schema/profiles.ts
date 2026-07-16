import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
  integer,
  serial,
  uniqueIndex,
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
    // User-selected interest tags (predefined list, up to 10). Stored as a
    // native Postgres text array so queries can use the `&&` overlap operator
    // for interest-based matching in the future.
    interests: text("interests").array().notNull().default([]),
    // BCP-47 language code the user selected in the app (e.g. "en", "es").
    // Used server-side to localise push notification copy (e.g. interest names).
    // Null for rows created before this column was added; treated as "en".
    preferredLocale: text("preferred_locale"),
    // Server-side notification delivery flags. Null = all enabled (default).
    // Synced from the app's SettingsSheet so the server can skip sending
    // notifications the user has turned off without requiring a client round-trip.
    notificationPrefs: jsonb("notification_prefs").$type<{
      notifyNewEncounters?: boolean;
      notifyReencounter?: boolean;
      notifyChat?: boolean;
    }>(),
    // Pioneer status — set to true for the first 500 users who register.
    // Grants 1.5× check-in multiplier and radar priority.
    isPioneer: boolean("is_pioneer").notNull().default(false),
    // Denormalised count of successful referral redemptions. Kept in sync
    // by the referrals route whenever a redemption is processed.
    referralCount: integer("referral_count").notNull().default(0),
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

// ---------------------------------------------------------------------------
// pioneer_referrals
// Records each referral that a pioneer makes. One row per referred user.
// ---------------------------------------------------------------------------
export const pioneerReferralsTable = pgTable(
  "pioneer_referrals",
  {
    id: serial("id").primaryKey(),
    pioneerUid: text("pioneer_uid").notNull(),
    referredUserUid: text("referred_user_uid").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pioneerIdx: index("pioneer_referrals_pioneer_idx").on(t.pioneerUid),
    referredUniq: uniqueIndex("pioneer_referrals_referred_uniq").on(
      t.referredUserUid,
    ),
  }),
);

export type PioneerReferral = typeof pioneerReferralsTable.$inferSelect;

export const insertProfileSchema = createInsertSchema(profilesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const upsertProfileSchema = insertProfileSchema.partial({
  uid: true,
});

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;
