import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, eq, or } from "drizzle-orm";
import { db, revealRequestsTable } from "@workspace/db";
import { requireUid } from "../middlewares/requireUid";
import { mirrorConnectionRemoval } from "../lib/firestoreMirror";

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

  await mirrorConnectionRemoval({ uidA: callerUid, uidB: body.peerUid });

  res.json({ success: true });
});

export default router;
