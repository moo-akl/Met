import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import {
  communityEventRsvpsTable,
  communityEventPlanMessagesTable,
  communityEventPlanNotificationPreferencesTable,
  communityEventsTable,
  db,
  profilesTable,
  venueContentReportsTable,
} from "@workspace/db";
import eventsRouter from "../routes/events";
import reportsRouter from "../routes/reports";

const { mockSendPushWithStatus } = vi.hoisted(() => ({
  mockSendPushWithStatus: vi.fn().mockResolvedValue({ sent: true }),
}));

vi.mock("../lib/push", () => ({
  sendPush: vi.fn(),
  sendPushWithStatus: mockSendPushWithStatus,
  checkNearbyPushAllowed: vi.fn(() => true),
}));

vi.mock("../middlewares/rateLimit", () => ({
  createUserRateLimiter:
    () => (_req: unknown, _res: unknown, next: () => void) => next(),
  createIpRateLimiter:
    () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../lib/firebaseAdmin", () => ({
  adminAuth: () => ({
    verifyIdToken: vi.fn().mockRejectedValue(new Error("not used in these tests")),
  }),
  adminDb: () => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({ create: vi.fn().mockResolvedValue(undefined) })),
    })),
  }),
  adminStorage: {},
}));

const hasDatabase = Boolean(process.env["DATABASE_URL"]);
process.env["SESSION_SECRET"] ??= "test-event-invite-session-secret";
const testPrefix = `itest-event-${process.pid}`;
const OWNER_UID = `${testPrefix}-owner`;
const INVITEE_UID = `${testPrefix}-invitee`;
const OTHER_UID = `${testPrefix}-other`;
const MUTED_UID = `${testPrefix}-muted`;
const app = express();
app.use(express.json());
app.use("/api", eventsRouter);
app.use("/api", reportsRouter);

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
      .delete(communityEventPlanMessagesTable)
      .where(inArray(
        communityEventPlanMessagesTable.eventId,
        ownedEvents.map(({ id }) => id),
      ));
    await db
      .delete(communityEventPlanNotificationPreferencesTable)
      .where(
        inArray(
          communityEventPlanNotificationPreferencesTable.eventId,
          ownedEvents.map(({ id }) => id),
        ),
      );
    await db
      .delete(venueContentReportsTable)
      .where(and(
        eq(venueContentReportsTable.entityType, "community_event"),
        inArray(venueContentReportsTable.entityId, ownedEvents.map(({ id }) => id)),
      ));
    await db
      .delete(communityEventRsvpsTable)
      .where(inArray(communityEventRsvpsTable.eventId, ownedEvents.map(({ id }) => id)));
  }

  await db
    .delete(communityEventsTable)
    .where(eq(communityEventsTable.ownerUid, OWNER_UID));
  await db
    .delete(profilesTable)
    .where(inArray(profilesTable.uid, [OWNER_UID, INVITEE_UID, OTHER_UID, MUTED_UID]));
}

