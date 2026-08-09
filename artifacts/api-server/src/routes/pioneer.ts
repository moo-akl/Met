/**
 * Pioneer routes
 *
 * GET /api/pioneer-leaderboard
 *   Returns the top 50 pioneers ranked by pre-computed pioneer_score.
 *   Score formula: referrals×20 + check-ins×2 + chat_connections×5.
 *   Scores are refreshed by the monthly crown job and the
 *   POST /api/admin/recalculate-pioneer-scores endpoint.
 *   The top 5 are flagged with random_prize_eligibility: true.
 *   Rank #1 receives isTopContributor: true for the "Top Contributor" badge.
 */

import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { requireUid } from "../middlewares/requireUid";

const router: IRouter = Router();

router.get("/pioneer-leaderboard", requireUid, async (req, res): Promise<void> => {
  // Read the pre-computed pioneer_score column — backed by an index so this
  // is a fast index-scan + limit, with no aggregation at query time.
  const rows = await db
    .select({
      uid: profilesTable.uid,
      displayName: profilesTable.displayName,
      photoUrl: profilesTable.photoUrl,
      pioneerScore: profilesTable.pioneerScore,
      referralCount: profilesTable.referralCount,
      chatConnections: profilesTable.chatConnections,
    })
    .from(profilesTable)
    .where(eq(profilesTable.isPioneer, true))
    .orderBy(desc(profilesTable.pioneerScore))
    .limit(50);

  const leaderboard = rows.map((r, i) => {
    // Derive hub check-in count from the pre-computed score.
    // Formula: pioneer_score = referrals×20 + hub_checkins×2 + chat_connections×5
    // So: hub_checkins = (score − referrals×20 − chats×5) / 2
    const hubCheckins = Math.max(
      0,
      Math.round((r.pioneerScore - r.referralCount * 20 - r.chatConnections * 5) / 2),
    );

    return {
      rank: i + 1,
      uid: r.uid,
      displayName: r.displayName,
      photoUrl: r.photoUrl ?? null,
      pioneerScore: r.pioneerScore,
      referralCount: r.referralCount,
      hubCheckins,
      chatConnections: r.chatConnections,
      isTopContributor: i === 0,
      random_prize_eligibility: i < 5,
      prize_label: i < 5 ? "Eligible for Founder's Surprise Prize" : null,
    };
  });

  res.json({ leaderboard });
});

export default router;
