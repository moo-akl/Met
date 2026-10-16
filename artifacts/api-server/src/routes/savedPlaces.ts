import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, venueOwnerProfilesTable } from "@workspace/db";
import { z } from "zod";
import { adminDb } from "../lib/firebaseAdmin";
import { requireUid } from "../middlewares/requireUid";
import { createUserRateLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();
const readLimit = createUserRateLimiter({ windowMs: 60_000, max: 120, name: "saved-places-read" });
const writeLimit = createUserRateLimiter({ windowMs: 60_000, max: 60, name: "saved-places-write" });
const placeIdSchema = z.string().min(1).max(256).regex(/^[A-Za-z0-9_-]+$/);
// Server-only collection: no Firestore client rules grant access. Identity is
// always derived from the verified request, never a body/query/path user ID.
const bookmarks = (uid: string) =>
  adminDb().collection("savedPlaces").doc(uid).collection("venues");

router.get("/saved-places", requireUid, readLimit, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "private, no-store");
  const snapshot = await bookmarks(req.uid!).get();
  const saved = snapshot.docs.map((doc) => ({
    placeId: doc.id,
    placeName: String(doc.data().placeName),
    savedAt: String(doc.data().savedAt),
  }));
  const venues = saved.length
    ? await db.select({
        placeId: venueOwnerProfilesTable.placeId,
        businessName: venueOwnerProfilesTable.businessName,
      }).from(venueOwnerProfilesTable).where(and(
        inArray(venueOwnerProfilesTable.placeId, saved.map((p) => p.placeId)),
        eq(venueOwnerProfilesTable.isApproved, true),
      ))
    : [];
  const names = new Map(venues.map((v) => [v.placeId, v.businessName]));
  res.json(saved.map((p) => ({
    ...p,
    placeName: names.get(p.placeId) ?? p.placeName,
    available: names.has(p.placeId),
  })).sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
});

router.put("/saved-places/:placeId", requireUid, writeLimit, async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "private, no-store");
  const parsed = placeIdSchema.safeParse(req.params.placeId);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid place ID" });
    return;
  }
  const placeId = parsed.data;
  const [venue] = await db.select({
    name: venueOwnerProfilesTable.businessName,
  }).from(venueOwnerProfilesTable).where(and(
    eq(venueOwnerProfilesTable.placeId, placeId),
    eq(venueOwnerProfilesTable.isApproved, true),
  )).limit(1);
  if (!venue) {
    res.status(404).json({ error: "This venue is no longer available to save" });
    return;
  }
  const ref = bookmarks(req.uid!).doc(placeId);
  const saved = await adminDb().runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    const entry = {
      placeId,
      placeName: venue.name,
      savedAt: existing.exists ? String(existing.data()!.savedAt) : new Date().toISOString(),
    };
    transaction.set(ref, entry);
    return entry;
  });
  // Bookmarking deliberately never writes check-ins, QR proofs or reward credit.
  res.json({ ...saved, available: true });
});

router.delete("/saved-places/:placeId", requireUid, writeLimit, async (req, res): Promise<void> => {
  const parsed = placeIdSchema.safeParse(req.params.placeId);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid place ID" });
    return;
  }
  await bookmarks(req.uid!).doc(parsed.data).delete();
  res.status(204).end();
});

export default router;
