import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  communityEventRsvpsTable,
  communityEventsTable,
  db,
  profilesTable,
} from "@workspace/db";
import eventsRouter from "../routes/events";

vi.mock("../middlewares/rateLimit", () => ({
  createUserRateLimiter:
    () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/firebaseAdmin", () => ({
  adminAuth: () => ({
    verifyIdToken: vi.fn().mockRejectedValue(new Error("not used in these tests")),
  }),
  adminDb: { collection: vi.fn() },
  adminStorage: {},
}));

const hasDatabase = Boolean(process.env["DATABASE_URL"]);
const testPrefix = `itest-event-${process.pid}`;
const OWNER_UID = `${testPrefix}-owner`;
const INVITEE_UID = `${testPrefix}-invitee`;
const OTHER_UID = `${testPrefix}-other`;
const app = express();
app.use(express.json());
app.use("/api", eventsRouter);

function uidHeader(uid: string) {
  return { "X-Met-Uid": uid };
}

async function cleanup() {
  const ownedEvents = await db
    .select({ id: communityEventsTable.id })
    .from(communityEventsTable)
    .where(eq(communityEventsTable.ownerUid, OWNER_UID));

  if (ownedEvents.length) {
    await db
      .delete(communityEventRsvpsTable)
      .where(inArray(communityEventRsvpsTable.eventId, ownedEvents.map(({ id }) => id)));
  }

  await db
    .delete(communityEventsTable)
    .where(eq(communityEventsTable.ownerUid, OWNER_UID));
  await db
    .delete(profilesTable)
    .where(inArray(profilesTable.uid, [OWNER_UID, INVITEE_UID, OTHER_UID]));
}

describe.runIf(hasDatabase)("community event permissions and privacy", () => {
  beforeAll(async () => {
    await cleanup();
    await db.insert(profilesTable).values([
      { uid: OWNER_UID, displayName: "Event Owner", photoUrl: "https://example.com/owner.jpg" },
      { uid: INVITEE_UID, displayName: "Event Invitee", photoUrl: "https://example.com/invitee.jpg" },
      { uid: OTHER_UID, displayName: "Other Guest", photoUrl: "https://example.com/other.jpg" },
    ]);
  });

  afterAll(cleanup);

  it("keeps invitees private and restricts management to the event owner", async () => {
    const eventBody = {
      title: "Private community gathering",
      description: "An invite-only test event",
      startsAt: "2030-06-01T12:00:00.000Z",
      endsAt: "2030-06-01T14:00:00.000Z",
      visibility: "invite_only",
      inviteeUids: [INVITEE_UID],
    };

    const created = await request(app)
      .post("/api/events")
      .set(uidHeader(OWNER_UID))
      .send(eventBody)
      .expect(201);
    const eventId = created.body.id as number;

    const ownerManageResponse = await request(app)
      .get(`/api/community-events/${eventId}/manage`)
      .set(uidHeader(OWNER_UID))
      .expect(200);
    expect(ownerManageResponse.body.inviteeUids).toEqual([INVITEE_UID]);

    await request(app)
      .get(`/api/events/member/${eventId}`)
      .set(uidHeader(OTHER_UID))
      .expect(404);

    const inviteeDetails = await request(app)
      .get(`/api/events/member/${eventId}`)
      .set(uidHeader(INVITEE_UID))
      .expect(200);
    expect(inviteeDetails.body.title).toBe(eventBody.title);
    expect(inviteeDetails.body).not.toHaveProperty("inviteeUids");

    const changedBody = {
      ...eventBody,
      title: "Unauthorized edit",
    };
    await request(app)
      .put(`/api/community-events/${eventId}`)
      .set(uidHeader(OTHER_UID))
      .send(changedBody)
      .expect(404);

    await request(app)
      .delete(`/api/community-events/${eventId}`)
      .set(uidHeader(OTHER_UID))
      .expect(404);

    const unchanged = await request(app)
      .get(`/api/community-events/${eventId}/manage`)
      .set(uidHeader(OWNER_UID))
      .expect(200);
    expect(unchanged.body.title).toBe(eventBody.title);

    const updated = await request(app)
      .put(`/api/community-events/${eventId}`)
      .set(uidHeader(OWNER_UID))
      .send({ ...eventBody, title: "Updated community gathering" })
      .expect(200);
    expect(updated.body.title).toBe("Updated community gathering");

    await request(app)
      .delete(`/api/community-events/${eventId}`)
      .set(uidHeader(OWNER_UID))
      .expect(204);
    await request(app)
      .get(`/api/community-events/${eventId}/manage`)
      .set(uidHeader(OWNER_UID))
      .expect(404);
  });
});
