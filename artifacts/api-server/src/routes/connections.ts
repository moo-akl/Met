import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, eq, or } from "drizzle-orm";
import {
  db,
  profilesTable,
  referralCodesTable,
  revealRequestsTable,
  reviewsTable,
} from "@workspace/db";
import {
  AcceptConnectionInviteResponse,
  GetConnectionInviteResponse,
} from "@workspace/api-zod";
import { requireUid } from "../middlewares/requireUid";
import { createUserRateLimiter } from "../middlewares/rateLimit";
import {
  mirrorConnectionRemoval,
  mirrorRevealStatus,
} from "../lib/firestoreMirror";
import { recalcUserRating } from "../lib/reviewRecalc";
import { sendPush } from "../lib/push";

const router: IRouter = Router();
const connectionInviteReadLimit = createUserRateLimiter({
  windowMs: 60_000,
  max: 40,
  name: "connection-invite-read",
});
const connectionInviteAcceptLimit = createUserRateLimiter({
  windowMs: 60_000,
  max: 20,
  name: "connection-invite-accept",
});
const connectionInviteCode = z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/);

function normalizeConnectionInviteCode(codeParam: string | string[] | undefined) {
  const value = Array.isArray(codeParam) ? codeParam[0] : codeParam;
  return connectionInviteCode.safeParse((value ?? "").trim().toUpperCase());
}

async function findConnectionInvite(code: string) {
  const [invite] = await db
    .select({
      uid: referralCodesTable.uid,
      displayName: profilesTable.displayName,
      photoUrl: profilesTable.photoUrl,
    })
    .from(referralCodesTable)
    .innerJoin(profilesTable, eq(profilesTable.uid, referralCodesTable.uid))
    .where(eq(referralCodesTable.code, code))
    .limit(1);

  return invite ?? null;
}

function areConnectedQuery(uidA: string, uidB: string) {
  return and(
    eq(revealRequestsTable.status, "accepted"),
    or(
      and(
        eq(revealRequestsTable.senderUid, uidA),
        eq(revealRequestsTable.recipientUid, uidB),
      ),
      and(
        eq(revealRequestsTable.senderUid, uidB),
        eq(revealRequestsTable.recipientUid, uidA),
      ),
    ),
  );
}

router.get(
  "/connections/invites/:code",
  requireUid,
  connectionInviteReadLimit,
  async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const callerUid = req.uid!;
    const parsedCode = normalizeConnectionInviteCode(req.params.code);
    if (!parsedCode.success) {
      res.status(400).json({ message: "Invalid invite code" });
      return;
    }
    const invite = await findConnectionInvite(parsedCode.data);
    if (!invite) {
      res.status(404).json({ message: "Invite code not found" });
      return;
    }
    if (invite.uid === callerUid) {
      res.status(400).json({ message: "You cannot accept your own invite" });
      return;
    }

    const [connection] = await db
      .select({ id: revealRequestsTable.id })
      .from(revealRequestsTable)
      .where(areConnectedQuery(callerUid, invite.uid))
      .limit(1);

    res.json(
      GetConnectionInviteResponse.parse({
        ...invite,
        alreadyConnected: Boolean(connection),
      }),
    );
  },
);

router.post(
  "/connections/invites/:code/accept",
  requireUid,
  connectionInviteAcceptLimit,
  async (req, res) => {
    const recipientUid = req.uid!;
    const parsedCode = normalizeConnectionInviteCode(req.params.code);
    if (!parsedCode.success) {
      res.status(400).json({ message: "Invalid invite code" });
      return;
    }
    const invite = await findConnectionInvite(parsedCode.data);
    if (!invite) {
      res.status(404).json({ message: "Invite code not found" });
      return;
    }
    if (invite.uid === recipientUid) {
      res.status(400).json({ message: "You cannot accept your own invite" });
      return;
    }

    const [recipientProfile] = await db
      .select({ displayName: profilesTable.displayName })
      .from(profilesTable)
      .where(eq(profilesTable.uid, recipientUid))
      .limit(1);
    if (!recipientProfile) {
      res.status(400).json({ message: "Complete your profile before accepting an invite" });
      return;
    }

    const now = new Date();
    const alreadyConnected = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: revealRequestsTable.id })
        .from(revealRequestsTable)
        .where(areConnectedQuery(recipientUid, invite.uid))
        .limit(1);
      if (existing) return true;

      await tx
        .insert(revealRequestsTable)
        .values({
          senderUid: invite.uid,
          recipientUid,
          status: "accepted",
          respondedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            revealRequestsTable.senderUid,
            revealRequestsTable.recipientUid,
          ],
          set: {
            status: "accepted",
            respondedAt: now,
            updatedAt: now,
          },
        });

      // An earlier request from the invitee is also covered by the newly
      // accepted invite; do not leave a duplicate pending request in inbox.
      await tx
        .update(revealRequestsTable)
        .set({ status: "accepted", respondedAt: now, updatedAt: now })
        .where(
          and(
            eq(revealRequestsTable.senderUid, recipientUid),
            eq(revealRequestsTable.recipientUid, invite.uid),
            eq(revealRequestsTable.status, "pending"),
          ),
        );
      return false;
    });

    await Promise.all([
      mirrorRevealStatus({
        senderUid: invite.uid,
        recipientUid,
        status: "accepted",
      }),
      mirrorRevealStatus({
        senderUid: recipientUid,
        recipientUid: invite.uid,
        status: "accepted",
      }),
    ]);

    if (!alreadyConnected) {
      const [inviterProfile] = await db
        .select({ pushToken: profilesTable.pushToken })
        .from(profilesTable)
        .where(eq(profilesTable.uid, invite.uid))
        .limit(1);
      await sendPush(inviterProfile?.pushToken, {
        title: `${recipientProfile.displayName} accepted your connection invite`,
        body: "You're now connected — tap to say hi.",
        data: { type: "reveal_accepted", fromUid: recipientUid },
      });
    }

    res.json(
      AcceptConnectionInviteResponse.parse({
        success: true,
        alreadyConnected,
        peer: {
          uid: invite.uid,
          displayName: invite.displayName,
          photoUrl: invite.photoUrl,
        },
      }),
    );
  },
);

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
