import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const referralCodesTable = pgTable("referral_codes", {
  uid: text("uid").primaryKey(),
  code: text("code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  rewardGrantedAt: timestamp("reward_granted_at", { withTimezone: true }),
  rewardExpiresAt: timestamp("reward_expires_at", { withTimezone: true }),
});

export const referralRedemptionsTable = pgTable("referral_redemptions", {
  redeemerUid: text("redeemer_uid").primaryKey(),
  code: text("code").notNull(),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ReferralCode = typeof referralCodesTable.$inferSelect;
export type ReferralRedemption = typeof referralRedemptionsTable.$inferSelect;
