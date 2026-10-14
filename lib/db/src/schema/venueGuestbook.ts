import { pgTable, serial, text, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";

/** Durable visit memories. No TTL; author/account deletion and moderation apply. */
export const venueGuestbookTable = pgTable("venue_guestbook", {
  id: serial("id").primaryKey(),
  placeId: text("place_id").notNull(),
  authorUid: text("author_uid").notNull(),
  clientId: text("client_id").notNull(),
  note: text("note").notNull(),
  photoPath: text("photo_path"),
  photoUrl: text("photo_url"),
  isHidden: boolean("is_hidden").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  placePage: index("venue_guestbook_place_page_idx").on(t.placeId, t.id),
  author: index("venue_guestbook_author_idx").on(t.authorUid),
  submission: uniqueIndex("venue_guestbook_submission_idx").on(t.authorUid, t.clientId),
}));

/** Blocking applies across venue guestbooks, in both viewing directions. */
export const venueGuestbookBlocksTable = pgTable("venue_guestbook_blocks", {
  id: serial("id").primaryKey(),
  blockerUid: text("blocker_uid").notNull(),
  blockedUid: text("blocked_uid").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pair: uniqueIndex("venue_guestbook_blocks_pair_idx").on(t.blockerUid, t.blockedUid),
  blocked: index("venue_guestbook_blocks_blocked_idx").on(t.blockedUid),
}));
