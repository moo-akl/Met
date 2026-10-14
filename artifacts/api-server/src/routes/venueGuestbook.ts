import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db, profilesTable, venueQrVerificationsTable, venueGuestbookTable as entries,
  venueGuestbookBlocksTable as blocks, venueContentReportsTable as reports } from "@workspace/db";
import { requireUid } from "../middlewares/requireUid";
import { createUserRateLimiter } from "../middlewares/rateLimit";
import { hasSocialProfile } from "../lib/socialEligibility";
import { saveGuestbookPhoto, deleteGuestbookPhoto, GuestbookPhotoError } from "../lib/guestbookPhoto";

const router: IRouter = Router();
const writeLimit = createUserRateLimiter({ name: "guestbook-write", max: 10, windowMs: 3_600_000 });
const safetyLimit = createUserRateLimiter({ name: "guestbook-safety", max: 60, windowMs: 3_600_000 });
const placeSchema = z.string().regex(/^[A-Za-z0-9_\-:.]{1,200}$/);
export const guestbookBody = z.object({
  note: z.string().trim().min(1).max(500),
  photoBase64: z.string().min(1).max(5_592_408).optional(),
  clientId: z.string().uuid().optional(),
}).strict();
const reasonSchema = z.object({
  reason: z.enum(["inappropriate", "offensive_image", "spam", "harassment", "other"]),
});

