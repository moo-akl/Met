import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { db, profilesTable, venueQrVerificationsTable, venueGuestbookTable as entries,
  venueGuestbookBlocksTable as blocks, venueContentReportsTable as reports } from "@workspace/db";
import { and, eq, inArray, or } from "drizzle-orm";

const photo = vi.hoisted(() => ({ save: vi.fn(), remove: vi.fn() }));
vi.mock("../lib/guestbookPhoto", async (original) => ({
  ...await original<typeof import("../lib/guestbookPhoto")>(),
  saveGuestbookPhoto: photo.save,
  deleteGuestbookPhoto: photo.remove,
}));
vi.mock("../middlewares/requireUid", () => ({
  requireUid: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    req.uid = req.header("x-test-uid");
    if (!req.uid) { res.status(401).json({ message: "Sign in." }); return; }
    next();
  },
}));
vi.mock("../middlewares/rateLimit", () => ({
  createUserRateLimiter: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));
import router from "./venueGuestbook";
import { GuestbookPhotoError } from "../lib/guestbookPhoto";

const seed = randomUUID();
const place = `guestbook-${seed}`;
const author = `gb-author-${seed}`, viewer = `gb-viewer-${seed}`, incomplete = `gb-private-${seed}`;
const uids = [author, viewer, incomplete];
const app = express().use(express.json()).use("/api", router);
// Match production's explicit JSON error handling.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) =>
  res.status(500).json({ message: err.message }));
const path = `/api/hubs/${place}/guestbook`;
const post = (uid = author, data: Record<string, unknown> = { note: "A lovely afternoon.", clientId: randomUUID() }) =>
  request(app).post(path).set("x-test-uid", uid).send(data);
async function clear() {
  await db.delete(reports).where(and(eq(reports.entityType, "guestbook"), eq(reports.placeId, place)));
  await db.delete(entries).where(eq(entries.placeId, place));
  await db.delete(blocks).where(or(inArray(blocks.blockerUid, uids), inArray(blocks.blockedUid, uids)));
}
beforeAll(async () => {
  await db.insert(profilesTable).values(uids.map(uid => ({
    uid, displayName: uid === author ? "Visitor" : "Guest",
    photoUrl: uid === incomplete ? null : "https://example.com/avatar.jpg",
  })));
  await db.insert(venueQrVerificationsTable).values([author, incomplete].map(userUid => ({ userUid, placeId: place })));
});
beforeEach(async () => {
  await clear();
  photo.save.mockReset().mockResolvedValue({ path: `venue-guestbook/${author}/photo.jpg`, url: "https://example.com/visit.jpg" });
  photo.remove.mockReset().mockResolvedValue(undefined);
});
afterAll(async () => {
  await clear();
  await db.delete(venueQrVerificationsTable).where(eq(venueQrVerificationsTable.placeId, place));
  await db.delete(profilesTable).where(inArray(profilesTable.uid, uids));
});

