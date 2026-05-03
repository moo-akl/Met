import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireUid } from "../middlewares/requireUid";
import { adminDb } from "../lib/firebaseAdmin";

const router: IRouter = Router();

// Why server-side: App Store Review Guideline 1.2 requires the
// developer to "act on objectionable content reports within 24 hours".
// Local-only AsyncStorage reports (the previous behaviour) are
// invisible to us, which is an automatic rejection. We persist every
// report into a `reports` Firestore collection that the team can
// monitor with a saved query / dashboard.
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

router.post("/reports", requireUid, async (req, res) => {
  const reporterUid = req.uid!;
  let body: z.infer<typeof ReportBody>;
  try {
    body = ReportBody.parse(req.body);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }
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
        // Status field reviewers can flip when they action the report.
        status: "open",
      });
    req.log?.info?.(
      { id: docRef.id, reporterUid, reason: body.reason },
      "report received",
    );
    res.json({ id: docRef.id });
  } catch (err) {
    req.log?.error?.({ err }, "failed to persist report");
    res.status(500).json({ message: "Failed to record report" });
  }
});

export default router;
