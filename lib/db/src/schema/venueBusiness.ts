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
    uid: text("uid").notNull(),
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
export type InsertVenueBusiness = typeof venueBusinessesTable.$inferInsert;
export type InsertVenueMembership = typeof venueMembershipsTable.$inferInsert;