import {
  index,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const notificationInboxTable = pgTable(
  "notification_inbox",
  {
    id: serial("id").primaryKey(),
    uid: text("uid")
      .notNull()
      .references(() => profilesTable.uid, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    data: jsonb("data").$type<Record<string, string>>().notNull().default({}),
    sourceKey: text("source_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => ({
    userCreatedIdx: index("notification_inbox_user_created_idx").on(
      table.uid,
      table.createdAt,
      table.id,
    ),
    userReadIdx: index("notification_inbox_user_read_idx").on(
      table.uid,
      table.readAt,
    ),
    userSourceUniq: uniqueIndex("notification_inbox_user_source_uniq").on(
      table.uid,
      table.sourceKey,
    ),
  }),
);
