import { Router, type IRouter } from "express";
import { z } from "zod";
import { eq, count, sql } from "drizzle-orm";
import { requireUid } from "../middlewares/requireUid";
import { adminDb } from "../lib/firebaseAdmin";
import { db, userReportsTable, userStatsTable } from "@workspace/db";

const router: IRouter = Router();

// Why server-side: App Store Review Guideline 1.2 requires the
// developer to "act on objectionable content reports within 24 hours".
// Local-only AsyncStorage reports (the previous behaviour) are
// invisible to us, which is an automatic rejection. We persist every
// report into a `reports` Firestore collection that the team can
// monitor with a saved query / dashboard.
//
// We also mirror to Postgres so we can efficiently count per-user and
// trigger automated trust-score penalties.
const ReportBody = z.object({
  encounterId: z.string().min(1).max(128),
  // The reported user's uid, when known. Optional because legacy
  // encounter rows on older clients don't carry it.
  reportedUid: z.string().min(1).max(128).optional().nullable(),
  reason: z.enum([
    "inappropriate",
    "harassment",
    "spam",
    "underage",
    "other",
  ]),
  // Verbatim copy of the offending message (if any) so reviewers have
  // context without having to query a second collection.
  revealMessage: z.string().max(2000).optional().nullable(),
});

// Trust-score penalty applied each time the count crosses a multiple of THRESHOLD.
const TRUST_PENALTY = 50;
const PENALTY_THRESHOLD = 3;

router.post("/reports", requireUid, async (req, res) => {
  const reporterUid = req.uid!;
  let body: z.infer<typeof ReportBody>;
  try {
    body = ReportBody.parse(req.body);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }

  // ── 1. Write to Firestore (primary copy, team can monitor) ───────────────
  let firestoreId: string | null = null;
  try {
    const docRef = await adminDb()
      .collection("reports")
      .add({
        reporterUid,
        reportedUid: body.reportedUid ?? null,
        encounterId: body.encounterId,
        reason: body.reason,
        revealMessage: body.revealMessage ?? null,
        createdAt: new Date().toISOString(),
        status: "open",
      });
    firestoreId = docRef.id;
    req.log?.info?.(
      { id: docRef.id, reporterUid, reason: body.reason },
      "report written to Firestore",
    );
  } catch (err) {
    req.log?.error?.({ err }, "failed to write report to Firestore");
    res.status(500).json({ message: "Failed to record report" });
    return;
  }

  // ── 2. Mirror to Postgres & apply trust-score penalty when needed ─────────
  if (body.reportedUid) {
    const reportedUid = body.reportedUid;
    try {
      // One row per reporter→reported pair (prevents vote-stuffing).
      await db
        .insert(userReportsTable)
        .values({
          reporterUid,
          reportedUid,
          reason: body.reason,
          firestoreId,
        })
        .onConflictDoNothing();

      // Count distinct reporters for this reported user.
      const [{ total }] = await db
        .select({ total: count() })
        .from(userReportsTable)
        .where(eq(userReportsTable.reportedUid, reportedUid));

      const reportCount = Number(total);

      // Apply penalty each time count crosses a multiple of PENALTY_THRESHOLD.
      if (reportCount > 0 && reportCount % PENALTY_THRESHOLD === 0) {
        const now = new Date();
        await db
          .insert(userStatsTable)
          .values({
            userUid: reportedUid,
            trustScore: Math.max(0, 100 - TRUST_PENALTY),
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: userStatsTable.userUid,
            set: {
              trustScore: sql`GREATEST(0, ${userStatsTable.trustScore} - ${TRUST_PENALTY})`,
              updatedAt: now,
            },
          });

        req.log?.info?.(
          { reportedUid, reportCount, penalty: TRUST_PENALTY },
          "trust_score penalised",
        );
      }
    } catch (err) {
      // Postgres mirror is best-effort — report is already safely in Firestore.
      req.log?.warn?.({ err }, "failed to mirror report to Postgres");
    }
  }

  res.json({ id: firestoreId });
});

export default router;
