import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * The durable business aggregate for an approved venue. It deliberately has no
 * dependency on a person's account: the original applicant is only immutable
 * audit attribution, while access is granted through venue memberships.
 */
export const venueBusinessesTable = pgTable(
  "venue_businesses",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    venueOwnerProfileId: integer("venue_owner_profile_id").notNull(),
    placeId: text("place_id").notNull(),
    legalName: text("legal_name").notNull(),
    createdByUid: text("created_by_uid").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileUniq: uniqueIndex("venue_businesses_profile_uniq").on(t.venueOwnerProfileId),
    placeUniq: uniqueIndex("venue_businesses_place_uniq").on(t.placeId),
    activeIdx: index("venue_businesses_active_idx").on(t.isActive),
  }),
);

export const venueMembershipRoles = ["owner", "manager", "editor"] as const;
export type VenueMembershipRole = (typeof venueMembershipRoles)[number];

export const venueMembershipStatuses = ["invited", "active", "revoked"] as const;
export type VenueMembershipStatus = (typeof venueMembershipStatuses)[number];

/**
 * Canonical authorization source for business actions. At most one active
 * owner may exist for a business; ownership transfer must revoke/promote in
 * one transaction before the new owner becomes active.
 */
export const venueMembershipsTable = pgTable(
  "venue_memberships",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    businessId: integer("business_id").notNull(),
    /**
     * Legacy personal-account membership. New business-only accounts use
     * managerId instead, so they never need a consumer Firebase profile.
     */
    uid: text("uid"),
    managerId: integer("manager_id"),
    role: text("role").$type<VenueMembershipRole>().notNull(),
    status: text("status").$type<VenueMembershipStatus>().notNull().default("invited"),
    invitedByUid: text("invited_by_uid"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    businessUidUniq: uniqueIndex("venue_memberships_business_uid_uniq").on(t.businessId, t.uid),
    businessManagerUniq: uniqueIndex("venue_memberships_business_manager_uniq")
      .on(t.businessId, t.managerId)
      .where(sql`${t.managerId} IS NOT NULL`),
    oneActiveOwner: uniqueIndex("venue_memberships_one_active_owner_uniq")
      .on(t.businessId)
      .where(sql`${t.status} = 'active' AND ${t.role} = 'owner'`),
    uidStatusIdx: index("venue_memberships_uid_status_idx").on(t.uid, t.status),
    businessAccessIdx: index("venue_memberships_business_access_idx").on(
      t.businessId,
      t.status,
      t.role,
    ),
  }),
);

/**
 * Credentials for the business-only portal. These records are purposefully
 * detached from Firebase UIDs and the consumer profile tables.
 */
export const venueManagersTable = pgTable(
  "venue_managers",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    sessionVersion: integer("session_version").notNull().default(1),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailUniq: uniqueIndex("venue_managers_email_uniq").on(t.email),
  }),
);

/** Server-stored sessions make logout, removal, and password changes revocable. */
export const venueManagerSessionsTable = pgTable(
  "venue_manager_sessions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    managerId: integer("manager_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    csrfTokenHash: text("csrf_token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenHashUniq: uniqueIndex("venue_manager_sessions_token_hash_uniq").on(t.tokenHash),
    managerActiveIdx: index("venue_manager_sessions_manager_active_idx").on(
      t.managerId,
      t.expiresAt,
    ),
  }),
);

/**
 * Invitation and owner-issued recovery credentials are opaque, short-lived,
 * single-use tokens. Only hashes are stored.
 */
export const venueManagerTokensTable = pgTable(
  "venue_manager_tokens",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    managerId: integer("manager_id"),
    businessId: integer("business_id").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    role: text("role").$type<VenueMembershipRole>().notNull(),
    tokenHash: text("token_hash").notNull(),
    purpose: text("purpose").$type<"invite" | "recovery">().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdByManagerId: integer("created_by_manager_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenHashUniq: uniqueIndex("venue_manager_tokens_token_hash_uniq").on(t.tokenHash),
    businessPurposeIdx: index("venue_manager_tokens_business_purpose_idx").on(
      t.businessId,
      t.purpose,
    ),
  }),
);

export const venueMembershipAuditEventTypes = [
  "backfilled",
  "granted",
  "role_changed",
  "revoked",
  "ownership_transferred",
] as const;
export type VenueMembershipAuditEventType =
  (typeof venueMembershipAuditEventTypes)[number];

/** Append-only attribution for membership and ownership changes. */
export const venueMembershipAuditTable = pgTable(
  "venue_membership_audit",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    businessId: integer("business_id").notNull(),
    membershipId: integer("membership_id"),
    eventType: text("event_type").$type<VenueMembershipAuditEventType>().notNull(),
    actorUid: text("actor_uid"),
    subjectUid: text("subject_uid").notNull(),
    fromRole: text("from_role").$type<VenueMembershipRole>(),
    toRole: text("to_role").$type<VenueMembershipRole>(),
    fromStatus: text("from_status").$type<VenueMembershipStatus>(),
    toStatus: text("to_status").$type<VenueMembershipStatus>(),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    businessCreatedIdx: index("venue_membership_audit_business_created_idx").on(
      t.businessId,
      t.createdAt,
    ),
    membershipCreatedIdx: index("venue_membership_audit_membership_created_idx").on(
      t.membershipId,
      t.createdAt,
    ),
  }),
);

export type VenueBusiness = typeof venueBusinessesTable.$inferSelect;
export type VenueMembership = typeof venueMembershipsTable.$inferSelect;
export type VenueMembershipAudit = typeof venueMembershipAuditTable.$inferSelect;
export type VenueManager = typeof venueManagersTable.$inferSelect;
export type InsertVenueBusiness = typeof venueBusinessesTable.$inferInsert;
export type InsertVenueMembership = typeof venueMembershipsTable.$inferInsert;