describe.runIf(hasDatabase)("community event permissions and privacy", () => {
  beforeAll(async () => {
    await cleanup();
    await db.insert(profilesTable).values([
      { uid: OWNER_UID, displayName: "Event Owner", photoUrl: "https://example.com/owner.jpg" },
      { uid: INVITEE_UID, displayName: "Event Invitee", photoUrl: "https://example.com/invitee.jpg" },
      { uid: OTHER_UID, displayName: "Other Guest", photoUrl: "https://example.com/other.jpg" },
      { uid: MUTED_UID, displayName: "Muted Guest", photoUrl: "https://example.com/muted.jpg" },
    ]);
  });

  afterAll(cleanup);

  it("keeps invitees private and restricts management to the event owner", async () => {
    const eventBody = {
      title: "Private community gathering",
      description: "An invite-only test event",
      imageUrl: "https://example.com/community-event.jpg",
      contactPhone: "+1 555 123 4567",
      websiteUrl: "https://example.com/event",
      publicEmail: "events@example.com",
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
    expect(ownerManageResponse.body).toMatchObject({
      imageUrl: eventBody.imageUrl,
      contactPhone: eventBody.contactPhone,
      websiteUrl: eventBody.websiteUrl,
      publicEmail: eventBody.publicEmail,
    });

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
    expect(inviteeDetails.body).toMatchObject({
      imageUrl: eventBody.imageUrl,
      contactPhone: eventBody.contactPhone,
      websiteUrl: eventBody.websiteUrl,
      publicEmail: eventBody.publicEmail,
    });

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
      .send({
        ...eventBody,
        title: "Updated community gathering",
        contactPhone: "+1 555 765 4321",
        websiteUrl: "https://example.com/updated",
        publicEmail: "updated@example.com",
      })
      .expect(200);
    expect(updated.body.title).toBe("Updated community gathering");
    expect(updated.body).toMatchObject({
      contactPhone: "+1 555 765 4321",
      websiteUrl: "https://example.com/updated",
      publicEmail: "updated@example.com",
    });

    await request(app)
      .delete(`/api/community-events/${eventId}`)
      .set(uidHeader(OWNER_UID))
      .expect(204);
    await request(app)
      .get(`/api/community-events/${eventId}/manage`)
      .set(uidHeader(OWNER_UID))
      .expect(404);
  });

  it("shares passcode-protected invite links and grants event access after RSVP", async () => {
    const eventBody = {
      title: "Invite link gathering",
      description: "A private event shared by link",
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      endsAt: null,
      location: null,
      locationPlaceId: null,
      latitude: null,
      longitude: null,
      visibility: "invite_only",
      inviteeUids: [],
      inviteLinkEnabled: true,
      invitePasscode: "frosty7",
    };

    const created = await request(app)
      .post("/api/events")
      .set(uidHeader(OWNER_UID))
      .send(eventBody)
      .expect(201);
    const eventId = created.body.id as number;

    const [storedEvent] = await db
      .select()
      .from(communityEventsTable)
      .where(eq(communityEventsTable.id, eventId))
      .limit(1);
    expect(storedEvent?.invitePasscodeHash).toBeTruthy();
    expect(storedEvent?.invitePasscodeHash).not.toBe(eventBody.invitePasscode);
    expect(storedEvent?.invitePasscodeSalt).toBeTruthy();
    expect(storedEvent?.inviteTokenHash).toBeTruthy();
    expect(storedEvent?.inviteTokenEncrypted).toBeTruthy();
    expect(storedEvent?.inviteTokenEncrypted).not.toContain("frosty7");

    const ownerManageResponse = await request(app)
      .get(`/api/community-events/${eventId}/manage`)
      .set(uidHeader(OWNER_UID))
      .expect(200);
    expect(ownerManageResponse.body).toMatchObject({
      inviteLinkEnabled: true,
      invitePasscodeRequired: true,
    });
    expect(ownerManageResponse.body).not.toHaveProperty("inviteTokenHash");
    expect(ownerManageResponse.body).not.toHaveProperty("invitePasscodeHash");

    const sharedLink = await request(app)
      .post(`/api/community-events/${eventId}/invite-link`)
      .set(uidHeader(OWNER_UID))
      .expect(200);
    expect(sharedLink.body.passcodeRequired).toBe(true);
    const token = new URL(sharedLink.body.url as string).pathname.split("/").pop()!;

    await request(app)
      .post("/api/event-invites/resolve")
      .send({ token })
      .expect(200, { requiresPasscode: true, event: null });
    await request(app)
      .post("/api/event-invites/resolve")
      .send({ token, passcode: "wrong-passcode" })
      .expect(401);

    const resolved = await request(app)
      .post("/api/event-invites/resolve")
      .send({ token, passcode: "frosty7" })
      .expect(200);
    expect(resolved.body).toMatchObject({
      requiresPasscode: true,
      event: {
        id: eventId,
        title: eventBody.title,
        rsvpCount: 0,
      },
    });
    expect(resolved.body.event).not.toHaveProperty("ownerUid");
    expect(resolved.body.event).not.toHaveProperty("inviteeUids");
    expect(resolved.body.event).not.toHaveProperty("inviteTokenHash");

    await request(app)
      .get(`/api/events/member/${eventId}`)
      .set(uidHeader(OTHER_UID))
      .expect(404);

    await request(app)
      .post("/api/event-invites/rsvp")
      .set(uidHeader(OTHER_UID))
      .send({ token, status: "going", passcode: "frosty7" })
      .expect(200, { success: true, status: "going" });

    const recipientDetails = await request(app)
      .get(`/api/events/member/${eventId}`)
      .set(uidHeader(OTHER_UID))
      .expect(200);
    expect(recipientDetails.body.myRsvp).toBe("going");

    const feed = await request(app)
      .get("/api/events/feed")
      .set(uidHeader(OTHER_UID))
      .expect(200);
    expect(feed.body.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "member", id: eventId }),
      ]),
    );

    await request(app)
      .put(`/api/community-events/${eventId}`)
      .set(uidHeader(OWNER_UID))
      .send({
        ...eventBody,
        inviteeUids: [INVITEE_UID],
        inviteLinkEnabled: false,
        invitePasscode: null,
      })
      .expect(200);
    const revokedInviteResponse = await request(app)
      .post("/api/event-invites/resolve")
      .send({ token, passcode: "frosty7" })
      .expect(404);
    expect(revokedInviteResponse.body).toEqual({
      message: "Invitation not found.",
    });
  });

  it("returns a generic unavailable response after an event is removed", async () => {
    const created = await request(app)
      .post("/api/events")
      .set(uidHeader(OWNER_UID))
      .send({
        title: "Removed event invitation",
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        visibility: "invite_only",
        inviteeUids: [],
        inviteLinkEnabled: true,
      })
      .expect(201);
    const eventId = created.body.id as number;

    const sharedLink = await request(app)
      .post(`/api/community-events/${eventId}/invite-link`)
      .set(uidHeader(OWNER_UID))
      .expect(200);
    const token = new URL(sharedLink.body.url as string).pathname.split("/").pop()!;

    await request(app)
      .delete(`/api/community-events/${eventId}`)
      .set(uidHeader(OWNER_UID))
      .expect(204);

    const response = await request(app)
      .post("/api/event-invites/resolve")
      .send({ token })
      .expect(404);
    expect(response.body).toEqual({ message: "Invitation not found." });
  });

  it("lets guests share and report public community events", async () => {
    const eventBody = {
      title: "Open community gathering",
      description: "A public event for sharing",
      startsAt: "2030-06-02T12:00:00.000Z",
      visibility: "public",
      inviteeUids: [],
    };
    const created = await request(app)
      .post("/api/events")
      .set(uidHeader(OWNER_UID))
      .send(eventBody)
      .expect(201);
    const eventId = created.body.id as number;

    const sharedLink = await request(app)
      .post(`/api/community-events/${eventId}/invite-link`)
      .set(uidHeader(OTHER_UID))
      .expect(200);
    expect(sharedLink.body.passcodeRequired).toBe(false);
    const token = new URL(sharedLink.body.url as string).pathname.split("/").pop()!;
    const resolved = await request(app)
      .post("/api/event-invites/resolve")
      .send({ token })
      .expect(200);
    expect(resolved.body).toMatchObject({
      requiresPasscode: false,
      event: { id: eventId, title: eventBody.title },
    });

    await request(app)
      .post("/api/community-event-reports")
      .set(uidHeader(OTHER_UID))
      .send({ eventId, reason: "spam" })
      .expect(201);
    const [report] = await db
      .select()
      .from(venueContentReportsTable)
      .where(and(
        eq(venueContentReportsTable.entityType, "community_event"),
        eq(venueContentReportsTable.entityId, eventId),
        eq(venueContentReportsTable.reporterUid, OTHER_UID),
      ))
      .limit(1);
    expect(report).toMatchObject({
      entityType: "community_event",
      entityId: eventId,
      placeId: "community-events",
      reason: "spam",
    });
  });

  it("shares plan conversations only with hosts and invited or attending members", async () => {
    mockSendPushWithStatus.mockClear();
    const created = await request(app)
      .post("/api/events")
      .set(uidHeader(OWNER_UID))
      .send({
        title: "Dinner with friends",
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        visibility: "invite_only",
        inviteeUids: [INVITEE_UID, MUTED_UID],
      })
      .expect(201);
    const eventId = created.body.id as number;

    const initialChat = await request(app)
      .get(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(OWNER_UID))
      .expect(200);
    expect(initialChat.body.event).toMatchObject({
      id: eventId,
      title: "Dinner with friends",
    });
    expect(initialChat.body.notificationsMuted).toBe(false);
    expect(initialChat.body.participants).toEqual([
      expect.objectContaining({ uid: OWNER_UID, status: "host" }),
    ]);

    await request(app)
      .get(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(OTHER_UID))
      .expect(404);
    await request(app)
      .post(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(OTHER_UID))
      .send({ text: "I should not see this" })
      .expect(404);

    await request(app)
      .post(`/api/community-events/${eventId}/rsvp`)
      .set(uidHeader(INVITEE_UID))
      .send({ status: "going" })
      .expect(200);
    await request(app)
      .post(`/api/community-events/${eventId}/rsvp`)
      .set(uidHeader(MUTED_UID))
      .send({ status: "maybe" })
      .expect(200);
    await db
      .update(profilesTable)
      .set({
        pushToken: "owner-token",
        notificationPrefs: { notifyChat: true },
      })
      .where(eq(profilesTable.uid, OWNER_UID));
    await db
      .update(profilesTable)
      .set({
        pushToken: "invitee-token",
        notificationPrefs: { notifyChat: true },
      })
      .where(eq(profilesTable.uid, INVITEE_UID));
    await db
      .update(profilesTable)
      .set({
        pushToken: "muted-token",
        notificationPrefs: { notifyChat: false },
      })
      .where(eq(profilesTable.uid, MUTED_UID));

    const ownerMessage = await request(app)
      .post(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(OWNER_UID))
      .send({ text: "Let's meet at 7." })
      .expect(201);
    expect(ownerMessage.body.message).toMatchObject({
      senderUid: OWNER_UID,
      senderName: "Event Owner",
      text: "Let's meet at 7.",
    });
    expect(mockSendPushWithStatus).toHaveBeenCalledTimes(1);
    expect(mockSendPushWithStatus).toHaveBeenCalledWith("invitee-token", {
      title: "New message in your plan",
      body: "Open Met to view the conversation.",
      data: {
        type: "event_plan_message",
        eventId: String(eventId),
        eventType: "member",
      },
    });
    expect(JSON.stringify(mockSendPushWithStatus.mock.calls[0]?.[1])).not.toContain(
      "Let's meet at 7.",
    );
    expect(JSON.stringify(mockSendPushWithStatus.mock.calls[0]?.[1])).not.toContain(
      "Dinner with friends",
    );

    mockSendPushWithStatus.mockClear();
    await request(app)
      .post(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(INVITEE_UID))
      .send({ text: "Sounds good." })
      .expect(201);
    expect(mockSendPushWithStatus).toHaveBeenCalledTimes(1);
    expect(mockSendPushWithStatus).toHaveBeenCalledWith("owner-token", {
      title: "New message in your plan",
      body: "Open Met to view the conversation.",
      data: {
        type: "event_plan_message",
        eventId: String(eventId),
        eventType: "member",
      },
    });

    await request(app)
      .put(`/api/community-events/${eventId}/plan-chat/notifications`)
      .set(uidHeader(INVITEE_UID))
      .send({ muted: true })
      .expect(200, { muted: true });
    const mutedChat = await request(app)
      .get(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(INVITEE_UID))
      .expect(200);
    expect(mutedChat.body.notificationsMuted).toBe(true);
    const [inviteePrefsAfterMute] = await db
      .select({ notificationPrefs: profilesTable.notificationPrefs })
      .from(profilesTable)
      .where(eq(profilesTable.uid, INVITEE_UID))
      .limit(1);
    expect(inviteePrefsAfterMute?.notificationPrefs?.notifyChat).toBe(true);

    const secondPlanCreated = await request(app)
      .post("/api/events")
      .set(uidHeader(OWNER_UID))
      .send({
        title: "Coffee with friends",
        startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
        visibility: "public",
        inviteeUids: [],
      })
      .expect(201);
    const secondEventId = secondPlanCreated.body.id as number;
    await request(app)
      .post(`/api/community-events/${secondEventId}/rsvp`)
      .set(uidHeader(INVITEE_UID))
      .send({ status: "going" })
      .expect(200);
    const secondPlanChat = await request(app)
      .get(`/api/community-events/${secondEventId}/plan-chat`)
      .set(uidHeader(INVITEE_UID))
      .expect(200);
    expect(secondPlanChat.body.notificationsMuted).toBe(false);

    mockSendPushWithStatus.mockClear();
    await request(app)
      .post(`/api/community-events/${secondEventId}/plan-chat`)
      .set(uidHeader(OWNER_UID))
      .send({ text: "The other plan still sends alerts." })
      .expect(201);
    expect(mockSendPushWithStatus).toHaveBeenCalledTimes(1);
    expect(mockSendPushWithStatus).toHaveBeenCalledWith("invitee-token", {
      title: "New message in your plan",
      body: "Open Met to view the conversation.",
      data: {
        type: "event_plan_message",
        eventId: String(secondEventId),
        eventType: "member",
      },
    });

    await request(app)
      .put(`/api/community-events/${eventId}/plan-chat/notifications`)
      .set(uidHeader(OTHER_UID))
      .send({ muted: true })
      .expect(404);

    mockSendPushWithStatus.mockClear();
    await request(app)
      .post(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(OWNER_UID))
      .send({ text: "One plan is quiet now." })
      .expect(201);
    expect(mockSendPushWithStatus).not.toHaveBeenCalled();

    await request(app)
      .put(`/api/community-events/${eventId}/plan-chat/notifications`)
      .set(uidHeader(INVITEE_UID))
      .send({ muted: false })
      .expect(200, { muted: false });
    const unmutedChat = await request(app)
      .get(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(INVITEE_UID))
      .expect(200);
    expect(unmutedChat.body.notificationsMuted).toBe(false);

    mockSendPushWithStatus.mockClear();
    await request(app)
      .post(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(OWNER_UID))
      .send({ text: "Alerts are back for this plan." })
      .expect(201);
    expect(mockSendPushWithStatus).toHaveBeenCalledTimes(1);
    expect(mockSendPushWithStatus).toHaveBeenCalledWith("invitee-token", {
      title: "New message in your plan",
      body: "Open Met to view the conversation.",
      data: {
        type: "event_plan_message",
        eventId: String(eventId),
        eventType: "member",
      },
    });

    const inviteeChat = await request(app)
      .get(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(INVITEE_UID))
      .expect(200);
    expect(inviteeChat.body.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ uid: OWNER_UID, status: "host" }),
        expect.objectContaining({ uid: INVITEE_UID, status: "going" }),
      ]),
    );
    expect(inviteeChat.body.messages.map((message: { text: string }) => message.text)).toEqual([
      "Let's meet at 7.",
      "Sounds good.",
      "One plan is quiet now.",
      "Alerts are back for this plan.",
    ]);

    await request(app)
      .post(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(OWNER_UID))
      .send({ text: "   " })
      .expect(400);
    await request(app)
      .post(`/api/community-events/${eventId}/plan-chat`)
      .set(uidHeader(OWNER_UID))
      .send({ text: "x".repeat(501) })
      .expect(400);
  });
});
