import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profilesTable = pgTable(
  "profiles",
  {
    uid: text("uid").primaryKey(),
    // Precomputed first-8-bytes-of-SHA-256(uid) as 16 lowercase hex chars.
    // Used by the legacy GATT BLE pipeline (kept for backwards compat —
    // `/api/ble/resolve` still accepts `hashes`). Indexed for O(1) lookup.
    uidHash: text("uid_hash").notNull().default(""),
    // Precomputed iBeacon major (16-bit, 0..65534) derived from the uid
    // via the same polynomial-rolling hash the Flutter MVP used:
    //   `(31 * acc + codeUnit) % 65535`
    // The advertised iBeacon packet carries `<MET_IBEACON_UUID, major,
    // minor=1>`; the receiver resolves major → profile via the BLE
    // resolve endpoint. 16 bits gives ~256-user collision birthday
    // bound which is fine for current scale; collisions resolve to
    // multiple candidates server-side and are de-duped on the client.
    uidMajor: integer("uid_major").notNull().default(0),
    displayName: text("display_name").notNull(),
    photoUrl: text("photo_url"),
    bio: text("bio"),
    socials: jsonb("socials").$type<Record<string, string>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uidHashIdx: index("profiles_uid_hash_idx").on(table.uidHash),
    uidMajorIdx: index("profiles_uid_major_idx").on(table.uidMajor),
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
