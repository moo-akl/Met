import {
  boolean,
  integer,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type UserAccountStatus =
  | "active"
  | "pending_deletion"
  | "purging"
  | "purge_failed"
  | "purged";

/**
 * Stable Met identity and deletion lifecycle for a Firebase-authenticated
 * account. firebaseUid is retained only while the account can be recovered
 * or is still being purged; completed purges clear it.
 */
export const userAccountsTable = pgTable(
  "user_accounts",
  {
    accountId: text("account_id").primaryKey(),
    firebaseUid: text("firebase_uid"),
    status: text("status").$type<UserAccountStatus>().notNull().default("active"),
    deletionRequestedAt: timestamp("deletion_requested_at", {
      withTimezone: true,
    }),
    purgeAfter: timestamp("purge_after", { withTimezone: true }),
    deleteVenueProfile: boolean("delete_venue_profile").notNull().default(false),
    wasProfileVisible: boolean("was_profile_visible").notNull().default(false),
    firestoreSyncPending: boolean("firestore_sync_pending").notNull().default(false),
    purgeAttempts: integer("purge_attempts").notNull().default(0),
    lastPurgeAttemptAt: timestamp("last_purge_attempt_at", {
      withTimezone: true,
    }),
    purgeError: text("purge_error"),
    purgedAt: timestamp("purged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    firebaseUidUnique: uniqueIndex("user_accounts_firebase_uid_unique").on(
      table.firebaseUid,
    ),
    statusPurgeAfterIdx: index("user_accounts_status_purge_after_idx").on(
      table.status,
      table.purgeAfter,
    ),
  }),
);

export type UserAccount = typeof userAccountsTable.$inferSelect;