async function eligibility(uid: string, placeId: string) {
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.uid, uid)).limit(1);
  if (!hasSocialProfile(profile)) return { profile, eligibility: "profile" as const, canPost: false };
  const [visit] = await db.select({ id: venueQrVerificationsTable.id }).from(venueQrVerificationsTable)
    .where(and(eq(venueQrVerificationsTable.userUid, uid), eq(venueQrVerificationsTable.placeId, placeId))).limit(1);
  return { profile, eligibility: visit ? null : "checkin" as const, canPost: !!visit };
}
function presented(row: typeof entries.$inferSelect, profile: { displayName: string; photoUrl: string | null }) {
  return { id: row.id, authorUid: row.authorUid, displayName: profile.displayName,
    avatarUrl: profile.photoUrl, note: row.note, photoUrl: row.photoUrl, createdAt: row.createdAt.toISOString() };
}
const base = "/hubs/:placeId/guestbook";
router.param("placeId", (_req, res, next, value: string) => {
  if (!placeSchema.safeParse(value).success) { res.status(400).json({ message: "Invalid venue." }); return; }
  next();
});
router.param("entryId", (_req, res, next, value: string) => {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 2_147_483_647) {
    res.status(400).json({ message: "Invalid memory." }); return;
  }
  next();
});
router.get(base, requireUid, async (req, res) => {
  const place = placeSchema.safeParse(req.params.placeId);
  const before = req.query.before === undefined ? undefined : z.coerce.number().int().positive().safeParse(req.query.before);
  if (!place.success || (before && !before.success)) { res.status(400).json({ message: "Invalid venue or page." }); return; }
  const uid = req.uid!;
  const conditions = [
    eq(entries.placeId, place.data), eq(entries.isHidden, false),
    sql`NOT EXISTS (SELECT 1 FROM ${blocks} WHERE
      (${blocks.blockerUid} = ${uid} AND ${blocks.blockedUid} = ${entries.authorUid})
      OR (${blocks.blockedUid} = ${uid} AND ${blocks.blockerUid} = ${entries.authorUid}))`,
    sql`NOT EXISTS (SELECT 1 FROM ${reports} WHERE ${reports.reporterUid} = ${uid}
      AND ${reports.entityType} = 'guestbook' AND ${reports.entityId} = ${entries.id})`,
  ];
  if (before?.success) conditions.push(lt(entries.id, before.data));
  const [rows, access] = await Promise.all([
    db.select({ entry: entries, displayName: profilesTable.displayName, avatarUrl: profilesTable.photoUrl })
      .from(entries).innerJoin(profilesTable, eq(profilesTable.uid, entries.authorUid))
      .where(and(...conditions)).orderBy(desc(entries.id)).limit(21),
    eligibility(uid, place.data),
  ]);
  const page = rows.slice(0, 20);
  res.set("Cache-Control", "no-store").json({
    entries: page.map(r => presented(r.entry, { displayName: r.displayName, photoUrl: r.avatarUrl })),
    nextCursor: rows.length > 20 ? page[page.length - 1]!.entry.id : null,
    canPost: access.canPost, eligibility: access.eligibility,
  });
});
router.post(base, requireUid, writeLimit, async (req, res) => {
  const place = placeSchema.safeParse(req.params.placeId);
  const body = guestbookBody.safeParse(req.body);
  if (!place.success || !body.success) { res.status(400).json({ message: "Write a note of 1–500 characters and choose a JPEG photo under 4 MB." }); return; }
  const uid = req.uid!;
  const access = await eligibility(uid, place.data);
  if (!access.canPost) {
    res.status(403).json({ code: access.eligibility === "profile" ? "PROFILE_COMPLETION_REQUIRED" : "QR_CHECKIN_REQUIRED",
      message: access.eligibility === "profile" ? "Complete your profile and photo before posting." : "Check in with this venue's QR code before leaving a memory." }); return;
  }
  const clientId = body.data.clientId ?? randomUUID();
  const [existing] = await db.select().from(entries)
    .where(and(eq(entries.authorUid, uid), eq(entries.clientId, clientId))).limit(1);
  if (existing) {
    if (existing.placeId !== place.data) { res.status(409).json({ message: "This submission belongs to another venue." }); return; }
    res.json({ entry: presented(existing, access.profile!) }); return;
  }
  let photo: Awaited<ReturnType<typeof saveGuestbookPhoto>> | undefined;
  try {
    if (body.data.photoBase64) photo = await saveGuestbookPhoto(uid, body.data.photoBase64);
    const [created] = await db.insert(entries).values({
      placeId: place.data, authorUid: uid, clientId, note: body.data.note,
      photoPath: photo?.path ?? null, photoUrl: photo?.url ?? null,
    }).onConflictDoNothing().returning();
    if (created) { res.status(201).json({ entry: presented(created, access.profile!) }); return; }
    if (photo) { await deleteGuestbookPhoto(photo.path); photo = undefined; }
    const [duplicate] = await db.select().from(entries)
      .where(and(eq(entries.authorUid, uid), eq(entries.clientId, clientId))).limit(1);
    if (!duplicate || duplicate.placeId !== place.data) { res.status(409).json({ message: "Please try your submission again." }); return; }
    res.json({ entry: presented(duplicate, access.profile!) });
  } catch (error) {
    if (photo) {
      try { await deleteGuestbookPhoto(photo.path); }
      catch (cleanupError) { req.log?.error({ err: cleanupError, uid }, "Guestbook upload cleanup failed; account cleanup will retry"); }
    }
    if (error instanceof GuestbookPhotoError) { res.status(error.status).json({ message: error.message }); return; }
    throw error;
  }
});
router.delete(`${base}/:entryId`, requireUid, async (req, res) => {
  const [entry] = await db.select().from(entries).where(and(
    eq(entries.id, Number(req.params.entryId) || 0), eq(entries.placeId, req.params.placeId as string),
    eq(entries.authorUid, req.uid!),
  )).limit(1);
  if (!entry) { res.status(404).json({ message: "Memory not found." }); return; }
  // Delete storage first; failures are explicit and retryable, never a false success.
  await deleteGuestbookPhoto(entry.photoPath);
  await db.delete(entries).where(eq(entries.id, entry.id));
  res.json({ ok: true });
});
async function findEntry(placeId: string, id: string) {
  const [entry] = await db.select().from(entries).where(and(
    eq(entries.id, Number(id) || 0), eq(entries.placeId, placeId),
  )).limit(1);
  return entry;
}
router.post(`${base}/:entryId/report`, requireUid, safetyLimit, async (req, res) => {
  const body = reasonSchema.safeParse(req.body);
  if (!body.success) { res.status(400).json({ message: "Choose a report reason." }); return; }
  const entry = await findEntry(req.params.placeId as string, req.params.entryId as string);
  if (!entry) { res.status(404).json({ message: "Memory not found." }); return; }
  await db.insert(reports).values({ reporterUid: req.uid!, entityType: "guestbook", entityId: entry.id,
    placeId: entry.placeId, reason: body.data.reason }).onConflictDoNothing();
  res.json({ ok: true });
});
router.post(`${base}/:entryId/block`, requireUid, safetyLimit, async (req, res) => {
  const entry = await findEntry(req.params.placeId as string, req.params.entryId as string);
  if (!entry || entry.authorUid === req.uid) { res.status(404).json({ message: "Memory not found." }); return; }
  await db.insert(blocks).values({ blockerUid: req.uid!, blockedUid: entry.authorUid }).onConflictDoNothing();
  res.json({ ok: true });
});
export default router;