describe("venue guestbook persistence and safety", () => {
  it("requires authentication for reading and posting", async () => {
    expect((await request(app).get(path)).status).toBe(401);
    expect((await request(app).post(path).send({ note: "Hi" })).status).toBe(401);
  });
  it("saves and reads a handwritten note with a visit photo", async () => {
    const created = await post(author, { note: "  A lovely afternoon.  ", photoBase64: "aGVsbG8=", clientId: randomUUID() });
    expect(created.status).toBe(201);
    expect(created.body.entry).toMatchObject({ note: "A lovely afternoon.", authorUid: author, photoUrl: "https://example.com/visit.jpg" });
    expect(photo.save).toHaveBeenCalledWith(author, "aGVsbG8=");
    const page = await request(app).get(path).set("x-test-uid", author);
    expect(page.body.entries).toHaveLength(1);
    expect(page.body).toMatchObject({ canPost: true, eligibility: null, nextCursor: null });
    expect(page.body.entries[0]).not.toHaveProperty("photoPath");
  });
  it("requires a completed profile even if the private visitor has checked in", async () => {
    const result = await post(incomplete);
    expect(result.status).toBe(403);
    expect(result.body.code).toBe("PROFILE_COMPLETION_REQUIRED");
    expect(photo.save).not.toHaveBeenCalled();
  });
  it("requires a venue-specific QR visit; browsing remains available", async () => {
    expect((await post(viewer)).body.code).toBe("QR_CHECKIN_REQUIRED");
    const result = await request(app).get(path).set("x-test-uid", viewer);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ canPost: false, eligibility: "checkin" });
  });
  it.each(["", " ".repeat(2), "x".repeat(501)])("rejects an invalid note", async note => {
    expect((await post(author, { note })).status).toBe(400);
  });
  it("does not expire old memories and paginates without duplicates", async () => {
    await db.insert(entries).values(Array.from({ length: 23 }, (_, i) => ({
      placeId: place, authorUid: author, clientId: randomUUID(), note: `Memory ${i}`,
      createdAt: new Date("2000-01-01T00:00:00Z"),
    })));
    const first = await request(app).get(path).set("x-test-uid", viewer);
    expect(first.body.entries).toHaveLength(20);
    const second = await request(app).get(`${path}?before=${first.body.nextCursor}`).set("x-test-uid", viewer);
    expect(second.body.entries).toHaveLength(3);
    expect(second.body.nextCursor).toBeNull();
    expect(new Set([...first.body.entries, ...second.body.entries].map(e => e.id)).size).toBe(23);
  });
  it("deduplicates a timed-out post retry without uploading the photo twice", async () => {
    const data = { note: "Same draft", clientId: randomUUID(), photoBase64: "aGVsbG8=" };
    const first = await post(author, data), retry = await post(author, data);
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.entry.id).toBe(first.body.entry.id);
    expect(photo.save).toHaveBeenCalledTimes(1);
  });
  it("keeps a photo-check outage unpublished", async () => {
    photo.save.mockRejectedValue(new GuestbookPhotoError(503, "Photo checks unavailable."));
    expect((await post(author, { note: "With photo", photoBase64: "aGVsbG8=" })).status).toBe(503);
    expect((await request(app).get(path).set("x-test-uid", author)).body.entries).toHaveLength(0);
  });
  it("rejects moderated photos without creating a memory", async () => {
    photo.save.mockRejectedValue(new GuestbookPhotoError(422, "Unsafe photo."));
    expect((await post(author, { note: "With photo", photoBase64: "aGVsbG8=" })).status).toBe(422);
  });
  it("only lets the author delete and removes the stored visit photo", async () => {
    const { body } = await post(author, { note: "My photo", photoBase64: "aGVsbG8=" });
    const url = `${path}/${body.entry.id}`;
    expect((await request(app).delete(url).set("x-test-uid", viewer)).status).toBe(404);
    expect(photo.remove).not.toHaveBeenCalled();
    expect((await request(app).delete(url).set("x-test-uid", author)).status).toBe(200);
    expect(photo.remove).toHaveBeenCalledWith(`venue-guestbook/${author}/photo.jpg`);
    expect((await request(app).get(path).set("x-test-uid", author)).body.entries).toHaveLength(0);
  });
  it("does not falsely acknowledge photo deletion on a storage failure", async () => {
    const { body } = await post();
    photo.remove.mockRejectedValue(new Error("Storage unavailable"));
    expect((await request(app).delete(`${path}/${body.entry.id}`).set("x-test-uid", author)).status).toBe(500);
    expect((await request(app).get(path).set("x-test-uid", author)).body.entries).toHaveLength(1);
  });
  it("reports persist to the admin queue and immediately hide content for the reporter", async () => {
    const { body } = await post();
    const url = `${path}/${body.entry.id}/report`;
    expect((await request(app).post(url).set("x-test-uid", incomplete).send({ reason: "offensive_image" })).status).toBe(200);
    expect((await request(app).get(path).set("x-test-uid", incomplete)).body.entries).toHaveLength(0);
    const [report] = await db.select().from(reports).where(eq(reports.placeId, place));
    expect(report).toMatchObject({ entityType: "guestbook", entityId: body.entry.id, status: "open" });
    expect((await request(app).get(path).set("x-test-uid", author)).body.entries).toHaveLength(1);
  });
  it("blocks an author's memories across visits and in both directions", async () => {
    const { body } = await post();
    expect((await request(app).post(`${path}/${body.entry.id}/block`).set("x-test-uid", viewer).send({})).status).toBe(200);
    expect((await request(app).get(path).set("x-test-uid", viewer)).body.entries).toHaveLength(0);
  });
  it("hides admin-moderated memories from all guestbook readers", async () => {
    const { body } = await post();
    await db.update(entries).set({ isHidden: true }).where(eq(entries.id, body.entry.id));
    expect((await request(app).get(path).set("x-test-uid", author)).body.entries).toHaveLength(0);
  });
  it("validates entry IDs and cursors instead of accepting malformed database values", async () => {
    expect((await request(app).get(`${path}?before=NaN`).set("x-test-uid", author)).status).toBe(400);
    expect((await request(app).delete(`${path}/Infinity`).set("x-test-uid", author)).status).toBe(400);
  });
});
