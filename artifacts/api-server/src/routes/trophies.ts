/**
 * Trophies & gamification utility routes
 *
 * GET  /api/profiles/me/trophies       — caller's trophy collection
 * POST /api/users/record-chat-connection — increment chat_connections for caller
 * POST /api/admin/recalculate-pioneer-scores — refresh pioneer_score for all pioneers (cron/admin)
 */

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, trophiesTable, profilesTable } from "@workspace/db";
import { requireUid } from "../middlewares/requireUid";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/profiles/me/trophies
// Returns the authenticated user's trophy collection, newest first.
// ---------------------------------------------------------------------------
router.get("/profiles/me/trophies", requireUid, async (req, res): Promise<void> => {
  const uid = req.uid!;

  const trophies = await db
    .select({
      id: trophiesTable.id,
      hubId: trophiesTable.hubId,
      hubName: trophiesTable.hubName,
      monthYear: trophiesTable.monthYear,
      rankAchieved: trophiesTable.rankAchieved,
      trophyType: trophiesTable.trophyType,
      awardedAt: trophiesTable.awardedAt,
    })
    .from(trophiesTable)
    .where(eq(trophiesTable.userUid, uid))
    .orderBy(sql`${trophiesTable.awardedAt} DESC`);

  res.json({ trophies });
});

// ---------------------------------------------------------------------------
// POST /api/users/record-chat-connection
// Called by the mobile client the first time a chat is opened with a new peer.
// Increments chat_connections for the caller; used in pioneer score calculation.
// ---------------------------------------------------------------------------
router.post("/users/record-chat-connection", requireUid, async (req, res): Promise<void> => {
  const uid = req.uid!;

  await db
    .update(profilesTable)
    .set({
      chatConnections: sql`${profilesTable.chatConnections} + 1`,
    })
    .where(eq(profilesTable.uid, uid));

  // Keep pioneer_score current after every chat connection.
  await db.execute(sql`
    UPDATE profiles
    SET pioneer_score = (
      (referral_count * 20)
      + (SELECT COUNT(*) FROM hub_checkins WHERE user_uid = profiles.uid)
      + (chat_connections * 5)
    )
    WHERE uid = ${uid} AND is_pioneer = true
  `);

  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /api/admin/recalculate-pioneer-scores
// Recomputes pioneer_score for every pioneer using the live formula:
//   referral_count×20 + hub_checkin_count×2 + chat_connections×5
// Protected by x-cron-secret. Can be triggered manually or by a cron job.
// ---------------------------------------------------------------------------
router.post("/admin/recalculate-pioneer-scores", async (req, res): Promise<void> => {
  const secret = process.env["CRON_SECRET"];
  if (!secret || req.headers["x-cron-secret"] !== secret) {
    const adminSecret = process.env["ADMIN_SECRET"];
    if (!adminSecret || req.headers["x-admin-secret"] !== adminSecret) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
  }

  try {
    await db.execute(sql`
      UPDATE profiles
      SET pioneer_score = (
        (referral_count * 20)
        + (
            COALESCE(
              (SELECT COUNT(*) FROM hub_checkins WHERE user_uid = profiles.uid),
              0
            ) * 2
          )
        + (chat_connections * 5)
      )
      WHERE is_pioneer = true
    `);
    logger.info("Pioneer scores recalculated");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to recalculate pioneer scores");
    res.status(500).json({ message: "Recalculation failed" });
  }
});

export default router;
