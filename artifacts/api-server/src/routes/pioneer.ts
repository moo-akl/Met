/**
 * Pioneer routes
 *
 * GET /api/pioneer-leaderboard
 *   Returns the top 50 pioneers ranked by referral_count.
 *   The top 5 are flagged with random_prize_eligibility: true.
 */

import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import {
  db,
  profilesTable,
  referralCodesTable,
  referralRedemptionsTable,
} from "@workspace/db";
import { requireUid } from "../middlewares/requireUid";

const router: IRouter = Router();

router.get("/pioneer-leaderboard", requireUid, async (req, res): Promise<void> => {
  // Count referral redemptions per pioneer (joined via referral_codes).
  // Only users who are marked is_pioneer = true appear in this leaderboard.
  const rows = await db
    .select({
      uid: profilesTable.uid,
      displayName: profilesTable.displayName,
      photoUrl: profilesTable.photoUrl,
      referralCount: sql<number>`cast(count(${referralRedemptionsTable.redeemerUid}) as int)`,
    })
    .from(profilesTable)
    .leftJoin(referralCodesTable, eq(referralCodesTable.uid, profilesTable.uid))
    .leftJoin(
      referralRedemptionsTable,
      eq(referralRedemptionsTable.code, referralCodesTable.code),
    )
    .where(eq(profilesTable.isPioneer, true))
    .groupBy(profilesTable.uid, profilesTable.displayName, profilesTable.photoUrl)
    .orderBy(desc(sql`count(${referralRedemptionsTable.redeemerUid})`))
    .limit(50);

  const leaderboard = rows.map((r, i) => ({
    rank: i + 1,
    uid: r.uid,
    displayName: r.displayName,
    photoUrl: r.photoUrl ?? null,
    referralCount: Number(r.referralCount),
    random_prize_eligibility: i < 5,
    prize_label: i < 5 ? "Eligible for Founder's Surprise Prize" : null,
  }));

  res.json({ leaderboard });
});

export default router;
