import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, eq, or } from "drizzle-orm";
import { db, revealRequestsTable, reviewsTable } from "@workspace/db";
import { requireUid } from "../middlewares/requireUid";
import { mirrorConnectionRemoval } from "../lib/firestoreMirror";
import { recalcUserRating } from "../lib/reviewRecalc";

const router: IRouter = Router();

const RemoveConnectionBody = z.object({
  peerUid: z.string().min(1),
});

// POST /api/connections/remove — symmetric removal of a connection.
//
// Deletes BOTH directions of the underlying reveal-request rows so the
// pair cannot reappear via inbox/outbox listings. Then mirrors the
// removal to Firestore on both sides so each device's listener can drop
// the encounter from its local UI immediately, without polling.
//
// Any reviews exchanged between the two users are also hard-deleted so
// that ghost ratings cannot persist after a connection ends. Both users'
// averageRating and communityStanding are recalculated immediately.
//
// Idempotent: if no rows exist for the pair, we still attempt the
// Firestore mirror so a peer who got into a stale state earlier can
// still observe the removal.
router.post("/connections/remove", requireUid, async (req, res) => {
  const callerUid = req.uid!;
  const body = RemoveConnectionBody.parse(req.body);

  if (body.peerUid === callerUid) {
    res.status(400).json({ message: "Cannot remove yourself" });
    return;
  }

  await db
    .delete(revealRequestsTable)
    .where(
      or(
        and(
          eq(revealRequestsTable.senderUid, callerUid),
          eq(revealRequestsTable.recipientUid, body.peerUid),
        ),
        and(
          eq(revealRequestsTable.senderUid, body.peerUid),
          eq(revealRequestsTable.recipientUid, callerUid),
        ),
      ),
    );

  // Remove reviews in both directions between the two users.
  // Without this, a rating written during the connection would continue to
  // influence the receiver's community standing after the connection is gone.
  await db
    .delete(reviewsTable)
    .where(
      or(
        and(
          eq(reviewsTable.reviewerUid, callerUid),
          eq(reviewsTable.receiverUid, body.peerUid),
        ),
        and(
          eq(reviewsTable.reviewerUid, body.peerUid),
          eq(reviewsTable.receiverUid, callerUid),
        ),
      ),
    );

  // Recalculate both users' community standing now that the reviews are gone.
  await Promise.all([
    recalcUserRating(callerUid),
    recalcUserRating(body.peerUid),
  ]);

  await mirrorConnectionRemoval({ uidA: callerUid, uidB: body.peerUid });

  res.json({ success: true });
});

/**
 * POST /api/connections/mark-met
 *
 * Lets either participant confirm "We met in real life!".
 * Sets has_met_in_real_life = true on the shared connection row.
 * Idempotent — calling it multiple times is harmless.
 */
const MarkMetBody = z.object({ peerUid: z.string().min(1) });

router.post("/connections/mark-met", requireUid, async (req, res) => {
  const callerUid = req.uid!;
  const body = MarkMetBody.parse(req.body);

  if (body.peerUid === callerUid) {
    res.status(400).json({ message: "Cannot mark yourself as met" });
    return;
  }

  await db
    .update(revealRequestsTable)
    .set({ hasMetInRealLife: true, updatedAt: new Date() })
    .where(
      and(
        eq(revealRequestsTable.status, "accepted"),
        or(
          and(
            eq(revealRequestsTable.senderUid, callerUid),
            eq(revealRequestsTable.recipientUid, body.peerUid),
          ),
          and(
            eq(revealRequestsTable.senderUid, body.peerUid),
            eq(revealRequestsTable.recipientUid, callerUid),
          ),
        ),
      ),
    );

  res.json({ ok: true });
});

export default router;
