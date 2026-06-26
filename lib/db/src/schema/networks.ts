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

export const announcementTypeEnum = pgEnum("announcement_type", [
  "post",
  "poll",
  "questionnaire",
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
    inviteCode: text("invite_code").unique(),
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

export const networkAnnouncementsTable = pgTable(
  "network_announcements",
  {
    id: serial("id").primaryKey(),
    networkId: integer("network_id").notNull(),
    authorUid: text("author_uid").notNull(),
    body: text("body").notNull(),
    photoUrl: text("photo_url"),
    type: announcementTypeEnum("type").notNull().default("post"),
    isPinned: boolean("is_pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    networkIdx: index("network_announcements_network_idx").on(t.networkId),
    createdAtIdx: index("network_announcements_created_at_idx").on(t.createdAt),
    pinnedIdx: index("network_announcements_pinned_idx").on(t.isPinned),
  }),
);

export const networkPollOptionsTable = pgTable(
  "network_poll_options",
  {
    id: serial("id").primaryKey(),
    announcementId: integer("announcement_id").notNull(),
    label: text("label").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => ({
    announcementIdx: index("network_poll_options_ann_idx").on(t.announcementId),
  }),
);

export const networkPollVotesTable = pgTable(
  "network_poll_votes",
  {
    announcementId: integer("announcement_id").notNull(),
    optionId: integer("option_id").notNull(),
    uid: text("uid").notNull(),
  },
  (t) => ({
    voteUnique: uniqueIndex("network_poll_votes_ann_uid_uniq").on(
      t.announcementId,
      t.uid,
    ),
    announcementIdx: index("network_poll_votes_ann_idx").on(t.announcementId),
  }),
);

export const networkQuestionnaireQuestionsTable = pgTable(
  "network_questionnaire_questions",
  {
    id: serial("id").primaryKey(),
    announcementId: integer("announcement_id").notNull(),
    prompt: text("prompt").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => ({
    announcementIdx: index("network_questionnaire_questions_ann_idx").on(
      t.announcementId,
    ),
  }),
);

export const networkQuestionnaireAnswersTable = pgTable(
  "network_questionnaire_answers",
  {
    id: serial("id").primaryKey(),
    questionId: integer("question_id").notNull(),
    uid: text("uid").notNull(),
    answerText: text("answer_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    questionUidUniq: uniqueIndex(
      "network_questionnaire_answers_q_uid_uniq",
    ).on(t.questionId, t.uid),
    questionIdx: index("network_questionnaire_answers_question_idx").on(
      t.questionId,
    ),
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
export type NetworkAnnouncement = typeof networkAnnouncementsTable.$inferSelect;
export type NetworkPollOption = typeof networkPollOptionsTable.$inferSelect;
export type NetworkPollVote = typeof networkPollVotesTable.$inferSelect;
export type NetworkQuestionnaireQuestion =
  typeof networkQuestionnaireQuestionsTable.$inferSelect;
export type NetworkQuestionnaireAnswer =
  typeof networkQuestionnaireAnswersTable.$inferSelect;
