import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  profilesTable,
  revealRequestsTable,
  type Profile,
  type RevealRequest,
} from "@workspace/db";
import {
  CreateRevealRequestBody,
  CreateRevealRequestResponse,
  ListInboundRevealsResponse,
  ListOutboundRevealsResponse,
  AcceptRevealRequestBody,
  AcceptRevealRequestResponse,
  DeclineRevealRequestBody,
  DeclineRevealRequestResponse,
} from "@workspace/api-zod";
import { requireUid } from "../middlewares/requireUid";

const router: IRouter = Router();

function serializeProfile(p: Profile) {
  return {
    uid: p.uid,
    displayName: p.displayName,
    photoUrl: p.photoUrl ?? null,
    bio: p.bio ?? null,
    socials: (p.socials ?? {}) as Record<string, string>,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function serializeReveal(r: RevealRequest) {
  return {
    id: r.id,
    senderUid: r.senderUid,
    recipientUid: r.recipientUid,
    message: r.message ?? null,
    status: r.status as "pending" | "accepted" | "declined",
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    respondedAt: r.respondedAt ? r.respondedAt.toISOString() : null,
  };
}

// POST /api/reveals — sender initiates (or refreshes) a reveal request.
router.post("/reveals", requireUid, async (req, res) => {
  const senderUid = req.uid!;
  const body = CreateRevealRequestBody.parse(req.body);

  if (body.recipientUid === senderUid) {
    res.status(400).json({ message: "Cannot send a reveal request to yourself" });
    return;
  }

  // Recipient must exist as a Met user — otherwise they can never receive
  // and respond to the request, which would leave the sender's UI stuck.
  const [recipient] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.uid, body.recipientUid))
    .limit(1);
  if (!recipient) {
    res.status(404).json({ message: "Recipient profile not found" });
    return;
  }

  const now = new Date();
  // Upsert on (sender, recipient) — re-sending after a previous decline /
  // expiry resets the same row to `pending` with a fresh createdAt and
  // null respondedAt so the recipient sees it as a brand-new request.
  const [row] = await db
    .insert(revealRequestsTable)
    .values({
      senderUid,
      recipientUid: body.recipientUid,
      message: body.message ?? null,
      status: "pending",
    })
    .onConflictDoUpdate({
      target: [
        revealRequestsTable.senderUid,
        revealRequestsTable.recipientUid,
      ],
      set: {
        message: body.message ?? null,
        status: "pending",
        createdAt: now,
        updatedAt: now,
        respondedAt: null,
      },
    })
    .returning();

  res.json(
    CreateRevealRequestResponse.parse({
      ...serializeReveal(row!),
      profile: serializeProfile(recipient),
    }),
  );
});

// GET /api/reveals/inbox — pending requests addressed to the caller, with
// the sender's profile inlined so the client can render the encounter
// without a follow-up profile fetch per request.
router.get("/reveals/inbox", requireUid, async (req, res) => {
  const uid = req.uid!;
  const rows = await db
    .select({
      reveal: revealRequestsTable,
      profile: profilesTable,
    })
    .from(revealRequestsTable)
    .leftJoin(
      profilesTable,
      eq(profilesTable.uid, revealRequestsTable.senderUid),
    )
    .where(
      and(
        eq(revealRequestsTable.recipientUid, uid),
        eq(revealRequestsTable.status, "pending"),
      ),
    )
    .orderBy(desc(revealRequestsTable.createdAt));

  const items = rows
    .filter((r) => r.profile !== null)
    .map((r) => ({
      ...serializeReveal(r.reveal),
      profile: serializeProfile(r.profile!),
    }));
  res.json(ListInboundRevealsResponse.parse(items));
});

// GET /api/reveals/outbox — caller's outgoing requests with current status,
// regardless of pending/accepted/declined. The client diffs this against
// local encounter state to detect when a recipient has acted.
router.get("/reveals/outbox", requireUid, async (req, res) => {
  const uid = req.uid!;
  const rows = await db
    .select({
      reveal: revealRequestsTable,
      profile: profilesTable,
    })
    .from(revealRequestsTable)
    .leftJoin(
      profilesTable,
      eq(profilesTable.uid, revealRequestsTable.recipientUid),
    )
    .where(eq(revealRequestsTable.senderUid, uid))
    .orderBy(desc(revealRequestsTable.updatedAt));

  const items = rows
    .filter((r) => r.profile !== null)
    .map((r) => ({
      ...serializeReveal(r.reveal),
      profile: serializeProfile(r.profile!),
    }));
  res.json(ListOutboundRevealsResponse.parse(items));
});

// POST /api/reveals/accept — recipient accepts a pending request from
// `senderUid`. Mutual-consent shortcut: if the recipient also has a
// pending OUTBOUND request to the same sender, auto-accept that too so
// neither side is left waiting on a request the other already consented
// to. We never auto-create a reverse request — only accept one that the
// other party already initiated.
router.post("/reveals/accept", requireUid, async (req, res) => {
  const recipientUid = req.uid!;
  const body = AcceptRevealRequestBody.parse(req.body);
  const now = new Date();

  // Wrap both updates in a single transaction so the mutual-consent
  // shortcut is atomic — either the inbound row AND any reverse pending
  // row both flip to accepted, or neither does. Without this, a process
  // crash or DB hiccup between the two writes could leave the pair in an
  // asymmetric state (one side connected, the other still waiting).
  const updated = await db.transaction(async (tx) => {
    const [forward] = await tx
      .update(revealRequestsTable)
      .set({ status: "accepted", respondedAt: now, updatedAt: now })
      .where(
        and(
          eq(revealRequestsTable.senderUid, body.senderUid),
          eq(revealRequestsTable.recipientUid, recipientUid),
          eq(revealRequestsTable.status, "pending"),
        ),
      )
      .returning();
    if (!forward) return null;
    // Reverse pending (best-effort) — if no row exists, this no-ops.
    await tx
      .update(revealRequestsTable)
      .set({ status: "accepted", respondedAt: now, updatedAt: now })
      .where(
        and(
          eq(revealRequestsTable.senderUid, recipientUid),
          eq(revealRequestsTable.recipientUid, body.senderUid),
          eq(revealRequestsTable.status, "pending"),
        ),
      );
    return forward;
  });

  if (!updated) {
    res.status(404).json({ message: "No pending request from that sender" });
    return;
  }

  res.json(AcceptRevealRequestResponse.parse(serializeReveal(updated)));
});

// POST /api/reveals/decline — recipient declines a pending request.
// Does NOT touch any reverse request: declining is a per-direction
// statement, not a mutual block.
router.post("/reveals/decline", requireUid, async (req, res) => {
  const recipientUid = req.uid!;
  const body = DeclineRevealRequestBody.parse(req.body);
  const now = new Date();

  const [updated] = await db
    .update(revealRequestsTable)
    .set({ status: "declined", respondedAt: now, updatedAt: now })
    .where(
      and(
        eq(revealRequestsTable.senderUid, body.senderUid),
        eq(revealRequestsTable.recipientUid, recipientUid),
        eq(revealRequestsTable.status, "pending"),
      ),
    )
    .returning();

  if (!updated) {
    res.status(404).json({ message: "No pending request from that sender" });
    return;
  }

  res.json(DeclineRevealRequestResponse.parse(serializeReveal(updated)));
});

export default router;
