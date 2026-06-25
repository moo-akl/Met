import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  doublePrecision,
  integer,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const networkCategoryEnum = pgEnum("network_category", [
  "university",
  "work",
  "neighborhood",
  "custom",
]);

export const networkMemberRoleEnum = pgEnum("network_member_role", [
  "admin",
  "member",
]);

export const networkMemberStatusEnum = pgEnum("network_member_status", [
  "active",
  "pending",
  "banned",
]);

export const networksTable = pgTable(
  "networks",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    category: networkCategoryEnum("category").notNull(),
    createdByUid: text("created_by_uid").notNull(),
    isPublic: boolean("is_public").notNull().default(true),
    requiresApproval: boolean("requires_approval").notNull().default(false),
    locationLat: doublePrecision("location_lat"),
    locationLng: doublePrecision("location_lng"),
    locationRadiusKm: doublePrecision("location_radius_km").default(2),
    neighborhoodName: text("neighborhood_name"),
    memberCount: integer("member_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    categoryIdx: index("networks_category_idx").on(t.category),
    createdByIdx: index("networks_created_by_idx").on(t.createdByUid),
  }),
);

export const networkMembersTable = pgTable(
  "network_members",
  {
    networkId: integer("network_id").notNull(),
    uid: text("uid").notNull(),
    role: networkMemberRoleEnum("role").notNull().default("member"),
    status: networkMemberStatusEnum("status").notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    invitedByUid: text("invited_by_uid"),
  },
  (t) => ({
    memberUnique: uniqueIndex("network_members_network_uid_uniq").on(
      t.networkId,
      t.uid,
    ),
    networkIdx: index("network_members_network_idx").on(t.networkId),
    uidIdx: index("network_members_uid_idx").on(t.uid),
  }),
);

export const insertNetworkSchema = createInsertSchema(networksTable).omit({
  id: true,
  memberCount: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertNetwork = z.infer<typeof insertNetworkSchema>;
export type Network = typeof networksTable.$inferSelect;
export type NetworkMember = typeof networkMembersTable.$inferSelect;
